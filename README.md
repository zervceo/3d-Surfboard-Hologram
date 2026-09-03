# 3D Surfboard Hologram

A single-page, fully rotatable "hologram" surfboard configurator. The board
is procedural geometry built live from `THREE.Shape`/triangulated outlines —
not a fixed GLTF model — so every shape, dimension, rail, fin, and color
control regenerates or recolors the mesh in real time. A custom
`ShaderMaterial` (fresnel rim glow, view-angle iridescence, animated scan
lines) plus `UnrealBloomPass` post-processing gives it a translucent,
glowing, sci-fi showroom look.

Plain HTML/CSS/JS, no build step, no backend, no API keys. Three.js is
vendored locally under `vendor/three/` (pinned to r160) so the whole thing
works as pure static files with no CDN dependency.

## Running locally

Browsers block ES module imports from `file://` URLs, so serve the folder
over HTTP instead of double-clicking `index.html`:

```bash
npx serve .
# or: python3 -m http.server 8080
```

Then open the printed local URL (e.g. `http://localhost:8080`).

## What you can customize

- **Shape presets** — shortboard, fish, funboard, longboard, gun, hybrid
  (each sets sensible defaults for every slider below, which stay editable).
- **Dimensions** — length, max width, nose width, tail width, thickness,
  nose rocker, tail rocker.
- **Shape details** — nose shape (pointed/rounded/blunt), tail shape
  (squash/round/pin/swallow/fish), rail profile (soft/hard).
- **Fins** — single, thruster, quad, twin, rendered as real fin meshes
  positioned at the tail.
- **Colors** — deck, bottom, rail, stringer, pinline, fins, and the
  hologram's iridescent tint, independently, plus one-click colorways
  (Miami Vice, Deep Space, Coral Reef, Chrome).
- **Randomize** / **Reset** buttons, and a live spec summary line.

Drag to rotate, scroll/pinch to zoom (touch gestures work too). The board
auto-rotates when idle and pauses while you interact.

## Deploying to GitHub Pages

This repo is meant to be served as-is — no build step.

1. Go to **Settings → Pages** on this repository.
2. Under **Build and deployment**, set **Source** to "Deploy from a branch".
3. Choose the **`main`** branch and the **`/ (root)`** folder, then **Save**.
4. GitHub Pages will publish the site at
   `https://<your-org-or-user>.github.io/3d-surfboard-hologram/` within a
   minute or two.

Because Three.js is vendored locally under `vendor/three/` and pinned to a
specific version, there's nothing to break on a future library release —
the deployed page is fully self-contained static files.

## File structure

```
index.html              Page shell, control panel markup, import map
style.css               Dark, premium UI theme + responsive layout
main.js                 Scene setup, render loop, UI wiring
js/
  geometry.js            Procedural outline + deck/bottom/rail construction, rocker
  fins.js                Fin shape + per-setup placement
  hologramMaterial.js    Custom fresnel/iridescence/scanline ShaderMaterial
  presets.js             Shape presets, colorways, default state
vendor/three/            Pinned Three.js r160 (core + OrbitControls, postprocessing)
```
