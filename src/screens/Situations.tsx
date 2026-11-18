import type { CSSProperties } from 'react';
import type { AppState } from '../core/types';
import { drillSituations, endDrill, startDrill } from '../game/drill';
import { SITUATIONS, SITUATION_BY_ID } from '../game/situations';
import { useLang, useT } from '../i18n';
import { backgroundFor } from '../ui/backgrounds';
import { Icon, TopBar } from '../ui/basics';
import { Portrait } from '../ui/Portrait';
import { HpBar } from './MapScreen';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onBack: () => void;
}

/**
 * Mode Situation : les situations jouables avec le deck (comme en aventure), chacune sur la photo de son lieu avec son
 * personnage ; on en choisit une pour jouer une de ses conversations en entier.
 */
export function SituationsScreen({ state, update, onBack }: Props) {
  const t = useT();
  const lang = useLang();
  const ids = drillSituations(state);
  const order = new Map(SITUATIONS.map((s, i) => [s.id, i]));
  const list = [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const back = <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back')}><Icon name="back" /></button>;

  return (
    <div className="app wide situations">
      <TopBar left={back} title={t('situations')} zh="情境" right={<span className="badge">{list.length}/{SITUATIONS.length}</span>} />
      <p className="prompt center">{list.length ? t('situationsHint') : t('noSituation')}</p>
      <div className="situation-grid">
        {list.map((id) => {
          const s = SITUATION_BY_ID.get(id);
          if (!s) return null;
          const bg = backgroundFor(id);
          return (
            <button
              type="button"
              key={id}
              className="situation-tile"
              style={bg ? ({ '--photo': `url(${bg})` } as CSSProperties) : undefined}
              onClick={() => update((st) => startDrill(st, id, Date.now()))}
            >
              <span className="situation-portrait" aria-hidden="true"><Portrait id={id} emotion="neutral" /></span>
              <span className="situation-text">
                <span className="situation-name">{lang === 'en' ? s.en : s.fr}</span>
                <span className="situation-person">{lang === 'en' ? s.person.en : s.person.fr}</span>
              </span>
            </button>
          );
        })}
      </div>
      {list.length > 0 && list.length < SITUATIONS.length && (
        <p className="muted small center">{t('situationsCount', { n: list.length, total: SITUATIONS.length })} · {t('situationsLocked')}</p>
      )}
    </div>
  );
}

/** Fin d'une conversation du mode Situation : bilan, puis une autre conversation, une autre situation ou le camp. */
export function DrillEndScreen({ state, update, onBack }: Props) {
  const t = useT();
  const lang = useLang();
  const d = state.drill!;
  const s = SITUATION_BY_ID.get(d.situation);
  const won = d.status === 'done';
  return (
    <div className="app">
      <TopBar left={<HpBar hp={d.hp} max={5} />} title={s ? (lang === 'en' ? s.en : s.fr) : ''} />
      <div className="done">
        <span className="big">{won ? '✓' : '✕'}</span>
        <p>{won ? t('drillDone') : t('drillLost')}</p>
        <p className="muted small">{t('drillStats', { c: d.correct, w: d.wrong })}</p>
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => update((st) => startDrill(st, d.situation, Date.now()))}>{t('drillAgain')}</button>
        <button type="button" className="btn" onClick={() => update(endDrill)}>{t('drillOther')}</button>
        <button type="button" className="btn ghost" onClick={() => { update(endDrill); onBack(); }}>{t('backToCamp')}</button>
      </div>
    </div>
  );
}
