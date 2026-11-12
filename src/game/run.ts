import { introduceWord } from '../core/apply';
import { orderMixed } from '../core/session';
import { newProgress, review } from '../core/srs';
import { SKILLS, type AppState, type Difficulty, type Word } from '../core/types';
import { DIALOGUES, type Exchange, type Speech } from '../data/dialogues';
import { SCENES } from '../data/scenes';
import { WORDS } from '../data/words';
import { buildDictionary, buildLinePool, segment } from './lines';
import { generateMap, nodeById } from './map';
import { mulberry32, shuffleWith } from './rng';
import { SITUATIONS, SITUATION_BY_ID } from './situations';
import {
  BLANKS_PER_TYPE, EXCHANGES_PER_TYPE, HAND_SIZE, MIN_DECK_FOR_RUN, REPLAYS_PER_ENCOUNTER, REWARD_PER_TYPE, RUN_MAX_HP,
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

export function startRun(state: AppState, difficulty: Difficulty, now: number): AppState {
  if (!canStartRun(state)) return state;
  let situations = availableSituations(state);
  if (situations.length === 0) situations = ['small-talk'];
  const seed = (now ^ (state.runsPlayed * 7919)) >>> 0;
  const run: RunState = {
    seed, difficulty, hp: RUN_MAX_HP, maxHp: RUN_MAX_HP,
    map: generateMap(seed, situations),
    current: 'L0-0', visited: ['L0-0'],
    encounter: null, reward: null, restHealed: 0, phase: 'map',
    startedAt: now, cardsUnlocked: 0, correct: 0, wrong: 0,
  };
  return { ...state, run, runsPlayed: state.runsPlayed + 1, settings: { ...state.settings, difficulty } };
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
 * de la scene en premier (le vocabulaire qu'elle fait travailler), puis les autres ; au moins un trou des que la
 * replique contient un mot du deck (les scenes retenues en ont un a chaque replique).
 */
function prepareSceneLine(line: SceneLine, deck: Set<number>, keywords: Set<number>, maxBlanks: number, rng: () => number, voice?: string): DialogueLine {
  const speech: Speech = { zh: line.zh, pinyin: line.pinyin, en: line.en, fr: line.fr };
  const segments = segmentsOf(line.zh);
  const inDeck = segments
    .map((s, i) => ({ rank: s.rank, i }))
    .filter((x): x is { rank: number; i: number } => x.rank !== null && deck.has(x.rank));
  const candidates = [
    ...shuffleWith(rng, inDeck.filter((x) => keywords.has(x.rank))),
    ...shuffleWith(rng, inDeck.filter((x) => !keywords.has(x.rank))),
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

/** Rencontre a partir de scenes coherentes : on enchaine une ou plusieurs scenes jouables avec le deck. */
function buildSceneEncounter(state: AppState, nodeId: string, type: FightType, situationId: string, rng: () => number): Encounter | null {
  const deck = deckSet(state);
  // Seulement des scenes jouables de bout en bout : un mot a trouver a chaque replique, de l'interlocuteur comme du
  // joueur. Aucune (deck trop petit pour ce lieu, boss) : ancien moteur de phrases, ou chaque replique a aussi un trou.
  const eligible = (SCENES[situationId] ?? [])
    .filter((scene) => sceneFull(scene, deck))
    .map((scene) => ({ scene, hits: sceneHits(scene, deck) }));
  if (eligible.length === 0) return null;
  // On privilegie les scenes dont les mots-cles sont le plus dans le deck, puis on melange.
  const ordered = shuffleWith(rng, eligible).sort((a, b) => b.hits - a.hits);
  const targetLines = EXCHANGES_PER_TYPE[type] * 2;
  const picked: Scene[] = [];
  let count = 0;
  for (const { scene } of ordered) {
    picked.push(scene);
    count += scene.lines.length;
    if (count >= targetLines) break;
  }
  const lines: DialogueLine[] = [];
  for (const scene of picked) {
    const kw = new Set(scene.keywords);
    scene.lines.forEach((l, i) => lines.push(prepareSceneLine(l, deck, kw, BLANKS_PER_TYPE[type], rng, `${scene.id}-${i}`)));
  }
  const enc: Encounter = { nodeId, type, situation: situationId, lines, index: 0, hand: [], pile: shuffleWith(rng, state.unlocked), replaysLeft: REPLAYS_PER_ENCOUNTER, correct: 0, wrong: 0 };
  return refillHand(enc, state.unlocked, rng, state.run?.difficulty ?? state.settings.difficulty);
}

function buildEncounter(state: AppState, nodeId: string, type: FightType, situationId: string, rng: () => number): Encounter {
  const deck = deckSet(state);
  const lines: DialogueLine[] = [];
  for (const ex of pickExchanges(state, situationId, EXCHANGES_PER_TYPE[type], rng)) {
    lines.push(prepareLine('enemy', ex.enemy, deck, BLANKS_PER_TYPE[type], rng));
    if (ex.player) lines.push(prepareLine('player', ex.player, deck, BLANKS_PER_TYPE[type], rng));
  }
  const enc: Encounter = { nodeId, type, situation: situationId, lines, index: 0, hand: [], pile: shuffleWith(rng, state.unlocked), replaysLeft: REPLAYS_PER_ENCOUNTER, correct: 0, wrong: 0 };
  return refillHand(enc, state.unlocked, rng, state.run?.difficulty ?? state.settings.difficulty);
}

/** Deplacement vers un noeud atteignable : repos ou rencontre. */
export function enterNode(state: AppState, nodeId: string): AppState {
  const run = state.run;
  if (!run || run.phase !== 'map') return state;
  const cur = nodeById(run.map, run.current);
  if (!cur.next.includes(nodeId)) return state;
  const node = nodeById(run.map, nodeId);
  const rng = mulberry32((run.seed + node.layer * 131 + node.col * 17 + run.visited.length * 7) >>> 0);
  const moved: RunState = { ...run, current: nodeId, visited: [...run.visited, nodeId] };
  if (node.type === 'rest') {
    const healed = Math.min(run.maxHp - run.hp, 2);
    return { ...state, run: { ...moved, hp: run.hp + healed, restHealed: healed, phase: 'rest' } };
  }
  const type: FightType = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : 'fight';
  const sit = node.situation ?? 'small-talk';
  const encounter = buildSceneEncounter(state, nodeId, type, sit, rng) ?? buildEncounter(state, nodeId, type, sit, rng);
  return { ...state, run: { ...moved, encounter, phase: 'battle' } };
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

/** Native : le mot d'un trou a ete ecrit (juste ou non) ; la bonne carte est revelee et l'ecriture creditee. */
export function resolveSlot(state: AppState, slot: number, ok: boolean, now: number): AppState {
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
  const p = state.progress[answer] ?? newProgress(now, SKILLS);
  const write = p.skills.write ?? newProgress(now, SKILLS).skills.write;
  const progress = { ...state.progress, [answer]: { ...p, skills: { ...p.skills, write: review(write, ok ? 2 : 0, now) } } };
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
  if (enc.type === 'boss') return { ...state, runsWon: state.runsWon + 1, run: { ...run, encounter: null, phase: 'won' } };
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
