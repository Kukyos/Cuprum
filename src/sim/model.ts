// Semi-empirical bioleaching model. Illustrative, not a design tool:
//   X_m(t) = E_m · (1 − e^(−k·(t − λ)))   for t > λ   (first-order leaching with a lag phase)
// k scales with microbial activity a = CTMI(T) · CPM(pH) (Rosso 1993/1995), substrate supply and
// particle size; E_m (final extent) scales with pulp-density inhibition and metal liberation.
// Anchoring: each organism's extents are the values a paper reported at its conditions (o.lit), so
// E_m is rescaled until the model reproduces that data point exactly there, and extrapolates elsewhere.
import { ABIOTIC, ORGANISMS, PRICES_USD_PER_KG, type Metal, type Organism } from '../data/science.ts';

export type ProcessInput = {
  organismId: string;
  T: number; // °C
  pH: number;
  pd: number; // pulp density, g/L
  sizeUm: number; // particle size, µm
  sub: number; // substrate supplement, g/L (Fe²⁺, S⁰, glucose or glycine depending on organism)
  days: number;
  twoStep: boolean;
};

/** The proposal's formula, verbatim: waste mass × copper fraction × recovery efficiency. */
export const simpleRecovery = (massG: number, cuFraction: number, efficiency: number) =>
  massG * cuFraction * efficiency;

/** Cardinal temperature model with inflection (Rosso et al. 1993). 0 outside (Tmin, Tmax), 1 at Topt. */
export function ctmi(x: number, [lo, opt, hi]: [number, number, number]) {
  if (x <= lo || x >= hi) return 0;
  const num = (x - hi) * (x - lo) ** 2;
  const den = (opt - lo) * ((opt - lo) * (x - opt) - (opt - hi) * (opt + lo - 2 * x));
  return Math.max(0, Math.min(1, num / den));
}

/** Cardinal pH model (Rosso et al. 1995). 0 outside (pHmin, pHmax), 1 at pHopt. */
export function cpm(x: number, [lo, opt, hi]: [number, number, number]) {
  if (x <= lo || x >= hi) return 0;
  const a = (x - lo) * (x - hi);
  return Math.max(0, Math.min(1, a / (a - (x - opt) ** 2)));
}

export const organism = (id: string) => ORGANISMS.find((o) => o.id === id) ?? ORGANISMS[0];

export type Factors = {
  activity: number; fT: number; fpH: number; fSub: number; fSize: number;
  fPD: number; liberation: number; k: number; lag: number; extentScale: number; growing: boolean;
};

export function factors(inp: ProcessInput, o: Organism = organism(inp.organismId)): Factors {
  const fT = ctmi(inp.T, o.T);
  const fpH = cpm(inp.pH, o.pH);
  const activity = fT * fpH;
  const s = o.substrate;
  const sat = (x: number) => s.base + x / (x + s.K);
  const fSub = Math.min(1.1, sat(inp.sub) / sat(s.ref));
  const fSize = Math.min(1.6, Math.max(0.3, Math.sqrt(75 / inp.sizeUm)));
  const pd50 = o.pd50 * (inp.twoStep ? 3 : 1);
  const fPD = 1 / (1 + (inp.pd / pd50) ** 2);
  const liberation = 1 / (1 + (inp.sizeUm / 1500) ** 2);
  const k = o.k * activity * Math.sqrt(fSub) * fSize;
  const lag = (o.lag * (inp.twoStep ? 0.25 : 1) * (1 + inp.pd / pd50)) / Math.max(activity, 0.2);
  const extentScale = fPD * liberation * Math.sqrt(fSub) * (inp.twoStep ? 1 : o.oneStep);
  return { activity, fT, fpH, fSub, fSize, fPD, liberation, k, lag, extentScale, growing: activity > 0.02 };
}

/** Fraction of each metal leached at day t (biotic), and the sterile-control fraction. */
export const litInput = (o: Organism): ProcessInput => ({
  organismId: o.id, T: o.lit.T, pH: o.lit.pH, pd: o.lit.pd, sizeUm: 75, sub: o.lit.sub, days: o.lit.days, twoStep: o.lit.twoStep,
});

const anchors = new Map<string, number>();
/** Fraction of the intrinsic extent the model reaches at the literature conditions. */
function anchor(o: Organism) {
  if (!anchors.has(o.id)) {
    const f = factors(litInput(o), o);
    anchors.set(o.id, f.extentScale * (1 - Math.exp(-f.k * Math.max(0, o.lit.days - f.lag))));
  }
  return anchors.get(o.id)!;
}

export function leachedAt(inp: ProcessInput, t: number, f = factors(inp)) {
  const o = organism(inp.organismId);
  const a0 = anchor(o);
  const out: Partial<Record<Metal, number>> = {};
  const ctrl: Partial<Record<Metal, number>> = {};
  const acid = inp.pH < 3;
  for (const m of Object.keys({ ...o.extent, ...ABIOTIC }) as Metal[]) {
    const abiotic = acid ? (ABIOTIC[m] ?? 0) * f.fPD * f.liberation * (1 - Math.exp(-0.15 * f.fSize * t)) : 0;
    const E = ((o.extent[m] ?? 0) / a0) * f.extentScale;
    const bio = f.growing && t > f.lag ? E * (1 - Math.exp(-f.k * (t - f.lag))) : 0;
    out[m] = Math.min(0.99, Math.max(bio, abiotic));
    ctrl[m] = abiotic;
  }
  return { out, ctrl };
}

export type Curve = { t: number[]; series: Partial<Record<Metal, number[]>>; control: number[] };

export function curve(inp: ProcessInput, steps = 120): Curve {
  const f = factors(inp);
  const t = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * inp.days);
  const series: Partial<Record<Metal, number[]>> = {};
  const control: number[] = [];
  for (const ti of t) {
    const { out, ctrl } = leachedAt(inp, ti, f);
    for (const [m, v] of Object.entries(out) as [Metal, number][]) (series[m] ??= []).push(v);
    control.push(ctrl.Cu ?? 0);
  }
  return { t, series, control };
}

export type MetalResult = { metal: Metal; contentG: number; fraction: number; recoveredG: number; valueUsd: number };

export function recoverAll(massG: number, comp: Partial<Record<Metal, number>>, fractions: Partial<Record<Metal, number>>, prices = PRICES_USD_PER_KG): MetalResult[] {
  return (Object.entries(comp) as [Metal, number][])
    .map(([metal, w]) => {
      const fraction = fractions[metal] ?? 0;
      const recoveredG = massG * w * fraction;
      return { metal, contentG: massG * w, fraction, recoveredG, valueUsd: (recoveredG / 1000) * prices[metal] };
    })
    .sort((a, b) => b.contentG - a.contentG);
}

// ── Solution colour (drives the reactor and the simulated RGB sensor) ────────
// Beer–Lambert-style: each species absorbs some of each channel. Fe³⁺ absorbs blue → amber,
// Cu²⁺ absorbs red → blue, violacein (C. violaceum) absorbs green → violet.
export function solutionRGB(o: Organism, cuGL: number, fe3GL: number, progress: number) {
  const eps = { fe: [0.02, 0.09, 0.3], cu: [0.55, 0.12, 0.04], vio: [0.25, 1.1, 0.2], fungal: [0.05, 0.12, 0.45] };
  const vio = o.id === 'cv' ? 1.2 * progress : 0;
  const fungal = o.id === 'an' ? 0.8 + 1.2 * progress : 0;
  const base = [0.96, 0.97, 0.94];
  return base.map((b, i) => {
    const A = eps.fe[i] * fe3GL + eps.cu[i] * cuGL + eps.vio[i] * vio + eps.fungal[i] * fungal;
    return Math.round(255 * b * Math.exp(-A));
  }) as [number, number, number];
}
