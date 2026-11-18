// Controle de fichiers de scenes avant de les ajouter au jeu (agents d'ecriture, relecture) :
//   node scripts/check-scenes.mjs data/scenes/<fichier>.json [autres fichiers...]
// Pour chaque scene : champs, caracteres traditionnels, pinyin aligne (une syllabe par caractere), 2 a 16 caracteres
// par replique, repliques alternees en commencant par l'interlocuteur (enemy), 4 a 12 repliques, au moins un mot des
// 2000 mots du jeu dans CHAQUE replique (sinon la replique n'aurait pas de trou : la scene ne serait jamais jouee),
// mots-cles presents, identifiants uniques. Affiche aussi le niveau estime (1 a 5, quintiles de complexite du corpus
// actuel, meme formule que le jeu : longueur des repliques, rarete du vocabulaire, mots hors liste).
// Code de sortie 1 s'il y a des erreurs. N'ecrit rien.
import fs from 'node:fs';
import path from 'node:path';
import { findSimplified } from './lib/master.mjs';
import { splitSyllables } from './lib/pinyin.mjs';
import { segmentRanks } from './lib/segment.mjs';
import { hasLatinPunct } from './lib/punct.mjs';

const targets = process.argv.slice(2).map((f) => path.resolve(f));
if (targets.length === 0) { console.error('Usage : node scripts/check-scenes.mjs <fichier.json> [...]'); process.exit(2); }

const words = JSON.parse(fs.readFileSync('data/words-final.json', 'utf8'));
const dict = new Map(words.map((w) => [w.hanzi, w.rank]));
const isHan = (c) => /\p{Script=Han}/u.test(c);
const MAX_LEN = 5;
const SITUATIONS = new Set([...fs.readFileSync('src/game/situations.ts', 'utf8').matchAll(/\{ id: ['"]([a-z-]+)['"]/g)].map((m) => m[1]));

/** Segmentation du jeu (plus long mot de la liste d'abord, exceptions comprises) : rangs trouves, caracteres hors liste. */
const segment = (zh) => segmentRanks(zh, dict);

/** Complexite (meme formule que sceneLevel dans src/game/run.ts). */
function complexity(lines) {
  let han = 0; let unknown = 0; const ranks = [];
  for (const l of lines) {
    han += [...l.zh].filter(isHan).length;
    const s = segment(l.zh);
    ranks.push(...s.ranks); unknown += s.unknown;
  }
  ranks.sort((a, b) => a - b);
  const r80 = ranks.length ? ranks[Math.floor(0.8 * (ranks.length - 1))] : 1;
  return { c: han / Math.max(1, lines.length) / 8 + Math.log2(1 + r80) / 11 + (unknown / Math.max(1, han)) * 0.8, avg: han / Math.max(1, lines.length), r80 };
}

// Corpus actuel (hors fichiers controles) : identifiants deja pris et seuils des niveaux.
const dir = 'data/scenes';
const ids = new Map();
const corpus = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const full = path.resolve(dir, f);
  if (targets.includes(full)) continue;
  try {
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const sc of data.scenes ?? []) { ids.set(sc.id, f); if (Array.isArray(sc.lines) && sc.lines.length) corpus.push(complexity(sc.lines).c); }
  } catch { /* fichier illisible : signale par validate-scenes */ }
}
corpus.sort((a, b) => a - b);
const cut = [1, 2, 3, 4].map((k) => corpus[Math.floor((k * corpus.length) / 5)] ?? Infinity);
const levelOf = (c) => 1 + cut.filter((x) => c >= x).length;

let errors = 0;
const err = (msg) => { errors++; console.log('ERREUR ' + msg); };
const rows = [];
for (const file of targets) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { err(`${path.basename(file)} : JSON invalide (${e.message})`); continue; }
  const sit = data.situation;
  if (!SITUATIONS.has(sit)) err(`${path.basename(file)} : situation inconnue "${sit}"`);
  for (const sc of data.scenes ?? []) {
    const tag = `${sit}/${sc.id ?? '?'}`;
    if (!sc.id || typeof sc.id !== 'string') { err(`${tag} : id manquant`); continue; }
    if (ids.has(sc.id)) err(`${tag} : id deja utilise (${ids.get(sc.id)})`);
    ids.set(sc.id, path.basename(file));
    const lines = Array.isArray(sc.lines) ? sc.lines : [];
    if (lines.length < 4 || lines.length > 12) err(`${tag} : ${lines.length} repliques (4 a 12)`);
    lines.forEach((l, i) => {
      const t = `${tag}#${i + 1}`;
      if (!l || !l.zh || !l.pinyin || !l.en || !l.fr) { err(`${t} : champs manquants (speaker, zh, pinyin, en, fr)`); return; }
      const want = i % 2 === 0 ? 'enemy' : 'player';
      if (l.speaker !== want) err(`${t} : speaker "${l.speaker}", attendu "${want}" (alternance, l'interlocuteur commence)`);
      const han = [...l.zh].filter(isHan);
      if (han.length < 2 || han.length > 16) err(`${t} : ${han.length} caracteres (2 a 16) "${l.zh}"`);
      if (hasLatinPunct(l.zh)) err(`${t} : ponctuation latine dans le chinois (，？！ attendus) "${l.zh}"`);
      const bad = findSimplified(l.zh);
      if (bad.length) err(`${t} : caracteres simplifies [${bad.join('')}] "${l.zh}"`);
      const syl = splitSyllables(l.pinyin.replace(/[,，.。!！?？;；:：、'"“”‘’]/g, ' '));
      if (!syl || syl.length !== han.length) err(`${t} : pinyin ${syl ? syl.length : '?'} syllabes pour ${han.length} caracteres "${l.zh}" / "${l.pinyin}"`);
      if (segment(l.zh).ranks.length === 0) err(`${t} : aucun mot de la liste du jeu dans la replique "${l.zh}"`);
    });
    const present = new Set(lines.flatMap((l) => (l?.zh ? segment(l.zh).ranks : [])));
    const kw = (sc.keywords ?? []).filter((k) => dict.has(k) && present.has(dict.get(k)));
    const missing = (sc.keywords ?? []).filter((k) => !kw.includes(k));
    if (kw.length === 0) err(`${tag} : aucun mot-cle valide (mots de la liste presents dans la scene, decoupes comme le jeu)`);
    if (missing.length) console.log(`AVERT  ${tag} : mots-cles ignores (hors liste ou absents/decoupes autrement) : ${missing.join(' ')}`);
    if (lines.length) {
      const k = complexity(lines);
      rows.push(`${sc.id.padEnd(28)} ${String(lines.length).padStart(2)} rep. · ${k.avg.toFixed(1).padStart(4)} car./rep. · rang80 ${String(k.r80).padStart(4)} · niveau ${levelOf(k.c)}`);
    }
  }
}
console.log(rows.join('\n'));
console.log(errors ? `\n${errors} erreur(s)` : '\nAucune erreur.');
process.exit(errors ? 1 : 0);
