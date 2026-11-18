import type { AppState } from '../core/types';
import { WORD_BY_RANK } from '../data/words';
import { chooseReward, completeReward, endRun, leaveRest, nextDay } from '../game/run';
import { NIGHT_HEAL } from '../game/types';
import { DIFF_KEY, useT } from '../i18n';
import { IntroMode } from '../modes/Intro';
import { backgroundFor } from '../ui/backgrounds';
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
      <TopBar left={<HpBar hp={run.hp} max={run.maxHp} />} title={t('rewardTitle')} zh="獎勵" right={reward.remaining > 1 ? <span className="badge">×{reward.remaining}</span> : undefined} />
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

/**
 * Fin de journee : l'evenement du soir est passe, la journee compte pour le score. Bilan de la journee, la nuit rend une
 * vie, puis la journee suivante (nouvelle carte, rencontres un peu plus longues et plus riches).
 */
export function DayEndScreen({ state, update, onExit }: Props) {
  const t = useT();
  const run = state.run!;
  const start = run.dayStart ?? { correct: 0, wrong: 0, cards: 0 };
  const healed = Math.min(NIGHT_HEAL, run.maxHp - run.hp);
  const record = run.day > run.bestBefore;
  const final = run.map.nodes.find((n) => n.type === 'boss')?.situation ?? undefined;
  return (
    <div className="app on-photo">
      {/* La nuit tombe sur le lieu de l'evenement du soir. */}
      <div className="scene-bg night" style={{ backgroundImage: `url(${backgroundFor(final ?? 'night-market')})` }} aria-hidden="true" />
      <TopBar left={<HpBar hp={run.hp} max={run.maxHp} />} />
      <div className="done day-end">
        <span className="big moon" aria-hidden="true">☾</span>
        <p>{t('dayDone', { n: run.day })}</p>
        <p className="muted small">{t('runStats', { c: run.correct - start.correct, w: run.wrong - start.wrong, n: run.cardsUnlocked - start.cards })}</p>
        <p className="score-line">{t('scoreDays', { n: run.day })}{record && <span className="record">{t('newRecord')}</span>}</p>
        <p className="muted small">{healed > 0 ? t('nightHeal', { n: healed }) : t('nightFull')}</p>
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => update(nextDay)}>{t('nextDay', { n: run.day + 1 })}</button>
        <button type="button" className="btn ghost" onClick={onExit}>{t('backToCamp')}</button>
      </div>
    </div>
  );
}

/** Fin de partie : plus de vies. Le score est le nombre de journees reussies ; retour au camp. */
export function RunEndScreen({ state, update, onExit }: Props) {
  const t = useT();
  const run = state.run!;
  const days = Math.max(0, run.day - 1);
  const record = days > 0 && days > run.bestBefore;
  return (
    <div className="app">
      <TopBar />
      <div className="done">
        <span className="big">✕</span>
        <p>{t('runLost')}</p>
        <p className="score-line">{t('scoreDays', { n: days })}{record && <span className="record">{t('newRecord')}</span>}</p>
        <p className="muted small">{t('bestDays', { n: Math.max(state.bestDays, days) })}</p>
        <p className="muted small">{t(DIFF_KEY[run.difficulty])} · {t('runStats', { c: run.correct, w: run.wrong, n: run.cardsUnlocked })}</p>
      </div>
      <div className="actions"><button type="button" className="btn primary" onClick={() => { update(endRun); onExit(); }}>{t('backToCamp')}</button></div>
    </div>
  );
}
