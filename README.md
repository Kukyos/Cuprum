# *Cuprum*

E-waste to copper, in the browser. Hold a gadget up to the camera: an on-device image model
(MobileCLIP-S2 on GPU, MobileCLIP-S0 on the CPU fallback) identifies it, ignoring your face and hands; the page estimates the metals inside from published compositions,
and a bioleaching simulator shows microbes dissolving the copper. Built for an Environmental
Biotechnology project; every output is an educational estimate.

## Collection portal

`/pickup.html` is the pickup booking page, written in plain HTML, CSS and JavaScript
(`public/pickup.html`, `pickup.css`, `pickup.js`). It covers:

- A form with native validation: required fields, a phone pattern, an email type, and a date picker limited to tomorrow through 30 days out.
- "Use my current location": the Geolocation API gets the coordinates, OpenStreetMap's Nominatim turns them into an address, and an OSM map is embedded.
- Requests are saved in `localStorage` with an ID and a status, listed under "My requests", and can be cancelled.
- `pickup.html?item=battery` pre-ticks an item. The scanner's "Schedule a pickup" button uses this.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # https on your network, so a phone can use its camera
npm run build      # static site in dist/ (deploy anywhere, e.g. Vercel)
npm run check      # model self-checks (the proposal's 90 g example, literature anchoring)
```

The camera needs `https` or `localhost`. Uploads and the sample photos work anywhere.

## Before a live demo

- Open the site once on the demo machine. The model (≈ 72 MB with a GPU, 45 MB without) downloads on first visit and is cached after that.
- No WebGPU (older browser)? It falls back to the smaller CPU model automatically (~200 ms per frame, a few points less accurate).
- Hold items 20–40 cm from the camera, filling most of the frame. A plain background helps.

## Where things live

| Path | What |
| --- | --- |
| `src/ai/labels.json` | The 32 categories and the sentences that describe them |
| `scripts/embed.mjs` | Encodes those sentences, scores models on clean, webcam-degraded and held-up test sets, writes `src/ai/embeds.json` (`--write --slot=gpu` or `--slot=cpu`) |
| `src/data/science.ts` | Every number shown on the page, each with its source |
| `src/sim/model.ts` | The bioleaching model (`model.check.ts` tests it) |
| `src/three/` | The 3D board, powder and reactor |

Debug switches: `?cpu` forces the CPU path, `?noai` skips the model, `?no3d` skips the 3D scene.
