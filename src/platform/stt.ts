import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

/** Reconnaissance vocale : sur Android et iOS (plugin natif). */
export async function sttAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try { return (await SpeechRecognition.available()).available; } catch { return false; }
}

/** Silence (ms sans nouveau resultat) qui termine l'ecoute sur iOS, et duree maximale d'une ecoute. */
const IOS_SILENCE_MS = 1200;
const IOS_MAX_MS = 8000;

export async function recognizeOnce(lang = 'zh-TW'): Promise<string[]> {
  const perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') throw new Error('Permission micro refusée');
  if (Capacitor.getPlatform() !== 'ios') {
    // Android : le moteur s'arrete seul a la fin de la phrase et renvoie ses propositions.
    const r = await SpeechRecognition.start({ language: lang, maxResults: 5, partialResults: false, popup: false });
    return r?.matches ?? [];
  }
  // iOS : le resultat final n'arrive qu'a l'arret de l'ecoute. On suit les resultats partiels et on arrete apres un
  // court silence (ou au bout de 8 s), en gardant les dernieres propositions.
  return new Promise<string[]>((resolve, reject) => {
    let matches: string[] = [];
    let done = false;
    let silence: ReturnType<typeof setTimeout> | undefined;
    const listener = SpeechRecognition.addListener('partialResults', (data: { matches?: string[] }) => {
      if (data.matches?.length) matches = data.matches;
      clearTimeout(silence);
      silence = setTimeout(() => { void finish(); }, IOS_SILENCE_MS);
    });
    const cap = setTimeout(() => { void finish(); }, IOS_MAX_MS);
    const cleanup = () => { done = true; clearTimeout(silence); clearTimeout(cap); void listener.then((h) => h.remove()); };
    async function finish() {
      if (done) return;
      cleanup();
      try { await SpeechRecognition.stop(); } catch { /* deja arrete */ }
      resolve(matches);
    }
    SpeechRecognition.start({ language: lang, maxResults: 5, partialResults: true, popup: false }).catch((e) => {
      if (done) return;
      cleanup();
      reject(e);
    });
  });
}

export async function stopRecognizing(): Promise<void> {
  try { await SpeechRecognition.stop(); } catch { /* deja arrete */ }
}
