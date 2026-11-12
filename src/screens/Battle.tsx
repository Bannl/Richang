import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { enabledSkills } from '../core/session';
import { wordStatus } from '../core/srs';
import type { AppState } from '../core/types';
import { WORDS, WORD_BY_RANK } from '../data/words';
import { BOARDS } from '../game/boards';
import { currentLine, dropCard, firstEmptySlot, lineComplete, nextLine, resolveSlot, useReplay } from '../game/run';
import { SITUATION_BY_ID } from '../game/situations';
import { REPLAYS_PER_ENCOUNTER, type DialogueLine } from '../game/types';
import { useLang, useT } from '../i18n';
import { type SpeakSyncHandle, type VoiceRole } from '../platform/tts';
import { dubKey, playLine, preloadVoices, speakLine } from '../platform/voices';
import { backgroundFor } from '../ui/backgrounds';
import { Icon } from '../ui/basics';
import { Hand, type DropTarget } from '../ui/cards';
import { FlyingWords, type FlyingItem } from '../ui/FlyingWords';
import { Hanzi, PhoneticContext, usePhonetic } from '../ui/Phonetic';
import { Portrait, TRAIT_REACTIONS, characterTrait, characterVoice, preloadPortrait, traitLabel, type Emotion } from '../ui/Portrait';
import { SentenceCards, WordCard, lineParts, spokenText } from '../ui/SentenceCards';
import { useElementSize } from '../ui/useElementSize';
import { WritingSlot } from '../ui/WritingSlot';
import { HpBar } from './MapScreen';

/** Moment de la replique en cours, pour un guide par-dessus le combat (tutoriel) : ecoute, trou a remplir, remplie. */
export interface CoachStep { index: number; stage: 'listen' | 'play' | 'done' }

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  /** Guide affiche par-dessus le combat selon la replique en cours (tutoriel). */
  coach?: (step: CoachStep) => ReactNode;
  /** Contenu pose dans le coin bas gauche de la scene (tutoriel : bouton pour le passer). */
  corner?: ReactNode;
}

type Phase = 'placing' | 'ready' | 'replay' | 'flying' | 'flown';
/** Duree (ms) d'une reaction du personnage (bonne ou mauvaise carte). */
const REACTION_MS = 1700;

/** Texte complet d'une replique (trous remplis). */
function lineText(line: DialogueLine): string {
  return line.segments.map((seg, i) => {
    const b = line.blanks.indexOf(i);
    if (b >= 0 && line.filled[b] !== null) return WORD_BY_RANK.get(line.filled[b]!)?.hanzi ?? seg.text;
    return seg.text;
  }).join('');
}

/** Replique de la conversation, annotee segment par segment si l'option phonetique est active. */
function LineText({ line }: { line: DialogueLine }) {
  return <>{lineParts(line).map((p, i) => <Hanzi key={i} text={p.text} pinyin={p.pinyin} />)}</>;
}

/** Humeur du personnage selon la replique qu'il prononce (question, exclamation). */
function lineMood(line: DialogueLine, exclaim: Emotion): Emotion {
  const end = line.speech.zh.trim().slice(-1);
  if (end === '？' || end === '?') return 'curious';
  if (end === '！' || end === '!') return exclaim;
  return 'neutral';
}

/**
 * Encombrement d'une replique dans sa rangee de cartes, pour qu'elle tienne sur une ligne : n = largeur en cartes (une par
 * mot ; ponctuation, chiffres et lettres sont du texte de 0,42 carte de corps, pleine chasse pour la ponctuation
 * chinoise), g = nombre d'espaces entre elements (la ponctuation a des marges de -2u de chaque cote : 0,4 espace de moins).
 */
function rowSize(line: DialogueLine): { n: number; g: number } {
  let n = 0;
  let punct = 0;
  for (const seg of line.segments) {
    if (/\p{Script=Han}/u.test(seg.text)) { n += 1; continue; }
    punct++;
    for (const c of seg.text) n += 0.42 * (/[　-〿＀-￯]/u.test(c) ? 1 : 0.62);
  }
  return { n: Math.max(1, n), g: Math.max(0, line.segments.length - 1 - 0.4 * punct) };
}
/** Largeur naturelle des cartes d'une rangee, en CSS (2 px de marge contre les arrondis). */
const cardWidth = ({ n, g }: { n: number; g: number }) => `calc((100cqw - 2px - ${+g.toFixed(2)} * var(--row-gap)) / ${+n.toFixed(3)})`;
/** Plafond des cartes : leur taille dans une replique de six mots et un point. */
const CARD_CAP = cardWidth({ n: 6.42, g: 5.6 });

/**
 * Combat = dialogue, en trois zones : la scene en haut a gauche (photo du lieu, l'interlocuteur devant, son nom, son
 * trait et la jauge de conversation), la conversation en haut a droite (repliques passees, puis la replique a trous en
 * cours, encadree de la couleur de qui parle, qui arrive carte par carte au rythme de la voix), et en bas ta main en
 * eventail entre tes vies et ta pioche (en Native : la case d'ecriture). On remplit les trous en glissant des cartes ;
 * une fois relue, la replique s'envole dans l'historique.
 */
export function BattleScreen({ state, update, coach, corner }: Props) {
  const t = useT();
  const lang = useLang();
  const run = state.run!;
  const enc = run.encounter!;
  const line = currentLine(enc)!;
  const complete = lineComplete(line);
  const [visible, setVisible] = useState(0);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [voice, setVoice] = useState(false);
  const [phase, setPhase] = useState<Phase>('placing');
  const [flight, setFlight] = useState<{ items: FlyingItem[]; to: DOMRect } | null>(null);
  const [reaction, setReaction] = useState<Emotion | null>(null);
  const [bubble, setBubble] = useState<{ mark: string; key: number } | null>(null);
  const [shake, setShake] = useState(false);
  const [hurt, setHurt] = useState(false);
  const dialogueRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const pad = useElementSize(padRef);
  const speech = useRef<SpeakSyncHandle | null>(null);
  const enabled = enabledSkills(state.settings);
  const situation = SITUATION_BY_ID.get(enc.situation);
  const person = situation ? (lang === 'en' ? situation.person.en : situation.person.fr) : enc.situation;
  const topic = situation ? (lang === 'en' ? situation.topic.en : situation.topic.fr) : '';
  const native = run.difficulty === 'native';
  const showPinyin = run.difficulty !== 'resident' && !native;
  const system = usePhonetic();
  const replaysLeft = enc.replaysLeft ?? REPLAYS_PER_ENCOUNTER;
  const showTranslation = run.difficulty === 'newcomer';
  const rate = state.settings.ttsRate;
  const tr = (l: DialogueLine) => (lang === 'en' ? l.speech.en : l.speech.fr);
  const bg = backgroundFor(enc.situation);
  // Plateau du lieu (matiere, tapis, sceau) ; sans plateau, la photo du lieu floutee sert de fond.
  const board = BOARDS[enc.situation];
  // Tapis sous la main (pas en Native, ou la case d'ecriture remplace la main).
  const mat = native ? undefined : board;
  // Personnalite de l'interlocuteur : elle choisit ses reactions (ravi, perplexe, furieux...).
  const react = TRAIT_REACTIONS[characterTrait(enc.situation)];
  // Expression hors reaction : rire a la fin de la conversation, sinon selon sa replique (question, exclamation).
  const restEmotion: Emotion = complete && enc.index === enc.lines.length - 1 ? 'laugh' : line.speaker === 'enemy' ? lineMood(line, react.exclaim) : 'neutral';
  // Voix : celle du personnage (homme ou femme) pour ses repliques, celle choisie dans les reglages pour les tiennes.
  const foeVoice = characterVoice(enc.situation);
  const playerVoice = state.settings.playerVoice === 'auto' ? null : state.settings.playerVoice;
  const voiceOf = (l: DialogueLine): VoiceRole | null => (l.speaker === 'enemy' ? foeVoice : playerVoice);

  /** Lit la replique en entier en suivant la voix ; la bouche du personnage bouge si c'est sa replique. */
  const say = (onDone: () => void, reveal = false) => {
    const { text, starts } = spokenText(line);
    const h = speakLine(text, rate, (charIndex) => {
      let k = 0;
      for (let i = 0; i < starts.length; i++) if (starts[i] <= charIndex) k = i;
      if (reveal) setVisible((v) => Math.max(v, k + 1));
      setSpeaking(k);
    }, voiceOf(line), dubKey(line.voice, line.speaker, state.settings.playerVoice));
    speech.current = h;
    setVoice(true);
    h.done.then(() => { if (speech.current === h) { setVoice(false); onDone(); } });
    return h;
  };

  // Fichiers de voix de la rencontre (personnage et joueur) ouverts des le debut : pas d'attente a la premiere replique du joueur.
  useEffect(() => { preloadVoices(enc.situation, state.settings.playerVoice); }, [enc.situation, state.settings.playerVoice]);
  useEffect(() => { preloadPortrait(enc.situation); }, [enc.situation]);

  // Placement des cartes-mots au rythme de la voix : la phrase entiere est prononcee, le mot du trou compris.
  useEffect(() => {
    setVisible(0);
    setSpeaking(null);
    setPhase('placing');
    setFlight(null);
    const total = line.segments.length;
    const h = say(() => { setVisible(total); setSpeaking(null); setPhase((p) => (p === 'placing' ? 'ready' : p)); }, true);
    return () => { h.cancel(); speech.current = null; setVoice(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enc.index]);

  // Replique remplie : relue en entier (cartes surlignees), puis ses mots s'envolent vers la conversation.
  useEffect(() => {
    if (!complete || phase !== 'ready') return;
    setPhase('replay');
    say(() => { setSpeaking(null); setPhase('flying'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, phase]);

  // Reactions : bonne carte, le personnage est ravi ; mauvaise carte, il ne comprend pas (perplexe ou choque, en
  // alternance, avec une bulle « ? » ou « !? »), l'ecran tremble. Le minuteur vit a part : passer a la replique suivante
  // pendant une reaction ne la laisse pas affichee.
  const counts = useRef({ c: enc.correct, w: enc.wrong, i: enc.index });
  const reactTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reactTimer.current), []);
  useEffect(() => {
    const p = counts.current;
    counts.current = { c: enc.correct, w: enc.wrong, i: enc.index };
    if (p.i !== enc.index) return;
    let emo: Emotion | null = null;
    let mark: string | null = null;
    if (enc.correct > p.c) emo = react.correct;
    else if (enc.wrong > p.w) {
      // Jamais l'expression deja affichee : la reaction doit se voir.
      const [first, second] = enc.wrong % 2 === 1 ? [react.wrong, react.wrong2] : [react.wrong2, react.wrong];
      emo = first === restEmotion ? second : first;
      mark = emo === 'confused' ? '?' : '!?';
      setShake(true);
      setHurt(true);
    }
    if (!emo) return;
    setReaction(emo);
    setBubble(mark ? { mark, key: enc.wrong } : null);
    clearTimeout(reactTimer.current);
    reactTimer.current = setTimeout(() => { setReaction(null); setBubble(null); setShake(false); setHurt(false); }, REACTION_MS);
  }, [enc.correct, enc.wrong, enc.index]);

  // Depart du vol : positions des cartes et de la bulle (rendue invisible, en bas de l'historique) mesurees apres le rendu.
  useEffect(() => {
    if (phase !== 'flying' || flight) return;
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    const cards = [...(dialogueRef.current?.querySelectorAll<HTMLElement>('.dline.current .wcard .h') ?? [])];
    const dest = pendingRef.current;
    if (!dest || cards.length === 0) { setPhase('flown'); return; }
    setFlight({ items: cards.map((el) => ({ text: el.dataset.text ?? el.textContent ?? '', from: el.getBoundingClientRect() })), to: dest.getBoundingClientRect() });
  }, [phase, flight]);

  // Arrivee dans la conversation : la replique suivante s'enchaine.
  useEffect(() => {
    if (phase !== 'flown') return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
    const timer = setTimeout(() => update(nextLine), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const locked = complete;
  /** Repete la replique courante en entier, cartes mises en avant au fil de la voix. */
  const replay = () => {
    if (phase === 'placing' || phase === 'flying' || phase === 'flown' || replaysLeft <= 0) return;
    update(useReplay);
    speech.current?.cancel();
    // Si la replique est deja remplie, l'envol suit la relecture manuelle (elle a remplace la relecture automatique).
    say(() => { setSpeaking(null); if (complete) setPhase('flying'); });
  };
  const drop = (rank: number, slot: number) => update((s) => dropCard(s, slot, rank, Date.now()));
  const next = () => { speech.current?.cancel(); update(nextLine); };
  // Native : une fois la replique entendue, le premier trou vide se trace dans la grande case d'ecriture.
  const writingSlot = native && phase !== 'placing' && !complete ? firstEmptySlot(line) : -1;
  const writingWord = writingSlot >= 0 ? WORD_BY_RANK.get(line.segments[line.blanks[writingSlot]].rank!) : undefined;
  const giveUp = () => { if (writingSlot >= 0) update((s) => resolveSlot(s, writingSlot, false, Date.now())); };
  const renderWriting = (slot: number) => {
    if (slot !== writingSlot) return null;
    const len = [...line.segments[line.blanks[slot]].text].length;
    return <WordCard text="" rank={null} revealed={false} blank blankLen={len} className="writing" />;
  };
  const getDropTargets = (): DropTarget[] =>
    [...(dialogueRef.current?.querySelectorAll<HTMLElement>('.dline.current [data-slot]') ?? [])].map((el) => ({ slot: Number(el.dataset.slot), el }));

  // Clavier : R pour repeter, Entree pour continuer (les cartes se jouent uniquement par glisser-deposer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') replay();
      else if (e.key === 'Enter' || e.key === ' ') { if (complete) { e.preventDefault(); next(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enc, complete, phase, replaysLeft]);

  const total = enc.lines.length;
  const linesDone = enc.index + (complete ? 1 : 0);
  const remaining = Math.max(0, total - linesDone) / Math.max(1, total);
  const logged = enc.lines.slice(0, enc.index);
  const emptied = phase === 'flying' || phase === 'flown';
  const emotion: Emotion = reaction ?? restEmotion;
  const talking = voice && line.speaker === 'enemy' && reaction === null;
  // Cartes de la replique : leur largeur s'adapte au nombre de mots pour tenir sur une ligne. La rangee reserve, pour toute
  // la rencontre, la hauteur des plus grandes cartes (celles de la replique la plus courte, plafonnees) : le cadre garde
  // la meme taille d'une replique a l'autre.
  const row = rowSize(line);
  const cardCap = `min(var(--cw-max), ${CARD_CAP}, max(${enc.lines.map((l) => cardWidth(rowSize(l))).join(', ')}))`;
  // Marge pour l'ombre portee de la case (elle ne doit pas etre coupee par le bas de l'ecran).
  const padSize = Math.max(0, Math.floor(Math.min(pad.width, pad.height)) - 10);

  const replayButton = (
    <button type="button" className="replay-btn" aria-label={t('replaysLeft', { n: replaysLeft })} title={t('replaysLeft', { n: replaysLeft })} disabled={phase === 'placing' || emptied || replaysLeft <= 0} onClick={replay}>
      <Icon name="speaker" size={16} /><span className={`replays ${replaysLeft <= 0 ? 'none' : ''}`}>{replaysLeft}</span>
    </button>
  );
  const hint = phase === 'placing' ? t('listening2') : complete ? '' : native ? t('writeHint') : t('dropHint');

  return (
    // La prononciation (et donc l'annotation phonetique) n'est montree qu'aux difficultes qui l'affichent.
    <PhoneticContext.Provider value={showPinyin ? system : null}>
      <div className={`app wide battle ${shake ? 'shake' : ''}`} data-board={board ? enc.situation : undefined}>
        {board ? (
          <div className="board-bg" aria-hidden="true">
            <svg className="board-grain">
              <filter id="board-grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter="url(#board-grain)" />
            </svg>
          </div>
        ) : (
          <div className="battle-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined} aria-hidden="true" />
        )}
        <div className={`battle-grid ${native ? 'native' : ''}`}>
          {/* 1. Scene : le lieu en photo, l'interlocuteur devant, son nom, son trait et la jauge de conversation. */}
          <section className={`scene ${line.speaker === 'enemy' ? 'on' : ''}`}>
            <div className="scene-photo" style={bg ? { backgroundImage: `url(${bg})` } : undefined} aria-hidden="true" />
            <div className="scene-portrait">
              <Portrait id={enc.situation} emotion={emotion} talking={talking} bubble={bubble} />
            </div>
            <div className="scene-hud">
              <span className="foe-name">{person}</span>
              <span className="foe-trait">{traitLabel(enc.situation, lang)}</span>
              <span className="talk-bar" title={`${linesDone}/${total}`}>
                <span className="bar"><i className={remaining > 0.5 ? 'hi' : remaining > 0.2 ? 'mid' : 'lo'} style={{ width: `${remaining * 100}%` }} /></span>
                <span className="num">{linesDone}/{total}</span>
              </span>
            </div>
            {corner && <div className="scene-corner">{corner}</div>}
          </section>

          {/* 2. Conversation : historique, puis la replique a trous en cours dans la couleur de qui parle. */}
          <section className="dialog panel">
            <div className="dialog-head"><Icon name="chat" size={14} /><span>{topic}</span></div>
            <div className="chatlog" ref={logRef}>
              {logged.map((l, i) => (
                <div key={i} className={`bubble ${l.speaker}`}>
                  <span lang="zh-Hant-TW"><LineText line={l} /><button type="button" className="bubble-speak" aria-label={t('listen')} onClick={() => playLine(lineText(l), rate, voiceOf(l), dubKey(l.voice, l.speaker, state.settings.playerVoice))}><Icon name="speaker" size={13} /></button></span>
                  {showTranslation && <span className="sub">{tr(l)}</span>}
                </div>
              ))}
              {(phase === 'flying' || phase === 'flown') && (
                <div ref={pendingRef} className={`bubble ${line.speaker} ${phase === 'flying' ? 'pending' : 'arrived'}`}>
                  <span lang="zh-Hant-TW"><LineText line={line} /></span>
                  {showTranslation && <span className="sub">{tr(line)}</span>}
                </div>
              )}
            </div>
            <div className={`say-box ${line.speaker}`}>
              <span className="speaker-tag">{line.speaker === 'enemy' ? person : t('yourReply')}</span>
              {/* Commandes sur le bord haut, en face du nom : repeter, puis suivant (ou abandonner en Native). */}
              <span className="say-actions">
                {replayButton}
                {complete
                  ? <button type="button" className="tb-next" onClick={next}>{t('next')} <span className="arrow" aria-hidden="true">▼</span></button>
                  : native && <button type="button" className="tb-give" disabled={writingSlot < 0} onClick={giveUp}><Icon name="eye" size={16} /> {t('giveUp')}</button>}
              </span>
              <div className="dialogue" ref={dialogueRef} style={{ '--n': row.n, '--g': row.g, '--cw-cap': cardCap } as CSSProperties}>
                <div className={`dline current ${line.speaker} ${emptied ? 'emptied' : ''}`}>
                  <SentenceCards line={line} visible={visible} speaking={speaking} showPinyin={showPinyin} interactive={!complete && !native} renderBlank={native ? renderWriting : undefined} />
                  {/* Traductions de toute la rencontre empilees au meme endroit, seule celle de la replique en cours visible
                      (apres la premiere ecoute) : la place reservee est celle de la plus longue, le cadre ne bouge pas. */}
                  {showTranslation && (
                    <span className="tr-stack">
                      {enc.lines.map((l, i) => {
                        const shown = i === enc.index && phase !== 'placing';
                        return <span key={i} className={`tr ${shown ? '' : 'pending'}`} aria-hidden={!shown || undefined}>{tr(l)}</span>;
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="tb-hint">{hint}</div>
          </section>

          {/* 3. Ta main en eventail (en Native : la case d'ecriture), entre tes vies et ta pioche. */}
          <section className={`deck-zone ${mat ? 'has-mat' : ''}`}>
            <div className={`player-hud panel ${hurt ? 'hurt' : ''} ${line.speaker === 'player' ? 'on' : ''}`}>
              <span className="you">{t('you')}</span>
              <HpBar hp={run.hp} max={run.maxHp} />
            </div>
            {/* Tapis du plateau, derriere la main, avec le sceau du lieu. */}
            {mat && (
              <div className={`board-mat edge-${mat.edge}`} aria-hidden="true">
                <span className={`board-seal ${[...mat.seal].length > 2 ? 'long' : ''}`} lang="zh-Hant-TW">{mat.seal}</span>
              </div>
            )}
            {native ? (
              <div className="write-pad" ref={padRef}>
                {writingWord && padSize > 0
                  ? <WritingSlot key={`${enc.index}-${writingSlot}`} word={writingWord} size={padSize} single onResult={(ok) => update((s) => resolveSlot(s, writingSlot, ok, Date.now()))} />
                  : <div className="write-wait" style={{ width: padSize, height: padSize }}><span>{hint || t('listening2')}</span></div>}
              </div>
            ) : (
              <Hand
                ranks={enc.hand}
                difficulty={run.difficulty}
                locked={locked}
                isMastered={(rank) => wordStatus(state.progress[rank], enabled) === 'mastered'}
                onDrop={drop}
                getDropTargets={getDropTargets}
              />
            )}
            <div className="draw-pile" title={t('deckCount', { n: state.unlocked.length, total: WORDS.length })}>
              <span className="pile" aria-hidden="true"><i /><i /><i /></span>
              <span className="num">{state.unlocked.length}</span>
            </div>
          </section>
        </div>

        {flight && phase === 'flying' && (
          <FlyingWords items={flight.items} to={flight.to} onDone={() => { setFlight(null); setPhase('flown'); }} />
        )}
        {coach?.({ index: enc.index, stage: phase === 'placing' ? 'listen' : complete ? 'done' : 'play' })}
      </div>
    </PhoneticContext.Provider>
  );
}
