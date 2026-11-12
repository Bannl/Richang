import { useEffect, useRef, useState } from 'react';

export interface FlyingItem { text: string; from: DOMRect }

interface Props {
  items: FlyingItem[];
  /** Zone d'arrivee (la bulle de conversation). */
  to: DOMRect;
  onDone: () => void;
}

const DURATION = 750;
const STAGGER = 45;

/** Les mots quittent leurs cartes et volent vers la fenetre de conversation. */
export function FlyingWords({ items, to, onDone }: Props) {
  const [go, setGo] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setGo(true));
    const total = DURATION + STAGGER * Math.max(0, items.length - 1) + 80;
    const timer = setTimeout(() => { if (!done.current) { done.current = true; onDone(); } }, total);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fly-layer" aria-hidden="true">
      {items.map((it, i) => {
        // Chaque mot vise un point de la bulle, decale pour suggerer une ligne de texte.
        const tx = to.left + 14 + Math.min(i * 16, Math.max(0, to.width - 40)) - it.from.left;
        const ty = to.top + to.height / 2 - it.from.top - it.from.height / 2;
        const style: React.CSSProperties = {
          left: it.from.left, top: it.from.top, width: it.from.width, height: it.from.height,
          transitionDelay: `${i * STAGGER}ms`,
          transform: go ? `translate(${tx}px, ${ty}px) scale(0.32)` : 'translate(0, 0) scale(1)',
          opacity: go ? 0.15 : 1,
        };
        return <span key={i} className="fly-word" lang="zh-Hant-TW" style={style}>{it.text}</span>;
      })}
    </div>
  );
}
