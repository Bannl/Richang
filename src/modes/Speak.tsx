import { useEffect, useRef, useState } from 'react';
import type { Grade, Settings, Word } from '../core/types';
import { Recorder } from '../platform/recorder';
import { useT } from '../i18n';
import { recognizeOnce } from '../platform/stt';
import { Card, HanziText, Icon, Meaning, Reading, SpeakButton } from '../ui/basics';

interface Props { word: Word; settings: Settings; mastered: boolean; stt: boolean; onGrade: (g: Grade) => void }
const norm = (s: string) => s.replace(/[\s，。！？、,.!?~～]/g, '');

/** Prononciation : ecouter le modele, s'enregistrer, se reecouter, (Android) verifier par reconnaissance vocale. */
export function SpeakMode({ word, settings, mastered, stt, onGrade }: Props) {
  const t = useT();
  const [rec, setRec] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const recorder = useRef<Recorder | null>(null);

  useEffect(() => () => { recorder.current?.cancel(); if (url) URL.revokeObjectURL(url); }, [url]);

  async function toggleRecord() {
    setError(null);
    if (rec === 'recording') {
      const blob = await recorder.current!.stop();
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(blob));
      setRec('recorded');
      return;
    }
    try {
      recorder.current = new Recorder();
      await recorder.current.start();
      setRec('recording');
    } catch { setError(t('micUnavailable')); }
  }

  async function check() {
    setChecking(true);
    setResult(null);
    try {
      const matches = await recognizeOnce();
      const ok = matches.some((m) => norm(m).includes(norm(word.hanzi)));
      setResult({ text: matches[0] ?? t('nothingRecognized'), ok });
    } catch { setResult({ text: t('recognitionFailed'), ok: false }); }
    finally { setChecking(false); }
  }

  return (
    <>
      <Card word={word} mastered={mastered}>
        <span className="prompt">{t('speakPrompt')}</span>
        <HanziText text={word.hanzi} pinyin={word.pinyin} zhuyin={settings.showZhuyin} size="xl" />
        <Reading word={word} settings={settings} zhuyin="none" />
        <Meaning word={word} />
        <div className="row" style={{ marginTop: 14 }}>
          <SpeakButton text={word.hanzi} rate={settings.ttsRate} auto={settings.autoPlay} />
          {Recorder.supported() && (
            <button type="button" className={`icon-btn rec ${rec === 'recording' ? 'on' : ''}`} onClick={toggleRecord} aria-label={t('record')}>
              <Icon name={rec === 'recording' ? 'stop' : 'mic'} />
            </button>
          )}
          {url && rec === 'recorded' && (
            <button type="button" className="icon-btn" onClick={() => { void new Audio(url).play(); }} aria-label={t('playback')}>
              <Icon name="play" />
            </button>
          )}
        </div>
        {error && <p className="stt bad">{error}</p>}
        {stt && (
          <button type="button" className="btn" onClick={check} disabled={checking} style={{ marginTop: 6 }}>
            {checking ? t('listening') : t('checkPron')}
          </button>
        )}
        {result && <p className={`stt ${result.ok ? 'ok' : 'bad'}`}>{result.ok ? '✓ ' : '✗ '}{result.text}</p>}
      </Card>
      <div className="actions">
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => onGrade(0)}>{t('again')}</button>
          <button type="button" className="btn" onClick={() => onGrade(2)}>{t('good')}</button>
          <button type="button" className="btn" onClick={() => onGrade(3)}>{t('easy')}</button>
        </div>
      </div>
    </>
  );
}
