import raw from './tutorial.json';
import type { Scene } from '../game/types';

/**
 * Scene du tutoriel : la rencontre avec le proprietaire, ou l'on pose 我 dans deux repliques. Elle n'entre pas dans
 * les runs ; ses repliques sont doublees comme les autres (segments `tutorial-<ligne>-<n|f|m>` des fichiers TT du
 * proprietaire et du joueur, voir scripts/build-voices-tt.mjs).
 */
export const TUTORIAL_SCENE: Scene = (raw as { scenes: Scene[] }).scenes[0];
