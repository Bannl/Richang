import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { AppState } from '../core/types';
import { TUTORIAL_SCENE } from '../data/tutorial';
import { WORD_BY_RANK } from '../data/words';
import { TUTORIAL_RANK, applyTutorial, endTutorial, tutorialLearned, tutorialView } from '../game/tutorial';
import { REPLAYS_PER_ENCOUNTER } from '../game/types';
import { useT } from '../i18n';
import { IntroMode } from '../modes/Intro';
import { preloadVoices } from '../platform/voices';
import { GameCard } from '../ui/cards';
import { preloadPortrait } from '../ui/Portrait';
import { BattleScreen, type CoachStep } from './Battle';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  /** Tutoriel termine ou passe : retour au camp. */
  onDone: () => void;
  toast: (msg: string) => void;
}

/** Texte dont les caracteres chinois sont balises (police et lecture chinoises). */
function withHanzi(text: string): ReactNode {
  return text.split(/(\p{Script=Han}+)/u).map((p, i) => (/\p{Script=Han}/u.test(p) ? <span key={i} lang="zh-Hant-TW" className="hz">{p}</span> : p));
}

/**
 * Tutoriel, en trois temps : tracer 我 (ecran d'apprentissage habituel, la carte rejoint le deck) ; la rencontre avec
 * le proprietaire (ecran de combat habituel sur une rencontre fictive, avec une consigne et une demonstration du
 * glisser-deposer) ; l'ecran s'assombrit sur la voix interieure du joueur.
 */
export function TutorialScreen({ state, update, onDone, toast }: Props) {
  const t = useT();
  const tut = state.tutorial!;
  const word = WORD_BY_RANK.get(TUTORIAL_RANK)!;
  // Scene jouee pendant cette visite : l'outro s'assombrit sur sa derniere image. Reprise (app rouverte pendant
  // l'outro) : l'ecran est sombre d'emblee. La scene est retiree une fois l'ecran noir.
  const [live] = useState(tut.step !== 'outro');
  const [dark, setDark] = useState(false);
  // Voix (proprietaire, joueur) et portraits ouverts des le trace : la scene demarre sans attente.
  useEffect(() => {
    preloadVoices(TUTORIAL_SCENE.situation, state.settings.playerVoice);
    preloadPortrait(TUTORIAL_SCENE.situation);
  }, [state.settings.playerVoice]);
  const finish = () => { update(endTutorial); onDone(); };
  const skip = <button type="button" className="tutorial-skip" onClick={finish}>{t('tutorialSkip')}</button>;

  if (tut.step === 'learn') {
    const fresh = !state.unlocked.includes(TUTORIAL_RANK);
    return (
      <div className="app wide learn tutorial-learn">
        <IntroMode
          key="tutorial"
          word={word}
          head={<><span className="title">{t('tutorialTitle')}</span>{skip}</>}
          settings={state.settings}
          continueLabel={t('addToDeck')}
          onNext={() => {
            update((s) => tutorialLearned(s, Date.now()));
            if (fresh) toast(`${t('cardUnlocked')} · ${word.hanzi}`);
          }}
        />
      </div>
    );
  }

  const scene = tut.step === 'scene';
  const battle = tut.encounter && (scene || (live && !dark)) ? (
    <BattleScreen
      state={tutorialView(state)}
      update={(fn) => update((s) => applyTutorial(s, fn))}
      coach={scene ? (step) => <TutorialCoach step={step} /> : undefined}
      corner={scene ? skip : undefined}
    />
  ) : null;
  if (scene) return <>{battle}<div className="tutorial-fadein" aria-hidden="true" /></>;
  return <>{battle}<TutorialOutro fade={live} onDark={() => setDark(true)} onDone={finish} /></>;
}

interface CoachRects {
  card: DOMRect;
  slot: DOMRect | null;
  /** Encadre du joueur (ses vies) et bouton qui repete la replique : les petites bulles s'y accrochent. */
  hud: DOMRect | null;
  replay: DOMRect | null;
  /** Place libre dans la rangee de la main, entre l'encadre du joueur (a gauche) et la pioche (a droite). */
  lo: number;
  hi: number;
}

/** Positions de la carte de la main, du trou de la replique en cours et des elements expliques (bulles, demonstration). */
function useCoachRects(active: boolean): CoachRects | null {
  const [rects, setRects] = useState<CoachRects | null>(null);
  useEffect(() => {
    if (!active) { setRects(null); return; }
    let raf = 0;
    let last = '';
    const rectOf = (sel: string) => document.querySelector<HTMLElement>(sel)?.getBoundingClientRect() ?? null;
    const tick = () => {
      // La carte flotte dans son emplacement (.hand-item, immobile) : on mesure l'emplacement.
      const card = rectOf('.battle .hand-item');
      const slot = rectOf('.battle .dline.current [data-slot]');
      const hud = rectOf('.battle .player-hud');
      const replay = rectOf('.battle .replay-btn');
      const pile = rectOf('.battle .draw-pile');
      const lo = hud && card && hud.right < card.left ? hud.right : 0;
      const hi = pile && card && pile.left > card.right ? pile.left : window.innerWidth;
      const key = [card, slot, hud, replay].map((r) => (r ? [r.left, r.top, r.width, r.height].map((v) => Math.round(v / 2)).join(',') : '-')).join('|') + `|${Math.round(lo)}|${Math.round(hi)}`;
      if (key !== last) { last = key; setRects(card ? { card, slot, hud, replay, lo, hi } : null); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return rects;
}

type NotePlace = 'above-right' | 'above-left' | 'right';

/**
 * Petite bulle d'explication accrochee a un element du combat, avec un anneau qui pulse autour de lui. Au-dessus,
 * alignee sur son bord droit (bouton de repetition, en haut a droite de la replique) ou gauche ; ou a sa droite (vies,
 * en bas a gauche, dans la rangee de la main).
 */
function CoachNote({ anchor, place, room, children }: { anchor: DOMRect; place: NotePlace; room: number; children: ReactNode }) {
  const gap = 12;
  const ax = `${(anchor.width / 2).toFixed(1)}px`;
  const style = (
    place === 'above-right' ? { right: window.innerWidth - anchor.right, top: anchor.top - gap, '--ax': ax }
      : place === 'above-left' ? { left: anchor.left, top: anchor.top - gap, '--ax': ax }
        : { left: anchor.right + gap, top: anchor.top + anchor.height / 2 }
  ) as CSSProperties;
  style.maxWidth = Math.max(120, Math.min(place === 'right' ? 260 : 280, room));
  return (
    <>
      <span className="coach-ring" style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }} aria-hidden="true" />
      <div className={`coach-note ${place}`} style={style} role="note">{children}</div>
    </>
  );
}

/**
 * Consigne du tutoriel, par-dessus le combat : une bulle a cote de la carte 我 (ecoute, puis « glisse ta carte dans le
 * trou ») et, tant que le trou est vide, une carte fantome qui montre le geste, de la main jusqu'au trou. Elle
 * s'efface pendant que le joueur tient la carte. Une petite bulle explique en plus le bouton de repetition (premiere
 * replique), puis les vies (seconde).
 */
function TutorialCoach({ step }: { step: CoachStep }) {
  const t = useT();
  const word = WORD_BY_RANK.get(TUTORIAL_RANK)!;
  const text = step.stage === 'listen' ? (step.index === 0 ? t('tutorialListen') : null)
    : step.stage === 'play' ? t(step.index === 0 ? 'tutorialDropEnemy' : 'tutorialDropPlayer') : null;
  const rects = useCoachRects(text !== null);
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    const down = (e: PointerEvent) => { if ((e.target as Element | null)?.closest?.('.hand')) setHolding(true); };
    const up = () => setHolding(false);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, []);
  if (!text || !rects) return null;
  const { card, slot, hud, replay, lo, hi } = rects;
  // Une notion de plus par replique, expliquee tant que le trou est vide : le bouton qui repete la replique (limite) sur
  // la premiere, les vies sur la seconde (le geste est alors connu).
  let note: ReactNode = null;
  if (step.stage === 'play' && step.index === 0 && replay) {
    note = <CoachNote anchor={replay} place="above-right" room={replay.right - 16}>{t('tutorialReplayTip', { n: REPLAYS_PER_ENCOUNTER })}</CoachNote>;
  } else if (step.stage === 'play' && step.index === 1 && hud) {
    const room = card.left - hud.right - 36;
    note = room >= 140
      ? <CoachNote anchor={hud} place="right" room={room}>{t('tutorialHpTip')}</CoachNote>
      : <CoachNote anchor={hud} place="above-left" room={window.innerWidth - hud.left - 16}>{t('tutorialHpTip')}</CoachNote>;
  }
  // Bulle a droite de la carte (la main n'a qu'une carte : la place ne manque pas), sans deborder sur la pioche ; a
  // gauche si la place manque a droite.
  const vw = window.innerWidth;
  const gap = 14;
  const roomRight = hi - card.right - gap - 8;
  const roomLeft = card.left - lo - gap - 8;
  const right = roomRight >= Math.min(220, roomLeft);
  const tipStyle: CSSProperties = right
    ? { left: card.right + gap, top: card.top + card.height / 2, maxWidth: Math.min(340, roomRight) }
    : { right: vw - card.left + gap, top: card.top + card.height / 2, maxWidth: Math.min(340, roomLeft) };
  const cx = card.left + card.width / 2;
  const cy = card.top + card.height / 2;
  const demo = step.stage === 'play' && slot && !holding;
  const ghostStyle = slot ? ({
    left: cx, top: cy,
    '--dx': `${(slot.left + slot.width / 2 - cx).toFixed(1)}px`,
    '--dy': `${(slot.top + slot.height / 2 - cy).toFixed(1)}px`,
    '--s': (slot.height / card.height).toFixed(3),
  } as CSSProperties) : undefined;
  return (
    <>
      <div key={`${step.index}-${step.stage}`} className={`coach-tip ${right ? 'right' : 'left'}`} style={tipStyle} role="status">{withHanzi(text)}</div>
      {note}
      {demo && (
        <div className="drag-ghost coach-ghost" style={ghostStyle} aria-hidden="true">
          <GameCard word={word} difficulty="newcomer" />
          <span className="coach-finger" />
        </div>
      )}
    </>
  );
}

/**
 * Fin du tutoriel : l'ecran s'assombrit (sur la derniere image de la scene), puis la voix interieure du joueur
 * apparait, phrase apres phrase, dans la langue de l'app. Un clic fait tout apparaitre ; « Continuer » mene au camp.
 */
function TutorialOutro({ fade, onDark, onDone }: { fade: boolean; onDark: () => void; onDone: () => void }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const [ready, setReady] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const shown = ready || all;
  useEffect(() => { if (shown) btn.current?.focus(); }, [shown]);
  // Sans fondu (reprise), l'ecran est deja noir.
  useEffect(() => { if (!fade) onDark(); }, [fade, onDark]);
  return (
    <div
      className={`tutorial-outro ${fade ? 'fade' : ''} ${all ? 'all' : ''}`}
      onClick={() => setAll(true)}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) onDark(); }}
    >
      <div className="outro-text">
        <p className="thought">{withHanzi(t('tutorialThought1'))}</p>
        <p className="thought">{withHanzi(t('tutorialThought2'))}</p>
      </div>
      <button
        ref={btn}
        type="button"
        className="btn primary outro-next"
        onAnimationEnd={() => setReady(true)}
        onClick={(e) => { e.stopPropagation(); if (shown) onDone(); else setAll(true); }}
      >
        {t('continue')}
      </button>
    </div>
  );
}
