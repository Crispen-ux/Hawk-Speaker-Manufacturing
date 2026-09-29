import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(root, "public", "icons");

const BG = "#f7f8fa";

const source = await readFile(path.join(root, "public", "cretek-icon.svg"), "utf8");
const inner = source.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

function frame(size, logoScale) {
  const logoSize = Math.round(size * logoScale);
  const offset = Math.round((size - logoSize) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${logoSize / 200})">${inner}</g>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, scale: 0.8 },
  { file: "icon-512.png", size: 512, scale: 0.8 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.6 },
  { file: "apple-touch-icon-180.png", size: 180, scale: 0.72 },
];

await mkdir(OUT, { recursive: true });

for (const t of targets) {
  await sharp(Buffer.from(frame(t.size, t.scale))).png().toFile(path.join(OUT, t.file));
  console.log("wrote", t.file, `${t.size}x${t.size}`);
}
