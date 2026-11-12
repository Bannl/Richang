import type { Grade, Skill, SkillState, WordProgress, WordStatus } from './types';

export const DAY = 86_400_000;
/** Intervalle (jours) a partir duquel une competence est consideree acquise. */
export const MASTERY_INTERVAL = 21;

export function newSkill(now: number, due = now): SkillState {
  return { reps: 0, interval: 0, ease: 2.5, due, lapses: 0, last: 0 };
}

export function newProgress(now: number, skills: readonly Skill[]): WordProgress {
  const s = {} as Record<Skill, SkillState>;
  for (const k of skills) s[k] = newSkill(now);
  return { intro: now, skills: s };
}

/** Variante simplifiee de SM-2, par competence. */
export function review(s: SkillState, grade: Grade, now: number): SkillState {
  let { reps, interval, ease, lapses } = s;
  if (grade === 0) {
    if (reps > 0) lapses++;
    ease = Math.max(1.3, ease - 0.2);
    return { reps: 0, interval: 0, ease, lapses, last: now, due: now + 10 * 60_000 };
  }
  let next: number;
  if (grade === 1) {
    ease = Math.max(1.3, ease - 0.15);
    next = reps === 0 ? 1 : interval * 1.2;
  } else if (grade === 2) {
    next = reps === 0 ? 1 : reps === 1 ? 3 : interval * ease;
  } else {
    ease += 0.15;
    next = reps === 0 ? 4 : interval * ease * 1.3;
  }
  next = Math.round(Math.max(1, Math.min(next, 365)));
  // Legere dispersion (+/- 5 %) pour eviter les paquets de revisions.
  const fuzz = 1 + ((((now / 1000) | 0) % 11) - 5) / 100;
  const dueDays = Math.max(1, next * fuzz);
  return { reps: reps + 1, interval: next, ease, lapses, last: now, due: now + dueDays * DAY };
}

export function isMastered(p: WordProgress, enabled: readonly Skill[]): boolean {
  return enabled.length > 0 && enabled.every((k) => (p.skills[k]?.interval ?? 0) >= MASTERY_INTERVAL);
}

export function wordStatus(p: WordProgress | undefined, enabled: readonly Skill[]): WordStatus {
  if (!p) return 'new';
  if (isMastered(p, enabled)) return 'mastered';
  if (enabled.some((k) => (p.skills[k]?.reps ?? 0) === 0)) return 'learning';
  return 'review';
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
