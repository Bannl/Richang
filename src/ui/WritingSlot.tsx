import { useEffect, useMemo, useState } from 'react';
import type { Word } from '../core/types';
import { hasCharData } from '../data/hanzi';
import { HanziQuiz } from './HanziQuiz';

const isHan = (c: string) => /\p{Script=Han}/u.test(c);
/** Erreurs de trait tolerees par caractere pour que le mot compte juste. */
export const MISTAKES_PER_CHAR = 2;
const RESULT_DELAY = 450;

interface Props {
  word: Word;
  /** Cote (px) de la zone d'ecriture : une case par caractere, ou la grande case unique (single). */
  size: number;
  /** Une seule grande case pour le caractere en cours, l'avancement du mot au-dessus (telephone, tablette, Native). */
  single?: boolean;
  /** Mot ecrit en entier : juste si peu d'erreurs de traits. */
  onResult: (ok: boolean, mistakes: number) => void;
}

/**
 * Cases d'ecriture : le mot manquant se trace de memoire, trait par trait, sans modele.
 * Chaque trait est verifie (ordre, forme, sens) ; apres trois essais rates un trait est suggere.
 */
export function WritingSlot({ word, size, single = false, onResult }: Props) {
  const chars = useMemo(() => [...word.hanzi].filter((c) => isHan(c) && hasCharData(c)), [word.hanzi]);
  const [active, setActive] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const n = chars.length;
  const done = active >= n;

  // Mot termine (ou sans donnees de traits) : verdict apres un court temps pour voir le dernier caractere.
  useEffect(() => {
    if (n === 0) { onResult(true, 0); return; }
    if (!done) return;
    const timer = setTimeout(() => onResult(mistakes <= MISTAKES_PER_CHAR * n, mistakes), RESULT_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, n]);

  if (single) {
    // Grande case : le caractere en cours occupe toute la place ; une rangee de petites cases suit l'avancement du mot.
    const row = n > 1 ? Math.round(Math.min(56, Math.max(30, size * 0.12))) : 0;
    const gap = n > 1 ? Math.round(row * 0.25) : 0;
    const box = Math.max(80, size - row - gap);
    const cur = chars[Math.min(active, Math.max(0, n - 1))];
    return (
      <div className="wslot single" style={{ gap }}>
        {n > 1 && (
          <div className="wprogress" style={{ height: row }}>
            {chars.map((c, k) => (
              <span key={k} className={k < active ? 'done' : k === active ? 'cur' : 'todo'} style={{ width: row, height: row, fontSize: row * 0.66 }} lang="zh-Hant-TW">{k < active ? c : ''}</span>
            ))}
          </div>
        )}
        {cur && (
          <div className={`wbox ${done ? 'done' : 'active'}`}>
            <HanziQuiz
              key={Math.min(active, n - 1)}
              char={cur}
              size={box}
              quiz={!done}
              showCharacter={done}
              onMistake={() => setMistakes((m) => m + 1)}
              onComplete={() => setActive((a) => a + 1)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wslot">
      {chars.map((c, k) => (
        <div key={k} className={`wbox ${k === active ? 'active' : k < active ? 'done' : ''}`}>
          <HanziQuiz
            char={c}
            size={size}
            quiz={k === active}
            showCharacter={k < active}
            onMistake={() => setMistakes((m) => m + 1)}
            onComplete={() => setActive((a) => a + 1)}
          />
        </div>
      ))}
    </div>
  );
}
