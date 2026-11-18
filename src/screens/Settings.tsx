import { useEffect, useState } from 'react';
import { SKILLS, type AppState, type Settings } from '../core/types';
import { emptyState } from '../core/types';
import { startTutorial } from '../game/tutorial';
import { LANGS, SKILL_KEYS, useT } from '../i18n';
import { exportState, importState, platformName } from '../platform/storage';
import { listChineseVoices, openTtsInstall, speak, ttsDescription, type TtsInfo, type VoiceOption } from '../platform/tts';
import { PHOTO_CREDITS } from '../ui/backgrounds';
import { Icon, SectionTitle, Switch, TopBar } from '../ui/basics';

/** Depot public du jeu (code source, licences : LICENSE, LICENSE-MIT, COPYRIGHT.md). */
const REPO_URL = 'https://github.com/Bannl/Richang';
/** Politique de confidentialite (exigee par l'App Store, dans l'app comme sur la fiche). */
const PRIVACY_URL = `${REPO_URL}/blob/master/PRIVACY.md`;

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onBack: () => void;
  toast: (msg: string) => void;
}

export function SettingsScreen({ state, update, onBack, toast }: Props) {
  const t = useT();
  const s = state.settings;
  const [voice, setVoice] = useState<TtsInfo>({});
  useEffect(() => {
    ttsDescription().then(setVoice);
    // Au retour dans l'app (après installation d'une voix), on relit le diagnostic.
    const onVisible = () => { if (document.visibilityState === 'visible') ttsDescription().then(setVoice); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    update((st) => ({ ...st, settings: { ...st.settings, [key]: value } }));
  // Voix chinoises installees, pour choisir celle des hommes et celle des femmes.
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  useEffect(() => { listChineseVoices().then(setVoices).catch(() => setVoices([])); }, []);
  const voiceLabel = (v: VoiceOption) => {
    const name = v.name.replace(/^Microsoft\s+/, '').replace(/\s+-\s+.*$/, '');
    return v.gender ? `${name} (${t(v.gender === 'male' ? 'genderMale' : 'genderFemale')})` : name;
  };

  const learned = Object.keys(state.progress).length;
  const voiceText = voice.text ?? (voice.key === 'ttsAndroid' ? t('ttsAndroid', { lang: voice.lang ?? '' }) + (voice.mainland ? ` · ${t('ttsMainland')}` : '') : voice.key ? t(voice.key) : '…');

  return (
    <div className="app settings">
      <TopBar left={<button type="button" className="icon-btn" onClick={onBack} aria-label={t('back')}><Icon name="back" /></button>} title={t('settings')} zh="設定" />
      <div className="settings-body">

      <SectionTitle zh="學習">{t('learning')}</SectionTitle>
      <div className="field">
        <label>{t('language')}</label>
        <select value={s.language} onChange={(e) => set('language', e.target.value as Settings['language'])}>
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>{t('tutorial')}</label>
        {/* Le tutoriel s'affiche des que l'etat en contient un ; a la fin (ou passe), retour au camp. */}
        <button type="button" className="chip" onClick={() => update(startTutorial)}>{t('tutorialReplay')}</button>
      </div>
      <div className="field">
        <label>{t('newPerDay')}</label>
        <input type="number" min={0} max={40} value={s.newPerDay} onChange={(e) => set('newPerDay', Math.max(0, Math.min(40, Number(e.target.value) || 0)))} />
      </div>
      <div className="field">
        <label>{t('maxReviews')}</label>
        <input type="number" min={10} max={300} value={s.maxReviews} onChange={(e) => set('maxReviews', Math.max(10, Math.min(300, Number(e.target.value) || 10)))} />
      </div>
      <div className="field">
        <label>{t('newOrder')}<span className="hint">{t('newOrderHint')}</span></label>
        <select value={s.newOrder} onChange={(e) => set('newOrder', e.target.value as Settings['newOrder'])}>
          <option value="mixte">{t('mixed')}</option>
          <option value="theme">{t('byTheme')}</option>
        </select>
      </div>
      {SKILLS.map((k) => (
        <div className="field" key={k}>
          <label>{t(SKILL_KEYS[k])}</label>
          <Switch on={s.skills[k]} onChange={(v) => set('skills', { ...s.skills, [k]: v })} />
        </div>
      ))}

      <SectionTitle zh="顯示">{t('display')}</SectionTitle>
      <div className="field"><label>{t('phonetic')}<span className="hint">{t('phoneticHint')}</span></label><Switch on={s.phonetic} onChange={(v) => set('phonetic', v)} /></div>
      {s.phonetic && (
        <div className="field">
          <label>{t('phoneticSystem')}</label>
          <select value={s.phoneticSystem} onChange={(e) => set('phoneticSystem', e.target.value as Settings['phoneticSystem'])}>
            <option value="zhuyin">{t('sysZhuyin')}</option>
            <option value="pinyin">{t('sysPinyin')}</option>
            <option value="tongyong">{t('sysTongyong')}</option>
            <option value="wadegiles">{t('sysWadegiles')}</option>
          </select>
        </div>
      )}
      <div className="field"><label>{t('pinyin')}</label><Switch on={s.showPinyin} onChange={(v) => set('showPinyin', v)} /></div>
      <div className="field"><label>{t('zhuyin')}</label><Switch on={s.showZhuyin} onChange={(v) => set('showZhuyin', v)} /></div>
      <div className="field">
        <label>{t('font')}</label>
        <select value={s.hanziFont} onChange={(e) => set('hanziFont', e.target.value as Settings['hanziFont'])}>
          <option value="sans">{t('fontSans')}</option>
          <option value="kai">{t('fontKai')}</option>
        </select>
      </div>
      <div className="field">
        <label>{t('theme')}</label>
        <select value={s.colorScheme} onChange={(e) => set('colorScheme', e.target.value as Settings['colorScheme'])}>
          <option value="auto">{t('auto')}</option>
          <option value="light">{t('light')}</option>
          <option value="dark">{t('dark')}</option>
        </select>
      </div>

      <SectionTitle zh="聲音">{t('audio')}</SectionTitle>
      <div className="field"><label>{t('autoPlay')}</label><Switch on={s.autoPlay} onChange={(v) => set('autoPlay', v)} /></div>
      <div className="field">
        <label>{t('voiceRate')}<span className="hint">{voiceText}</span></label>
        <input type="range" min={0.5} max={1.2} step={0.05} value={s.ttsRate} onChange={(e) => set('ttsRate', Number(e.target.value))} />
      </div>
      <div className="field">
        <label>{voice.canInstall ? <span className="hint">{t('ttsInstallHint')}</span> : null}</label>
        <div className="row">
          <button type="button" className="chip" onClick={() => { void speak('你好，歡迎來到台灣。', s.ttsRate).then(() => ttsDescription().then(setVoice)); }}>{t('ttsTest')}</button>
          {voice.canInstall && <button type="button" className="chip" onClick={() => { void openTtsInstall(); }}>{t('ttsInstall')}</button>}
        </div>
      </div>
      {(['male', 'female'] as const).map((role) => {
        const key = role === 'male' ? 'voiceMale' : 'voiceFemale';
        return (
          <div className="field" key={role}>
            <label>{t(key)}{role === 'male' && <span className="hint">{t('voiceRoleHint')}</span>}</label>
            <div className="row">
              <select value={s[key]} onChange={(e) => set(key, e.target.value)}>
                <option value="">{t('voiceAuto')}</option>
                {voices.map((v) => <option key={v.name} value={v.name}>{voiceLabel(v)}</option>)}
              </select>
              <button type="button" className="chip" aria-label={t('ttsTest')} onClick={() => { void speak(role === 'male' ? '你好，我是你的鄰居。' : '你好，歡迎光臨！', s.ttsRate, role); }}>▶</button>
            </div>
          </div>
        );
      })}
      <div className="field">
        <label>{t('playerVoice')}</label>
        <select value={s.playerVoice} onChange={(e) => set('playerVoice', e.target.value as Settings['playerVoice'])}>
          <option value="auto">{t('voiceDefault')}</option>
          <option value="male">{t('voiceMan')}</option>
          <option value="female">{t('voiceWoman')}</option>
        </select>
      </div>

      <SectionTitle zh="資料">{t('data')}</SectionTitle>
      <div className="field">
        <label>{t('progress')}<span className="hint">{t('wordsStarted', { n: learned })} · {platformName()}</span></label>
        <div className="row">
          <button type="button" className="chip" onClick={() => exportState(state).then((r) => toast(t(r.key, { path: r.path ?? '' }))).catch(() => toast(t('exportFailed')))}>{t('export')}</button>
          <button type="button" className="chip" onClick={() => importState().then((st) => { if (st) { update(() => st); toast(t('imported')); } })}>{t('import')}</button>
        </div>
      </div>
      <div className="field">
        <label>{t('eraseAll')}</label>
        <button type="button" className="chip" onClick={() => { if (confirm(t('confirmReset'))) { update((st) => ({ ...emptyState(), settings: st.settings })); toast(t('erased')); } }}>{t('reset')}</button>
      </div>
      {/* Mentions legales en tete des credits : la licence (GPL-3.0-or-later, section 7(b) : « Rìcháng by Nextale
          Audio » garde dans toute version distribuee) demande que le jeu les affiche lui-meme. */}
      <p className="muted small legal" style={{ marginTop: 24 }}>
        {t('legal')} <a href={REPO_URL} target="_blank" rel="noreferrer">{REPO_URL.replace(/^https:\/\//, '')}</a>
        {' · '}<a href={PRIVACY_URL} target="_blank" rel="noreferrer">{t('privacyPolicy')}</a>
      </p>
      <p className="muted small">{t('about')}</p>
      <p className="muted small credits">{t('mediaCredits')}</p>
      <details className="credits">
        <summary>{t('photoCredits')}</summary>
        <ul>
          {Object.entries(PHOTO_CREDITS).map(([id, c]) => (
            <li key={id}>
              <a href={c.page} target="_blank" rel="noreferrer">{c.title}</a> · {c.author} · {c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a> : c.license}
            </li>
          ))}
        </ul>
      </details>
      </div>
    </div>
  );
}
