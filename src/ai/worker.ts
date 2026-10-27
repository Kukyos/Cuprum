// Runs the vision half of the image model off the main thread. Text embeddings for every label
// were computed offline (scripts/embed.mjs), so each frame costs one image embedding + a dot product.
// WebGPU runs the larger MobileCLIP-S2; the CPU fallback runs the much lighter MobileCLIP-S0.
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env, type Processor, type PreTrainedModel } from '@huggingface/transformers';
import table from './embeds.json';
import labels from './labels.json';

env.allowLocalModels = false;

type Slot = keyof typeof table.models;
let processor: Processor | null = null;
let vision: PreTrainedModel | null = null;
let T: Float32Array[] = [];
const HUMAN = table.classes.map((id) => !!labels.classes.find((c) => c.id === id && 'human' in c));

type Msg = { type: 'load'; cpu?: boolean } | { type: 'classify'; id: number; data: ImageData };
type Gpu = { requestAdapter(): Promise<{ features: Set<string> } | null> };

/** WebGPU (fp16 shaders if available) for the GPU model, WebAssembly for the CPU model. */
async function pickBackend(cpu = false): Promise<{ slot: Slot; device: 'webgpu' | 'wasm'; dtype: 'fp16' | 'fp32' }> {
  if (!cpu) try {
    const adapter = await (navigator as Navigator & { gpu?: Gpu }).gpu?.requestAdapter();
    if (adapter) return { slot: 'gpu', device: 'webgpu', dtype: adapter.features.has('shader-f16') ? 'fp16' : 'fp32' };
  } catch { /* no WebGPU */ }
  // ponytail: 8-bit weights wreck MobileCLIP accuracy (12 % vs 98.6 % in scripts/embed.mjs), so CPU stays fp32
  return { slot: 'cpu', device: 'wasm', dtype: 'fp32' };
}

const progress_callback = (() => {
  const files = new Map<string, { loaded: number; total: number }>();
  return (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== 'progress' || !p.file) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
    let l = 0, t = 0;
    for (const f of files.values()) { l += f.loaded; t += f.total; }
    postMessage({ type: 'progress', progress: t ? l / t : 0 });
  };
})();

async function use(slot: Slot, device: 'webgpu' | 'wasm', dtype: 'fp16' | 'fp32') {
  const m = table.models[slot];
  processor = await AutoProcessor.from_pretrained(m.id, { progress_callback });
  vision = await CLIPVisionModelWithProjection.from_pretrained(m.id, { device, dtype, progress_callback });
  T = m.embeds.map((r) => Float32Array.from(r));
  await embed(new ImageData(64, 64)); // warm-up: compiles shaders so the first real frame is fast
}

async function load(cpu?: boolean) {
  let b = await pickBackend(cpu);
  try {
    await use(b.slot, b.device, b.dtype);
  } catch (err) {
    if (b.device === 'wasm') throw err;
    b = { slot: 'cpu', device: 'wasm', dtype: 'fp32' };
    await use(b.slot, b.device, b.dtype);
  }
  const m = table.models[b.slot];
  postMessage({ type: 'ready', model: m.name, slot: b.slot, device: `${b.device === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WebAssembly)'}, ${b.dtype}` });
}

async function embed(data: ImageData) {
  const img = new RawImage(data.data, data.width, data.height, 4).rgb();
  const out = await vision!(await processor!(img));
  const v = out.image_embeds.data as Float32Array;
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n);
  return v.map((x) => x / n);
}

async function classify(id: number, data: ImageData) {
  const t0 = performance.now();
  const v = await embed(data);
  const logits = T.map((row) => {
    let s = 0;
    for (let i = 0; i < row.length; i++) s += row[i] * v[i];
    return 100 * s;
  });
  const m = Math.max(...logits);
  const ex = logits.map((l) => Math.exp(l - m));
  const z = ex.reduce((a, b) => a + b, 0);
  // Faces, hands and people compete (so they soak up the person holding the item), then drop out:
  // `human` is how much of the frame they explained, `probs` is renormalised over everything else.
  const p = ex.map((e) => e / z);
  const human = p.reduce((s, x, i) => s + (HUMAN[i] ? x : 0), 0);
  const probs = p.map((x, i) => (HUMAN[i] ? 0 : x / Math.max(1e-9, 1 - human)));
  postMessage({ type: 'result', id, probs, human, ms: performance.now() - t0 });
}

let queue: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent<Msg>) => {
  const msg = e.data;
  queue = queue.then(async () => {
    try {
      if (msg.type === 'load') await load(msg.cpu);
      else await classify(msg.id, msg.data);
    } catch (err) {
      postMessage({ type: 'error', id: msg.type === 'classify' ? msg.id : -1, error: String((err as Error)?.message ?? err) });
    }
  });
};
