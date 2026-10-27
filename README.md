# *Cuprum*

E-waste to copper, in the browser. Hold a gadget up to the camera: an on-device image model
(MobileCLIP-S0) identifies it, the page estimates the metals inside from published compositions,
and a bioleaching simulator shows microbes dissolving the copper. Built for an Environmental
Biotechnology project; every output is an educational estimate.

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

- Open the site once on the demo machine. The ~23 MB model downloads on first visit and is cached after that.
- No WebGPU (older browser)? It falls back to the CPU automatically: slower (~200 ms per frame) but the same results.
- Hold items 20–40 cm from the camera, filling most of the frame. A plain background helps.

## Where things live

| Path | What |
| --- | --- |
| `src/ai/labels.json` | The 32 categories and the sentences that describe them |
| `scripts/embed.mjs` | Encodes those sentences, scores candidate models on `eval/images`, writes `src/ai/embeds.json` |
| `src/data/science.ts` | Every number shown on the page, each with its source |
| `src/sim/model.ts` | The bioleaching model (`model.check.ts` tests it) |
| `src/three/` | The 3D board, powder and reactor |

Debug switches: `?cpu` forces the CPU path, `?noai` skips the model, `?no3d` skips the 3D scene.
