// Conversion phonétique : pinyin (marques de ton) -> zhuyin / pinyin / Tongyong / Wade-Giles.
// La logique d'analyse (syllabe -> initiale + finale + ton) est portée de scripts/lib/pinyin.mjs ;
// la sortie zhuyin y est identique (vérifié par scripts/check-phonetics.mjs).
//
// Sources des conventions :
//  - Zhuyin : convention de Taiwan (1er ton sans marque, ˊ ˇ ˋ après, ˙ du ton neutre DEVANT).
//  - Wade-Giles : table « Wade-Giles table » (Wikipédia) ; tons en exposants ¹ ² ³ ⁴, neutre sans chiffre.
//  - Tongyong : article « Tongyong Pinyin » (Wikipédia, section Features / Comparison) ; 1er ton non marqué,
//    tons 2-3-4 en diacritiques (´ ˇ `), ton neutre = petit rond (combinant U+030A) sur la voyelle porteuse
//    (« a small ring for the neutral tone (optional on computers) »).

export type PhoneticSystem = 'zhuyin' | 'pinyin' | 'tongyong' | 'wadegiles';

const TONE_MARKS: Record<string, readonly [string, number]> = {
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4],
  'ê': ['ê', 0],
};
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's'];
const APICAL_INITIALS = ['zh', 'ch', 'sh', 'r', 'z', 'c', 's'];
const INIT_ZH: Record<string, string> = { b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ', g: 'ㄍ', k: 'ㄎ', h: 'ㄏ', j: 'ㄐ', q: 'ㄑ', x: 'ㄒ', zh: 'ㄓ', ch: 'ㄔ', sh: 'ㄕ', r: 'ㄖ', z: 'ㄗ', c: 'ㄘ', s: 'ㄙ' };
const FINALS: Record<string, string> = {
  a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', 'ê': 'ㄝ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ', an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', er: 'ㄦ',
  i: 'ㄧ', ia: 'ㄧㄚ', io: 'ㄧㄛ', ie: 'ㄧㄝ', iai: 'ㄧㄞ', iao: 'ㄧㄠ', iu: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ', iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', ui: 'ㄨㄟ', uan: 'ㄨㄢ', un: 'ㄨㄣ', uang: 'ㄨㄤ', ueng: 'ㄨㄥ', ong: 'ㄨㄥ',
  'ü': 'ㄩ', 'üe': 'ㄩㄝ', 'üan': 'ㄩㄢ', 'ün': 'ㄩㄣ',
};
const STANDALONE: Record<string, string> = {
  yi: 'i', ya: 'ia', yo: 'io', ye: 'ie', yai: 'iai', yao: 'iao', you: 'iu', yan: 'ian', yin: 'in', yang: 'iang', ying: 'ing', yong: 'iong',
  wu: 'u', wa: 'ua', wo: 'uo', wai: 'uai', wei: 'ui', wan: 'uan', wen: 'un', wang: 'uang', weng: 'ueng',
  yu: 'ü', yue: 'üe', yuan: 'üan', yun: 'ün',
};
const TONE_ZH = ['', '', 'ˊ', 'ˇ', 'ˋ'];

// ---- Wade-Giles ----
const WG_INIT: Record<string, string> = {
  b: 'p', p: "p'", m: 'm', f: 'f', d: 't', t: "t'", n: 'n', l: 'l', g: 'k', k: "k'", h: 'h',
  j: 'ch', q: "ch'", x: 'hs', zh: 'ch', ch: "ch'", sh: 'sh', r: 'j', z: 'ts', c: "ts'", s: 's',
};
const WG_FIN: Record<string, string> = {
  a: 'a', o: 'o', e: 'ê', 'ê': 'eh', ai: 'ai', ei: 'ei', ao: 'ao', ou: 'ou', an: 'an', en: 'ên', ang: 'ang', eng: 'êng', er: 'êrh',
  i: 'i', ia: 'ia', io: 'io', ie: 'ieh', iai: 'iai', iao: 'iao', iu: 'iu', ian: 'ien', in: 'in', iang: 'iang', ing: 'ing', iong: 'iung',
  u: 'u', ua: 'ua', uo: 'uo', uai: 'uai', ui: 'ui', uan: 'uan', un: 'un', uang: 'uang', ueng: 'wêng', ong: 'ung',
  'ü': 'ü', 'üe': 'üeh', 'üan': 'üan', 'ün': 'ün',
};
// Syllabes sans initiale : règles Wade-Giles (u -> w, ü -> yü, i -> y...) et exceptions de la table.
const WG_STANDALONE: Record<string, string> = {
  i: 'i', ia: 'ya', io: 'yo', ie: 'yeh', iai: 'yai', iao: 'yao', iu: 'yu', ian: 'yen', in: 'yin', iang: 'yang', ing: 'ying', iong: 'yung',
  u: 'wu', ua: 'wa', uo: 'wo', uai: 'wai', ui: 'wei', uan: 'wan', un: 'wên', uang: 'wang', ueng: 'wêng',
  'ü': 'yü', 'üe': 'yüeh', 'üan': 'yüan', 'ün': 'yün',
};
const WG_UO_DROPS_U = ['d', 't', 'n', 'l', 'zh', 'ch', 'r', 'z', 'c', 's'];
const WG_TONE = ['', '¹', '²', '³', '⁴'];

// ---- Tongyong ----
const TY_INIT: Record<string, string> = { j: 'j', q: 'c', x: 's', zh: 'jh' };
const TY_FIN: Record<string, string> = { iu: 'iou', ui: 'uei', 'ü': 'yu', 'üe': 'yue', 'üan': 'yuan', 'ün': 'yun', iong: 'yong' };
const TY_STANDALONE: Record<string, string> = {
  i: 'yi', ia: 'ya', io: 'yo', ie: 'ye', iai: 'yai', iao: 'yao', iu: 'you', ian: 'yan', in: 'yin', iang: 'yang', ing: 'ying', iong: 'yong',
  u: 'wu', ua: 'wa', uo: 'wo', uai: 'wai', ui: 'wei', uan: 'wan', un: 'wun', uang: 'wang', ueng: 'wong',
  'ü': 'yu', 'üe': 'yue', 'üan': 'yuan', 'ün': 'yun',
};
const TY_TONE_MARK: Record<number, string> = { 2: '\u0301', 3: '\u030C', 4: '\u0300' };
const TY_NEUTRAL_MARK = '\u030A'; // petit rond au-dessus de la voyelle

function has(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/** "nǐ" -> base "ni", ton 3 ; ton 5 = neutre. Accepte aussi "ni3", "lv", "u:". */
function toNumbered(syl: string): { base: string; tone: number } {
  let tone = 5;
  let base = '';
  for (const ch of syl.normalize('NFC')) {
    const m = has(TONE_MARKS, ch) ? TONE_MARKS[ch] : undefined;
    if (m) { base += m[0]; if (m[1]) tone = m[1]; } else base += ch;
  }
  base = base.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const mnum = base.match(/^([a-zü]+)([1-5])$/);
  if (mnum) { base = mnum[1]; tone = Number(mnum[2]); }
  return { base, tone };
}

interface Parsed {
  init: string; // '' si pas d'initiale
  fin: string; // clé de FINALS (ü rétabli après j/q/x ; finale « normalisée » pour y/w)
  apical: boolean; // zhi chi shi ri zi ci si
  tone: number; // 1-4, 5 = neutre
}

function parse(syllable: string): Parsed | null {
  const { base, tone } = toNumbered(syllable);
  let init = '';
  let fin = base;
  for (const i of INITIALS) if (base.startsWith(i)) { init = i; fin = base.slice(i.length); break; }
  if (!init) {
    const f = has(STANDALONE, base) ? STANDALONE[base] : base;
    if (!has(FINALS, f)) return null;
    return { init, fin: f, apical: false, tone };
  }
  if ('jqxy'.includes(init)) {
    if (fin === 'u') fin = 'ü'; else if (fin === 'ue') fin = 'üe'; else if (fin === 'uan') fin = 'üan'; else if (fin === 'un') fin = 'ün';
  }
  if (fin === 'i' && APICAL_INITIALS.includes(init)) return { init, fin, apical: true, tone };
  if (!has(FINALS, fin)) return null;
  return { init, fin, apical: false, tone };
}

function toZhuyin(p: Parsed): string {
  const zh = p.apical ? INIT_ZH[p.init] : (p.init ? INIT_ZH[p.init] : '') + FINALS[p.fin];
  return p.tone === 5 ? '˙' + zh : zh + TONE_ZH[p.tone];
}

function toWadeGiles(p: Parsed): string {
  let s: string;
  if (!p.init) {
    s = has(WG_STANDALONE, p.fin) ? WG_STANDALONE[p.fin] : WG_FIN[p.fin];
  } else if (p.apical) {
    if (p.init === 'z') s = 'tzŭ';
    else if (p.init === 'c') s = "tz'ŭ";
    else if (p.init === 's') s = 'ssŭ';
    else s = WG_INIT[p.init] + 'ih';
  } else {
    let f = WG_FIN[p.fin];
    if (p.fin === 'e' && ['g', 'k', 'h'].includes(p.init)) f = 'o'; // ko k'o ho
    else if (p.fin === 'uo' && WG_UO_DROPS_U.includes(p.init)) f = 'o'; // to t'o no lo cho ch'o jo tso ts'o so
    else if (p.fin === 'ui' && ['g', 'k'].includes(p.init)) f = 'uei'; // kuei k'uei
    s = WG_INIT[p.init] + f;
  }
  return p.tone >= 1 && p.tone <= 4 ? s + WG_TONE[p.tone] : s;
}

/** Place la marque de ton sur la voyelle : a > e > o > dernière de i/u. */
function markTongyong(spelling: string, tone: number): string {
  const mark = tone === 5 ? TY_NEUTRAL_MARK : TY_TONE_MARK[tone];
  if (!mark) return spelling;
  let idx = -1;
  for (const v of ['a', 'e', 'o']) { idx = spelling.indexOf(v); if (idx >= 0) break; }
  if (idx < 0) for (let i = spelling.length - 1; i >= 0; i--) if (spelling[i] === 'i' || spelling[i] === 'u') { idx = i; break; }
  if (idx < 0) return spelling;
  return (spelling.slice(0, idx + 1) + mark + spelling.slice(idx + 1)).normalize('NFC');
}

function toTongyong(p: Parsed): string {
  let s: string;
  if (!p.init) {
    s = has(TY_STANDALONE, p.fin) ? TY_STANDALONE[p.fin] : p.fin;
  } else {
    const init = has(TY_INIT, p.init) ? TY_INIT[p.init] : p.init;
    if (p.apical) s = init + 'ih';
    else if (p.fin === 'eng' && p.init === 'f') s = init + 'ong'; // fong
    else s = init + (has(TY_FIN, p.fin) ? TY_FIN[p.fin] : p.fin);
  }
  return p.tone === 1 ? s : markTongyong(s, p.tone);
}

/** Une syllabe pinyin à marques de ton -> transcription dans le système. Syllabe inconnue : renvoyée telle quelle. */
export function convertSyllable(system: PhoneticSystem, syllable: string): string {
  if (system === 'pinyin') return syllable.normalize('NFC');
  const p = parse(syllable);
  if (!p) return syllable;
  if (system === 'zhuyin') return toZhuyin(p);
  if (system === 'wadegiles') return toWadeGiles(p);
  return toTongyong(p);
}

// Découpe un jeton collé ("nǐhǎo") en syllabes ; null si impossible.
function segment(tok: string): string[] | null {
  const chars = [...tok.normalize('NFC')];
  const bases = chars.map((c) => (has(TONE_MARKS, c) ? TONE_MARKS[c][0] : c.toLowerCase()));
  const memo = new Map<number, string[] | null>();
  const solve = (i: number): string[] | null => {
    if (i === chars.length) return [];
    const cached = memo.get(i);
    if (cached !== undefined) return cached;
    let res: string[] | null = null;
    for (let len = Math.min(6, chars.length - i); len >= 1; len--) {
      const b = bases.slice(i, i + len).join('').replace(/u:/g, 'ü').replace(/v/g, 'ü');
      if (!parse(b)) continue;
      const rest = solve(i + len);
      if (rest) { res = [chars.slice(i, i + len).join(''), ...rest]; break; }
    }
    memo.set(i, res);
    return res;
  };
  return solve(0);
}

/** Pinyin d'un mot ou d'une phrase -> une transcription par syllabe (ponctuation et séparateurs ignorés). */
export function convertPinyin(system: PhoneticSystem, pinyin: string): string[] {
  const out: string[] = [];
  for (const tok of pinyin.normalize('NFC').split(/[^\p{L}\p{N}:\p{M}]+/u)) {
    if (!tok || /^:+$/.test(tok)) continue;
    if (parse(tok)) { out.push(convertSyllable(system, tok)); continue; }
    const parts = segment(tok);
    if (parts) for (const s of parts) out.push(convertSyllable(system, s));
    else out.push(convertSyllable(system, tok));
  }
  return out;
}

/** Zhuyin d'une syllabe pour l'affichage vertical : symboles (sans ton) + marque de ton à part. */
export function zhuyinParts(syllable: string): { symbols: string; tone: string; neutral: boolean } {
  const z = convertSyllable('zhuyin', syllable);
  if (z === syllable && !parse(syllable)) return { symbols: syllable, tone: '', neutral: false };
  if (z.startsWith('˙')) return { symbols: z.slice(1), tone: '', neutral: true };
  const last = z.slice(-1);
  if (last === 'ˊ' || last === 'ˇ' || last === 'ˋ') return { symbols: z.slice(0, -1), tone: last, neutral: false };
  return { symbols: z, tone: '', neutral: false };
}
