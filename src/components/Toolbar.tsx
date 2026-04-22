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
import type { Tool } from "@/lib/wafer";

interface Props {
  tool: Tool;
  brushSize: number;
  onToolChange: (t: Tool) => void;
  onBrushSize: (n: number) => void;
  onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: { id: Tool; label: string; key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "pencil", label: "Pencil", key: "P", icon: Pencil },
  { id: "eraser", label: "Eraser", key: "E", icon: Eraser },
  { id: "brush", label: "Brush", key: "B", icon: Brush },
  { id: "line", label: "Line", key: "L", icon: Slash },
  { id: "rect", label: "Rectangle", key: "R", icon: Square },
  { id: "circle", label: "Circle", key: "C", icon: CircleDashed },
  { id: "fill", label: "Fill bucket", key: "F", icon: PaintBucket },
];

const BRUSH_SIZES = [1, 3, 5, 9];

export function Toolbar({
  tool,
  brushSize,
  onToolChange,
  onBrushSize,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const showBrushSize = tool === "brush" || tool === "eraser" || tool === "line";

  return (
    <aside className="flex h-full w-[68px] shrink-0 flex-col items-center gap-1 border-r border-border bg-card/40 py-3">
      <div className="font-mono-stat mb-1 text-[9px] uppercase tracking-widest text-muted-foreground">
        Tools
      </div>
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToolChange(t.id)}
                className={cn(
                  "group relative flex h-11 w-11 items-center justify-center rounded-md border transition-colors",
                  active
                    ? "border-primary/70 bg-primary/15 text-primary shadow-[0_0_24px_-6px_hsl(186_95%_55%/0.6)]"
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
            <TooltipContent side="right" className="font-mono-stat text-xs">
              {t.label} · <span className="text-muted-foreground">{t.key}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}

      <div className="my-2 h-px w-8 bg-border" />

      {showBrushSize && (
        <div className="flex flex-col items-center gap-1">
          <div className="font-mono-stat text-[9px] uppercase tracking-widest text-muted-foreground">
            Size
          </div>
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => onBrushSize(s)}
              className={cn(
                "font-mono-stat flex h-7 w-9 items-center justify-center rounded text-[10px] transition-colors",
                brushSize === s
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {s}px
            </button>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canUndo}
              onClick={onUndo}
              className="font-mono-stat h-8 w-11 px-0 text-[10px] uppercase"
            >
              Undo
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-mono-stat text-xs">
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
              className="font-mono-stat h-8 w-11 px-0 text-[10px] uppercase"
            >
              Redo
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-mono-stat text-xs">
            Redo · <span className="text-muted-foreground">⌘⇧Z</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClearAll}
              className="mt-1 flex h-9 w-11 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Clear all"
            >
              <Trash2 className="h-[16px] w-[16px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-mono-stat text-xs">
            Clear all
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
