import { SCENES } from '../data/scenes';
import { TUTORIAL_SCENE } from '../data/tutorial';
import { decodeSegment, loadTT, type TTCodec, type TTFile } from './tt';
import { speak, speakSync, stopSpeaking, type SpeakSyncHandle, type VoiceRole } from './tts';

/**
 * Doublage pre-enregistre au format TT (TT File Format, draft 0.3) : un fichier Ogg Opus par personnage,
 * public/voices/<situation>.opus, et un par voix du joueur, player-f / player-m. Chaque replique est un segment du
 * fichier, nomme <scene>-<ligne>-<n|f|m> ; la liste des segments est dans le fichier lui-meme. Le jeu ouvre le fichier
 * du personnage (ou du joueur), y cherche le segment de la replique et ne decode que lui. Sans segment, la synthese
 * vocale de l'appareil prend le relais.
 */
interface Manifest { files: Record<string, Partial<Record<TTCodec, string>>> }
let manifest: Manifest | null = null;
let loading: Promise<Manifest | null> | null = null;
/** Format des voix livrees avec le jeu (Opus retenu face a Vorbis : fichiers plus legers, meme rendu). */
const codec: TTCodec = 'opus';

/** Situation de chaque scene (le personnage qui parle, donc son fichier), scene du tutoriel comprise. */
const sceneSituation = new Map<string, string>();
for (const [situation, scenes] of Object.entries(SCENES)) for (const sc of scenes) sceneSituation.set(sc.id, situation);
sceneSituation.set(TUTORIAL_SCENE.id, TUTORIAL_SCENE.situation);

export function loadVoiceIndex(): Promise<Manifest | null> {
  if (manifest) return Promise.resolve(manifest);
  loading ??= fetch('./voices/tt.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((m: Manifest | null) => (manifest = m && typeof m.files === 'object' ? m : null));
  return loading;
}
void loadVoiceIndex();

/** Replique doublee : fichier TT et nom de son segment. */
export interface DubRef { file: string; name: string }

/** Segment d'une replique de scene (null : pas de doublage pour elle). */
export function dubKey(lineKey: string | undefined, speaker: 'enemy' | 'player', playerVoice: 'auto' | 'male' | 'female'): DubRef | null {
  if (!lineKey || !manifest) return null;
  const v = speaker === 'enemy' ? 'n' : playerVoice === 'male' ? 'm' : 'f';
  const fileId = speaker === 'enemy' ? sceneSituation.get(lineKey.replace(/-\d+$/, '')) : `player-${v}`;
  const file = fileId ? manifest.files[fileId]?.[codec] : undefined;
  return file ? { file, name: `${lineKey}-${v}` } : null;
}

const files = new Map<string, Promise<TTFile>>();
function openTT(file: string): Promise<TTFile> {
  let p = files.get(file);
  if (!p) {
    p = loadTT(`./voices/${file}`);
    p.catch((e) => { console.warn('Voix TT illisible', file, e); files.delete(file); });
    files.set(file, p);
  }
  return p;
}

/** Precharge les fichiers d'une rencontre : le personnage et la voix du joueur. */
export function preloadVoices(situation: string, playerVoice: 'auto' | 'male' | 'female'): void {
  void loadVoiceIndex().then(() => {
    const m = manifest;
    if (!m) return;
    for (const id of [situation, `player-${playerVoice === 'male' ? 'm' : 'f'}`]) {
      const file = m.files[id]?.[codec];
      if (file) openTT(file).catch(() => {});
    }
  });
}

/** Caracteres chinois d'un texte (ponctuation et espaces ignores), pour comparer une replique a son enregistrement. */
const hanOnly = (s: string) => [...s].filter((c) => /\p{Script=Han}/u.test(c)).join('');

/**
 * Segments decodes recemment (les repliques reviennent : repetitions, bulles de l'historique). Un segment dont le texte
 * enregistre (TEXT_ZH) n'est plus celui de la replique (replique corrigee depuis le doublage) n'est pas joue : la
 * synthese vocale prend le relais jusqu'au prochain doublage.
 */
const buffers = new Map<string, Promise<AudioBuffer | null>>();
function segmentBuffer(ref: DubRef, text: string): Promise<AudioBuffer | null> {
  const key = `${ref.file}#${ref.name}`;
  let p = buffers.get(key);
  if (!p) {
    p = openTT(ref.file).then((f) => {
      const seg = f.byName.get(ref.name);
      if (!seg) return null;
      const recorded = seg.fields?.TEXT_ZH;
      if (recorded && hanOnly(recorded) !== hanOnly(text)) return null;
      return decodeSegment(f, seg);
    });
    p.catch(() => buffers.delete(key));
    buffers.set(key, p);
    if (buffers.size > 48) buffers.delete(buffers.keys().next().value!);
  }
  return p;
}

let ctx: AudioContext | null = null;
function audioContext(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
// Le contexte audio demarre a la premiere interaction (regle d'autolecture des navigateurs).
if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => { audioContext(); }, { once: true, capture: true });
// iOS (WebKit, API Audio Session) : les voix jouent meme quand l'iPhone est en mode silencieux, comme une app de
// musique ; sans cela, Web Audio se tait des que le bouton silencieux est active. Absent ailleurs : rien a faire.
const audioSession = typeof navigator !== 'undefined' ? (navigator as Navigator & { audioSession?: { type: string } }).audioSession : undefined;
if (audioSession) { try { audioSession.type = 'playback'; } catch { /* type refuse : comportement par defaut */ } }

let current: AudioBufferSourceNode | null = null;
function stopCurrent() {
  try { current?.stop(); } catch { /* deja arrete */ }
  current = null;
}

/**
 * Les repliques doublees sont jouees telles qu'enregistrees : ni ralenties ni accelerees (un essai d'etirement temporel
 * sans changement de hauteur craquelait ; les gens parlent parfois vite, on s'y fait). Le reglage de vitesse ne regle
 * que la synthese vocale.
 */
function play(buf: AudioBuffer, onEnded: () => void): AudioBufferSourceNode {
  stopSpeaking();
  stopCurrent();
  const c = audioContext();
  const node = c.createBufferSource();
  node.buffer = buf;
  node.connect(c.destination);
  node.onended = () => { if (current === node) current = null; onEnded(); };
  node.start();
  current = node;
  return node;
}

/**
 * Lit une replique doublee en signalant la progression (index du caractere en cours, estime au prorata de la duree,
 * pauses plus longues a la ponctuation) ; sans doublage, ou si la lecture echoue, synthese vocale.
 */
export function speakLine(text: string, rate: number, onProgress: (charIndex: number) => void, role: VoiceRole | null, ref: DubRef | null): SpeakSyncHandle {
  if (!ref) return speakSync(text, rate, onProgress, role);
  stopSpeaking();
  stopCurrent();
  const chars = [...text];
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;
  let node: AudioBufferSourceNode | null = null;
  let fallback: SpeakSyncHandle | null = null;
  const done = new Promise<void>((resolve) => {
    const toTts = () => {
      if (cancelled || fallback) return;
      fallback = speakSync(text, rate, onProgress, role);
      fallback.done.then(resolve);
    };
    segmentBuffer(ref, text).then((buf) => {
      if (cancelled) { resolve(); return; }
      if (!buf) { toTts(); return; }
      node = play(buf, resolve);
      const weights: number[] = chars.map((c) => (/\p{Script=Han}/u.test(c) ? 1 : /[，,、；;：:]/.test(c) ? 0.8 : 0));
      const total = weights.reduce((a, b) => a + b, 0) || 1;
      const dur = buf.duration * 1000;
      let acc = 0;
      chars.forEach((c, i) => {
        if (/\p{Script=Han}/u.test(c)) timers.push(setTimeout(() => { if (!cancelled) onProgress(i); }, (acc / total) * dur * 0.92));
        acc += weights[i];
      });
    }, toTts);
  });
  return {
    cancel: () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (node && current === node) stopCurrent();
      fallback?.cancel();
    },
    done,
  };
}

/** Rejoue une replique (bulles de la conversation) : voix enregistree si disponible, sinon synthese. */
export function playLine(text: string, rate: number, role: VoiceRole | null, ref: DubRef | null): void {
  if (!ref) { void speak(text, rate, role); return; }
  segmentBuffer(ref, text).then((buf) => {
    if (buf) play(buf, () => {});
    else void speak(text, rate, role);
  }, () => { void speak(text, rate, role); });
}
