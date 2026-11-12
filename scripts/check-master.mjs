import fs from 'node:fs';
import { parseMasterFile, TIER_SIZES, findSimplified } from './lib/master.mjs';

const themes = JSON.parse(fs.readFileSync('data/themes.json', 'utf8')).map((t) => t.id);
const words = parseMasterFile('data/master-t1-t4.txt');
const seen = new Map();
let ok = true;
for (const w of words) {
  if (!themes.includes(w.theme)) { console.log('Theme inconnu :', w.theme, w.hanzi); ok = false; }
  if (seen.has(w.hanzi)) { console.log('DOUBLON :', w.hanzi, '(tier', seen.get(w.hanzi), 'et', w.tier + ')'); ok = false; }
  seen.set(w.hanzi, w.tier);
  const bad = findSimplified(w.hanzi);
  if (bad.length) { console.log('SIMPLIFIE ? :', w.hanzi, bad.join('')); ok = false; }
}
for (let t = 1; t <= 4; t++) {
  const n = words.filter((w) => w.tier === t).length;
  const flag = n === TIER_SIZES[t - 1] ? 'OK' : 'ATTENDU ' + TIER_SIZES[t - 1];
  console.log(`tier ${t}: ${n} mots (${flag})`);
  if (n !== TIER_SIZES[t - 1]) ok = false;
}
console.log(ok ? 'MASTER OK' : 'MASTER A CORRIGER');
