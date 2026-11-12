import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from './core/types';
import { startRun } from './game/run';
import { autoStartTutorial, endTutorial } from './game/tutorial';
import { LangContext, translate } from './i18n';
import { loadState, saveState } from './platform/storage';
import { BattleScreen } from './screens/Battle';
import { HomeScreen } from './screens/Home';
import { LearnScreen } from './screens/Learn';
import { MapScreen } from './screens/MapScreen';
import { RestScreen, RewardScreen, RunEndScreen } from './screens/RunScreens';
import { PracticeScreen } from './screens/Practice';
import { SettingsScreen } from './screens/Settings';
import { TutorialScreen } from './screens/Tutorial';
import { configureVoices } from './platform/tts';
import { PhoneticContext } from './ui/Phonetic';
import { WordsScreen } from './screens/Words';

type Screen = 'home' | 'learn' | 'run' | 'deck' | 'practice' | 'settings';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [toast, setToast] = useState<string | null>(null);
  const latest = useRef<AppState | null>(null);
  latest.current = state;

  // Tout premier lancement (aucune carte, tutoriel jamais vu) : le jeu commence par le tutoriel.
  useEffect(() => {
    loadState().then((s) => setState(autoStartTutorial(s)));
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => (s ? fn(s) : s)), []);
  const goHome = useCallback(() => setScreen('home'), []);

  // Sauvegarde differee a chaque changement, et immediate quand l'app passe en arriere-plan.
  useEffect(() => {
    if (!state) return;
    const id = setTimeout(() => { saveState(state).catch((e) => { console.error('Sauvegarde impossible', e); setToast(translate(state.settings.language, 'saveFailed')); }); }, 300);
    return () => clearTimeout(id);
  }, [state]);
  useEffect(() => {
    const flush = () => { if (latest.current) saveState(latest.current).catch(() => {}); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); };
  }, []);

  const scheme = state?.settings.colorScheme;
  const font = state?.settings.hanziFont;
  useEffect(() => {
    const root = document.documentElement;
    if (!scheme || scheme === 'auto') delete root.dataset.theme; else root.dataset.theme = scheme;
    if (font) root.dataset.font = font;
  }, [scheme, font]);
  useEffect(() => { if (state) document.documentElement.lang = state.settings.language; }, [state?.settings.language]);
  // Voix choisies pour les personnages masculins et feminins.
  useEffect(() => { if (state) configureVoices({ male: state.settings.voiceMale, female: state.settings.voiceFemale }); }, [state?.settings.voiceMale, state?.settings.voiceFemale]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  // Bouton retour Android
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener('backButton', () => {
      // Tutoriel rejoue depuis les reglages : retour = le quitter. Premier lancement : on quitte l'app (il reprendra).
      const s = latest.current;
      if (s?.tutorial) {
        if (s.tutorialDone) { update(endTutorial); setScreen('home'); } else CapApp.exitApp();
        return;
      }
      if (screen === 'home') CapApp.exitApp(); else setScreen('home');
    });
    return () => { sub.then((h) => h.remove()); };
  }, [screen]);

  if (!state) return <div className="app" />;

  let content;
  if (state.tutorial) {
    // Tutoriel en cours (premier lancement, ou rejoue depuis les reglages) : il passe avant tout le reste.
    content = <TutorialScreen state={state} update={update} onDone={goHome} toast={setToast} />;
  } else if (screen === 'run' && state.run) {
    const props = { state, update, onExit: goHome };
    switch (state.run.phase) {
      case 'battle': content = state.run.encounter ? <BattleScreen state={state} update={update} /> : <MapScreen {...props} />; break;
      case 'reward': content = state.run.reward ? <RewardScreen {...props} /> : <MapScreen {...props} />; break;
      case 'rest': content = <RestScreen {...props} />; break;
      case 'won':
      case 'lost': content = <RunEndScreen {...props} />; break;
      default: content = <MapScreen {...props} />;
    }
  } else if (screen === 'learn') {
    content = <LearnScreen state={state} update={update} onBack={goHome} toast={setToast} />;
  } else if (screen === 'deck') {
    content = <WordsScreen state={state} onBack={goHome} deckOnly />;
  } else if (screen === 'practice') {
    content = <PracticeScreen state={state} update={update} onBack={goHome} />;
  } else if (screen === 'settings') {
    content = <SettingsScreen state={state} update={update} onBack={goHome} toast={setToast} />;
  } else {
    content = (
      <HomeScreen
        state={state}
        onLearn={() => setScreen('learn')}
        onStartRun={(d) => { update((s) => startRun(s, d, Date.now())); setScreen('run'); }}
        onContinueRun={() => setScreen('run')}
        onDeck={() => setScreen('deck')}
        onPractice={() => setScreen('practice')}
        onSettings={() => setScreen('settings')}
        onVoice={(v) => update((s) => ({ ...s, settings: { ...s.settings, playerVoice: v } }))}
      />
    );
  }

  return (
    <LangContext.Provider value={state.settings.language}>
      <PhoneticContext.Provider value={state.settings.phonetic ? state.settings.phoneticSystem : null}>
        {content}
      </PhoneticContext.Provider>
      {toast && <div className="toast">{toast}</div>}
    </LangContext.Provider>
  );
}
