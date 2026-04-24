// ML client — picks the best available inference backend:
//   1. In-browser ONNX model (cnn_wafer.onnx) — preferred
//   2. Configurable HTTP endpoint (advanced users)

import {
  GRID_SIZE,
  type DetectedCluster,
  type DetectionResult,
  type WaferMap,
} from "./wafer";
import { runOnnxDetection } from "./onnxClient";

const ENDPOINT_KEY = "wafer.mlEndpoint";
const APIKEY_KEY = "wafer.mlApiKey";
const BACKEND_KEY = "wafer.mlBackend"; // "onnx" | "remote" | "local"

export type MlBackend = "onnx" | "remote" | "local";
export type MlSource = "onnx" | "remote" | "local";

export function getEndpoint(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ENDPOINT_KEY) ?? "";
}
export function setEndpoint(url: string) {
  if (url) localStorage.setItem(ENDPOINT_KEY, url);
  else localStorage.removeItem(ENDPOINT_KEY);
}

export function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(APIKEY_KEY) ?? "";
}
export function setApiKey(key: string) {
  if (key) localStorage.setItem(APIKEY_KEY, key);
  else localStorage.removeItem(APIKEY_KEY);
}

export function getBackend(): MlBackend {
  if (typeof window === "undefined") return "onnx";
  const v = localStorage.getItem(BACKEND_KEY);
  return v === "remote" || v === "local" ? v : "onnx";
}
export function setBackend(b: MlBackend) {
  localStorage.setItem(BACKEND_KEY, b);
}

// ---- Remote endpoint adapter ---------------------------------------------

interface RawCluster {
  id?: number;
  x?: number; y?: number; w?: number; h?: number;
  bbox?: [number, number, number, number];
  x0?: number; y0?: number; x1?: number; y1?: number;
  size?: number;
  area?: number;
  confidence?: number;
  score?: number;
  prob?: number;
  kind?: string;
  label?: string;
  class?: string;
}

interface RawResponse {
  clusters?: RawCluster[];
  detections?: RawCluster[];
  predictions?: RawCluster[];
  defective_tiles?: number;
  defectiveTiles?: number;
  defect_pct?: number;
  defectPct?: number;
  total_active_tiles?: number;
  totalActiveTiles?: number;
  model_confidence?: number;
  modelConfidence?: number;
  inference_ms?: number;
  inferenceMs?: number;
  yield_pct?: number;
  yieldPct?: number;
}

function normalizeKind(k?: string): DetectedCluster["kind"] {
  const s = (k ?? "").toLowerCase();
  if (s.includes("scratch")) return "scratch";
  if (s.includes("edge")) return "edge";
  if (s.includes("particle") || s.includes("point")) return "particle";
  return "cluster";
}

function normalizeCluster(raw: RawCluster, idx: number): DetectedCluster {
  let x = raw.x ?? raw.x0 ?? 0;
  let y = raw.y ?? raw.y0 ?? 0;
  let w = raw.w ?? 0;
  let h = raw.h ?? 0;
  if (raw.bbox && raw.bbox.length === 4) {
    [x, y, w, h] = raw.bbox;
  } else if (raw.x1 !== undefined && raw.y1 !== undefined) {
    w = (raw.x1 - x) + 1;
    h = (raw.y1 - y) + 1;
  }
  const size = raw.size ?? raw.area ?? Math.max(1, w * h);
  const confidence = raw.confidence ?? raw.score ?? raw.prob ?? 0.85;
  const kind = normalizeKind(raw.kind ?? raw.label ?? raw.class);
  return {
    id: raw.id ?? idx + 1,
    x: Math.max(0, Math.floor(x)),
    y: Math.max(0, Math.floor(y)),
    w: Math.max(1, Math.floor(w)),
    h: Math.max(1, Math.floor(h)),
    size: Math.max(1, Math.floor(size)),
    confidence: Math.max(0, Math.min(1, confidence)),
    kind,
    color: kind === "scratch" || kind === "edge" ? "magenta" : "cyan",
  };
}

async function runRemoteDetection(map: WaferMap): Promise<DetectionResult> {
  const endpoint = getEndpoint();
  if (!endpoint) throw new Error("No remote endpoint configured");
  const start = performance.now();
  const apiKey = getApiKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const body = JSON.stringify({
    grid_size: GRID_SIZE,
    width: GRID_SIZE,
    height: GRID_SIZE,
    map: Array.from(map),
  });

  const res = await fetch(endpoint, { method: "POST", headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Model server ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as RawResponse;

  const rawClusters =
    data.clusters ?? data.detections ?? data.predictions ?? [];
  const clusters = rawClusters.map(normalizeCluster);

  const local = detectClusters(map);
  const defectiveTiles = data.defective_tiles ?? data.defectiveTiles ?? local.defectiveTiles;
  const totalActiveTiles =
    data.total_active_tiles ?? data.totalActiveTiles ?? local.totalActiveTiles;
  const defectPct =
    data.defect_pct ?? data.defectPct ?? (defectiveTiles / totalActiveTiles) * 100;
  const modelConfidence =
    data.model_confidence ??
    data.modelConfidence ??
    (clusters.length === 0
      ? 0.99
      : clusters.reduce((s, c) => s + c.confidence, 0) / clusters.length);
  const yieldPct =
    data.yield_pct ?? data.yieldPct ??
    Math.max(0, Math.min(100, 100 - defectPct * 4 - clusters.length * 0.4));
  const inferenceMs =
    data.inference_ms ?? data.inferenceMs ?? performance.now() - start;

  return {
    clusters,
    defectiveTiles,
    defectPct,
    totalActiveTiles,
    modelConfidence,
    inferenceMs,
    yieldPct,
  };
}

// ---- Public entry point --------------------------------------------------

export async function runDetection(map: WaferMap): Promise<{
  result: DetectionResult;
  source: MlSource;
}> {
  const backend = getBackend();

  if (backend === "remote" && getEndpoint()) {
    return { result: await runRemoteDetection(map), source: "remote" };
  }
  return { result: await runOnnxDetection(map), source: "onnx" };
}
