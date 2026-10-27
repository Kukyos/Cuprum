// Procedural circuit board: one deterministic layout shared by the textures (pads, traces,
// silkscreen) and the 3D components that sit on them, so everything lines up.
import * as THREE from 'three';

export const BW = 3.2; // board width (x)
export const BD = 2.2; // board depth (z)
const TW = 2048, TH = 1408; // texture size, same aspect as the board

export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Part =
  | { kind: 'soc' | 'qfp' | 'soic' | 'mem' | 'shield' | 'crystal' | 'header' | 'inductor'; x: number; z: number; w: number; d: number; ref: string }
  | { kind: 'cap'; x: number; z: number; r: number; ref: string }
  | { kind: 'smd'; x: number; z: number; w: number; d: number; rot: number; tone: 'mlcc' | 'res'; ref: string };

const R = rng(29); // Cu is element 29

const big: Part[] = [
  { kind: 'soc', x: -0.45, z: -0.12, w: 0.72, d: 0.72, ref: 'U1' },
  { kind: 'qfp', x: 0.62, z: -0.38, w: 0.42, d: 0.42, ref: 'U2' },
  { kind: 'qfp', x: 0.6, z: 0.36, w: 0.28, d: 0.28, ref: 'U3' },
  { kind: 'mem', x: -1.22, z: 0.62, w: 0.3, d: 0.2, ref: 'U4' },
  { kind: 'mem', x: -0.84, z: 0.62, w: 0.3, d: 0.2, ref: 'U5' },
  { kind: 'mem', x: -0.46, z: 0.62, w: 0.3, d: 0.2, ref: 'U6' },
  { kind: 'mem', x: -0.08, z: 0.62, w: 0.3, d: 0.2, ref: 'U7' },
  { kind: 'soic', x: 1.22, z: -0.62, w: 0.26, d: 0.15, ref: 'U8' },
  { kind: 'soic', x: 1.22, z: -0.3, w: 0.26, d: 0.15, ref: 'U9' },
  { kind: 'soic', x: -1.3, z: -0.78, w: 0.22, d: 0.13, ref: 'U10' },
  { kind: 'shield', x: 1.12, z: 0.42, w: 0.46, d: 0.42, ref: 'SH1' },
  { kind: 'crystal', x: 0.12, z: 0.14, w: 0.17, d: 0.07, ref: 'Y1' },
  { kind: 'header', x: 1.18, z: -0.93, w: 0.5, d: 0.1, ref: 'J2' },
  { kind: 'inductor', x: -1.28, z: -0.36, w: 0.16, d: 0.16, ref: 'L1' },
  { kind: 'inductor', x: -1.28, z: -0.08, w: 0.16, d: 0.16, ref: 'L2' },
  { kind: 'cap', x: -1.0, z: -0.62, r: 0.075, ref: 'C1' },
  { kind: 'cap', x: 0.12, z: -0.72, r: 0.07, ref: 'C2' },
  { kind: 'cap', x: 1.45, z: 0.02, r: 0.07, ref: 'C3' },
  { kind: 'cap', x: 0.2, z: -0.38, r: 0.06, ref: 'C4' },
];

/** Gold edge-connector fingers along the front edge. */
export const FINGERS = Array.from({ length: 34 }, (_, i) => ({ x: -1.25 + i * 0.05, z: BD / 2 - 0.09, w: 0.032, d: 0.16 }));
export const HOLES = [[-1.47, -0.97], [1.47, -0.97], [-1.47, 0.85], [1.47, 0.85]];

function free(x: number, z: number, pad: number) {
  if (Math.abs(x) > BW / 2 - 0.12 || Math.abs(z) > BD / 2 - 0.3) return false;
  return big.every((p) => {
    const hw = ('r' in p ? p.r : p.w / 2) + pad, hd = ('r' in p ? p.r : p.d / 2) + pad;
    return Math.abs(x - p.x) > hw || Math.abs(z - p.z) > hd;
  });
}

const small: Part[] = [];
for (let tries = 0; small.length < 110 && tries < 3000; tries++) {
  const x = (R() - 0.5) * BW, z = (R() - 0.5) * BD;
  if (!free(x, z, 0.05) || small.some((s) => Math.hypot(s.x - x, s.z - z) < 0.085)) continue;
  const mlcc = R() < 0.6;
  small.push({ kind: 'smd', x, z, w: mlcc ? 0.05 : 0.06, d: 0.028, rot: R() < 0.5 ? 0 : Math.PI / 2, tone: mlcc ? 'mlcc' : 'res', ref: `${mlcc ? 'C' : 'R'}${small.length + 10}` });
}
export const PARTS: Part[] = [...big, ...small];

/** Pin positions for a chip outline (used for pads, traces and solder joints). */
export function pins(p: Extract<Part, { w: number }>) {
  const out: { x: number; z: number; side: number }[] = [];
  if (p.kind === 'soic' || p.kind === 'mem') {
    const n = p.kind === 'mem' ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const x = p.x - p.w / 2 + (p.w * (i + 0.5)) / n;
      out.push({ x, z: p.z - p.d / 2 - 0.025, side: 0 }, { x, z: p.z + p.d / 2 + 0.025, side: 2 });
    }
  } else if (p.kind === 'qfp' || p.kind === 'soc') {
    const n = p.kind === 'soc' ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const f = -0.5 + (i + 0.5) / n;
      out.push(
        { x: p.x + f * p.w, z: p.z - p.d / 2 - 0.03, side: 0 }, { x: p.x + p.w / 2 + 0.03, z: p.z + f * p.d, side: 1 },
        { x: p.x + f * p.w, z: p.z + p.d / 2 + 0.03, side: 2 }, { x: p.x - p.w / 2 - 0.03, z: p.z + f * p.d, side: 3 },
      );
    }
  }
  return out;
}

const u = (x: number) => ((x + BW / 2) / BW) * TW;
const v = (z: number) => ((z + BD / 2) / BD) * TH;

type Trace = { pts: [number, number][]; w: number };

function route(a: { x: number; z: number }, b: { x: number; z: number }): [number, number][] {
  // Orthogonal run, a 45° bend, then the rest: the look of real routed copper.
  const dx = b.x - a.x, dz = b.z - a.z;
  const diag = Math.min(Math.abs(dx), Math.abs(dz)) * 0.6;
  const p1: [number, number] = [a.x + Math.sign(dx) * (Math.abs(dx) - diag) * 0.5, a.z];
  const p2: [number, number] = [p1[0] + Math.sign(dx) * diag, a.z + Math.sign(dz) * diag];
  return [[a.x, a.z], p1, p2, [p2[0], b.z], [b.x, b.z]];
}

function buildTraces(): Trace[] {
  const r = rng(63);
  const chips = PARTS.filter((p): p is Extract<Part, { w: number }> => 'w' in p && ['soc', 'qfp', 'soic', 'mem'].includes(p.kind));
  const allPins = chips.flatMap((c) => pins(c).map((p) => ({ ...p, c })));
  const traces: Trace[] = [];
  // Memory bus: parallel bundles from each memory chip to the SoC.
  for (const m of chips.filter((c) => c.kind === 'mem')) {
    pins(m).filter((p) => p.side === 0).forEach((p, i) => {
      traces.push({ pts: route(p, { x: -0.45 - 0.3 + ((m.x + 1.3) / 1.3) * 0.6 * 0.9 + i * 0.02, z: -0.12 + 0.39 }), w: 3 });
    });
  }
  // Point-to-point nets between random pins.
  for (let i = 0; i < 150; i++) {
    const a = allPins[Math.floor(r() * allPins.length)];
    const b = allPins[Math.floor(r() * allPins.length)];
    if (a.c === b.c || Math.hypot(a.x - b.x, a.z - b.z) > 1.4) continue;
    traces.push({ pts: route(a, b), w: r() < 0.15 ? 7 : r() < 0.5 ? 4 : 3 });
  }
  // Fan-out to the edge fingers.
  FINGERS.forEach((f, i) => {
    if (i % 2) return;
    const target = allPins[Math.floor(r() * allPins.length)];
    traces.push({ pts: [[f.x, f.z - 0.08], [f.x, f.z - 0.2 - (i % 6) * 0.03], ...route({ x: f.x, z: f.z - 0.2 - (i % 6) * 0.03 }, target).slice(1)], w: 3 });
  });
  return traces;
}

export const TRACES = buildTraces();

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

const roundRect = (g: CanvasRenderingContext2D, x: number, z: number, w: number, d: number) =>
  g.rect(u(x - w / 2), v(z - d / 2), (w / BW) * TW, (d / BD) * TH);

/** Top surface (solder mask, pads, silkscreen) plus a roughness/metalness map and the trace-flow map. */
export function makeBoardTextures() {
  const [cc, g] = makeCanvas(); // colour
  const [rc, rg] = makeCanvas(); // G = roughness, B = metalness
  const [fc, fg] = makeCanvas(); // R = arc-length phase, G = per-trace offset, B = trace mask
  const [bc, bg] = makeCanvas(); // bottom copper plane
  const r = rng(7);

  g.fillStyle = '#0c3826'; g.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 9000; i++) { // fibreglass weave showing through the mask
    g.fillStyle = `rgba(${r() < 0.5 ? '20,70,48' : '6,40,26'},0.35)`;
    g.fillRect(r() * TW, r() * TH, 2 + r() * 3, 1);
  }
  rg.fillStyle = 'rgb(0,115,0)'; rg.fillRect(0, 0, TW, TH);
  fg.fillStyle = '#000'; fg.fillRect(0, 0, TW, TH);

  // Copper pour: hatched ground areas under the mask.
  g.strokeStyle = 'rgba(40,110,72,0.35)'; g.lineWidth = 2;
  for (let x = -TH; x < TW; x += 14) { g.beginPath(); g.moveTo(x, TH * 0.86); g.lineTo(x + TH * 0.14, TH); g.stroke(); }

  // Traces: raised copper under green mask; flow map encodes distance along each trace.
  g.lineCap = fg.lineCap = 'round'; g.lineJoin = 'round';
  for (const t of TRACES) {
    g.strokeStyle = '#1d6a47'; g.lineWidth = t.w + 1;
    g.beginPath(); t.pts.forEach(([x, z], i) => (i ? g.lineTo(u(x), v(z)) : g.moveTo(u(x), v(z)))); g.stroke();
    const offset = r();
    let s = 0;
    for (let i = 1; i < t.pts.length; i++) {
      const [x0, z0] = t.pts[i - 1], [x1, z1] = t.pts[i];
      const len = Math.hypot(u(x1) - u(x0), v(z1) - v(z0));
      const n = Math.max(1, Math.ceil(len / 5));
      for (let k = 0; k < n; k++) {
        const a = k / n, b = (k + 1) / n;
        fg.strokeStyle = `rgb(${Math.floor(((s + a * len) / 600) % 1 * 255)},${Math.floor(offset * 255)},255)`;
        fg.lineWidth = t.w + 1;
        fg.beginPath();
        fg.moveTo(u(x0 + (x1 - x0) * a), v(z0 + (z1 - z0) * a));
        fg.lineTo(u(x0 + (x1 - x0) * b), v(z0 + (z1 - z0) * b));
        fg.stroke();
      }
      s += len;
    }
    // Vias at the ends of longer nets.
    if (t.w >= 4) {
      const [x, z] = t.pts[Math.floor(t.pts.length / 2)];
      g.fillStyle = '#b9bcc0'; g.beginPath(); g.arc(u(x), v(z), 6, 0, 7); g.fill();
      g.fillStyle = '#0a2a1c'; g.beginPath(); g.arc(u(x), v(z), 2.5, 0, 7); g.fill();
      rg.fillStyle = 'rgb(0,60,255)'; rg.beginPath(); rg.arc(u(x), v(z), 6, 0, 7); rg.fill();
    }
  }

  // Exposed pads (tin) and gold fingers.
  const pad = (x: number, z: number, w: number, d: number, col: string) => {
    g.fillStyle = col; g.beginPath(); roundRect(g, x, z, w, d); g.fill();
    rg.fillStyle = 'rgb(0,55,255)'; rg.beginPath(); roundRect(rg, x, z, w, d); rg.fill();
  };
  for (const p of PARTS) {
    if (p.kind === 'smd') {
      const [w, d] = p.rot ? [p.d, p.w] : [p.w, p.d];
      const ox = p.rot ? 0 : w / 2, oz = p.rot ? d / 2 : 0;
      pad(p.x - ox, p.z - oz, p.rot ? w * 1.2 : 0.022, p.rot ? 0.022 : d * 1.2, '#c7c9cc');
      pad(p.x + ox, p.z + oz, p.rot ? w * 1.2 : 0.022, p.rot ? 0.022 : d * 1.2, '#c7c9cc');
    } else if ('w' in p) {
      for (const q of pins(p)) pad(q.x, q.z, q.side % 2 ? 0.05 : 0.022, q.side % 2 ? 0.022 : 0.05, '#c7c9cc');
    }
  }
  for (const f of FINGERS) pad(f.x, f.z, f.w, f.d, '#d8a843');
  for (const [x, z] of HOLES) {
    g.fillStyle = '#c7c9cc'; g.beginPath(); g.arc(u(x), v(z), 26, 0, 7); g.fill();
    g.fillStyle = '#050605'; g.beginPath(); g.arc(u(x), v(z), 15, 0, 7); g.fill();
  }

  // Silkscreen: outlines, reference designators, board marking.
  g.strokeStyle = g.fillStyle = 'rgba(232,230,218,0.9)'; g.lineWidth = 2.5;
  g.font = '500 22px "IBM Plex Mono", monospace';
  for (const p of PARTS) {
    if (p.kind === 'smd') continue;
    if ('r' in p) { g.beginPath(); g.arc(u(p.x), v(p.z), (p.r / BW) * TW + 6, 0, 7); g.stroke(); }
    else { g.beginPath(); roundRect(g, p.x, p.z, p.w + 0.05, p.d + 0.05); g.stroke(); }
    const yoff = 'r' in p ? p.r : p.d / 2;
    g.fillText(p.ref, u(p.x) - 12, v(p.z + yoff) + 34);
  }
  g.font = 'italic 600 30px "IBM Plex Mono", monospace';
  g.fillText('Cuprum  CU-29  REV A', u(0.35), v(-0.98));
  g.font = '500 20px "IBM Plex Mono", monospace';
  g.fillText('RECOVER ME', u(-1.36), v(0.96));

  // Bottom copper: a hatched ground plane.
  bg.fillStyle = '#000'; bg.fillRect(0, 0, TW, TH);
  bg.strokeStyle = '#fff'; bg.lineWidth = 7;
  for (let x = -TH; x < TW; x += 26) { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x + TH, TH); bg.stroke(); }
  bg.fillStyle = '#000';
  for (const [x, z] of HOLES) { bg.beginPath(); bg.arc(u(x), v(z), 36, 0, 7); bg.fill(); }

  return { color: tex(cc), rough: tex(rc, false), flow: tex(fc, false), bottom: tex(bc, false) };
}

let cached: ReturnType<typeof makeBoardTextures> | null = null;
/** Textures are generated once and shared by the board and its powder. */
export const boardTextures = () => (cached ??= makeBoardTextures());
