import type { Difficulty } from '../core/types';
import type { Speech } from '../data/dialogues';

export type NodeType = 'start' | 'fight' | 'elite' | 'rest' | 'boss';

export interface MapNode {
  id: string;
  layer: number;      // 0 = depart, layers-1 = boss
  col: number;
  type: NodeType;
  situation: string | null;
  next: string[];     // ids des noeuds atteignables
  x: number;          // 0..1
}

export interface RunMap { layers: number; nodes: MapNode[] }

/** Phrase a trou (mode d'entrainement et repli) : la reponse est le mot du deck (rang) present dans la phrase. */
export interface Line {
  zh: string;
  pinyin: string;
  fr: string;
  en: string;
  answer: number;   // rang du mot a jouer
  source: number;   // rang du mot dont la phrase est l'exemple
  theme: string;    // theme de la phrase (celui du mot source)
}

export type FightType = 'fight' | 'elite' | 'boss';

/** Un mot-carte (ou un signe de ponctuation) d'une replique. */
export interface Segment { text: string; rank: number | null }

export type Speaker = 'enemy' | 'player';

/** Replique du dialogue : cartes-mots, trous a remplir et leur etat. */
export interface DialogueLine {
  speaker: Speaker;
  speech: Speech;
  segments: Segment[];
  blanks: number[];             // indices des segments a remplir
  filled: (number | null)[];    // rang pose dans chaque trou
  results: ('ok' | 'bad' | null)[];
  /** Cle du doublage (« <scene>-<ligne> ») quand la replique vient d'une scene ecrite. */
  voice?: string;
}

/** Une replique ecrite d'une scene (conversation coherente). */
export interface SceneLine { speaker: Speaker; zh: string; pinyin: string; en: string; fr: string }

/** Scene = une conversation coherente et continue, unite de contenu d'une rencontre.
 *  keywords = rangs des mots cibles (cases a trous potentielles) presents dans la scene. */
export interface Scene { id: string; situation: string; topic?: string; lines: SceneLine[]; keywords: number[] }

export interface Encounter {
  nodeId: string;
  type: FightType;
  situation: string;
  lines: DialogueLine[];        // alternance adversaire / joueur
  index: number;                // replique courante
  hand: number[];               // 5 cartes en main
  pile: number[];               // pioche (reste du deck, melange)
  replaysLeft: number;          // repetitions de la replique restantes (par rencontre)
  correct: number;
  wrong: number;
}

export interface RewardState {
  remaining: number;        // cartes encore a choisir
  choices: number[];        // rangs proposes
  learning: number | null;  // carte choisie, en cours de tracage
}

/** dayEnd : evenement de fin de journee reussi (nuit de sommeil, puis journee suivante) ; won : ancien format (fin du run), lu comme dayEnd. */
export type RunPhase = 'map' | 'battle' | 'reward' | 'rest' | 'dayEnd' | 'won' | 'lost';

export interface RunState {
  seed: number;
  difficulty: Difficulty;
  hp: number;
  maxHp: number;
  map: RunMap;
  current: string;          // noeud courant
  visited: string[];
  encounter: Encounter | null;
  reward: RewardState | null;
  restHealed: number;
  phase: RunPhase;
  startedAt: number;
  cardsUnlocked: number;
  correct: number;
  wrong: number;
  /** Journee en cours (1 = la premiere) : le score est le nombre de journees reussies. */
  day: number;
  /** Situations des evenements de fin de journee deja joues, dans l'ordre (le dernier : celui de la veille). */
  finals: string[];
  /** Scenes deja jouees pendant ce run (on evite de les rejouer tant qu'il en reste d'autres). */
  seen: string[];
  /** Record (journees) au debut du run, pour annoncer un nouveau record. */
  bestBefore: number;
  /** Compteurs du run au debut de la journee (bilan de la journee). */
  dayStart: { correct: number; wrong: number; cards: number };
}

/**
 * Mode Situation : une rencontre choisie dans le menu pour s'entrainer, hors aventure (le run en cours n'est pas touche).
 * status : battle (en cours), done (conversation terminee), lost (plus de vies).
 */
export interface DrillState {
  situation: string;
  difficulty: Difficulty;
  encounter: Encounter | null;
  hp: number;
  status: 'battle' | 'done' | 'lost';
  correct: number;
  wrong: number;
  seen: string[];
}

export const RUN_MAX_HP = 5;
/** Vies rendues par la nuit, entre deux journees. */
export const NIGHT_HEAL = 1;
/** Vies rendues par une halte de repos sur la carte. */
export const REST_HEAL = 2;
export const MIN_DECK_FOR_RUN = 10;
export const HAND_SIZE = 5;
/** Repetitions de la replique courante autorisees par rencontre. */
export const REPLAYS_PER_ENCOUNTER = 3;
/** Nombre d'echanges (replique + reponse) par rencontre. */
export const EXCHANGES_PER_TYPE: Record<FightType, number> = { fight: 3, elite: 4, boss: 6 };
/** Trous maximum par replique. */
export const BLANKS_PER_TYPE: Record<FightType, number> = { fight: 1, elite: 2, boss: 2 };
export const REWARD_PER_TYPE: Record<FightType, number> = { fight: 1, elite: 2, boss: 0 };
