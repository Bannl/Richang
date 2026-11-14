import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

let cachedVoice: SpeechSynthesisVoice | null | undefined;

/** Voix d'un personnage : homme ou femme (sans role : voix par defaut). */
export type VoiceRole = 'male' | 'female';
/** Voix choisies dans les reglages pour chaque role (nom de la voix, '' = automatique). */
let preferred: Record<VoiceRole, string> = { male: '', female: '' };
export function configureVoices(v: Record<VoiceRole, string>): void { preferred = { ...v }; }
/** Sans voix du bon genre installee, on modifie la hauteur de la voix disponible. */
const ROLE_PITCH: Record<VoiceRole, number> = { male: 0.7, female: 1.12 };

// Genre devine d'apres le nom de la voix : Windows (Zhiwei, Hanhan, Yating...), Apple (Li-Mu ; Mei-Jia, Ting-Ting,
// Sin-Ji, Yu-Shu), Samsung (SMTm/SMTf), Google sur Android (cmn-xx-x-ccd / ctd : voix d'homme ; ccc, cce, ctc, cte,
// ssa : voix de femme, a confirmer dans les reglages).
const MALE_RE = /zhiwei|yunjhe|yunxi|yunyang|yunjian|yunye|yunze|yunhao|kangkang|li-?mu|\bmale\b|男|smtm\d|-x-c[ct]d-/i;
const FEMALE_RE = /hanhan|yating|hsiao|huihui|yaoyao|xiaoxiao|xiaoyi|mei-?jia|ting-?ting|sin-?ji|yu-?shu|female|女|smtf\d|-x-(c[ct][ce]|ssa)-|google/i;
/** L'ecran d'installation des voix (Reglages › Synthese vocale) n'existe que sur Android. */
const canOpenTtsInstall = Capacitor.getPlatform() === 'android';
export function guessGender(name: string): VoiceRole | null {
  if (MALE_RE.test(name)) return 'male';
  if (FEMALE_RE.test(name)) return 'female';
  return null;
}

/** Voix chinoises proposees dans les reglages (nom, langue, genre devine). */
export interface VoiceOption { name: string; lang: string; gender: VoiceRole | null }

// --- Android natif : la langue demandée doit être réellement disponible dans le moteur vocal du téléphone ---
// Le plugin refuse de parler si la langue n'est pas installée (ex. tablette sans voix « chinois (Taïwan) ») :
// on choisit donc la meilleure variante chinoise disponible, et on réessaie tant que le moteur s'initialise.
const ZH_CANDIDATES = ['zh-TW', 'zh-Hant-TW', 'cmn-Hant-TW', 'cmn-TW', 'zh-Hant', 'zh-CN', 'cmn-Hans-CN', 'zh-Hans-CN', 'cmn-CN', 'zh-Hans', 'cmn', 'zh'];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function scoreTag(tag: string): number {
  const t = tag.toLowerCase().replace(/_/g, '-');
  if (t.startsWith('yue') || /-(hk|mo)$/.test(t)) return 0; // cantonais : lirait le texte en cantonais
  if (/^(zh|cmn)(-hant)?-tw$/.test(t)) return 40;
  if (t.includes('hant')) return 30;
  if (/^(zh|cmn)(-hans)?-cn$/.test(t)) return 20;
  if (t.includes('hans') || t === 'cmn' || t === 'zh') return 15;
  if (t.startsWith('zh') || t.startsWith('cmn')) return 10;
  return 0;
}

/** Langue chinoise retenue sur Android : undefined = pas encore déterminée, null = aucune voix chinoise. */
let nativeLang: string | null | undefined;
let nativeLangPromise: Promise<string | null> | null = null;

async function resolveNativeLang(): Promise<{ lang: string | null; definitive: boolean }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const { languages } = await TextToSpeech.getSupportedLanguages();
      const list = languages ?? [];
      if (list.length) {
        const ranked = [...new Set([...list, ...ZH_CANDIDATES])]
          .map((tag) => ({ tag, s: scoreTag(tag) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s);
        for (const { tag } of ranked) {
          try { if ((await TextToSpeech.isLanguageSupported({ lang: tag })).supported) return { lang: tag, definitive: true }; } catch { /* suivante */ }
        }
        return { lang: null, definitive: true }; // moteur prêt, mais aucune voix chinoise installée
      }
    } catch { /* moteur pas encore initialisé */ }
    await sleep(500);
  }
  return { lang: null, definitive: false };
}

/** Meilleure langue chinoise disponible sur Android (mise en cache ; re-détectée si le moteur n'était pas prêt). */
export function nativeChineseLang(): Promise<string | null> {
  if (nativeLang !== undefined) return Promise.resolve(nativeLang);
  if (!nativeLangPromise) {
    nativeLangPromise = resolveNativeLang().then(({ lang, definitive }) => {
      if (definitive) nativeLang = lang;
      nativeLangPromise = null;
      return lang;
    });
  }
  return nativeLangPromise;
}

/** Oublie la langue détectée (après installation d'une voix, retour dans l'app). */
export function resetNativeLang(): void { nativeLang = undefined; nativeLangPromise = null; }

/** Ouvre l'écran Android d'installation des données vocales. */
export async function openTtsInstall(): Promise<void> {
  resetNativeLang();
  try { await TextToSpeech.openInstall(); } catch { /* écran indisponible sur cet appareil */ }
}

if (Capacitor.isNativePlatform()) {
  void nativeChineseLang(); // détection anticipée, pendant que l'accueil s'affiche
  // Au retour dans l'app (après installation d'une voix), on re-détecte si aucune langue n'avait été trouvée.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && nativeLang === null) resetNativeLang(); });
}

/** Voix Android (index dans la liste du plugin), filtrees sur le chinois ; voix locales d'abord. */
let nativeVoices: { name: string; lang: string; index: number; local: boolean }[] | null = null;
async function loadNativeVoices(): Promise<{ name: string; lang: string; index: number; local: boolean }[]> {
  if (nativeVoices) return nativeVoices;
  try {
    const { voices } = await TextToSpeech.getSupportedVoices();
    nativeVoices = (voices ?? []).map((v, index) => ({ name: v.name, lang: v.lang, index, local: v.localService }))
      .filter((v) => scoreTag(v.lang) > 0)
      .sort((a, b) => scoreTag(b.lang) - scoreTag(a.lang) || Number(b.local) - Number(a.local));
  } catch { return []; }
  return nativeVoices;
}

/** Voix et hauteur pour un role sur Android : voix choisie, sinon voix du bon genre dans la meme langue, sinon hauteur modifiee. */
async function nativeVoiceFor(role: VoiceRole | null | undefined, lang: string): Promise<{ voice?: number; pitch: number }> {
  if (!role) return { pitch: 1 };
  const all = await loadNativeVoices();
  const chosen = preferred[role] ? all.find((v) => v.name === preferred[role]) : undefined;
  if (chosen) return { voice: chosen.index, pitch: 1 };
  const match = all.filter((v) => scoreTag(v.lang) === scoreTag(lang)).find((v) => guessGender(v.name) === role);
  if (match) return { voice: match.index, pitch: 1 };
  return { pitch: ROLE_PITCH[role] };
}

async function speakNative(text: string, rate: number, role?: VoiceRole | null): Promise<void> {
  const lang = await nativeChineseLang();
  if (!lang) return; // aucune voix chinoise : le diagnostic est affiché dans les réglages
  const { voice, pitch } = await nativeVoiceFor(role, lang);
  try { await TextToSpeech.stop(); } catch { /* rien à arrêter */ }
  for (let attempt = 0; attempt < 4; attempt++) {
    try { await TextToSpeech.speak({ text, lang, rate, pitch, volume: 1, ...(voice !== undefined ? { voice } : {}) }); return; }
    catch (e) {
      const err = e as { code?: string; message?: string };
      const msg = String(err?.message ?? e);
      if (/not supported/i.test(msg)) { resetNativeLang(); return; } // la langue a disparu : re-détection au prochain appel
      if (err?.code === 'UNAVAILABLE' || /initiali[sz]ed|unavailable|not available/i.test(msg)) { await sleep(400); continue; }
      return; // erreur de lecture ponctuelle : on n'insiste pas
    }
  }
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase().replace('_', '-');
  const name = v.name.toLowerCase();
  if (lang === 'zh-tw') return 30 + (/hanhan|yating|hsiaochen|hsiaoyu|zhiwei/.test(name) ? 5 : 0) + (name.includes('natural') ? 2 : 0);
  if (lang.startsWith('zh-hant')) return 20;
  if (lang === 'zh-cn' || lang === 'zh' || lang.startsWith('cmn')) return 10;
  if (lang.startsWith('zh')) return 5; // zh-HK (cantonais) en tout dernier recours
  return 0;
}

async function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const vs = speechSynthesis.getVoices();
  if (vs.length) return vs;
  return new Promise((resolve) => {
    const done = () => { speechSynthesis.removeEventListener('voiceschanged', done); resolve(speechSynthesis.getVoices()); };
    speechSynthesis.addEventListener('voiceschanged', done);
    setTimeout(done, 1500);
  });
}

export async function getVoice(): Promise<SpeechSynthesisVoice | null> {
  if (cachedVoice !== undefined) return cachedVoice;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;
  for (const v of await voicesReady()) {
    const s = scoreVoice(v);
    if (s > bestScore) { best = v; bestScore = s; }
  }
  cachedVoice = best;
  return best;
}

/** Voix du navigateur pour un role : voix choisie, sinon la meilleure du bon genre, sinon la meilleure voix et une hauteur modifiee. */
async function webVoiceFor(role?: VoiceRole | null): Promise<{ voice: SpeechSynthesisVoice | null; pitch: number }> {
  const best = await getVoice();
  if (!role) return { voice: best, pitch: 1 };
  const all = (await voicesReady()).filter((v) => scoreVoice(v) > 0).sort((a, b) => scoreVoice(b) - scoreVoice(a));
  const chosen = preferred[role] ? all.find((v) => v.name === preferred[role]) : undefined;
  if (chosen) return { voice: chosen, pitch: 1 };
  const top = best ? scoreVoice(best) : 0;
  const match = all.find((v) => guessGender(v.name) === role && scoreVoice(v) >= top - 5) ?? all.find((v) => guessGender(v.name) === role);
  if (match) return { voice: match, pitch: 1 };
  return { voice: best, pitch: ROLE_PITCH[role] };
}

/** Voix chinoises installees (reglages : choix de la voix des hommes et des femmes). */
export async function listChineseVoices(): Promise<VoiceOption[]> {
  if (Capacitor.isNativePlatform()) {
    const lang = await nativeChineseLang();
    const all = await loadNativeVoices();
    const top = lang ? scoreTag(lang) : 0;
    return all.filter((v) => !lang || scoreTag(v.lang) >= top - 10).map((v) => ({ name: v.name, lang: v.lang, gender: guessGender(v.name) }));
  }
  if (!('speechSynthesis' in window)) return [];
  return (await voicesReady()).filter((v) => scoreVoice(v) >= 10).sort((a, b) => scoreVoice(b) - scoreVoice(a)).map((v) => ({ name: v.name, lang: v.lang, gender: guessGender(v.name) }));
}

export interface TtsInfo { key?: 'ttsAndroid' | 'ttsUnavailable' | 'ttsNoVoice'; text?: string; lang?: string; mainland?: boolean; canInstall?: boolean }

export async function ttsDescription(): Promise<TtsInfo> {
  if (Capacitor.isNativePlatform()) {
    const lang = await nativeChineseLang();
    if (!lang) return { key: 'ttsNoVoice', canInstall: canOpenTtsInstall };
    return { key: 'ttsAndroid', lang, mainland: scoreTag(lang) < 30, canInstall: canOpenTtsInstall && scoreTag(lang) < 30 };
  }
  if (!('speechSynthesis' in window)) return { key: 'ttsUnavailable' };
  const v = await getVoice();
  return v ? { text: `${v.name} (${v.lang})` } : { key: 'ttsNoVoice' };
}

export async function speak(text: string, rate = 0.9, role?: VoiceRole | null): Promise<void> {
  if (Capacitor.isNativePlatform()) return speakNative(text, rate, role);
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const { voice, pitch } = await webVoiceFor(role);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'zh-TW';
  u.rate = rate;
  u.pitch = pitch;
  if (voice) u.voice = voice;
  await new Promise<void>((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking(): void {
  if (Capacitor.isNativePlatform()) { TextToSpeech.stop().catch(() => {}); return; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export interface SpeakSyncHandle { cancel(): void; done: Promise<void> }

/**
 * Lit un texte en signalant la progression (index du caractere en cours) : evenements de frontiere
 * du navigateur quand ils existent, sinon estimation (les caracteres chinois durent ~0,33 s a vitesse 1).
 */
export function speakSync(text: string, rate: number, onProgress: (charIndex: number) => void, role?: VoiceRole | null): SpeakSyncHandle {
  const chars = [...text];
  const perChar = 330 / Math.max(0.4, rate);
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 120;
  chars.forEach((c, i) => {
    if (!/\p{Script=Han}/u.test(c)) { t += /[，,、]/.test(c) ? 260 : /[。！？.!?]/.test(c) ? 380 : 0; return; }
    timers.push(setTimeout(() => { if (!cancelled) onProgress(i); }, t));
    t += perChar;
  });
  const estimated = new Promise<void>((resolve) => timers.push(setTimeout(resolve, t + 150)));

  if (Capacitor.isNativePlatform() || !('speechSynthesis' in window)) {
    void speak(text, rate, role);
    return { cancel: () => { cancelled = true; timers.forEach(clearTimeout); stopSpeaking(); }, done: estimated };
  }

  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = rate;
  const spoken = new Promise<void>((resolve) => {
    webVoiceFor(role).then(({ voice, pitch }) => {
      if (cancelled) return resolve();
      utter.lang = voice?.lang ?? 'zh-TW';
      utter.pitch = pitch;
      if (voice) utter.voice = voice;
      utter.onboundary = (e) => { if (!cancelled && typeof e.charIndex === 'number') onProgress(Math.min(chars.length - 1, e.charIndex)); };
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      speechSynthesis.speak(utter);
    });
  });
  return {
    cancel: () => { cancelled = true; timers.forEach(clearTimeout); speechSynthesis.cancel(); },
    // Garde-fou : une voix qui ne signale jamais sa fin (onglet masque, voix absente) ne doit pas bloquer le jeu.
    done: Promise.race([Promise.all([spoken, estimated]), new Promise<void>((resolve) => timers.push(setTimeout(resolve, t + 6000)))]).then(() => undefined),
  };
}
