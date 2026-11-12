import credits from '../assets/bg/credits.json';

/** Photos de lieux a Taiwan (Wikimedia Commons), une par situation, plus l'ecran d'accueil (« home »). */
const files = import.meta.glob('../assets/bg/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const BACKGROUNDS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([p, url]) => [p.replace(/^.*\/([^/]+)\.webp$/, '$1'), url]),
);

/** Lieux sans photo propre : un lieu proche sert de decor. */
const STAND_IN: Record<string, string> = {
  'family-dinner': 'daily-life',
  'hardware-store': 'neighbors',
  'moving-in': 'landlord',
  utilities: 'landlord',
};

export function backgroundFor(id: string): string | undefined {
  return BACKGROUNDS[id] ?? (STAND_IN[id] ? BACKGROUNDS[STAND_IN[id]] : undefined);
}

export interface PhotoCredit { title: string; page: string; author: string; license: string; licenseUrl: string }
/** Attributions des photos (licences CC BY / CC BY-SA : auteur, licence et lien obligatoires). */
export const PHOTO_CREDITS = credits as Record<string, PhotoCredit>;
