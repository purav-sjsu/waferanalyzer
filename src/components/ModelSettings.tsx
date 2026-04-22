import { useState } from "react";
import { Settings2, Server } from "lucide-react";
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
import { getEndpoint, setEndpoint, getApiKey, setApiKey } from "@/lib/mlClient";
import { toast } from "@/hooks/use-toast";

interface Props {
  onChange?: () => void;
}

export function ModelSettings({ onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpointState] = useState(getEndpoint());
  const [apiKey, setApiKeyState] = useState(getApiKey());

  const save = () => {
    setEndpoint(endpoint.trim());
    setApiKey(apiKey.trim());
    onChange?.();
    setOpen(false);
    toast({
      title: endpoint ? "Model endpoint saved" : "Endpoint cleared",
      description: endpoint
        ? "Analyze defects will call your model server."
        : "Falling back to the built-in heuristic detector.",
    });
  };

  const hasEndpoint = !!getEndpoint();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          title="Configure ML model endpoint"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Model
          <span
            className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${
              hasEndpoint ? "bg-emerald-500" : "bg-muted-foreground/40"
            }`}
            aria-label={hasEndpoint ? "remote model" : "local fallback"}
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" /> ML Model Endpoint
          </DialogTitle>
          <DialogDescription>
            Connect the demo to your notebook model wrapped as an HTTP service
            (e.g. FastAPI / Flask). Leave blank to use the built-in heuristic
            detector.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
              POST {"{ grid_size, width, height, map: number[] }"} → JSON with{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                clusters
              </code>{" "}
              array.
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

          <details className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Expected response shape
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">{`{
  "clusters": [
    { "x": 12, "y": 30, "w": 4, "h": 8,
      "size": 22, "confidence": 0.91,
      "kind": "scratch" }
  ],
  "model_confidence": 0.88,
  "inference_ms": 142
}`}</pre>
          </details>
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
