// Decoupage des repliques comme le jeu (src/game/lines.ts) : plus long mot de la liste d'abord (5 caracteres au plus),
// avec les exceptions de src/data/segment-splits.json (groupe -> morceaux ; un morceau prefixe de ~ reste du texte).
import fs from 'node:fs';

const isHan = (c) => /\p{Script=Han}/u.test(c);
const MAX_LEN = 5;
const raw = JSON.parse(fs.readFileSync('src/data/segment-splits.json', 'utf8'));
const SPLITS = Object.entries(raw)
  .filter(([k, v]) => !k.startsWith('_') && Array.isArray(v))
  .map(([k, parts]) => [[...k], parts])
  .sort((a, b) => b[0].length - a[0].length);

/** Mots de la liste trouves (rangs, dans l'ordre) et nombre de caracteres chinois hors liste. */
export function segmentRanks(zh, dict) {
  const chars = [...zh]; const ranks = []; let unknown = 0; let i = 0;
  while (i < chars.length) {
    if (!isHan(chars[i])) { i++; continue; }
    const ex = SPLITS.find(([key]) => key.every((c, k) => chars[i + k] === c));
    if (ex) {
      for (const part of ex[1]) {
        const text = part.startsWith('~') ? part.slice(1) : part;
        const r = part.startsWith('~') ? undefined : dict.get(text);
        if (r !== undefined) ranks.push(r); else unknown += [...text].filter(isHan).length;
      }
      i += ex[0].length;
      continue;
    }
    let hit = false;
    for (let len = Math.min(MAX_LEN, chars.length - i); len >= 1; len--) {
      const cand = chars.slice(i, i + len).join('');
      if (dict.has(cand)) { ranks.push(dict.get(cand)); i += len; hit = true; break; }
    }
    if (!hit) { unknown++; i++; }
  }
  return { ranks, unknown };
}
