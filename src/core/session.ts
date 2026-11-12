import type { AppState, Settings, Skill, Word } from './types';
import { SKILLS } from './types';
import { dayKey, endOfDay } from './srs';

export type ItemKind = Skill | 'intro';
export interface SessionItem { rank: number; kind: ItemKind; isNew: boolean }

export function enabledSkills(settings: Settings): Skill[] {
  return SKILLS.filter((k) => settings.skills[k]);
}

interface DueItem extends SessionItem { due: number }

export function dueReviews(words: Word[], state: AppState, now: number): DueItem[] {
  const end = endOfDay(now);
  const enabled = enabledSkills(state.settings);
  const out: DueItem[] = [];
  for (const w of words) {
    const p = state.progress[w.rank];
    if (!p) continue;
    for (const k of enabled) {
      const s = p.skills[k];
      if (s && s.due <= end) out.push({ rank: w.rank, kind: k, isNew: false, due: s.due });
    }
  }
  out.sort((a, b) => a.due - b.due);
  return out;
}

export function countDue(words: Word[], state: AppState, now: number): number {
  return dueReviews(words, state, now).length;
}

/** Mots jamais introduits, dans l'ordre d'introduction. */
export function newCandidates(words: Word[], state: AppState): Word[] {
  const all = [...words].sort((a, b) => a.rank - b.rank);
  const ordered = state.settings.newOrder === 'theme' ? all : orderMixed(all);
  return ordered.filter((w) => !state.progress[w.rank]);
}

/** "mixte" : a l'interieur de chaque palier, on alterne les themes (tour de role). */
export function orderMixed(fresh: Word[]): Word[] {
  const out: Word[] = [];
  const tiers = [...new Set(fresh.map((w) => w.tier))].sort((a, b) => a - b);
  for (const t of tiers) {
    const queues = new Map<string, Word[]>();
    for (const w of fresh) {
      if (w.tier !== t) continue;
      if (!queues.has(w.theme)) queues.set(w.theme, []);
      queues.get(w.theme)!.push(w);
    }
    const lists = [...queues.values()];
    let remaining = lists.reduce((n, l) => n + l.length, 0);
    while (remaining > 0) {
      for (const l of lists) {
        const w = l.shift();
        if (w) { out.push(w); remaining--; }
      }
    }
  }
  return out;
}

export function newWordsToday(state: AppState, now: number): number {
  const today = dayKey(now);
  let n = 0;
  for (const p of Object.values(state.progress)) if (dayKey(p.intro) === today) n++;
  return n;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildSession(words: Word[], state: AppState, now: number): SessionItem[] {
  const { settings } = state;
  const reviews: SessionItem[] = shuffle(dueReviews(words, state, now).slice(0, settings.maxReviews))
    .map(({ rank, kind, isNew }) => ({ rank, kind, isNew }));
  const nNew = Math.max(0, settings.newPerDay - newWordsToday(state, now));
  const fresh = newCandidates(words, state).slice(0, nNew);
  const blocks = fresh.map((w) => {
    const b: SessionItem[] = [{ rank: w.rank, kind: 'intro', isNew: true }];
    if (settings.skills.read) b.push({ rank: w.rank, kind: 'read', isNew: true });
    if (settings.skills.write) b.push({ rank: w.rank, kind: 'write', isNew: true });
    return b;
  });
  // Les nouveaux mots sont repartis entre les revisions.
  const out: SessionItem[] = [];
  const per = blocks.length ? Math.floor(reviews.length / (blocks.length + 1)) : reviews.length;
  let i = 0;
  for (const b of blocks) {
    out.push(...reviews.slice(i, i + per));
    i += per;
    out.push(...b);
  }
  out.push(...reviews.slice(i));
  return out;
}
