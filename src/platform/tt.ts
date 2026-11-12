// SPDX-License-Identifier: GPL-3.0-or-later OR MIT
// Copyright (C) 2026 Nextale Audio. Reader of the TT File Format: also under the MIT License (LICENSE-MIT, COPYRIGHT.md).
/**
 * Lecteur de fichiers TT (TT File Format, draft 0.3, section 11 : Ogg Vorbis ou Ogg Opus).
 * Un fichier par personnage, une replique par segment. La liste des segments est lue dans le fichier lui-meme : table
 * JSON (commentaire TT_SEGMENT_TABLE, section 11.5, ecrite par le jeu depuis la 0.3) ou liste XML (TT_SEGMENT_LIST,
 * fichiers 0.2) ; pour jouer un segment, seuls les paquets qui le couvrent sont decodes : ils sont remis dans un petit
 * flux Ogg (en-tetes du fichier, granules recalcules) que Web Audio decode, puis coupes a la trame pres.
 */

export type TTCodec = 'vorbis' | 'opus';

export interface TTSegment {
  /** SEGMENT_ID (UUID) : reference « fichier#tt=<id> ». */
  id: string;
  /** NAME : cle de la replique (<scene>-<ligne>-<n|f|m>). */
  name: string;
  /** START_SAMPLE et LENGTH_SAMPLES, en trames du flux (Vorbis : frequence du fichier ; Opus : 48 kHz apres le pre-skip). */
  start: number;
  length: number;
  /** FIELD_LIST (texte, pinyin, traductions, scene...). */
  fields: Record<string, string>;
}

interface Packet { data: Uint8Array; start: number; dur: number }

export interface TTFile {
  url: string;
  codec: TTCodec;
  /** Trames par seconde (SAMPLE_RATE). */
  rate: number;
  total: number;
  segments: TTSegment[];
  byName: Map<string, TTSegment>;
  byId: Map<string, TTSegment>;
  /** Resolu a false si SAMPLE_RATE, TOTAL_FRAMES ou AUDIO_SHA256 ne correspondent pas au flux (segments peut-etre decales). */
  exact: Promise<boolean>;
  /** Paquets d'en-tete (identification ; setup Vorbis). */
  head: Uint8Array;
  setup: Uint8Array | null;
  /** Paquets audio : debut et duree en echantillons de sortie du decodeur. */
  packets: Packet[];
  /** Echantillon de sortie du decodeur qui correspond a la trame 0 (Opus : le pre-skip). */
  zero: number;
}

const OGGS = [0x4f, 0x67, 0x67, 0x53];
const ascii = (b: Uint8Array, from: number, n: number) => String.fromCharCode(...b.subarray(from, from + n));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/** Paquets du premier flux logique, et pour chaque page porteuse d'un granule : dernier paquet termine et granule. */
function readPackets(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packets: Uint8Array[] = [];
  const marks: { last: number; granule: number }[] = [];
  let parts: Uint8Array[] = [];
  let serial = -1;
  let pos = 0;
  while (pos + 27 <= bytes.length) {
    if (OGGS.some((c, k) => bytes[pos + k] !== c)) throw new Error(`pas de page Ogg a l'octet ${pos}`);
    const lo = dv.getUint32(pos + 6, true), hi = dv.getUint32(pos + 10, true);
    const granule = lo === 0xffffffff && hi === 0xffffffff ? -1 : hi * 4294967296 + lo;
    const ser = dv.getUint32(pos + 14, true);
    if (serial < 0) serial = ser;
    const nseg = bytes[pos + 26];
    let off = pos + 27 + nseg;
    for (let k = 0; k < nseg; k++) {
      const lv = bytes[pos + 27 + k];
      if (ser === serial) {
        parts.push(bytes.subarray(off, off + lv));
        if (lv < 255) { packets.push(parts.length === 1 ? parts[0] : concat(parts)); parts = []; }
      }
      off += lv;
    }
    if (ser === serial && granule >= 0 && packets.length) marks.push({ last: packets.length - 1, granule });
    pos = off;
  }
  return { packets, marks };
}

/** En-tete de commentaires (Vorbis ou Opus) -> ["CHAMP=valeur", ...]. */
function readComments(pkt: Uint8Array, magicLength: number): string[] {
  const dv = new DataView(pkt.buffer, pkt.byteOffset, pkt.byteLength);
  const dec = new TextDecoder('utf-8');
  let pos = magicLength;
  pos += 4 + dv.getUint32(pos, true);
  const count = dv.getUint32(pos, true);
  pos += 4;
  const out: string[] = [];
  for (let i = 0; i < count && pos + 4 <= pkt.length; i++) {
    const len = dv.getUint32(pos, true);
    out.push(dec.decode(pkt.subarray(pos + 4, pos + 4 + len)));
    pos += 4 + len;
  }
  return out;
}

/**
 * Taille de bloc (courte 0 / longue 1) de chaque mode Vorbis, lue a la fin de l'en-tete de setup en le parcourant a
 * l'envers (meme methode que FFmpeg, vorbis_parser.c) : chaque mode = blockflag (1 bit), windowtype et transformtype
 * (16 bits, nuls), mapping (8 bits), suivis du bit de cadrage.
 */
function vorbisModeBlockflags(setup: Uint8Array): number[] {
  const n = setup.length;
  const rev = new Uint8Array(n);
  for (let i = 0; i < n; i++) rev[i] = setup[n - 1 - i];
  const total = n * 8;
  let bit = 0;
  const get1 = () => { const v = (rev[bit >> 3] >> (7 - (bit & 7))) & 1; bit++; return v; };
  const get = (k: number) => { let v = 0; for (let i = 0; i < k; i++) v = (v << 1) | get1(); return v; };
  let framing = 0;
  while (total - bit > 97) if (get1()) { framing = bit; break; }
  if (!framing) throw new Error('setup Vorbis : bit de cadrage introuvable');
  let count = 0, last = 0;
  while (total - bit >= 97) {
    if (get(8) > 63 || get(16) || get(16)) break;
    get1();
    count++;
    if (count > 64) break;
    const save = bit;
    if (get(6) + 1 === count) last = count;
    bit = save;
  }
  if (!last) throw new Error('setup Vorbis : modes introuvables');
  bit = framing;
  const flags = new Array<number>(last);
  for (let i = last - 1; i >= 0; i--) { bit += 40; flags[i] = get1(); }
  return flags;
}

/** Duree (echantillons a 48 kHz) d'un paquet Opus, d'apres son octet TOC (RFC 6716, section 3.1). */
function opusPacketSamples(p: Uint8Array): number {
  if (!p.length) return 0;
  const config = p[0] >> 3;
  const frame = config < 12 ? [480, 960, 1920, 2880][config & 3]
    : config < 16 ? [480, 960][config & 1]
    : [120, 240, 480, 960][config & 3];
  const c = p[0] & 3;
  const frames = c === 0 ? 1 : c === 3 ? (p.length > 1 ? p[1] & 0x3f : 0) : 2;
  return frame * frames;
}

async function sha256Hex(parts: Uint8Array[]): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const all = concat(parts);
  const digest = await crypto.subtle.digest('SHA-256', all.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const direct = (el: Element, tag: string): Element | undefined => [...el.children].find((c) => c.tagName === tag);
const text = (el: Element | undefined, tag: string) => (el ? direct(el, tag)?.textContent ?? '' : '');

/** Liste des segments et en-tete utile (SAMPLE_RATE, TOTAL_FRAMES, AUDIO_SHA256), quelle que soit sa forme. */
interface SegmentList { rate: number; total: number; sha: string; segments: TTSegment[] }

/** Valeur d'un commentaire (nom insensible a la casse, comme les commentaires Vorbis). */
function commentValue(comments: string[], key: string): string | undefined {
  const n = key.length + 1;
  return comments.find((c) => c.slice(0, n).toUpperCase() === `${key}=`)?.slice(n);
}

/**
 * Table de segments (section 11.5) : un JSON.parse. La valeur d'un chemin est la cellule de la ligne, sinon celle de
 * DEFAULTS (cellule null, ou ligne plus courte que COLUMNS) ; une chaine vide dans une cellule l'emporte. Les fichiers
 * du jeu ecrivent chaque SEGMENT_ID (pas d'ID_NAMESPACE : sans lui, l'identifiant reste vide).
 */
function tableList(value: string): SegmentList {
  const t = JSON.parse(value) as Record<string, unknown> & { COLUMNS: string[]; ROWS: (string | null)[][]; DEFAULTS?: Record<string, string> };
  if (!Array.isArray(t.COLUMNS) || !Array.isArray(t.ROWS)) throw new Error('table TT illisible (COLUMNS, ROWS)');
  const index = new Map(t.COLUMNS.map((p, i) => [p, i]));
  const defaults = t.DEFAULTS ?? {};
  const fieldPaths = [...new Set([...t.COLUMNS, ...Object.keys(defaults)])].filter((p) => p.startsWith('FIELD/'));
  const segments = t.ROWS.map((row): TTSegment => {
    const cell = (path: string): string | undefined => {
      const i = index.get(path);
      const v: string | null | undefined = i === undefined ? undefined : row[i];   // au-dela de la ligne : undefined
      return v ?? defaults[path];
    };
    const fields: Record<string, string> = {};
    for (const p of fieldPaths) { const v = cell(p); if (v !== undefined) fields[p.slice(6)] = v; }
    return { id: cell('SEGMENT_ID') ?? '', name: cell('NAME') ?? '', start: Number(cell('START_SAMPLE')), length: Number(cell('LENGTH_SAMPLES')), fields };
  });
  return { rate: Number(t.SAMPLE_RATE), total: Number(t.TOTAL_FRAMES), sha: String(t.AUDIO_SHA256 ?? '').toLowerCase(), segments };
}

/** Liste XML (sections 5 et 11.2, fichiers 0.2). */
function xmlList(value: string): SegmentList {
  const root = new DOMParser().parseFromString(value, 'application/xml').documentElement;
  if (root.tagName !== 'TT_SEGMENT_LIST') throw new Error('liste TT illisible');
  const segments: TTSegment[] = [...root.children].filter((e) => e.tagName === 'TT_SEGMENT').map((e) => {
    const fields: Record<string, string> = {};
    for (const f of [...(direct(e, 'FIELD_LIST')?.children ?? [])]) if (f.tagName === 'FIELD') fields[text(f, 'NAME')] = text(f, 'VALUE');
    return { id: text(e, 'SEGMENT_ID'), name: text(e, 'NAME'), start: Number(text(e, 'START_SAMPLE')), length: Number(text(e, 'LENGTH_SAMPLES')), fields };
  });
  return { rate: Number(text(root, 'SAMPLE_RATE')), total: Number(text(root, 'TOTAL_FRAMES')), sha: text(root, 'AUDIO_SHA256').toLowerCase(), segments };
}

/** Charge et indexe un fichier TT. */
export async function loadTT(url: string): Promise<TTFile> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { packets: raw, marks } = readPackets(bytes);
  const head = raw[0];
  let codec: TTCodec, rate: number, nhead: number, magic: number, preskip = 0;
  if (head && head[0] === 1 && ascii(head, 1, 6) === 'vorbis') { codec = 'vorbis'; nhead = 3; magic = 7; rate = new DataView(head.buffer, head.byteOffset).getUint32(12, true); }
  else if (head && ascii(head, 0, 8) === 'OpusHead') { codec = 'opus'; nhead = 2; magic = 8; rate = 48000; preskip = head[10] | (head[11] << 8); }
  else throw new Error(`${url} : ni Ogg Vorbis ni Ogg Opus`);
  const comments = readComments(raw[1], magic);
  const setup = codec === 'vorbis' ? raw[2] : null;

  // Duree de chaque paquet audio : TOC (Opus) ; tailles de bloc precedente et courante (Vorbis, 1er paquet : rien).
  const audio = raw.slice(nhead);
  const packets: Packet[] = [];
  let acc = 0;
  if (codec === 'opus') {
    for (const data of audio) { const dur = opusPacketSamples(data); packets.push({ data, start: acc, dur }); acc += dur; }
  } else {
    const bs = [1 << (head[28] & 0x0f), 1 << (head[28] >> 4)];
    const flags = vorbisModeBlockflags(setup!);
    const modeBits = Math.ceil(Math.log2(flags.length));
    let prev = -1;
    for (const data of audio) {
      const mode = flags.length > 1 ? (data[0] >> 1) & ((1 << modeBits) - 1) : 0;
      const cur = bs[flags[mode] ?? 0];
      const dur = prev < 0 ? 0 : (prev + cur) / 4;
      packets.push({ data, start: acc, dur });
      acc += dur;
      prev = cur;
    }
  }
  // Recalage sur les granules (verite du flux) : sortie du decodeur = granule (Opus : pre-skip compris).
  const firstAudio = marks.find((m) => m.last >= nhead);
  const lastMark = marks[marks.length - 1];
  const endOf = (i: number) => packets[i - nhead].start + packets[i - nhead].dur;
  const delta = firstAudio ? endOf(firstAudio.last) - firstAudio.granule : 0;
  const zero = preskip + delta;
  const total = lastMark ? lastMark.granule - preskip : 0;

  // Liste des segments : la table, ou la liste XML. Les deux a la fois (un programme 0.2 a ajoute une liste apres la
  // table) : la spec demande de le signaler et de prendre la liste XML (section 11.5).
  const tableText = commentValue(comments, 'TT_SEGMENT_TABLE');
  const listText = commentValue(comments, 'TT_SEGMENT_LIST');
  if (tableText !== undefined && listText !== undefined) console.warn(`${url} : TT_SEGMENT_TABLE et TT_SEGMENT_LIST a la fois, liste XML retenue`);
  let list: SegmentList;
  try {
    if (listText !== undefined) list = xmlList(listText);
    else if (tableText !== undefined) list = tableList(tableText);
    else throw new Error('ni TT_SEGMENT_TABLE ni TT_SEGMENT_LIST');
  } catch (e) {
    throw new Error(`${url} : ${(e as Error).message}`);
  }
  const { segments } = list;

  // Integrite (spec, section 8) : la liste doit decrire ce flux-ci.
  const exact = sha256Hex(audio).then((sha) => {
    const ok = list.rate === rate && list.total === total && (!sha || !list.sha || sha === list.sha);
    if (!ok) console.warn(`${url} : la liste TT ne correspond plus a l'audio (segments peut-etre decales)`);
    return ok;
  });
  return {
    url, codec, rate, total, segments, exact, head, setup, packets, zero,
    byName: new Map(segments.map((s) => [s.name, s])),
    byId: new Map(segments.map((s) => [s.id, s])),
  };
}

// --- Mini-flux Ogg et decodage d'un segment ---

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let r = i << 24; for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; t[i] = r >>> 0; }
  return t;
})();

function page(htype: number, granule: number, seq: number, packets: Uint8Array[]): Uint8Array {
  const lacing: number[] = [];
  for (const p of packets) { for (let n = p.length; n >= 255; n -= 255) lacing.push(255); lacing.push(p.length % 255); }
  const body = concat(packets);
  const out = new Uint8Array(27 + lacing.length + body.length);
  const dv = new DataView(out.buffer);
  out.set(OGGS, 0);
  out[5] = htype;
  dv.setUint32(6, granule % 4294967296, true);
  dv.setUint32(10, Math.floor(granule / 4294967296), true);
  dv.setUint32(14, 0x52434847, true);
  dv.setUint32(18, seq, true);
  out[26] = lacing.length;
  out.set(lacing, 27);
  out.set(body, 27 + lacing.length);
  let crc = 0;
  for (let i = 0; i < out.length; i++) crc = ((crc << 8) ^ CRC[((crc >>> 24) ^ out[i]) & 0xff]) >>> 0;
  dv.setUint32(22, crc, true);
  return out;
}

/** Flux Ogg minimal : en-tetes du fichier (commentaires vides, Opus sans pre-skip) et les paquets [i0, i1]. */
function miniOgg(f: TTFile, i0: number, i1: number): Uint8Array {
  const pages: Uint8Array[] = [];
  if (f.codec === 'opus') {
    const head = f.head.slice();
    head[10] = 0; head[11] = 0;                                        // pre-skip : la coupe se fait ici
    pages.push(page(0x02, 0, 0, [head]));
    pages.push(page(0x00, 0, 1, [Uint8Array.from([...'OpusTags'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0, 0, 0, 0, 0]))]));
  } else {
    pages.push(page(0x02, 0, 0, [f.head]));
    const comment = Uint8Array.from([3, ...[...'vorbis'].map((c) => c.charCodeAt(0)), 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    pages.push(page(0x00, 0, 1, [comment, f.setup!]));
  }
  let granule = 0;
  let batch: Uint8Array[] = [];
  let lace = 0;
  for (let i = i0; i <= i1; i++) {
    const p = f.packets[i];
    granule += f.codec === 'vorbis' && i === i0 ? 0 : p.dur;           // Vorbis : le 1er paquet ne sort rien
    batch.push(p.data);
    lace += Math.floor(p.data.length / 255) + 1;
    const last = i === i1;
    if (last || lace > 200) {
      pages.push(page(last ? 0x04 : 0x00, granule, pages.length, batch));
      batch = []; lace = 0;
    }
  }
  return concat(pages);
}

const PREROLL_OPUS = 3840; // 80 ms : le decodeur Opus converge avant le debut du segment (RFC 7845, section 4.6)

/** Decode un segment seul : ses echantillons exacts, a la frequence du flux. */
export async function decodeSegment(f: TTFile, seg: TTSegment): Promise<AudioBuffer> {
  const a = seg.start + f.zero;               // premier echantillon voulu (sortie du decodeur)
  const b = a + seg.length;
  const ps = f.packets;
  const find = (x: number) => { let lo = 0, hi = ps.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ps[mid].start <= x) lo = mid; else hi = mid - 1; } return lo; };
  let i0: number, outZero: number;
  if (f.codec === 'opus') { i0 = find(Math.max(0, a - PREROLL_OPUS)); outZero = ps[i0].start; }
  else {
    // Vorbis : le 1er paquet decode ne sort rien et le 2e sort son recouvrement sans le 1er (fondu depuis zero) ;
    // deux paquets d'amorce avant celui qui contient le debut du segment donnent des echantillons exacts.
    const k = Math.max(1, find(a));
    i0 = Math.max(0, k - 2);
    outZero = ps[i0 + 1].start;
  }
  let i1 = find(b);
  if (ps[i1].start + ps[i1].dur < b && i1 < ps.length - 1) i1++;
  // Vorbis : le demultiplexeur (FFmpeg dans Chromium) compte une duree nominale pour le 1er paquet, qui ne sort rien,
  // et retire autant d'echantillons a la fin du mini-flux ; quelques paquets de plus apres le segment le couvrent.
  if (f.codec === 'vorbis') while (i1 < ps.length - 1 && ps[i1].start < b + 2048) i1++;
  const ctx = new OfflineAudioContext(1, 1, f.rate);
  const decoded = await ctx.decodeAudioData(miniOgg(f, i0, i1).buffer as ArrayBuffer);
  const out = new AudioBuffer({ length: seg.length, sampleRate: f.rate, numberOfChannels: 1 });
  const src = decoded.getChannelData(0);
  const off = a - outZero;
  out.copyToChannel(src.subarray(off, Math.min(src.length, off + seg.length)), 0);
  return out;
}
