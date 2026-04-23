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

## Project Structure
waferanalyzer/
├── public/
├── src/
├── onnxClient.ts
├── package.json
├── vite.config.ts
└── README.md
