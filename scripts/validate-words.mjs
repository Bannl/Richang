// Fusionne data/enriched/part-*.json, valide (pinyin, caracteres, exemples, CC-CEDICT) et ecrit data/words-final.json.
// Usage : node scripts/validate-words.mjs [--force]  (--force ecrit le fichier malgre les erreurs)
import fs from 'node:fs';
import { findSimplified } from './lib/master.mjs';
import { applySandhi, pinyinToNumbered, pinyinToZhuyin, splitSyllables } from './lib/pinyin.mjs';

const OVERRIDES = fs.existsSync('data/pinyin-overrides.json') ? JSON.parse(fs.readFileSync('data/pinyin-overrides.json', 'utf8')) : {};

const force = process.argv.includes('--force');
const master = JSON.parse(fs.readFileSync('data/master-all.json', 'utf8'));
const byRank = new Map(master.map((m) => [m.rank, m]));
const POS = new Set(['n.', 'v.', 'v.aux.', 'adj.', 'adv.', 'pron.', 'part.', 'conj.', 'prép.', 'class.', 'num.', 'expr.', 'interj.']);
const isHan = (c) => /\p{Script=Han}/u.test(c);

// CC-CEDICT : traditionnel -> prononciations (numerotees), y compris "Taiwan pr."
const cedict = new Map();
if (fs.existsSync('data/external/cedict.txt')) {
  for (const line of fs.readFileSync('data/external/cedict.txt', 'utf8').split('\n')) {
    if (line.startsWith('#')) continue;
    const m = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/);
    if (!m) continue;
    const arr = cedict.get(m[1]) ?? [];
    arr.push(m[3].toLowerCase());
    const tw = m[4].match(/Taiwan pr\. \[([^\]]+)\]/);
    if (tw) arr.push(tw[1].toLowerCase());
    cedict.set(m[1], arr);
  }
}

const errors = [];
const warns = [];
const entries = [];
for (let i = 1; i <= 8; i++) {
  const f = `data/enriched/part-${i}.json`;
  if (!fs.existsSync(f)) { errors.push(`fichier manquant : ${f}`); continue; }
  try { entries.push(...JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { errors.push(`${f} : JSON invalide (${e.message})`); }
}

// Traductions anglaises (optionnelles) : rank -> { en, noteEn, exampleEn }
const EN = new Map();
for (let i = 1; i <= 8; i++) {
  const f = `data/enriched-en/part-${i}.json`;
  if (!fs.existsSync(f)) { warns.push(`traductions anglaises manquantes : ${f}`); continue; }
  try { for (const e of JSON.parse(fs.readFileSync(f, 'utf8'))) EN.set(e.rank, e); } catch (err) { errors.push(`${f} : JSON invalide (${err.message})`); }
}

const seen = new Set();
const out = [];
for (const e of entries) {
  const tag = `#${e.rank} ${e.hanzi}`;
  const m = byRank.get(e.rank);
  if (!m) { errors.push(`${tag} : rang inconnu`); continue; }
  if (m.hanzi !== e.hanzi) errors.push(`${tag} : hanzi attendu ${m.hanzi}`);
  if (seen.has(e.rank)) { errors.push(`${tag} : doublon`); continue; }
  seen.add(e.rank);
  const chars = [...e.hanzi].filter(isHan);
  let pinyin = (OVERRIDES[e.hanzi] ?? e.pinyin ?? '').trim();
  let syls = pinyin ? splitSyllables(pinyin) : null;
  if (syls && syls.length === chars.length) { syls = applySandhi(e.hanzi, syls); pinyin = syls.join(' '); }
  if (!syls) errors.push(`${tag} : pinyin invalide "${pinyin}"`);
  else if (syls.length !== chars.length) errors.push(`${tag} : ${syls.length} syllabes pour ${chars.length} caractères ("${pinyin}")`);
  const zhuyin = syls ? pinyinToZhuyin(pinyin) : null;
  if (syls && !zhuyin) errors.push(`${tag} : conversion zhuyin impossible ("${pinyin}")`);
  if (!POS.has(e.pos)) warns.push(`${tag} : pos "${e.pos}"`);
  if (!Array.isArray(e.fr) || !e.fr.length || !e.fr[0]) errors.push(`${tag} : sens (fr) manquant`);
  const badW = findSimplified(e.hanzi);
  if (badW.length) errors.push(`${tag} : caractère simplifié [${badW.join('')}]`);
  const ex = e.example;
  if (!ex || !ex.zh || !ex.fr || !ex.pinyin) errors.push(`${tag} : exemple incomplet`);
  else {
    if (!ex.zh.includes(e.hanzi)) warns.push(`${tag} : exemple sans le mot : ${ex.zh}`);
    const exChars = [...ex.zh].filter(isHan);
    const exSyl = splitSyllables(ex.pinyin.replace(/[,，.。!！?？;；:：、「」()（）"…]/g, ' '));
    if (!exSyl) warns.push(`${tag} : pinyin d'exemple invalide "${ex.pinyin}"`);
    else if (exSyl.length !== exChars.length) warns.push(`${tag} : exemple ${exChars.length} car. / ${exSyl.length} syllabes`);
    const bad = findSimplified(ex.zh);
    if (bad.length) errors.push(`${tag} : simplifié dans l'exemple [${bad.join('')}]`);
    if (exChars.length > 16) warns.push(`${tag} : exemple long (${exChars.length} car.)`);
  }
  if (cedict.size && syls && syls.length === chars.length) {
    const num = pinyinToNumbered(pinyin);
    const known = cedict.get(e.hanzi);
    if (!known) warns.push(`${tag} : absent de CEDICT`);
    else if (!known.some((p) => p.replace(/\s+/g, ' ') === num)) warns.push(`${tag} : pinyin ${num} ≠ CEDICT ${[...new Set(known)].join(' | ')}`);
  }
  if (e.note && e.note.length > 120) warns.push(`${tag} : note longue (${e.note.length})`);
  const en = EN.get(e.rank);
  if (en) {
    if (en.hanzi !== e.hanzi) errors.push(`${tag} : hanzi anglais different (${en.hanzi})`);
    if (!Array.isArray(en.en) || !en.en.length || !en.en[0]) errors.push(`${tag} : sens anglais manquant`);
    if (!en.exampleEn) warns.push(`${tag} : exemple anglais manquant`);
    if (en.noteEn && en.noteEn.length > 120) warns.push(`${tag} : note anglaise longue`);
  } else if (EN.size) warns.push(`${tag} : pas de traduction anglaise`);
  out.push({
    rank: e.rank, tier: m.tier, hanzi: e.hanzi, pinyin, zhuyin: zhuyin ?? [], pos: e.pos ?? '',
    fr: Array.isArray(e.fr) ? e.fr : [String(e.fr ?? '')], ...(en?.en?.length ? { en: en.en } : {}),
    ...(e.note ? { note: e.note } : {}), ...(en?.noteEn ? { noteEn: en.noteEn } : {}), theme: m.theme,
    ...(ex ? { example: { zh: ex.zh ?? '', pinyin: ex.pinyin ?? '', fr: ex.fr ?? '', ...(en?.exampleEn ? { en: en.exampleEn } : {}) } } : {}),
  });
}
for (const m of master) if (!seen.has(m.rank)) errors.push(`#${m.rank} ${m.hanzi} : manquant`);
out.sort((a, b) => a.rank - b.rank);

const glossCount = new Map();
for (const w of out) glossCount.set(w.fr[0], (glossCount.get(w.fr[0]) ?? 0) + 1);
for (const [g, n] of glossCount) if (n > 1) warns.push(`sens principal en double (${n}) : ${g}`);

fs.writeFileSync('data/validation-report.txt', [...errors.map((e) => 'ERREUR ' + e), ...warns.map((w) => 'AVERT  ' + w)].join('\n') + '\n');
console.log(`${out.length} mots · ${errors.length} erreur(s) · ${warns.length} avertissement(s) → data/validation-report.txt`);
if (!errors.length || force) {
  fs.writeFileSync('data/words-final.json', JSON.stringify(out));
  console.log('data/words-final.json écrit' + (errors.length ? ' (--force)' : ''));
}
if (errors.length) process.exit(1);
