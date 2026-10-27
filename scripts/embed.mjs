// Offline step: encode every label prompt once, average per class, and score candidate
// vision models against eval/images. The browser then only needs the vision tower.
//   node scripts/embed.mjs                     -> evaluate all candidates
//   node scripts/embed.mjs <model> <dtype> --write  -> evaluate one + write src/ai/embeds.json
import fs from 'node:fs';
import sharp from 'sharp';
import {
  AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor,
  CLIPVisionModelWithProjection, RawImage,
} from '@huggingface/transformers';

const L = JSON.parse(fs.readFileSync('src/ai/labels.json', 'utf8'));
const IMG = 'eval/images';
const truthOf = (f) => {
  const p = f.split('_')[0];
  return { battery: 'battery', cable: 'cable', casing: 'casing', cfl: 'lamp', charger: 'charger',
    earphones: 'audio', hdd: 'storage', keyboard: 'peripheral', laptop: 'laptop', monitor: 'display',
    mouse: 'peripheral', neg: 'none', pcb: 'pcb', phone: 'phone', remote: 'peripheral' }[p];
};

// --aug: webcam-like degradations (dim + noisy, soft + compressed, off-centre + tilted).
const AUG = process.argv.includes('--aug');
async function variants(file) {
  if (!AUG) return [await RawImage.read(file)];
  const raw = async (p) => {
    const { data, info } = await p.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RawImage(new Uint8ClampedArray(data), info.width, info.height, info.channels);
  };
  const m = await sharp(file).metadata();
  const side = Math.floor(Math.min(m.width, m.height) * 0.72);
  return [
    await raw(sharp(await sharp(file).modulate({ brightness: 0.45, saturation: 0.7 }).blur(0.6).jpeg({ quality: 35 }).toBuffer())),
    await raw(sharp(await sharp(file).resize(96).resize(320).jpeg({ quality: 25 }).toBuffer())),
    await raw(sharp(file).extract({ left: Math.floor((m.width - side) * 0.85), top: Math.floor((m.height - side) * 0.15), width: side, height: side }).rotate(14, { background: '#777' })),
  ];
}

const norm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s); return v.map((x) => x / s); };

async function classEmbeds(id) {
  const tok = await AutoTokenizer.from_pretrained(id);
  const text = await CLIPTextModelWithProjection.from_pretrained(id, { dtype: 'fp32' });
  const out = [];
  for (const c of L.classes) {
    const tpl = c.neg ? L.negTemplates : L.templates;
    const prompts = c.phrases.flatMap((p) => tpl.map((t) => t.replace('{}', p)));
    const inp = tok(prompts, { padding: 'max_length', truncation: true });
    const e = (await text(inp)).text_embeds.normalize(2, -1).tolist();
    const mean = e[0].map((_, j) => e.reduce((s, r) => s + r[j], 0) / e.length);
    out.push(norm(mean));
  }
  await text.dispose();
  return out;
}

async function evaluate(id, dtype, T) {
  const proc = await AutoProcessor.from_pretrained(id);
  const vis = await CLIPVisionModelWithProjection.from_pretrained(id, { dtype });
  const files = fs.readdirSync(IMG).filter((f) => f.endsWith('.jpg')).sort();
  let ok = 0, t = 0, n = 0, conf = 0; const miss = [];
  for (const f of files) for (const img of await variants(`${IMG}/${f}`)) {
    n++;
    const t0 = performance.now();
    const v = (await vis(await proc(img))).image_embeds.normalize(2, -1).tolist()[0];
    t += performance.now() - t0;
    const logits = T.map((c) => 100 * c.reduce((s, x, j) => s + x * v[j], 0));
    const m = Math.max(...logits); const ex = logits.map((l) => Math.exp(l - m)); const Z = ex.reduce((a, b) => a + b);
    const stream = {};
    L.classes.forEach((c, i) => (stream[c.stream] = (stream[c.stream] ?? 0) + ex[i] / Z));
    const [top, p] = Object.entries(stream).sort((a, b) => b[1] - a[1])[0];
    const fine = L.classes[logits.indexOf(m)].id;
    conf += stream[truthOf(f)] ?? 0;
    if (top === truthOf(f)) ok++; else miss.push(`${f}→${top}(${(p * 100).toFixed(0)}%,${fine})`);
  }
  await vis.dispose();
  console.log(`\n${id} [${dtype}] stream acc ${ok}/${n} = ${(100 * ok / n).toFixed(1)}%  mean p(true) ${(100 * conf / n).toFixed(1)}%  ${(t / n).toFixed(0)} ms/img`);
  console.log('  miss:', miss.join('  '));
  return ok / files.length;
}

const [model, dtype, write] = process.argv.slice(2).filter((a) => a !== '--aug');
const runs = model ? [[model, [dtype ?? 'fp32']]] : [
  ['Xenova/mobileclip_s2', ['fp16']],
  ['Xenova/clip-vit-base-patch16', ['q8']],
  ['Xenova/mobileclip_s0', ['fp32', 'fp16']],
];
for (const [id, dtypes] of runs) {
  const T = await classEmbeds(id);
  for (const d of dtypes) await evaluate(id, d, T);
  if (write) {
    fs.writeFileSync('src/ai/embeds.json', JSON.stringify({
      model: id,
      name: id.split('/')[1].replace(/^mobileclip_(\w+)$/, (_, v) => `MobileCLIP-${v.toUpperCase()}`).replace(/^clip-vit-base-patch(\d+)$/, 'CLIP ViT-B/$1'),
      classes: L.classes.map((c) => c.id),
      embeds: T.map((r) => r.map((x) => +x.toFixed(5))),
    }));
    console.log('wrote src/ai/embeds.json');
  }
}
