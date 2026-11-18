// Etat du doublage : compare les repliques des scenes (data/scenes-final.json + tutoriel) aux voix enregistrees
// (public/voices/*.opus, table TT_SEGMENT_TABLE : NAME et TEXT_ZH de chaque segment).
//   node scripts/dub-status.mjs [--out <fichier>]
// Une replique est a doubler si elle n'a pas de segment (nouvelle scene) ou si le texte enregistre n'a plus les memes
// caracteres chinois (replique corrigee) : le jeu lit alors la voix de synthese. --out ecrit la liste des cles a doubler
// (<scene>-<ligne>-<n|f|m>, une par ligne : n = personnage, f et m = voix du joueur), pour le pipeline CosyVoice.
import fs from 'node:fs';
import { hanOnly, recordedVoices } from './lib/tt-index.mjs';

const outArg = process.argv.indexOf('--out');
const outFile = outArg >= 0 ? process.argv[outArg + 1] : null;

// Voix enregistrees : nom du segment -> caracteres du texte.
const recorded = recordedVoices();

const scenes = Object.values(JSON.parse(fs.readFileSync('data/scenes-final.json', 'utf8'))).flat();
if (fs.existsSync('src/data/tutorial.json')) scenes.push(...JSON.parse(fs.readFileSync('src/data/tutorial.json', 'utf8')).scenes);
const todo = [];
const bySit = new Map();
let ok = 0;
for (const sc of scenes) {
  sc.lines.forEach((l, i) => {
    // Personnage : une voix ; joueur : deux voix (femme, homme).
    const voices = l.speaker === 'enemy' ? ['n'] : ['f', 'm'];
    for (const v of voices) {
      const key = `${sc.id}-${i}-${v}`;
      const rec = recorded.get(key);
      const state = rec === undefined ? 'new' : rec === hanOnly(l.zh) ? 'ok' : 'changed';
      if (state === 'ok') { ok++; continue; }
      todo.push(key);
      const s = bySit.get(sc.situation) ?? { new: 0, changed: 0 };
      s[state]++;
      bySit.set(sc.situation, s);
    }
  });
}
const newCount = [...bySit.values()].reduce((a, s) => a + s.new, 0);
const changedCount = [...bySit.values()].reduce((a, s) => a + s.changed, 0);
console.log(`Prises doublees a jour : ${ok} · a doubler : ${todo.length} (nouvelles : ${newCount}, repliques modifiees : ${changedCount})`);
for (const [sit, s] of [...bySit].sort()) console.log(`  ${sit.padEnd(18)} nouvelles ${String(s.new).padStart(4)} · modifiees ${String(s.changed).padStart(4)}`);
if (outFile) { fs.writeFileSync(outFile, todo.join('\n') + '\n'); console.log(`-> ${outFile}`); }
