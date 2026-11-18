// Ponctuation du chinois des phrases du jeu : pleine chasse (，？！；：), comme on l'ecrit a Taiwan.
// Les signes latins , ? ! ; : sont convertis, sauf entre deux chiffres (1,000 ; 3:30).
// Utilise par scripts/normalize-punct.mjs (correction) et par les controles (validate-scenes, check-scenes, validate-words).
const FULL = { ',': '，', '?': '？', '!': '！', ';': '；', ':': '：' };

/** Le texte chinois avec sa ponctuation en pleine chasse. */
export function toFullwidth(zh) {
  return zh.replace(/[,?!;:]/g, (c, i, s) => (/\d/.test(s[i - 1] ?? '') && /\d/.test(s[i + 1] ?? '') ? c : FULL[c]));
}

/** Vrai si le texte chinois contient une ponctuation latine a convertir. */
export const hasLatinPunct = (zh) => toFullwidth(zh) !== zh;
