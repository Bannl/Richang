import type { AppState } from '../core/types';
import { DRILL_RULES } from './progression';
import { finalCandidates, situationEncounter } from './run';
import { mulberry32 } from './rng';
import { RUN_MAX_HP, type DrillState, type RunState } from './types';

/**
 * Mode Situation : on choisit dans le menu une situation jouable avec son deck et l'on joue une de ses scenes en
 * entier, pour s'entrainer. La rencontre reutilise l'ecran de combat sur un run fictif (comme le tutoriel) : le vrai
 * run (aventure en cours) n'est pas touche ; la progression des mots (lecture, ecriture, maitrise) est gardee.
 */

/** Situations proposees : celles jouables de bout en bout avec le deck (comme en aventure). */
export const drillSituations = (state: AppState): string[] => finalCandidates(state);

/** Lance (ou relance) une rencontre de la situation : une scene pas encore jouee dans cette serie, si possible. */
export function startDrill(state: AppState, situation: string, now: number): AppState {
  const seen = state.drill?.situation === situation ? state.drill.seen : [];
  const difficulty = state.settings.difficulty;
  const rng = mulberry32((now ^ 0x2545f491) >>> 0);
  const { encounter, scene } = situationEncounter(state, 'drill', 'fight', situation, rng, DRILL_RULES, seen, difficulty);
  const drill: DrillState = {
    situation, difficulty, encounter, hp: RUN_MAX_HP, status: 'battle', correct: 0, wrong: 0,
    seen: scene ? [...seen, scene] : seen,
  };
  return { ...state, drill };
}

/** Etat que voit l'ecran de combat : un run fictif dont la rencontre est celle du mode Situation. */
export function drillView(state: AppState): AppState {
  const d = state.drill;
  const enc = d?.encounter ?? null;
  const run: RunState | null = d && enc && {
    seed: 1, difficulty: d.difficulty, hp: d.hp, maxHp: RUN_MAX_HP, map: { layers: 1, nodes: [] },
    current: enc.nodeId, visited: [enc.nodeId], encounter: enc, reward: null, restHealed: 0, phase: 'battle',
    startedAt: 0, cardsUnlocked: 0, correct: d.correct, wrong: d.wrong,
    day: 1, finals: [], seen: [], bestBefore: 0, dayStart: { correct: 0, wrong: 0, cards: 0 },
  };
  return { ...state, run };
}

/**
 * Action du combat appliquee a la rencontre du mode Situation : on garde la progression des mots, les vies et les
 * compteurs ; la fin de la conversation (ou la perte des vies) termine la rencontre, sans recompense.
 */
export function applyDrill(state: AppState, fn: (s: AppState) => AppState): AppState {
  const d = state.drill;
  if (!d || d.status !== 'battle' || !d.encounter) return state;
  const v = fn(drillView(state));
  const r = v.run;
  const live = r?.phase === 'battle' && r.encounter ? r.encounter : null;
  const status: DrillState['status'] = live ? 'battle' : r?.phase === 'lost' ? 'lost' : 'done';
  const drill: DrillState = {
    ...d,
    encounter: live ?? d.encounter,
    hp: r?.hp ?? d.hp,
    correct: r?.correct ?? d.correct,
    wrong: r?.wrong ?? d.wrong,
    status,
  };
  return { ...state, progress: v.progress, drill };
}

export const endDrill = (state: AppState): AppState => ({ ...state, drill: null });
