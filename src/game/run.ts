import { introduceWord } from '../core/apply';
import { recordDrawing } from '../core/mastery';
import { orderMixed } from '../core/session';
import { newProgress, review } from '../core/srs';
import { SKILLS, type AppState, type Difficulty, type Word } from '../core/types';
import { DIALOGUES, type Exchange, type Speech } from '../data/dialogues';
import { SCENES } from '../data/scenes';
import { WORDS } from '../data/words';
import { buildDictionary, buildLinePool, segment } from './lines';
import { generateMap, nodeById } from './map';
import { dayRules, scenePenalty, type DayRules } from './progression';
import { mulberry32, shuffleWith } from './rng';
import { BOSS_SITUATION, SITUATIONS, SITUATION_BY_ID } from './situations';
import {
  EXCHANGES_PER_TYPE, HAND_SIZE, MIN_DECK_FOR_RUN, NIGHT_HEAL, REPLAYS_PER_ENCOUNTER, REST_HEAL, REWARD_PER_TYPE, RUN_MAX_HP,
  type DialogueLine, type Encounter, type FightType, type Line, type RunState, type Scene, type SceneLine, type Segment, type Speaker,
} from './types';

const DICT = buildDictionary(WORDS);
const MIN_THEMATIC_LINES = 3;

export const deckSet = (state: AppState): Set<number> => new Set(state.unlocked);
export const isUnlocked = (state: AppState, rank: number): boolean => state.unlocked.includes(rank);

/** Toutes les phrases a trou (exemples) jouables avec le deck courant : mode entrainement et repli. */
export function linePool(state: AppState): Line[] {
  return buildLinePool(WORDS, deckSet(state), DICT);
}

/** Decoupage en mots d'une phrase (memorise : les memes repliques reviennent a chaque rencontre et a chaque carte). */
const SEGMENTS = new Map<string, Segment[]>();
export function segmentsOf(zh: string): Segment[] {
  let s = SEGMENTS.get(zh);
  if (!s) { s = segment(zh, DICT); SEGMENTS.set(zh, s); }
  return s;
}

/** Mots du deck presents dans une phrase (rangs distincts). */
function deckWordsIn(zh: string, deck: Set<number>): number[] {
  const out = new Set<number>();
  for (const s of segmentsOf(zh)) if (s.rank !== null && deck.has(s.rank)) out.add(s.rank);
  return [...out];
}

/**
 * Scene jouable de bout en bout : chacune de ses repliques contient au moins un mot du deck, donc au moins un trou.
 * (Une replique sans mot du deck se jouerait toute seule.)
 */
function sceneFull(scene: Scene, deck: Set<number>): boolean {
  return scene.lines.every((l) => deckWordsIn(l.zh, deck).length > 0);
}

const playableWith = (deck: Set<number>) => (ex: Exchange) =>
  deckWordsIn(ex.enemy.zh, deck).length > 0 && (!ex.player || deckWordsIn(ex.player.zh, deck).length > 0);

/** Situations jouables : assez de dialogues (ou de phrases d'exemple) utilisables avec le deck. */
export function availableSituations(state: AppState): string[] {
  const deck = deckSet(state);
  const playable = playableWith(deck);
  const byTheme = new Map<string, number>();
  for (const l of linePool(state)) byTheme.set(l.theme, (byTheme.get(l.theme) ?? 0) + 1);
  return SITUATIONS
    .filter((s) => !s.boss)
    .filter((s) => {
      // Situation convertie en scenes : proposee seulement si le deck rend une scene jouable de bout en bout (un trou
      // a chaque replique ; les mots debloques dictent les situations rencontrees). Sinon, ancien filet de repli.
      const scenes = SCENES[s.id] ?? [];
      if (scenes.length) return scenes.some((sc) => sceneFull(sc, deck));
      const dialogues = (DIALOGUES[s.id] ?? []).filter(playable).length;
      const thematic = s.themes.reduce((n, th) => n + (byTheme.get(th) ?? 0), 0);
      return dialogues >= 2 || thematic >= MIN_THEMATIC_LINES;
    })
    .map((s) => s.id);
}

const BY_RANK = [...WORDS].sort((a, b) => a.rank - b.rank);
const MIXED = orderMixed(BY_RANK); // ordre fixe : les themes alternent dans chaque palier

/** Prochaines cartes a debloquer (ordre de frequence, themes alternes dans un palier). */
export function nextUnlockables(state: AppState, n: number, exclude: number[] = []): Word[] {
  const taken = new Set([...state.unlocked, ...exclude]);
  const ordered = state.settings.newOrder === 'theme' ? BY_RANK : MIXED;
  return ordered.filter((w) => !taken.has(w.rank)).slice(0, n);
}

/** Debloque une carte : elle rejoint le deck et compte comme ecrite une fois. */
export function unlockWord(state: AppState, rank: number, now: number): AppState {
  if (state.unlocked.includes(rank)) return state;
  const s = introduceWord(state, rank, now);
  const p = s.progress[rank];
  return {
    ...s,
    progress: { ...s.progress, [rank]: { ...p, skills: { ...p.skills, write: review(p.skills.write, 2, now) } } },
    unlocked: [...s.unlocked, rank],
  };
}

export const canStartRun = (state: AppState): boolean => state.unlocked.length >= MIN_DECK_FOR_RUN;

/**
 * Situations possibles pour l'evenement de fin de journee (et pour le mode Situation) : celles jouables avec le deck,
 * plus l'entretien de residence (situation reservee a la fin de journee) quand une de ses scenes est jouable.
 */
export function finalCandidates(state: AppState): string[] {
  const deck = deckSet(state);
  const out = availableSituations(state);
  for (const s of SITUATIONS) if (s.boss && (SCENES[s.id] ?? []).some((sc) => sceneFull(sc, deck))) out.push(s.id);
  return out;
}

/** Evenement de fin de journee : jamais celui de la veille, et les plus recents evites tant qu'il reste du choix. */
function pickFinal(state: AppState, rng: () => number, previous: string[]): string {
  const all = finalCandidates(state);
  if (all.length === 0) return BOSS_SITUATION.id;
  for (const keep of [Math.min(3, all.length - 1), 1, 0]) {
    const recent = new Set(keep > 0 ? previous.slice(-keep) : []);
    const pool = all.filter((id) => !recent.has(id));
    if (pool.length) return pool[Math.floor(rng() * pool.length)];
  }
  return all[0];
}

/** Carte de la journee : rencontres parmi les situations jouables, et l'evenement qui termine la journee. */
function dayMap(state: AppState, run: RunState): RunState {
  const seed = (run.seed + (run.day - 1) * 104729) >>> 0;
  let situations = availableSituations(state);
  if (situations.length === 0) situations = ['small-talk'];
  const final = pickFinal(state, mulberry32(seed ^ 0x5bd1e995), run.finals);
  return { ...run, map: generateMap(seed, situations, final), current: 'L0-0', visited: ['L0-0'], encounter: null, reward: null, phase: 'map' };
}

/** Nouveau run : la premiere journee. Le score sera le nombre de journees reussies avant de perdre toutes ses vies. */
export function startRun(state: AppState, difficulty: Difficulty, now: number): AppState {
  if (!canStartRun(state)) return state;
  const seed = (now ^ (state.runsPlayed * 7919)) >>> 0;
  const run: RunState = {
    seed, difficulty, hp: RUN_MAX_HP, maxHp: RUN_MAX_HP,
    map: { layers: 0, nodes: [] },
    current: 'L0-0', visited: ['L0-0'],
    encounter: null, reward: null, restHealed: 0, phase: 'map',
    startedAt: now, cardsUnlocked: 0, correct: 0, wrong: 0,
    day: 1, finals: [], seen: [], bestBefore: state.bestDays, dayStart: { correct: 0, wrong: 0, cards: 0 },
  };
  return { ...state, run: dayMap(state, run), runsPlayed: state.runsPlayed + 1, settings: { ...state.settings, difficulty } };
}

/** Journee reussie : une nuit de sommeil (+1 vie, jusqu'au maximum), puis la journee suivante sur une nouvelle carte. */
export function nextDay(state: AppState): AppState {
  const run = state.run;
  if (!run || (run.phase !== 'dayEnd' && run.phase !== 'won')) return state;
  const final = run.map.nodes.find((n) => n.type === 'boss')?.situation;
  const next: RunState = {
    ...run,
    day: run.day + 1,
    hp: Math.min(run.maxHp, run.hp + NIGHT_HEAL),
    finals: final ? [...run.finals, final] : run.finals,
    dayStart: { correct: run.correct, wrong: run.wrong, cards: run.cardsUnlocked },
  };
  return { ...state, run: dayMap(state, next) };
}

// --- Rencontre : dialogue ---

function prepareLine(speaker: Speaker, speech: Speech, deck: Set<number>, maxBlanks: number, rng: () => number): DialogueLine {
  const segments = segment(speech.zh, DICT);
  const candidates = segments
    .map((s, i) => ({ rank: s.rank, i }))
    .filter((x): x is { rank: number; i: number } => x.rank !== null && deck.has(x.rank));
  // Un rang par trou, et jamais deux trous cote a cote (deux cases adjacentes se lisent comme un seul mot).
  const seen = new Set<number>();
  const chosen: { rank: number; i: number }[] = [];
  for (const x of shuffleWith(rng, candidates)) {
    if (chosen.length >= maxBlanks) break;
    if (seen.has(x.rank) || chosen.some((c) => Math.abs(c.i - x.i) === 1)) continue;
    seen.add(x.rank);
    chosen.push(x);
  }
  const blanks = chosen.map((x) => x.i).sort((a, b) => a - b);
  return { speaker, speech, segments, blanks, filled: blanks.map(() => null), results: blanks.map(() => null) };
}

// --- Complexite des scenes ---

const isHan = (c: string) => /\p{Script=Han}/u.test(c);

/**
 * Complexite d'une scene : longueur moyenne de ses repliques (caracteres), rarete de son vocabulaire (rang du mot au
 * 80e centile) et part de mots hors des 2000 mots du jeu.
 */
function complexity(scene: Scene): number {
  let han = 0;
  let unknown = 0;
  const ranks: number[] = [];
  for (const l of scene.lines) {
    for (const s of segmentsOf(l.zh)) {
      const n = [...s.text].filter(isHan).length;
      han += n;
      if (s.rank !== null) ranks.push(s.rank); else unknown += n;
    }
  }
  ranks.sort((a, b) => a - b);
  const r80 = ranks.length ? ranks[Math.floor(0.8 * (ranks.length - 1))] : 1;
  return han / Math.max(1, scene.lines.length) / 8 + Math.log2(1 + r80) / 11 + (unknown / Math.max(1, han)) * 0.8;
}

let LEVELS: Map<string, number> | null = null;
/** Niveau d'une scene, de 1 (simple) a 5 (riche) : quintiles de complexite sur tout le corpus. */
export function sceneLevel(scene: Scene): number {
  if (!LEVELS) {
    const all = Object.values(SCENES).flat().map((sc) => ({ id: sc.id, c: complexity(sc) })).sort((a, b) => a.c - b.c);
    LEVELS = new Map(all.map((x, i) => [x.id, 1 + Math.floor((5 * i) / Math.max(1, all.length))]));
  }
  return LEVELS.get(scene.id) ?? 3;
}

/** Echanges d'une rencontre : dialogues de la situation, puis des autres situations, puis phrases d'exemple. */
function pickExchanges(state: AppState, situationId: string, n: number, rng: () => number): Exchange[] {
  const playable = playableWith(deckSet(state));
  let chosen = shuffleWith(rng, (DIALOGUES[situationId] ?? []).filter(playable)).slice(0, n);
  if (chosen.length < n) {
    const others = Object.entries(DIALOGUES).filter(([id]) => id !== situationId).flatMap(([, exs]) => exs).filter(playable);
    chosen = chosen.concat(shuffleWith(rng, others).slice(0, n - chosen.length));
  }
  if (chosen.length < n) {
    const themes = new Set(SITUATION_BY_ID.get(situationId)?.themes ?? []);
    const pool = linePool(state);
    const ordered = [
      ...shuffleWith(rng, pool.filter((l) => themes.size === 0 || themes.has(l.theme))),
      ...shuffleWith(rng, pool.filter((l) => themes.size > 0 && !themes.has(l.theme))),
    ];
    const seen = new Set<string>();
    for (const l of ordered) {
      if (chosen.length >= n) break;
      if (seen.has(l.zh)) continue;
      seen.add(l.zh);
      chosen.push({ enemy: { zh: l.zh, pinyin: l.pinyin, en: l.en, fr: l.fr } });
    }
  }
  return chosen;
}

/** Rangs encore necessaires pour terminer une replique. */
function neededRanks(line: DialogueLine | undefined): number[] {
  if (!line) return [];
  const out = new Set<number>();
  line.blanks.forEach((b, i) => { const r = line.segments[b].rank; if (line.filled[i] === null && r !== null) out.add(r); });
  return [...out];
}

/** Complete la main a 5 cartes en garantissant les cartes necessaires a la replique courante. */
function refillHand(enc: Encounter, deck: number[], rng: () => number, difficulty: Difficulty): Encounter {
  if (difficulty === 'native') return { ...enc, hand: [], pile: [] }; // Native : pas de main, le mot manquant s'ecrit
  const hand = [...enc.hand];
  let pile = [...enc.pile];
  const needed = neededRanks(enc.lines[enc.index]);
  for (const r of needed) {
    if (hand.includes(r)) continue;
    pile = pile.filter((x) => x !== r);
    if (hand.length >= HAND_SIZE) {
      const swappable = hand.map((x, i) => ({ x, i })).filter(({ x }) => !needed.includes(x));
      const victim = swappable[Math.floor(rng() * swappable.length)];
      pile.push(hand[victim.i]);
      hand[victim.i] = r;
    } else hand.push(r);
  }
  while (hand.length < HAND_SIZE && deck.length > hand.length) {
    if (pile.length === 0) pile = shuffleWith(rng, deck.filter((x) => !hand.includes(x)));
    if (pile.length === 0) break;
    hand.push(pile.shift()!);
  }
  return { ...enc, hand: shuffleWith(rng, hand), pile };
}

/** Mots-cles d'une scene reellement dans le deck (donc jouables comme trous). */
function sceneHits(scene: Scene, deck: Set<number>): number {
  let n = 0;
  for (const rk of scene.keywords) if (deck.has(rk)) n++;
  return n;
}

/**
 * Transforme une replique de scene en replique jouable. Trous : les mots du deck presents dans la phrase, les mots-cles
 * de la scene en premier (le vocabulaire qu'elle fait travailler), puis les autres ; les mots tres frequents (rang
 * <= commonCut, qui monte au fil des journees) passent en dernier. Au moins un trou des que la replique contient un mot
 * du deck (les scenes retenues en ont un a chaque replique).
 */
function prepareSceneLine(line: SceneLine, deck: Set<number>, keywords: Set<number>, maxBlanks: number, commonCut: number, rng: () => number, voice?: string): DialogueLine {
  const speech: Speech = { zh: line.zh, pinyin: line.pinyin, en: line.en, fr: line.fr };
  const segments = segmentsOf(line.zh);
  const inDeck = segments
    .map((s, i) => ({ rank: s.rank, i }))
    .filter((x): x is { rank: number; i: number } => x.rank !== null && deck.has(x.rank));
  const rare = (x: { rank: number }) => x.rank > commonCut;
  const candidates = [
    ...shuffleWith(rng, inDeck.filter((x) => keywords.has(x.rank) && rare(x))),
    ...shuffleWith(rng, inDeck.filter((x) => !keywords.has(x.rank) && rare(x))),
    ...shuffleWith(rng, inDeck.filter((x) => keywords.has(x.rank) && !rare(x))),
    ...shuffleWith(rng, inDeck.filter((x) => !keywords.has(x.rank) && !rare(x))),
  ];
  const seen = new Set<number>();
  const chosen: { rank: number; i: number }[] = [];
  for (const x of candidates) {
    if (chosen.length >= maxBlanks) break;
    if (seen.has(x.rank) || chosen.some((c) => Math.abs(c.i - x.i) === 1)) continue;
    seen.add(x.rank);
    chosen.push(x);
  }
  const blanks = chosen.map((x) => x.i).sort((a, b) => a - b);
  return { speaker: line.speaker, speech, segments, blanks, filled: blanks.map(() => null), results: blanks.map(() => null), voice };
}

/**
 * Rencontre a partir d'UNE scene coherente jouable avec le deck (on ne colle jamais deux scenes : la conversation
 * resterait decousue). On choisit la plus proche des regles du jour (longueur, complexite), en preferant les scenes
 * pas encore jouees et celles dont les mots-cles sont dans le deck ; au hasard parmi les meilleures.
 */
function buildSceneEncounter(
  state: AppState, nodeId: string, type: FightType, situationId: string, rng: () => number,
  rules: DayRules, seen: string[], difficulty: Difficulty,
): { encounter: Encounter; scene: string } | null {
  const deck = deckSet(state);
  // Seulement des scenes jouables de bout en bout : un mot a trouver a chaque replique, de l'interlocuteur comme du
  // joueur. Aucune (deck trop petit pour ce lieu) : ancien moteur de phrases, ou chaque replique a aussi un trou.
  const eligible = (SCENES[situationId] ?? []).filter((scene) => sceneFull(scene, deck));
  if (eligible.length === 0) return null;
  const unseen = eligible.filter((sc) => !seen.includes(sc.id));
  const scored = shuffleWith(rng, unseen.length ? unseen : eligible).map((scene) => ({
    scene,
    p: scenePenalty(scene.lines.length, sceneLevel(scene), rules, type) - 0.15 * Math.min(4, sceneHits(scene, deck)),
  }));
  scored.sort((a, b) => a.p - b.p);
  const near = scored.filter((x) => x.p <= scored[0].p + 0.5);
  const scene = near[Math.floor(rng() * near.length)].scene;
  const kw = new Set(scene.keywords);
  const lines = scene.lines.map((l, i) => prepareSceneLine(l, deck, kw, rules.blanks[type], rules.commonCut, rng, `${scene.id}-${i}`));
  const enc: Encounter = { nodeId, type, situation: situationId, lines, index: 0, hand: [], pile: shuffleWith(rng, state.unlocked), replaysLeft: REPLAYS_PER_ENCOUNTER, correct: 0, wrong: 0 };
  return { encounter: refillHand(enc, state.unlocked, rng, difficulty), scene: scene.id };
}

function buildEncounter(state: AppState, nodeId: string, type: FightType, situationId: string, rng: () => number, rules: DayRules, difficulty: Difficulty): Encounter {
  const deck = deckSet(state);
  const lines: DialogueLine[] = [];
  const exchanges = rules.lines[type] > 0 ? Math.max(2, Math.round(rules.lines[type] / 2)) : EXCHANGES_PER_TYPE[type];
  for (const ex of pickExchanges(state, situationId, exchanges, rng)) {
    lines.push(prepareLine('enemy', ex.enemy, deck, rules.blanks[type], rng));
    if (ex.player) lines.push(prepareLine('player', ex.player, deck, rules.blanks[type], rng));
  }
  const enc: Encounter = { nodeId, type, situation: situationId, lines, index: 0, hand: [], pile: shuffleWith(rng, state.unlocked), replaysLeft: REPLAYS_PER_ENCOUNTER, correct: 0, wrong: 0 };
  return refillHand(enc, state.unlocked, rng, difficulty);
}

/**
 * Rencontre d'une situation selon des regles (journee de l'aventure, ou mode Situation) : une scene jouable, sinon
 * l'ancien moteur de phrases. `scene` : la scene jouee (null pour l'ancien moteur).
 */
export function situationEncounter(
  state: AppState, nodeId: string, type: FightType, situationId: string, rng: () => number,
  rules: DayRules, seen: string[], difficulty: Difficulty,
): { encounter: Encounter; scene: string | null } {
  return buildSceneEncounter(state, nodeId, type, situationId, rng, rules, seen, difficulty)
    ?? { encounter: buildEncounter(state, nodeId, type, situationId, rng, rules, difficulty), scene: null };
}

/** Deplacement vers un noeud atteignable : repos ou rencontre (regles de la journee en cours). */
export function enterNode(state: AppState, nodeId: string): AppState {
  const run = state.run;
  if (!run || run.phase !== 'map') return state;
  const cur = nodeById(run.map, run.current);
  if (!cur.next.includes(nodeId)) return state;
  const node = nodeById(run.map, nodeId);
  const rng = mulberry32((run.seed + run.day * 7349 + node.layer * 131 + node.col * 17 + run.visited.length * 7) >>> 0);
  const moved: RunState = { ...run, current: nodeId, visited: [...run.visited, nodeId] };
  if (node.type === 'rest') {
    const healed = Math.min(run.maxHp - run.hp, REST_HEAL);
    return { ...state, run: { ...moved, hp: run.hp + healed, restHealed: healed, phase: 'rest' } };
  }
  const type: FightType = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : 'fight';
  const sit = node.situation ?? 'small-talk';
  const { encounter, scene } = situationEncounter(state, nodeId, type, sit, rng, dayRules(run.day), run.seen, run.difficulty);
  const seen = scene ? [...run.seen, scene].slice(-400) : run.seen;
  return { ...state, run: { ...moved, encounter, seen, phase: 'battle' } };
}

export const currentLine = (enc: Encounter): DialogueLine | undefined => enc.lines[enc.index];
export const lineComplete = (line: DialogueLine): boolean => line.filled.every((f) => f !== null);
export const firstEmptySlot = (line: DialogueLine): number => line.filled.findIndex((f) => f === null);

/** Pose une carte de la main dans un trou de la replique courante. */
export function dropCard(state: AppState, slot: number, rank: number, now: number): AppState {
  const run = state.run;
  const enc = run?.encounter;
  const line = enc ? currentLine(enc) : undefined;
  if (!run || !enc || !line || slot < 0 || slot >= line.blanks.length || line.filled[slot] !== null || !enc.hand.includes(rank)) return state;
  const answer = line.segments[line.blanks[slot]].rank!;
  const ok = rank === answer;
  const filled = [...line.filled];
  const results = [...line.results];
  filled[slot] = answer;            // la bonne carte est toujours posee ; une erreur la revele
  results[slot] = ok ? 'ok' : 'bad';
  const hand = ok ? enc.hand.filter((r) => r !== rank) : enc.hand;
  const pile = ok ? [...enc.pile, rank] : enc.pile;
  const lines = enc.lines.map((l, i) => (i === enc.index ? { ...l, filled, results } : l));
  const p = state.progress[answer] ?? newProgress(now, SKILLS);
  const read = p.skills.read ?? newProgress(now, SKILLS).skills.read;
  const progress = { ...state.progress, [answer]: { ...p, skills: { ...p.skills, read: review(read, ok ? 2 : 0, now) } } };
  return {
    ...state,
    progress,
    run: {
      ...run,
      hp: ok ? run.hp : run.hp - 1,
      correct: run.correct + (ok ? 1 : 0), wrong: run.wrong + (ok ? 0 : 1),
      encounter: { ...enc, lines, hand, pile, correct: enc.correct + (ok ? 1 : 0), wrong: enc.wrong + (ok ? 0 : 1) },
    },
  };
}

/**
 * Native : le mot d'un trou a ete ecrit (juste ou non) ; la bonne carte est revelee et l'ecriture creditee. `mistakes` :
 * erreurs de traits (serie de maitrise : sans aucune erreur, elle continue ; reponse abandonnee ou ratee, elle repart a 0).
 */
export function resolveSlot(state: AppState, slot: number, ok: boolean, now: number, mistakes = 0): AppState {
  const run = state.run;
  const enc = run?.encounter;
  const line = enc ? currentLine(enc) : undefined;
  if (!run || !enc || !line || slot < 0 || slot >= line.blanks.length || line.filled[slot] !== null) return state;
  const answer = line.segments[line.blanks[slot]].rank!;
  const filled = [...line.filled];
  const results = [...line.results];
  filled[slot] = answer;
  results[slot] = ok ? 'ok' : 'bad';
  const lines = enc.lines.map((l, i) => (i === enc.index ? { ...l, filled, results } : l));
  const drawn = recordDrawing(state, answer, ok ? mistakes : Math.max(1, mistakes), now);
  const p = drawn.progress[answer];
  const write = p.skills.write ?? newProgress(now, SKILLS).skills.write;
  const progress = { ...drawn.progress, [answer]: { ...p, skills: { ...p.skills, write: review(write, ok ? 2 : 0, now) } } };
  return {
    ...state,
    progress,
    run: {
      ...run,
      hp: ok ? run.hp : run.hp - 1,
      correct: run.correct + (ok ? 1 : 0), wrong: run.wrong + (ok ? 0 : 1),
      encounter: { ...enc, lines, correct: enc.correct + (ok ? 1 : 0), wrong: enc.wrong + (ok ? 0 : 1) },
    },
  };
}

/** Consomme une repetition de la replique (3 par rencontre). */
export function useReplay(state: AppState): AppState {
  const run = state.run;
  const enc = run?.encounter;
  if (!run || !enc) return state;
  const left = enc.replaysLeft ?? REPLAYS_PER_ENCOUNTER;
  if (left <= 0) return state;
  return { ...state, run: { ...run, encounter: { ...enc, replaysLeft: left - 1 } } };
}

/** Joue une carte dans le premier trou vide (clic, bouton, clavier). */
export function playCard(state: AppState, rank: number, now: number): AppState {
  const line = state.run?.encounter ? currentLine(state.run.encounter) : undefined;
  if (!line) return state;
  return dropCard(state, firstEmptySlot(line), rank, now);
}

/** Replique suivante (une fois la courante remplie), ou fin de rencontre. */
export function nextLine(state: AppState): AppState {
  const run = state.run;
  const enc = run?.encounter;
  const line = enc ? currentLine(enc) : undefined;
  if (!run || !enc || !line || !lineComplete(line)) return state;
  if (run.hp <= 0) return { ...state, run: { ...run, encounter: null, phase: 'lost' } };
  const next = enc.index + 1;
  if (next < enc.lines.length) {
    const rng = mulberry32((run.seed + next * 977 + run.visited.length * 31) >>> 0);
    return { ...state, run: { ...run, encounter: refillHand({ ...enc, index: next }, state.unlocked, rng, run.difficulty) } };
  }
  // Evenement de fin de journee reussi : la journee compte pour le score (record mis a jour), puis la nuit.
  if (enc.type === 'boss') return { ...state, bestDays: Math.max(state.bestDays, run.day), run: { ...run, encounter: null, phase: 'dayEnd' } };
  const remaining = REWARD_PER_TYPE[enc.type];
  const choices = nextUnlockables(state, 3).map((w) => w.rank);
  if (remaining === 0 || choices.length === 0) return { ...state, run: { ...run, encounter: null, phase: 'map' } };
  return { ...state, run: { ...run, encounter: null, reward: { remaining, choices, learning: null }, phase: 'reward' } };
}

export function chooseReward(state: AppState, rank: number): AppState {
  const run = state.run;
  if (!run?.reward || !run.reward.choices.includes(rank)) return state;
  return { ...state, run: { ...run, reward: { ...run.reward, learning: rank } } };
}

/** La carte choisie a ete tracee : elle rejoint le deck. */
export function completeReward(state: AppState, now: number): AppState {
  const run = state.run;
  const rank = run?.reward?.learning;
  if (!run || !run.reward || rank == null) return state;
  const s = unlockWord(state, rank, now);
  const remaining = run.reward.remaining - 1;
  const choices = remaining > 0 ? nextUnlockables(s, 3).map((w) => w.rank) : [];
  const base = { ...s.run!, cardsUnlocked: run.cardsUnlocked + 1 };
  if (remaining <= 0 || choices.length === 0) return { ...s, run: { ...base, reward: null, phase: 'map' } };
  return { ...s, run: { ...base, reward: { remaining, choices, learning: null } } };
}

export function leaveRest(state: AppState): AppState {
  const run = state.run;
  if (!run || run.phase !== 'rest') return state;
  return { ...state, run: { ...run, phase: 'map' } };
}

export function endRun(state: AppState): AppState {
  return { ...state, run: null };
}
