import type { AppState } from '../core/types';
import { WORDS } from '../data/words';
import { nextUnlockables, unlockWord } from '../game/run';
import { useT } from '../i18n';
import { IntroMode } from '../modes/Intro';
import { Icon, TopBar } from '../ui/basics';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onBack: () => void;
  toast: (msg: string) => void;
}

/** Apprentissage hors run : la prochaine carte (ordre de frequence) est tracee puis rejoint le deck. */
export function LearnScreen({ state, update, onBack, toast }: Props) {
  const t = useT();
  const next = nextUnlockables(state, 1)[0];
  const back = <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back')}><Icon name="back" /></button>;

  if (!next) {
    return (
      <div className="app">
        <TopBar left={back} title={t('learnTitle')} zh="學習" />
        <div className="done"><span className="big">✓</span><p>{t('allUnlocked')}</p></div>
      </div>
    );
  }

  // Pas de barre du haut : retour, titre et compteur sont dans la fenetre, la case d'ecriture prend toute la hauteur.
  return (
    <div className="app wide learn">
      <IntroMode
        key={next.rank}
        word={next}
        head={<>{back}<span className="title"><span className="title-zh" lang="zh-Hant-TW">學習</span>{t('learnTitle')}</span><span className="badge">{state.unlocked.length}/{WORDS.length}</span></>}
        settings={state.settings}
        continueLabel={t('addToDeck')}
        onNext={() => { update((s) => unlockWord(s, next.rank, Date.now())); toast(`${t('cardUnlocked')} · ${next.hanzi}`); }}
      />
    </div>
  );
}
