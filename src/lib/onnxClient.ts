// In-browser ONNX inference for the wafer defect CNN.
// Model: input `wafer_map` float32 [1, 1, 64, 64], output `logits` float32 [1, 9].

import * as ort from "onnxruntime-web";
import {
  GRID_SIZE,
  countDefects,
  activeTileCount,
  labelConnectedComponents,
  type DetectionResult,
  type WaferMap,
} from "./wafer";

// WM-811K canonical 9-class label set (pattern types + none).
export const WAFER_CLASSES = [
  "Center",
  "Donut",
  "Edge-Loc",
  "Edge-Ring",
  "Loc",
  "Near-full",
  "Random",
  "Scratch",
  "none",
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

  // Build [1, 1, 64, 64] float32 tensor. Defect tiles → 1.0, clear → 0.0.
  const input = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let i = 0; i < input.length; i++) input[i] = map[i] ? 1 : 0;
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
