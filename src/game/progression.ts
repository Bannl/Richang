import type { FightType } from './types';

/**
 * Regles d'une journee de l'aventure : plus on enchaine les journees, plus les rencontres sont longues, les repliques
 * complexes et les mots a placer nombreux et rares.
 *  - lines : longueur visee d'une rencontre (repliques) ; on joue la scene la plus proche, jamais deux scenes collees
 *    (la conversation doit rester coherente) ;
 *  - blanks : trous maximum par replique ;
 *  - level : niveau de complexite vise des scenes (1 a 5, quintiles du corpus : longueur des phrases, rarete des mots) ;
 *  - commonCut : les mots plus frequents que ce rang ne deviennent des trous qu'en dernier recours (le vocabulaire a
 *    placer devient plus riche au fil des jours).
 */
export interface DayRules {
  lines: Record<FightType, number>;
  blanks: Record<FightType, number>;
  level: number;
  commonCut: number;
}

export function dayRules(day: number): DayRules {
  const d = Math.max(1, Math.floor(day));
  const base = d <= 2 ? 4 : d <= 5 ? 6 : d <= 9 ? 8 : 10;
  const extra = Math.floor((d - 1) / 5);
  return {
    lines: { fight: base, elite: base + 2, boss: Math.min(12, base + 4) },
    blanks: { fight: Math.min(3, 1 + extra), elite: Math.min(3, 2 + extra), boss: Math.min(3, 2 + extra) },
    level: Math.min(5, Math.ceil(d / 2)),
    commonCut: Math.min(300, 40 * (d - 1)),
  };
}

/** Regles du mode Situation : la scene choisie se joue en entier, un mot a placer par replique. */
export const DRILL_RULES: DayRules = {
  lines: { fight: 0, elite: 0, boss: 0 },
  blanks: { fight: 1, elite: 1, boss: 1 },
  level: 0,
  commonCut: 0,
};

/**
 * Ecart d'une scene a la journee : longueur et niveau. Une scene plus difficile que prevu coute plus qu'une scene plus
 * facile (on ne veut pas de saut brutal). Cible 0 : pas de preference.
 */
export function scenePenalty(len: number, level: number, rules: DayRules, type: FightType): number {
  const target = rules.lines[type];
  const lenGap = target > 0 ? Math.abs(len - target) / 2 : 0;
  const lv = rules.level;
  const levelGap = lv > 0 ? (level > lv ? 1.5 * (level - lv) : 0.5 * (lv - level)) : 0;
  return lenGap + levelGap;
}
