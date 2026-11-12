// Importe les photos de fond choisies (Wikimedia Commons) dans l'app :
//   node scripts/import-backgrounds.mjs <dossier des choix>
// Le dossier contient <id>.jpg (photo) et <id>.json (titre, page, licence, auteur) pour chaque lieu.
// Sortie : src/assets/bg/<id>.webp (1280 px de large, compressee) et src/assets/bg/credits.json (attributions).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Usage : node scripts/import-backgrounds.mjs <dossier des choix>');
  process.exit(1);
}
const out = path.resolve('src/assets/bg');
fs.mkdirSync(out, { recursive: true });

const stripHtml = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const creditsPath = path.join(out, 'credits.json');
const credits = fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, 'utf8')) : {};

let n = 0;
for (const file of fs.readdirSync(src).filter((f) => f.endsWith('.json')).sort()) {
  const meta = JSON.parse(fs.readFileSync(path.join(src, file), 'utf8'));
  const id = meta.id ?? file.replace(/\.json$/, '');
  const jpg = path.join(src, `${id}.jpg`);
  if (!fs.existsSync(jpg)) { console.warn(`! ${id} : photo absente`); continue; }
  const dest = path.join(out, `${id}.webp`);
  const info = await sharp(jpg).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 62, effort: 5 }).toFile(dest);
  credits[id] = {
    title: stripHtml(meta.title).replace(/^File:/, ''),
    page: meta.pageUrl,
    author: stripHtml(meta.artist) || stripHtml(meta.credit),
    license: stripHtml(meta.license),
    licenseUrl: meta.licenseUrl || '',
  };
  n++;
  console.log(`${id.padEnd(18)} ${String(Math.round(info.size / 1024)).padStart(4)} Ko  ${credits[id].license}  ${credits[id].author}`);
}
const sorted = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(creditsPath, JSON.stringify(sorted, null, 1) + '\n');
console.log(`${n} photos importees -> ${path.relative(process.cwd(), out)}`);
