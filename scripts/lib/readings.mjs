// Lectures fixees pour tout le corpus (cartes, exemples, repliques) : mot -> lecture de chaque caractere.
// Convention (2026-11-18) : lectures de Taiwan et TONS PLEINS pour les syllabes qui portent du sens (晚上 wǎn shàng,
// 休息 xiū xí, 東西 dōng xī) ; ton neutre garde pour les particules (了 的 得 著 嗎 呢 吧 啊 喔 們 麼), le
// classificateur 個, les suffixes 子 et 頭, les redoublements (媽媽, 謝謝) et 鑰匙. Le pinyin des cartes suit
// data/pinyin-overrides.json ; ce tableau sert a harmoniser les phrases (scripts/normalize-scene-pinyin.mjs).
export const FIXED = {
  '法國': ['fà', 'guó'],
  '塞車': ['sāi', 'chē'],
  '第一': ['dì', 'yī'],
  '星期': ['xīng', 'qí'],
  '垃圾': ['lè', 'sè'],
  '謝謝': ['xiè', 'xie'],
  '炸': ['zhà'],
  '東西': ['dōng', 'xī'],
  '關係': ['guān', 'xì'],
  '還是': ['hái', 'shì'],
  '多少': ['duō', 'shǎo'],
  '早上': ['zǎo', 'shàng'],
  '晚上': ['wǎn', 'shàng'],
  '路上': ['lù', 'shàng'],
  '先生': ['xiān', 'shēng'],
  '地方': ['dì', 'fāng'],
  '嘴巴': ['zuǐ', 'bā'],
  '耳朵': ['ěr', 'duǒ'],
  '休息': ['xiū', 'xí'],
  '意思': ['yì', 'sī'],
  '麻煩': ['má', 'fán'],
  '要是': ['yào', 'shì'],
  '一會兒': ['yí', 'huì', 'ér'],
  '認識': ['rèn', 'shì'],
  '價錢': ['jià', 'qián'],
  '月亮': ['yuè', 'liàng'],
  '時候': ['shí', 'hòu'],
  '厲害': ['lì', 'hài'],
  '清楚': ['qīng', 'chǔ'],
  '名字': ['míng', 'zì'],
  '豆腐': ['dòu', 'fǔ'],
  '衣服': ['yī', 'fú'],
  '護士': ['hù', 'shì'],
  '眉毛': ['méi', 'máo'],
  '親戚': ['qīn', 'qī'],
  '蘿蔔': ['luó', 'bó'],
  '行李': ['xíng', 'lǐ'],
  '收拾': ['shōu', 'shí'],
  '抽屜': ['chōu', 'tì'],
  '精神': ['jīng', 'shén'],
  '屁股': ['pì', 'gǔ'],
  '力氣': ['lì', 'qì'],
  '蒼蠅': ['cāng', 'yíng'],
  '消息': ['xiāo', 'xí'],
  '風箏': ['fēng', 'zhēng'],
  '掰掰': ['bāi', 'bai'],
  '主角': ['zhǔ', 'jué'],
  '檔': ['dǎng'],
  '夾': ['jiá'],
  '空位': ['kòng', 'wèi'],
  '液': ['yè'],
  '味噌': ['wèi', 'zēng'],
  // 轉 faire tourner (devisser) : zhuàn ; la carte 轉 (virer, tourner a un carrefour) reste zhuǎn.
  '轉下來': ['zhuàn', 'xià', 'lái'],
};

const isHan = (c) => /\p{Script=Han}/u.test(c);
const LETTERS = 'a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü';
const TOKEN = new RegExp(`^([^${LETTERS}]*)([${LETTERS}]+)(.*)$`);

/**
 * Applique FIXED au pinyin d'une phrase (une syllabe par caractere chinois, separees par des espaces).
 * Renvoie le pinyin corrige, ou null si le pinyin n'est pas aligne (on ne touche pas a la phrase).
 */
export function fixPinyin(zh, pinyin) {
  const han = [...zh].filter(isHan).join('');
  const tokens = pinyin.split(/\s+/).filter(Boolean);
  if (tokens.length !== [...han].length) return Object.keys(FIXED).some((w) => han.includes(w)) ? null : pinyin;
  for (const [word, syl] of Object.entries(FIXED)) {
    let at = han.indexOf(word);
    while (at >= 0) {
      syl.forEach((s, k) => {
        const m = TOKEN.exec(tokens[at + k]);
        if (!m) return;
        const upper = m[2][0] !== m[2][0].toLowerCase();
        tokens[at + k] = m[1] + (upper ? s[0].toUpperCase() + s.slice(1) : s) + m[3];
      });
      at = han.indexOf(word, at + word.length);
    }
  }
  return tokens.join(' ');
}
