// SPDX-License-Identifier: GPL-3.0-or-later OR MIT
// Copyright (C) 2026 Nextale Audio. Ogg code of the TT File Format: also under the MIT License (LICENSE-MIT, COPYRIGHT.md).
// Ogg (RFC 3533) pour les fichiers TT (TT File Format, draft 0.2, section 11) : lecture des pages et des paquets,
// commentaires Vorbis, reecriture du flux avec un nouvel en-tete de commentaires (les paquets audio sont gardes octet
// pour octet, les pages renumerotees). Meme logique que kit/make_tt_spec_samples.py (read_ogg, ogg_with_comments).
import crypto from 'node:crypto';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    t[i] = r >>> 0;
  }
  return t;
})();

/** CRC-32 d'une page Ogg (polynome 0x04C11DB7, valeur initiale 0, non reflechi). */
export function oggCrc(buf) {
  let crc = 0;
  for (let i = 0; i < buf.length; i++) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ buf[i]) & 0xff]) >>> 0;
  return crc >>> 0;
}

/** Une page : type, granule (BigInt, -1n = aucun paquet ne finit sur la page), serie, numero, lacing, corps. */
export function oggPage(htype, granule, serial, seq, lacing, body) {
  const head = Buffer.alloc(27 + lacing.length);
  head.write('OggS', 0, 'ascii');
  head[4] = 0;
  head[5] = htype;
  head.writeBigInt64LE(BigInt(granule), 6);
  head.writeUInt32LE(serial >>> 0, 14);
  head.writeUInt32LE(seq >>> 0, 18);
  head.writeUInt32LE(0, 22);
  head[26] = lacing.length;
  for (let i = 0; i < lacing.length; i++) head[27 + i] = lacing[i];
  const page = Buffer.concat([head, body]);
  page.writeUInt32LE(oggCrc(page), 22);
  return page;
}

/** La meme page avec un autre numero de sequence (et son CRC). */
export function oggRenumber(raw, seq) {
  const page = Buffer.from(raw);
  page.writeUInt32LE(seq >>> 0, 18);
  page.writeUInt32LE(0, 22);
  page.writeUInt32LE(oggCrc(page), 22);
  return page;
}

export const oggLacing = (size) => [...Array(Math.floor(size / 255)).fill(255), size % 255];

/** En-tete de commentaires -> { vendor, comments: ["CHAMP=valeur", ...] }. */
export function parseComments(pkt, magic) {
  if (!pkt.subarray(0, magic.length).equals(magic)) throw new Error('en-tete de commentaires introuvable');
  let pos = magic.length;
  const n = pkt.readUInt32LE(pos);
  const vendor = pkt.subarray(pos + 4, pos + 4 + n);
  pos += 4 + n;
  const count = pkt.readUInt32LE(pos);
  pos += 4;
  const comments = [];
  for (let i = 0; i < count; i++) {
    const len = pkt.readUInt32LE(pos);
    comments.push(pkt.subarray(pos + 4, pos + 4 + len).toString('utf8'));
    pos += 4 + len;
  }
  return { vendor, comments };
}

export function buildComments(magic, vendor, comments) {
  const parts = [magic, u32(vendor.length), vendor, u32(comments.length)];
  for (const c of comments) {
    const b = Buffer.from(c, 'utf8');
    parts.push(u32(b.length), b);
  }
  if (magic.equals(VORBIS_COMMENT)) parts.push(Buffer.from([1])); // bit de cadrage Vorbis
  return Buffer.concat(parts);
}

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
export const VORBIS_COMMENT = Buffer.from('\x03vorbis', 'latin1');
const OPUS_TAGS = Buffer.from('OpusTags', 'latin1');

/** Pages, paquets [{ data, page }], codec, frequence decodee, total de trames, SHA-256 des paquets audio. */
export function readOgg(data) {
  const pages = [];
  let pos = 0;
  while (pos < data.length) {
    if (data.toString('ascii', pos, pos + 4) !== 'OggS' || data.length < pos + 27) throw new Error(`pas de page Ogg a l'octet ${pos}`);
    const htype = data[pos + 5];
    const granule = data.readBigInt64LE(pos + 6);
    const serial = data.readUInt32LE(pos + 14);
    const seq = data.readUInt32LE(pos + 18);
    const nseg = data[pos + 26];
    const lacing = [...data.subarray(pos + 27, pos + 27 + nseg)];
    const start = pos + 27 + nseg;
    const end = start + lacing.reduce((a, b) => a + b, 0);
    if (end > data.length) throw new Error(`page Ogg tronquee a l'octet ${pos}`);
    pages.push({ htype, granule, serial, seq, lacing, body: data.subarray(start, end), raw: data.subarray(pos, end) });
    pos = end;
  }
  const serial0 = pages[0].serial;
  const packets = [];
  let cur = [];
  pages.forEach((p, i) => {
    if (p.serial !== serial0) return;
    let off = 0;
    for (const lv of p.lacing) {
      cur.push(p.body.subarray(off, off + lv));
      off += lv;
      if (lv < 255) { packets.push({ data: Buffer.concat(cur), page: i }); cur = []; }
    }
  });
  const head = packets[0].data;
  let codec, nhead, magic, rate, channels, preskip = 0;
  if (head.toString('latin1', 0, 7) === '\x01vorbis') {
    codec = 'vorbis'; nhead = 3; magic = VORBIS_COMMENT; channels = head[11]; rate = head.readUInt32LE(12);
  } else if (head.toString('latin1', 0, 8) === 'OpusHead') {
    codec = 'opus'; nhead = 2; magic = OPUS_TAGS; channels = head[9]; rate = 48000; preskip = head.readUInt16LE(10);
  } else throw new Error('ni Ogg Vorbis ni Ogg Opus');
  const { vendor, comments } = parseComments(packets[1].data, magic);
  const granules = pages.filter((p) => p.serial === serial0 && p.granule >= 0n).map((p) => p.granule);
  const sha = crypto.createHash('sha256');
  for (const p of packets.slice(nhead)) sha.update(p.data);
  return {
    pages, packets, codec, nhead, magic, rate, channels, preskip, vendor, comments,
    total: granules.length ? Number(granules[granules.length - 1]) - preskip : 0,
    serials: [...new Set(pages.map((p) => p.serial))], audioSha256: sha.digest('hex'), unfinished: cur.length,
  };
}

/** Pages des paquets d'en-tete : un paquet peut continuer sur la page suivante ; granule 0 si un paquet finit sur la page, -1 sinon. */
function paginateHeaders(packets, maxSegments = 255) {
  const segs = [];
  for (const pkt of packets) {
    const lac = oggLacing(pkt.length);
    lac.forEach((lv, k) => segs.push([lv, k === lac.length - 1]));
  }
  const stream = Buffer.concat(packets);
  const out = [];
  let off = 0;
  let continued = false;
  for (let i = 0; i < segs.length; i += maxSegments) {
    const part = segs.slice(i, i + maxSegments);
    const size = part.reduce((a, [lv]) => a + lv, 0);
    out.push({ htype: continued ? 0x01 : 0x00, granule: part.some(([, end]) => end) ? 0n : -1n, lacing: part.map(([lv]) => lv), body: stream.subarray(off, off + size) });
    continued = !part[part.length - 1][1];
    off += size;
  }
  return out;
}

/** Le meme flux avec un nouvel en-tete de commentaires ; paquet d'identification, setup Vorbis et pages audio gardes. */
export function oggWithComments(data, comments) {
  const info = readOgg(data);
  const { pages, packets, nhead } = info;
  if (info.serials.length !== 1) throw new Error('plus d\'un flux logique');
  const lastHead = packets[nhead - 1].page;
  const headBytes = pages.slice(0, lastHead + 1).reduce((a, p) => a + p.body.length, 0);
  if (headBytes !== packets.slice(0, nhead).reduce((a, p) => a + p.data.length, 0)) throw new Error('des donnees audio partagent une page avec les en-tetes');
  const serial = pages[0].serial;
  const heads = [buildComments(info.magic, info.vendor, comments)];
  if (info.codec === 'vorbis') heads.push(packets[2].data);
  const out = [oggPage(0x02, 0n, serial, 0, oggLacing(packets[0].data.length), packets[0].data)];
  for (const p of paginateHeaders(heads)) out.push(oggPage(p.htype, p.granule, serial, out.length, p.lacing, p.body));
  for (const p of pages.slice(lastHead + 1)) out.push(oggRenumber(p.raw, out.length));
  return Buffer.concat(out);
}
