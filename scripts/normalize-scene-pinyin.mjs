// Harmonise le pinyin des phrases du jeu avec les lectures fixees (scripts/lib/readings.mjs : lectures de Taiwan,
// tons pleins pour les syllabes qui portent du sens) : repliques des scenes et exemples des cartes.
//   node scripts/normalize-scene-pinyin.mjs [--write]
// Sans --write : liste ce qui changerait. Le pinyin d'une phrase a une syllabe par caractere chinois (controle de
// validate-scenes / check-scenes / validate-words), separees par des espaces : la syllabe du caractere n est le n-ieme
// mot du pinyin. Les fichiers gardent leur mise en forme.
import fs from 'node:fs';
import path from 'node:path';
import { fixPinyin } from './lib/readings.mjs';

const write = process.argv.includes('--write');
let changed = 0;
let skipped = 0;

function report(id, zh, before, after) {
  changed++;
  console.log(`${id} : ${zh}\n   ${before}\n → ${after}`);
}

// 1. Repliques des scenes (data/scenes/*.json).
const dir = 'data/scenes';
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const file = path.join(dir, f);
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  const indent = /^\{\s*\n(\s+)"/.exec(raw)?.[1].length ?? 0;
  let dirty = false;
  for (const sc of data.scenes ?? []) {
    for (const l of sc.lines ?? []) {
      const after = fixPinyin(l.zh, l.pinyin);
      if (after === null) { skipped++; console.log(`IGNORE ${sc.id} : pinyin non aligne "${l.pinyin}"`); continue; }
      if (after !== l.pinyin) { report(sc.id, l.zh, l.pinyin, after); l.pinyin = after; dirty = true; }
    }
  }
  if (dirty && write) fs.writeFileSync(file, (indent ? JSON.stringify(data, null, indent) : JSON.stringify(data)) + (raw.endsWith('\n') ? '\n' : ''));
}

// 2. Exemples des cartes (data/enriched/part-*.json : une entree par ligne ; on remplace le pinyin dans le texte).
for (const f of fs.readdirSync('data/enriched').filter((x) => /^part-\d+\.json$/.test(x))) {
  const file = path.join('data/enriched', f);
  let raw = fs.readFileSync(file, 'utf8');
  let dirty = false;
  for (const e of JSON.parse(raw)) {
    const ex = e.example;
    if (!ex?.zh || !ex.pinyin) continue;
    const after = fixPinyin(ex.zh, ex.pinyin);
    if (after === null || after === ex.pinyin) continue;
    const from = `"pinyin":${JSON.stringify(ex.pinyin)},"fr":${JSON.stringify(ex.fr)}`;
    if (!raw.includes(from)) { skipped++; console.log(`IGNORE exemple #${e.rank} (texte introuvable)`); continue; }
    report(`exemple #${e.rank} ${e.hanzi}`, ex.zh, ex.pinyin, after);
    raw = raw.replace(from, `"pinyin":${JSON.stringify(after)},"fr":${JSON.stringify(ex.fr)}`);
    dirty = true;
  }
  if (dirty && write) fs.writeFileSync(file, raw);
}

console.log(`\n${changed} phrase(s) ${write ? 'corrigee(s)' : 'a corriger (relancer avec --write)'} · ${skipped} ignoree(s)`);
