// One-off: rasterize public/icon.svg into the PNG sizes the manifest + iOS need.
// Run: node scripts/gen-icons.mjs   (sharp is installed with --no-save)
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = readFileSync(join(publicDir, "icon.svg"));

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  // iOS uses a fixed 180px apple-touch-icon; it applies its own rounding/mask,
  // so the full-bleed emerald tile is exactly what we want.
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  await sharp(svg).resize(size, size).png().toFile(join(publicDir, file));
  console.log(`wrote public/${file} (${size}x${size})`);
}
