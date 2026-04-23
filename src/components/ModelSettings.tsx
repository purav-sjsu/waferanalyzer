import { useState } from "react";
import { Settings2, Server, Cpu, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  getEndpoint,
  setEndpoint,
  getApiKey,
  setApiKey,
  getBackend,
  setBackend,
  type MlBackend,
} from "@/lib/mlClient";
import { toast } from "@/hooks/use-toast";

interface Props {
  onChange?: () => void;
}

export function ModelSettings({ onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [backend, setBackendState] = useState<MlBackend>(getBackend());
  const [endpoint, setEndpointState] = useState(getEndpoint());
  const [apiKey, setApiKeyState] = useState(getApiKey());

  const save = () => {
    setBackend(backend);
    setEndpoint(endpoint.trim());
    setApiKey(apiKey.trim());
    onChange?.();
    setOpen(false);
    const labels: Record<MlBackend, string> = {
      onnx: "In-browser CNN (cnn_wafer.onnx)",
      remote: "Remote model endpoint",
      local: "Heuristic fallback",
    };
    toast({
      title: "Inference backend updated",
      description: labels[backend],
    });
  };

  const current = getBackend();
  const dotClass =
    current === "onnx"
      ? "bg-primary"
      : current === "remote" && getEndpoint()
      ? "bg-emerald-500"
      : "bg-muted-foreground/40";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          title="Configure ML inference backend"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Model
          <span
            className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${dotClass}`}
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" /> Inference backend
          </DialogTitle>
          <DialogDescription>
            Choose how "Analyze defects" runs the model. The bundled CNN runs
            entirely in your browser — no server required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={backend}
            onValueChange={(v) => setBackendState(v as MlBackend)}
            className="space-y-2"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40">
              <RadioGroupItem value="onnx" id="b-onnx" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  In-browser CNN (recommended)
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Runs <code className="rounded bg-muted px-1">cnn_wafer.onnx</code>{" "}
                  via onnxruntime-web. 9-class WM-811K classifier.
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40">
              <RadioGroupItem value="remote" id="b-remote" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Server className="h-3.5 w-3.5" />
                  Remote HTTP endpoint
                </div>
                <p className="text-[11px] text-muted-foreground">
                  POST the wafer map to your notebook wrapped as a service
                  (FastAPI / Flask).
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40">
              <RadioGroupItem value="local" id="b-local" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <HardDrive className="h-3.5 w-3.5" />
                  Heuristic fallback
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Connected-components labeling with rule-based classification.
                </p>
              </div>
            </label>
          </RadioGroup>

          {backend === "remote" && (
            <div className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="endpoint" className="text-xs">
                  Endpoint URL
                </Label>
                <Input
                  id="endpoint"
                  placeholder="https://your-model-host/predict"
                  value={endpoint}
                  onChange={(e) => setEndpointState(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  POST {"{ grid_size, width, height, map: number[] }"} → JSON
                  with <code className="rounded bg-muted px-1">clusters</code>.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="apiKey" className="text-xs">
                  API key (optional)
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Sent as Authorization: Bearer …"
                  value={apiKey}
                  onChange={(e) => setApiKeyState(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
