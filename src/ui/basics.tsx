import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Settings, Word } from '../core/types';
import { themeOf } from '../data/words';
import { exampleText, glosses, posLabel, themeLabel, useLang, useT } from '../i18n';
import { speak } from '../platform/tts';
import { Annotated, Hanzi, ZhuyinBoxes } from './Phonetic';

const ICONS: Record<string, ReactNode> = {
  speaker: <><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></>,
  play: <path d="M7 5v14l11-7z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" /></>,
  replay: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
  check: <path d="M5 12l4 4L19 7" />,
  back: <path d="M15 5l-7 7 7 7" />,
  chat: <path d="M4 5h16v11h-9l-4 4v-4H4z" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** Carte : teintee par theme pendant l'apprentissage, neutre une fois le mot maitrise. */
export function Card({ word, mastered, children, tag = true }: { word: Word; mastered: boolean; children: ReactNode; tag?: boolean }) {
  const lang = useLang();
  const t = useT();
  const theme = themeOf(word);
  const style = mastered ? undefined : ({ '--hue': theme.hue } as CSSProperties);
  return (
    <section className="card" data-hue={mastered ? undefined : ''} style={style}>
      {tag && <span className="tag">{mastered ? t('masteredTag') : themeLabel(theme, lang)}</span>}
      {children}
    </section>
  );
}

/** Etiquette du theme (couleur d'accent de la carte) placee dans le flux, quand la carte n'a pas d'etiquette sur son bord. */
export function ThemeTag({ word }: { word: Word }) {
  const lang = useLang();
  return <span className="tag inline">{themeLabel(themeOf(word), lang)}</span>;
}

/**
 * Texte chinois ; avec son pinyin, il recoit l'annotation phonetique quand l'option est active. zhuyin : le zhuyin
 * vertical a droite de chaque caractere (reglage « zhuyin » des fiches), quel que soit le systeme de l'annotation.
 */
export function HanziText({ text, pinyin, size = 'xl', className = '', zhuyin = false, onClick }: { text: string; pinyin?: string; size?: 'xl' | 'lg' | 'md'; className?: string; zhuyin?: boolean; onClick?: () => void }) {
  return (
    <span lang="zh-Hant-TW" className={`hanzi ${size} ${className}`} onClick={onClick}>
      {pinyin ? (zhuyin ? <Annotated text={text} pinyin={pinyin} system="zhuyin" /> : <Hanzi text={text} pinyin={pinyin} />) : text}
    </span>
  );
}

/**
 * Lecture d'un mot (reglages « pinyin » et « zhuyin » des fiches) : le pinyin sur une ligne ; le zhuyin a la maniere
 * des manuels de Taiwan, en petit, vertical, a droite de chaque caractere. zhuyin : 'none' quand l'ecran l'accroche deja
 * au mot qu'il affiche, 'boxes' pour une invite d'ecriture (cases vides), 'word' (defaut) : le mot en petit, annote.
 */
export function Reading({ word, settings, zhuyin = 'word' }: { word: Word; settings: Settings; zhuyin?: 'word' | 'boxes' | 'none' }) {
  const showZhuyin = settings.showZhuyin && zhuyin !== 'none' && !!word.pinyin;
  if (!settings.showPinyin && !showZhuyin) return null;
  return (
    <div className="stack">
      {settings.showPinyin && word.pinyin && <span className="pinyin">{word.pinyin}</span>}
      {showZhuyin && (zhuyin === 'boxes'
        ? <ZhuyinBoxes text={word.hanzi} pinyin={word.pinyin} />
        : <HanziText text={word.hanzi} pinyin={word.pinyin} zhuyin size="md" className="reading-zy" />)}
    </div>
  );
}

export function Meaning({ word }: { word: Word }) {
  const lang = useLang();
  return (
    <div className="stack">
      <span className="meaning">{glosses(word, lang).join(' · ')}</span>
      {word.pos && <span className="pos">{posLabel(word.pos, lang)}</span>}
    </div>
  );
}

export function Example({ word, settings }: { word: Word; settings: Settings }) {
  const lang = useLang();
  const t = useT();
  const ex = word.example;
  if (!ex) return null;
  const say = () => speak(ex.zh, settings.ttsRate);
  return (
    <div className="example">
      <div className="example-zh">
        <HanziText text={ex.zh} pinyin={ex.pinyin} size="md" className="zh" onClick={say} />
        <button type="button" className="icon-btn small" aria-label={t('listen')} onClick={say}><Icon name="speaker" size={16} /></button>
      </div>
      {settings.showPinyin && <span className="py">{ex.pinyin}</span>}
      <span className="fr">{exampleText(word, lang)}</span>
    </div>
  );
}

export function SpeakButton({ text, rate, auto = false, big = false }: { text: string; rate: number; auto?: boolean; big?: boolean }) {
  const t = useT();
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => speak(text, rate), 300);
    return () => clearTimeout(id);
  }, [text, auto, rate]);
  return (
    <button type="button" className={`icon-btn ${big ? 'big' : ''}`} aria-label={t('listen')} onClick={() => speak(text, rate)}>
      <Icon name="speaker" />
    </button>
  );
}

export interface Choice { key: string; label: string }

export function Choices({ options, correct, onAnswer }: { options: Choice[]; correct: string; onAnswer: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="choices">
      {options.map((o) => {
        let cls = 'btn';
        if (picked) cls += o.key === correct ? ' correct' : o.key === picked ? ' wrong' : ' dim';
        return (
          <button key={o.key} type="button" className={cls} disabled={!!picked} onClick={() => { setPicked(o.key); onAnswer(o.key === correct); }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function TopBar({ left, title, right }: { left?: ReactNode; title?: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar">
      <div>{left}</div>
      <div className="title">{title}</div>
      <div style={{ textAlign: 'right' }}>{right}</div>
    </header>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
