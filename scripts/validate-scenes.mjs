// Valide data/scenes/*.json (conversations coherentes) -> data/scenes-final.json
// { "<situation>": [ { id, situation, topic, lines:[{speaker,zh,pinyin,en,fr}], keywords:[<rang>] } ] }
import fs from 'node:fs';
import path from 'node:path';
import { findSimplified } from './lib/master.mjs';
import { splitSyllables } from './lib/pinyin.mjs';

const words = JSON.parse(fs.readFileSync('data/words-final.json', 'utf8'));
const dict = new Map(words.map((w) => [w.hanzi, w.rank]));
const wByRank = new Map(words.map((w) => [w.rank, w]));
const isHan = (c) => /\p{Script=Han}/u.test(c);
const MAX_LEN = 5;

function segment(zh) {
  const chars = [...zh]; const out = []; let i = 0;
  while (i < chars.length) {
    if (!isHan(chars[i])) { i++; continue; }
    let hit = false;
    for (let len = Math.min(MAX_LEN, chars.length - i); len >= 1; len--) {
      const cand = chars.slice(i, i + len).join('');
      if (dict.has(cand)) { out.push(dict.get(cand)); i += len; hit = true; break; }
    }
    if (!hit) i++;
  }
  return out;
}

function checkLine(line, tag, errors) {
  if (!line || !line.zh || !line.pinyin || !line.en || !line.fr) { errors.push(`${tag} : champs manquants`); return false; }
  if (line.speaker !== 'enemy' && line.speaker !== 'player') { errors.push(`${tag} : speaker invalide (${line.speaker})`); return false; }
  const han = [...line.zh].filter(isHan);
  if (han.length < 2 || han.length > 16) errors.push(`${tag} : longueur ${han.length} ("${line.zh}")`);
  const bad = findSimplified(line.zh);
  if (bad.length) { errors.push(`${tag} : simplifie [${bad.join('')}] ("${line.zh}")`); return false; }
  const syl = splitSyllables(line.pinyin.replace(/[,，.。!！?？;；:：、]/g, ' '));
  if (!syl || syl.length !== han.length) { errors.push(`${tag} : pinyin ${syl ? syl.length : '?'} syllabes pour ${han.length} caracteres ("${line.pinyin}")`); return false; }
  return true;
}

const dir = 'data/scenes';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
const out = {};
const errors = []; const warns = [];
let sceneCount = 0; let lineCount = 0; const coveredRanks = new Set();

for (const f of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { errors.push(`${f} : JSON invalide (${e.message})`); continue; }
  const sit = data.situation ?? f.replace(/\.json$/, '');
  for (const sc of data.scenes ?? []) {
    const tag = `${sit}/${sc.id ?? '?'}`;
    let ok = true;
    (sc.lines ?? []).forEach((l, i) => { if (!checkLine(l, `${tag}#${i + 1}`, errors)) ok = false; });
    if (!ok || !(sc.lines?.length >= 2)) { errors.push(`${tag} : scene rejetee`); continue; }
    // mots presents (segmentation) dans toute la scene
    const present = new Set();
    for (const l of sc.lines) for (const r of segment(l.zh)) present.add(r);
    const kwRanks = [];
    for (const kw of sc.keywords ?? []) {
      const r = dict.get(kw);
      if (r === undefined) { warns.push(`${tag} : mot-cle inconnu "${kw}" (ignore)`); continue; }
      if (!present.has(r)) { warns.push(`${tag} : mot-cle "${kw}" absent des repliques (ignore)`); continue; }
      if (!kwRanks.includes(r)) kwRanks.push(r);
    }
    if (kwRanks.length === 0) { errors.push(`${tag} : aucun mot-cle valide, scene rejetee`); continue; }
    kwRanks.forEach((r) => coveredRanks.add(r));
    (out[sit] ??= []).push({ id: sc.id, situation: sit, topic: sc.topic ?? '', lines: sc.lines.map((l) => ({ speaker: l.speaker, zh: l.zh, pinyin: l.pinyin, en: l.en, fr: l.fr })), keywords: kwRanks });
    sceneCount++; lineCount += sc.lines.length;
  }
}

fs.writeFileSync('data/scenes-final.json', JSON.stringify(out));
fs.writeFileSync('data/scenes-report.txt', [...errors.map((e) => 'ERREUR ' + e), ...warns.map((w) => 'AVERT  ' + w)].join('\n') + '\n');

// Couverture par theme (mots devenus keyword)
const byTheme = {};
for (const w of words) { byTheme[w.theme] ??= { t: 0, c: 0 }; byTheme[w.theme].t++; if (coveredRanks.has(w.rank)) byTheme[w.theme].c++; }
console.log(`Scenes : ${sceneCount} · repliques : ${lineCount} · situations : ${Object.keys(out).length}`);
console.log(`Erreurs : ${errors.length} · avertissements : ${warns.length} -> data/scenes-report.txt`);
console.log('Mots couverts comme mot-cle de scene, par theme :');
for (const th of Object.keys(byTheme)) if (byTheme[th].c) console.log(`  ${th.padEnd(16)} ${byTheme[th].c}/${byTheme[th].t}`);
