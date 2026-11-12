// Fusionne data/candidates/<theme>.txt (paliers 5-6 proposes par theme) avec la liste maitresse T1-T4.
// Sorties : data/master-t5-t6.txt, data/master-all.json (rang, palier, mot, theme, indice de sens).
import fs from 'node:fs';
import { parseMasterFile, findSimplified, SUSPICIOUS, TIER_SIZES } from './lib/master.mjs';

const THEMES = JSON.parse(fs.readFileSync('data/themes.json', 'utf8'));
const QUOTA = {
  grammaire: [25, 35], pronoms: [5, 5], 'nombres-temps': [20, 35], verbes: [60, 150], adjectifs: [45, 115],
  personnes: [25, 65], nourriture: [30, 95], 'lieux-transport': [30, 85], achats: [25, 55], maison: [30, 95],
  'travail-etudes': [30, 80], 'corps-sante': [30, 70], nature: [25, 75], expressions: [20, 40],
};

function parseCandidates(path) {
  const s = { tier5: [], tier6: [], extra5: [], extra6: [] };
  let cur = null;
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '').trim();
    if (!line) continue;
    const m = line.match(/^#\s*(tier5|tier6|extra5|extra6)/i);
    if (m) { cur = m[1].toLowerCase(); continue; }
    if (line.startsWith('#') || !cur) continue;
    const [word, gloss] = line.split(/\t| {2,}/).map((x) => (x ?? '').trim());
    s[cur].push({ hanzi: word.replace(/\s+/g, ''), gloss: gloss || '' });
  }
  return s;
}

const base = parseMasterFile('data/master-t1-t4.txt');
const used = new Set(base.map((w) => w.hanzi));
const hints = {};
const warnings = [];
const cands = {};
for (const t of THEMES) {
  const p = `data/candidates/${t.id}.txt`;
  if (!fs.existsSync(p)) { console.error('Fichier manquant : ' + p); process.exit(1); }
  cands[t.id] = parseCandidates(p);
}

function accept(w, theme) {
  if (!w.hanzi || used.has(w.hanzi)) return false;
  if ([...w.hanzi].length > 5) { warnings.push(`trop long (${theme}) : ${w.hanzi}`); return false; }
  const bad = findSimplified(w.hanzi);
  if (bad.length) { warnings.push(`simplifie (${theme}) : ${w.hanzi} [${bad.join('')}]`); return false; }
  for (const ch of w.hanzi) if (SUSPICIOUS.includes(ch)) warnings.push(`a verifier (${theme}) : ${w.hanzi} [${ch}]`);
  used.add(w.hanzi);
  if (w.gloss) hints[w.hanzi] = w.gloss;
  return true;
}

const result = { 5: {}, 6: {} };
const leftovers = { 5: {}, 6: {} };
for (const tier of [5, 6]) {
  for (const t of THEMES) {
    const c = cands[t.id];
    const pool = tier === 5 ? [...c.tier5, ...c.extra5, ...c.tier6] : [...c.tier6, ...c.extra6, ...c.extra5];
    const quota = QUOTA[t.id][tier - 5];
    const out = [];
    const rest = [];
    for (const w of pool) {
      if (out.length >= quota) { rest.push(w); continue; }
      if (accept(w, t.id)) out.push(w.hanzi);
    }
    if (out.length < quota) warnings.push(`quota non atteint (${t.id}, tier ${tier}) : ${out.length}/${quota}`);
    result[tier][t.id] = out;
    leftovers[tier][t.id] = rest;
  }
  // Complement global si des doublons ont cree des trous
  const target = TIER_SIZES[tier - 1];
  let total = Object.values(result[tier]).reduce((n, l) => n + l.length, 0);
  let progress = true;
  while (total < target && progress) {
    progress = false;
    for (const t of THEMES) {
      if (total >= target) break;
      const rest = leftovers[tier][t.id];
      while (rest.length) {
        const w = rest.shift();
        if (accept(w, t.id)) { result[tier][t.id].push(w.hanzi); total++; progress = true; break; }
      }
    }
  }
  console.log(`tier ${tier}: ${total} mots (attendu ${target})`);
}

let txt = '';
for (const tier of [5, 6]) {
  txt += `# tier ${tier}\n`;
  for (const t of THEMES) if (result[tier][t.id].length) txt += `${t.id}: ${result[tier][t.id].join(' ')}\n`;
}
fs.writeFileSync('data/master-t5-t6.txt', txt);

const all = [...base, ...parseMasterFile('data/master-t5-t6.txt')].map((w, i) => ({ rank: i + 1, tier: w.tier, hanzi: w.hanzi, theme: w.theme, hint: hints[w.hanzi] ?? '' }));
fs.writeFileSync('data/master-all.json', JSON.stringify(all, null, 0));
console.log(`master-all.json : ${all.length} mots`);
if (warnings.length) console.log('Avertissements :\n  ' + warnings.join('\n  '));
