import { useEffect, useMemo, useRef, useState } from 'react';
import { creditWriting, MASTERY_STREAK, streakOf } from '../core/mastery';
import type { AppState, Word } from '../core/types';
import { hasCharData } from '../data/hanzi';
import { WORD_BY_RANK } from '../data/words';
import { useT } from '../i18n';
import { HanziText, Icon, Meaning, Reading, SpeakButton, TopBar } from '../ui/basics';
import { StarMark } from '../ui/cards';
import { MasteryLine } from '../ui/Mastery';
import { useElementSize } from '../ui/useElementSize';
import { WritingSlot } from '../ui/WritingSlot';
import { HpBar } from './MapScreen';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onBack: () => void;
}

/** Vies d'une partie : chaque erreur de trait en coute une. */
const LIVES = 5;
/** Le mot ecrit reste affiche un instant avant le suivant (ms). */
const SHOW_MS = 1100;

const isHan = (c: string) => /\p{Script=Han}/u.test(c);
/** Mot tracable : au moins un caractere, et des donnees de traits pour chacun. */
const writable = (w: Word) => { const han = [...w.hanzi].filter(isHan); return han.length > 0 && han.every(hasCharData); };

function shuffled(ranks: number[], notFirst?: number): number[] {
  const a = [...ranks];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (a.length > 1 && a[0] === notFirst) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/**
 * Defi d'ecriture : les mots du deck arrivent un par un, dans le desordre, a ecrire de memoire (pinyin, sens et voix
 * en invite, sans le caractere). Chaque erreur de trait coute une vie (5 vies) ; apres une erreur, Hanzi Writer montre
 * le trait attendu pour que l'on puisse finir le mot. Le score est le nombre de mots ecrits avant la derniere vie.
 * Chaque mot ecrit compte pour la maitrise (etoile a 10 traces d'affilee sans erreur) et pour l'ecriture (revision).
 */
export function WritingChallengeScreen({ state, update, onBack }: Props) {
  const t = useT();
  const pool = useMemo(() => state.unlocked.filter((r) => { const w = WORD_BY_RANK.get(r); return !!w && writable(w); }), [state.unlocked]);
  const [game, setGame] = useState(0);
  const [queue, setQueue] = useState<number[]>(() => shuffled(pool));
  const [pos, setPos] = useState(0);
  const [hp, setHp] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [shown, setShown] = useState(false);
  const [hurt, setHurt] = useState(false);
  const [starred, setStarred] = useState(false);
  const bestBefore = useRef(state.bestWriting);
  const hpRef = useRef(LIVES);
  hpRef.current = hp;
  const padRef = useRef<HTMLDivElement>(null);
  const pad = useElementSize(padRef);
  const box = Math.max(0, Math.floor(Math.min(pad.width, pad.height)) - 10);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  const rank = queue[pos];
  const word = rank !== undefined ? WORD_BY_RANK.get(rank) : undefined;
  const over = hp <= 0;

  // Fin de partie : le record est garde.
  useEffect(() => {
    if (over) update((s) => ({ ...s, bestWriting: Math.max(s.bestWriting, score) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const lose = () => {
    if (hpRef.current <= 0) return;
    setHp((h) => Math.max(0, h - 1));
    setHurt(true);
    later(() => setHurt(false), 450);
  };

  const written = (mistakes: number) => {
    if (hpRef.current <= 0 || rank === undefined) return;
    const earns = mistakes === 0 && streakOf(state, rank) === MASTERY_STREAK - 1 && !state.progress[rank]?.star;
    update((s) => creditWriting(s, rank, mistakes, Date.now()));
    setScore((n) => n + 1);
    setStarred(earns);
    setShown(true);
    later(() => {
      setShown(false);
      setStarred(false);
      if (pos + 1 < queue.length) setPos(pos + 1);
      else { setQueue(shuffled(pool, rank)); setPos(0); }
    }, SHOW_MS);
  };

  const restart = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    bestBefore.current = state.bestWriting;
    setGame((g) => g + 1);
    setQueue(shuffled(pool));
    setPos(0);
    setHp(LIVES);
    setScore(0);
    setShown(false);
    setStarred(false);
  };

  const back = <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back')}><Icon name="back" /></button>;
  const record = over && score > bestBefore.current;

  return (
    <div className={`app wide challenge ${hurt ? 'shake' : ''}`}>
      <TopBar left={back} title={t('writingChallenge')} zh="寫字" right={<span className={`challenge-hp ${hurt ? 'hurt' : ''}`}><HpBar hp={hp} max={LIVES} /></span>} />
      {pool.length === 0 ? (
        <div className="done"><p className="muted">{t('challengeEmpty')}</p></div>
      ) : (
        <div className="challenge-main">
          <div className="challenge-pad" ref={padRef}>
            {word && !over && box > 0 && (
              <WritingSlot key={`${game}-${pos}-${rank}`} word={word} size={box} single hintAfterMisses={1} onMistake={lose} onResult={(_ok, mistakes) => written(mistakes)} />
            )}
          </div>
          <div className="challenge-info panel">
            <div className="challenge-score">
              <span className="label">{t('challengeScore')}</span>
              <span className="num">{score}</span>
              <span className="muted small">{t('challengeBest', { n: Math.max(state.bestWriting, score) })}</span>
            </div>
            {word && (
              <div className="challenge-word">
                <span className="prompt">{t('challengePrompt')}</span>
                <div className="row">
                  <Reading word={word} settings={{ ...state.settings, showPinyin: true }} zhuyin="boxes" />
                  <SpeakButton text={word.hanzi} rate={state.settings.ttsRate} auto={state.settings.autoPlay && !over} />
                </div>
                <Meaning word={word} />
                {shown && <HanziText text={word.hanzi} size="lg" className="challenge-answer" />}
                {starred ? <span className="mastery-line on new"><StarMark /> {t('masteryNew')}</span> : <MasteryLine state={state} rank={word.rank} />}
              </div>
            )}
            <p className="muted small">{t('challengeRule')}</p>
          </div>
        </div>
      )}
      {over && (
        <div className="challenge-over" role="dialog" aria-modal="true">
          <div className="panel">
            <span className="big">✕</span>
            <p>{t('challengeOver')}</p>
            <p className="score-line">{t('challengeWords', { n: score })}{record && <span className="record">{t('newRecord')}</span>}</p>
            <p className="muted small">{t('challengeBest', { n: Math.max(state.bestWriting, score) })}</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={restart}>{t('playAgain')}</button>
              <button type="button" className="btn ghost" onClick={onBack}>{t('backToCamp')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
