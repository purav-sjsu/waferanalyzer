import { Activity, Cpu, Download, Eye, EyeOff, Grid3x3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { DetectionResult } from "@/lib/wafer";

interface Props {
  detection: DetectionResult | null;
  isDetecting: boolean;
  showOverlay: boolean;
  showGrid: boolean;
  onToggleOverlay: (v: boolean) => void;
  onToggleGrid: (v: boolean) => void;
  onExport: () => void;
  defectiveTilesLive: number;
  totalActive: number;
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "cyan" | "magenta" | "default";
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-3">
      <div className="font-mono-stat text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono-stat mt-1 text-xl tabular-nums",
          accent === "cyan" && "text-primary",
          accent === "magenta" && "text-accent",
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="font-mono-stat mt-0.5 text-[10px] text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}

export function StatsPanel({
  detection,
  isDetecting,
  showOverlay,
  showGrid,
  onToggleOverlay,
  onToggleGrid,
  onExport,
  defectiveTilesLive,
  totalActive,
}: Props) {
  const liveDefectPct = (defectiveTilesLive / totalActive) * 100;
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col gap-3 border-l border-border bg-card/40 p-4">
      <div>
        <div className="font-mono-stat mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Activity className="h-3 w-3" />
          Live wafer
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Defect tiles"
            value={defectiveTilesLive.toLocaleString()}
            sub={`of ${totalActive.toLocaleString()} active`}
          />
          <Stat
            label="Defect %"
            value={`${liveDefectPct.toFixed(2)}%`}
            sub={liveDefectPct > 5 ? "above threshold" : "within bounds"}
            accent={liveDefectPct > 5 ? "magenta" : "default"}
          />
        </div>
      </div>

      <div className="border-t border-border/60 pt-3">
        <div className="font-mono-stat mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Cpu className="h-3 w-3" />
          ML detection
        </div>

        {!detection && !isDetecting && (
          <div className="font-mono-stat rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-[11px] text-muted-foreground">
            Paint a defect pattern, then run analysis to view the model output.
          </div>
        )}

        {isDetecting && (
          <div className="font-mono-stat flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-4 text-[11px] text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running inference…
          </div>
        )}

        {detection && !isDetecting && (
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Clusters"
              value={String(detection.clusters.length)}
              accent="cyan"
            />
            <Stat
              label="Confidence"
              value={`${(detection.modelConfidence * 100).toFixed(1)}%`}
              accent="cyan"
            />
            <Stat
              label="Yield est."
              value={`${detection.yieldPct.toFixed(1)}%`}
              accent={detection.yieldPct < 70 ? "magenta" : "default"}
            />
            <Stat
              label="Inference"
              value={`${detection.inferenceMs.toFixed(0)} ms`}
              sub="mock model"
            />
          </div>
        )}

        {detection && detection.clusters.length > 0 && (
          <div className="mt-3 max-h-[180px] overflow-auto rounded-md border border-border/60">
            <table className="font-mono-stat w-full text-[10px]">
              <thead className="sticky top-0 bg-card/80 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left font-normal uppercase tracking-widest">#</th>
                  <th className="px-2 py-1 text-left font-normal uppercase tracking-widest">Type</th>
                  <th className="px-2 py-1 text-right font-normal uppercase tracking-widest">Size</th>
                  <th className="px-2 py-1 text-right font-normal uppercase tracking-widest">Conf</th>
                </tr>
              </thead>
              <tbody>
                {detection.clusters.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-border/40"
                  >
                    <td className="px-2 py-1 text-muted-foreground">
                      {String(c.id).padStart(2, "0")}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-1",
                        c.color === "cyan" ? "text-primary" : "text-accent",
                      )}
                    >
                      {c.kind}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{c.size}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {(c.confidence * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-auto space-y-3 border-t border-border/60 pt-3">
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-2">
            <span className="font-mono-stat flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Grid3x3 className="h-3 w-3" /> Show grid
            </span>
            <Switch checked={showGrid} onCheckedChange={onToggleGrid} />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="font-mono-stat flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              {showOverlay ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Detection overlay
            </span>
            <Switch
              checked={showOverlay}
              onCheckedChange={onToggleOverlay}
              disabled={!detection}
            />
          </label>
        </div>

        <Button
          onClick={onExport}
          variant="outline"
          className="w-full justify-center gap-2 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Download className="h-4 w-4" /> Export PNG
        </Button>
      </div>
    </aside>
  );
}
