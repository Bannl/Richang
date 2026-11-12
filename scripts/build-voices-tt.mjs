// SPDX-License-Identifier: GPL-3.0-or-later OR MIT
// Copyright (C) 2026 Nextale Audio. Writer of the TT File Format: also under the MIT License (LICENSE-MIT, COPYRIGHT.md).
// Construit les voix du jeu au format TT (TT File Format, draft 0.3, section 11 : Ogg) :
//   node scripts/build-voices-tt.mjs <dossier des wav> [--codec opus|vorbis] [--only id1,id2] [--bitrate 20k] [--quality q] [--verify]
//                                    [--out <dossier>] [--fixed-gap <ms>]   (essais : autre dossier, silence fixe entre deux repliques)
// Un fichier par personnage, public/voices/<situation>.opus (ses repliques), et un par voix du joueur,
// public/voices/player-f.opus et player-m.opus (toutes ses repliques). Le jeu utilise l'Opus (choix du 2026-11-12) ;
// --codec vorbis produit les memes en .ogg (Vorbis), pour comparer. Chaque replique est un segment : une ligne de la
// table TT_SEGMENT_TABLE (section 11.5 : un objet JSON sur une ligne, dans un commentaire Vorbis) et un chapitre
// CHAPTERnnn. Le jeu lit cette table dans le fichier et ne decode que les paquets du segment demande. Les wav (24 kHz
// mono 16 bits, sortie de CosyVoice) sont debarrasses de leurs silences de debut et de fin (chaque replique garde 50 ms
// avant la voix et 120 ms apres), mis bout a bout sans silence ajoute, sauf ce qui manque a leurs bords calmes (voir
// QUIET_AFTER, section 11.4), avec 100 ms au debut et a la fin du fichier, encodes par ffmpeg
// (libopus, ou libvorbis), puis l'en-tete de commentaires est reecrit (paquets audio inchanges). Le fichier pese ainsi
// moins que ses repliques en fichiers separes avec les memes metadonnees (section 12 : le validateur du kit le verifie).
// --verify decode chaque fichier et compare chaque segment a son wav (alignement a l'echantillon pres).
// La scene du tutoriel (src/data/tutorial.json, hors runs) est doublee comme les autres : ses repliques sont ajoutees en
// fin de fichier, celui de son personnage (le proprietaire) et ceux du joueur, apres les scenes des situations.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { oggWithComments, readOgg } from './lib/ogg.mjs';

const args = process.argv.slice(2);
const src = args[0];
if (!src || !fs.existsSync(src)) {
  console.error('Usage : node scripts/build-voices-tt.mjs <dossier des wav> [--only id1,id2] [--quality q] [--verify]');
  process.exit(1);
}
const opt = (name) => { const i = args.indexOf(name); return i > 0 ? args[i + 1] : undefined; };
const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
const CODEC = opt('--codec') ?? 'opus';
if (CODEC !== 'vorbis' && CODEC !== 'opus') throw new Error('--codec vorbis ou opus');
const QUALITY = Number(opt('--quality') ?? 0);   // Vorbis
const BITRATE = opt('--bitrate') ?? '20k';       // Opus
const EXT = CODEC === 'opus' ? 'opus' : 'ogg';
const VERIFY = args.includes('--verify');
const OUT = path.resolve(opt('--out') ?? 'public/voices');
// Essais seulement : un silence fixe (ms) entre deux repliques au lieu de la regle ci-dessous (ex. 300, comme en 0.2).
const FIXED_GAP = opt('--fixed-gap') !== undefined ? Math.round(24000 * Number(opt('--fixed-gap')) / 1000) : null;
const WRITER = 'Richang build-voices-tt 1.1';
const TT_VERSION = '0.3';                      // table de segments (section 11.5)
const RATE = 24000;                            // wav sources
// Trames du flux (spec, section 11.1) : Vorbis a la frequence du fichier, Opus toujours a 48 kHz apres le pre-skip.
const FRAME_RATE = CODEC === 'opus' ? 48000 : RATE;
const SCALE = FRAME_RATE / RATE;
// Silence ajoute : aux deux bouts du fichier (un lecteur y decode sa marge, section 11.4), paye une fois ; entre deux
// repliques, seulement ce qui manque a leurs propres bords calmes. Un codec etale chaque son sur ses voisins : apres
// une fin forte, il faut 60 ms de calme en Opus (40 en Vorbis) avant le debut de la replique suivante, sinon ses
// premieres millisecondes recoivent la fin de la precedente (mesure : -93 -> -34 dBFS sur une prise qui finit net) ;
// avant une voix qui commence net, 20 ms. La plupart des prises gardent 120 ms apres la voix et 50 ms avant : rien a
// ajouter ; certaines prises de CosyVoice finissent ou commencent sur la voix.
const LEAD = Math.round(RATE * 0.1);           // avant la premiere replique
const END = Math.round(RATE * 0.1);            // apres la derniere
const QUIET_AFTER = Math.round(RATE * (CODEC === 'opus' ? 0.06 : 0.04));   // apres la voix d'une replique
const QUIET_BEFORE = Math.round(RATE * 0.02);                              // avant la voix de la suivante
const KEEP_BEFORE = Math.round(RATE * 0.05);   // silence garde avant et apres la voix
const KEEP_AFTER = Math.round(RATE * 0.12);
const THRESHOLD = Math.round(32768 * 0.0056);  // -45 dBFS
// Espace de noms des identifiants de segment (UUID v5 du nom de la replique : stables d'une construction a l'autre).
const NAMESPACE = Buffer.from('8b0e4c527a1d4f6e9c3b2d5a7e1f0c94', 'hex');

function uuid5(name) {
  const h = crypto.createHash('sha1').update(NAMESPACE).update(name, 'utf8').digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

// --- Table des segments (section 11.5), portage de table_text du kit (make_tt_spec_samples.py) ---
// Un segment = ses paires [chemin, valeur] dans l'ordre de ses elements (NAME, USER/FXNAME, FIELD/TEXT_ZH...).
const STRUCTURAL = new Set(['SEGMENT_ID', 'CUE_ID', 'START_SAMPLE', 'LENGTH_SAMPLES']);

/** Ordre des chemins tel qu'un lecteur relit la table sans ORDER : colonnes de la ligne, puis DEFAULTS. */
function readBackOrder(columns, row, defaults) {
  const have = columns.filter((_k, i) => i < row.length && row[i] !== null);
  const out = [...have, ...[...defaults.keys()].filter((k) => !have.includes(k))];
  if (!out.includes('CUE_ID')) out.push('CUE_ID');
  return out;
}

/** Un ordre des chemins pour tous les segments : chacun juste apres celui qui le precede la ou il apparait d'abord. */
function mergedOrder(segments) {
  const order = [];
  const seen = new Set();
  for (const pairs of segments) {
    let prev = null;
    for (const [p] of pairs) {
      if (!seen.has(p)) { order.splice(prev === null ? 0 : order.indexOf(prev) + 1, 0, p); seen.add(p); }
      prev = p;
    }
  }
  return order;
}

/**
 * Valeur du commentaire TT_SEGMENT_TABLE : les valeurs communes a tous les segments dans DEFAULTS (sauf NAME et les
 * chemins de position et d'identite), les autres dans COLUMNS (les plus remplies d'abord) et ROWS (sans les null de
 * fin), ORDER quand la table relue rendrait les elements d'un segment dans un autre ordre. Toutes les valeurs sont des
 * chaines ; JSON.stringify n'echappe pas le CJK (3 octets par caractere au lieu de 6).
 */
function tableText(header, segments) {
  const shared = new Map();
  if (segments.length > 1) {
    const maps = segments.map((pairs) => new Map(pairs));
    for (const [p, v] of segments[0]) {
      if (!STRUCTURAL.has(p) && p !== 'NAME' && p !== 'XML' && maps.every((m) => m.get(p) === v)) shared.set(p, v);
    }
  }
  const columns = [];
  const count = new Map();
  for (const pairs of segments) {
    for (const [p] of pairs) {
      if (shared.has(p)) continue;
      if (!count.has(p)) { columns.push(p); count.set(p, 0); }
      count.set(p, count.get(p) + 1);
    }
  }
  columns.sort((a, b) => count.get(b) - count.get(a));   // tri stable : a egalite, l'ordre d'apparition
  const rows = segments.map((pairs) => {
    const d = new Map(pairs);
    const row = columns.map((k) => (d.has(k) ? d.get(k) : null));
    while (row.length && row[row.length - 1] === null) row.pop();
    return row;
  });
  const obj = { ...header };
  if (shared.size) obj.DEFAULTS = Object.fromEntries(shared);
  obj.COLUMNS = columns;
  const reordered = segments.some((pairs, i) => {
    const back = readBackOrder(columns, rows[i], shared);
    return back.length !== pairs.length || pairs.some(([p], k) => back[k] !== p);
  });
  if (reordered) obj.ORDER = mergedOrder(segments);
  obj.ROWS = rows;
  return JSON.stringify(obj);
}

/** Debut d'un chapitre, arrondi a la milliseconde au plus proche, egalite vers le pair (comme le kit, Python round). */
function chapterTime(frames, rate) {
  const x = (frames * 1000) / rate;
  let ms = Math.floor(x);
  if (x - ms > 0.5 || (x - ms === 0.5 && ms % 2 === 1)) ms += 1;
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)}.${p(ms % 1000, 3)}`;
}

/** PCM 16 bits mono d'un wav (24 kHz attendus). */
function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file} : pas un wav`);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(pos + 8), channels: b.readUInt16LE(pos + 10), rate: b.readUInt32LE(pos + 12), bits: b.readUInt16LE(pos + 22) };
    if (id === 'data') data = b.subarray(pos + 8, pos + 8 + size);
    pos += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.channels !== 1 || fmt.rate !== RATE) throw new Error(`${file} : wav 24 kHz mono attendu`);
  if (fmt.format === 1 && fmt.bits === 16) return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + (data.length & ~1)));
  if (fmt.format === 3 && fmt.bits === 32) {
    // Flottant 32 bits (premieres repliques, doublees sur le processeur) -> 16 bits.
    const f = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + (data.length & ~3)));
    return Int16Array.from(f, (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767))));
  }
  throw new Error(`${file} : PCM 16 bits ou flottant 32 bits attendu (format ${fmt.format}, ${fmt.bits} bits)`);
}

/**
 * Debut et fin de la voix (seuil -45 dBFS) avec une petite marge de silence. head et tail : calme garde avant et apres
 * la voix (moins que la marge quand la prise commence ou finit sur la voix).
 */
function trim(pcm) {
  let a = 0, b = pcm.length - 1;
  while (a < pcm.length && Math.abs(pcm[a]) < THRESHOLD) a++;
  while (b > a && Math.abs(pcm[b]) < THRESHOLD) b--;
  if (a >= pcm.length) return { start: 0, length: pcm.length, head: pcm.length, tail: pcm.length };
  const start = Math.max(0, a - KEEP_BEFORE);
  const end = Math.min(pcm.length, b + 1 + KEEP_AFTER);
  return { start, length: end - start, head: a - start, tail: end - (b + 1) };
}

function writeWav(file, pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii'); h.writeUInt32LE(36 + pcm.length * 2, 4); h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii'); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii'); h.writeUInt32LE(pcm.length * 2, 40);
  fs.writeFileSync(file, Buffer.concat([h, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.length * 2)]));
}

function ffmpeg(argv) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg : ${String(r.stderr).slice(0, 400)}`);
  return r.stdout;
}

// --- Donnees : scenes (textes), situations (noms des personnages), voix (genre) ---
const scenesBySit = JSON.parse(fs.readFileSync('src/data/generated/scenes.json', 'utf8'));
const tutorialScenes = fs.existsSync('src/data/tutorial.json') ? JSON.parse(fs.readFileSync('src/data/tutorial.json', 'utf8')).scenes : [];
const words = JSON.parse(fs.readFileSync('data/words-final.json', 'utf8'));
const hanziOf = new Map(words.map((w) => [w.rank, w.hanzi]));
const situations = [];
for (const m of fs.readFileSync('src/game/situations.ts', 'utf8').matchAll(/\{ id: (['"])(.*?)\1, en: (['"])(.*?)\3, fr: (['"])(.*?)\5, person: \{ en: (['"])(.*?)\7, fr: (['"])(.*?)\9 \}/g)) {
  situations.push({ id: m[2], en: m[4], fr: m[6], personEn: m[8], personFr: m[10] });
}
const missingSits = Object.keys(scenesBySit).filter((id) => !situations.some((s) => s.id === id));
if (missingSits.length) throw new Error(`situations sans nom de personnage (situations.ts) : ${missingSits.join(', ')}`);
const voices = JSON.parse(fs.readFileSync('.cache/commonvoice/voices.json', 'utf8'));
// Genre de la voix : Common Voice quand il est connu, sinon le personnage dessine.
const FEMALE_FALLBACK = new Set(['market', 'player-f']);
const isFemale = (id) => (voices[id]?.gender ? /female/.test(voices[id].gender) : FEMALE_FALLBACK.has(id));

/** Plan des fichiers : personnage par situation (repliques "enemy", voix n), joueur par voix (f, m). */
const plans = [];
for (const s of situations) {
  const lines = [];
  const scenes = [...(scenesBySit[s.id] ?? []), ...tutorialScenes.filter((sc) => sc.situation === s.id)];
  for (const sc of scenes) sc.lines.forEach((l, i) => { if (l.speaker === 'enemy') lines.push({ sc, l, i, v: 'n' }); });
  if (lines.length) plans.push({ id: s.id, title: `Rìcháng — ${s.personEn} (${s.en})`, artist: s.personEn, female: isFemale(s.id), situation: s, lines });
}
for (const [v, label, female] of [['f', 'female', true], ['m', 'male', false]]) {
  const lines = [];
  for (const s of situations) for (const sc of scenesBySit[s.id] ?? []) sc.lines.forEach((l, i) => { if (l.speaker === 'player') lines.push({ sc, l, i, v, situation: s }); });
  for (const sc of tutorialScenes) {
    const s = situations.find((x) => x.id === sc.situation);
    if (!s) throw new Error(`tutoriel : situation inconnue ${sc.situation}`);
    sc.lines.forEach((l, i) => { if (l.speaker === 'player') lines.push({ sc, l, i, v, situation: s }); });
  }
  plans.push({ id: `player-${v}`, title: `Rìcháng — the player (${label} voice)`, artist: `Player (${label} voice)`, female, lines });
}

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'richang-tt-'));
const manifest = fs.existsSync(path.join(OUT, 'tt.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'tt.json'), 'utf8')) : { files: {} };
let totalBytes = 0;

for (const plan of plans) {
  if (only && !only.has(plan.id)) continue;
  // 1. Repliques mises bout a bout.
  const parts = [];
  const segs = [];
  let pos = LEAD;
  parts.push(new Int16Array(LEAD));
  let missing = 0;
  let prevTail = 0, gaps = 0, gapSamples = 0;
  for (const { sc, l, i, v, situation } of plan.lines) {
    const key = `${sc.id}-${i}-${v}`;
    const file = path.join(src, `${key}.wav`);
    if (!fs.existsSync(file)) { missing++; continue; }
    const pcm = readWav(file);
    const t = trim(pcm);
    if (segs.length) {
      // Silence a ajouter a cette jonction : ce qui manque au calme apres la voix precedente et avant celle-ci.
      const gap = FIXED_GAP ?? Math.max(0, QUIET_AFTER - prevTail, QUIET_BEFORE - t.head);
      if (gap) { parts.push(new Int16Array(gap)); pos += gap; gaps++; gapSamples += gap; }
    }
    parts.push(pcm.subarray(t.start, t.start + t.length));
    segs.push({ key, sc, l, i, v, situation: situation ?? plan.situation, start: pos, length: t.length, srcStart: t.start, srcFile: `${key}.wav` });
    pos += t.length;
    prevTail = t.tail;
  }
  parts.push(new Int16Array(END));
  pos += END;
  if (!segs.length) { console.warn(`${plan.id} : aucune replique doublee, fichier ignore`); continue; }
  const pcm = new Int16Array(pos);
  let off = 0;
  for (const p of parts) { pcm.set(p, off); off += p.length; }

  // 2. Encodage Ogg Vorbis (24 kHz mono), puis lecture du flux : total de trames et SHA-256 des paquets audio.
  const wav = path.join(tmp, `${plan.id}.wav`);
  const enc = path.join(tmp, `${plan.id}.${EXT}`);
  writeWav(wav, pcm);
  ffmpeg(['-i', wav, '-map_metadata', '-1', ...(CODEC === 'opus'
    ? ['-c:a', 'libopus', '-b:a', BITRATE, '-application', 'voip']
    : ['-c:a', 'libvorbis', '-q:a', String(QUALITY), '-ar', String(RATE)]), '-ac', '1', '-f', 'ogg', enc]);
  const info = readOgg(fs.readFileSync(enc));
  if (info.codec !== CODEC || info.rate !== FRAME_RATE || info.channels !== 1) throw new Error(`${plan.id} : flux inattendu (${info.codec} ${info.rate} Hz)`);
  if (info.total !== pcm.length * SCALE) throw new Error(`${plan.id} : ${info.total} trames dans le flux pour ${pcm.length * SCALE} attendues`);

  // 3. Table des segments (TT_SEGMENT_TABLE) et commentaires : resume, chapitres, table (en dernier : section 11.4).
  // Chaque segment garde tous ses elements (identite, position, USER, FIELD_LIST, ORIGIN), dans l'ordre de la liste XML.
  const ucs = plan.female ? ['VOXFem', 'VOICES', 'FEMALE', 'VOICES-FEMALE'] : ['VOXMale', 'VOICES', 'MALE', 'VOICES-MALE'];
  const allKeywords = new Set(['Mandarin', 'Taiwan', 'dialogue', 'voice']);
  const chapters = [];
  const conversion = CODEC === 'opus' ? `silence trimmed, 24000 Hz to Ogg Opus 48000 Hz ${BITRATE}bit/s` : `silence trimmed, Ogg Vorbis quality ${QUALITY}`;
  const segPairs = segs.map((s, n) => {
    const cueId = n < 999 ? n + 1 : 0;
    const kws = ['Mandarin', 'Taiwan', 'dialogue', s.situation.id, ...s.sc.keywords.map((r) => hanziOf.get(r)).filter(Boolean)];
    kws.forEach((k) => allKeywords.add(k));
    if (cueId) chapters.push([cueId, chapterTime(s.start * SCALE, FRAME_RATE), s.l.zh]);
    const fields = [
      ['SITUATION', s.situation.id], ['SCENE_ID', s.sc.id], ['LINE', s.i], ['SPEAKER', s.l.speaker], ['VOICE', s.v],
      ['TOPIC', s.sc.topic], ['TEXT_ZH', s.l.zh], ['PINYIN', s.l.pinyin], ['TEXT_EN', s.l.en], ['TEXT_FR', s.l.fr],
    ];
    return [
      ['SEGMENT_ID', uuid5(s.key)], ['CUE_ID', cueId], ['START_SAMPLE', s.start * SCALE], ['LENGTH_SAMPLES', s.length * SCALE], ['NAME', s.key],
      ['USER/CATID', ucs[0]], ['USER/CATEGORY', ucs[1]], ['USER/SUBCATEGORY', ucs[2]], ['USER/CATEGORYFULL', ucs[3]],
      ['USER/FXNAME', s.l.zh], ['USER/DESCRIPTION', `${s.l.zh} (${s.l.pinyin}) ${s.l.en}`], ['USER/KEYWORDS', kws.join(', ')],
      ['USER/CREATORID', 'RCH'], ['USER/SOURCEID', 'RICHANG'], ['USER/LIBRARY', 'Richang voices'],
      ...fields.map(([k, v]) => [`FIELD/${k}`, v]),
      ['ORIGIN/FILENAME', s.srcFile], ['ORIGIN/START_SAMPLE', s.srcStart], ['ORIGIN/LENGTH_SAMPLES', s.length],
      ['ORIGIN/SAMPLE_RATE', RATE], ['ORIGIN/BIT_DEPTH', 16], ['ORIGIN/CHANNELS', 1], ['ORIGIN/FORMAT', 'wav'],
      ['ORIGIN/CONVERSION', 'lossy'], ['ORIGIN/CONVERSION_NOTE', conversion],
    ].map(([p, v]) => [p, String(v)]);
  });
  const header = {
    TT_VERSION, WRITER, SAMPLE_RATE: String(FRAME_RATE), TOTAL_FRAMES: String(info.total),
    AUDIO_SHA256: info.audioSha256, SEGMENT_COUNT: String(segs.length),
  };
  const table = tableText(header, segPairs);
  const desc = `${segs.length} lines: ${segs.map((s) => s.l.zh).join(', ')}`;
  const comments = [`TITLE=${plan.title}`, `ARTIST=${plan.artist}`, 'ALBUM=Richang voices', `DESCRIPTION=${desc}`, `COMMENT=${desc}`, `KEYWORDS=${[...allKeywords].join(', ')}`];
  for (const [num, t, name] of chapters) comments.push(`CHAPTER${String(num).padStart(3, '0')}=${t}`, `CHAPTER${String(num).padStart(3, '0')}NAME=${name}`);
  comments.push(`TT_SEGMENT_TABLE=${table}`);

  // 4. Flux reecrit avec ces commentaires (paquets audio inchanges) et controle.
  const out = oggWithComments(fs.readFileSync(enc), comments);
  const check = readOgg(out);
  if (check.audioSha256 !== info.audioSha256 || check.total !== info.total) throw new Error(`${plan.id} : la reecriture a change l'audio`);
  const dest = path.join(OUT, `${plan.id}.${EXT}`);
  fs.writeFileSync(dest, out);
  totalBytes += out.length;
  const prev = manifest.files[plan.id];
  manifest.files[plan.id] = { ...(typeof prev === 'string' ? { vorbis: prev } : prev), [CODEC]: `${plan.id}.${EXT}` };
  const kbps = (out.length * 8) / (pcm.length / RATE) / 1000;
  console.log(`${plan.id.padEnd(18)} ${String(segs.length).padStart(4)} segments · ${(pcm.length / RATE / 60).toFixed(1)} min · ${(out.length / 1024).toFixed(0)} Ko (${kbps.toFixed(1)} kbit/s, table ${(Buffer.byteLength(table) / 1024).toFixed(0)} Ko) · silence ajoute a ${gaps} jonction(s), ${Math.round(gapSamples / (RATE / 1000))} ms${missing ? ` · ${missing} sans wav` : ''}`);

  // 5. Controle : le decodage de chaque segment doit correspondre a son wav, sans decalage.
  if (VERIFY) {
    // Decodage a la frequence du flux (sans reechantillonnage), puis une trame sur SCALE (Opus : 48 kHz -> 24 kHz).
    const raw = ffmpeg(['-i', dest, '-f', 's16le', '-ac', '1', 'pipe:1']);
    const full = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + (raw.length & ~1)));
    const dec = SCALE === 1 ? full : Int16Array.from({ length: Math.floor(full.length / SCALE) }, (_, k) => full[k * SCALE]);
    // Alignement : forme d'onde (Vorbis, lag en echantillons) ; enveloppe d'energie par milliseconde (Opus : le mode
    // SILK ne reproduit pas la forme d'onde, seul l'instant ou l'energie arrive compte). Lag cherche a +/- 20 ms.
    const env = (x, from, n) => { const w = RATE / 1000, out = []; for (let k = 0; k + w <= n; k += w) { let e = 0; for (let j = 0; j < w; j++) { const v = x[from + k + j] ?? 0; e += v * v; } out.push(Math.sqrt(e / w)); } return out; };
    let worst = Infinity, badLag = 0;
    const lagsMs = {};
    for (const s of segs) {
      const ref = pcm.subarray(s.start, s.start + s.length);
      let bestLag = 0;
      if (SCALE === 1) {
        const corr = (lag) => { let a = 0; for (let k = 0; k < ref.length; k += 2) a += ref[k] * (dec[s.start + k + lag] ?? 0); return a; };
        let best = 0;
        for (let lag = -64; lag <= 64; lag++) { const c = corr(lag); if (c > best) { best = c; bestLag = lag; } }
      } else {
        const er = env(pcm, s.start, s.length);
        let best = -Infinity;
        for (let lag = -20; lag <= 20; lag++) {
          const ed = env(dec, s.start + lag * (RATE / 1000), s.length);
          let c = 0; for (let k = 0; k < er.length; k++) c += er[k] * ed[k];
          if (c > best) { best = c; bestLag = lag; }
        }
        lagsMs[bestLag] = (lagsMs[bestLag] ?? 0) + 1;
      }
      if (bestLag !== 0) badLag++;
      let num = 0, den = 0;
      for (let k = 0; k < ref.length; k++) { num += ref[k] * ref[k]; const d = ref[k] - dec[s.start + k]; den += d * d; }
      worst = Math.min(worst, 10 * Math.log10(num / (den || 1)));
    }
    if (SCALE !== 1) console.log("   decalages de l'enveloppe (ms : segments) :", JSON.stringify(lagsMs));
    console.log(`   verification : ${dec.length === pcm.length ? 'longueur exacte' : `longueur ${dec.length} / ${pcm.length}`} · decalage non nul : ${badLag} · pire RSB ${worst.toFixed(1)} dB`);
  }
}
const codecs = new Set(Object.values(manifest.files).flatMap((f) => Object.keys(f)));
manifest.format = `TT File Format ${TT_VERSION} (${[...codecs].sort().reverse().map((c) => (c === 'opus' ? 'Ogg Opus .opus' : 'Ogg Vorbis .ogg')).join(', ')})`;
fs.writeFileSync(path.join(OUT, 'tt.json'), JSON.stringify(manifest, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${(totalBytes / 1024 / 1024).toFixed(1)} Mo ecrits dans ${OUT}`);
