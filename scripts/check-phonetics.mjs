// Vérifie src/core/phonetics.ts sur le jeu de données (words.json + scenes.json).
//  - zhuyin  : identique à pinyinToZhuyin (scripts/lib/pinyin.mjs)
//  - wadegiles : chaque syllabe existe dans la table Wade-Giles de référence, à la bonne colonne d'initiale
//  - tongyong : règles documentées par l'article « Tongyong Pinyin » (wikitext de référence)
// Le TS est compilé à la volée par tsc (dossier temporaire) puis importé : aucune table dupliquée.
//
// Usage : node scripts/check-phonetics.mjs [--wg <wg.wiki>] [--ty <tongyong.wiki>]
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pinyinToZhuyin, splitSyllables, syllableToNumbered } from './lib/pinyin.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Wikitext de reference (Wikipedia, CC BY-SA), telecharge dans data/external/ (non versionne).
const SCRATCH = 'data/external/phonetics';
const arg = (name, def) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; };
const WG_FILE = arg('--wg', `${SCRATCH}/wg.wiki`);
const TY_FILE = arg('--ty', `${SCRATCH}/tongyong.wiki`);

// ---------- compilation + import du module TS ----------
const tmp = mkdtempSync(join(tmpdir(), 'richang-phonetics-'));
let mod;
try {
  const tscJs = join(root, 'node_modules/typescript/lib/tsc.js');
  const r = spawnSync(process.execPath, [tscJs, '--ignoreConfig', join(root, 'src/core/phonetics.ts'), '--outDir', tmp,
    '--target', 'ES2022', '--module', 'ESNext', '--skipLibCheck', '--strict'], { encoding: 'utf8' });
  if (r.status !== 0) { console.error('Compilation TS échouée :\n' + r.stdout + r.stderr); process.exit(2); }
  mkdirSync(join(tmp, 'out'), { recursive: true });
  copyFileSync(join(tmp, 'phonetics.js'), join(tmp, 'out/phonetics.mjs'));
  mod = await import(pathToFileURL(join(tmp, 'out/phonetics.mjs')).href);
} finally {
  // le module est déjà chargé en mémoire
  rmSync(tmp, { recursive: true, force: true });
}
const { convertSyllable, convertPinyin, zhuyinParts } = mod;

// ---------- extraction du jeu de données ----------
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const phrases = []; // chaînes pinyin
for (const w of readJson('src/data/generated/words.json')) {
  if (typeof w.pinyin === 'string') phrases.push(w.pinyin);
  if (w.example && typeof w.example.pinyin === 'string') phrases.push(w.example.pinyin);
}
const walk = (o) => {
  if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === 'object') {
    if (Array.isArray(o.lines)) for (const l of o.lines) if (l && typeof l.pinyin === 'string') phrases.push(l.pinyin);
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
  }
};
walk(readJson('src/data/generated/scenes.json'));

const clean = (s) => s.normalize('NFC').replace(/[^\p{L}\p{N}:\p{M}]+/gu, ' ').trim();
const syllables = new Set();
let unsplit = 0;
for (const p of phrases) {
  const syls = splitSyllables(clean(p));
  if (!syls) { unsplit++; continue; }
  for (const s of syls) syllables.add(s.normalize('NFC'));
}
const bases = new Set([...syllables].map((s) => syllableToNumbered(s).base));

console.log(`Chaînes pinyin : ${phrases.length} (non découpables par l'ancien module : ${unsplit})`);
console.log(`Syllabes distinctes : ${syllables.size} avec ton, ${bases.size} sans ton`);

const results = {};

// ---------- zhuyin ----------
{
  let diffs = 0; let nullRef = 0;
  for (const p of phrases) {
    const ref = pinyinToZhuyin(clean(p));
    if (!ref) { nullRef++; continue; }
    const got = convertPinyin('zhuyin', p);
    if (JSON.stringify(ref) !== JSON.stringify(got)) { if (diffs++ < 10) console.log('  zhuyin écart :', p, ref, got); }
  }
  for (const s of syllables) {
    const ref = pinyinToZhuyin(s);
    const got = convertSyllable('zhuyin', s);
    if (!ref || ref[0] !== got) { diffs++; console.log('  zhuyin écart (syllabe) :', s, ref, got); }
    // zhuyinParts cohérent
    const parts = zhuyinParts(s);
    const rebuilt = parts.neutral ? '˙' + parts.symbols : parts.symbols + parts.tone;
    if (rebuilt !== got) { diffs++; console.log('  zhuyinParts incohérent :', s, parts, got); }
  }
  if (nullRef) console.log(`  (${nullRef} chaînes ignorées car invalides pour l'ancien module)`);
  results.zhuyin = diffs;
}

// ---------- wade-giles ----------
const WG_COLS = ['', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's'];
const PY_INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's'];
const nfc = (s) => s.normalize('NFC');
{
  let diffs = 0;
  if (!existsSync(WG_FILE)) { console.log(`  [wadegiles] référence introuvable : ${WG_FILE}`); results.wadegiles = -1; }
  else {
    const wiki = readFileSync(WG_FILE, 'utf8');
    const start = wiki.indexOf('! rowspan=2 colspan=2 | Wade');
    const end = wiki.indexOf("::'''Colour Legend");
    const rows = [];
    for (const line of wiki.slice(start, end).split('\n')) {
      if (!line.startsWith('|') || /^\|[-}{+]/.test(line)) continue;
      const cells = line.slice(1).split('||').map((c) => {
        let t = c.replace(/\{\{wg-apos\}\}/g, "'");
        if (/style=/.test(t)) t = t.replace(/^[^|]*\|/, '');
        return t.trim();
      });
      rows.push(cells);
    }
    const bad = rows.filter((r) => r.length !== 22);
    console.log(`  [wadegiles] table de référence : ${rows.length} lignes de finales, ${bad.length} lignes à largeur inattendue`);
    const colSets = WG_COLS.map(() => new Set());
    for (const r of rows) r.forEach((c, i) => { if (i < 22 && c) for (const alt of c.split('/')) colSets[i].add(nfc(alt.trim())); });
    const seen = new Map();
    for (const s of syllables) {
      const { base } = syllableToNumbered(s);
      let init = '';
      for (const i of PY_INITIALS) if (base.startsWith(i)) { init = i; break; }
      const col = WG_COLS.indexOf(init);
      const out = convertSyllable('wadegiles', s);
      const plain = nfc(out.replace(/[¹²³⁴]/g, ''));
      if (!colSets[col].has(plain)) { diffs++; console.log(`  wadegiles écart : ${s} (${base}) -> ${out} absent de la colonne « ${init || '∅'} »`); }
      if (/^[a-z]+$/i.test(base)) {
        if (seen.has(plain) && seen.get(plain) !== base) console.log(`  info : collision wadegiles ${plain} = ${seen.get(plain)} / ${base}`);
        seen.set(plain, base);
      }
    }
    results.wadegiles = diffs;
  }
}

// ---------- tongyong ----------
const strip = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
{
  let diffs = 0;
  if (!existsSync(TY_FILE)) { console.log(`  [tongyong] référence introuvable : ${TY_FILE}`); results.tongyong = -1; }
  else {
    const wiki = nfc(readFileSync(TY_FILE, 'utf8')).toLowerCase();
    // [pinyin, sortie attendue (jointe sans espace, ou avec le séparateur indiqué), évidence dans l'article, séparateur]
    const cases = [
      ['xué jiǎ', 'syuéjiǎ', 'syuéjiǎ'],
      ['tōng yòng pīn yīn', 'tong-yòng-pin-yin', 'tong-yòng pin-yin', '-'],
      ['jūn xiào', 'jyunsiào', 'jyunsiào'],
      ['fèng shān', 'fòngshan', 'fòngshan'],
      ['fēng lè', 'fonglè', 'fonglè'],
      ['nán zǐ', 'nanzih', 'nanzih', '', true],
      ['zhāi shān', 'jhaishan', 'jhaishan', '', true],
      ['zhú shān', 'jhushan', 'jhushan', '', true],
      ['qīng', 'cing', 'cing dynasty', '', true],
      ['zhī', 'jhih', "''jh-''", '', true],
      ['chī', 'chih', '-ih', '', true],
      ['shī', 'shih', 'shih', '', true],
      ['rì', 'rih', '-ih', '', true],
      ['zī', 'zih', '-ih', '', true],
      ['cí', 'cih', '-ih', '', true],
      ['sī', 'sih', 'sih', '', true],
      ['qì', 'ci', "become ''s-'' and ''c-''", '', true],
      ['xī', 'si', "become ''s-'' and ''c-''", '', true],
      ['nǚ', 'nyu', 'nyu', '', true],
      ['lǜ', 'lyu', 'nyu', '', true],
      ['xiōng', 'syong', 'syong', '', true],
      ['yōng', 'yong', 'yong', '', true],
      ['jiōng', 'jyong', 'jyong', '', true],
      ['xiāng', 'siang', 'siang', '', true],
      ['liù', 'liou', '-iou', '', true],
      ['diū', 'diou', 'diou', '', true],
      ['guǐ', 'guei', '-uei', '', true],
      ['duì', 'duei', 'duei', '', true],
      ['fēng', 'fong', "''-eng'' becomes ''ong'' after ''f-''", '', true],
      ['wēng', 'wong', "''-eng'' becomes ''ong'' after ''f-'' and ''w-''", '', true],
      ['wēn', 'wun', 'wun', '', true],
      ['dōng', 'dong', 'dong', '', true], // weng/wong se contracte en ong après une autre consonne
      ['wèi', 'wei', "''wei''", '', true],
    ];
    for (const [py, exp, evid, sep = '', stripTones = false] of cases) {
      let got = convertPinyin('tongyong', py).join(sep);
      let want = exp;
      if (stripTones) { got = strip(got); want = strip(want); }
      const evidOk = wiki.includes(nfc(evid));
      if (got !== want) { diffs++; console.log(`  tongyong écart : ${py} -> ${got} (attendu ${want})`); }
      if (!evidOk) { diffs++; console.log(`  tongyong : évidence « ${evid} » introuvable dans l'article (cas ${py})`); }
    }
    // Convention de ton : 1er non marqué, 2-3-4 diacritiques, neutre = rond en chef.
    const toneCases = [['mā', 'ma'], ['má', 'ma\u0301'], ['mǎ', 'ma\u030C'], ['mà', 'ma\u0300'], ['ma', 'ma\u030A']];
    for (const [py, exp] of toneCases) {
      const got = convertSyllable('tongyong', py);
      if (got.normalize('NFD') !== exp.normalize('NFD')) { diffs++; console.log(`  tongyong ton écart : ${py} -> ${got}`); }
    }
    if (!wiki.includes('it has no mark for the first tone, but uses a small ring for the neutral tone')) { diffs++; console.log('  tongyong : phrase sur les tons introuvable dans l\'article'); }
    // Invariants sur tout le jeu de données : pas de q, x, ü, v, zh ; uniquement des lettres.
    const seen = new Map();
    for (const s of syllables) {
      const out = convertSyllable('tongyong', s);
      const plain = strip(out);
      if (!/^[a-z]+$/.test(plain) || /[qxv]|zh/.test(plain)) { diffs++; console.log(`  tongyong invariant violé : ${s} -> ${out}`); }
      const base = syllableToNumbered(s).base;
      if (seen.has(plain) && seen.get(plain) !== base) { diffs++; console.log(`  tongyong collision : ${plain} = ${seen.get(plain)} / ${base}`); }
      seen.set(plain, base);
    }
    results.tongyong = diffs;
  }
}

// ---------- syllabes inconnues ----------
{
  let diffs = 0;
  for (const sys of ['zhuyin', 'pinyin', 'tongyong', 'wadegiles']) {
    for (const bad of ['xyz', '', '123', 'bǐb']) {
      try {
        const out = convertSyllable(sys, bad);
        if (out !== bad) { diffs++; console.log(`  inconnue modifiée : ${sys} ${JSON.stringify(bad)} -> ${JSON.stringify(out)}`); }
      } catch (e) { diffs++; console.log('  exception :', sys, bad, e.message); }
    }
  }
  results.inconnues = diffs;
}

// ---------- exemples ----------
const examples = [['你好', 'nǐ hǎo'], ['謝謝', 'xiè xie'], ['去', 'qù'], ['學生', 'xué shēng'], ['女兒', 'nǚ ér']];
console.log('\nExemples :');
for (const [zh, py] of examples) {
  console.log(`  ${zh}  pinyin: ${convertPinyin('pinyin', py).join(' ')}`);
  console.log(`      zhuyin: ${convertPinyin('zhuyin', py).join(' ')}   wadegiles: ${convertPinyin('wadegiles', py).join(' ')}   tongyong: ${convertPinyin('tongyong', py).join(' ')}`);
}

console.log('\nÉcarts par système :');
let total = 0;
for (const [k, v] of Object.entries(results)) { console.log(`  ${k}: ${v}`); total += Math.max(v, 0); }
process.exit(total === 0 ? 0 : 1);
