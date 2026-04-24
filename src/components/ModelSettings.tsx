import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ModelSettings({ onChange: _onChange }: { onChange?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:border-primary/60 dark:hover:bg-primary/20 dark:hover:text-primary" title="Model information">
          CNN
          <SlidersHorizontal className="h-3 w-3" />
        </Button>
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
  );
}
