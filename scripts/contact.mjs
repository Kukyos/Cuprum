// Contact sheet of eval images (optionally filtered by a prefix regex), for curating the test set.
//   node scripts/contact.mjs <out.jpg> [regex]
import sharp from 'sharp';
import fs from 'node:fs';
const [outFile, filter = '.'] = process.argv.slice(2);
const dir = 'eval/images';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && new RegExp(filter).test(f)).sort();
const S = 170, C = 8, R = Math.ceil(files.length / C);
const tiles = await Promise.all(files.map(async (f, i) => {
  const img = await sharp(`${dir}/${f}`).resize(S, S - 22, { fit: 'cover' }).toBuffer();
  const label = Buffer.from(`<svg width="${S}" height="22"><rect width="100%" height="100%" fill="#000"/><text x="4" y="15" font-size="12" fill="#fff" font-family="monospace">${f.replace('.jpg', '')}</text></svg>`);
  return [{ input: img, left: (i % C) * S, top: Math.floor(i / C) * S + 22 }, { input: label, left: (i % C) * S, top: Math.floor(i / C) * S }];
}));
await sharp({ create: { width: C * S, height: R * S, channels: 3, background: '#222' } }).composite(tiles.flat()).jpeg().toFile(outFile);
console.log(files.length, 'tiles');
