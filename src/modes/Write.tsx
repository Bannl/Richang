import { useEffect, useMemo, useRef, useState } from 'react';
import type { Grade, Settings, Word } from '../core/types';
import { hasCharData } from '../data/hanzi';
import { useT } from '../i18n';
import { Card, HanziText, Icon, Meaning, Reading, SpeakButton } from '../ui/basics';
import { HanziQuiz, type HanziQuizHandle } from '../ui/HanziQuiz';
import { syllablesFor, ZhuyinChar } from '../ui/Phonetic';
import { designUnit } from '../ui/useUnit';

interface Props { word: Word; settings: Settings; mastered: boolean; onGrade: (g: Grade) => void }
const isHan = (c: string) => /\p{Script=Han}/u.test(c);

/** Ecriture : tracer le mot trait par trait, sans modele (de memoire). */
export function WriteMode({ word, settings, mastered, onGrade }: Props) {
  const t = useT();
  const chars = useMemo(() => [...word.hanzi].filter((c) => isHan(c) && hasCharData(c)), [word.hanzi]);
  // Reglage « zhuyin » des fiches : chaque caractere a ecrire est une case vide avec son zhuyin a droite, comme dans les
  // exercices des manuels de Taiwan ; le caractere remplace la case une fois trace. Meme filtre et meme ordre que chars.
  const cells = useMemo(() => {
    if (!settings.showZhuyin) return null;
    const syls = syllablesFor(word.hanzi, word.pinyin);
    if (!syls) return null;
    return [...word.hanzi].filter(isHan).map((c, k) => ({ c, syl: syls[k] })).filter((x) => hasCharData(x.c));
  }, [word.hanzi, word.pinyin, settings.showZhuyin]);
  const [i, setI] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const quiz = useRef<HanziQuizHandle>(null);
  const done = i >= chars.length;
  const [size] = useState(() => { const u = designUnit(); const vw = window.innerWidth > 100 ? window.innerWidth : 520; return Math.round(Math.min(360 * u, Math.max(200 * u, vw - 72 * u))); });

  useEffect(() => { if (chars.length === 0) onGrade(2); }, [chars, onGrade]);

  const grade: Grade = revealed ? 0 : mistakes === 0 ? 3 : mistakes <= 2 ? 2 : mistakes <= chars.length * 2 + 2 ? 1 : 0;
  const verdict = revealed ? t('reviewAgain') : mistakes === 0 ? t('perfect') : t('mistakes', { n: mistakes });

  return (
    <>
      <Card word={word} mastered={mastered}>
        <Meaning word={word} />
        <Reading word={word} settings={settings} zhuyin={cells ? 'none' : 'boxes'} />
        <div className={`chars ${cells ? 'zy-cells' : ''}`}>
          {chars.map((c, k) => (
            <span key={k} lang="zh-Hant-TW" className={`hanzi md ${k < i ? '' : 'todo'}`}>
              {cells ? <ZhuyinChar char={k < i ? c : null} syllable={cells[k].syl} /> : k < i ? c : '○'}
            </span>
          ))}
        </div>
        {done ? (
          <HanziText text={word.hanzi} size="xl" />
        ) : (
          <HanziQuiz
            key={i}
            ref={quiz}
            char={chars[i]}
            size={size}
            onMistake={() => setMistakes((m) => m + 1)}
            onComplete={() => setTimeout(() => setI((k) => k + 1), 450)}
          />
        )}
        <div className="corner"><SpeakButton text={word.hanzi} rate={settings.ttsRate} auto={settings.autoPlay} /></div>
      </Card>
      <div className="actions">
        {!done && (
          <button type="button" className="btn ghost" onClick={() => { setRevealed(true); quiz.current?.reveal(); }}>
            <Icon name="eye" /> {t('showModel')}
          </button>
        )}
        {done && (
          <button type="button" className="btn primary" onClick={() => onGrade(grade)}>
            {t('continue')} <span className="sub">· {verdict}</span>
          </button>
        )}
      </div>
    </>
  );
}
