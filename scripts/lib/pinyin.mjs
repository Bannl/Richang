// Pinyin (marques de ton) -> zhuyin (bopomofo, convention Taiwan : ˙ devant la syllabe neutre).
const TONE_MARKS = {
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4],
  'ê': ['ê', 0],
};
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's'];
const INIT_ZH = { b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ', g: 'ㄍ', k: 'ㄎ', h: 'ㄏ', j: 'ㄐ', q: 'ㄑ', x: 'ㄒ', zh: 'ㄓ', ch: 'ㄔ', sh: 'ㄕ', r: 'ㄖ', z: 'ㄗ', c: 'ㄘ', s: 'ㄙ' };
const FINALS = {
  a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', 'ê': 'ㄝ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ', an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', er: 'ㄦ',
  i: 'ㄧ', ia: 'ㄧㄚ', io: 'ㄧㄛ', ie: 'ㄧㄝ', iai: 'ㄧㄞ', iao: 'ㄧㄠ', iu: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ', iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', ui: 'ㄨㄟ', uan: 'ㄨㄢ', un: 'ㄨㄣ', uang: 'ㄨㄤ', ueng: 'ㄨㄥ', ong: 'ㄨㄥ',
  'ü': 'ㄩ', 'üe': 'ㄩㄝ', 'üan': 'ㄩㄢ', 'ün': 'ㄩㄣ',
};
const STANDALONE = {
  yi: 'i', ya: 'ia', yo: 'io', ye: 'ie', yai: 'iai', yao: 'iao', you: 'iu', yan: 'ian', yin: 'in', yang: 'iang', ying: 'ing', yong: 'iong',
  wu: 'u', wa: 'ua', wo: 'uo', wai: 'uai', wei: 'ui', wan: 'uan', wen: 'un', wang: 'uang', weng: 'ueng',
  yu: 'ü', yue: 'üe', yuan: 'üan', yun: 'ün',
};
const TONE_ZH = ['', '', 'ˊ', 'ˇ', 'ˋ'];

// "nǐ" -> { base: "ni", tone: 3 } ; ton 5 = neutre. Accepte aussi "ni3", "lv", "u:".
export function syllableToNumbered(syl) {
  let tone = 5;
  let base = '';
  for (const ch of syl.normalize('NFC')) {
    const m = TONE_MARKS[ch];
    if (m) { base += m[0]; if (m[1]) tone = m[1]; } else base += ch;
  }
  base = base.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const mnum = base.match(/^([a-zü]+)([1-5])$/);
  if (mnum) { base = mnum[1]; tone = Number(mnum[2]); }
  return { base, tone };
}

export function numberedToZhuyin(base, tone) {
  let init = '';
  let fin = base;
  for (const i of INITIALS) if (base.startsWith(i)) { init = i; fin = base.slice(i.length); break; }
  let zh;
  if (!init) {
    const f = STANDALONE[base] ?? base;
    if (!(f in FINALS)) return null;
    zh = FINALS[f];
  } else {
    if ('jqxy'.includes(init)) {
      if (fin === 'u') fin = 'ü'; else if (fin === 'ue') fin = 'üe'; else if (fin === 'uan') fin = 'üan'; else if (fin === 'un') fin = 'ün';
    }
    if (fin === 'i' && ['zh', 'ch', 'sh', 'r', 'z', 'c', 's'].includes(init)) zh = INIT_ZH[init];
    else { if (!(fin in FINALS)) return null; zh = INIT_ZH[init] + FINALS[fin]; }
  }
  return tone === 5 ? '˙' + zh : zh + TONE_ZH[tone];
}

export function isSyllable(base) {
  return numberedToZhuyin(base, 1) !== null;
}

// Decoupe un mot pinyin en syllabes : "nǐ hǎo", "nǐhǎo", "xī'ān" -> ["nǐ","hǎo"].
export function splitSyllables(pinyin) {
  const tokens = pinyin.trim().split(/[\s'’\-]+/).filter(Boolean);
  const out = [];
  for (const tok of tokens) {
    const { base } = syllableToNumbered(tok);
    if (isSyllable(base)) { out.push(tok); continue; }
    // Decoupage : on travaille sur les caracteres originaux pour conserver les tons.
    const chars = [...tok.normalize('NFC')];
    const bases = chars.map((c) => (TONE_MARKS[c] ? TONE_MARKS[c][0] : c.toLowerCase()));
    const memo = new Map();
    const solve = (i) => {
      if (i === chars.length) return [];
      if (memo.has(i)) return memo.get(i);
      let res = null;
      for (let len = Math.min(6, chars.length - i); len >= 1; len--) {
        const b = bases.slice(i, i + len).join('').replace(/u:/g, 'ü').replace(/v/g, 'ü');
        if (!isSyllable(b)) continue;
        const rest = solve(i + len);
        if (rest) { res = [chars.slice(i, i + len).join(''), ...rest]; break; }
      }
      memo.set(i, res);
      return res;
    };
    const parts = solve(0);
    if (!parts) return null;
    out.push(...parts);
  }
  return out;
}

// "nǐ hǎo" -> ["ㄋㄧˇ", "ㄏㄠˇ"] ou null si invalide.
export function pinyinToZhuyin(pinyin) {
  const syls = splitSyllables(pinyin);
  if (!syls) return null;
  const out = [];
  for (const s of syls) {
    const { base, tone } = syllableToNumbered(s);
    const z = numberedToZhuyin(base, tone);
    if (!z) return null;
    out.push(z);
  }
  return out;
}

// "nǐ hǎo" -> "ni3 hao3" (format CC-CEDICT, ü -> u:)
export function pinyinToNumbered(pinyin) {
  const syls = splitSyllables(pinyin);
  if (!syls) return null;
  return syls.map((s) => { const { base, tone } = syllableToNumbered(s); return base.replace(/ü/g, 'u:') + tone; }).join(' ');
}

// ("ni", 3) -> "nǐ" : place la marque de ton selon la regle a/e > ou > derniere voyelle.
const MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
export function numberedToMarked(base, tone) {
  if (tone === 5 || tone < 1 || tone > 4) return base;
  let idx = -1;
  if (base.includes('a')) idx = base.indexOf('a');
  else if (base.includes('e')) idx = base.indexOf('e');
  else if (base.includes('ou')) idx = base.indexOf('o');
  else { for (let i = base.length - 1; i >= 0; i--) if ('iuoü'.includes(base[i])) { idx = i; break; } }
  if (idx < 0) return base;
  const v = base[idx];
  return base.slice(0, idx) + MARKS[v][tone - 1] + base.slice(idx + 1);
}

// Sandhi de 一 et 不 a l'interieur d'un mot (forme prononcee) : yī -> yí devant 4e ton, yì devant 1/2/3 ; bù -> bú devant 4e ton.
export function applySandhi(hanzi, syllables) {
  const chars = [...hanzi].filter((c) => /\p{Script=Han}/u.test(c));
  if (chars.length !== syllables.length) return syllables;
  const out = [...syllables];
  for (let i = 0; i < chars.length - 1; i++) {
    const next = syllableToNumbered(out[i + 1]).tone;
    if (chars[i] === '一' && syllableToNumbered(out[i]).base === 'yi') {
      if (next === 4) out[i] = 'yí'; else if (next >= 1 && next <= 3) out[i] = 'yì';
    } else if (chars[i] === '不' && syllableToNumbered(out[i]).base === 'bu') {
      out[i] = next === 4 ? 'bú' : 'bù';
    }
  }
  return out;
}
