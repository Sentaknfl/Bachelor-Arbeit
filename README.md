# 3D Infinite Canvas

A personal canvas homepage where 10 image+note cards float in 3D space. Pan, zoom, and rotate freely to explore them.

## Quick start

```bash
cd "Bachelor Homepage"
python3 -m http.server 8080
# Open http://localhost:8080
```

Any static file server works (VS Code Live Server, `npx serve`, Caddy, nginx, etc.).  
**Do not** open `index.html` directly as a `file://` URL — ES module imports require HTTP.

## Controls

| Input | Action |
|---|---|
| Left drag | Rotate |
| Right drag | Pan |
| Scroll wheel | Zoom |
| Click card | Select / deselect |
| Hover card | Highlight + tooltip |
| `+` / `-` | Zoom in / out |
| Arrow keys | Pan |
| `Home` | Reset camera |
| Billboard button | Toggle cards facing camera |

On touch: 1 finger rotates, 2 fingers pan + pinch-zoom, tap selects.

## Adding or changing cards

Edit `js/data.js` — it is the only file that needs to change.

Each entry in `CARD_DATA` has this shape:

```js
{
  id: 10,                                          // unique integer
  title: 'My New Card',
  note: 'A short note about this image.',
  imageUrl: 'https://picsum.photos/seed/mykey/512/384',
  fallbackUrl: '/assets/placeholders/fallback.svg',
  accentColor: '#ff6e6e',                          // colour for glow + note border
}
```

Positions are computed automatically from the `CARD_DATA` array length — no manual placement needed. The seeded PRNG (seed 42) keeps positions stable across reloads.

## Design decisions

| Topic | Choice | Why |
|---|---|---|
| Note rendering | CanvasTexture | Keeps all geometry in WebGL; avoids CSS3DRenderer depth-sorting bugs |
| Billboard | ON by default | Cards always face the camera; togglable via the header button |
| Touch | OrbitControls built-in | 1-finger rotate + 2-finger pinch/pan out of the box; `touch-action: none` on the canvas prevents iOS scroll hijack |
| Positions | Seeded LCG PRNG | Deterministic every reload, no overlaps, Z-axis compressed for a flat-cloud layout |

## Known limitations / next steps

- **No persistence** — selection state resets on reload.
- **No card detail view** — tapping shows a tooltip, not a full modal. Easy to add as an HTML overlay.
- **Postprocessing** — no bloom/glow shader. Emissive colour provides a subtle highlight instead.
- **Offline images** — picsum.photos URLs require internet; the local `fallback.svg` appears when offline.
- **CORS** — picsum.photos allows `crossOrigin` access. If you swap in images from another host, you may need to set `texture.crossOrigin = 'anonymous'` and ensure the server sends CORS headers.
