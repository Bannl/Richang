/**
 * Portraits des interlocuteurs : illustrations generees avec Google Gemini, une image par emotion (neutre, joyeux,
 * choque, perplexe, fache, curieux), fond transparent : src/assets/portraits/<situation>-<emotion>.webp
 * (import : scripts/import-portraits.mjs). Quand une expression manque, l'image la plus proche est montree avec des
 * marques animees de l'emotion par-dessus (sueur, « ! », « ? », etincelles, veine). Un personnage dont l'image
 * n'est pas encore prete apparait en silhouette mystere.
 */

export type Emotion = 'neutral' | 'happy' | 'laugh' | 'surprised' | 'shocked' | 'angry' | 'confused' | 'embarrassed' | 'curious' | 'stern';

/** Trait de personnalite dominant : il dicte la pose au repos et les reactions du personnage. */
export type Trait = 'cheerful' | 'chatty' | 'laidback' | 'energetic' | 'grumpy' | 'gentle' | 'stern' | 'nervous' | 'proud' | 'shy';

interface CharacterSpec {
  /** Voix et portrait de femme. */
  female?: boolean;
  trait: Trait;
}

/** Un personnage par situation (meme cle que les situations du run). */
export const CHARACTERS: Record<string, CharacterSpec> = {
  greetings: { trait: 'cheerful' },
  'small-talk': { female: true, trait: 'chatty' },
  'daily-life': { trait: 'laidback' },
  'convenience-store': { trait: 'energetic' },
  'night-market': { trait: 'grumpy' },
  'drink-shop': { female: true, trait: 'cheerful' },
  mrt: { female: true, trait: 'gentle' },
  taxi: { trait: 'chatty' },
  landlord: { trait: 'stern' },
  neighbors: { female: true, trait: 'chatty' },
  clinic: { trait: 'gentle' },
  office: { female: true, trait: 'nervous' },
  classroom: { female: true, trait: 'energetic' },
  'family-dinner': { female: true, trait: 'gentle' },
  weather: { trait: 'grumpy' },
  bank: { trait: 'proud' },
  'hardware-store': { trait: 'laidback' },
  'moving-in': { trait: 'energetic' },
  utilities: { trait: 'grumpy' },
  airport: { female: true, trait: 'cheerful' },
  directions: { female: true, trait: 'shy' },
  'scooter-rental': { trait: 'proud' },
  'post-office': { female: true, trait: 'stern' },
  pharmacy: { female: true, trait: 'shy' },
  dentist: { trait: 'cheerful' },
  gym: { trait: 'energetic' },
  hiking: { trait: 'cheerful' },
  beach: { trait: 'laidback' },
  'making-friends': { female: true, trait: 'chatty' },
  'job-interview': { female: true, trait: 'stern' },
  library: { female: true, trait: 'grumpy' },
  'clothes-shopping': { trait: 'proud' },
  market: { female: true, trait: 'cheerful' },
  residency: { trait: 'stern' },
};

/**
 * Reactions selon le trait : bonne carte ; erreur (le personnage ne comprend pas : perplexe ou choque, la premiere
 * expression a la 1re erreur, puis en alternance) ; replique exclamative.
 */
export const TRAIT_REACTIONS: Record<Trait, { correct: Emotion; wrong: Emotion; wrong2: Emotion; exclaim: Emotion }> = {
  cheerful: { correct: 'laugh', wrong: 'confused', wrong2: 'shocked', exclaim: 'happy' },
  chatty: { correct: 'laugh', wrong: 'shocked', wrong2: 'confused', exclaim: 'happy' },
  laidback: { correct: 'happy', wrong: 'confused', wrong2: 'shocked', exclaim: 'neutral' },
  energetic: { correct: 'happy', wrong: 'shocked', wrong2: 'confused', exclaim: 'happy' },
  grumpy: { correct: 'happy', wrong: 'confused', wrong2: 'shocked', exclaim: 'angry' },
  gentle: { correct: 'happy', wrong: 'confused', wrong2: 'shocked', exclaim: 'happy' },
  stern: { correct: 'happy', wrong: 'confused', wrong2: 'shocked', exclaim: 'neutral' },
  nervous: { correct: 'happy', wrong: 'shocked', wrong2: 'confused', exclaim: 'shocked' },
  proud: { correct: 'happy', wrong: 'shocked', wrong2: 'confused', exclaim: 'neutral' },
  shy: { correct: 'happy', wrong: 'confused', wrong2: 'shocked', exclaim: 'neutral' },
};

/** Nom du trait (masculin / feminin en francais). */
const TRAIT_LABEL: Record<Trait, { en: string; fr: [string, string] }> = {
  cheerful: { en: 'Cheerful', fr: ['Jovial', 'Joviale'] },
  chatty: { en: 'Chatty', fr: ['Bavard', 'Bavarde'] },
  laidback: { en: 'Laid-back', fr: ['Décontracté', 'Décontractée'] },
  energetic: { en: 'Energetic', fr: ['Énergique', 'Énergique'] },
  grumpy: { en: 'Grumpy', fr: ['Grincheux', 'Grincheuse'] },
  gentle: { en: 'Kind', fr: ['Bienveillant', 'Bienveillante'] },
  stern: { en: 'Stern', fr: ['Sévère', 'Sévère'] },
  nervous: { en: 'Nervous', fr: ['Anxieux', 'Anxieuse'] },
  proud: { en: 'Proud', fr: ['Fier', 'Fière'] },
  shy: { en: 'Shy', fr: ['Timide', 'Timide'] },
};

export const characterTrait = (id: string): Trait => CHARACTERS[id]?.trait ?? 'cheerful';
export function traitLabel(id: string, lang: 'en' | 'fr'): string {
  const l = TRAIT_LABEL[characterTrait(id)];
  return lang === 'en' ? l.en : l.fr[CHARACTERS[id]?.female ? 1 : 0];
}

/** Voix d'un personnage : femme ou homme selon son portrait. */
export const characterVoice = (id: string): 'male' | 'female' => (CHARACTERS[id]?.female ? 'female' : 'male');

/** Humeur au repos : la pose neutre du portrait porte deja le trait du personnage. */
export const restingMood = (_id: string): Emotion => 'neutral';

// ---------------------------------------------------------------- images par emotion
type ImageEmotion = 'neutral' | 'happy' | 'shocked' | 'confused' | 'angry' | 'curious';
const FILES = import.meta.glob('../assets/portraits/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const IMAGES: Record<string, Partial<Record<ImageEmotion, string>>> = {};
for (const [file, url] of Object.entries(FILES)) {
  const m = file.match(/\/([^/]+)-(neutral|happy|shocked|confused|angry|curious)\.webp$/);
  if (m) (IMAGES[m[1]] ??= {})[m[2] as ImageEmotion] = url;
}
/** Emotion du jeu -> image disponible (la neutre a defaut). */
const IMAGE_OF: Record<Emotion, ImageEmotion> = {
  neutral: 'neutral', curious: 'curious', stern: 'neutral', happy: 'happy', laugh: 'happy',
  surprised: 'shocked', shocked: 'shocked', confused: 'confused', embarrassed: 'confused', angry: 'angry',
};
/** Image de secours quand une expression manque encore : la plus proche, sinon la neutre. */
const NEAR: Partial<Record<ImageEmotion, ImageEmotion>> = { angry: 'confused', curious: 'neutral', confused: 'neutral', shocked: 'confused', happy: 'neutral' };

/** Charge et decode d'avance les expressions d'un personnage : le changement d'emotion est instantane, sans trou. */
const preloaded = new Map<string, HTMLImageElement[]>();
export function preloadPortrait(id: string): void {
  const images = IMAGES[id];
  if (!images || preloaded.has(id)) return;
  preloaded.set(id, Object.values(images).map((url) => {
    const img = new Image();
    img.src = url!;
    img.decode().catch(() => {});
    return img;
  }));
  if (preloaded.size > 3) preloaded.delete(preloaded.keys().next().value!);
}

// ---------------------------------------------------------------- marques animees (repere 240 x 260)
type Mark = 'sweat' | 'sweat2' | 'vein' | 'question' | 'bang' | 'sparkle';
const MARKS: Record<Emotion, Mark[]> = {
  neutral: [], curious: [], stern: [], happy: [],
  laugh: ['sparkle'], surprised: ['bang'], shocked: ['sweat', 'sweat2', 'bang'],
  angry: ['vein'], confused: ['sweat', 'question'], embarrassed: ['sweat', 'sweat2'],
};
const INK = '#2b1d1b';

function Marks({ marks }: { marks: Mark[] }) {
  return (
    <g>
      {marks.includes('sweat') && (
        <g className="pt-sweat">
          <path d="M 178 58 C 185 70 188 77 185 83 C 182 89 174 88 173 81 C 172 75 175 68 178 58 Z" fill="#c4e8ff" stroke="#2f6b98" strokeWidth={1.7} strokeLinejoin="round" />
          <path d="M 176.5 76 C 176 72 177 69 178.5 66" stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </g>
      )}
      {marks.includes('sweat2') && (
        <g className="pt-sweat late">
          <path d="M 58 66 C 51 76 49 82 52 87 C 55 92 62 90 63 84 C 64 79 61 73 58 66 Z" fill="#c4e8ff" stroke="#2f6b98" strokeWidth={1.7} strokeLinejoin="round" />
          <path d="M 200 96 C 205 103 207 107 205 111 C 203 114 198 113 197.5 109 C 197 106 198.5 101 200 96 Z" fill="#c4e8ff" stroke="#2f6b98" strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      )}
      {marks.includes('vein') && (
        <path className="pt-vein" d="M 156 46 Q 161 52 167 49 M 172 45 Q 167 51 171 57 M 169 62 Q 163 57 157 61 M 153 57 Q 159 53 155 47" stroke="#d6283c" strokeWidth={3.2} fill="none" strokeLinecap="round" />
      )}
      {marks.includes('question') && (
        <text x={192} y={52} fontSize={40} fontWeight={900} fill={INK} stroke="#fff" strokeWidth={5} paintOrder="stroke" fontFamily="Arial, sans-serif" className="pt-pop">?</text>
      )}
      {marks.includes('bang') && (
        <text x={196} y={50} fontSize={42} fontWeight={900} fill="#d6283c" stroke="#fff" strokeWidth={5} paintOrder="stroke" fontFamily="Arial, sans-serif" className="pt-pop">!</text>
      )}
      {marks.includes('sparkle') && (
        <g fill="#f5c542" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" className="pt-pop">
          <path d="M 44 54 L 47 63 L 56 66 L 47 69 L 44 78 L 41 69 L 32 66 L 41 63 Z" />
          <path d="M 198 82 L 200 88 L 206 90 L 200 92 L 198 98 L 196 92 L 190 90 L 196 88 Z" />
        </g>
      )}
    </g>
  );
}

/** Silhouette d'un personnage dont le portrait n'est pas encore pret. */
const SILHOUETTE = 'M 120 34 C 148 34 166 56 166 88 C 166 112 156 132 142 144 L 142 156 C 176 162 206 178 220 214 L 230 260 L 10 260 L 20 214 C 34 178 64 162 98 156 L 98 144 C 84 132 74 112 74 88 C 74 56 92 34 120 34 Z';

interface PortraitProps {
  id: string;
  emotion?: Emotion;
  /** Le personnage parle : le portrait s'anime. */
  talking?: boolean;
  /** Bulle de reaction pres de la tete (« ? » perplexe, « !? » choque) ; une nouvelle cle la fait resurgir. */
  bubble?: { mark: string; key: number } | null;
  className?: string;
}

/** Bulle de reaction : elle surgit, oscille, puis s'efface (animation CSS de la duree d'une reaction). */
function Bubble({ bubble }: { bubble: { mark: string; key: number } | null | undefined }) {
  if (!bubble) return null;
  return <span key={bubble.key} className={`pt-bubble ${bubble.mark === '?' ? 'q' : 'x'}`}>{bubble.mark}</span>;
}

/** Portrait d'un interlocuteur : image de l'emotion (sinon neutre), marques animees par-dessus. */
export function Portrait({ id, emotion, talking = false, bubble, className = '' }: PortraitProps) {
  const emo = emotion ?? restingMood(id);
  const images = IMAGES[id];
  const marks = MARKS[emo];
  const overlay = <svg className="pt-marks" viewBox="0 0 240 260" preserveAspectRatio="xMidYMin meet"><Marks marks={marks} /></svg>;
  if (!images?.neutral) {
    return (
      <div className={`portrait pending emo-${emo} ${className}`} aria-hidden="true">
        <svg viewBox="0 0 240 260" preserveAspectRatio="xMidYMax meet">
          <path d={SILHOUETTE} className="pt-silhouette" />
          <text x={120} y={112} textAnchor="middle" className="pt-unknown">?</text>
        </svg>
        {overlay}
        <Bubble key={bubble?.key} bubble={bubble} />
      </div>
    );
  }
  const want = IMAGE_OF[emo];
  const near = NEAR[want];
  const exact = images[want];
  const src = exact ?? (near ? images[near] : undefined) ?? images.neutral;
  // L'expression dessinee se suffit (gouttes, traits de choc deja dans l'image) : les marques ne servent qu'a
  // signaler l'emotion quand on retombe sur une image voisine.
  // Le cadre epouse l'image : la bulle se place par rapport au personnage, quelle que soit la largeur du decor.
  return (
    <div className={`portrait raster emo-${emo} ${talking ? 'talking' : ''} ${className}`} aria-hidden="true">
      <div className="pt-frame">
        <img key={src} src={src} alt="" draggable={false} />
        {exact ? null : overlay}
        <Bubble key={bubble?.key} bubble={bubble} />
      </div>
    </div>
  );
}
