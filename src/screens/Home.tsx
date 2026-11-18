import { useState } from 'react';
import type { AppState, Difficulty, Settings } from '../core/types';
import { WORDS } from '../data/words';
import { canStartRun, nextUnlockables } from '../game/run';
import { MIN_DECK_FOR_RUN } from '../game/types';
import { DIFF_HINT, DIFF_KEY, useT } from '../i18n';
import { backgroundFor } from '../ui/backgrounds';
import { SectionTitle } from '../ui/basics';

interface Props {
  state: AppState;
  onLearn: () => void;
  onStartRun: (difficulty: Difficulty) => void;
  onContinueRun: () => void;
  onDeck: () => void;
  onPractice: () => void;
  onSituations: () => void;
  onChallenge: () => void;
  onSettings: () => void;
  /** Voix des repliques du joueur, choisie au debut de l'aventure. */
  onVoice: (v: Settings['playerVoice']) => void;
}

const DIFFICULTIES: Difficulty[] = ['newcomer', 'seasoned', 'resident', 'native'];

/** Camp : deck, apprentissage de cartes, lancement ou reprise d'un run. */
export function HomeScreen({ state, onLearn, onStartRun, onContinueRun, onDeck, onPractice, onSituations, onChallenge, onSettings, onVoice }: Props) {
  const t = useT();
  const [choosing, setChoosing] = useState(false);
  const deck = state.unlocked.length;
  const next = nextUnlockables(state, 1)[0];
  const missing = Math.max(0, MIN_DECK_FOR_RUN - deck);
  const run = state.run;

  return (
    <div className="app home on-photo">
      <div className="scene-bg" style={{ backgroundImage: `url(${backgroundFor('home')})` }} aria-hidden="true" />
      <h1><span className="logo-seal" lang="zh-Hant-TW">日常</span>Rìcháng</h1>
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
            <span className="sub">{t('dayN', { n: run.day })} · {t(DIFF_KEY[run.difficulty])} · {t('hp')} {run.hp}/{run.maxHp}</span>
          </button>
        ) : !choosing ? (
          <button type="button" className="btn primary" disabled={!canStartRun(state)} onClick={() => setChoosing(true)}>
            <span>{t('startRun')}</span>
            {!canStartRun(state) && <span className="sub">{t('needCards', { n: missing })}</span>}
          </button>
        ) : (
          <div className="difficulty-list">
            <SectionTitle zh="聲音">{t('yourVoice')}</SectionTitle>
            <div className="voice-choice">
              {(['female', 'male'] as const).map((v) => (
                <button type="button" key={v} className={`chip ${state.settings.playerVoice === v ? 'on' : ''}`} onClick={() => onVoice(v)}>{t(v === 'male' ? 'voiceMan' : 'voiceWoman')}</button>
              ))}
            </div>
            <SectionTitle zh="難度">{t('chooseDifficulty')}</SectionTitle>
            {DIFFICULTIES.map((d) => (
              <button type="button" key={d} className={`btn ${d === state.settings.difficulty ? 'primary' : ''}`} onClick={() => onStartRun(d)}>
                <span>{t(DIFF_KEY[d])}</span>
                <span className="sub">{t(DIFF_HINT[d])}</span>
              </button>
            ))}
            <button type="button" className="btn ghost" onClick={() => setChoosing(false)}>{t('back')}</button>
          </div>
        )}

        {!choosing && (
          <div className="mode-row">
            <button type="button" className="btn" disabled={deck === 0} onClick={onSituations}>
              <span>{t('situations')}</span>
              <span className="sub">{t('situationsSub')}</span>
            </button>
            <button type="button" className="btn" disabled={deck === 0} onClick={onChallenge}>
              <span>{t('writingChallenge')}</span>
              <span className="sub">{state.bestWriting > 0 ? t('challengeBest', { n: state.bestWriting }) : t('writingChallengeSub')}</span>
            </button>
          </div>
        )}
      </div>

      {state.bestDays > 0 && <p className="muted small center">{t('bestDays', { n: state.bestDays })}</p>}

      <div className="footer">
        <button type="button" className="link" onClick={onDeck}><span className="link-seal" lang="zh-Hant-TW" aria-hidden="true">牌</span>{t('deck')}</button>
        <button type="button" className="link" onClick={onPractice}><span className="link-seal" lang="zh-Hant-TW" aria-hidden="true">練</span>{t('practice')}</button>
        <button type="button" className="link" onClick={onSettings}><span className="link-seal" lang="zh-Hant-TW" aria-hidden="true">設</span>{t('settings')}</button>
      </div>
    </div>
  );
}
