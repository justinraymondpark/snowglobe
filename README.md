# Snowglobe Layering App

A static web app you can deploy on Netlify to layer a video under a transparent PNG on a fixed 1880x980 stage.

## Usage

- Add a video via file picker or by URL (e.g. `/public/video/your.mp4`).
- Add a transparent PNG via file picker or by URL (e.g. `/public/png/overlay.png`).
- Drag layers, select from the Layers panel, center H/V, and scale.
- Toggle video controls globally or for the selected video.

## Local Development

Serve the folder with any static server and open `http://localhost:PORT/index.html`.

## Deploy on Netlify

- No build command
- Publish directory: `.`

Static assets under `public/png` and `public/video` are accessible via `/public/*`.
