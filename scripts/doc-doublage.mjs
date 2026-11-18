// Genere "Doublage - Repliques des voix.md" : script de doublage / revue des dialogues.
// Situations converties en scenes coherentes -> affichees comme conversations ; les autres -> echanges (ancien format).
import fs from 'node:fs';
import { dubState, recordedVoices } from './lib/tt-index.mjs';

const words = JSON.parse(fs.readFileSync('src/data/generated/words.json', 'utf8'));
const wByRank = new Map(words.map((w) => [w.rank, w]));
let src = fs.readFileSync('src/game/situations.ts', 'utf8');
src = src.replace(/export interface Situation \{[\s\S]*?\n\}/, '').replace('export const SITUATIONS: Situation[] =', 'const SITUATIONS =').replace(/export const SITUATION_BY_ID[\s\S]*$/, '');
const SIT = eval(src + '; SITUATIONS');
const DIAL = JSON.parse(fs.readFileSync('src/data/generated/dialogues.json', 'utf8'));
const SCENES = fs.existsSync('data/scenes-final.json') ? JSON.parse(fs.readFileSync('data/scenes-final.json', 'utf8')) : {};

const esc = (s) => (s ?? '').replace(/\r?\n/g, ' ').trim();
const kw = (ranks) => (ranks || []).map((r) => wByRank.get(r)?.hanzi ?? '?').join('  ');
const ordered = SIT.filter((s) => DIAL[s.id] || SCENES[s.id]);
const isScene = (id) => (SCENES[id]?.length ?? 0) > 0;
// Etat du doublage de chaque replique (voix enregistrees dans public/voices) : nouvelle ou modifiee = a (re)doubler.
const RECORDED = recordedVoices();
const DUB_MARK = { new: ' — *à doubler*', changed: ' — *à redoubler (texte modifié)*', ok: '' };
let toDub = 0, toRedub = 0;
for (const sc of Object.values(SCENES).flat()) sc.lines.forEach((l, i) => { const st = dubState(RECORDED, sc.id, i, l); if (st === 'new') toDub++; else if (st === 'changed') toRedub++; });

const out = [];
out.push('# 日常 Rìcháng — Script de doublage (voix)');
out.push('');
out.push("Répliques de tous les dialogues du jeu, pour le doublage (mandarin de Taïwan, caractères traditionnels) et pour juger la qualité des situations.");
out.push('');
out.push('Les situations marquées **[scènes]** sont converties au nouveau format : chaque rencontre est une **conversation continue et cohérente**. Les autres sont encore à l’ancien format (échanges indépendants) et seront converties par la suite.');
out.push('');
out.push('Pour chaque réplique : **le texte à dire** (traditionnel), le *pinyin*, la traduction FR puis EN.');
out.push('');
// Date locale (toISOString donne la date UTC : la veille, le matin a Taiwan).
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
out.push(`Généré le ${today}. Répliques à doubler : ${toDub} (nouvelles scènes) ; à redoubler : ${toRedub} (texte modifié depuis l’enregistrement). Les autres sont enregistrées ; en attendant, le jeu lit les répliques non doublées avec la voix de synthèse.`);
out.push(''); out.push('---'); out.push('');

// Récapitulatif
out.push('## Récapitulatif (casting)');
out.push('');
out.push('| # | Personnage | Lieu / situation | Format | Répliques interlocuteur | Répliques joueur |');
out.push('|---|---|---|---|---|---|');
let pTotal = 0;
ordered.forEach((s, i) => {
  let e = 0, p = 0, fmt;
  if (isScene(s.id)) { fmt = 'scènes'; for (const sc of SCENES[s.id]) for (const l of sc.lines) (l.speaker === 'enemy' ? e++ : p++); }
  else { fmt = 'échanges'; for (const ex of DIAL[s.id]) { e++; if (ex.player) p++; } }
  pTotal += p;
  out.push(`| ${i + 1} | ${s.person.fr} | ${s.fr} | ${fmt} | ${e} | ${p} |`);
});
out.push(`| — | **Le joueur** (une seule voix) | Toutes | — | — | ${pTotal} |`);
out.push(''); out.push('---'); out.push('');

// Partie 1 — Personnages / situations
out.push('# Partie 1 — Situations et interlocuteurs');
out.push('');
ordered.forEach((s, i) => {
  const scene = isScene(s.id);
  out.push(`## ${i + 1}. ${s.person.fr} — ${s.fr} ${scene ? '[scènes]' : ''}`);
  out.push('');
  out.push(`**Lieu :** ${s.fr} (${s.en}) · **Sujet :** ${s.topic.fr}`);
  out.push('');
  if (scene) {
    SCENES[s.id].forEach((sc, k) => {
      out.push(`### Scène ${k + 1} — ${sc.topic || sc.id}`);
      if (sc.keywords?.length) out.push(`*Mots travaillés : ${kw(sc.keywords)}*`);
      out.push('');
      sc.lines.forEach((l, idx) => {
        const who = l.speaker === 'enemy' ? s.person.fr : 'Le joueur';
        out.push(`- **${who}** — ${esc(l.zh)}${DUB_MARK[dubState(RECORDED, sc.id, idx, l)]}`);
        out.push(`  - *${esc(l.pinyin)}*`);
        out.push(`  - ${esc(l.fr)} · ${esc(l.en)}`);
      });
      out.push('');
    });
  } else {
    out.push('_Échanges indépendants (ancien format, à convertir)._');
    out.push('');
    DIAL[s.id].forEach((ex, k) => {
      out.push(`${String(k + 1).padStart(2, '0')}. **${s.person.fr}** — ${esc(ex.enemy.zh)}  ·  *${esc(ex.enemy.pinyin)}*  ·  ${esc(ex.enemy.fr)}`);
      if (ex.player) out.push(`    **Joueur** — ${esc(ex.player.zh)}  ·  *${esc(ex.player.pinyin)}*  ·  ${esc(ex.player.fr)}`);
    });
    out.push('');
  }
  out.push('---'); out.push('');
});

// Partie 2 — Le joueur
out.push('# Partie 2 — Le joueur (protagoniste, une seule voix)');
out.push('');
out.push('Toutes les répliques du joueur, regroupées ici, classées par situation pour le contexte.');
out.push('');
ordered.forEach((s) => {
  out.push(`## ${s.fr}${s.boss ? ' (boss)' : ''} — face à : ${s.person.fr}`);
  out.push('');
  let n = 0;
  const push = (zh, py, fr, en) => { n++; out.push(`${String(n).padStart(2, '0')}. ${esc(zh)}  ·  *${esc(py)}*  ·  ${esc(fr)} · ${esc(en)}`); };
  if (isScene(s.id)) for (const sc of SCENES[s.id]) for (const l of sc.lines) { if (l.speaker === 'player') push(l.zh, l.pinyin, l.fr, l.en); }
  else for (const ex of DIAL[s.id]) if (ex.player) push(ex.player.zh, ex.player.pinyin, ex.player.fr, ex.player.en);
  out.push(''); out.push('---'); out.push('');
});

const file = 'Doublage - Répliques des voix.md';
fs.writeFileSync(file, out.join('\n'));
console.log('écrit:', file, '·', out.join('\n').length, 'caractères');
