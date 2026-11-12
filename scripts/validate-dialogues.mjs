// Valide data/dialogues/*.json (pinyin aligne, caracteres traditionnels, longueur, couverture du vocabulaire)
// et ecrit data/dialogues-final.json : { "<situation>": [ { enemy, player }, ... ] }
import fs from 'node:fs';
import path from 'node:path';
import { findSimplified } from './lib/master.mjs';
import { splitSyllables } from './lib/pinyin.mjs';

const words = JSON.parse(fs.readFileSync('data/words-final.json', 'utf8'));
const dict = new Map(words.map((w) => [w.hanzi, w.rank]));
const isHan = (c) => /\p{Script=Han}/u.test(c);
const MAX_LEN = 5;

function segment(zh) {
  const chars = [...zh];
  const out = [];
  let i = 0;
  while (i < chars.length) {
    if (!isHan(chars[i])) { out.push({ text: chars[i], rank: null }); i++; continue; }
    let hit = false;
    for (let len = Math.min(MAX_LEN, chars.length - i); len >= 1; len--) {
      const cand = chars.slice(i, i + len).join('');
      if (dict.has(cand)) { out.push({ text: cand, rank: dict.get(cand) }); i += len; hit = true; break; }
    }
    if (!hit) { out.push({ text: chars[i], rank: null }); i++; }
  }
  return out;
}

function checkLine(line, tag, errors, warns) {
  if (!line || !line.zh || !line.pinyin || !line.en || !line.fr) { errors.push(`${tag} : champs manquants`); return false; }
  const han = [...line.zh].filter(isHan);
  if (han.length < 2 || han.length > 16) warns.push(`${tag} : longueur ${han.length}`);
  const bad = findSimplified(line.zh);
  if (bad.length) { errors.push(`${tag} : simplifie [${bad.join('')}]`); return false; }
  const syl = splitSyllables(line.pinyin.replace(/[,，.。!！?？;；:：、]/g, ' '));
  if (!syl || syl.length !== han.length) { errors.push(`${tag} : pinyin ${syl ? syl.length : '?'} syllabes pour ${han.length} caracteres ("${line.pinyin}")`); return false; }
  const segs = segment(line.zh).filter((s) => isHan(s.text));
  const known = segs.filter((s) => s.rank !== null).length;
  if (known < 2) warns.push(`${tag} : ${known} mot(s) de la liste seulement : ${line.zh}`);
  return true;
}

const dir = 'data/dialogues';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
const out = {};
const errors = [];
const warns = [];
let total = 0;
for (const f of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { errors.push(`${f} : JSON invalide (${e.message})`); continue; }
  const id = data.situation ?? f.replace(/\.json$/, '');
  const kept = [];
  (data.exchanges ?? []).forEach((ex, i) => {
    const okE = checkLine(ex.enemy, `${id}#${i + 1} enemy`, errors, warns);
    const okP = checkLine(ex.player, `${id}#${i + 1} player`, errors, warns);
    if (okE && okP) kept.push({ enemy: ex.enemy, player: ex.player });
  });
  out[id] = kept;
  total += kept.length;
  console.log(`${id}: ${kept.length}/${(data.exchanges ?? []).length} echanges`);
}
fs.writeFileSync('data/dialogues-final.json', JSON.stringify(out));
fs.writeFileSync('data/dialogues-report.txt', [...errors.map((e) => 'ERREUR ' + e), ...warns.map((w) => 'AVERT  ' + w)].join('\n') + '\n');
console.log(`${files.length} situations · ${total} echanges · ${errors.length} erreur(s) · ${warns.length} avertissement(s) → data/dialogues-report.txt`);
