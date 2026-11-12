import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

/** Reconnaissance vocale : disponible sur Android uniquement (plugin natif). */
export async function sttAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try { return (await SpeechRecognition.available()).available; } catch { return false; }
}

export async function recognizeOnce(lang = 'zh-TW'): Promise<string[]> {
  const perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') throw new Error('Permission micro refusée');
  const r = await SpeechRecognition.start({ language: lang, maxResults: 5, partialResults: false, popup: false });
  return r?.matches ?? [];
}

export async function stopRecognizing(): Promise<void> {
  try { await SpeechRecognition.stop(); } catch { /* deja arrete */ }
}
