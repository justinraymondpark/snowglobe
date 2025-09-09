## 0.1.0 - 2025-09-09
- feat: initial layering app with 1880x980 stage
- feat: add video (file/URL), add PNG (file/URL)
- feat: draggable layers, center H/V by default and via buttons
- feat: scaling control (10% - 300%) with range and number input
- feat: layer order controls, layer selection list
- feat: Netlify config and public asset folders
## 0.1.1 - 2025-09-09
- feat: dropdowns populated from public manifests for quick asset selection
- chore: add manifest generator script and manifests for /public/video and /public/png
## 0.2.0 - 2025-09-09
- feat: export panel (format, fps, duration, audio toggle)
- feat: canvas compositor + MediaRecorder export (MP4 when supported, else WebM)
## 0.2.1 - 2025-09-09
- feat: fit-to-window scaling for the stage
- feat: session uploads join dropdowns; remove URL inputs
- feat: Reload Manifests button
## 0.3.0 - 2025-09-09
- feat: Netlify Functions for upload persistence and manifest regeneration
- feat: optional GitHub-backed uploads from the UI
## 0.3.1 - 2025-09-09
- fix: stabilize export with fixed-interval loop
- feat: export progress bar and status messages
- chore: default export to 10s @ 60FPS
## 0.3.2 - 2025-09-09
- fix: enforce default 60 FPS/10s on init
- feat: recorder watchdog + requestData flush; console debug logs
## 0.3.3 - 2025-09-09
- chore: remove audio option from export UI and logic
## 0.4.0 - 2025-09-09
- feat: aspect ratio selector with stage overlay; exports crop to aspect
- feat: drag-and-drop layer reordering; delete button on layers
- chore: remove persist-to-GitHub option and video controls toggle
