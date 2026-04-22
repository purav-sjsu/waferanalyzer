# Silicon Wafer Defect Labeling Demo

A focused, single-page demo where users hand-paint defect patterns on a circular wafer map, run a mock ML detection, and export the result as a PNG.

## Layout

- **Left toolbar (vertical):** tool selection + parameters
- **Center canvas:** large circular 200×200 wafer map on a dark workspace background
- **Right panel:** wafer stats, mock detection results, export controls
- **Top bar:** project title, "Run Detection" primary action, "Export PNG" button

## Wafer Canvas

- 64x64 logical grid clipped to a circular wafer shape (tiles outside the circle are inert/masked)
- Tiles render black (clear) by default; painted tiles are white (defect)
- Subtle grid lines visible while editing for precision; toggle in view options
- Crisp pixel rendering (no smoothing), zoom & pan with mouse wheel + drag
- Crosshair cursor showing brush footprint preview before clicking
- HTML5 Canvas implementation for performance at 40k tiles

## Brushing Tools

1. **Pencil** — paint single tile (white)
2. **Eraser** — restore tile to black
3. **Brush** — round brush with sizes 1 / 3 / 5 / 9 px
4. **Line** — click-drag straight line of defects
5. **Rectangle** — drag to fill rectangular defect cluster
6. **Circle** — drag to fill circular defect cluster
7. **Fill bucket** — flood-fill connected region inside the wafer
8. **Clear all** — reset wafer to fully clean (with confirm)

Each tool has a keyboard shortcut (P, E, B, L, R, C, F) shown as tooltip hints. Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) with a reasonable history depth.

## ML Detection

- "Analayze Defects" needs to connect to our ML model which is currently an ipynb notebook. This needs to be connected tot he website to run the demo.
- Mock output overlays colored bounding boxes / heatmap regions on the wafer:
  - Detected defect clusters highlighted in cyan/magenta
  - Confidence scores shown per cluster
- Right panel shows: total defective tiles, defect %, cluster count, mock model confidence, simulated inference time
- Toggle to show/hide overlay without losing the painted map

## Export

- "Export PNG" downloads the wafer map as a PNG file
- Output: clean wafer (black background, white defects) **with subtle grid lines** burned in
- Square output sized to native grid (200×200 upscaled crisp to 1024×1024 for usability)
- Filename includes timestamp (e.g., `wafer-map-2026-04-22.png`)
- Detection overlay is **not** included in export (kept model-ready)

## Visual Style

- Clean technical/lab aesthetic: dark slate workspace, white wafer area, sharp monospace labels for stats, subtle accent color for active tool and detection overlays
- Responsive: toolbar collapses to icons on smaller screens; canvas scales to viewport while preserving aspect