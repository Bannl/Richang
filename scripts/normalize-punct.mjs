// Ponctuation pleine chasse dans le chinois des phrases du jeu (scripts/lib/punct.mjs : ， ？ ！ ； ： au lieu de
// , ? ! ; :) : repliques des scenes, du tutoriel et des anciens dialogues, exemples des cartes.
//   node scripts/normalize-punct.mjs [--write]
// Sans --write : bilan seulement. Le remplacement se fait dans le texte des fichiers (champs "zh") : la mise en forme
// est gardee. Le doublage reste valable : le jeu compare seulement les caracteres chinois d'une replique a ceux de son
// enregistrement.
import fs from 'node:fs';
import path from 'node:path';
import { toFullwidth } from './lib/punct.mjs';

const write = process.argv.includes('--write');
const list = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f)) : []);
const files = [
  ...list('data/scenes', /\.json$/),
  ...list('data/dialogues', /\.json$/),
  ...list('data/enriched', /^part-\d+\.json$/),
  'src/data/tutorial.json',
].filter((f) => fs.existsSync(f));

let phrases = 0;
let marks = 0;
const touched = [];
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const out = raw.replace(/("zh"\s*:\s*")((?:[^"\\]|\\.)*)"/g, (m, head, zh) => {
    const after = toFullwidth(zh);
    if (after === zh) return m;
    phrases++;
    const a = [...after];
    marks += [...zh].filter((c, i) => c !== a[i]).length;
    return `${head}${after}"`;
  });
  if (out === raw) continue;
  touched.push(file);
  if (write) fs.writeFileSync(file, out);
}
console.log(`${phrases} phrase(s), ${marks} signe(s), ${touched.length} fichier(s) ${write ? 'corriges' : 'a corriger (relancer avec --write)'}`);
if (!write && touched.length) console.log(touched.join('\n'));
