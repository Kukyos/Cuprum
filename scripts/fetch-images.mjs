// Pulls CC-licensed test photos from Wikimedia Commons into eval/images (+ credits.json).
import fs from 'node:fs';
const out = 'eval/images';
const UA = { 'User-Agent': 'CuprumEval/1.0 (student project; contact via github)' };
const queries = {
  gamepad: 'gamepad controller',
  'gamepad-held': 'person holding game controller',
  'phone-held': 'person holding smartphone',
  'battery-held': 'hand holding battery',
  'remote-held': 'hand holding remote control',
  'mouse-held': 'hand holding computer mouse',
  'pcb-held': 'person holding motherboard',
  'cable-held': 'hand holding cable plug',
  powerbank: 'power bank',
  tablet: 'tablet computer',
  calculator: 'pocket calculator',
  usbdrive: 'USB flash drive',
  router: 'wireless router',
  smartwatch: 'smartwatch',
  camera: 'digital compact camera',
  speaker: 'bluetooth speaker',
  'neg-selfie': 'selfie young man',
  'neg-webcam': 'person sitting at desk',
};
const credits = fs.existsSync(out+'/credits.json') ? JSON.parse(fs.readFileSync(out+'/credits.json','utf8')) : {};
for (const [cls, q] of Object.entries(queries)) {
  if (fs.existsSync(`${out}/${cls}_0.jpg`)) continue;
  await new Promise(r => setTimeout(r, 6000));
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640`;
  const res = await fetch(url, { headers: UA }); const txt = await res.text(); if (!txt.startsWith("{")) { console.log(cls, "rate-limited"); continue; } const j = JSON.parse(txt);
  const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  let n = 0;
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/jpeg|png/.test(ii.mime) || n >= 3) continue;
    const file = `${cls}_${n}.jpg`;
    await new Promise(r => setTimeout(r, 700));
    const r = await fetch(ii.thumburl, { headers: UA });
    if (!r.ok) continue;
    fs.writeFileSync(`${out}/${file}`, Buffer.from(await r.arrayBuffer()));
    const m = ii.extmetadata ?? {};
    credits[file] = {
      title: p.title, page: ii.descriptionurl,
      author: (m.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim(),
      license: m.LicenseShortName?.value ?? '',
    };
    n++;
  }
  console.log(cls, n);
}
fs.writeFileSync(`${out}/credits.json`, JSON.stringify(credits, null, 1));
