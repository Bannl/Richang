import type { Encounter, RunState } from '../game/types';
import type { PhoneticSystem } from './phonetics';
export interface ThemeInfo { id: string; label: string; labelEn: string; hue: number }

export interface Example { zh: string; pinyin: string; fr: string; en?: string }

export interface Word {
  rank: number;       // 1..2000, ordre de frequence/utilite
  tier: number;       // 1..6 (paliers 100/200/400/600/1000/2000)
  hanzi: string;
  pinyin: string;     // "nǐ hǎo"
  zhuyin: string[];   // ["ㄋㄧˇ", "ㄏㄠˇ"]
  pos: string;        // "pron.", "v.", "n.", ...
  fr: string[];       // sens en francais
  en?: string[];      // sens en anglais
  note?: string;      // usage a Taiwan, nuance (fr)
  noteEn?: string;
  theme: string;      // id de theme
  example?: Example;
}

export type Skill = 'read' | 'listen' | 'write' | 'speak';
export const SKILLS: readonly Skill[] = ['read', 'listen', 'write', 'speak'];
export const SKILL_LABELS: Record<Skill, string> = {
  read: 'Lecture', listen: 'Écoute', write: 'Écriture', speak: 'Prononciation',
};

/** 0 = à revoir, 1 = difficile, 2 = bien, 3 = facile */
export type Grade = 0 | 1 | 2 | 3;

export interface SkillState {
  reps: number;      // reussites consecutives (0 apres un echec)
  interval: number;  // jours
  ease: number;      // facteur SM-2 (>= 1.3)
  due: number;       // timestamp ms
  lapses: number;    // nombre d'oublis
  last: number;      // derniere revision (ms)
}

export interface WordProgress { intro: number; skills: Record<Skill, SkillState> }

export type WordStatus = 'new' | 'learning' | 'review' | 'mastered';

export type Lang = 'en' | 'fr';
/** Newcomer : cartes completes ; Seasoned : caracteres + pinyin ; Resident : caracteres seuls ; Native : pas de main, le mot manquant s'ecrit. */
export type Difficulty = 'newcomer' | 'seasoned' | 'resident' | 'native';

export interface Settings {
  language: Lang;
  difficulty: Difficulty;
  newPerDay: number;
  maxReviews: number;
  showPinyin: boolean;
  showZhuyin: boolean;
  /** Annotation phonetique a cote de chaque caractere (cartes, repliques, mots) ; desactivee par defaut. */
  phonetic: boolean;
  /** Systeme de l'annotation : bopomofo par defaut, romanisations en alternative. */
  phoneticSystem: PhoneticSystem;
  /** Voix des personnages masculins et feminins (nom de la voix installee, '' = automatique). */
  voiceMale: string;
  voiceFemale: string;
  /** Voix des repliques du joueur : par defaut, d'homme ou de femme. */
  playerVoice: 'auto' | 'male' | 'female';
  ttsRate: number;
  colorScheme: 'auto' | 'light' | 'dark';
  hanziFont: 'sans' | 'kai';
  newOrder: 'mixte' | 'theme';
  autoPlay: boolean;
  skills: Record<Skill, boolean>;
}

export interface DayStats { reviews: number; correct: number; newWords: number }

/**
 * Tutoriel en cours : tracer 我 (learn), la rencontre avec le proprietaire (scene, ou l'on pose 我 dans deux repliques),
 * puis la voix interieure sur ecran sombre (outro). `encounter` : la rencontre du tutoriel (gardee pendant l'outro,
 * pour que l'ecran s'assombrisse sur la derniere image).
 */
export interface TutorialState {
  step: 'learn' | 'scene' | 'outro';
  encounter: Encounter | null;
}

export interface AppState {
  version: 1;
  settings: Settings;
  progress: Record<string, WordProgress>; // cle = rank
  days: Record<string, DayStats>;         // cle = YYYY-MM-DD
  unlocked: number[];                     // deck : rangs des cartes debloquees, dans l'ordre
  run: RunState | null;                   // run en cours
  runsPlayed: number;
  runsWon: number;
  /** Tutoriel en cours (null : aucun). */
  tutorial: TutorialState | null;
  /** Tutoriel vu ou passe : il ne se relance plus tout seul (rejouable depuis les reglages). */
  tutorialDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  difficulty: 'newcomer',
  newPerDay: 8,
  maxReviews: 80,
  showPinyin: true,
  showZhuyin: true,
  phonetic: false,
  phoneticSystem: 'zhuyin',
  voiceMale: '',
  voiceFemale: '',
  playerVoice: 'auto',
  ttsRate: 0.9,
  colorScheme: 'auto',
  hanziFont: 'sans',
  newOrder: 'mixte',
  autoPlay: true,
  skills: { read: true, listen: true, write: true, speak: true },
};

export function emptyState(): AppState {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, skills: { ...DEFAULT_SETTINGS.skills } },
    progress: {},
    days: {},
    unlocked: [],
    run: null,
    runsPlayed: 0,
    runsWon: 0,
    tutorial: null,
    tutorialDone: false,
  };
}
