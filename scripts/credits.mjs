// Re-finds Commons metadata for chosen eval images (matched by identical bytes) and copies them to public/samples.
import fs from 'node:fs';
const UA = { 'User-Agent': 'CuprumEval/1.0 (student project)' };
const want = {
  'pcb_motherboard_1.jpg': ['computer motherboard', 'motherboard'], 'pcb_phone_0.jpg': ['smartphone logic board', 'phone-board'],
  'battery_liion_0.jpg': ['lithium-ion battery cell', 'li-ion-cell'], 'battery_alkaline_1.jpg': ['AA batteries', 'aa-battery'],
  'cable_0.jpg': ['electrical cable coil', 'cable'], 'phone_2.jpg': ['smartphone', 'phones'], 'hdd_0.jpg': ['hard disk drive', 'hard-drive'],
  'charger_1.jpg': ['phone charger adapter', 'charger'],
};
const old = JSON.parse(fs.readFileSync('eval/images/credits.json', 'utf8'));
const extra = { 'pcb_ram_2.jpg': 'ram', 'pcb_gpu_a_0.jpg': 'graphics-card', 'cfl_2.jpg': 'cfl-bulb', 'neg_mug_0.jpg': 'mug' };
const out = {};
fs.mkdirSync('public/samples', { recursive: true });
for (const [f, slug] of Object.entries(extra)) { fs.copyFileSync(`eval/images/${f}`, `public/samples/${slug}.jpg`); out[slug] = old[f]; }
for (const [f, [q, slug]] of Object.entries(want)) {
  await new Promise((r) => setTimeout(r, 5000));
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640`;
  const txt = await (await fetch(url, { headers: UA })).text();
  if (!txt.startsWith('{')) { console.log(f, 'rate-limited'); continue; }
  const local = fs.readFileSync(`eval/images/${f}`);
  const pages = Object.values(JSON.parse(txt).query?.pages ?? {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/jpeg|png/.test(ii.mime)) continue;
    await new Promise((r) => setTimeout(r, 800));
    const buf = Buffer.from(await (await fetch(ii.thumburl, { headers: UA })).arrayBuffer());
    if (!buf.equals(local)) continue;
    const m = ii.extmetadata ?? {};
    out[slug] = { title: p.title, page: ii.descriptionurl, author: (m.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim(), license: m.LicenseShortName?.value ?? '' };
    fs.copyFileSync(`eval/images/${f}`, `public/samples/${slug}.jpg`);
    break;
  }
  console.log(f, out[slug] ? 'ok' : 'no match');
}
fs.writeFileSync('src/data/samples.json', JSON.stringify(out, null, 1));
