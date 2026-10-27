import labels from './labels.json';
import table from './embeds.json';
import { useStore } from '../store.ts';

/** probs: match scores with faces, hands and people removed. human: share of the frame they explained. */
export type Result = { probs: number[]; human: number; ms: number };

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, { resolve: (r: Result) => void; reject: (e: Error) => void }>();
let nextId = 0;

worker.onmessage = (e) => {
  const m = e.data;
  const ai = useStore.getState().ai;
  if (m.type === 'progress') useStore.setState({ ai: { ...ai, status: 'loading', progress: m.progress } });
  else if (m.type === 'ready') useStore.setState({ ai: { ...ai, status: 'ready', progress: 1, device: m.device, model: m.model } });
  else if (m.type === 'result') {
    useStore.setState({ ai: { ...ai, ms: m.ms } });
    pending.get(m.id)?.resolve({ probs: m.probs, human: m.human, ms: m.ms });
    pending.delete(m.id);
  } else if (m.type === 'error') {
    if (m.id >= 0) { pending.get(m.id)?.reject(new Error(m.error)); pending.delete(m.id); }
    else useStore.setState({ ai: { ...ai, status: 'error', error: m.error } });
  }
};

/** Starts the model download immediately, so it is ready by the time someone reaches the scanner. */
export function loadModel() {
  if (useStore.getState().ai.status !== 'idle') return;
  useStore.setState({ ai: { ...useStore.getState().ai, status: 'loading' } });
  worker.postMessage({ type: 'load', cpu: new URLSearchParams(location.search).has('cpu') }); // ?cpu forces the WebAssembly path
}

export function classify(data: ImageData): Promise<Result> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ type: 'classify', id, data }, [data.data.buffer]);
  });
}

export const CLASSES = labels.classes;

/** Above this share of face/hand/person, the frame shows only a person: say so instead of guessing. */
export const PERSON_CUTOFF: number = table.personCutoff;

/** Winning stream and its score, or 'none' when the frame is essentially just a person. */
export function verdict(probs: number[], human: number): [string, number] {
  return human >= PERSON_CUTOFF ? ['none', human] : streamScores(probs)[0];
}

export function streamScores(probs: number[]) {
  const s: Record<string, number> = {};
  CLASSES.forEach((c, i) => (s[c.stream] = (s[c.stream] ?? 0) + probs[i]));
  return Object.entries(s).sort((a, b) => b[1] - a[1]);
}

/** Best class inside the winning stream. */
export function bestIn(stream: string, probs: number[]) {
  let best = -1;
  CLASSES.forEach((c, i) => { if (c.stream === stream && (best < 0 || probs[i] > probs[best])) best = i; });
  return CLASSES[best];
}

export function topClasses(probs: number[], n = 6) {
  return probs.map((p, i) => ({ id: CLASSES[i].id, p })).sort((a, b) => b.p - a.p).slice(0, n);
}

/** Draws the centred square of `src` (the aiming box) into a 256 × 256 frame for the model. */
export function cropSquare(src: CanvasImageSource, w: number, h: number, frac = 1, size = 256) {
  const c = new OffscreenCanvas(size, size);
  const g = c.getContext('2d')!;
  const side = Math.min(w, h) * frac;
  g.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  return g.getImageData(0, 0, size, size);
}

export function toDataURL(data: ImageData) {
  const c = document.createElement('canvas');
  c.width = data.width; c.height = data.height;
  c.getContext('2d')!.putImageData(data, 0, 0);
  return c.toDataURL('image/jpeg', 0.85);
}
