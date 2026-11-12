import raw from './generated/dialogues.json';

export interface Speech { zh: string; pinyin: string; en: string; fr: string }
export interface Exchange { enemy: Speech; player?: Speech }

/** Dialogues par situation (id -> echanges). */
export const DIALOGUES: Record<string, Exchange[]> = raw as Record<string, Exchange[]>;
