import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { Difficulty, Word } from '../core/types';
import { WORD_BY_RANK, themeOf } from '../data/words';
import { glosses, useLang } from '../i18n';
import { readingLine, usePhonetic, ZhuyinRun } from './Phonetic';
import { useUnit } from './useUnit';

export type CardState = 'correct' | 'wrong' | 'dim' | undefined;

interface CardProps {
  word: Word;
  difficulty: Difficulty;
  focused?: boolean;
  mastered?: boolean;
  state?: CardState;
  /** Affiche toutes les informations quelle que soit la difficulte (choix de recompense). */
  full?: boolean;
  onClick?: () => void;
}

/**
 * Carte Mot (facon carte a jouer) : fond a la couleur du theme, cadre interieur, coins decores ; une carte
 * maitrisee devient « doree ». Pinyin et sens selon la difficulte, sur la carte mise en avant ; l'annotation
 * phonetique (option) accompagne chaque caractere des que la difficulte montre la prononciation.
 */
export function GameCard({ word, difficulty, focused = false, mastered = false, state, full = false, onClick }: CardProps) {
  const lang = useLang();
  const system = usePhonetic();
  const showPinyin = full || (difficulty !== 'resident' && difficulty !== 'native');
  const showGloss = full || difficulty === 'newcomer';
  const anno = showPinyin ? system : null;
  // Zhuyin : vertical a droite de chaque caractere (manuels de Taiwan) ; romanisations : une ligne sous le mot.
  const zy = anno === 'zhuyin';
  const len = Math.min([...word.hanzi].length, 4);
  const style = { '--hue': themeOf(word).hue } as CSSProperties;
  return (
    <button
      type="button"
      className={`gcard len${len} ${focused ? 'focused' : ''} ${mastered ? 'gold' : ''} ${anno ? 'anno' : ''} ${zy ? 'anno-zy' : ''} ${state ?? ''}`}
      style={style}
      data-hue=""
      onClick={onClick}
      tabIndex={-1}
    >
      <span className="gcard-frame" aria-hidden="true" />
      <span className="gcard-pip tl" aria-hidden="true" />
      <span className="gcard-pip br" aria-hidden="true" />
      <span className="gcard-hanzi" lang="zh-Hant-TW">{zy ? <ZhuyinRun text={word.hanzi} pinyin={word.pinyin} /> : word.hanzi}</span>
      {/* Annotation phonetique (option) : sur toutes les cartes ; sinon pinyin sur la carte mise en avant. */}
      {anno
        ? !zy && <span className="gcard-pinyin">{readingLine(anno, word.pinyin)}</span>
        : (focused || full) && showPinyin && <span className="gcard-pinyin">{word.pinyin}</span>}
      {(focused || full) && showGloss && <span className="gcard-gloss">{glosses(word, lang)[0]}</span>}
      <span className="gcard-shine" aria-hidden="true" />
    </button>
  );
}

// --- Main : eventail de cartes de meme taille ---
const DRAG_THRESHOLD = 8;
const DROP_PADDING = 48;
/** Inclinaison maximale (degres) d'une carte survolee ou balancee pendant le glisser. */
const TILT = 14;
const SWING = 18;

/** Zone de depot (un trou de la replique). */
export interface DropTarget { slot: number; el: HTMLElement }

interface DragState {
  index: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  lifted: boolean;
  over: DropTarget | null;
}

interface HandProps {
  ranks: number[];
  difficulty: Difficulty;
  /** Interactions desactivees (replique terminee, animation en cours). */
  locked: boolean;
  isMastered: (rank: number) => boolean;
  /** Carte deposee dans un trou precis. */
  onDrop: (rank: number, slot: number) => void;
  /** Trous vides disponibles. */
  getDropTargets: () => DropTarget[];
}

/** Inclinaison 3D d'une carte selon la position du pointeur (souris seulement), et reflet qui suit le pointeur. */
function tilt(e: ReactPointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget.querySelector<HTMLElement>('.gcard');
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  el.style.setProperty('--ry', `${((x - 0.5) * 2 * TILT).toFixed(1)}deg`);
  el.style.setProperty('--rx', `${((0.5 - y) * 2 * TILT).toFixed(1)}deg`);
  el.style.setProperty('--mx', `${(x * 100).toFixed(0)}%`);
  el.style.setProperty('--my', `${(y * 100).toFixed(0)}%`);
}
function untilt(e: ReactPointerEvent<HTMLElement>) {
  const el = e.currentTarget.querySelector<HTMLElement>('.gcard');
  if (!el) return;
  for (const p of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(p);
}

/**
 * Main : cartes en eventail en bas de l'ecran, qui flottent doucement. Survol : la carte se souleve et s'incline ;
 * clic : elle se met en avant et montre ses informations ; pour la jouer, on la glisse jusqu'a un trou de la replique
 * (pas de jeu au clic) ; pendant le glisser, elle se balance selon la vitesse.
 */
export function Hand({ ranks, difficulty, locked, isMastered, onDrop, getDropTargets }: HandProps) {
  const u = useUnit();
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  // Miroir synchrone de l'etat de glissement : les evenements pointeur peuvent s'enchainer avant un nouveau rendu.
  const dragRef = useRef<DragState | null>(null);
  const setDrag = (d: DragState | null) => { dragRef.current = d; setDragState(d); };
  const ghost = useRef<HTMLDivElement>(null);
  const last = useRef({ x: 0, t: 0 });
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const key = ranks.join(',');
  useEffect(() => { setSelected(null); }, [key]);
  useEffect(() => () => clearTimeout(settle.current), []);

  const highlight = (target: DropTarget | null) => {
    for (const t of getDropTargets()) t.el.classList.toggle('over', target !== null && t.el === target.el);
  };
  const findTarget = (x: number, y: number): DropTarget | null => {
    for (const t of getDropTargets()) {
      const r = t.el.getBoundingClientRect();
      const pad = DROP_PADDING * u;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return t;
    }
    return null;
  };
  /** Balancement de la carte tenue : proportionnel a la vitesse horizontale, revient au repos quand le pointeur s'arrete. */
  const swing = (x: number) => {
    const now = performance.now();
    const dt = Math.max(8, now - last.current.t);
    const v = (x - last.current.x) / dt;
    last.current = { x, t: now };
    const deg = Math.max(-SWING, Math.min(SWING, v * 22));
    ghost.current?.style.setProperty('--swing', `${deg.toFixed(1)}deg`);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => ghost.current?.style.setProperty('--swing', '0deg'), 90);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (locked || e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur synthetique */ }
    last.current = { x: e.clientX, t: performance.now() };
    setDrag({ index, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, lifted: false, over: null });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) { if (!locked) tilt(e); return; }
    const lifted = d.lifted || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD;
    const over = lifted ? findTarget(e.clientX, e.clientY) : null;
    if (lifted) swing(e.clientX);
    highlight(over);
    setDrag({ ...d, lifted, x: e.clientX, y: e.clientY, over });
  };
  const endDrag = () => { highlight(null); setDrag(null); };
  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d) return;
    endDrag();
    if (!d.lifted) setSelected((s) => (s === d.index ? null : d.index));
    else if (d.over) onDrop(ranks[d.index], d.over.slot);
  };

  const lifted = drag?.lifted ? WORD_BY_RANK.get(ranks[drag.index]) : undefined;
  const n = ranks.length;

  return (
    <div className={`hand ${locked ? 'locked' : ''}`}>
      {ranks.map((rank, i) => {
        const word = WORD_BY_RANK.get(rank);
        if (!word) return null;
        const isLifted = drag?.lifted === true && drag.index === i;
        // Eventail : rotation et arc selon l'ecart au centre de la main.
        const d = i - (n - 1) / 2;
        const fan = { '--i': i, '--rot': `${(d * 3.2).toFixed(2)}deg`, '--arc': (d * d * 2.6).toFixed(2) } as CSSProperties;
        return (
          <div
            key={rank}
            className={`hand-item ${selected === i ? 'selected' : ''} ${isLifted ? 'lifted' : ''}`}
            style={fan}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerLeave={untilt}
            onPointerUp={onPointerUp}
            onPointerCancel={endDrag}
          >
            <div className="hand-float">
              <GameCard word={word} difficulty={difficulty} focused={selected === i} mastered={isMastered(rank)} state={locked ? 'dim' : undefined} />
            </div>
          </div>
        );
      })}
      {lifted && drag && (
        <div ref={ghost} className={`drag-ghost ${drag.over ? 'over' : ''}`} style={{ left: drag.x, top: drag.y }}>
          <GameCard word={lifted} difficulty={difficulty} focused mastered={isMastered(lifted.rank)} />
        </div>
      )}
    </div>
  );
}
