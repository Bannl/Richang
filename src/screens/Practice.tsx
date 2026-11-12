import { useEffect, useMemo, useRef, useState } from 'react';
import { enabledSkills } from '../core/session';
import { newProgress, review, wordStatus } from '../core/srs';
import { SKILLS, type AppState, type Grade, type Word } from '../core/types';
import { hasCharData } from '../data/hanzi';
import { WORDS, WORD_BY_RANK } from '../data/words';
import { noteOf, useLang, useT } from '../i18n';
import { Card, Example, HanziText, Icon, Meaning, Reading, SpeakButton, TopBar } from '../ui/basics';
import { GameCard } from '../ui/cards';
import { HanziQuiz, type HanziQuizHandle } from '../ui/HanziQuiz';
import { useElementSize } from '../ui/useElementSize';
import { PHONE_QUERY, TOUCH_QUERY, useMediaQuery } from '../ui/useMediaQuery';
import { CharProgress } from '../modes/Intro';
import { useUnit } from '../ui/useUnit';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onBack: () => void;
}

const isHan = (c: string) => /\p{Script=Han}/u.test(c);
const GAP = 28;
const MIN_BOX = 180;
const MAX_BOX = 460;
/** Hauteurs (unites de design) de la rangee des caracteres et des libelles au-dessus des cases (bureau). */
const CHARS_ROW = 44;
const LABEL_ROW = 30;
/** Taille de la vignette du modele par rapport a la grande case (ecran tactile). */
const MODEL_RATIO = 0.4;

/** Mot trace en entier : la competence d'ecriture progresse selon les erreurs. */
function creditWriting(state: AppState, rank: number, mistakes: number, now: number): AppState {
  const grade: Grade = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
  const p = state.progress[rank] ?? newProgress(now, SKILLS);
  const write = p.skills.write ?? newProgress(now, SKILLS).skills.write;
  return { ...state, progress: { ...state.progress, [rank]: { ...p, skills: { ...p.skills, write: review(write, grade, now) } } } };
}

/** Entrainement : parcourir ses cartes avec toutes leurs informations et tracer chaque caractere dans une case vide, modele a cote. */
export function PracticeScreen({ state, update, onBack }: Props) {
  const t = useT();
  const [all, setAll] = useState(false);
  const [index, setIndex] = useState(0);
  const enabled = enabledSkills(state.settings);
  const list = useMemo<Word[]>(() => {
    if (all) return [...WORDS].sort((a, b) => a.rank - b.rank);
    return state.unlocked.map((r) => WORD_BY_RANK.get(r)).filter((w): w is Word => !!w);
  }, [all, state.unlocked]);
  const current = Math.max(0, Math.min(index, list.length - 1));
  const word = list[current];
  const listRef = useRef<HTMLDivElement>(null);
  const isMastered = (rank: number) => wordStatus(state.progress[rank], enabled) === 'mastered';

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.practice-item.selected')?.scrollIntoView({ block: 'nearest' });
  }, [current, all]);

  const prev = () => setIndex(Math.max(0, current - 1));
  const nextCard = () => setIndex(Math.min(list.length - 1, current + 1));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') prev(); else if (e.key === 'ArrowRight') nextCard(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, list.length]);

  const back = <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back')}><Icon name="back" /></button>;
  const toggle = (
    <div className="chips">
      <button type="button" className={`chip ${!all ? 'on' : ''}`} onClick={() => { setAll(false); setIndex(0); }}>{t('deck')}</button>
      <button type="button" className={`chip ${all ? 'on' : ''}`} onClick={() => { setAll(true); setIndex(0); }}>{t('all')}</button>
    </div>
  );

  return (
    <div className="app wide practice">
      <TopBar left={back} title={t('practice')} right={toggle} />
      <div className="practice-list" ref={listRef}>
        {list.map((w, i) => (
          <div key={w.rank} className={`practice-item ${i === current ? 'selected' : ''}`}>
            <GameCard word={w} difficulty="newcomer" full mastered={isMastered(w.rank)} onClick={() => setIndex(i)} />
          </div>
        ))}
        {list.length === 0 && <p className="muted small center">{t('emptyDeck')}</p>}
      </div>
      <div className="practice-main">
        {word ? (
          <PracticeCard
            key={word.rank}
            word={word}
            state={state}
            mastered={isMastered(word.rank)}
            hasPrev={current > 0}
            hasNext={current < list.length - 1}
            onPrev={prev}
            onNext={nextCard}
            onDone={(mistakes) => update((s) => creditWriting(s, word.rank, mistakes, Date.now()))}
          />
        ) : (
          <div className="done"><p className="muted">{t('emptyDeck')}</p></div>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  word: Word;
  state: AppState;
  mastered: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDone: (mistakes: number) => void;
}

/** Une carte : informations completes a droite ; a gauche, le modele (traits animes) et la case vide ou tracer. */
function PracticeCard({ word, state, mastered, hasPrev, hasNext, onPrev, onNext, onDone }: CardProps) {
  const t = useT();
  const lang = useLang();
  const settings = state.settings;
  const chars = useMemo(() => [...word.hanzi].filter((c) => isHan(c) && hasCharData(c)), [word.hanzi]);
  const [active, setActive] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const model = useRef<HanziQuizHandle>(null);
  const area = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(area);
  const u = useUnit();
  // Ecran tactile (telephone, tablette) : grande case d'ecriture a la hauteur disponible, modele en vignette a cote.
  const phone = useMediaQuery(PHONE_QUERY);
  const touch = useMediaQuery(TOUCH_QUERY);
  const compact = phone || touch;
  const gap = (compact ? 14 : GAP) * u;
  const n = chars.length;
  const done = n > 0 && active >= n;
  const cur = chars[Math.min(active, Math.max(0, n - 1))];
  let box = 0;
  if (width > 0 && height > 0) {
    // Bureau : modele et case cote a cote, de meme taille, sous la rangee des caracteres et les libelles.
    const reserved = (CHARS_ROW + LABEL_ROW) * u;
    box = compact ? Math.min(height, (width - gap) / (1 + MODEL_RATIO)) : Math.min(MAX_BOX * u, (width - gap) / 2 - 6, height - reserved);
    box = Math.max(MIN_BOX * u * 0.6, Math.floor(box));
  }
  const modelBox = compact ? Math.round(box * MODEL_RATIO) : box;
  const note = noteOf(word, lang);

  useEffect(() => {
    if (done) onDone(mistakes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const restart = () => { setActive(0); setMistakes(0); setAttempt((a) => a + 1); };
  const verdict = done ? (mistakes === 0 ? t('perfect') : t('mistakes', { n: mistakes })) : '';

  return (
    <Card word={word} mastered={mastered}>
      <div className="practice-layout">
        <div className={`practice-pads ${compact ? 'compact' : ''}`} ref={area}>
          {n === 0 && <HanziText text={word.hanzi} size="xl" />}
          {n > 0 && !compact && (
            <div className="chars">
              {chars.map((c, k) => (
                <span key={k} lang="zh-Hant-TW" className={`hanzi md ${k < active ? '' : k === active ? 'cur' : 'todo'}`}>{c}</span>
              ))}
            </div>
          )}
          {box > 0 && n > 0 && (
            <div className="pads">
              <div className="pad model-pad">
                {compact && n > 1 && <CharProgress chars={chars} active={active} width={Math.round(Math.min(modelBox / Math.max(2, n), 54 * u))} />}
                <span className="label">{t('model')}</span>
                <div className="wbox model" onClick={() => model.current?.animate()}>
                  <HanziQuiz key={`m-${active}-${attempt}`} ref={model} char={cur} size={modelBox} quiz={false} showCharacter animateFirst />
                </div>
              </div>
              <div className="pad">
                {!compact && <span className="label">{done ? t('traceDone') : t('yourTurn')}</span>}
                <div className={`wbox ${done ? 'done' : 'active'}`}>
                  <HanziQuiz
                    key={`q-${active}-${attempt}`}
                    char={cur}
                    size={box}
                    quiz={!done}
                    showCharacter={done}
                    onMistake={() => setMistakes((m) => m + 1)}
                    onComplete={() => setTimeout(() => setActive((a) => a + 1), 450)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="learn-info">
          <div className="row">
            <HanziText text={word.hanzi} pinyin={word.pinyin} zhuyin={settings.showZhuyin} size="lg" />
            <SpeakButton text={word.hanzi} rate={settings.ttsRate} auto={settings.autoPlay} />
          </div>
          <Reading word={word} settings={settings} zhuyin="none" />
          <Meaning word={word} />
          {note && <p className="note">{note}</p>}
          <Example word={word} settings={settings} />
          <span className="prompt">{verdict}</span>
          <div className="learn-actions">
            <button type="button" className="btn ghost" disabled={n === 0} onClick={() => model.current?.animate()}><Icon name="replay" /> {t('showStrokes')}</button>
            <button type="button" className="btn ghost" disabled={n === 0} onClick={restart}>{t('clear')}</button>
          </div>
          <div className="learn-actions">
            <button type="button" className="btn" disabled={!hasPrev} onClick={onPrev}>{t('prevCard')}</button>
            <button type="button" className="btn primary" disabled={!hasNext} onClick={onNext}>{t('nextCardBtn')}</button>
          </div>
        </div>
      </div>
    </Card>
  );
}
