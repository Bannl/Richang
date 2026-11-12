import raw from './generated/words.json';
import themesRaw from './generated/themes.json';
import type { ThemeInfo, Word } from '../core/types';

export const WORDS: Word[] = raw as Word[];
export const WORD_BY_RANK: Map<number, Word> = new Map(WORDS.map((w) => [w.rank, w]));
export const THEMES: ThemeInfo[] = themesRaw as ThemeInfo[];
export const THEME_BY_ID: Map<string, ThemeInfo> = new Map(THEMES.map((t) => [t.id, t]));
export const TIER_LIMITS = [100, 200, 400, 600, 1000, 2000];

export function themeOf(w: Word): ThemeInfo {
  return THEME_BY_ID.get(w.theme) ?? { id: w.theme, label: w.theme, labelEn: w.theme, hue: 0 };
}
