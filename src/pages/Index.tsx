import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Download, Microscope, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/Toolbar";
import { WaferCanvas } from "@/components/WaferCanvas";
import { StatsPanel } from "@/components/StatsPanel";
import { ModelSettings } from "@/components/ModelSettings";
import { toast } from "@/hooks/use-toast";
import {
  activeTileCount,
  countDefects,
  createEmptyMap,
  downloadDataUrl,
  exportToPng,
  type DetectionResult,
  type Tool,
  type WaferMap,
} from "@/lib/wafer";
import { runDetection, type MlSource } from "@/lib/mlClient";
import { preloadModel } from "@/lib/onnxClient";

const HISTORY_LIMIT = 50;

const Index = () => {
  const [map, setMap] = useState<WaferMap>(() => createEmptyMap());
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(3);
  const [showGrid, setShowGrid] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detectionSource, setDetectionSource] = useState<MlSource | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  // bump to re-render when model settings change
  const [, setSettingsTick] = useState(0);

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
    setDetectionSource(null);
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setMap((current) => {
      redoStack.current.push(current);
      return prev;
    });
    setDetection(null);
    setDetectionSource(null);
  }, []);

  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    setMap((current) => {
      undoStack.current.push(current);
      return next;
    });
    setDetection(null);
    setDetectionSource(null);
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
    try {
      const { result, source } = await runDetection(map);
      setDetection(result);
      setDetectionSource(source);
      setShowOverlay(true);
      const sourceLabel =
        source === "onnx"
          ? "CNN (in-browser)"
          : source === "remote"
          ? "Remote model"
          : "Heuristic";
      const desc = result.predictedClass
        ? `${sourceLabel}: ${result.predictedClass} · ${(result.modelConfidence * 100).toFixed(1)}% conf`
        : `${result.clusters.length} cluster${
            result.clusters.length === 1 ? "" : "s"
          } · ${result.defectPct.toFixed(2)}% defective`;
      toast({ title: "Analysis complete", description: desc });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Detection failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDetecting(false);
    }
  }, [map]);

  const handleExport = useCallback(() => {
    const url = exportToPng(map);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadDataUrl(url, `wafer-map-${stamp}.png`);
  }, [map]);

  useEffect(() => {
    // Warm up the ONNX session in the background.
    preloadModel();
  }, []);

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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Microscope className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              Silicon Wafer Defect Detector
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Course project · interactive ML inference demo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ModelSettings onChange={() => setSettingsTick((t) => t + 1)} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => commit(createEmptyMap())}
            className="gap-2 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Export PNG
          </Button>
          <Button
            size="sm"
            onClick={handleDetect}
            disabled={isDetecting}
            className="gap-2 text-xs"
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

        <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse at center, black 40%, transparent 75%)",
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
          detectionSource={detectionSource}
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
