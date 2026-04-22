// Wafer model: a square logical grid masked to a circular wafer.
// 0 = clear, 1 = defect. Tiles outside the circular mask are inert.

export const GRID_SIZE = 64;

export type WaferMap = Uint8Array; // length GRID_SIZE * GRID_SIZE

export type Tool =
  | "pencil"
  | "eraser"
  | "brush"
  | "line"
  | "rect"
  | "circle"
  | "fill";

export interface DetectedCluster {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  confidence: number;
  kind: "scratch" | "cluster" | "edge" | "particle";
  color: "cyan" | "magenta";
}

export interface DetectionResult {
  clusters: DetectedCluster[];
  defectiveTiles: number;
  defectPct: number;
  totalActiveTiles: number;
  modelConfidence: number;
  inferenceMs: number;
  yieldPct: number;
}

export function createEmptyMap(): WaferMap {
  return new Uint8Array(GRID_SIZE * GRID_SIZE);
}

export function idx(x: number, y: number) {
  return y * GRID_SIZE + x;
}

// Circular wafer mask — true if tile (x,y) is inside the wafer disc.
const _maskCache: boolean[] = (() => {
  const arr: boolean[] = new Array(GRID_SIZE * GRID_SIZE);
  const cx = (GRID_SIZE - 1) / 2;
  const cy = (GRID_SIZE - 1) / 2;
  const r = GRID_SIZE / 2 - 0.5;
  const r2 = r * r;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      arr[idx(x, y)] = dx * dx + dy * dy <= r2;
    }
  }
  return arr;
})();

export function isInside(x: number, y: number) {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return false;
  return _maskCache[idx(x, y)];
}

export function activeTileCount(): number {
  let n = 0;
  for (let i = 0; i < _maskCache.length; i++) if (_maskCache[i]) n++;
  return n;
}

export function countDefects(map: WaferMap): number {
  let n = 0;
  for (let i = 0; i < map.length; i++) if (map[i]) n++;
  return n;
}

// Painting primitives ------------------------------------------------------

export function paintTile(map: WaferMap, x: number, y: number, value: 0 | 1) {
  if (!isInside(x, y)) return;
  map[idx(x, y)] = value;
}

export function paintBrush(
  map: WaferMap,
  cx: number,
  cy: number,
  size: number,
  value: 0 | 1,
) {
  // size = diameter in tiles (1, 3, 5, 9)
  const r = (size - 1) / 2;
  const r2 = r * r + 0.25;
  const xMin = Math.floor(cx - r);
  const xMax = Math.ceil(cx + r);
  const yMin = Math.floor(cy - r);
  const yMax = Math.ceil(cy + r);
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) paintTile(map, x, y, value);
    }
  }
}

export function paintLine(
  map: WaferMap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  value: 0 | 1,
) {
  // Bresenham
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0,
    y = y0;
  // Safety bound
  const maxSteps = GRID_SIZE * GRID_SIZE;
  let steps = 0;
  while (steps++ < maxSteps) {
    paintBrush(map, x, y, size, value);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function paintRect(
  map: WaferMap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: 0 | 1,
) {
  const xMin = Math.min(x0, x1);
  const xMax = Math.max(x0, x1);
  const yMin = Math.min(y0, y1);
  const yMax = Math.max(y0, y1);
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) paintTile(map, x, y, value);
  }
}

export function paintCircle(
  map: WaferMap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: 0 | 1,
) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  if (rx === 0 || ry === 0) {
    paintTile(map, Math.round(cx), Math.round(cy), value);
    return;
  }
  const xMin = Math.floor(cx - rx);
  const xMax = Math.ceil(cx + rx);
  const yMin = Math.floor(cy - ry);
  const yMax = Math.ceil(cy + ry);
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) paintTile(map, x, y, value);
    }
  }
}

export function floodFill(
  map: WaferMap,
  sx: number,
  sy: number,
  value: 0 | 1,
) {
  if (!isInside(sx, sy)) return;
  const target = map[idx(sx, sy)];
  if (target === value) return;
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (!isInside(x, y)) continue;
    if (map[idx(x, y)] !== target) continue;
    map[idx(x, y)] = value;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
}

// Mock ML detection --------------------------------------------------------
// Connected-components labeling on defect tiles, then classified heuristically.

export function detectClusters(map: WaferMap): DetectionResult {
  const start = performance.now();
  const labels = new Int32Array(map.length);
  let nextLabel = 0;
  const clusters: DetectedCluster[] = [];
  const cx = (GRID_SIZE - 1) / 2;
  const cy = (GRID_SIZE - 1) / 2;
  const wr = GRID_SIZE / 2 - 0.5;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = idx(x, y);
      if (!map[i] || labels[i] !== 0) continue;
      nextLabel++;
      // BFS
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y,
        size = 0;
      let edgeTouches = 0;
      const stack: number[] = [x, y];
      while (stack.length) {
        const yy = stack.pop()!;
        const xx = stack.pop()!;
        if (xx < 0 || yy < 0 || xx >= GRID_SIZE || yy >= GRID_SIZE) continue;
        const ii = idx(xx, yy);
        if (!map[ii] || labels[ii] !== 0) continue;
        labels[ii] = nextLabel;
        size++;
        if (xx < minX) minX = xx;
        if (xx > maxX) maxX = xx;
        if (yy < minY) minY = yy;
        if (yy > maxY) maxY = yy;
        const ddx = xx - cx;
        const ddy = yy - cy;
        if (Math.sqrt(ddx * ddx + ddy * ddy) > wr - 2) edgeTouches++;
        stack.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1);
      }
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
      const density = size / (w * h);
      let kind: DetectedCluster["kind"] = "cluster";
      if (size <= 2) kind = "particle";
      else if (aspect >= 4 && density < 0.6) kind = "scratch";
      else if (edgeTouches > size * 0.3) kind = "edge";

      // Confidence — heuristic, deterministic-ish from size & density.
      const baseConf =
        kind === "particle"
          ? 0.62 + Math.min(0.18, size * 0.04)
          : 0.7 + Math.min(0.28, density * 0.2 + size * 0.005);
      const confidence = Math.max(0.55, Math.min(0.99, baseConf));

      clusters.push({
        id: nextLabel,
        x: minX,
        y: minY,
        w,
        h,
        size,
        confidence,
        kind,
        color: kind === "scratch" || kind === "edge" ? "magenta" : "cyan",
      });
    }
  }

  const defectiveTiles = countDefects(map);
  const totalActiveTiles = activeTileCount();
  const defectPct = (defectiveTiles / totalActiveTiles) * 100;
  const modelConfidence =
    clusters.length === 0
      ? 0.99
      : clusters.reduce((s, c) => s + c.confidence, 0) / clusters.length;
  // simulate inference latency: real compute + a bit of jitter
  const realMs = performance.now() - start;
  const inferenceMs = Math.max(realMs, 240 + Math.random() * 380);

  // crude yield estimate: penalize defective area, penalize cluster count
  const yieldPct = Math.max(
    0,
    Math.min(
      100,
      100 - defectPct * 4 - clusters.length * 0.4,
    ),
  );

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

// PNG export ---------------------------------------------------------------

export function exportToPng(map: WaferMap, scale = 16): string {
  const size = GRID_SIZE * scale;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // Background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  // Defects (only inside the wafer)
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!isInside(x, y)) continue;
      if (map[idx(x, y)]) ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  // Subtle grid (burned in)
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= GRID_SIZE; i++) {
    const p = i * scale + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
  }
  ctx.stroke();

  // Wafer outline ring
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = Math.max(2, scale / 6);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();

  return c.toDataURL("image/png");
}

export function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
