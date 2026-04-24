import { useCallback, useEffect, useRef, useState } from "react";
import {
  GRID_SIZE,
  isInside,
  type Tool,
  type WaferMap,
  floodFill,
  idx,
  paintBrush,
  paintCircle,
  paintLine,
  paintRect,
  paintTile,
} from "@/lib/wafer";
import { cn } from "@/lib/utils";

interface Props {
  map: WaferMap;
  tool: Tool;
  brushSize: number;
  showGrid: boolean;
  isDark?: boolean;
  displaySize: number;
  onCommit: (next: WaferMap) => void;
}

// Fixed internal canvas resolution — CSS scales it to fill the container.
const CANVAS_SIZE = 900;

function getColors(isDark: boolean) {
  if (isDark) {
    return {
      workspace:   "#0a0a0a",
      edge:        "#d97706",           // amber-600
      die:         "#22c55e",           // green-500
      defect:      "#dc2626",           // red-600
      grid:        "rgba(55,110,210,0.55)",
      ring:        "#4a6a99",
      primary:     "hsl(224 70% 65%)",
      primarySoft: "hsla(224,70%,65%,0.22)",
      warn:        "hsl(0 70% 60%)",
      warnSoft:    "hsla(0,70%,60%,0.22)",
      labelBg:     "hsla(222,18%,14%,0.95)",
    };
  }
  return {
    workspace:   "#1a1a1a",
    edge:        "#c8a032",
    die:         "#5cb85c",
    defect:      "#cc1c1c",
    grid:        "rgba(40,90,200,0.65)",
    ring:        "#5577aa",
    primary:     "hsl(224 70% 48%)",
    primarySoft: "hsla(224,70%,48%,0.22)",
    warn:        "hsl(0 72% 50%)",
    warnSoft:    "hsla(0,72%,50%,0.22)",
    labelBg:     "rgba(255,255,255,0.95)",
  };
}

export function WaferCanvas({
  map,
  tool,
  brushSize,
  showGrid,
  isDark = false,
  displaySize,
  onCommit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number | null>(null);

  const [draftMap, setDraftMap] = useState<WaferMap | null>(null);
  const dragStateRef = useRef<{
    startX: number; startY: number;
    button: 0 | 2;
    lastX: number;  lastY: number;
  } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const renderMap = draftMap ?? map;
  const colors = getColors(isDark);

  // ── Wafer tiles ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      canvas.width  = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;

      const tilePixels = CANVAS_SIZE / displaySize;
      const { workspace: C_WS, edge: C_EDGE, die: C_DIE, defect: C_DEFECT, grid: C_GRID, ring: C_RING } = colors;

      // Wafer circle matches the isInside mask projected to canvas space.
      // isInside uses radius = GRID_SIZE/2 - 0.5 = 31.5 centered at (31.5, 31.5).
      // In canvas space: radius = 31.5 * (CANVAS_SIZE / GRID_SIZE).
      const waferR = (GRID_SIZE / 2 - 0.5) * (CANVAS_SIZE / GRID_SIZE);
      const waferCx = CANVAS_SIZE / 2;
      const waferCy = CANVAS_SIZE / 2;

      // No background fill — canvas is transparent outside the clip region.

      // Clip to wafer disc
      ctx.save();
      ctx.beginPath();
      ctx.arc(waferCx, waferCy, waferR, 0, Math.PI * 2);
      ctx.clip();

      // Golden edge-cell base fills the clip region; inner dies will overdraw it.
      ctx.fillStyle = C_EDGE;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw each die — use isInside (same gate as paintTile) so inactive cells
      // stay as the golden background, matching what can actually be painted.
      for (let dy = 0; dy < displaySize; dy++) {
        for (let dx = 0; dx < displaySize; dx++) {
          const srcX = Math.floor(dx / displaySize * GRID_SIZE);
          const srcY = Math.floor(dy / displaySize * GRID_SIZE);
          if (!isInside(srcX, srcY)) continue;

          ctx.fillStyle = renderMap[idx(srcX, srcY)] ? C_DEFECT : C_DIE;
          ctx.fillRect(dx * tilePixels, dy * tilePixels, tilePixels, tilePixels);
        }
      }

      // Grid lines overlaid on dies (inside clip)
      if (showGrid) {
        ctx.strokeStyle = C_GRID;
        ctx.lineWidth = Math.max(0.5, tilePixels * 0.06);
        ctx.beginPath();
        for (let i = 0; i <= displaySize; i++) {
          const p = i * tilePixels;
          ctx.moveTo(p, 0);
          ctx.lineTo(p, CANVAS_SIZE);
          ctx.moveTo(0, p);
          ctx.lineTo(CANVAS_SIZE, p);
        }
        ctx.stroke();
      }

      ctx.restore();

      // Wafer ring
      ctx.strokeStyle = C_RING;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(waferCx, waferCy, waferR, 0, Math.PI * 2);
      ctx.stroke();

    });
  }, [renderMap, isDark, displaySize, showGrid]);


  // ── Cursor / brush preview ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = cursorRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width  = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (!hover) return;

    const { primary: C_P, primarySoft: C_PS } = colors;
    const scale = CANVAS_SIZE / GRID_SIZE;
    const drag = dragStateRef.current;
    const isDragShape = drag && (tool === "line" || tool === "rect" || tool === "circle");

    ctx.strokeStyle = C_P;
    ctx.fillStyle   = C_PS;
    ctx.lineWidth   = 1;

    if (isDragShape) {
      const x0 = drag.startX * scale, y0 = drag.startY * scale;
      const x1 = hover.x    * scale, y1 = hover.y    * scale;
      if (tool === "rect") {
        const xMin = Math.min(x0, x1), yMin = Math.min(y0, y1);
        const w = Math.abs(x1 - x0) + scale, h = Math.abs(y1 - y0) + scale;
        ctx.fillRect(xMin, yMin, w, h);
        ctx.strokeRect(xMin + 0.5, yMin + 0.5, w - 1, h - 1);
      } else if (tool === "circle") {
        const cx = (x0 + x1 + scale) / 2, cy = (y0 + y1 + scale) / 2;
        const rx = (Math.abs(x1 - x0) + scale) / 2, ry = (Math.abs(y1 - y0) + scale) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(x0 + scale / 2, y0 + scale / 2);
        ctx.lineTo(x1 + scale / 2, y1 + scale / 2);
        ctx.lineWidth   = Math.max(1, brushSize) * (scale / 2);
        ctx.strokeStyle = C_PS;
        ctx.stroke();
      }
      return;
    }

    const sz = tool === "pencil" || tool === "fill" ? 1 : brushSize;
    const wh = sz * scale;
    ctx.beginPath();
    if (sz <= 1) {
      ctx.rect(hover.x * scale + 0.5, hover.y * scale + 0.5, scale - 1, scale - 1);
    } else {
      ctx.arc((hover.x + 0.5) * scale, (hover.y + 0.5) * scale, wh / 2, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }, [hover, tool, brushSize, isDark]);

  // ── Pointer helpers ────────────────────────────────────────────────────────
  const eventToCell = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.floor(((e.clientX - rect.left)  / rect.width)  * GRID_SIZE),
      y: Math.floor(((e.clientY - rect.top)   / rect.height) * GRID_SIZE),
    };
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      const { x, y } = eventToCell(e);
      const value: 0 | 1 = e.button === 2 || tool === "eraser" ? 0 : 1;
      const next = new Uint8Array(map);

      if (tool === "fill") { floodFill(next, x, y, value); onCommit(next); return; }
      if (tool === "pencil") paintTile(next, x, y, value);
      else if (tool === "brush" || tool === "eraser") paintBrush(next, x, y, brushSize, value);

      dragStateRef.current = { startX: x, startY: y, button: e.button === 2 ? 2 : 0, lastX: x, lastY: y };
      setDraftMap(next);
    },
    [map, tool, brushSize, onCommit],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const { x, y } = eventToCell(e);
      setHover({ x, y });
      const drag = dragStateRef.current;
      if (!drag) return;
      const value: 0 | 1 = drag.button === 2 || tool === "eraser" ? 0 : 1;

      if (tool === "line" || tool === "rect" || tool === "circle") {
        const preview = new Uint8Array(map);
        if (tool === "line")   paintLine(preview, drag.startX, drag.startY, x, y, brushSize, value);
        if (tool === "rect")   paintRect(preview, drag.startX, drag.startY, x, y, value);
        if (tool === "circle") paintCircle(preview, drag.startX, drag.startY, x, y, value);
        setDraftMap(preview);
        drag.lastX = x; drag.lastY = y;
        return;
      }

      if (tool === "pencil" || tool === "brush" || tool === "eraser") {
        const next = draftMap ? new Uint8Array(draftMap) : new Uint8Array(map);
        paintLine(next, drag.lastX, drag.lastY, x, y, tool === "pencil" ? 1 : brushSize, value);
        drag.lastX = x; drag.lastY = y;
        setDraftMap(next);
      }
    },
    [map, draftMap, tool, brushSize],
  );

  const finishDrag = useCallback(() => {
    dragStateRef.current = null;
    if (draftMap) { onCommit(draftMap); setDraftMap(null); }
  }, [draftMap, onCommit]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* noop */ }
      finishDrag();
    },
    [finishDrag],
  );

  return (
    <div className="relative aspect-square w-full select-none">
      <canvas
        ref={canvasRef}
        className={cn("pixelated absolute inset-0 h-full w-full")}
        onContextMenu={(e) => e.preventDefault()}
      />
      <canvas
        ref={cursorRef}
        className="pixelated absolute inset-0 h-full w-full cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
