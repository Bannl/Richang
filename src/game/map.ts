import { mulberry32, pick, shuffleWith } from './rng';
import { BOSS_SITUATION } from './situations';
import type { MapNode, NodeType, RunMap } from './types';

const LAYERS = 8; // 0 = depart, 7 = boss

/**
 * Carte de run : rangees de 2 a 4 noeuds entre le depart et le boss, chaque noeud relie a 1-2 noeuds
 * de la rangee suivante, tous atteignables. Les situations sont tirees parmi celles jouables.
 */
export function generateMap(seed: number, situations: string[]): RunMap {
  const rng = mulberry32(seed);
  const sizes = [1, ...Array.from({ length: LAYERS - 2 }, () => 2 + Math.floor(rng() * 3)), 1];
  const nodes: MapNode[] = [];
  const byLayer: MapNode[][] = [];

  // Types : que des rencontres en rangee 1 ; ensuite melange avec au moins un repos et une elite.
  const typesFor = (layer: number, n: number): NodeType[] => {
    if (layer === 0) return ['start'];
    if (layer === LAYERS - 1) return ['boss'];
    if (layer === 1) return Array(n).fill('fight');
    const out: NodeType[] = [];
    for (let i = 0; i < n; i++) {
      const r = rng();
      out.push(r < 0.62 ? 'fight' : r < 0.84 ? 'elite' : 'rest');
    }
    if (layer === LAYERS - 2 && !out.includes('rest')) out[Math.floor(rng() * n)] = 'rest';
    return out;
  };

  let pool = shuffleWith(rng, situations);
  const nextSituation = (): string => {
    if (pool.length === 0) pool = shuffleWith(rng, situations);
    return pool.shift()!;
  };

  for (let layer = 0; layer < LAYERS; layer++) {
    const n = sizes[layer];
    const types = typesFor(layer, n);
    const row: MapNode[] = [];
    for (let col = 0; col < n; col++) {
      const type = types[col];
      const jitter = n > 1 ? (rng() - 0.5) * 0.12 : 0;
      row.push({
        id: `L${layer}-${col}`,
        layer, col, type,
        situation: type === 'fight' || type === 'elite' ? nextSituation() : type === 'boss' ? BOSS_SITUATION.id : null,
        next: [],
        x: n === 1 ? 0.5 : (col + 0.5) / n + jitter,
      });
    }
    byLayer.push(row);
    nodes.push(...row);
  }
  // Une rangee de repos ne doit pas avoir que des repos.
  for (let layer = 2; layer < LAYERS - 1; layer++) {
    const row = byLayer[layer];
    if (row.every((nd) => nd.type === 'rest')) { row[0].type = 'fight'; row[0].situation = nextSituation(); }
  }

  // Aretes : chaque noeud vise le noeud "en face" de la rangee suivante, parfois son voisin ;
  // puis on garantit une entree a chaque noeud.
  for (let layer = 0; layer < LAYERS - 1; layer++) {
    const from = byLayer[layer];
    const to = byLayer[layer + 1];
    for (let j = 0; j < from.length; j++) {
      const base = Math.floor((j * to.length) / from.length);
      const targets = new Set<number>([Math.min(base, to.length - 1)]);
      if (rng() < 0.5 && base + 1 < to.length) targets.add(base + 1);
      if (rng() < 0.25 && base - 1 >= 0) targets.add(base - 1);
      from[j].next = [...targets].sort((a, b) => a - b).map((k) => to[k].id);
    }
    for (let k = 0; k < to.length; k++) {
      if (from.some((nd) => nd.next.includes(to[k].id))) continue;
      const nearest = from.reduce((best, nd) => (Math.abs(nd.x - to[k].x) < Math.abs(best.x - to[k].x) ? nd : best), from[0]);
      nearest.next = [...nearest.next, to[k].id].sort();
    }
  }
  // Depart relie a toute la rangee 1, derniere rangee reliee au boss.
  byLayer[0][0].next = byLayer[1].map((nd) => nd.id);
  for (const nd of byLayer[LAYERS - 2]) nd.next = [byLayer[LAYERS - 1][0].id];

  void pick; // (helper conserve pour les extensions)
  return { layers: LAYERS, nodes };
}

export function nodeById(map: RunMap, id: string): MapNode {
  const n = map.nodes.find((nd) => nd.id === id);
  if (!n) throw new Error('Noeud inconnu : ' + id);
  return n;
}
