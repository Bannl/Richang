import HanziWriter from 'hanzi-writer';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { loadCharData } from '../data/hanzi';

export interface HanziQuizHandle {
  /** Rejoue l'animation des traits (ordre et sens), puis relance le quiz si actif. */
  animate(): Promise<void>;
  /** Affiche la silhouette pleine du caractere (aide en mode ecriture). */
  reveal(): void;
}

interface Props {
  char: string;
  size?: number;
  /** L'utilisateur doit tracer le caractere (par defaut true). */
  quiz?: boolean;
  /** Silhouette pleine de Hanzi Writer. */
  showOutline?: boolean;
  /** Caractere complet affiche (caractere deja trace). */
  showCharacter?: boolean;
  /** Contour pointille (modele a suivre en mode decouverte). */
  dotted?: boolean;
  /** Anime les traits avant de lancer le quiz. */
  animateFirst?: boolean;
  hintAfterMisses?: number;
  onComplete?: (mistakes: number) => void;
  onMistake?: () => void;
}

type CharData = { strokes: string[]; medians: number[][][] };
/** Marge interieure du canvas : proportionnelle a la taille, pour que le caractere occupe presque toute la case. */
const padFor = (size: number) => Math.max(6, Math.round(size * 0.04));
// Boite des glyphes Make Me a Hanzi utilisee par Hanzi Writer : x 0..1024, y -124..900 (1024 x 1024).
const GLYPH_Y_MIN = -124;
const GLYPH_SIZE = 1024;

/**
 * Couleur d'une variable CSS lue sur l'element (les conteneurs peuvent redefinir --fg, --line, --muted : case claire en
 * combat), normalisee par le navigateur en rgb() ou rgba(). Hanzi Writer ne lit que #rgb, #rrggbb, rgb() et rgba() et
 * plante sur le reste : le CSS minifie de la version publiee ecrit les couleurs translucides en #rrggbbaa (la couleur
 * des filets, 2026-11-18 : plus d'animation ni de trace dans les apps, alors que le serveur de developpement marchait).
 */
function cssColor(el: Element, name: string, fallback: string): string {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = `var(${name}, ${fallback})`;
  el.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return /^rgba?\(/.test(color) ? color : fallback;
}

/** Canvas d'ecriture (Hanzi Writer) : animation des traits et quiz trait par trait au doigt, stylet ou souris. */
export const HanziQuiz = forwardRef<HanziQuizHandle, Props>(function HanziQuiz(
  { char, size = 280, quiz = true, showOutline = false, showCharacter = false, dotted = false, animateFirst = false, hintAfterMisses = 3, onComplete, onMistake },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const startQuiz = useRef<() => void>(() => {});
  const [strokes, setStrokes] = useState<string[] | null>(null);
  const cb = useRef({ onComplete, onMistake });
  cb.current = { onComplete, onMistake };

  // Contour pointille dessine a partir des donnees de traits (meme repere que Hanzi Writer).
  useEffect(() => {
    let alive = true;
    if (!dotted) { setStrokes(null); return; }
    loadCharData(char).then((d) => { if (alive && d) setStrokes((d as CharData).strokes); });
    return () => { alive = false; };
  }, [char, dotted]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = '';
    const fg = cssColor(el, '--fg', '#222');
    const line = cssColor(el, '--line', '#ddd');
    const muted = cssColor(el, '--muted', '#888');
    const w = HanziWriter.create(el, char, {
      width: size, height: size, padding: padFor(size),
      showOutline, showCharacter,
      strokeColor: fg, outlineColor: line, drawingColor: fg, drawingWidth: Math.max(8, Math.round(size / 30)), highlightColor: muted, radicalColor: fg,
      showHintAfterMisses: hintAfterMisses, highlightOnComplete: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 260,
      charDataLoader: (c: string) => loadCharData(c).then((d) => {
        if (!d) throw new Error('Pas de données de traits pour ' + c);
        return d as CharData;
      }),
    });
    writer.current = w;
    if (import.meta.env.DEV && quiz) (window as unknown as { __hanziWriter?: HanziWriter }).__hanziWriter = w;
    let cancelled = false;
    startQuiz.current = () => {
      if (cancelled || !quiz) return;
      w.quiz({
        onMistake: () => cb.current.onMistake?.(),
        onComplete: (s: { totalMistakes: number }) => cb.current.onComplete?.(s.totalMistakes),
      });
    };
    if (animateFirst) w.animateCharacter({ onComplete: () => startQuiz.current() });
    else startQuiz.current();
    return () => {
      cancelled = true;
      try { w.cancelQuiz(); } catch { /* deja termine */ }
      writer.current = null;
    };
  }, [char, size, quiz, showOutline, showCharacter, animateFirst, hintAfterMisses]);

  useImperativeHandle(ref, () => ({
    animate: async () => {
      const w = writer.current;
      if (!w) return;
      try { w.cancelQuiz(); } catch { /* pas de quiz */ }
      await w.animateCharacter();
      startQuiz.current();
    },
    reveal: () => writer.current?.showOutline(),
  }), []);

  // Meme repere que le Positioner de Hanzi Writer (canvas carre) : echelle, puis translation avec l'origine y a -124.
  const pad = padFor(size);
  const scale = (size - 2 * pad) / GLYPH_SIZE;
  const xOffset = pad;
  const yOffset = pad - GLYPH_Y_MIN * scale;
  return (
    <div className="writer" style={{ width: size, height: size }}>
      {dotted && strokes && (
        <svg className="dotted" width={size} height={size} aria-hidden="true">
          <g transform={`translate(${xOffset} ${size - yOffset}) scale(${scale} ${-scale})`}>
            {strokes.map((d, i) => <path key={i} d={d} />)}
          </g>
        </svg>
      )}
      <div ref={host} className="writer-host" />
    </div>
  );
});
