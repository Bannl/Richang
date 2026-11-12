// Couverture du vocabulaire par les dialogues : combien des 2000 mots apparaissent
// reellement comme MOT (segmentation) dans une replique, par theme et par palier.
// Usage : node scripts/coverage-dialogues.mjs [--missing <themeId>]
import fs from 'node:fs';

const words = JSON.parse(fs.readFileSync('src/data/generated/words.json', 'utf8'));
const themes = JSON.parse(fs.readFileSync('src/data/generated/themes.json', 'utf8'));
const DIAL = JSON.parse(fs.readFileSync('src/data/generated/dialogues.json', 'utf8'));

const dict = new Map();
for (const w of words) if (!dict.has(w.hanzi)) dict.set(w.hanzi, w.rank);
const isHan = (c) => /\p{Script=Han}/u.test(c);
export function segment(zh) {
  const c = [...zh]; const o = []; let i = 0;
  while (i < c.length) {
    if (!isHan(c[i])) { i++; continue; }
    let m = false;
    for (let l = Math.min(5, c.length - i); l >= 1; l--) {
      const cand = c.slice(i, i + l).join('');
      if (dict.has(cand)) { o.push(dict.get(cand)); i += l; m = true; break; }
    }
    if (!m) i++;
  }
  return o;
}

const used = new Set();
for (const k of Object.keys(DIAL)) for (const ex of DIAL[k]) for (const s of ['enemy', 'player'])
  if (ex[s]?.zh) for (const r of segment(ex[s].zh)) used.add(r);

const tName = Object.fromEntries(themes.map((t) => [t.id, t.labelEn || t.label]));
const missingArg = process.argv.indexOf('--missing');
if (missingArg >= 0) {
  const th = process.argv[missingArg + 1];
  const miss = words.filter((w) => w.theme === th && !used.has(w.rank)).sort((a, b) => a.rank - b.rank);
  console.log(`${tName[th] || th} : ${miss.length} mots non couverts`);
  console.log(miss.map((w) => `${w.rank} ${w.hanzi} (${w.pinyin})`).join('\n'));
  process.exit(0);
}

const byTheme = {}; for (const w of words) (byTheme[w.theme] ??= []).push(w);
const byTier = {}; for (const w of words) { byTier[w.tier] ??= { t: 0, u: 0 }; byTier[w.tier].t++; if (used.has(w.rank)) byTier[w.tier].u++; }
console.log(`COUVERTURE DIALOGUES : ${used.size}/${words.length} mots (${(100 * used.size / words.length).toFixed(1)}%)\n`);
console.log('Par palier :');
for (const t of Object.keys(byTier).sort()) console.log(`  palier ${t} : ${byTier[t].u}/${byTier[t].t}`);
console.log('\nPar theme :');
for (const th of Object.keys(byTheme)) {
  const ws = byTheme[th]; const c = ws.filter((w) => used.has(w.rank)).length;
  console.log(`  ${(tName[th] || th).padEnd(22)} ${String(c).padStart(4)}/${String(ws.length).padEnd(4)} (manque ${ws.length - c})`);
}
