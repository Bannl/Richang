import type { AppState, Grade, Lang, Skill, Word } from './types';
import { glosses } from '../i18n';
import { SKILLS } from './types';
import { dayKey, newProgress, review } from './srs';

function dayStats(state: AppState, now: number) {
  const key = dayKey(now);
  return { key, stats: state.days[key] ?? { reviews: 0, correct: 0, newWords: 0 } };
}

/** Introduit un nouveau mot : toutes les competences deviennent dues aujourd'hui. */
export function introduceWord(state: AppState, rank: number, now: number): AppState {
  if (state.progress[rank]) return state;
  const { key, stats } = dayStats(state, now);
  return {
    ...state,
    progress: { ...state.progress, [rank]: newProgress(now, SKILLS) },
    days: { ...state.days, [key]: { ...stats, newWords: stats.newWords + 1 } },
  };
}

export function applyGrade(state: AppState, rank: number, skill: Skill, grade: Grade, now: number): AppState {
  const p = state.progress[rank] ?? newProgress(now, SKILLS);
  const cur = p.skills[skill] ?? newProgress(now, SKILLS).skills[skill];
  const { key, stats } = dayStats(state, now);
  return {
    ...state,
    progress: { ...state.progress, [rank]: { ...p, skills: { ...p.skills, [skill]: review(cur, grade, now) } } },
    days: { ...state.days, [key]: { ...stats, reviews: stats.reviews + 1, correct: stats.correct + (grade > 0 ? 1 : 0) } },
  };
}

/** 3 mots distracteurs (meme theme de preference, sens affiches differents). */
export function pickDistractors(word: Word, all: Word[], lang: Lang, n = 3): Word[] {
  const g = (w: Word) => glosses(w, lang)[0];
  const pool = all.filter((w) => w.rank !== word.rank && g(w) !== g(word));
  const same = pool.filter((w) => w.theme === word.theme && Math.abs(w.tier - word.tier) <= 1);
  const pick = (list: Word[], out: Word[]) => {
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    for (const w of shuffled) {
      if (out.length >= n) break;
      if (out.some((o) => g(o) === g(w))) continue;
      out.push(w);
    }
    return out;
  };
  const out = pick(same, []);
  return out.length < n ? pick(pool, out) : out;
}
