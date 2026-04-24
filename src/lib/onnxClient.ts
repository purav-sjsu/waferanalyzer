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
const WAFER_CLASSES = [
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

function getSession(): Promise<ort.InferenceSession> {
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

export async function runOnnxDetection(map: WaferMap, targetSize = GRID_SIZE): Promise<DetectionResult> {
  const start = performance.now();
  const session = await getSession();

  // Matches training resize_and_pad:
  //   1. Scale longest side to targetSize (nearest-neighbor), preserving aspect ratio
  //   2. Center-pad shorter side with 0 (outside wafer)
  //   3. Normalize: outside=0.0, normal die=0.5, defect=1.0
  const scale = targetSize / Math.max(GRID_SIZE, GRID_SIZE); // square source, always 1:1
  const newH = Math.round(GRID_SIZE * scale);
  const newW = Math.round(GRID_SIZE * scale);
  const padTop = Math.floor((targetSize - newH) / 2);
  const padLeft = Math.floor((targetSize - newW) / 2);

  const input = new Float32Array(targetSize * targetSize); // zero-filled = outside wafer
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const srcX = Math.floor((x / newW) * GRID_SIZE);
      const srcY = Math.floor((y / newH) * GRID_SIZE);
      const srcI = srcY * GRID_SIZE + srcX;
      const dstI = (y + padTop) * targetSize + (x + padLeft);
      if (map[srcI] === 1) {
        input[dstI] = 1.0;
      } else if (isInside(srcX, srcY)) {
        input[dstI] = 0.5;
      }
      // else: 0.0 already from Float32Array zero-fill
    }
  }
  const tensor = new ort.Tensor("float32", input, [1, 1, targetSize, targetSize]);

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
