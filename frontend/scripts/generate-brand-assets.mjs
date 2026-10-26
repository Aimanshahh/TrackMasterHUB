import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Derives every browser icon and the optimised interface logo from the
 * official TrackMaster artwork. Run with: npm run brand:icons
 */
const root = fileURLToPath(new URL('..', import.meta.url));
const source = `${root}src/assets/brand/trackmaster-logo-original.png`;
const publicDir = `${root}public`;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const icons = [
  { size: 32, name: 'favicon-32.png' },
  { size: 192, name: 'favicon-192.png' },
  { size: 512, name: 'favicon-512.png' },
];

await mkdir(`${publicDir}/brand`, { recursive: true });

for (const { size, name } of icons) {
  await sharp(source)
    .trim({ threshold: 1 })
    .resize(size, size, { fit: 'contain', background: transparent })
    .png({ compressionLevel: 9 })
    .toFile(`${publicDir}/${name}`);
}

// iOS ignores transparency and composites onto black, so this icon is flattened
// onto the interface paper colour instead.
await sharp(source)
  .trim({ threshold: 1 })
  .resize(168, 168, { fit: 'contain', background: transparent })
  .extend({
    top: 6,
    bottom: 6,
    left: 6,
    right: 6,
    background: { r: 246, g: 245, b: 241, alpha: 1 },
  })
  .flatten({ background: { r: 246, g: 245, b: 241 } })
  .png({ compressionLevel: 9 })
  .toFile(`${publicDir}/apple-touch-icon.png`);

// Two derivatives of the same artwork: a 512px social/branding copy and the
// cached 512px asset bundled with the interface.
for (const target of [
  `${publicDir}/brand/trackmaster-logo.png`,
  `${root}src/assets/brand/trackmaster-logo.png`,
]) {
  await sharp(source)
    .trim({ threshold: 1 })
    .resize(512, 512, { fit: 'contain', background: transparent })
    .png({ compressionLevel: 9 })
    .toFile(target);
}

console.log('Brand assets written to public/ and src/assets/brand/');
