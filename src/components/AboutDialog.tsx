import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function WaferLogo() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
      <defs>
        <clipPath id="about-wafer-clip">
          <circle cx="16" cy="16" r="14.5" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="14.5" fill="#d97706" />
      <g clipPath="url(#about-wafer-clip)">
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
      <circle cx="16" cy="16" r="14.5" stroke="#5577aa" strokeWidth="1.2" />
    </svg>
  );
}

const PATTERNS = [
  "None", "Center", "Donut", "Edge-Loc", "Edge-Ring",
  "Loc", "Near-full", "Random", "Scratch",
];

export function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          About
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <WaferLogo />
            Silicon Wafer Defect Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-[15px] text-muted-foreground">
          <p>
            An interactive silicon wafer map editor and defect pattern classifier. This project was built for{" "}
            <span className="font-medium text-foreground">CMPE 257: Machine Learning</span> at San José State University.
          </p>

          <p>
            A CNN model was trained to classify wafer maps into 9 failure classes: {PATTERNS.join(", ")}.
          </p>

          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wider text-muted-foreground/60">Dataset</p>
            <a
              href="https://www.kaggle.com/datasets/qingyi/wm811k-wafer-map"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              WM-811K Wafer Map — Kaggle
            </a>
          </div>

          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wider text-muted-foreground/60">Built by</p>
            <div className="space-y-0.5 text-[14px] text-foreground">
              <p>Shanthanu Gopikrishnan</p>
              <p>Purav Parab</p>
              <p>Sam Jafari</p>
              <p>Hossein Khoshnevis</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
