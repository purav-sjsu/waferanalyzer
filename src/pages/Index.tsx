import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Moon, Play, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/Toolbar";
import { WaferCanvas } from "@/components/WaferCanvas";
import { StatsPanel } from "@/components/StatsPanel";
import { AboutDialog } from "@/components/AboutDialog";
import { toast } from "@/hooks/use-toast";
import {
  GRID_SIZE,
  isInside,
  countDefects,
  createEmptyMap,
  generateNoiseSeed,
  downloadDataUrl,
  exportToPng,
  type DetectionResult,
  type WaferMap,
} from "@/lib/wafer";
import { type DrawTool } from "@/components/WaferCanvas";
import { runDetection, type MlSource } from "@/lib/mlClient";
import { preloadModel } from "@/lib/onnxClient";

const HISTORY_LIMIT = 50;

function createSeedMap(): WaferMap {
  const m = new Uint8Array(GRID_SIZE * GRID_SIZE);
  for (let y = 0; y < GRID_SIZE; y++)
    for (let x = 0; x < GRID_SIZE; x++)
      if (isInside(x, y) && Math.random() < 0.03) m[y * GRID_SIZE + x] = 1;
  return m;
}

const Index = () => {
  // userMap = what the user has painted (no noise). map = userMap merged with noise layer.
  const initialMap = createSeedMap();
  const userMapRef = useRef<WaferMap>(initialMap);
  const [map, setMap] = useState<WaferMap>(initialMap);
  const [noiseAmount, setNoiseAmount] = useState(0); // 0–50 integer percent
  const noiseSeed = useRef<number[]>(generateNoiseSeed());

  const [drawTool, setDrawTool] = useState<DrawTool>("brush");
  const [isErase, setIsErase] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const showGrid = true;
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detectionSource, setDetectionSource] = useState<MlSource | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [outputSize, setOutputSize] = useState(64);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("wafer.theme");
    return saved !== null ? saved === "dark" : document.documentElement.classList.contains("dark");
  });

  const undoStack = useRef<WaferMap[]>([]);
  const redoStack = useRef<WaferMap[]>([]);

  const applyNoise = useCallback((base: WaferMap, pct: number): WaferMap => {
    if (pct === 0) return base;
    const merged = new Uint8Array(base);
    const count = Math.floor(noiseSeed.current.length * pct / 100);
    for (let i = 0; i < count; i++) merged[noiseSeed.current[i]] = 1;
    return merged;
  }, []);

  // Display-space metrics keyed to isInside — the same gate paintTile uses —
  // so activeDies counts only tiles that can actually be painted, making 100% reachable.
  const activeDies = useMemo(() => {
    let n = 0;
    for (let dy = 0; dy < outputSize; dy++)
      for (let dx = 0; dx < outputSize; dx++) {
        const srcX = Math.floor(dx / outputSize * GRID_SIZE);
        const srcY = Math.floor(dy / outputSize * GRID_SIZE);
        if (isInside(srcX, srcY)) n++;
      }
    return n;
  }, [outputSize]);

  const defectiveDies = useMemo(() => {
    let n = 0;
    for (let dy = 0; dy < outputSize; dy++)
      for (let dx = 0; dx < outputSize; dx++) {
        const srcX = Math.floor(dx / outputSize * GRID_SIZE);
        const srcY = Math.floor(dy / outputSize * GRID_SIZE);
        if (!isInside(srcX, srcY)) continue;
        if (map[srcY * GRID_SIZE + srcX]) n++;
      }
    return n;
  }, [map, outputSize]);

  const commit = useCallback((next: WaferMap) => {
    undoStack.current.push(userMapRef.current);
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    userMapRef.current = next;
    setMap(applyNoise(next, noiseAmount));
    setDetection(null);
    setDetectionSource(null);
  }, [noiseAmount, applyNoise]);

  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(userMapRef.current);
    userMapRef.current = prev;
    setMap(applyNoise(prev, noiseAmount));
    setDetection(null);
    setDetectionSource(null);
  }, [noiseAmount, applyNoise]);

  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(userMapRef.current);
    userMapRef.current = next;
    setMap(applyNoise(next, noiseAmount));
    setDetection(null);
    setDetectionSource(null);
  }, [noiseAmount, applyNoise]);

  const handleClearAll = useCallback(() => {
    setNoiseAmount(0);
    userMapRef.current = createEmptyMap();
    setMap(createEmptyMap());
    undoStack.current = [];
    redoStack.current = [];
    setDetection(null);
    setDetectionSource(null);
  }, []);

  const handleNoiseChange = useCallback((pct: number) => {
    setNoiseAmount(pct);
    setMap(applyNoise(userMapRef.current, pct));
    setDetection(null);
    setDetectionSource(null);
  }, [applyNoise]);

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


  useEffect(() => {
    if (countDefects(map) === 0) return;
    const timer = setTimeout(async () => {
      setIsDetecting(true);
      try {
        const { result, source } = await runDetection(map);
        setDetection(result);
        setDetectionSource(source);
      } catch {
        // silent — user can still trigger manually via button
      } finally {
        setIsDetecting(false);
      }
    }, 600);
    return () => clearTimeout(timer);
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
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("wafer.theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("wafer.theme", "light");
    }
  }, [isDark]);

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
      if (e.key.toLowerCase() === "e") { setIsErase((v) => !v); return; }
      const shapeMap: Record<string, DrawTool> = {
        b: "brush", l: "line", r: "rect", c: "circle", f: "fill",
      };
      const t = shapeMap[e.key.toLowerCase()];
      if (t) setDrawTool(t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-gradient-to-r from-card via-primary/5 to-accent/10 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
              <defs>
                <clipPath id="hdr-wafer-clip">
                  <circle cx="16" cy="16" r="14.5" />
                </clipPath>
              </defs>
              {/* edge ring fill */}
              <circle cx="16" cy="16" r="14.5" fill="#d97706" />
              {/* die grid clipped to wafer */}
              <g clipPath="url(#hdr-wafer-clip)">
                {Array.from({ length: 8 }, (_, row) =>
                  Array.from({ length: 8 }, (_, col) => {
                    const x = col * 4, y = row * 4;
                    const cx = x + 2, cy = y + 2;
                    const dx = cx - 16, dy = cy - 16;
                    if (dx * dx + dy * dy > 13.5 * 13.5) return null;
                    const defect = (row === 2 && col === 4) || (row === 5 && col === 2) || (row === 4 && col === 5);
                    return <rect key={`${row}-${col}`} x={x + 0.3} y={y + 0.3} width="3.4" height="3.4" fill={defect ? "#dc2626" : "#22c55e"} />;
                  })
                )}
              </g>
              {/* wafer ring */}
              <circle cx="16" cy="16" r="14.5" stroke="#5577aa" strokeWidth="1.2" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              Silicon Wafer Defect Analysis
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDark((d) => !d)}
            className="h-8 w-8 hover:bg-transparent"
            aria-label="Toggle dark mode"
          >
            {isDark
              ? <Sun className="h-4 w-4 text-yellow-400" />
              : <Moon className="h-4 w-4 text-slate-500" />}
          </Button>
          <AboutDialog />
          <Button
            size="sm"
            onClick={handleDetect}
            disabled={isDetecting}
            className="gap-2 bg-[hsl(224,70%,48%)] text-xs text-white hover:bg-[hsl(224,70%,42%)]"
          >
            {isDetecting ? (
              <Cpu className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Analyze Defects
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          drawTool={drawTool}
          isErase={isErase}
          brushSize={brushSize}
          onDrawToolChange={setDrawTool}
          onEraseChange={setIsErase}
          onBrushSize={setBrushSize}
          onClearAll={handleClearAll}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
          noiseAmount={noiseAmount}
          onNoiseChange={handleNoiseChange}
        />

        <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-6">
          <div
            className="relative flex flex-col items-center gap-4"
            style={{ width: "min(calc(100vh - 160px), 680px)" }}
          >
          <WaferCanvas
            map={map}
            paintBase={userMapRef.current}
            drawTool={drawTool}
            isErase={isErase}
            brushSize={brushSize}
            showGrid={showGrid}
            isDark={isDark}
            displaySize={outputSize}
            onCommit={commit}
          />
          <div className="flex w-full items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
            <span className="font-mono-stat shrink-0 text-sm font-medium text-muted-foreground">32×32</span>
            <input
              type="range"
              min={32}
              max={128}
              step={8}
              value={outputSize}
              onChange={(e) => setOutputSize(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-primary"
            />
            <span className="font-mono-stat shrink-0 text-sm font-medium text-muted-foreground">128×128</span>
            <span className="font-mono-stat w-24 shrink-0 rounded-md bg-[hsl(224,70%,48%)] py-1 text-center text-sm font-semibold tabular-nums text-white">
              {outputSize}×{outputSize}
            </span>
          </div>
          </div>
        </main>

        <StatsPanel
          detection={detection}
          detectionSource={detectionSource}
          isDetecting={isDetecting}
          onExport={handleExport}
          defectiveDies={defectiveDies}
          activeDies={activeDies}
          displaySize={outputSize}
          isDark={isDark}
          onReset={() => {
            setNoiseAmount(0);
            userMapRef.current = createEmptyMap();
            setMap(createEmptyMap());
            undoStack.current = [];
            redoStack.current = [];
            setDetection(null);
            setDetectionSource(null);
          }}
        />
      </div>
    </div>
  );
};

export default Index;
