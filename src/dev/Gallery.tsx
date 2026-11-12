import { useState } from 'react';
import { CHARACTERS, Portrait, traitLabel, type Emotion } from '../ui/Portrait';

const EMOTIONS: Emotion[] = ['neutral', 'happy', 'shocked', 'confused', 'angry', 'curious'];

/** Galerie de developpement (?gallery) : tous les portraits, une emotion au choix ou toutes pour un personnage. */
export function Gallery() {
  const [emo, setEmo] = useState<Emotion | 'mood'>('mood');
  const [one, setOne] = useState<string | null>(null);
  const ids = Object.keys(CHARACTERS);
  return (
    <div style={{ padding: 12, background: '#3a4560', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {(['mood', ...EMOTIONS] as const).map((e) => <button key={e} type="button" className={`chip ${emo === e ? 'on' : ''}`} onClick={() => { setEmo(e); setOne(null); }}>{e}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {(one ? EMOTIONS.map((e) => [one, e] as const) : ids.map((id) => [id, emo === 'mood' ? undefined : emo] as const)).map(([id, e]) => (
          <div key={id + (e ?? '')} onClick={() => setOne(one ? null : id)} style={{ background: '#cfd8e6', borderRadius: 8, padding: 4, cursor: 'pointer' }}>
            <div style={{ height: 160 }}><Portrait id={id} emotion={e} /></div>
            <div style={{ font: '700 11px sans-serif', color: '#222', textAlign: 'center' }}>{id} · {traitLabel(id, 'fr')}{one ? ` · ${e}` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
