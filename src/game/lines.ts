import type { Word } from '../core/types';
import type { Line } from './types';

const isHan = (c: string) => /\p{Script=Han}/u.test(c);
const MAX_WORD_LEN = 5;

/** Dictionnaire hanzi -> rang, pour decouper les phrases en mots connus. */
export function buildDictionary(words: Word[]): Map<string, number> {
  const dict = new Map<string, number>();
  for (const w of words) if (!dict.has(w.hanzi)) dict.set(w.hanzi, w.rank);
  return dict;
}

export interface Segment { text: string; rank: number | null }

/** Decoupage par plus longue correspondance (les caracteres inconnus restent isoles). */
export function segment(zh: string, dict: Map<string, number>): Segment[] {
  const chars = [...zh];
  const out: Segment[] = [];
  let i = 0;
  while (i < chars.length) {
    if (!isHan(chars[i])) { out.push({ text: chars[i], rank: null }); i++; continue; }
    let matched = false;
    for (let len = Math.min(MAX_WORD_LEN, chars.length - i); len >= 1; len--) {
      const candidate = chars.slice(i, i + len).join('');
      const rank = dict.get(candidate);
      if (rank !== undefined) { out.push({ text: candidate, rank }); i += len; matched = true; break; }
    }
    if (!matched) { out.push({ text: chars[i], rank: null }); i++; }
  }
  return out;
}

/**
 * Toutes les phrases a trou jouables avec un deck : pour chaque phrase d'exemple, chaque mot du deck
 * qui y apparait peut devenir le trou. Le theme d'une phrase est celui du mot dont elle est l'exemple.
 */
export function buildLinePool(words: Word[], deck: Set<number>, dict: Map<string, number>): Line[] {
  const pool: Line[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const ex = w.example;
    if (!ex?.zh) continue;
    const ranks = new Set<number>();
    for (const s of segment(ex.zh, dict)) if (s.rank !== null && deck.has(s.rank)) ranks.add(s.rank);
    for (const rank of ranks) {
      const key = ex.zh + '#' + rank;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push({ zh: ex.zh, pinyin: ex.pinyin, fr: ex.fr, en: ex.en ?? ex.fr, answer: rank, source: w.rank, theme: w.theme });
    }
  }
  return pool;
}

export interface BlankedLine { before: string; after: string; pinyin: string | null }

/** Phrase avec le mot-reponse retire ; le pinyin des syllabes correspondantes est masque (null si non alignable). */
export function blankLine(line: Line, answer: Word): BlankedLine {
  const idx = line.zh.indexOf(answer.hanzi);
  if (idx < 0) return { before: line.zh, after: '', pinyin: null };
  const before = line.zh.slice(0, idx);
  const after = line.zh.slice(idx + answer.hanzi.length);
  const hanBefore = [...before].filter(isHan).length;
  const hanWord = [...answer.hanzi].filter(isHan).length;
  const hanTotal = [...line.zh].filter(isHan).length;
  const syls = line.pinyin.replace(/[,，.。!！?？;；:：、]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (syls.length !== hanTotal) return { before, after, pinyin: null };
  const masked = [...syls.slice(0, hanBefore), '____', ...syls.slice(hanBefore + hanWord)];
  return { before, after, pinyin: masked.join(' ') };
}
