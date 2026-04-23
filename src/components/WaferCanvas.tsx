import { useCallback, useEffect, useRef, useState } from "react";
import {
  GRID_SIZE,
  type DetectionResult,
  type Tool,
  type WaferMap,
  floodFill,
  idx,
  isInside,
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
  detection: DetectionResult | null;
  showOverlay: boolean;
  isDark?: boolean;
  onCommit: (next: WaferMap) => void;
}

const TILE_PX = 11;

function getColors(isDark: boolean) {
  if (isDark) {
    return {
      workspace: "hsl(222 20% 12%)",
      disc: "hsl(222 18% 18%)",
      defect: "hsl(224 70% 65%)",
      grid: "rgba(210, 20%, 96%, 0.08)",
      ring: "hsl(224 60% 50%)",
      primary: "hsl(224 70% 65%)",
      primarySoft: "hsla(224, 70%, 65%, 0.14)",
      warn: "hsl(0 70% 60%)",
      warnSoft: "hsla(0, 70%, 60%, 0.14)",
      labelBg: "hsla(222, 18%, 16%, 0.95)",
    };
  }
  return {
    workspace: "hsl(220 18% 96%)",
    disc: "hsl(220 12% 92%)",
    defect: "hsl(222 30% 18%)",
    grid: "rgba(15, 23, 42, 0.08)",
    ring: "hsl(222 25% 28%)",
    primary: "hsl(224 70% 48%)",
    primarySoft: "hsla(224, 70%, 48%, 0.14)",
    warn: "hsl(0 72% 50%)",
    warnSoft: "hsla(0, 72%, 50%, 0.14)",
    labelBg: "rgba(255, 255, 255, 0.95)",
  };
}
export function WaferCanvas({
  map,
  tool,
  brushSize,
  showGrid,
  detection,
  showOverlay,
  onCommit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);

  const [draftMap, setDraftMap] = useState<WaferMap | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    button: 0 | 2;
    lastX: number;
    lastY: number;
  } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const renderMap = draftMap ?? map;

  // Draw wafer map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const size = GRID_SIZE * TILE_PX;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = COLOR_WORKSPACE;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = COLOR_DISC;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = COLOR_DEFECT;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (!isInside(x, y)) continue;
        if (renderMap[idx(x, y)]) {
          ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
        }
      }
    }

    if (showGrid) {
      ctx.strokeStyle = COLOR_GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= GRID_SIZE; i++) {
        const p = i * TILE_PX + 0.5;
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
      }
      ctx.stroke();
    }

    ctx.restore();

    ctx.strokeStyle = COLOR_RING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Notch (orientation marker at bottom)
    ctx.fillStyle = COLOR_WORKSPACE;
    ctx.strokeStyle = COLOR_RING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const notchR = TILE_PX * 1.2;
    ctx.arc(size / 2, size - 2, notchR, Math.PI, 0, true);
    ctx.fill();
    ctx.stroke();
  }, [renderMap, showGrid]);

  // Detection overlay
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = GRID_SIZE * TILE_PX;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    if (!detection || !showOverlay) return;

    for (const c of detection.clusters) {
      const stroke = c.color === "magenta" ? COLOR_WARN : COLOR_PRIMARY;
      const fill = c.color === "magenta" ? COLOR_WARN_SOFT : COLOR_PRIMARY_SOFT;
      const x = c.x * TILE_PX;
      const y = c.y * TILE_PX;
      const w = c.w * TILE_PX;
      const h = c.h * TILE_PX;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.setLineDash([]);

      const label = `${c.kind} ${(c.confidence * 100).toFixed(0)}%`;
      ctx.font = "10px ui-monospace, Menlo, monospace";
      const tw = ctx.measureText(label).width + 6;
      const th = 13;
      const lx = Math.min(size - tw - 2, Math.max(2, x));
      const ly = Math.max(0, y - th - 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(lx, ly, tw, th);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(lx + 0.5, ly + 0.5, tw - 1, th - 1);
      ctx.fillStyle = stroke;
      ctx.fillText(label, lx + 3, ly + 9.5);
    }
  }, [detection, showOverlay]);

  // Cursor / brush preview
  useEffect(() => {
    const canvas = cursorRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = GRID_SIZE * TILE_PX;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    if (!hover) return;

    const drag = dragStateRef.current;
    const isDragShape = drag && (tool === "line" || tool === "rect" || tool === "circle");

    ctx.strokeStyle = COLOR_PRIMARY;
    ctx.fillStyle = COLOR_PRIMARY_SOFT;
    ctx.lineWidth = 1;

    if (isDragShape) {
      const x0 = drag.startX;
      const y0 = drag.startY;
      const x1 = hover.x;
      const y1 = hover.y;
      if (tool === "rect") {
        const xMin = Math.min(x0, x1) * TILE_PX;
        const yMin = Math.min(y0, y1) * TILE_PX;
        const w = (Math.abs(x1 - x0) + 1) * TILE_PX;
        const h = (Math.abs(y1 - y0) + 1) * TILE_PX;
        ctx.fillRect(xMin, yMin, w, h);
        ctx.strokeRect(xMin + 0.5, yMin + 0.5, w - 1, h - 1);
      } else if (tool === "circle") {
        const cx = ((x0 + x1) / 2 + 0.5) * TILE_PX;
        const cy = ((y0 + y1) / 2 + 0.5) * TILE_PX;
        const rx = ((Math.abs(x1 - x0) + 1) / 2) * TILE_PX;
        const ry = ((Math.abs(y1 - y0) + 1) / 2) * TILE_PX;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo((x0 + 0.5) * TILE_PX, (y0 + 0.5) * TILE_PX);
        ctx.lineTo((x1 + 0.5) * TILE_PX, (y1 + 0.5) * TILE_PX);
        ctx.lineWidth = Math.max(1, brushSize) * (TILE_PX / 2);
        ctx.strokeStyle = COLOR_PRIMARY_SOFT;
        ctx.stroke();
      }
      return;
    }

    const sz = tool === "pencil" || tool === "fill" ? 1 : brushSize;
    const wh = sz * TILE_PX;
    ctx.beginPath();
    if (sz <= 1) {
      ctx.rect(hover.x * TILE_PX + 0.5, hover.y * TILE_PX + 0.5, TILE_PX - 1, TILE_PX - 1);
    } else {
      ctx.arc(
        (hover.x + 0.5) * TILE_PX,
        (hover.y + 0.5) * TILE_PX,
        wh / 2,
        0,
        Math.PI * 2,
      );
    }
    ctx.fill();
    ctx.stroke();
  }, [hover, tool, brushSize]);

  const eventToCell = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * GRID_SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * GRID_SIZE;
    return { x: Math.floor(px), y: Math.floor(py) };
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      const { x, y } = eventToCell(e);
      const value: 0 | 1 = e.button === 2 || tool === "eraser" ? 0 : 1;
      const next = new Uint8Array(map);

      if (tool === "fill") {
        floodFill(next, x, y, value);
        onCommit(next);
        return;
      }

      if (tool === "pencil") {
        paintTile(next, x, y, value);
      } else if (tool === "brush" || tool === "eraser") {
        paintBrush(next, x, y, brushSize, value);
      }

      if (tool === "line" || tool === "rect" || tool === "circle") {
        dragStateRef.current = {
          startX: x,
          startY: y,
          button: e.button === 2 ? 2 : 0,
          lastX: x,
          lastY: y,
        };
        setDraftMap(next);
        return;
      }

      dragStateRef.current = {
        startX: x,
        startY: y,
        button: e.button === 2 ? 2 : 0,
        lastX: x,
        lastY: y,
      };
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
        if (tool === "line")
          paintLine(preview, drag.startX, drag.startY, x, y, brushSize, value);
        else if (tool === "rect")
          paintRect(preview, drag.startX, drag.startY, x, y, value);
        else if (tool === "circle")
          paintCircle(preview, drag.startX, drag.startY, x, y, value);
        setDraftMap(preview);
        drag.lastX = x;
        drag.lastY = y;
        return;
      }

      if (tool === "pencil" || tool === "brush" || tool === "eraser") {
        const next = draftMap ? new Uint8Array(draftMap) : new Uint8Array(map);
        const size = tool === "pencil" ? 1 : brushSize;
        paintLine(next, drag.lastX, drag.lastY, x, y, size, value);
        drag.lastX = x;
        drag.lastY = y;
        setDraftMap(next);
      }
    },
    [map, draftMap, tool, brushSize],
  );

  const finishDrag = useCallback(() => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    if (draftMap) {
      onCommit(draftMap);
      setDraftMap(null);
    }
  }, [draftMap, onCommit]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      finishDrag();
    },
    [finishDrag],
  );

  const onPointerLeave = useCallback(() => {
    setHover(null);
  }, []);

  return (
    <div className="relative aspect-square w-full max-w-[min(78vh,820px)] select-none">
      <div className="absolute inset-0 rounded-full bg-card shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-border" />
      <canvas
        ref={canvasRef}
        className={cn("pixelated absolute inset-0 h-full w-full rounded-full")}
        onContextMenu={(e) => e.preventDefault()}
      />
      <canvas
        ref={overlayRef}
        className="pixelated pointer-events-none absolute inset-0 h-full w-full rounded-full"
      />
      <canvas
        ref={cursorRef}
        className="pixelated absolute inset-0 h-full w-full cursor-crosshair rounded-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="font-mono-stat pointer-events-none absolute bottom-3 left-3 rounded border border-border bg-card/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
        {hover ? (
          <>
            x:{String(hover.x).padStart(2, "0")} · y:{String(hover.y).padStart(2, "0")}
          </>
        ) : (
          <>idle</>
        )}
      </div>
      <div className="font-mono-stat pointer-events-none absolute bottom-3 right-3 rounded border border-border bg-card/90 px-2 py-1 text-[10px] text-foreground backdrop-blur">
        {GRID_SIZE}×{GRID_SIZE}
      </div>
    </div>
  );
}
