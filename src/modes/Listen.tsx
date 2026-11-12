import { useEffect, useMemo, useState } from 'react';
import type { Grade, Settings, Word } from '../core/types';
import { glosses, useLang, useT } from '../i18n';
import { Card, Choices, Example, HanziText, Reading, SpeakButton, shuffle } from '../ui/basics';

interface Props { word: Word; options: Word[]; settings: Settings; mastered: boolean; onGrade: (g: Grade) => void }

/** Ecoute : reconnaitre le sens d'un mot entendu. */
export function ListenMode({ word, options, settings, mastered, onGrade }: Props) {
  const t = useT();
  const lang = useLang();
  const [answered, setAnswered] = useState<boolean | null>(null);
  const choices = useMemo(() => shuffle(options.map((w) => ({ key: String(w.rank), label: glosses(w, lang)[0] }))), [options, lang]);

  useEffect(() => {
    if (answered !== true) return;
    const id = setTimeout(() => onGrade(2), 1200);
    return () => clearTimeout(id);
  }, [answered, onGrade]);

  return (
    <>
      <Card word={word} mastered={mastered}>
        {answered === null ? (
          <>
            <span className="prompt">{t('listenPrompt')}</span>
            <SpeakButton text={word.hanzi} rate={settings.ttsRate} auto big />
          </>
        ) : (
          <>
            <HanziText text={word.hanzi} pinyin={word.pinyin} zhuyin={settings.showZhuyin} size="xl" />
            <Reading word={word} settings={settings} zhuyin="none" />
            <Example word={word} settings={settings} />
            <div className="corner"><SpeakButton text={word.hanzi} rate={settings.ttsRate} /></div>
          </>
        )}
      </Card>
      <div className="actions">
        <Choices options={choices} correct={String(word.rank)} onAnswer={setAnswered} />
        {answered !== null && (
          <button type="button" className="btn primary" onClick={() => onGrade(answered ? 2 : 0)}>{t('continue')}</button>
        )}
      </div>
    </>
  );
}
