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

export type RunPhase = 'map' | 'battle' | 'reward' | 'rest' | 'won' | 'lost';

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
}

export const RUN_MAX_HP = 5;
export const MIN_DECK_FOR_RUN = 10;
export const HAND_SIZE = 5;
/** Repetitions de la replique courante autorisees par rencontre. */
export const REPLAYS_PER_ENCOUNTER = 3;
/** Nombre d'echanges (replique + reponse) par rencontre. */
export const EXCHANGES_PER_TYPE: Record<FightType, number> = { fight: 3, elite: 4, boss: 6 };
/** Trous maximum par replique. */
export const BLANKS_PER_TYPE: Record<FightType, number> = { fight: 1, elite: 2, boss: 2 };
export const REWARD_PER_TYPE: Record<FightType, number> = { fight: 1, elite: 2, boss: 0 };
