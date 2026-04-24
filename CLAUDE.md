# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests once (Vitest)
npm run test:watch   # Vitest in watch mode
npm run preview      # Preview production build locally
```

Run a single test file:
```bash
npx vitest run src/test/example.test.ts
```

## Architecture

Single-page React app (Vite + TypeScript + Tailwind CSS + shadcn/ui). One real route: `/` → `src/pages/Index.tsx`. Path alias `@` maps to `src/`.

### Core data model — `src/lib/wafer.ts`

`WaferMap = Uint8Array` of length `GRID_SIZE * GRID_SIZE` (64×64 = 4096 entries). Values: `0` = clear, `1` = defect. The wafer is a circle — tiles outside the circular mask are inert and never painted. The mask is precomputed once at module load into `_maskCache`.

This file owns all painting primitives (`paintTile`, `paintBrush`, `paintLine`, `paintRect`, `paintCircle`, `floodFill`), the heuristic cluster detector (`detectClusters`), connected-components labeling (`labelConnectedComponents`), and PNG export (`exportToPng`).

### ML inference stack — `src/lib/mlClient.ts` + `src/lib/onnxClient.ts`

`runDetection(map)` in `mlClient.ts` selects the backend:
1. **ONNX** (default): runs `public/models/cnn_wafer.onnx` in-browser via `onnxruntime-web`. WASM runtime is fetched from jsDelivr CDN at runtime (not bundled). Session is a singleton, preloaded eagerly in `Index.tsx`.
2. **Remote**: POSTs `{ grid_size, width, height, map: number[] }` to a configurable HTTP endpoint.
3. **Local**: heuristic fallback using `detectClusters` from `wafer.ts`.

Backend choice, endpoint URL, and API key are persisted to `localStorage` under keys `wafer.mlBackend`, `wafer.mlEndpoint`, `wafer.mlApiKey`. The `ModelSettings` component in the header exposes these settings.

**Tensor encoding for ONNX**: input shape `[1, 1, 64, 64]` float32. Outside-circle tiles → `0.0`; clear die inside circle → `0.5`; defective die → `1.0`. This matches the WM-811K training normalization (original values 0/1/2 divided by 2).

The model outputs 9-class logits for WM-811K defect patterns: `none`, `Edge-Ring`, `Edge-Loc`, `Center`, `Loc`, `Scratch`, `Random`, `Donut`, `Near-full`. Class order in `WAFER_CLASSES` must match training `LABEL_MAP`.

> Note: there is a duplicate `onnxClient.ts` at the repo root. The app imports from `src/lib/onnxClient.ts` (`@/lib/onnxClient`); the root file is unused.

### Canvas rendering — `src/components/WaferCanvas.tsx`

Three stacked `<canvas>` elements sharing the same pixel dimensions (`GRID_SIZE × TILE_PX` = 704px):
1. **`canvasRef`** — wafer tiles and grid lines, redrawn on every map change.
2. **`overlayRef`** — detection cluster bounding boxes (dashed rectangles + confidence labels), redrawn when `detection` or `showOverlay` changes.
3. **`cursorRef`** — brush/tool preview and pointer event target; redrawn on hover/drag state.

Pointer events land on the top canvas (cursorRef). During a drag for line/rect/circle tools, a `draftMap` local state holds the preview; `onCommit` is only called on pointer-up.

### State and history — `src/pages/Index.tsx`

All application state lives here. Undo/redo are `useRef<WaferMap[]>` stacks (limit 50). Any `commit()` call clears the current detection result. Keyboard shortcuts are handled via a `keydown` listener: `P/E/B/L/R/C/F` select tools, `Ctrl+Z` undos, `Ctrl+Shift+Z` / `Ctrl+Y` redos.

### UI components

- `Toolbar` — left vertical strip with tool buttons and brush size selector.
- `StatsPanel` — right panel with live defect stats, post-detection metrics (yield %, inference time, class scores), grid/overlay toggles, and PNG export.
- `ModelSettings` — dialog in the header for switching inference backend.
- `src/components/ui/` — shadcn/ui primitives (do not edit these directly).
