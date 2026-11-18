// Icone de Richang : un sceau de jade (laque verte, treillis dore des dos de cartes, filet d'or, 日 creme en relief),
// comme la table des menus. Produit :
//   build/icon.png (1024), build/icon-256.png, build/icon.ico (16 a 256 px) : Windows (electron-builder) ;
//   android/app/src/main/res/mipmap-*/ic_launcher*.png : icone Android (ancienne et adaptative : fond + premier plan) ;
//   android/app/src/main/res/drawable*/splash.png : ecran de demarrage Android, l'icone sur la table de jade
//   (claire, ou sombre pour les dossiers -night), aux memes dimensions qu'avant ;
//   assets/*.png : sources de @capacitor/assets (icone carree opaque pour iOS, calques adaptatifs, ecrans 2732 px
//   clair et sombre), pour qu'une regeneration par cet outil redonne la meme icone.
//   node scripts/make-icons.mjs [--preview <dossier>]   (--preview : quelques images d'essai, rien d'autre n'est ecrit)
// Le 日 est dessine en rectangles (aucune police embarquee). Le projet iOS (ios/, en pause) n'est pas touche.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const previewDir = args.includes('--preview') ? args[args.indexOf('--preview') + 1] : null;
const RES = 'android/app/src/main/res';

// 日 en traits droits (repere 1024) : deux montants qui depassent sous le dernier trait, trois traits horizontaux.
const glyph = (fill) => `<g fill="${fill}">
  <rect x="300" y="226" width="62" height="564"/><rect x="662" y="226" width="62" height="564"/>
  <rect x="300" y="226" width="424" height="62"/><rect x="330" y="478" width="364" height="60"/><rect x="330" y="700" width="364" height="60"/>
</g>`;

/**
 * Icone en SVG (repere 1024, rendue a `size` px). shape : square (pleine page), round (coins arrondis), circle.
 * bg : laque de jade ; lattice : treillis dore ; frame : filet d'or ; mark : le 日 et son ombre.
 */
function iconSvg({ size, shape = 'round', bg = true, lattice = true, frame = true, mark = true }) {
  const clip = shape === 'circle' ? '<circle cx="512" cy="512" r="512"/>'
    : shape === 'round' ? '<rect width="1024" height="1024" rx="215"/>' : '<rect width="1024" height="1024"/>';
  const frameEl = shape === 'circle'
    ? '<circle cx="512" cy="512" r="452" fill="none" stroke="#e2b863" stroke-opacity=".9" stroke-width="16"/>'
    : '<rect x="60" y="60" width="904" height="904" rx="160" fill="none" stroke="#e2b863" stroke-opacity=".9" stroke-width="16"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="jade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23806d"/><stop offset="1" stop-color="#0d3a31"/></linearGradient>
    <radialGradient id="light" cx="512" cy="-60" r="820" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff1cf" stop-opacity=".3"/><stop offset="1" stop-color="#fff1cf" stop-opacity="0"/></radialGradient>
    <pattern id="lattice" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H80M0 0V80" stroke="#e8c274" stroke-opacity=".13" stroke-width="4" fill="none"/></pattern>
    <clipPath id="clip">${clip}</clipPath>
  </defs>
  ${bg ? `<g clip-path="url(#clip)"><rect width="1024" height="1024" fill="url(#jade)"/>${lattice ? '<rect width="1024" height="1024" fill="url(#lattice)"/>' : ''}<rect width="1024" height="1024" fill="url(#light)"/></g>` : ''}
  ${frame ? frameEl : ''}
  ${mark ? `<g transform="translate(0 12)" opacity=".55">${glyph('#06231d')}</g>${glyph('#f8ead0')}` : ''}
</svg>`;
}

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
// Petites tailles : sans treillis ni filet (illisibles sous 64 px, ils ne feraient que brouiller le 日).
const icon = (size, shape = 'round') => png(iconSvg({ size, shape, lattice: size >= 64, frame: size >= 64 }));

/** Fichier .ico a plusieurs tailles, chaque image en PNG (Windows Vista et suivants). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e); header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3); header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.data)]);
}

/**
 * Ecran de demarrage w x h : l'icone au centre, sur un degrade de jade clair ou sombre. plain = false ajoute le treillis,
 * la lumiere et la vignette de la table des menus (images 6 fois plus lourdes : 6,2 Mo pour les 26 ecrans Android).
 */
async function splash(w, h, night, plain = true) {
  const m = Math.min(w, h);
  const step = Math.max(14, Math.round(m * 0.045));
  const c = night
    ? { a: '#133a33', b: '#0b221e', line: '#e8c274', lineO: 0.07, light: '#ffd28c', lightO: 0.13, vig: '#000000', vigO: 0.55 }
    : { a: '#dae5dc', b: '#c4d5c9', line: '#1a5846', lineO: 0.09, light: '#fffdf4', lightO: 0.7, vig: '#0e3a2e', vigO: 0.22 };
  const table = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.a}"/><stop offset="1" stop-color="${c.b}"/></linearGradient>
    <pattern id="t" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H${step}M0 0V${step}" stroke="${c.line}" stroke-opacity="${c.lineO}" stroke-width="${Math.max(1, m / 900).toFixed(2)}" fill="none"/></pattern>
    <radialGradient id="l" cx="${w / 2}" cy="${-0.06 * h}" r="${0.75 * Math.max(w, h)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.light}" stop-opacity="${c.lightO}"/><stop offset="1" stop-color="${c.light}" stop-opacity="0"/></radialGradient>
    <radialGradient id="v" cx="${w / 2}" cy="${0.45 * h}" r="${0.75 * Math.max(w, h)}" gradientUnits="userSpaceOnUse"><stop offset=".6" stop-color="${c.vig}" stop-opacity="0"/><stop offset="1" stop-color="${c.vig}" stop-opacity="${c.vigO}"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#b)"/>${plain ? '' : `<rect width="${w}" height="${h}" fill="url(#t)"/>
  <rect width="${w}" height="${h}" fill="url(#l)"/><rect width="${w}" height="${h}" fill="url(#v)"/>`}
</svg>`;
  const s = Math.round(m * 0.3);
  const tile = await icon(s);
  const pad = Math.round(s * 0.2);
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s + 2 * pad}" height="${s + 2 * pad}"><rect x="${pad}" y="${pad}" width="${s}" height="${s}" rx="${s * 0.21}" fill="#000" fill-opacity="${night ? 0.55 : 0.28}"/></svg>`))
    .blur(Math.max(1, s * 0.05)).png().toBuffer();
  const left = Math.round((w - s) / 2);
  const top = Math.round((h - s) / 2);
  return sharp(Buffer.from(table)).composite([
    { input: shadow, left: left - pad, top: top - pad + Math.round(s * 0.05) },
    { input: tile, left, top },
  ]).png({ compressionLevel: 9 }).toBuffer();
}

const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };

if (previewDir) {
  write(path.join(previewDir, 'icon-1024.png'), await icon(1024));
  write(path.join(previewDir, 'icon-round-192.png'), await icon(192, 'circle'));
  write(path.join(previewDir, 'icon-32.png'), await icon(32));
  write(path.join(previewDir, 'adaptive-bg.png'), await png(iconSvg({ size: 432, shape: 'square', frame: false, mark: false })));
  write(path.join(previewDir, 'adaptive-fg.png'), await png(iconSvg({ size: 432, bg: false, frame: false })));
  write(path.join(previewDir, 'splash-land-day.png'), await splash(1920, 1280, false));
  write(path.join(previewDir, 'splash-port-night.png'), await splash(1280, 1920, true));
  console.log(`essais dans ${previewDir}`);
} else {
  // Windows
  write('build/icon.png', await icon(1024));
  write('build/icon-256.png', await icon(256));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  write('build/icon.ico', ico(await Promise.all(sizes.map(async (size) => ({ size, data: await icon(size) })))));
  // Sources de @capacitor/assets : icone carree sans transparence (iOS arrondit lui-meme), calques, ecrans de demarrage.
  write('assets/icon-only.png', await sharp(await icon(1024, 'square')).flatten({ background: '#0d3a31' }).removeAlpha().png({ compressionLevel: 9 }).toBuffer());
  write('assets/icon.png', await icon(1024));
  write('assets/icon-foreground.png', await png(iconSvg({ size: 1024, bg: false, frame: false })));
  write('assets/icon-background.png', await png(iconSvg({ size: 1024, shape: 'square', frame: false, mark: false })));
  write('assets/splash.png', await splash(2732, 2732, false));
  write('assets/splash-dark.png', await splash(2732, 2732, true));
  // Android : icones aux densites existantes (36 a 192 px).
  const densities = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, size] of Object.entries(densities)) {
    const dir = path.join(RES, `mipmap-${d}`);
    write(path.join(dir, 'ic_launcher.png'), await icon(size));
    write(path.join(dir, 'ic_launcher_round.png'), await icon(size, 'circle'));
    write(path.join(dir, 'ic_launcher_background.png'), await png(iconSvg({ size, shape: 'square', frame: false, mark: false, lattice: size >= 64 })));
    write(path.join(dir, 'ic_launcher_foreground.png'), await png(iconSvg({ size, bg: false, frame: false })));
  }
  // Android : ecrans de demarrage, memes fichiers et memes dimensions.
  const splashes = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'splash.png') splashes.push(p); } };
  walk(RES);
  for (const f of splashes) {
    const { width, height } = await sharp(f).metadata();
    write(f, await splash(width, height, /-night/.test(path.dirname(f))));
  }
  console.log(`Windows : build/icon.png, icon-256.png, icon.ico (${sizes.join(', ')} px) · Android : ${Object.keys(densities).length} densites x 4 icones, ${splashes.length} ecrans de demarrage · assets/ (sources de @capacitor/assets)`);
}
