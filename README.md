# WaferAnalyzer

WaferAnalyzer is a web-based silicon wafer defect analysis tool built with React, TypeScript, and Vite. It lets users draw wafer defect patterns on an interactive wafer map, run defect analysis, visualize defect clusters, and export the wafer map as an image.

## Features

- Interactive wafer map editor
- Multiple drawing tools:
  - Pencil
  - Brush
  - Eraser
  - Line
  - Rectangle
  - Circle
  - Fill
- Undo and redo support
- Dark mode toggle
- Defect analysis workflow
- In-browser CNN inference with ONNX Runtime Web
- Defect overlay visualization
- PNG export for wafer maps

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- ONNX Runtime Web
- Vitest

## Local Setup

```bash
bun install
bun dev
```

Open http://localhost:8080.

## Project Structure

```
waferanalyzer/
├── public/
│   └── models/
│       └── cnn_wafer.onnx       # ONNX model for in-browser inference
├── src/
│   ├── components/
│   │   ├── WaferCanvas.tsx      # Three-layer canvas (tiles, overlay, cursor)
│   │   ├── Toolbar.tsx          # Drawing tool selector
│   │   ├── StatsPanel.tsx       # Defect stats and export controls
│   │   ├── ModelSettings.tsx    # ML backend configuration dialog
│   │   └── ui/                  # shadcn/ui primitives
│   ├── lib/
│   │   ├── wafer.ts             # Core data model, painting primitives, heuristic detection
│   │   ├── onnxClient.ts        # In-browser CNN inference via ONNX Runtime Web
│   │   ├── mlClient.ts          # Backend selector (ONNX / remote / heuristic)
│   │   └── utils.ts
│   ├── pages/
│   │   └── Index.tsx            # Main page, all app state and undo/redo
│   └── hooks/
├── vite.config.ts
└── vitest.config.ts
```
