import { Cpu, Download, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import type { DetectionResult } from "@/lib/wafer";
import type { MlSource } from "@/lib/mlClient";

interface Props {
  detection: DetectionResult | null;
  detectionSource: MlSource | null;
  isDetecting: boolean;
  onExport: () => void;
  onReset: () => void;
  defectiveDies: number;
  activeDies: number;
  displaySize: number;
  isDark: boolean;
}

function WaferIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.2">
      <defs>
        <clipPath id="wafer-icon-clip">
          <circle cx="8" cy="8" r="6.5" />
        </clipPath>
      </defs>
      <circle cx="8" cy="8" r="6.5" />
      <g clipPath="url(#wafer-icon-clip)" strokeWidth="0.75">
        <line x1="5.3"  y1="0" x2="5.3"  y2="16" />
        <line x1="8"    y1="0" x2="8"    y2="16" />
        <line x1="10.7" y1="0" x2="10.7" y2="16" />
        <line x1="0" y1="5.3"  x2="16" y2="5.3" />
        <line x1="0" y1="8"    x2="16" y2="8" />
        <line x1="0" y1="10.7" x2="16" y2="10.7" />
      </g>
    </svg>
  );
}

const SOURCE_LABEL: Record<MlSource, string> = {
  onnx: "CNN · in-browser",
  remote: "remote model",
  local: "heuristic",
};


function StatPair({
  leftLabel, leftValue, leftTone,
  rightLabel, rightValue, rightTone,
  isDark,
}: {
  leftLabel: string; leftValue: string; leftTone?: "die" | "defect";
  rightLabel: string; rightValue: string; rightTone?: "die" | "defect";
  isDark: boolean;
}) {
  const color = (tone?: string) =>
    tone === "die"    ? (isDark ? "#22c55e" : "#3a7a3a") :
    tone === "defect" ? (isDark ? "#dc2626" : "#9b1515") : undefined;
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="pr-3">
          <div className="font-mono-stat text-[9px] uppercase tracking-wider text-muted-foreground">{leftLabel}</div>
          <div className="font-mono-stat mt-1 text-xl tabular-nums text-foreground" style={{ color: color(leftTone) }}>
            {leftValue}
          </div>
        </div>
        <div className="pl-3">
          <div className="font-mono-stat text-[9px] uppercase tracking-wider text-muted-foreground">{rightLabel}</div>
          <div className="font-mono-stat mt-1 text-xl tabular-nums text-foreground" style={{ color: color(rightTone) }}>
            {rightValue}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatsPanel({
  detection,
  detectionSource,
  isDetecting,
  onExport,
  onReset,
  defectiveDies,
  activeDies,
  displaySize,
  isDark,
}: Props) {
  const [modelOpen, setModelOpen] = useState(false);
  const defectPct   = activeDies > 0 ? (defectiveDies / activeDies) * 100 : 0;
  const goodDies    = activeDies - defectiveDies;
  const goodPct     = activeDies > 0 ? (goodDies / activeDies) * 100 : 100;
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-card p-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <WaferIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Wafer</span>
          </span>
          <Button variant="ghost" size="icon" onClick={onReset} className="h-6 w-6 text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-2">
          {/* Non-defective dies */}
          <StatPair
            leftLabel="Good dies"  leftValue={goodDies.toLocaleString()}         leftTone="die"
            rightLabel="Yield %"   rightValue={`${goodPct.toFixed(1)}%`}         rightTone="die"
            isDark={isDark}
          />

          {/* Defective dies */}
          <StatPair
            leftLabel="Defective"  leftValue={defectiveDies.toLocaleString()}     leftTone={defectiveDies > 0 ? "defect" : undefined}
            rightLabel="Defect %"  rightValue={`${defectPct.toFixed(1)}%`}        rightTone={defectiveDies > 0 ? "defect" : undefined}
            isDark={isDark}
          />

          {/* Wafer grid */}
          <StatPair
            leftLabel="Grid"        leftValue={`${displaySize}×${displaySize}`}
            rightLabel="Active dies" rightValue={activeDies.toLocaleString()}
            isDark={isDark}
          />
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Model Analysis</span>
          </span>
          <Dialog open={modelOpen} onOpenChange={setModelOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-[10px] text-primary transition-colors hover:bg-primary/20">
                <SlidersHorizontal className="h-3 w-3" />
                {SOURCE_LABEL[detectionSource ?? "onnx"]}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Model
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Choose which model performs classification.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">CNN</span>
                  <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">active</span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Runs <code className="rounded bg-muted px-1">cnn_wafer.onnx</code> via onnxruntime-web
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!detection && !isDetecting && (
          <div className="font-mono-stat rounded-md border border-dashed border-border bg-muted/40 p-4 text-center text-[11px] text-muted-foreground">
            Paint a defect pattern, then run analysis to view the model output.
          </div>
        )}

        {isDetecting && (
          <div className="font-mono-stat flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-4 text-[11px] text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running inference…
          </div>
        )}

        {detection && !isDetecting && detection.predictedClass && (
          <>
            <div className="rounded-md bg-[hsl(224,70%,48%)] p-3 shadow-md">
              <div className="font-mono-stat text-[9px] uppercase tracking-wider text-white/60">
                Predicted pattern
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="font-mono-stat text-lg font-semibold text-white">
                  {detection.predictedClass}
                </span>
                <span className="font-mono-stat text-xs tabular-nums text-white/80">
                  {(detection.modelConfidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="font-mono-stat mt-2 text-[10px] text-white/60">
                {detection.inferenceMs.toFixed(0)} ms inference
              </div>
            </div>

            {detection.classScores && detection.classScores.length > 0 && (
              <div className="mt-2 rounded-md border border-border p-2">
                <div className="font-mono-stat mb-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                  Class probabilities
                </div>
                <div className="space-y-1">
                  {detection.classScores.slice(0, 9).map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="font-mono-stat w-20 shrink-0 text-[10px] text-foreground">
                        {s.label}
                      </span>
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 bg-primary"
                          style={{ width: `${s.score * 100}%` }}
                        />
                      </div>
                      <span className="font-mono-stat w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                        {(s.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <Button onClick={onExport} variant="outline" className="w-full justify-center gap-2">
          <Download className="h-4 w-4" /> Export PNG
        </Button>
      </div>
    </aside>
  );
}
