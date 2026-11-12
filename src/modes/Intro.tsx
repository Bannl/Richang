import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { Settings, Word } from '../core/types';
import { hasCharData } from '../data/hanzi';
import { noteOf, useLang, useT } from '../i18n';
import { Card, Example, HanziText, Icon, Meaning, Reading, SpeakButton, ThemeTag } from '../ui/basics';
import { HanziQuiz, type HanziQuizHandle } from '../ui/HanziQuiz';
import { useElementSize } from '../ui/useElementSize';
import { PHONE_QUERY, TOUCH_QUERY, useMediaQuery } from '../ui/useMediaQuery';
import { useUnit } from '../ui/useUnit';

const isHan = (c: string) => /\p{Script=Han}/u.test(c);
const GAP = 20;
/** Largeur (unites de design) de la colonne d'avancement du mot a cote de la grande case. */
const PROGRESS_W = 60;

/** Avancement d'un mot de plusieurs caracteres : colonne de petites cases (fait, en cours, a venir). */
export function CharProgress({ chars, active, width }: { chars: string[]; active: number; width: number }) {
  return (
    <div className="char-progress" style={{ width }}>
      {chars.map((c, k) => (
        <span key={k} lang="zh-Hant-TW" className={k < active ? 'done' : k === active ? 'cur' : 'todo'} style={{ width, height: width, fontSize: width * 0.62 }}>{c}</span>
      ))}
    </div>
  );
}

/**
 * Decouverte d'un mot : les caracteres en pointille occupent la zone principale, aussi grands que l'espace le permet ;
 * chacun est anime trait par trait puis trace ; les informations sont dans la colonne de droite.
 * Ecran tactile : une seule grande case (le caractere en cours), l'avancement du mot dans une colonne a cote.
 * `head` (retour, titre, compteur...) s'affiche en tete de la colonne de droite : l'ecran n'a pas de barre du haut.
 */
export function IntroMode({ word, settings, onNext, continueLabel, head }: { word: Word; settings: Settings; onNext: () => void; continueLabel?: string; head?: ReactNode }) {
  const t = useT();
  const lang = useLang();
  const chars = useMemo(() => [...word.hanzi].filter((c) => isHan(c) && hasCharData(c)), [word.hanzi]);
  const [active, setActive] = useState(0);
  const refs = useRef<(HanziQuizHandle | null)[]>([]);
  const area = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(area);
  const u = useUnit();
  const phone = useMediaQuery(PHONE_QUERY);
  const touch = useMediaQuery(TOUCH_QUERY);
  const single = phone || touch;
  const done = active >= chars.length;
  const n = chars.length;
  const shown = Math.min(active, Math.max(0, n - 1));

  // Taille des cases d'apres la place reellement disponible (largeur et hauteur de la zone).
  const gap = GAP * u;
  const prog = single && n > 1 ? Math.round(PROGRESS_W * u) : 0;
  let size = 0;
  if (width > 0 && height > 0 && n > 0) {
    if (single) {
      size = Math.min(width - (prog ? prog + gap : 0), height);
    } else {
      const perRow = n <= 2 ? n : n === 3 && width >= 3 * 300 * u + 2 * gap ? 3 : 2;
      const rows = Math.ceil(n / perRow);
      size = Math.min((width - gap * (perRow - 1)) / perRow, (height - gap * (rows - 1)) / rows);
    }
    size = Math.max(120, Math.floor(size));
  }
  const note = noteOf(word, lang);

  return (
    <Card word={word} mastered={false} tag={false}>
      <div className="learn-layout">
        {head && <div className="learn-head">{head}</div>}
        <div className={`learn-canvases ${single ? 'single' : ''}`} ref={area}>
          {n === 0 && <HanziText text={word.hanzi} size="xl" />}
          {single && n > 1 && <CharProgress chars={chars} active={active} width={prog} />}
          {size > 0 && chars.map((c, k) => (single && k !== shown) ? null : (
            <HanziQuiz
              key={c + k}
              ref={(h) => { refs.current[k] = h; }}
              char={c}
              size={size}
              dotted={k >= active}
              showCharacter={k < active}
              animateFirst={k === active}
              quiz={k === active}
              hintAfterMisses={2}
              onComplete={() => setTimeout(() => setActive((a) => a + 1), 350)}
            />
          ))}
        </div>
        <div className="learn-info">
          <div className="learn-kicker"><ThemeTag word={word} /><span className="prompt">{t('newWord')}</span></div>
          <div className="row">
            <HanziText text={word.hanzi} pinyin={word.pinyin} zhuyin={settings.showZhuyin} size="lg" />
            <SpeakButton text={word.hanzi} rate={settings.ttsRate} auto={settings.autoPlay} />
          </div>
          <Reading word={word} settings={settings} zhuyin="none" />
          <Meaning word={word} />
          {note && <p className="note">{note}</p>}
          <Example word={word} settings={settings} />
          <span className="prompt">{n === 0 ? '' : done ? t('traceDone') : t('traceHint')}</span>
          <div className="learn-actions">
            {n > 0 && (
              <button type="button" className="btn ghost" onClick={() => refs.current[Math.min(active, n - 1)]?.animate()}>
                <Icon name="replay" /> {t('replay')}
              </button>
            )}
            <button type="button" className="btn primary" disabled={!done && n > 0} onClick={onNext}>
              {continueLabel ?? t('continue')}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
