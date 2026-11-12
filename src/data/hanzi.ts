import index from './generated/hanzi-index.json';

// Donnees de traits (format hanzi-writer) chargees a la demande, par palier.
type Bundle = Record<string, unknown>;
const loaders: Record<number, () => Promise<{ default: Bundle }>> = {
  1: () => import('./generated/hanzi-t1.json'),
  2: () => import('./generated/hanzi-t2.json'),
  3: () => import('./generated/hanzi-t3.json'),
  4: () => import('./generated/hanzi-t4.json'),
  5: () => import('./generated/hanzi-t5.json'),
  6: () => import('./generated/hanzi-t6.json'),
};
const cache = new Map<number, Promise<Bundle>>();

export function hasCharData(ch: string): boolean {
  return ch in (index as Record<string, number>);
}

export async function loadCharData(ch: string): Promise<unknown | null> {
  const t = (index as Record<string, number>)[ch];
  if (!t) return null;
  if (!cache.has(t)) cache.set(t, loaders[t]().then((m) => m.default));
  const bundle = await cache.get(t)!;
  return bundle[ch] ?? null;
}
