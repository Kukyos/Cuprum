import { create } from 'zustand';
import labels from './ai/labels.json';
import { DEFAULT_FX_INR, ORGANISMS, PRESETS, PRICES_USD_PER_KG, ROUTES, type Metal } from './data/science.ts';
import { litInput, type ProcessInput } from './sim/model.ts';

export type AiStatus = 'idle' | 'loading' | 'ready' | 'error';

export type Detection = {
  classId: string;
  stream: string;
  score: number; // stream-level match score, 0–1
  top: { id: string; p: number }[];
  snapshot: string; // data URL of the analysed crop
  source: 'camera' | 'upload' | 'sample';
};

export type Scenario = {
  id: number;
  label: string;
  presetId: string;
  massG: number;
  mode: 'simple' | 'process';
  efficiency: number; // copper efficiency used
  organism?: string;
  cuG: number;
  valueUsd: number;
};

type State = {
  ai: { status: AiStatus; progress: number; device: string; model: string; ms: number; error?: string };
  detection: Detection | null;
  presetId: string;
  massG: number;
  mode: 'simple' | 'process';
  simple: { cu: number; eff: number };
  process: ProcessInput;
  day: number; // reactor playback position, days
  playing: boolean;
  scenarios: Scenario[];
  currency: 'USD' | 'INR';
  fx: number;
  prices: Record<Metal, number>;
  sound: boolean;
  stageActive: boolean; // whether the 3D canvas is visible and should render
  set: (p: Partial<State>) => void;
  setProcess: (p: Partial<ProcessInput>) => void;
  detect: (d: Detection | null) => void;
  proposalExample: () => void;
};

export const classById = Object.fromEntries(labels.classes.map((c) => [c.id, c])) as Record<
  string, (typeof labels.classes)[number]
>;
export const streamName = labels.streams as Record<string, string>;

const defaultProcess = litInput(ORGANISMS.find((o) => o.id === 'af')!);

export const useStore = create<State>((set) => ({
  ai: { status: 'idle', progress: 0, device: '', model: '', ms: 0 },
  detection: null,
  presetId: 'pc_board',
  massG: 1000,
  mode: 'simple',
  simple: { cu: 0.15, eff: 0.6 }, // the proposal's worked example
  process: defaultProcess,
  day: defaultProcess.days,
  playing: false,
  scenarios: [],
  currency: 'USD',
  fx: DEFAULT_FX_INR,
  prices: { ...PRICES_USD_PER_KG },
  sound: true,
  stageActive: true,
  set: (p) => set(p),
  setProcess: (p) => set((s) => ({ process: { ...s.process, ...p }, day: Math.min(s.day, p.days ?? s.process.days) })),
  detect: (d) =>
    set((s) => {
      if (!d) return { detection: null };
      const c = classById[d.classId];
      // A board goes straight to its own preset; a device with a board inside uses that board.
      const presetId = d.stream === 'pcb' ? c.preset! : (ROUTES[d.stream]?.boardPreset ?? c.preset ?? s.presetId);
      return { detection: d, presetId, simple: { ...s.simple, cu: PRESETS[presetId]?.comp.Cu ?? s.simple.cu } };
    }),
  proposalExample: () => set({ massG: 1000, mode: 'simple', simple: { cu: 0.15, eff: 0.6 } }),
}));

/** Non-React values the 3D scene reads every frame (scroll position, section progress). */
export const live = {
  toMetals: 0, // 0–1 as the metals section scrolls in from the bottom of the screen to the top
  metals: 0, // 0–1 progress through the pinned metals section
  toLeach: 0, // 0–1 as the leach section scrolls in
  pointer: { x: 0, y: 0 },
};
