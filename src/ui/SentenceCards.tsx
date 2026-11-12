import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { PhoneticSystem } from '../core/phonetics';
import { WORD_BY_RANK, themeOf } from '../data/words';
import type { DialogueLine } from '../game/types';
import { readingLine, usePhonetic, ZhuyinRun } from './Phonetic';

const isHan = (c: string) => /\p{Script=Han}/u.test(c);

/** Syllabes pinyin de chaque segment (alignement par caractere chinois). */
export function segmentPinyin(line: DialogueLine): (string | null)[] {
  const syls = line.speech.pinyin.replace(/[,，.。!！?？;；:：、]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const han = [...line.speech.zh].filter(isHan).length;
  if (syls.length !== han) return line.segments.map(() => null);
  let k = 0;
  return line.segments.map((s) => {
    const n = [...s.text].filter(isHan).length;
    if (n === 0) return null;
    const out = syls.slice(k, k + n).join(' ');
    k += n;
    return out;
  });
}

/** Texte et pinyin de chaque segment d'une replique, trous remplis par la carte posee (pour l'annotation). */
export function lineParts(line: DialogueLine): { text: string; pinyin: string | null }[] {
  const pinyins = segmentPinyin(line);
  return line.segments.map((seg, i) => {
    const b = line.blanks.indexOf(i);
    if (b >= 0 && line.filled[b] !== null) {
      const w = WORD_BY_RANK.get(line.filled[b]!);
      return { text: w?.hanzi ?? seg.text, pinyin: w?.pinyin ?? pinyins[i] };
    }
    return { text: seg.text, pinyin: pinyins[i] };
  });
}

interface WordCardProps {
  text: string;
  rank: number | null;
  /** Pinyin du segment (ligne sous le mot, ou source de l'annotation phonetique). */
  pinyin?: string | null;
  /** Annotation phonetique a cote de chaque caractere (remplace la ligne de pinyin). */
  annotate?: PhoneticSystem | null;
  /** Face visible (retournee). */
  revealed: boolean;
  speaking?: boolean;
  className?: string;
  /** Trou a remplir : dos avec un « ? », zone de depot. */
  blank?: boolean;
  /** Nombre de caracteres du mot cache (un « ? » par caractere). */
  blankLen?: number;
  slot?: number;
}

/** Carte-mot a deux faces : dos (motif de treillis, embleme 日) et face avec le mot ; se retourne quand le mot est prononce. */
export function WordCard({ text, rank, pinyin, annotate, revealed, speaking = false, className = '', blank = false, blankLen, slot }: WordCardProps) {
  const word = rank !== null ? WORD_BY_RANK.get(rank) : undefined;
  const marks = Math.max(1, Math.min(4, blankLen ?? 1));
  const len = Math.min(blank ? marks : [...text].length, 4);
  const style = word ? ({ '--hue': themeOf(word).hue } as CSSProperties) : undefined;
  const anno = annotate && pinyin ? annotate : null;
  // Zhuyin : vertical a droite de chaque caractere (manuels de Taiwan) ; pinyin et romanisations : une ligne sous le mot.
  const zy = anno === 'zhuyin';
  return (
    <div
      className={`wcard len${len} ${revealed ? 'revealed' : ''} ${speaking ? 'speaking' : ''} ${blank ? 'blank' : ''} ${zy ? 'anno-zy' : ''} ${className}`}
      style={style}
      data-hue={word ? '' : undefined}
      data-slot={slot}
    >
      <div className="wcard-inner">
        <div className="wcard-face wcard-back">
          {blank
            ? <span className="back-mark" aria-hidden="true">{'?'.repeat(marks)}</span>
            : <span className="back-emblem" aria-hidden="true">日</span>}
        </div>
        <div className="wcard-face wcard-front">
          {word && <span className="strip" />}
          <span className="h" lang="zh-Hant-TW" data-text={text}>{zy && pinyin ? <ZhuyinRun text={text} pinyin={pinyin} /> : text}</span>
          {pinyin && !zy && <span className="p">{anno ? readingLine(anno, pinyin) : pinyin}</span>}
        </div>
      </div>
      {className.includes('ok') && <span className="wcard-badge ok" aria-hidden="true">✓</span>}
      {className.includes('bad') && <span className="wcard-badge bad" aria-hidden="true">✕</span>}
    </div>
  );
}

interface Props {
  line: DialogueLine;
  /** Segments deja prononces : leurs cartes sont retournees. */
  visible: number;
  /** Segment en cours de lecture (mise en avant). */
  speaking: number | null;
  showPinyin: boolean;
  /** Les trous vides sont des zones de depot. */
  interactive: boolean;
  /** Rangee principale (a completer) ou rappel de la replique precedente. */
  size?: 'big' | 'small';
  /** Contenu d'un trou vide (case d'ecriture en mode Native) ; null : carte « ? » habituelle. */
  renderBlank?: (slot: number) => ReactNode;
}

/** Replique affichee comme une rangee de cartes-mots, d'abord face cachee, retournees au fil de la voix. */
export function SentenceCards({ line, visible, speaking, showPinyin, interactive, size = 'big', renderBlank }: Props) {
  const pinyins = segmentPinyin(line);
  const system = usePhonetic();
  const annotate = showPinyin ? system : null;
  return (
    <div className={`wcards ${size}`}>
      {line.segments.map((seg, i) => {
        const revealed = i < visible;
        const blank = line.blanks.indexOf(i);
        if (blank >= 0) {
          const filled = line.filled[blank];
          if (filled === null) {
            const custom = renderBlank?.(blank);
            if (custom) return <Fragment key={i}>{custom}</Fragment>;
            return <WordCard key={i} text="" rank={null} revealed={false} blank blankLen={[...seg.text].length} slot={interactive ? blank : undefined} />;
          }
          const w = WORD_BY_RANK.get(filled);
          return <WordCard key={i} text={w?.hanzi ?? seg.text} rank={filled} pinyin={showPinyin ? w?.pinyin : null} annotate={annotate} revealed speaking={speaking === i} className={line.results[blank] ?? ''} />;
        }
        if (!isHan(seg.text)) return <span key={i} className={`wpunct ${revealed ? '' : 'hidden'}`} lang="zh-Hant-TW">{seg.text}</span>;
        return <WordCard key={i} text={seg.text} rank={seg.rank} pinyin={showPinyin ? pinyins[i] : null} annotate={annotate} revealed={revealed} speaking={speaking === i} />;
      })}
    </div>
  );
}

/** Texte lu a voix haute : toujours la phrase complete, le mot d'un trou est prononce meme quand la carte est encore cachee. */
export function spokenText(line: DialogueLine): { text: string; starts: number[] } {
  let text = '';
  const starts: number[] = [];
  line.segments.forEach((seg, i) => {
    starts.push([...text].length);
    const blank = line.blanks.indexOf(i);
    if (blank >= 0 && line.filled[blank] !== null) text += WORD_BY_RANK.get(line.filled[blank]!)?.hanzi ?? seg.text;
    else text += seg.text;
  });
  return { text, starts };
}
