import React from "react";
import {
  Brush,
  CircleDashed,
  Eraser,
  PaintBucket,
  Pencil,
  Slash,
  Square,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type DrawTool } from "@/components/WaferCanvas";

interface Props {
  drawTool: DrawTool;
  isErase: boolean;
  brushSize: number;
  onDrawToolChange: (t: DrawTool) => void;
  onEraseChange: (v: boolean) => void;
  onBrushSize: (n: number) => void;
  onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  noiseAmount: number;
  onNoiseChange: (amount: number) => void;
}

const DRAW_TOOLS: { id: DrawTool; label: string; key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "brush",  label: "Brush",     key: "B", icon: Brush },
  { id: "line",   label: "Line",      key: "L", icon: Slash },
  { id: "rect",   label: "Rectangle", key: "R", icon: Square },
  { id: "circle", label: "Circle",    key: "C", icon: CircleDashed },
  { id: "fill",   label: "Fill",      key: "F", icon: PaintBucket },
];

const BRUSH_SIZES = [1, 3, 5, 9];

export function Toolbar({
  drawTool,
  isErase,
  brushSize,
  onDrawToolChange,
  onEraseChange,
  onBrushSize,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  noiseAmount,
  onNoiseChange,
}: Props) {

  const showBrushSize = drawTool === "brush" || drawTool === "line";

  const sectionLabel = (text: string) => (
    <div className="font-mono-stat col-span-2 mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">
      {text}
    </div>
  );

  const divider = () => <div className="col-span-2 my-3 h-px w-full bg-border" />;

  return (
    <aside className="flex h-auto self-start w-[160px] shrink-0 flex-col border-r border-b border-border bg-card px-3 py-3 rounded-br-md">
      <div className="grid grid-cols-2 items-start gap-1">

        {/* Mode buttons */}
        {sectionLabel("Mode")}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onEraseChange(false)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-md border py-2 transition-colors w-full",
                !isErase
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground/40 cursor-default",
              )}
            >
              <Pencil className="h-4 w-4" />
              <span className="font-mono-stat text-[8px] uppercase tracking-wider">Draw</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Draw · <span className="text-muted-foreground">E</span></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onEraseChange(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-md border py-2 transition-colors w-full",
                isErase
                  ? "border-destructive/60 bg-destructive/10 text-destructive"
                  : "border-transparent text-muted-foreground/40 cursor-default",
              )}
            >
              <Eraser className="h-4 w-4" />
              <span className="font-mono-stat text-[8px] uppercase tracking-wider">Erase</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Erase · <span className="text-muted-foreground">E</span></TooltipContent>
        </Tooltip>

        {divider()}

        {/* Brush type */}
        {sectionLabel("Brush")}
        {DRAW_TOOLS.map((t) => {
          const Icon = t.icon;
          const active = drawTool === t.id;
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDrawToolChange(t.id)}
                  className={cn(
                    "relative flex h-11 w-full items-center justify-center rounded-md border transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground",
                  )}
                  aria-label={t.label}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span className="font-mono-stat absolute bottom-0.5 right-1 text-[8px] opacity-60">
                    {t.key}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {t.label} · <span className="text-muted-foreground">{t.key}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {divider()}

        {/* Brush size */}
        <div className={cn(
          "col-span-2 rounded-md transition-all",
          !showBrushSize && "pointer-events-none opacity-30 grayscale",
        )}>
          <div className="grid grid-cols-2 items-start gap-1">
            {sectionLabel("Brush Size")}
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => onBrushSize(s)}
                className={cn(
                  "font-mono-stat flex h-8 w-full items-center justify-center rounded text-[10px] transition-colors",
                  brushSize === s
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {s}px
              </button>
            ))}
          </div>
        </div>

        {divider()}

        {/* Noise */}
        {sectionLabel("Add Noise")}
        <div className="col-span-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono-stat text-[10px] text-muted-foreground">Density</span>
            <span className="font-mono-stat text-[10px] font-semibold text-foreground">{noiseAmount}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={noiseAmount}
            onChange={(e) => onNoiseChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-primary"
          />
        </div>

      </div>

      <div className="mt-4 mb-2 h-px w-full bg-border" />

      {/* Bottom actions */}
      <div className="grid grid-cols-2 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canUndo}
              onClick={onUndo}
              className="font-mono-stat h-8 w-full px-0 text-[10px] uppercase hover:bg-primary/10 hover:text-primary"
            >
              Undo
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Undo · <span className="text-muted-foreground">⌘Z</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canRedo}
              onClick={onRedo}
              className="font-mono-stat h-8 w-full px-0 text-[10px] uppercase hover:bg-primary/10 hover:text-primary"
            >
              Redo
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Redo · <span className="text-muted-foreground">⌘⇧Z</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClearAll}
              className="col-span-2 mt-1 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-transparent text-[10px] text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Clear all"
            >
              <Trash2 className="h-[14px] w-[14px]" />
              Clear all
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Clear all
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
