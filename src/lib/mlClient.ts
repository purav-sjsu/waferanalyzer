// ML client — calls a configurable HTTP endpoint that wraps the notebook model.
// Falls back to the local heuristic detector when no endpoint is configured.

import {
  GRID_SIZE,
  detectClusters,
  type DetectedCluster,
  type DetectionResult,
  type WaferMap,
} from "./wafer";

const ENDPOINT_KEY = "wafer.mlEndpoint";
const APIKEY_KEY = "wafer.mlApiKey";

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

// Expected response shape from the user's model server.
// Designed to be permissive — any of these field names work.
interface RawCluster {
  id?: number;
  x?: number; y?: number; w?: number; h?: number;
  // alternative bbox formats
  bbox?: [number, number, number, number]; // [x, y, w, h]
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

export async function runDetection(map: WaferMap): Promise<{
  result: DetectionResult;
  source: "remote" | "local";
}> {
  const endpoint = getEndpoint();
  if (!endpoint) {
    return { result: detectClusters(map), source: "local" };
  }

  const start = performance.now();
  const apiKey = getApiKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  // Send the raw flat array (0/1) plus dimensions. Easy for any
  // notebook-backed server (FastAPI/Flask) to consume.
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

  // Fall back to local stats if server omits them.
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
    result: {
      clusters,
      defectiveTiles,
      defectPct,
      totalActiveTiles,
      modelConfidence,
      inferenceMs,
      yieldPct,
    },
    source: "remote",
  };
}
