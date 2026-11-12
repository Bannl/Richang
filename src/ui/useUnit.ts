import { useEffect, useState } from 'react';

import { PHONE_QUERY } from './useMediaQuery';

/**
 * Unite de design (meme definition que --u en CSS) : 1 pour une fenetre de 1400 x 900, proportionnelle, bornee ;
 * sur un telephone en paysage (moins de 560 px de haut), l'unite suit la hauteur (480u) comme dans phone.css.
 */
export function designUnit(): number {
  const w = window.innerWidth > 100 ? window.innerWidth : 1400;
  const h = window.innerHeight > 100 ? window.innerHeight : 900;
  if ('matchMedia' in window && window.matchMedia(PHONE_QUERY).matches) return Math.min(0.9, Math.max(0.5, h / 480));
  return Math.min(2, Math.max(0.5, Math.min(w / 1400, h / 900)));
}

export function useUnit(): number {
  const [u, setU] = useState(designUnit);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = () => { clearTimeout(timer); timer = setTimeout(() => setU(designUnit()), 150); };
    window.addEventListener('resize', on);
    return () => { clearTimeout(timer); window.removeEventListener('resize', on); };
  }, []);
  return u;
}
