import raw from './generated/scenes.json';
import type { Scene } from '../game/types';

/** Scenes par situation (id -> conversations coherentes). Vide tant qu'un theme n'est pas converti. */
export const SCENES: Record<string, Scene[]> = raw as Record<string, Scene[]>;
