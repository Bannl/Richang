// Voix enregistrees du jeu : nom de chaque segment TT (<scene>-<ligne>-<n|f|m>) -> caracteres chinois du texte
// enregistre (champ TEXT_ZH de la table TT_SEGMENT_TABLE des fichiers public/voices/*.opus|ogg).
import fs from 'node:fs';
import path from 'node:path';
import { readOgg } from './ogg.mjs';

export const hanOnly = (s) => [...(s ?? '')].filter((c) => /\p{Script=Han}/u.test(c)).join('');

export function recordedVoices(dir = 'public/voices') {
  const recorded = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => /\.(opus|ogg)$/.test(x))) {
    const { comments } = readOgg(fs.readFileSync(path.join(dir, f)));
    const c = comments.find((x) => x.startsWith('TT_SEGMENT_TABLE='));
    if (!c) continue;
    const t = JSON.parse(c.slice('TT_SEGMENT_TABLE='.length));
    const col = new Map(t.COLUMNS.map((p, i) => [p, i]));
    for (const row of t.ROWS) {
      const name = row[col.get('NAME')];
      const zh = row[col.get('FIELD/TEXT_ZH')] ?? t.DEFAULTS?.['FIELD/TEXT_ZH'];
      if (name) recorded.set(name, hanOnly(zh));
    }
  }
  return recorded;
}

/** Etat du doublage d'une replique : ok, new (jamais enregistree) ou changed (texte modifie depuis l'enregistrement). */
export function dubState(recorded, sceneId, index, line) {
  const voices = line.speaker === 'enemy' ? ['n'] : ['f', 'm'];
  let state = 'ok';
  for (const v of voices) {
    const rec = recorded.get(`${sceneId}-${index}-${v}`);
    if (rec === undefined) return 'new';
    if (rec !== hanOnly(line.zh)) state = 'changed';
  }
  return state;
}
