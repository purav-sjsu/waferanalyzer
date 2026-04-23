// In-browser ONNX inference for the wafer defect CNN.
// Model: input `wafer_map` float32 [1, 1, 64, 64], output `logits` float32 [1, 9].

import * as ort from "onnxruntime-web";
import {
  GRID_SIZE,
  countDefects,
  activeTileCount,
  labelConnectedComponents,
  isInside,
  type DetectionResult,
  type WaferMap,
} from "./wafer";

// WM-811K canonical 9-class label set — ORDER MUST match LABEL_MAP from training:
// CLASSES = ["none","Edge-Ring","Edge-Loc","Center","Loc","Scratch","Random","Donut","Near-full"]
// Index 0=none, 1=Edge-Ring, 2=Edge-Loc, 3=Center, 4=Loc, 5=Scratch, 6=Random, 7=Donut, 8=Near-full
export const WAFER_CLASSES = [
  "none",
  "Edge-Ring",
  "Edge-Loc",
  "Center",
  "Loc",
  "Scratch",
  "Random",
  "Donut",
  "Near-full",
] as const;

const MODEL_URL = "/models/cnn_wafer.onnx";

// Serve onnxruntime-web's WASM artifacts from the official CDN so we don't
// need to copy them into /public.
ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/";
ort.env.wasm.numThreads = 1;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

export function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    }).catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

// Eager warm-up so first inference isn't laggy. Safe to ignore failure.
export function preloadModel() {
  getSession().catch(() => {
    /* model load errors will surface on actual runs */
  });
}

function softmax(logits: Float32Array): Float32Array {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  const exps = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp(logits[i] - max);
    sum += exps[i];
  }
  for (let i = 0; i < exps.length; i++) exps[i] /= sum;
  return exps;
}

export async function runOnnxDetection(map: WaferMap): Promise<DetectionResult> {
  const start = performance.now();
  const session = await getSession();

  // Build [1, 1, 64, 64] float32 tensor matching training normalization:
  //   outside wafer circle → 0.0  (waferMap value 0, divided by 2)
  //   normal die (no defect) → 0.5  (waferMap value 1, divided by 2)
  //   defective die → 1.0  (waferMap value 2, divided by 2)
  // The canvas WaferMap uses 0=clear, 1=defect inside the circle mask.
  // Tiles outside the circle are never painted so they stay 0 — correct.
  // Tiles inside the circle that are clear should be 0.5, not 0.0.
  const input = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = y * GRID_SIZE + x;
      if (map[i] === 1) {
        input[i] = 1.0; // defect die
      } else if (isInside(x, y)) {
        input[i] = 0.5; // normal die (inside wafer, not defective)
      } else {
        input[i] = 0.0; // outside wafer
      }
    }
  }
  const tensor = new ort.Tensor("float32", input, [1, 1, GRID_SIZE, GRID_SIZE]);

  const inputName = session.inputNames[0] ?? "wafer_map";
  const outputName = session.outputNames[0] ?? "logits";
  const out = await session.run({ [inputName]: tensor });
  const logits = out[outputName].data as Float32Array;
  const probs = softmax(logits);

  const scored = Array.from(probs).map((score, i) => ({
    label: WAFER_CLASSES[i] ?? `class_${i}`,
    score,
  }));
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const predictedClass = top.label;
  const modelConfidence = top.score;

  const defectiveTiles = countDefects(map);
  const totalActiveTiles = activeTileCount();
  const defectPct = (defectiveTiles / totalActiveTiles) * 100;

  // Localized overlay: the CNN doesn't emit bboxes, so we surface the
  // connected components as visual cues alongside the model's verdict.
  const clusters = labelConnectedComponents(map).map((c) => ({
    ...c,
    confidence: modelConfidence,
  }));

  // Yield: if the model thinks the wafer is clean, weight that strongly.
  const isClean = predictedClass === "none";
  const yieldPct = isClean
    ? Math.max(70, 100 - defectPct * 1.5)
    : Math.max(0, Math.min(100, 100 - defectPct * 4 - clusters.length * 0.4));

  const inferenceMs = performance.now() - start;

  return {
    clusters,
    defectiveTiles,
    defectPct,
    totalActiveTiles,
    modelConfidence,
    inferenceMs,
    yieldPct,
    predictedClass,
    classScores: scored,
  };
}
