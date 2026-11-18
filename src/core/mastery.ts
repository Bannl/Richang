import { newProgress, review } from './srs';
import { SKILLS, type AppState, type Grade } from './types';

/** Traces sans erreur d'affilee qui donnent l'etoile de maitrise d'une carte. */
export const MASTERY_STREAK = 10;

/**
 * Un trace complet du mot (defi d'ecriture, ecriture en combat Native, Entrainement) : sans aucune erreur, la serie
 * continue ; avec une erreur (ou une reponse abandonnee), elle repart de zero. L'etoile, une fois gagnee, reste.
 * Le trace sur pointilles de l'apprentissage d'une carte n'appelle pas cette fonction.
 */
export function recordDrawing(state: AppState, rank: number, mistakes: number, now: number): AppState {
  const p = state.progress[rank] ?? newProgress(now, SKILLS);
  const streak = mistakes === 0 ? (p.streak ?? 0) + 1 : 0;
  const star = p.star === true || streak >= MASTERY_STREAK;
  return { ...state, progress: { ...state.progress, [rank]: { ...p, streak, star } } };
}

/**
 * Mot trace en entier de memoire (Entrainement, defi d'ecriture) : la competence d'ecriture progresse selon les
 * erreurs, et la serie de maitrise aussi.
 */
export function creditWriting(state: AppState, rank: number, mistakes: number, now: number): AppState {
  const grade: Grade = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
  const drawn = recordDrawing(state, rank, mistakes, now);
  const p = drawn.progress[rank];
  const write = p.skills.write ?? newProgress(now, SKILLS).skills.write;
  return { ...drawn, progress: { ...drawn.progress, [rank]: { ...p, skills: { ...p.skills, write: review(write, grade, now) } } } };
}

/** Etoile de maitrise de la carte (10 traces d'affilee sans erreur). */
export const hasStar = (state: AppState, rank: number): boolean => state.progress[rank]?.star === true;

/** Serie en cours (traces d'affilee sans erreur). */
export const streakOf = (state: AppState, rank: number): number => state.progress[rank]?.streak ?? 0;
