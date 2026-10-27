// Offline step: encode every label prompt once (averaged per class), then score candidate vision
// models on three test sets and pick the person-only cutoff. The browser only runs the vision tower.
//   node scripts/embed.mjs                              -> evaluate the candidates
//   node scripts/embed.mjs <model> <dtype> --write      -> evaluate one + write src/ai/embeds.json
//
// Test sets (all from eval/images, labelled by filename prefix):
//   clean  the photos as downloaded
//   aug    webcam-like degradations: dim + noisy, soft + compressed, off-centre + tilted
//   held   each e-waste photo pasted over a face, selfie, open hand or desk scene, the way people
//          hold an item up to a webcam. This is where face/hand classes used to steal the score.
import fs from 'node:fs';
import sharp from 'sharp';
import {
  AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor,
  CLIPVisionModelWithProjection, RawImage,
} from '@huggingface/transformers';

const L = JSON.parse(fs.readFileSync('src/ai/labels.json', 'utf8'));
const IMG = 'eval/images';
const HUMAN = L.classes.map((c) => !!c.human);
const TRUTH = {
  battery: 'battery', powerbank: 'battery', cable: 'cable', casing: 'casing', cfl: 'lamp', charger: 'charger',
  earphones: 'audio', speaker: 'audio', hdd: 'storage', keyboard: 'peripheral', mouse: 'peripheral', remote: 'peripheral',
  gamepad: 'peripheral', calculator: 'peripheral', usbdrive: 'peripheral', router: 'peripheral', camera: 'peripheral',
  laptop: 'laptop', monitor: 'display', pcb: 'pcb', phone: 'phone', tablet: 'phone', smartwatch: 'phone', neg: 'none',
};
const truthOf = (f) => TRUTH[f.split(/[_-]/)[0]];
const files = fs.readdirSync(IMG).filter((f) => f.endsWith('.jpg')).sort();
for (const f of files) if (!truthOf(f)) throw new Error(`no label for ${f}`);

const raw = async (p) => {
  const { data, info } = await p.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, info.channels);
};

async function buildSets() {
  const clean = [], aug = [], held = [];
  for (const f of files) {
    const p = `${IMG}/${f}`, t = truthOf(f), m = await sharp(p).metadata();
    clean.push([f, t, await RawImage.read(p)]);
    const side = Math.floor(Math.min(m.width, m.height) * 0.72);
    aug.push(
      [f, t, await raw(sharp(await sharp(p).modulate({ brightness: 0.45, saturation: 0.7 }).blur(0.6).jpeg({ quality: 35 }).toBuffer()))],
      [f, t, await raw(sharp(await sharp(p).resize(96).resize(320).jpeg({ quality: 25 }).toBuffer()))],
      [f, t, await raw(sharp(p).extract({ left: Math.floor((m.width - side) * 0.85), top: Math.floor((m.height - side) * 0.15), width: side, height: side }).rotate(14, { background: '#777' }))],
    );
  }
  const backs = files.filter((f) => /^(neg_face_0|neg_face_1|neg-selfie_0|neg-selfie_2|neg_hand_0|neg_hand_1|neg-webcam_0)/.test(f));
  const items = files.filter((f) => truthOf(f) !== 'none' && !f.includes('-held') && !/hand|held/.test(f));
  for (const b of backs) {
    const bg = await sharp(`${IMG}/${b}`).resize(400, 400, { fit: 'cover' }).toBuffer();
    for (const [i, f] of items.entries()) {
      const s = 230 + (i % 3) * 25; // item fills 57–70 % of the frame
      const obj = await sharp(`${IMG}/${f}`).resize(s, s, { fit: 'cover' }).toBuffer();
      const top = i % 2 ? 400 - s - 10 : Math.floor((400 - s) / 2); // centred, or low with the face visible above
      held.push([`${b}+${f}`, truthOf(f), await raw(sharp(bg).composite([{ input: obj, left: Math.floor((400 - s) / 2), top }]))]);
    }
  }
  return { clean, aug, held };
}

const norm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s); return v.map((x) => x / s); };

async function classEmbeds(id) {
  const tok = await AutoTokenizer.from_pretrained(id);
  const text = await CLIPTextModelWithProjection.from_pretrained(id, { dtype: 'fp32' });
  const out = [];
  for (const c of L.classes) {
    const tpl = c.neg ? L.negTemplates : L.templates;
    const prompts = c.phrases.flatMap((p) => tpl.map((t) => t.replace('{}', p)));
    const e = (await text(tok(prompts, { padding: 'max_length', truncation: true }))).text_embeds.normalize(2, -1).tolist();
    out.push(norm(e[0].map((_, j) => e.reduce((s, r) => s + r[j], 0) / e.length)));
  }
  await text.dispose();
  return out;
}

/** Same rule as src/ai/classifier.ts: faces, hands and people soak up probability, then drop out. */
function decide(P, cutoff) {
  const human = P.reduce((s, p, i) => s + (HUMAN[i] ? p : 0), 0);
  if (cutoff !== null && human >= cutoff) return 'none';
  const s = {};
  L.classes.forEach((c, i) => { if (cutoff === null || !HUMAN[i]) s[c.stream] = (s[c.stream] ?? 0) + P[i]; });
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
}

const CUTOFFS = [null, 0.9, 0.95, 0.97, 0.98, 0.99, 0.995];

async function evaluate(id, dtype, T, sets) {
  const proc = await AutoProcessor.from_pretrained(id);
  const vis = await CLIPVisionModelWithProjection.from_pretrained(id, { dtype });
  const res = {};
  for (const [name, set] of Object.entries(sets)) {
    const P = [];
    for (const [, , img] of set) {
      const v = (await vis(await proc(img))).image_embeds.normalize(2, -1).tolist()[0];
      const logits = T.map((c) => 100 * c.reduce((s, x, j) => s + x * v[j], 0));
      const m = Math.max(...logits), ex = logits.map((l) => Math.exp(l - m)), Z = ex.reduce((a, b) => a + b);
      P.push(ex.map((e) => e / Z));
    }
    res[name] = CUTOFFS.map((cut) => {
      let ok = 0; const miss = [];
      set.forEach(([f, t], k) => { const d = decide(P[k], cut); if (d === t) ok++; else miss.push(`${f}→${d}`); });
      return { cut, ok, n: set.length, miss };
    });
  }
  await vis.dispose();
  console.log(`\n${id} [${dtype}]`);
  for (const [k, cut] of CUTOFFS.entries()) {
    const row = Object.entries(res).map(([name, r]) => `${name} ${(100 * r[k].ok / r[k].n).toFixed(1)}%`).join('  ');
    console.log(`  ${cut === null ? 'old rule (faces compete)' : `ignore people, cutoff ${cut}`}`.padEnd(36), row);
  }
  return res;
}

const args = process.argv.slice(2);
const [model, dtype] = args.filter((a) => !a.startsWith('--'));
const write = args.includes('--write');
const runs = model ? [[model, dtype ?? 'fp32']] : [['Xenova/mobileclip_s0', 'fp32'], ['Xenova/mobileclip_s2', 'fp16']];
const sets = await buildSets();
console.log(Object.entries(sets).map(([k, v]) => `${k}: ${v.length} images`).join(', '));
for (const [id, dt] of runs) {
  const T = await classEmbeds(id);
  const res = await evaluate(id, dt, T, sets);
  const cutArg = args.find((a) => a.startsWith('--cutoff='));
  if (write) {
    // --slot=gpu|cpu: the browser runs the gpu model on WebGPU and the cpu model on the WebAssembly fallback.
    const slot = (args.find((a) => a.startsWith('--slot=')) ?? '--slot=gpu').split('=')[1];
    const cut = cutArg ? +cutArg.split('=')[1] : 0.9;
    const k = CUTOFFS.indexOf(cut);
    const pick = (name) => ({ n: res[name][k].n, acc: `${(100 * res[name][k].ok / res[name][k].n).toFixed(1)} %` });
    const file = 'src/ai/embeds.json';
    const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const out = { classes: L.classes.map((c) => c.id), personCutoff: cut, models: { ...(prev.models ?? {}) } };
    if (prev.classes && prev.classes.join() !== out.classes.join()) out.models = {}; // labels changed: other slot is stale
    out.models[slot] = {
      id, dtype: dt,
      name: id.split('/')[1].replace(/^mobileclip_(\w+)$/, (_, v) => `MobileCLIP-${v.toUpperCase()}`),
      eval: { clean: pick('clean'), degraded: pick('aug'), held: pick('held') },
      embeds: T.map((r) => r.map((x) => +x.toFixed(5))),
    };
    fs.writeFileSync(file, JSON.stringify(out));
    console.log(`wrote ${slot} slot of ${file} with cutoff ${cut}`);
    for (const name of Object.keys(res)) console.log(`  ${name} misses:`, res[name][k].miss.slice(0, 25).join('  '));
  }
}
