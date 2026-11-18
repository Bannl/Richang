import fs from 'node:fs';

// Seuils cumulés des paliers : 100, 200, 400, 600, 1000, 2000.
// 7e palier : les mots des dialogues ajoutes apres les 2000 (rangs 2001 et suivants).
export const TIER_LIMITS = [100, 200, 400, 600, 1000, 2000, 99999];
export const TIER_SIZES = [100, 100, 200, 200, 400, 1000];

export function tierOfRank(rank) {
  for (let i = 0; i < TIER_LIMITS.length; i++) if (rank <= TIER_LIMITS[i]) return i + 1;
  return TIER_LIMITS.length;
}

// Format : lignes "# tier N" puis "theme: mot mot mot".
export function parseMasterFile(path) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  let tier = 0;
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const mt = line.match(/^#\s*tier\s*(\d+)/i);
    if (mt) { tier = Number(mt[1]); continue; }
    if (line.startsWith('#')) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/);
    if (!m) throw new Error('Ligne invalide : ' + line);
    for (const w of m[2].split(/\s+/).filter(Boolean)) out.push({ hanzi: w, theme: m[1], tier });
  }
  return out;
}

// Caracteres simplifies frequents (jamais acceptes).
export const SIMPLIFIED = '们这个说为么会来时间对学车东电话见认识觉让问关开头发医药长张钱买卖饭鸡鱼马鸟龙点机场儿写读书样应该经过还没进办现难题爱选择听语词汉华国园图馆运动员讲论气护师职业务报纸网络软视频谁习练备着够总从边带号处调节约环转变际观实产厂据剧闹专团圆条丽双众钟类线组织费历况将虽亲则岁记乐块术义证请谢欢岛湾亚欧饮饺汤鸭虾贝壳农渔铁钢银铜锅盘饼盐酱饿热热凉凤鸟鹅猫猪';
// Formes ambigues (existent aussi en traditionnel) : signalees en avertissement seulement.
export const SUSPICIOUS = '后里干于云几台只系';

export function findSimplified(text) {
  const bad = new Set();
  for (const ch of text) if (SIMPLIFIED.includes(ch)) bad.add(ch);
  return [...bad];
}
