# Silicon Wafer Defect Analysis

Interactive silicon wafer map editor with in-browser defect pattern classification.

**Authors:** Shanthanu Gopikrishnan · Purav Parab · Sam Jafari · Hossein Khoshnevis

## Features

- Interactive wafer map editor with brush, line, rectangle, circle, and fill tools
- Draw and erase modes with undo / redo support
- Adjustable noise layer for simulating random defects
- In-browser CNN inference via ONNX Runtime Web — no server required
- Class probabilities and yield metrics in the stats panel
- Dark mode with persisted preference
- PNG export

## Tech Stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · ONNX Runtime Web · Vitest

## Local Setup

```bash
bun install
bun dev
```

Open http://localhost:8080.

## Project Structure

```
waferanalyzer/
├── public/models/
│   └── cnn_wafer.onnx          # In-browser ONNX model
└── src/
    ├── components/
    │   ├── WaferCanvas.tsx      # Canvas rendering and pointer events
    │   ├── Toolbar.tsx          # Drawing tools and controls
    │   ├── StatsPanel.tsx       # Defect stats, model output, export
    │   └── ModelSettings.tsx    # ML backend configuration
    ├── lib/
    │   ├── wafer.ts             # Data model, painting primitives, detection
    │   ├── onnxClient.ts        # CNN inference
    │   └── mlClient.ts          # Backend selector
    └── pages/
        └── Index.tsx            # App state and orchestration
```
