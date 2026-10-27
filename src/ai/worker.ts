// Runs the vision half of the image model off the main thread. Text embeddings for every label
// were computed offline (scripts/embed.mjs), so each frame costs one image embedding + a dot product.
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env, type Processor, type PreTrainedModel } from '@huggingface/transformers';
import table from './embeds.json';

env.allowLocalModels = false;

let processor: Processor | null = null;
let vision: PreTrainedModel | null = null;
const T = table.embeds.map((r) => Float32Array.from(r));

type Msg = { type: 'load'; cpu?: boolean } | { type: 'classify'; id: number; data: ImageData };
type Gpu = { requestAdapter(): Promise<{ features: Set<string> } | null> };

/** WebGPU with fp16 shaders if available, WebGPU fp32 otherwise, CPU (WebAssembly) as the fallback. */
async function pickBackend(cpu = false): Promise<{ device: 'webgpu' | 'wasm'; dtype: 'fp16' | 'fp32' }> {
  if (!cpu) try {
    const adapter = await (navigator as Navigator & { gpu?: Gpu }).gpu?.requestAdapter();
    if (adapter) return { device: 'webgpu', dtype: adapter.features.has('shader-f16') ? 'fp16' : 'fp32' };
  } catch { /* no WebGPU */ }
  // ponytail: 8-bit weights wreck MobileCLIP accuracy (12 % vs 98.6 % in scripts/embed.mjs), so CPU stays fp32
  return { device: 'wasm', dtype: 'fp32' };
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

async function load(cpu?: boolean) {
  let { device, dtype } = await pickBackend(cpu);
  processor = await AutoProcessor.from_pretrained(table.model, { progress_callback });
  try {
    vision = await CLIPVisionModelWithProjection.from_pretrained(table.model, { device, dtype, progress_callback });
    await embed(new ImageData(64, 64)); // warm-up: compiles shaders so the first real frame is fast
  } catch (err) {
    if (device === 'wasm') throw err;
    ({ device, dtype } = { device: 'wasm', dtype: 'fp32' });
    vision = await CLIPVisionModelWithProjection.from_pretrained(table.model, { device, dtype, progress_callback });
    await embed(new ImageData(64, 64));
  }
  postMessage({ type: 'ready', device: `${device === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WebAssembly)'}, ${dtype}` });
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
  postMessage({ type: 'result', id, probs: ex.map((e) => e / z), ms: performance.now() - t0 });
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
