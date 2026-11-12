import type { AppState, TutorialState } from '../core/types';
import { TUTORIAL_SCENE } from '../data/tutorial';
import { segmentsOf, unlockWord } from './run';
import { REPLAYS_PER_ENCOUNTER, RUN_MAX_HP, type DialogueLine, type Encounter, type RunState } from './types';

/**
 * Tutoriel : on trace son premier mot, 我 (je, moi), qui rejoint le deck ; le proprietaire se presente et l'on pose 我
 * dans le trou de sa replique, puis dans sa propre reponse (« je ne comprends pas ») ; l'ecran s'assombrit sur la voix
 * interieure du joueur. La scene reutilise l'ecran de combat sur une rencontre fictive : le vrai run et le vrai deck ne
 * sont pas touches.
 */

/** Le premier mot du jeu, 我 : le mot-cle de la scene du tutoriel. */
export const TUTORIAL_RANK = TUTORIAL_SCENE.keywords[0];

export const startTutorial = (state: AppState): AppState => ({ ...state, tutorial: { step: 'learn', encounter: null } });

/** Au tout premier lancement (aucune carte, aucun run, tutoriel jamais vu ni passe), le jeu commence par le tutoriel. */
export function autoStartTutorial(state: AppState): AppState {
  if (state.tutorial || state.tutorialDone || state.unlocked.length > 0 || state.run) return state;
  return startTutorial(state);
}

/** Rencontre du tutoriel : un trou par replique, sur 我 ; la main ne contient que cette carte. */
export function tutorialEncounter(): Encounter {
  const lines: DialogueLine[] = TUTORIAL_SCENE.lines.map((l, i) => {
    const segments = segmentsOf(l.zh);
    const at = segments.findIndex((s) => s.rank === TUTORIAL_RANK);
    const blanks = at >= 0 ? [at] : [];
    return {
      speaker: l.speaker, speech: { zh: l.zh, pinyin: l.pinyin, en: l.en, fr: l.fr }, segments, blanks,
      filled: blanks.map(() => null), results: blanks.map(() => null), voice: `${TUTORIAL_SCENE.id}-${i}`,
    };
  });
  return {
    nodeId: 'tutorial', type: 'fight', situation: TUTORIAL_SCENE.situation, lines, index: 0,
    hand: [TUTORIAL_RANK], pile: [], replaysLeft: REPLAYS_PER_ENCOUNTER, correct: 0, wrong: 0,
  };
}

/** 我 est trace : la carte rejoint le deck (si elle n'y est pas deja), puis la scene avec le proprietaire commence. */
export function tutorialLearned(state: AppState, now: number): AppState {
  if (state.tutorial?.step !== 'learn') return state;
  return { ...unlockWord(state, TUTORIAL_RANK, now), tutorial: { step: 'scene', encounter: tutorialEncounter() } };
}

/**
 * Etat que voit l'ecran de combat pendant la scene : un run fictif en Newcomer (cartes completes, traduction des
 * repliques) dont la rencontre est celle du tutoriel, et un deck reduit a 我.
 */
export function tutorialView(state: AppState): AppState {
  const enc = state.tutorial?.encounter ?? null;
  const run: RunState | null = enc && {
    seed: 1, difficulty: 'newcomer', hp: RUN_MAX_HP, maxHp: RUN_MAX_HP, map: { layers: 1, nodes: [] },
    current: enc.nodeId, visited: [enc.nodeId], encounter: enc, reward: null, restHealed: 0, phase: 'battle',
    startedAt: 0, cardsUnlocked: 0, correct: 0, wrong: 0,
  };
  return { ...state, unlocked: [TUTORIAL_RANK], run };
}

/**
 * Action du combat (poser la carte, repeter, replique suivante) appliquee a la rencontre du tutoriel. La progression
 * est gardee (la lecture de 我 compte) ; la fin de la rencontre ouvre l'outro, qui garde la derniere image de la scene
 * pendant que l'ecran s'assombrit.
 */
export function applyTutorial(state: AppState, fn: (s: AppState) => AppState): AppState {
  const tut = state.tutorial;
  if (tut?.step !== 'scene' || !tut.encounter) return state;
  const v = fn(tutorialView(state));
  const enc = v.run?.phase === 'battle' ? v.run.encounter : null;
  const tutorial: TutorialState = enc ? { step: 'scene', encounter: enc } : { step: 'outro', encounter: tut.encounter };
  return { ...state, progress: v.progress, tutorial };
}

/** Tutoriel termine ou passe : retour au camp ; il ne se relancera plus tout seul. */
export const endTutorial = (state: AppState): AppState => ({ ...state, tutorial: null, tutorialDone: true });
