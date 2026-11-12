import { useEffect, useState } from 'react';

/** Telephone en paysage (hauteur de fenetre reduite) : mise en page compacte. */
export const PHONE_QUERY = '(max-height: 560px)';

export function useMediaQuery(query: string): boolean {
  const read = () => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Ecran tactile (telephone, tablette) : cases d'ecriture agrandies au maximum, une a la fois. */
export const TOUCH_QUERY = '(pointer: coarse)';
