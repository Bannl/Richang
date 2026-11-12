import { useState } from 'react';
import type { AppState, Difficulty, Settings } from '../core/types';
import { WORDS } from '../data/words';
import { canStartRun, nextUnlockables } from '../game/run';
import { MIN_DECK_FOR_RUN } from '../game/types';
import { DIFF_HINT, DIFF_KEY, useT } from '../i18n';
import { backgroundFor } from '../ui/backgrounds';
import { HanziText } from '../ui/basics';

interface Props {
  state: AppState;
  onLearn: () => void;
  onStartRun: (difficulty: Difficulty) => void;
  onContinueRun: () => void;
  onDeck: () => void;
  onPractice: () => void;
  onSettings: () => void;
  /** Voix des repliques du joueur, choisie au debut de l'aventure. */
  onVoice: (v: Settings['playerVoice']) => void;
}

const DIFFICULTIES: Difficulty[] = ['newcomer', 'seasoned', 'resident', 'native'];

/** Camp : deck, apprentissage de cartes, lancement ou reprise d'un run. */
export function HomeScreen({ state, onLearn, onStartRun, onContinueRun, onDeck, onPractice, onSettings, onVoice }: Props) {
  const t = useT();
  const [choosing, setChoosing] = useState(false);
  const deck = state.unlocked.length;
  const next = nextUnlockables(state, 1)[0];
  const missing = Math.max(0, MIN_DECK_FOR_RUN - deck);
  const run = state.run;

  return (
    <div className="app home on-photo">
      <div className="scene-bg" style={{ backgroundImage: `url(${backgroundFor('home')})` }} aria-hidden="true" />
      <h1><HanziText text="日常" size="lg" />Rìcháng</h1>
      <p className="subtitle">{t('tagline')}</p>

      <span className="badge big">{t('deckCount', { n: deck, total: WORDS.length })}</span>

      <div className="actions">
        <button type="button" className="btn" onClick={onLearn} disabled={!next}>
          <span>{t('learnCards')}</span>
          {next && <span className="sub" lang="zh-Hant-TW">{t('nextCardIs', { hanzi: next.hanzi })}</span>}
        </button>

        {run ? (
          <button type="button" className="btn primary" onClick={onContinueRun}>
            <span>{t('continueRun')}</span>
            <span className="sub">{t(DIFF_KEY[run.difficulty])} · {t('hp')} {run.hp}/{run.maxHp}</span>
          </button>
        ) : !choosing ? (
          <button type="button" className="btn primary" disabled={!canStartRun(state)} onClick={() => setChoosing(true)}>
            <span>{t('startRun')}</span>
            {!canStartRun(state) && <span className="sub">{t('needCards', { n: missing })}</span>}
          </button>
        ) : (
          <div className="difficulty-list">
            <p className="section">{t('yourVoice')}</p>
            <div className="voice-choice">
              {(['female', 'male'] as const).map((v) => (
                <button type="button" key={v} className={`chip ${state.settings.playerVoice === v ? 'on' : ''}`} onClick={() => onVoice(v)}>{t(v === 'male' ? 'voiceMan' : 'voiceWoman')}</button>
              ))}
            </div>
            <p className="section">{t('chooseDifficulty')}</p>
            {DIFFICULTIES.map((d) => (
              <button type="button" key={d} className={`btn ${d === state.settings.difficulty ? 'primary' : ''}`} onClick={() => onStartRun(d)}>
                <span>{t(DIFF_KEY[d])}</span>
                <span className="sub">{t(DIFF_HINT[d])}</span>
              </button>
            ))}
            <button type="button" className="btn ghost" onClick={() => setChoosing(false)}>{t('back')}</button>
          </div>
        )}
      </div>

      {state.runsPlayed > 0 && <p className="muted small center">{t('runsSummary', { n: state.runsPlayed, w: state.runsWon })}</p>}

      <div className="footer">
        <button type="button" className="link" onClick={onDeck}>{t('deck')}</button>
        <button type="button" className="link" onClick={onPractice}>{t('practice')}</button>
        <button type="button" className="link" onClick={onSettings}>{t('settings')}</button>
      </div>
    </div>
  );
}
