import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'apps', 'web', 'public');
const logo = path.join(publicDir, 'logo_w.svg');
const brand = '#5a5e0b';

// The white mark is cropped from the supplied wide logo_w.svg. The wordmark
// is intentionally omitted from the square app icon so it remains legible.
const rasterMark = await sharp(logo)
  .extract({ left: 14, top: 80, width: 324, height: 367 })
  .resize(390, 390, { fit: 'contain' })
  .png()
  .toBuffer();
const { data: markPixels, info: markInfo } = await sharp(rasterMark).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let pixel = 0; pixel < markPixels.length; pixel += markInfo.channels) {
  if (markPixels[pixel] < 24 && markPixels[pixel + 1] < 24 && markPixels[pixel + 2] < 24) markPixels[pixel + 3] = 0;
}
const mark = await sharp(markPixels, { raw: markInfo }).png().toBuffer();

async function makeIcon(size) {
  const base = await sharp({
    create: { width: 512, height: 512, channels: 4, background: brand },
  }).composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
  return size === 512 ? base : sharp(base).resize(size, size).png().toBuffer();
}

await writeFile(path.join(publicDir, 'pwa-192.png'), await makeIcon(192));
await writeFile(path.join(publicDir, 'pwa-512.png'), await makeIcon(512));

const sizes = [16, 32, 48, 64];
const images = await Promise.all(sizes.map(async (size) => sharp(await makeIcon(size)).png().toBuffer()));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(0, 0);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  const size = sizes[index];
  directory.writeUInt8(size === 256 ? 0 : size, entry);
  directory.writeUInt8(size === 256 ? 0 : size, entry + 1);
  directory.writeUInt8(0, entry + 2);
  directory.writeUInt8(0, entry + 3);
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([directory, ...images]));

const source = await readFile(logo, 'utf8');
if (!source.startsWith('<svg')) throw new Error('logo_w.svg não pôde ser lida como SVG.');
console.log('Ícones PWA e favicon gerados a partir de apps/web/public/logo_w.svg.');
