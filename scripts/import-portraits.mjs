// Importe les portraits generes (une image par personnage et par emotion) dans l'app :
//   node scripts/import-portraits.mjs <dossier> [dossier de sortie]   fichiers <situation>-<emotion>.(png|webp|jpg)
// Fond blanc uni, ou magenta (#FF00FF) pour les personnages en vetements blancs : il est retire par remplissage
// depuis les bords (les contours encres arretent le remplissage) et le bord est adouci. Les expressions d'un meme
// personnage sont recadrees sur un rectangle commun (union des silhouettes) pour qu'il ne « saute » pas d'une emotion
// a l'autre, puis enregistrees en WebP transparent de hauteur fixe : src/assets/portraits/<id>-<emotion>.webp
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Usage : node scripts/import-portraits.mjs <dossier>');
  process.exit(1);
}
const out = path.resolve(process.argv[3] ?? 'src/assets/portraits');
fs.mkdirSync(out, { recursive: true });
const EMOTIONS = ['neutral', 'happy', 'shocked', 'confused', 'angry', 'curious'];
const HEIGHT = 560;
/**
 * Fond blanc, vetement a zones blanches coupe par le bord du bas (rayures blanches) : pas de remplissage depuis le bas,
 * sinon ces zones partent avec le fond. Les fonds atteints par les cotes et les poches enfermees partent quand meme.
 */
const KEEP_BOTTOM = new Set(['convenience-store']);

/** Fond « blanc » : clair et peu sature (tolere un leger degrade gris). */
const isBg = (r, g, b) => Math.min(r, g, b) > 226 && Math.max(r, g, b) - Math.min(r, g, b) < 22;

/** « Magenta-ite » d'un pixel (fond a cle) : > 0 quand le rouge et le bleu dominent le vert. */
const keyness = (r, g, b) => Math.min(r, b) - g;
const KEY_SOFT = 40;   // en dessous : personnage
const KEY_HARD = 105;  // au-dessus : fond franc (retire meme enferme entre un bras et le corps)

/** Le haut de l'image est-il majoritairement magenta ? (fond a cle plutot que blanc) */
function isKeyed(data, w, h) {
  let k = 0, n = 0;
  for (let x = 0; x < w; x += 4) { const o = x * 3; n++; if (keyness(data[o], data[o + 1], data[o + 2]) > KEY_HARD) k++; }
  for (let y = 0; y < h / 2; y += 4) for (const x of [0, w - 1]) { const o = (y * w + x) * 3; n++; if (keyness(data[o], data[o + 1], data[o + 2]) > KEY_HARD) k++; }
  return k / n > 0.6;
}

/**
 * Retire les petites taches isolees pres des bords (signatures, tampons, lettres ajoutees par le generateur) :
 * composantes opaques de moins de 2 % du personnage dont le centre est dans le bas de l'image ou sur ses cotes.
 * Les petites marques pres de la tete (gouttes de sueur, « ! ») sont gardees.
 */
function removeStamps(alpha, w, h, data) {
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (alpha[start] === 0 || label[start] !== -1) continue;
    const id = comps.length;
    let area = 0, sx = 0, sy = 0, sr = 0, sg = 0, sb = 0;
    const pixels = [];
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      area++; pixels.push(i);
      sr += data[i * 3]; sg += data[i * 3 + 1]; sb += data[i * 3 + 2];
      const x = i % w, y = (i / w) | 0;
      sx += x; sy += y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && alpha[j] !== 0 && label[j] === -1) { label[j] = id; stack.push(j); }
      }
    }
    comps.push({ area, cx: sx / area / w, cy: sy / area / h, r: sr / area, g: sg / area, b: sb / area, pixels });
  }
  const biggest = comps.reduce((m, c) => Math.max(m, c.area), 0);
  for (const c of comps) {
    if (c.area >= biggest * 0.04) continue;
    const bluish = c.b > c.r + 15 && c.b >= c.g; // gouttes de sueur : gardees
    if (!bluish && (c.cy > 0.75 || c.cx < 0.22 || c.cx > 0.78)) for (const i of c.pixels) alpha[i] = 0;
  }
}

/**
 * Fond blanc : les poches de fond enfermees dans la silhouette (entre un bras leve et la tete, entre les doigts) ne
 * sont pas atteintes par le remplissage depuis les bords. Elles sont d'un blanc pur et uniforme, alors que les tissus
 * blancs (serviette, bandeau) sont ombres a l'aquarelle : seules les zones claires presque entierement >= 250 partent.
 */
function removePockets(alpha, w, h, data) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || alpha[s] === 0 || !isBg(data[s * 3], data[s * 3 + 1], data[s * 3 + 2])) continue;
    const pixels = [];
    let pure = 0;
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      pixels.push(i);
      if (Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) >= 250) pure++;
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && alpha[j] !== 0 && isBg(data[j * 3], data[j * 3 + 1], data[j * 3 + 2])) { seen[j] = 1; stack.push(j); }
      }
    }
    if (pixels.length >= 150 && pure / pixels.length > 0.9) for (const i of pixels) alpha[i] = 0;
  }
}

async function cutout(file, keepBottom = false) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const alpha = new Uint8Array(w * h).fill(255);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const keyed = isKeyed(data, w, h);
  // Fond a cle : remplissage depuis les bords sur le magenta, meme leger ; fond blanc : sur le blanc.
  const bg = keyed ? (r, g, b) => keyness(r, g, b) > KEY_SOFT : isBg;
  const seed = (x, y) => {
    const i = y * w + x;
    if (seen[i]) return;
    const o = i * 3;
    if (!bg(data[o], data[o + 1], data[o + 2])) return;
    seen[i] = 1;
    stack.push(i);
  };
  if (keyed) {
    // Poches de magenta franc enfermees (entre un bras et le corps, dans une meche) : retirees aussi.
    for (let i = 0; i < w * h; i++) { const o = i * 3; if (keyness(data[o], data[o + 1], data[o + 2]) > KEY_HARD) alpha[i] = 0; }
    // Le remplissage peut partir de tous les bords (aucun vetement n'est magenta).
    for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
    for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  }
  // Fond blanc : germes sur les quatre bords (les contours noirs, qui vont jusqu'au bord, protegent les vetements blancs).
  if (!keyed) {
    for (let x = 0; x < w; x++) { seed(x, 0); if (!keepBottom) seed(x, h - 1); }
    for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  }
  while (stack.length) {
    const i = stack.pop();
    alpha[i] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  if (!keyed) removePockets(alpha, w, h, data);
  removeStamps(alpha, w, h, data);
  // Bord adouci : l'alpha est legerement flouté.
  const soft = await sharp(Buffer.from(alpha), { raw: { width: w, height: h, channels: 1 } }).blur(0.9).extractChannel(0).raw().toBuffer();
  const rgba = Buffer.alloc(w * h * 4);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) {
    let r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    // Fond a cle : on retire le reflet magenta des contours (rouge et bleu ramenes vers le vert).
    if (keyed) { const k = keyness(r, g, b); if (k > 0) { r = Math.max(0, r - k * 0.75); b = Math.max(0, b - k * 0.75); } }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b;
    const a = alpha[i] === 0 ? 0 : soft[i];
    rgba[i * 4 + 3] = a;
    if (a > 8) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return { png, w, h, box: { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } };
}

const union = (boxes) => {
  const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width)), bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
};

// Regroupement par personnage : <id>-<emotion>.<ext>
const groups = new Map();
for (const file of fs.readdirSync(src).sort()) {
  const m = file.match(/^(.+)-(neutral|happy|shocked|confused|angry|curious)\.(png|webp|jpe?g)$/);
  if (!m) continue;
  if (!groups.has(m[1])) groups.set(m[1], []);
  groups.get(m[1]).push({ file, emo: m[2] });
}

let n = 0;
for (const [id, list] of groups) {
  const dest = (emo) => path.join(out, `${id}-${emo}.webp`);
  // Deja importe et plus recent que toutes ses sources : on passe (import incremental pendant la generation).
  // Sinon tout le personnage est refait, pour garder un recadrage commun.
  const fresh = list.every(({ file, emo }) => fs.existsSync(dest(emo)) && fs.statSync(dest(emo)).mtimeMs > fs.statSync(path.join(src, file)).mtimeMs);
  if (fresh && !process.env.FORCE) continue;
  const cuts = [];
  for (const { file, emo } of list) cuts.push({ emo, ...(await cutout(path.join(src, file), KEEP_BOTTOM.has(id))) });
  const same = cuts.every((c) => c.w === cuts[0].w && c.h === cuts[0].h);
  const common = union(cuts.map((c) => c.box));
  for (const c of cuts) {
    const info = await sharp(c.png).extract(same ? common : c.box).resize({ height: HEIGHT, withoutEnlargement: true })
      .webp({ quality: 80, alphaQuality: 90, effort: 5 }).toFile(dest(c.emo));
    n++;
    console.log(`${id}-${c.emo}`.padEnd(30), `${Math.round(info.size / 1024)} Ko`);
  }
}
console.log(`${n} portraits importes -> ${path.relative(process.cwd(), out)} (emotions : ${EMOTIONS.join(', ')})`);
