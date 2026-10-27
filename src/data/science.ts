// Every number the app shows comes from here. Each block names its source; values marked
// `est: true` are reasoned estimates (derivation in `note`), not literature measurements.

export type Metal =
  | 'Cu' | 'Fe' | 'Al' | 'Sn' | 'Pb' | 'Ni' | 'Zn' | 'Ag' | 'Au' | 'Pd'
  | 'Co' | 'Li' | 'Mn' | 'Nd' | 'In' | 'Hg';

export const METALS: Record<Metal, { name: string; z: number; mass: number }> = {
  Cu: { name: 'Copper', z: 29, mass: 63.546 },
  Fe: { name: 'Iron', z: 26, mass: 55.845 },
  Al: { name: 'Aluminium', z: 13, mass: 26.982 },
  Sn: { name: 'Tin', z: 50, mass: 118.71 },
  Pb: { name: 'Lead', z: 82, mass: 207.2 },
  Ni: { name: 'Nickel', z: 28, mass: 58.693 },
  Zn: { name: 'Zinc', z: 30, mass: 65.38 },
  Ag: { name: 'Silver', z: 47, mass: 107.87 },
  Au: { name: 'Gold', z: 79, mass: 196.97 },
  Pd: { name: 'Palladium', z: 46, mass: 106.42 },
  Co: { name: 'Cobalt', z: 27, mass: 58.933 },
  Li: { name: 'Lithium', z: 3, mass: 6.94 },
  Mn: { name: 'Manganese', z: 25, mass: 54.938 },
  Nd: { name: 'Neodymium', z: 60, mass: 144.24 },
  In: { name: 'Indium', z: 49, mass: 114.82 },
  Hg: { name: 'Mercury', z: 80, mass: 200.59 },
};

/** Where on a circuit board each metal physically lives (drives the 3D labels). */
export const WHERE_ON_BOARD: Partial<Record<Metal, string>> = {
  Cu: 'Traces, ground planes and vias',
  Au: 'Edge connectors and chip bond wires',
  Ag: 'Solder alloys and capacitor electrodes',
  Pd: 'Multilayer ceramic capacitors',
  Sn: 'Solder joints',
  Pb: 'Older (pre-RoHS) solder',
  Ni: 'Plating under gold contacts',
  Fe: 'Shields, screws and leads',
  Al: 'Heatsinks and electrolytic capacitors',
  Zn: 'Brass connectors and coatings',
};

// ── Prices: snapshot, editable in the UI ─────────────────────────────────────
// LME official settlement 26 Oct 2026 (Westmetall) for Cu, Al, Ni, Pb, Sn, Zn;
// spot 26–27 Oct 2026 (Kitco/Fortune) for Au $4,024/oz, Ag $54/oz, Pd ≈ $1,026/oz;
// Co: Fastmarkets Rotterdam 2 Sep 2026; Li: battery-grade Li₂CO₃ ≈ CNY 105k/t → Li content.
const OZ = 31.1035; // g per troy ounce
export const PRICE_DATE = '27 Oct 2026';
export const PRICES_USD_PER_KG: Record<Metal, number> = {
  Cu: 14.4, Fe: 0.35, Al: 3.05, Sn: 50.9, Pb: 1.9, Ni: 15.5, Zn: 3.9,
  Au: (4024 / OZ) * 1000, Ag: (54 / OZ) * 1000, Pd: (1026 / OZ) * 1000,
  Co: 56, Li: 78, Mn: 2.1, Nd: 75, In: 340, Hg: 0,
};
export const DEFAULT_FX_INR = 88; // ₹ per US$, editable

// ── Composition presets (mass fraction, 0–1) ─────────────────────────────────
export type Preset = {
  id: string;
  name: string;
  comp: Partial<Record<Metal, number>>;
  other: string; // what makes up the rest of the mass
  source: string;
  est?: boolean;
  note?: string;
};

const HAG = 'Hagelüken (2006), reproduced in Cui & Zhang (2008) J. Hazard. Mater. 158:228';

export const PRESETS: Record<string, Preset> = {
  pc_board: {
    id: 'pc_board', name: 'PC board scrap (high grade)',
    comp: { Cu: 0.20, Fe: 0.07, Al: 0.05, Sn: 0.03, Pb: 0.015, Ni: 0.01, Zn: 0.01, Ag: 0.001, Au: 0.00025, Pd: 0.00011 },
    other: 'Glass-fibre epoxy (FR-4), ceramics and brominated resin',
    source: `${HAG}; Sn and Zn: typical range across PCB characterisation studies (1–5 % and 0.2–2 %)`,
  },
  phone_board: {
    id: 'phone_board', name: 'Mobile phone logic board',
    comp: { Cu: 0.263, Fe: 0.05, Sn: 0.035, Ni: 0.015, Al: 0.01, Zn: 0.008, Pb: 0.003, Ag: 0.00138, Au: 0.00035, Pd: 0.00021 },
    other: 'FR-4 laminate, ceramics, plastics',
    source: 'Cu 26.3 %: mobile-phone PCB feed in Garg et al. (2019) Heliyon 5:e02883. Ag, Au, Pd, Fe, Al, Pb: ' + HAG + ' (whole-handset grades, so a conservative floor for the board alone)',
    note: 'Phone boards are the richest common e-waste stream: per tonne, more gold than most gold ore.',
  },
  tv_board: {
    id: 'tv_board', name: 'TV / power-supply board (low grade)',
    comp: { Fe: 0.28, Cu: 0.10, Al: 0.10, Sn: 0.015, Pb: 0.01, Ni: 0.003, Ag: 0.00028, Au: 0.00002, Pd: 0.00001 },
    other: 'Single-sided phenolic or FR-2 board, transformer cores, plastics',
    source: `${HAG}; Sn: typical`,
  },
  phone: {
    id: 'phone', name: 'Whole mobile phone',
    comp: { Cu: 0.13, Fe: 0.05, Co: 0.035, Al: 0.01, Pb: 0.003, Ni: 0.001, Ag: 0.00138, Au: 0.00035, Pd: 0.00021 },
    other: 'Plastics, glass, battery electrolyte and graphite',
    source: `${HAG}. Co estimated: battery ≈ 20 % of handset mass × ≈ 17 % Co (LiCoO₂ cell)`,
    note: 'Remove the battery first; the board is the bioleaching feed.',
  },
  laptop: {
    id: 'laptop', name: 'Laptop (whole device)', est: true,
    comp: { Al: 0.12, Fe: 0.10, Cu: 0.05, Co: 0.01, Ni: 0.005, Sn: 0.004, Ag: 0.0001, Au: 0.00003, Pd: 0.00001, In: 0.00001 },
    other: 'Plastics ≈ 35 %, glass ≈ 15 %, battery ≈ 15 %',
    source: 'Estimate from component mix: board ≈ 12 % (PC-board grade), Li-ion pack ≈ 15 %, LCD ≈ 20 %, chassis',
  },
  liion: {
    id: 'liion', name: 'Lithium-ion cell / pack',
    comp: { Al: 0.15, Cu: 0.10, Co: 0.07, Mn: 0.05, Ni: 0.04, Li: 0.013 },
    other: 'Graphite ≈ 16 %, electrolyte, separator, steel casing',
    source: 'Weighted average of mixed-format packs (US patent family, e.g. US 11,077,452); LiCoO₂ phone cells reach 30 % Co and 10 % Li (Front. Microbiol. 2023, 14:1197081)',
    note: 'Lithium shown as metal (7 % Li₂CO₃-equivalent × 0.188).',
  },
  alkaline: {
    id: 'alkaline', name: 'Alkaline battery (Zn-MnO₂)',
    comp: { Mn: 0.32, Fe: 0.22, Zn: 0.20 },
    other: 'KOH electrolyte, graphite, paper, plastic seal',
    source: 'Zn 12–28 %, Mn 26–45 %: Sayilgan et al. (2009) Hydrometallurgy 97:158. Fe (steel can): typical',
  },
  coin_cell: {
    id: 'coin_cell', name: 'Coin cell (Li-MnO₂)', est: true,
    comp: { Fe: 0.50, Mn: 0.25, Ni: 0.04, Li: 0.03 },
    other: 'Stainless-steel can, organic electrolyte',
    source: 'Estimate for a CR2032-type cell. Silver-oxide button cells (SR…) instead hold ≈ 30 % Ag',
  },
  cable: {
    id: 'cable', name: 'Insulated cable', est: true,
    comp: { Cu: 0.40, Sn: 0.002 },
    other: 'PVC / PE insulation ≈ 60 %',
    source: 'Typical: insulated wire scrap ranges 20–60 % Cu by mass (thin data cables sit at the low end)',
  },
  casing: {
    id: 'casing', name: 'Plastic housing', est: true,
    comp: { Fe: 0.02 },
    other: 'ABS, HIPS or PC/ABS ≈ 95 %; brominated flame retardants in older housings',
    source: 'Typical; screws and inserts make up the metal fraction',
  },
  display: {
    id: 'display', name: 'LCD monitor / TV', est: true,
    comp: { Fe: 0.30, Al: 0.05, Cu: 0.03, Sn: 0.001, In: 0.00005, Hg: 0.00001 },
    other: 'Plastics ≈ 35 %, glass ≈ 15 %, control boards',
    source: 'Estimate. In: ITO film on the panel glass. Hg: only CCFL-backlit models (≈ 3–5 mg per lamp)',
  },
  hdd: {
    id: 'hdd', name: 'Hard disk drive (3.5″)', est: true,
    comp: { Al: 0.45, Fe: 0.30, Cu: 0.03, Ni: 0.01, Nd: 0.0075, Ag: 0.00005, Au: 0.0000125 },
    other: 'Platters, NdFeB magnets (≈ 2.5 % of mass), controller board ≈ 5 %',
    source: 'Estimate: ≈ 15 g NdFeB magnet per ≈ 600 g drive, ≈ 30 % Nd; board at PC-board grade',
  },
  small_device: {
    id: 'small_device', name: 'Small device (remote, mouse, keyboard)',
    comp: { Al: 0.05, Fe: 0.04, Cu: 0.03, Ni: 0.005, Pb: 0.001, Ag: 0.00026, Au: 0.00005, Pd: 0.000005 },
    other: 'Mostly ABS plastic and rubber',
    source: `${HAG} (calculator scrap row)`,
  },
  charger: {
    id: 'charger', name: 'Charger / power adapter', est: true,
    comp: { Cu: 0.15, Fe: 0.15, Al: 0.02, Sn: 0.005, Ag: 0.00004, Au: 0.000003 },
    other: 'Plastic shell ≈ 55 %, small low-grade board',
    source: 'Estimate: transformer windings and core, cable stub, TV-grade board ≈ 15 %',
  },
  audio: {
    id: 'audio', name: 'Earphones / headphones', est: true,
    comp: { Cu: 0.15, Fe: 0.05, Nd: 0.01, Al: 0.01 },
    other: 'Plastics and silicone ≈ 75 %',
    source: 'Estimate: copper voice coils and cable, NdFeB driver magnets',
  },
  lamp: {
    id: 'lamp', name: 'Compact fluorescent lamp', est: true,
    comp: { Cu: 0.02, Al: 0.02, Fe: 0.02, Hg: 0.000035 },
    other: 'Glass ≈ 60 %, rare-earth phosphor (Y, Eu, Tb), plastic base, ballast board',
    source: 'Hg ≈ 2.5–3.5 mg per lamp (EU RoHS limits) in a ≈ 100 g lamp; others estimated',
  },
};

// ── Recycling routes per detected stream ─────────────────────────────────────
export type Route = {
  stream: string;
  verdict: 'bioleach' | 'board-inside' | 'other-route' | 'hazard' | 'none';
  headline: string;
  steps: string[];
  boardPreset?: string;
};

/** Presets that are not a bioleaching feed here, mapped to the recycling route that applies instead. */
export const NOT_A_FEED: Record<string, string> = {
  liion: 'battery', alkaline: 'battery', coin_cell: 'battery', cable: 'cable', casing: 'casing',
  audio: 'audio', lamp: 'lamp', display: 'display', hdd: 'storage',
};

export const ROUTES: Record<string, Route> = {
  pcb: { stream: 'pcb', verdict: 'bioleach', headline: 'Bioleaching candidate',
    steps: ['A certified recycler removes batteries and large components', 'The board is shredded, then milled to a powder below 100 µm', 'The powder goes into an acidic reactor with iron-oxidising microbes'] },
  phone: { stream: 'phone', verdict: 'board-inside', boardPreset: 'phone_board', headline: 'Holds a high-grade board and a Li-ion battery',
    steps: ['Battery comes out first: puncture risk and fire hazard', 'Logic board goes to bioleaching or smelting', 'Glass and plastics go to separate streams'] },
  laptop: { stream: 'laptop', verdict: 'board-inside', boardPreset: 'pc_board', headline: 'Holds a high-grade board, a Li-ion pack and an LCD',
    steps: ['Battery pack out first', 'Motherboard and RAM go to precious-metal recovery', 'Aluminium chassis is remelted'] },
  storage: { stream: 'storage', verdict: 'board-inside', boardPreset: 'pc_board', headline: 'Shred for data security, then recover magnets',
    steps: ['Physically destroy the platters if the data matters', 'NdFeB magnets are a rare-earth source (Nd, Pr, Dy)', 'Controller board joins the PCB stream'] },
  display: { stream: 'display', verdict: 'hazard', boardPreset: 'tv_board', headline: 'Specialist recycler: possible mercury',
    steps: ['Older CCFL backlights contain mercury, so the lamps must stay intact', 'Panel glass carries indium (ITO), which some plants recover', 'Control boards are low grade'] },
  battery: { stream: 'battery', verdict: 'hazard', headline: 'Hazardous: not a bioleaching feed here',
    steps: ['Do not puncture, crush or heat it. Tape the terminals', 'Take it to a battery collection point', 'Recyclers recover Co, Ni, Li and Mn by hydrometallurgy; bioleaching of cathode powder is still at research stage'] },
  cable: { stream: 'cable', verdict: 'other-route', headline: 'Mechanical route: no microbes needed',
    steps: ['Granulate, then separate copper from plastic by density', 'Mechanical separation already recovers almost all the copper', 'Never burn cables to strip them: it releases dioxins'] },
  casing: { stream: 'casing', verdict: 'other-route', headline: 'Plastics stream',
    steps: ['Sort by polymer (ABS, HIPS, PC/ABS)', 'Housings with brominated flame retardants need separate handling', 'Metal inserts are pulled out magnetically'] },
  peripheral: { stream: 'peripheral', verdict: 'board-inside', boardPreset: 'small_device', headline: 'Low-grade device: mostly plastic',
    steps: ['Remove batteries (remotes and wireless mice)', 'Small board and cable go to e-waste collection', 'Plastic shell goes to the plastics stream'] },
  charger: { stream: 'charger', verdict: 'board-inside', boardPreset: 'charger', headline: 'Copper windings and a small board',
    steps: ['Copper transformer windings and cable are the main value', 'Small board is low grade', 'Shell goes to the plastics stream'] },
  audio: { stream: 'audio', verdict: 'other-route', headline: 'Small e-waste: copper coils and magnets',
    steps: ['Remove the battery if they are wireless', 'Drop at an e-waste collection point', 'Magnets and copper are recovered after shredding'] },
  lamp: { stream: 'lamp', verdict: 'hazard', headline: 'Hazardous: contains mercury',
    steps: ['Do not break it. If it breaks, ventilate the room and avoid vacuuming', 'Take it to a lamp collection point', 'Recyclers recover mercury, glass and rare-earth phosphor'] },
  none: { stream: 'none', verdict: 'none', headline: 'No e-waste in frame',
    steps: ['Hold the item inside the frame, about 20–40 cm from the camera', 'Fill most of the frame with it', 'A plain background helps'] },
};

// ── Microorganisms ───────────────────────────────────────────────────────────
// Cardinal parameters: [min, opt, max]. kMax in 1/day. Extent (fraction) per metal at optimum.
export type Organism = {
  id: string;
  name: string;
  short: string;
  kind: string;
  mechanism: string;
  shape: 'rod' | 'vibrio' | 'hypha' | 'mixed';
  tint: string; // colour of the culture in the reactor
  T: [number, number, number];
  pH: [number, number, number];
  k: number;
  lag: number;
  pd50: number; // g/L where extent halves (one-step)
  oneStep: number; // extent multiplier without a pre-grown culture
  substrate: { name: string; formula: string; ref: number; max: number; K: number; base: number };
  extent: Partial<Record<Metal, number>>;
  lit: { T: number; pH: number; pd: number; days: number; twoStep: boolean; sub: number };
  source: string;
};

export const ORGANISMS: Organism[] = [
  {
    id: 'mix', name: 'Mixed acidophilic consortium', short: 'Consortium', kind: 'Bacteria (iron + sulfur oxidisers)',
    mechanism: 'Iron oxidisers regenerate Fe³⁺, which oxidises metallic copper; sulfur oxidisers keep the acid topped up.',
    shape: 'mixed', tint: '#b4ff4a', T: [10, 33, 45], pH: [0.9, 1.8, 3.5], k: 0.6, lag: 1.2, pd50: 70, oneStep: 0.95,
    substrate: { name: 'Ferrous iron', formula: 'Fe²⁺', ref: 9, max: 15, K: 2, base: 0.5 },
    extent: { Cu: 0.98, Zn: 0.95, Ni: 0.92, Al: 0.9, Sn: 0.08, Pb: 0.05 },
    lit: { T: 30, pH: 1.8, pd: 10, days: 10, twoStep: true, sub: 9 },
    source: '98–99 % Cu from mobile-phone PCBs at 7–15 % w/v (Garg et al. 2019, Heliyon 5:e02883); consortium from acid mine drainage (Xiang et al. 2010, J. Hazard. Mater. 184:812)',
  },
  {
    id: 'af', name: 'Acidithiobacillus ferrooxidans', short: 'A. ferrooxidans', kind: 'Bacterium, mesophilic',
    mechanism: 'Oxidises Fe²⁺ to Fe³⁺; the ferric iron dissolves copper (Cu + 2Fe³⁺ → Cu²⁺ + 2Fe²⁺), and the cycle repeats.',
    shape: 'rod', tint: '#b4ff4a', T: [10, 30, 40], pH: [1.2, 2.0, 4.0], k: 0.45, lag: 1.5, pd50: 45, oneStep: 0.95,
    substrate: { name: 'Ferrous iron', formula: 'Fe²⁺', ref: 9, max: 15, K: 2, base: 0.5 },
    extent: { Cu: 0.93, Zn: 0.92, Ni: 0.9, Al: 0.88, Sn: 0.08, Pb: 0.05 },
    lit: { T: 30, pH: 2.0, pd: 10, days: 10, twoStep: false, sub: 9 },
    source: '>90 % of Cu, Zn, Ni, Al at 5–10 g/L; Sn precipitates as SnO, Pb as PbSO₄ (Brandl et al. 2001, Hydrometallurgy 59:319). 93 % Cu at 35 °C, pH 2, 10 days with A. thiooxidans',
  },
  {
    id: 'lf', name: 'Leptospirillum ferriphilum', short: 'L. ferriphilum', kind: 'Bacterium, moderately thermotolerant',
    mechanism: 'A dedicated iron oxidiser. It tolerates lower pH and more ferric iron than A. ferrooxidans.',
    shape: 'vibrio', tint: '#b4ff4a', T: [18, 37, 45], pH: [0.9, 1.5, 2.6], k: 0.5, lag: 2.0, pd50: 50, oneStep: 0.95,
    substrate: { name: 'Ferrous iron', formula: 'Fe²⁺', ref: 9, max: 15, K: 2, base: 0.5 },
    extent: { Cu: 0.93, Zn: 0.9, Ni: 0.88, Al: 0.85, Sn: 0.08, Pb: 0.05 },
    lit: { T: 37, pH: 1.5, pd: 10, days: 10, twoStep: false, sub: 9 },
    source: 'Growth pH 1.3–2.0, optimum 30–37 °C, maximum 45 °C (genome and isolation studies)',
  },
  {
    id: 'st', name: 'Sulfobacillus thermosulfidooxidans', short: 'S. thermosulfidooxidans', kind: 'Bacterium, moderate thermophile',
    mechanism: 'Oxidises both iron and sulfur at around 45 °C, where chemical leaching also runs faster.',
    shape: 'rod', tint: '#b4ff4a', T: [20, 45, 60], pH: [1.0, 2.0, 3.2], k: 0.3, lag: 2.5, pd50: 40, oneStep: 0.95,
    substrate: { name: 'Ferrous iron', formula: 'Fe²⁺', ref: 9, max: 15, K: 2, base: 0.5 },
    extent: { Cu: 0.89, Zn: 0.83, Ni: 0.81, Al: 0.79, Sn: 0.06, Pb: 0.04 },
    lit: { T: 45, pH: 2.0, pd: 10, days: 18, twoStep: false, sub: 9 },
    source: '89 % Cu, 83 % Zn, 81 % Ni, 79 % Al at 10 g/L (Ilyas et al. 2007, Hydrometallurgy 88:180)',
  },
  {
    id: 'at', name: 'Acidithiobacillus thiooxidans', short: 'A. thiooxidans', kind: 'Bacterium, sulfur oxidiser',
    mechanism: 'Turns elemental sulfur into sulfuric acid (acidolysis). Copper needs an oxidant, so on its own it is weaker for Cu.',
    shape: 'rod', tint: '#b4ff4a', T: [10, 28, 37], pH: [0.8, 2.5, 5.0], k: 0.18, lag: 2.0, pd50: 40, oneStep: 0.95,
    substrate: { name: 'Elemental sulfur', formula: 'S⁰', ref: 10, max: 20, K: 3, base: 0.3 },
    extent: { Zn: 0.9, Ni: 0.85, Al: 0.8, Cu: 0.75, Sn: 0.05, Pb: 0.03 },
    lit: { T: 28, pH: 2.5, pd: 10, days: 14, twoStep: false, sub: 10 },
    source: 'Thiobacilli mobilised >90 % Zn, Ni, Al (Brandl et al. 2001). Cu extent for a pure sulfur-oxidiser culture is our estimate',
  },
  {
    id: 'an', name: 'Aspergillus niger', short: 'A. niger', kind: 'Fungus',
    mechanism: 'Secretes citric, oxalic and gluconic acids that dissolve and complex metals (complexolysis) at mild pH.',
    shape: 'hypha', tint: '#e8d27a', T: [12, 30, 42], pH: [2.0, 5.5, 8.5], k: 0.22, lag: 3.0, pd50: 6, oneStep: 0.65,
    substrate: { name: 'Glucose', formula: 'C₆H₁₂O₆', ref: 100, max: 200, K: 30, base: 0.15 },
    extent: { Cu: 0.98, Zn: 0.95, Ni: 0.95, Al: 0.95, Pb: 0.95, Sn: 0.65, Au: 0.425 },
    lit: { T: 30, pH: 5.5, pd: 2.5, days: 14, twoStep: true, sub: 100 },
    source: 'Two-step, 2.5 g/L, 14 days, 30 °C: 100 % Cu and 42.5 % Au (Rodrigues et al. 2024, Sustainability 16:9837). One-step: 65 % Cu and Sn, >95 % Al, Ni, Pb, Zn (Brandl et al. 2001)',
  },
  {
    id: 'cv', name: 'Chromobacterium violaceum', short: 'C. violaceum', kind: 'Bacterium, cyanogenic',
    mechanism: 'Makes hydrogen cyanide from glycine; at alkaline pH, cyanide dissolves gold as Au(CN)₂⁻. Its violacein pigment turns the broth violet.',
    shape: 'rod', tint: '#8a5cff', T: [15, 30, 40], pH: [6.5, 9.0, 11.5], k: 0.25, lag: 1.0, pd50: 25, oneStep: 0.9,
    substrate: { name: 'Glycine', formula: 'C₂H₅NO₂', ref: 5, max: 10, K: 1.5, base: 0.15 },
    extent: { Cu: 0.875, Au: 0.736 },
    lit: { T: 30, pH: 9.0, pd: 10, days: 8, twoStep: false, sub: 5 },
    source: '87.5 % Cu and 73.6 % Au at pH 9, 10 g/L, 30 °C with 5 g/L glycine (Kumar et al. 2021, BioMetals 34:1043). Without optimisation, about 11 % Au (Chi et al. 2011, Minerals Engineering 24:1219)',
  },
];

/** Acid leaching without microbes (sterile control), applies only below pH 3. */
export const ABIOTIC: Partial<Record<Metal, number>> = { Zn: 0.35, Al: 0.25, Ni: 0.12, Cu: 0.05, Sn: 0.02, Pb: 0.01 };

// ── Context numbers ──────────────────────────────────────────────────────────
export const CONTEXT = {
  oreGradeCu: 0.006, // ≈ 0.6 % Cu in typical mined ore
  oreGradeAu: 2.5e-6, // ≈ 2.5 g/t gold ore
  co2PerKgCu: 4.1, // kg CO₂e per kg primary copper cathode (International Copper Association LCA)
};

export const REFERENCES = [
  { key: 'vives', text: 'Vives Pons J., Comerma A., Escobet T., Dorado A. D., Tarrés-Puertas M. I. Optimizing bioleaching for printed circuit board copper recovery: an AI-driven RGB-based approach. Applied Sciences 15(1):129 (2025).', url: 'https://doi.org/10.3390/app15010129' },
  { key: 'rodrigues', text: 'Rodrigues É. F., Cesa Rovaris B., Valerio A., de Oliveira D., Hotza D. Bioleaching of printed circuit board waste to obtain metallic nanoparticles. Sustainability 16(22):9837 (2024).', url: 'https://doi.org/10.3390/su16229837' },
  { key: 'russo', text: 'Russo F., Luongo V., Mattei M. R., Frunzo L. Mathematical modeling of metal recovery from e-waste using a dark-fermentation-leaching process. Scientific Reports 12:4274 (2022).', url: 'https://doi.org/10.1038/s41598-022-08106-2' },
  { key: 'brandl', text: 'Brandl H., Bosshard R., Wegmann M. Computer-munching microbes: metal leaching from electronic scrap by bacteria and fungi. Hydrometallurgy 59:319–326 (2001).', url: 'https://doi.org/10.1016/S0304-386X(00)00188-2' },
  { key: 'cui', text: 'Cui J., Zhang L. Metallurgical recovery of metals from electronic waste: a review. Journal of Hazardous Materials 158:228–256 (2008).', url: 'https://doi.org/10.1016/j.jhazmat.2008.02.001' },
  { key: 'ilyas', text: 'Ilyas S., Anwar M. A., Niazi S. B., Afzal Ghauri M. Bioleaching of metals from electronic scrap by moderately thermophilic acidophilic bacteria. Hydrometallurgy 88:180–188 (2007).', url: 'https://doi.org/10.1016/j.hydromet.2007.04.007' },
  { key: 'xiang', text: 'Xiang Y. et al. Bioleaching of copper from waste printed circuit boards by bacterial consortium enriched from acid mine drainage. Journal of Hazardous Materials 184:812–818 (2010).', url: 'https://doi.org/10.1016/j.jhazmat.2010.08.113' },
  { key: 'sayilgan', text: 'Sayilgan E. et al. A review of technologies for the recovery of metals from spent alkaline and zinc–carbon batteries. Hydrometallurgy 97:158–166 (2009).', url: 'https://doi.org/10.1016/j.hydromet.2009.02.008' },
  { key: 'rosso', text: 'Rosso L., Lobry J. R., Flandrois J. P. An unexpected correlation between cardinal temperatures of microbial growth highlighted by a new model. Journal of Theoretical Biology 162:447–463 (1993).', url: 'https://doi.org/10.1006/jtbi.1993.1099' },
  { key: 'rosso95', text: 'Rosso L., Lobry J. R., Bajard S., Flandrois J. P. Convenient model to describe the combined effects of temperature and pH on microbial growth. Applied and Environmental Microbiology 61:610–616 (1995).', url: 'https://doi.org/10.1128/aem.61.2.610-616.1995' },
  { key: 'garg', text: 'Garg H., Nagar N., Ellamparuthy G., et al. Bench scale microbial catalysed leaching of mobile phone PCBs with an increasing pulp density. Heliyon 5:e02883 (2019).', url: 'https://doi.org/10.1016/j.heliyon.2019.e02883' },
  { key: 'kumar', text: 'Kumar A., Saini H. S., Şengör S., Sani R. K., et al. Bioleaching of metals from waste printed circuit boards using bacterial isolates native to abandoned gold mine. BioMetals 34:1043–1058 (2021).', url: 'https://doi.org/10.1007/s10534-021-00326-9' },
  { key: 'chi', text: 'Chi T. D., Lee J., Pandey B. D., Yoo K., et al. Bioleaching of gold and copper from waste mobile phone PCBs by using a cyanogenic bacterium. Minerals Engineering 24:1219–1222 (2011).', url: 'https://doi.org/10.1016/j.mineng.2011.05.009' },
  { key: 'radford', text: 'Radford A., Kim J. W., Hallacy C., et al. Learning transferable visual models from natural language supervision (CLIP). ICML (2021).', url: 'https://arxiv.org/abs/2103.00020' },
  { key: 'vasu', text: 'Vasu P. K. A., Pouransari H., Faghri F., Vemulapalli R., Tuzel O. MobileCLIP: fast image-text models through multi-modal reinforced training. CVPR (2024).', url: 'https://doi.org/10.1109/CVPR52733.2024.01511' },
];
