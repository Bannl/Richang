import type { AppState } from '../core/types';
import { WORD_BY_RANK } from '../data/words';
import { chooseReward, completeReward, endRun, leaveRest } from '../game/run';
import { DIFF_KEY, useT } from '../i18n';
import { IntroMode } from '../modes/Intro';
import { TopBar } from '../ui/basics';
import { GameCard } from '../ui/cards';
import { HpBar } from './MapScreen';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onExit: () => void;
}

/** Recompense : choisir une carte parmi trois, la tracer, elle rejoint le deck. */
export function RewardScreen({ state, update }: Props) {
  const t = useT();
  const run = state.run!;
  const reward = run.reward!;
  const learning = reward.learning != null ? WORD_BY_RANK.get(reward.learning) : undefined;

  if (learning) {
    return (
      <div className="app wide learn">
        <IntroMode
          key={learning.rank}
          word={learning}
          head={<HpBar hp={run.hp} max={run.maxHp} />}
          settings={state.settings}
          continueLabel={t('addToDeck')}
          onNext={() => update((s) => completeReward(s, Date.now()))}
        />
      </div>
    );
  }

  return (
    <div className="app wide">
      <TopBar left={<HpBar hp={run.hp} max={run.maxHp} />} title={t('rewardTitle')} right={reward.remaining > 1 ? <span className="badge">×{reward.remaining}</span> : undefined} />
      <p className="prompt center">{t('rewardHint')}</p>
      <div className="reward-grid">
        {reward.choices.map((rank) => {
          const w = WORD_BY_RANK.get(rank);
          return w ? <GameCard key={rank} word={w} difficulty={run.difficulty} full onClick={() => update((s) => chooseReward(s, rank))} /> : null;
        })}
      </div>
    </div>
  );
}

/** Repos : quelques PV recuperes. */
export function RestScreen({ state, update }: Props) {
  const t = useT();
  const run = state.run!;
  return (
    <div className="app">
      <TopBar left={<HpBar hp={run.hp} max={run.maxHp} />} />
      <div className="done">
        <span className="big">♥</span>
        <p>{t('restTitle')}</p>
        <p className="muted small">{t('restText', { n: run.restHealed })}</p>
      </div>
      <div className="actions"><button type="button" className="btn primary" onClick={() => update(leaveRest)}>{t('continue')}</button></div>
    </div>
  );
}

/** Fin de run : victoire ou defaite, puis retour au camp. */
export function RunEndScreen({ state, update, onExit }: Props) {
  const t = useT();
  const run = state.run!;
  const won = run.phase === 'won';
  return (
    <div className="app">
      <TopBar />
      <div className="done">
        <span className="big">{won ? '✓' : '✕'}</span>
        <p>{won ? t('runWon') : t('runLost')}</p>
        <p className="muted small">{t(DIFF_KEY[run.difficulty])} · {t('runStats', { c: run.correct, w: run.wrong, n: run.cardsUnlocked })}</p>
      </div>
      <div className="actions"><button type="button" className="btn primary" onClick={() => { update(endRun); onExit(); }}>{t('backToCamp')}</button></div>
    </div>
  );
}
