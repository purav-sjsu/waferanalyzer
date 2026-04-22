import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Download, Microscope, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/Toolbar";
import { WaferCanvas } from "@/components/WaferCanvas";
import { StatsPanel } from "@/components/StatsPanel";
import { toast } from "@/hooks/use-toast";
import {
  activeTileCount,
  countDefects,
  createEmptyMap,
  detectClusters,
  downloadDataUrl,
  exportToPng,
  type DetectionResult,
  type Tool,
  type WaferMap,
} from "@/lib/wafer";

const HISTORY_LIMIT = 50;

const Index = () => {
  const [map, setMap] = useState<WaferMap>(() => createEmptyMap());
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(3);
  const [showGrid, setShowGrid] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const undoStack = useRef<WaferMap[]>([]);
  const redoStack = useRef<WaferMap[]>([]);

  const totalActive = useMemo(() => activeTileCount(), []);
  const defectiveLive = useMemo(() => countDefects(map), [map]);

  const commit = useCallback((next: WaferMap) => {
    setMap((prev) => {
      undoStack.current.push(prev);
      if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
      redoStack.current = [];
      return next;
    });
    setDetection(null);
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setMap((current) => {
      redoStack.current.push(current);
      return prev;
    });
    setDetection(null);
  }, []);

  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    setMap((current) => {
      undoStack.current.push(current);
      return next;
    });
    setDetection(null);
  }, []);

  const handleClearAll = useCallback(() => {
    if (countDefects(map) === 0) return;
    if (!confirm("Clear the entire wafer map?")) return;
    commit(createEmptyMap());
  }, [map, commit]);

  const handleDetect = useCallback(async () => {
    if (countDefects(map) === 0) {
      toast({
        title: "Empty wafer",
        description: "Paint some defects before running analysis.",
      });
      return;
    }
    setIsDetecting(true);
    // Mock latency — keeps the lab feel + extension point for a real endpoint.
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    const result = detectClusters(map);
    setDetection(result);
    setShowOverlay(true);
    setIsDetecting(false);
    toast({
      title: "Analysis complete",
      description: `${result.clusters.length} cluster${
        result.clusters.length === 1 ? "" : "s"
      } · ${result.defectPct.toFixed(2)}% defective`,
    });
  }, [map]);

  const handleExport = useCallback(() => {
    const url = exportToPng(map);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadDataUrl(url, `wafer-map-${stamp}.png`);
  }, [map]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }
      const map: Record<string, Tool> = {
        p: "pencil",
        e: "eraser",
        b: "brush",
        l: "line",
        r: "rect",
        c: "circle",
        f: "fill",
      };
      const t = map[e.key.toLowerCase()];
      if (t) {
        setTool(t);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/50 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Microscope className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-mono-stat text-sm uppercase tracking-[0.18em] text-foreground">
              Wafer Defect Studio
            </h1>
            <p className="font-mono-stat text-[10px] uppercase tracking-widest text-muted-foreground">
              ML inspection · demo build
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => commit(createEmptyMap())}
            className="font-mono-stat gap-2 text-xs uppercase tracking-widest text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="font-mono-stat gap-2 text-xs uppercase tracking-widest"
          >
            <Download className="h-3.5 w-3.5" /> Export PNG
          </Button>
          <Button
            size="sm"
            onClick={handleDetect}
            disabled={isDetecting}
            className="font-mono-stat gap-2 text-xs uppercase tracking-widest"
          >
            {isDetecting ? (
              <Cpu className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Analyze defects
          </Button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          tool={tool}
          brushSize={brushSize}
          onToolChange={setTool}
          onBrushSize={setBrushSize}
          onClearAll={handleClearAll}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
        />

        <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,hsl(220_22%_10%),hsl(220_25%_6%))] p-6">
          {/* Grid background lines */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(186 95% 55%) 1px, transparent 1px), linear-gradient(90deg, hsl(186 95% 55%) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <WaferCanvas
            map={map}
            tool={tool}
            brushSize={brushSize}
            showGrid={showGrid}
            detection={detection}
            showOverlay={showOverlay}
            onCommit={commit}
          />
        </main>

        <StatsPanel
          detection={detection}
          isDetecting={isDetecting}
          showOverlay={showOverlay}
          showGrid={showGrid}
          onToggleOverlay={setShowOverlay}
          onToggleGrid={setShowGrid}
          onExport={handleExport}
          defectiveTilesLive={defectiveLive}
          totalActive={totalActive}
        />
      </div>
    </div>
  );
};

export default Index;
