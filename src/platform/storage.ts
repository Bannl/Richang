import { REPLAYS_PER_ENCOUNTER } from '../game/types';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { AppState } from '../core/types';
import { DEFAULT_SETTINGS, emptyState } from '../core/types';
import './native.d';

const KEY = 'richang-state-v1';
const FILE = 'progress.json';

export const isElectron = (): boolean => typeof window !== 'undefined' && !!window.richangNative;
export const isNative = (): boolean => Capacitor.isNativePlatform();
export const isIOS = (): boolean => Capacitor.getPlatform() === 'ios';
export const platformName = (): string => (isElectron() ? 'Windows' : isIOS() ? 'iOS' : isNative() ? 'Android' : 'Web');

export function migrate(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  const settings = { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) };
  settings.skills = { ...DEFAULT_SETTINGS.skills, ...(r.settings?.skills ?? {}) };
  const progress = r.progress ?? {};
  // Deck : cartes debloquees ; a defaut, celles deja tracees (mode ecriture reussi) ou introduites.
  const unlocked = Array.isArray(r.unlocked) ? r.unlocked.filter((n): n is number => typeof n === 'number')
    : Object.keys(progress).map(Number).filter((k) => (progress[k]?.skills?.write?.reps ?? 0) > 0 || progress[k]?.intro).sort((a, b) => a - b);
  // Run sauvegarde avec l'ancien format de rencontre (phrases a trou) : on revient a la carte, le run continue.
  let run = r.run ?? null;
  if (run?.encounter && !Array.isArray((run.encounter as { lines?: { segments?: unknown }[] }).lines?.[0]?.segments)) {
    run = { ...run, encounter: null, phase: 'map' };
  }
  // Compteur de repetitions ajoute apres coup : une rencontre en cours repart avec le plein.
  if (run?.encounter && typeof (run.encounter as { replaysLeft?: unknown }).replaysLeft !== 'number') {
    run = { ...run, encounter: { ...run.encounter, replaysLeft: REPLAYS_PER_ENCOUNTER } };
  }
  const runsPlayed = r.runsPlayed ?? 0;
  // Tutoriel : une progression d'avant le tutoriel (cartes, mots commences, runs) compte comme l'ayant vu.
  const tutorialDone = typeof r.tutorialDone === 'boolean' ? r.tutorialDone : unlocked.length > 0 || Object.keys(progress).length > 0 || runsPlayed > 0;
  return { version: 1, settings, progress, days: r.days ?? {}, unlocked, run, runsPlayed, runsWon: r.runsWon ?? 0, tutorial: migrateTutorial(r.tutorial), tutorialDone };
}

/** Tutoriel en cours sauvegarde : etape connue, et rencontre au format actuel (sinon on reprend a l'etape du trace). */
function migrateTutorial(raw: unknown): AppState['tutorial'] {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<NonNullable<AppState['tutorial']>>;
  if (t.step !== 'learn' && t.step !== 'scene' && t.step !== 'outro') return null;
  const enc = t.encounter && Array.isArray(t.encounter.lines) && Array.isArray(t.encounter.lines[0]?.segments) ? t.encounter : null;
  if (t.step === 'scene' && !enc) return { step: 'learn', encounter: null };
  return { step: t.step, encounter: enc };
}

export async function loadState(): Promise<AppState> {
  let json: string | null = null;
  try {
    if (isElectron()) json = await window.richangNative!.readState();
    else if (isNative()) {
      try {
        const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
        json = typeof r.data === 'string' ? r.data : null;
      } catch { json = null; }
    } else json = localStorage.getItem(KEY);
  } catch (e) { console.warn('Lecture de la progression impossible', e); }
  if (!json) return emptyState();
  try { return migrate(JSON.parse(json)); } catch { return emptyState(); }
}

export async function saveState(state: AppState): Promise<void> {
  const json = JSON.stringify(state);
  if (isElectron()) await window.richangNative!.writeState(json);
  else if (isNative()) await Filesystem.writeFile({ path: FILE, directory: Directory.Data, data: json, encoding: Encoding.UTF8 });
  else localStorage.setItem(KEY, json);
}

export interface ExportResult { key: 'exported' | 'exportCancelled' | 'exportedTo' | 'exportedFiles' | 'downloaded'; path?: string }

/** Exporte la progression ; renvoie une cle de message a traduire. */
export async function exportState(state: AppState): Promise<ExportResult> {
  const json = JSON.stringify(state, null, 1);
  const name = `richang-progression-${new Date().toISOString().slice(0, 10)}.json`;
  if (isElectron()) return { key: (await window.richangNative!.exportState(json)) ? 'exported' : 'exportCancelled' };
  if (isNative()) {
    const r = await Filesystem.writeFile({ path: name, directory: Directory.Documents, data: json, encoding: Encoding.UTF8 });
    // iOS : le dossier Documents de l'app est visible dans l'app Fichiers (Info.plist : UIFileSharingEnabled).
    return isIOS() ? { key: 'exportedFiles' } : { key: 'exportedTo', path: r.uri };
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { key: 'downloaded' };
}

/** Importe une progression ; renvoie le nouvel etat ou null si annule. */
export async function importState(): Promise<AppState | null> {
  if (isElectron()) {
    const json = await window.richangNative!.importState();
    return json ? migrate(JSON.parse(json)) : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try { resolve(migrate(JSON.parse(await f.text()))); } catch { resolve(null); }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
