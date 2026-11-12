import { createContext, Fragment, useContext } from 'react';
import { convertPinyin, convertSyllable, zhuyinParts, type PhoneticSystem } from '../core/phonetics';

/**
 * Systeme d'annotation phonetique actif (null : desactive). Fourni par App selon les reglages ;
 * le combat le coupe quand la difficulte masque la prononciation (Resident, Native).
 */
export const PhoneticContext = createContext<PhoneticSystem | null>(null);
export const usePhonetic = (): PhoneticSystem | null => useContext(PhoneticContext);

const isHan = (c: string) => /\p{Script=Han}/u.test(c);

/** Syllabes pinyin d'un texte, une par caractere chinois ; null si le compte ne correspond pas (erhua, chiffres...). */
export function syllablesFor(text: string, pinyin: string | null | undefined): string[] | null {
  if (!pinyin) return null;
  const han = [...text].filter(isHan).length;
  if (han === 0) return null;
  const syls = convertPinyin('pinyin', pinyin);
  return syls.length === han ? syls : null;
}

/**
 * Un caractere et son zhuyin vertical a droite, comme dans les manuels de Taiwan (W3C clreq 5.5.3) : symboles empiles,
 * centres sur la hauteur du caractere, a 3/10 de sa taille ; ton (ˊ ˇ ˋ) hors du coin superieur droit du dernier
 * symbole ; point du ton neutre au-dessus. Sans caractere (char null : « lis le zhuyin, ecris le caractere ») : case vide.
 */
export function ZhuyinChar({ char, syllable }: { char: string | null; syllable: string }) {
  const p = zhuyinParts(syllable);
  const symbols = [...p.symbols];
  return (
    <span className="zy">
      {char === null ? <span className="zy-h zy-box" aria-hidden="true" /> : <span className="zy-h">{char}</span>}
      <span className="zy-col" aria-hidden={char === null ? undefined : true}>
        {p.neutral && <span className="zy-dot">˙</span>}
        {symbols.map((s, j) => (
          <span key={j} className="zy-s">{s}{j === symbols.length - 1 && p.tone && <span className="zy-t">{p.tone}</span>}</span>
        ))}
      </span>
    </span>
  );
}

/**
 * Texte chinois annote caractere par caractere : bopomofo vertical a droite, ou romanisation (pinyin, Tongyong,
 * Wade-Giles) au-dessus en ruby. Sans alignement possible, le texte reste seul et la transcription suit en petit.
 */
export function Annotated({ text, pinyin, system }: { text: string; pinyin: string | null | undefined; system: PhoneticSystem }) {
  const syls = syllablesFor(text, pinyin);
  if (!syls) {
    if (!pinyin || ![...text].some(isHan)) return <>{text}</>;
    const all = convertPinyin(system, pinyin).join(' ');
    return <>{text}<span className="anno-tail" aria-hidden="true">{all}</span></>;
  }
  let k = 0;
  return (
    <>
      {[...text].map((c, i) => {
        if (!isHan(c)) return <Fragment key={i}>{c}</Fragment>;
        const syl = syls[k++];
        if (system === 'zhuyin') return <ZhuyinChar key={i} char={c} syllable={syl} />;
        return <ruby key={i} className="rb">{c}<rt>{convertSyllable(system, syl)}</rt></ruby>;
      })}
    </>
  );
}

/** Transcription d'un mot sur une ligne (sous une carte) : romanisation « ni³ hao³ » (ou zhuyin « ㄋㄧˇ ㄏㄠˇ » en secours). */
export function readingLine(system: PhoneticSystem, pinyin: string): string {
  return convertPinyin(system, pinyin).join(' ');
}

/** Mot annote en zhuyin vertical, pour une carte : les caracteres passent a la ligne si la carte est trop etroite. */
export function ZhuyinRun({ text, pinyin }: { text: string; pinyin: string }) {
  return <span className="zy-run"><Annotated text={text} pinyin={pinyin} system="zhuyin" /></span>;
}

/** Zhuyin d'un mot sans ses caracteres : une case vide par caractere, son zhuyin a droite (invite d'ecriture des manuels). */
export function ZhuyinBoxes({ text, pinyin }: { text: string; pinyin: string }) {
  const syls = syllablesFor(text, pinyin);
  if (!syls) return <span className="zhuyin" lang="zh-Hant-TW">{readingLine('zhuyin', pinyin)}</span>;
  return <span className="zy-run boxes" lang="zh-Hant-TW">{syls.map((syl, i) => <ZhuyinChar key={i} char={null} syllable={syl} />)}</span>;
}

/** Texte chinois, annote si l'option est active (systeme du contexte). */
export function Hanzi({ text, pinyin }: { text: string; pinyin: string | null | undefined }) {
  const system = usePhonetic();
  if (!system) return <>{text}</>;
  return <Annotated text={text} pinyin={pinyin} system={system} />;
}
