// Genere src/data/generated/ : words.json, themes.json, hanzi-t{1..6}.json (traits), hanzi-index.json
import fs from 'node:fs';
import path from 'node:path';
import { parseMasterFile, tierOfRank } from './lib/master.mjs';
import { pinyinToZhuyin } from './lib/pinyin.mjs';

const OUT = 'src/data/generated';
fs.mkdirSync(OUT, { recursive: true });

let words;
if (fs.existsSync('data/words-final.json')) {
  words = JSON.parse(fs.readFileSync('data/words-final.json', 'utf8'));
} else {
  console.warn('data/words-final.json absent : jeu provisoire genere depuis la liste maitresse (sans pinyin).');
  words = parseMasterFile('data/master-t1-t4.txt').map((w, i) => ({
    rank: i + 1, tier: tierOfRank(i + 1), hanzi: w.hanzi, pinyin: '', zhuyin: [], pos: '', fr: ['(à compléter)'], theme: w.theme,
  }));
}
for (const w of words) {
  if ((!w.zhuyin || !w.zhuyin.length) && w.pinyin) w.zhuyin = pinyinToZhuyin(w.pinyin) ?? [];
}
fs.writeFileSync(path.join(OUT, 'words.json'), JSON.stringify(words));
fs.copyFileSync('data/themes.json', path.join(OUT, 'themes.json'));
fs.writeFileSync(path.join(OUT, 'dialogues.json'), fs.existsSync('data/dialogues-final.json') ? fs.readFileSync('data/dialogues-final.json', 'utf8') : '{}');
fs.writeFileSync(path.join(OUT, 'scenes.json'), fs.existsSync('data/scenes-final.json') ? fs.readFileSync('data/scenes-final.json', 'utf8') : '{}');

const dataDir = 'node_modules/hanzi-writer-data';
const seen = new Set();
const index = {};
const missing = [];
const maxTier = Math.max(7, ...words.map((w) => w.tier ?? 1)); // palier 7 toujours ecrit (import statique de src/data/hanzi.ts)
for (let t = 1; t <= maxTier; t++) {
  const bundle = {};
  for (const w of words) {
    if (w.tier !== t) continue;
    for (const ch of w.hanzi) {
      if (!/\p{Script=Han}/u.test(ch) || seen.has(ch)) continue;
      seen.add(ch);
      const f = path.join(dataDir, ch + '.json');
      if (!fs.existsSync(f)) { missing.push(ch); continue; }
      bundle[ch] = JSON.parse(fs.readFileSync(f, 'utf8'));
      index[ch] = t;
    }
  }
  fs.writeFileSync(path.join(OUT, `hanzi-t${t}.json`), JSON.stringify(bundle));
  console.log(`hanzi-t${t}.json : ${Object.keys(bundle).length} caractères`);
}
fs.writeFileSync(path.join(OUT, 'hanzi-index.json'), JSON.stringify(index));
if (missing.length) console.warn('Caractères sans données de traits :', missing.join(' '));
console.log(`words.json : ${words.length} mots`);
