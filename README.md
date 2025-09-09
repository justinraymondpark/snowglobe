# Snowglobe Layering App

A static web app you can deploy on Netlify to layer a video under a transparent PNG on a fixed 1880x980 stage.

## Usage

- Upload a video or PNG (session-only) or pick from dropdowns populated by manifests.
- Or, use the dropdowns populated from `/public/video/_manifest.json` and `/public/png/_manifest.json`.
- Drag layers, select from the Layers panel, center H/V, and scale.
 

## Local Development

Serve the folder with any static server and open `http://localhost:PORT/index.html`.
The stage auto-scales to fit your window; exports are still 1880x980.

## Deploy on Netlify

- No build command
- Publish directory: `.`

Static assets under `public/png` and `public/video` are accessible via `/public/*`.

### Asset manifests

Regenerate manifests after adding/removing assets:

```bash
python3 scripts/generate_manifests.py
```
Or click the Reload Manifests button in the UI after you add files to `public/`.

 

### Export

- Use the Export panel:
  - Format auto-detected by your browser (MP4 if supported; otherwise WebM)
  - Defaults: 60 FPS, 10 seconds
- Click Start Export to render and download a file of the stage (1880x980). A progress bar and frame counter show status.

### Aspect cropping

- Choose an aspect ratio in Export to show a centered crop overlay on the stage (16:9, 1:1, 4:5, 5:4, 4:3, 3:4, 9:16).
- When exporting, the output canvas will match the selected aspect and will crop from the center accordingly.

### Layers panel improvements

- Drag and drop to reorder layers; click the trash icon to delete a layer.
