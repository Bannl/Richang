import { useCallback, useMemo, useState } from 'react';
import { applyGrade, introduceWord, pickDistractors } from '../core/apply';
import { buildSession, enabledSkills, type SessionItem } from '../core/session';
import { wordStatus } from '../core/srs';
import type { AppState, Grade, Skill } from '../core/types';
import { WORDS, WORD_BY_RANK } from '../data/words';
import { SKILL_KEYS, useLang, useT } from '../i18n';
import { IntroMode } from '../modes/Intro';
import { ListenMode } from '../modes/Listen';
import { ReadMode } from '../modes/Read';
import { SpeakMode } from '../modes/Speak';
import { WriteMode } from '../modes/Write';
import { Icon, TopBar, shuffle } from '../ui/basics';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onExit: () => void;
  stt: boolean;
}

export function SessionScreen({ state, update, onExit, stt }: Props) {
  const t = useT();
  const lang = useLang();
  const [items, setItems] = useState<SessionItem[]>(() => buildSession(WORDS, state, Date.now()));
  const [idx, setIdx] = useState(0);
  const [stats, setStats] = useState({ done: 0, correct: 0, newWords: 0 });
  const item: SessionItem | undefined = items[idx];
  const enabled = enabledSkills(state.settings);

  const options = useMemo(() => {
    if (!item || (item.kind !== 'read' && item.kind !== 'listen')) return [];
    const w = WORD_BY_RANK.get(item.rank)!;
    return shuffle([w, ...pickDistractors(w, WORDS, lang)]);
  }, [item, lang]);

  const onGrade = useCallback((g: Grade) => {
    if (!item || item.kind === 'intro') return;
    const now = Date.now();
    update((s) => applyGrade(s, item.rank, item.kind as Skill, g, now));
    setStats((st) => ({ ...st, done: st.done + 1, correct: st.correct + (g > 0 ? 1 : 0) }));
    if (g === 0) {
      setItems((list) => {
        const copy = [...list];
        copy.splice(Math.min(idx + 4, copy.length), 0, { ...item, isNew: false });
        return copy;
      });
    }
    setIdx((i) => i + 1);
  }, [item, idx, update]);

  const onIntro = useCallback(() => {
    if (!item) return;
    update((s) => introduceWord(s, item.rank, Date.now()));
    setStats((st) => ({ ...st, newWords: st.newWords + 1 }));
    setIdx((i) => i + 1);
  }, [item, update]);

  if (items.length === 0) {
    return (
      <div className="app">
        <TopBar left={<button type="button" className="icon-btn" onClick={onExit} aria-label={t('close')}><Icon name="close" /></button>} />
        <div className="done">
          <span className="big">✓</span>
          <p>{t('nothingToReview')}</p>
          <p className="muted small">{t('nothingHint')}</p>
        </div>
        <div className="actions"><button type="button" className="btn primary" onClick={onExit}>{t('back')}</button></div>
      </div>
    );
  }

  if (!item) {
    const pct = stats.done ? Math.round((stats.correct / stats.done) * 100) : 100;
    return (
      <div className="app">
        <TopBar />
        <div className="done">
          <span className="big">{pct}%</span>
          <p>{t('sessionDone')}</p>
          <p className="muted small">{t('sessionStats', { n: stats.done, m: stats.newWords })}</p>
        </div>
        <div className="actions"><button type="button" className="btn primary" onClick={onExit}>{t('back')}</button></div>
      </div>
    );
  }

  const word = WORD_BY_RANK.get(item.rank)!;
  const mastered = wordStatus(state.progress[item.rank], enabled) === 'mastered';
  const label = item.kind === 'intro' ? t('discovery') : t(SKILL_KEYS[item.kind]);
  const common = { word, settings: state.settings, mastered };

  return (
    <div className="app">
      <TopBar
        left={<button type="button" className="icon-btn" onClick={onExit} aria-label={t('quit')}><Icon name="close" /></button>}
        title={`${idx + 1} / ${items.length}`}
        right={<span className="small muted">{label}</span>}
      />
      <div className="progress"><i style={{ width: `${(idx / items.length) * 100}%` }} /></div>
      {item.kind === 'intro' && <IntroMode key={idx} word={word} settings={state.settings} onNext={onIntro} />}
      {item.kind === 'read' && <ReadMode key={idx} {...common} options={options} onGrade={onGrade} />}
      {item.kind === 'listen' && <ListenMode key={idx} {...common} options={options} onGrade={onGrade} />}
      {item.kind === 'write' && <WriteMode key={idx} {...common} onGrade={onGrade} />}
      {item.kind === 'speak' && <SpeakMode key={idx} {...common} stt={stt} onGrade={onGrade} />}
    </div>
  );
}
