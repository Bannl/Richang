import { useMemo, useState, type CSSProperties } from 'react';
import { enabledSkills } from '../core/session';
import { wordStatus } from '../core/srs';
import type { AppState, WordStatus } from '../core/types';
import { TIER_LIMITS, THEMES, WORDS, themeOf } from '../data/words';
import { SKILL_KEYS, glosses, noteOf, posLabel, themeLabel, useLang, useT, type StringKey } from '../i18n';
import { speak } from '../platform/tts';
import { Example, HanziText, Icon, Reading, TopBar } from '../ui/basics';
import { StarMark } from '../ui/cards';

const STATUS_KEY: Record<WordStatus, StringKey> = { new: 'statusNew', learning: 'statusLearning', review: 'statusReview', mastered: 'statusMastered' };

export function WordsScreen({ state, onBack, deckOnly = false }: { state: AppState; onBack: () => void; deckOnly?: boolean }) {
  const t = useT();
  const lang = useLang();
  const [tier, setTier] = useState(1);
  const [theme, setTheme] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const enabled = enabledSkills(state.settings);
  const unlocked = useMemo(() => new Set(state.unlocked), [state.unlocked]);
  const list = useMemo(() => WORDS.filter((w) => w.tier === tier && (!theme || w.theme === theme) && (!deckOnly || unlocked.has(w.rank))), [tier, theme, deckOnly, unlocked]);

  return (
    <div className="app words">
      <TopBar left={<button type="button" className="icon-btn" onClick={onBack} aria-label={t('back')}><Icon name="back" /></button>} title={deckOnly ? t('deck') : t('words')} zh={deckOnly ? '牌組' : '詞彙'} />
      <div className="chips">
        {TIER_LIMITS.map((l, i) => (
          <button type="button" key={l} className={`chip ${tier === i + 1 ? 'on' : ''}`} onClick={() => setTier(i + 1)}>{i === 6 ? `${TIER_LIMITS[5]}+` : l}</button>
        ))}
      </div>
      <div className="chips">
        <button type="button" className={`chip ${theme === null ? 'on' : ''}`} onClick={() => setTheme(null)}>{t('all')}</button>
        {THEMES.map((th) => (
          <button type="button" key={th.id} className={`chip ${theme === th.id ? 'on' : ''}`} onClick={() => setTheme(th.id)}>{themeLabel(th, lang)}</button>
        ))}
      </div>
      <div className="list">
        {list.map((w) => {
          const st = wordStatus(state.progress[w.rank], enabled);
          const p = state.progress[w.rank];
          const note = noteOf(w, lang);
          return (
            <div key={w.rank}>
              <div className={`item ${st}`} style={{ '--hue': themeOf(w).hue } as CSSProperties} onClick={() => setOpen(open === w.rank ? null : w.rank)}>
                <span className="dot" />
                <HanziText text={w.hanzi} pinyin={w.pinyin} size="md" />
                <span className="fr">{glosses(w, lang)[0]}</span>
                <span className="status">{p?.star && <StarMark className="inline" />}{t(STATUS_KEY[st])}</span>
              </div>
              {open === w.rank && (
                <div className="detail">
                  <div className="row">
                    <Reading word={w} settings={state.settings} />
                    <span className="spacer" />
                    <button type="button" className="icon-btn" onClick={() => speak(w.hanzi, state.settings.ttsRate)} aria-label={t('listen')}><Icon name="speaker" /></button>
                  </div>
                  <span>{glosses(w, lang).join(' · ')} <span className="muted small">{posLabel(w.pos, lang)}</span></span>
                  {note && <span className="muted small">{note}</span>}
                  <Example word={w} settings={state.settings} />
                  {p && (
                    <span className="muted small">
                      {enabled.map((k) => `${t(SKILL_KEYS[k])} : ${p.skills[k]?.interval ?? 0} ${t('days')}`).join(' · ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
