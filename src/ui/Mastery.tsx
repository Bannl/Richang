import { hasStar, MASTERY_STREAK, streakOf } from '../core/mastery';
import type { AppState } from '../core/types';
import { useT } from '../i18n';
import { StarMark } from './cards';

/** Maitrise du trace d'une carte : etoile gagnee, ou serie en cours (traces d'affilee sans erreur, sur 10). */
export function MasteryLine({ state, rank }: { state: AppState; rank: number }) {
  const t = useT();
  if (hasStar(state, rank)) return <span className="mastery-line on"><StarMark /> {t('masteryStar')}</span>;
  return <span className="mastery-line"><StarMark /> {t('masteryStreak', { n: streakOf(state, rank), max: MASTERY_STREAK })}</span>;
}
