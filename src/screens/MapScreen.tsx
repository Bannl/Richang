import type { CSSProperties } from 'react';
import type { AppState } from '../core/types';
import { WORDS } from '../data/words';
import { nodeById } from '../game/map';
import { endRun, enterNode } from '../game/run';
import { SITUATION_BY_ID } from '../game/situations';
import type { MapNode, NodeType } from '../game/types';
import { useLang, useT, type StringKey } from '../i18n';
import { backgroundFor } from '../ui/backgrounds';
import { Icon, TopBar } from '../ui/basics';
import { useMediaQuery } from '../ui/useMediaQuery';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onExit: () => void;
}

const NODE_KEY: Record<NodeType, StringKey> = { start: 'nodeStart', fight: 'nodeFight', elite: 'nodeElite', rest: 'nodeRest', boss: 'nodeFinal' };
// Le noeud « boss » est l'evenement qui termine la journee (une lune).
const NODE_ICON: Record<NodeType, string> = { start: '', fight: '!', elite: '✦', rest: '♥', boss: '☾' };

const HEART = 'M12 21.2C5.2 15.8 1 12.2 1 7.2 1 3.8 3.6 1.2 7 1.2c2.1 0 3.9 1.1 5 2.8 1.1-1.7 2.9-2.8 5-2.8 3.4 0 6 2.6 6 6 0 5-4.2 8.6-11 14Z';

/** Vies du run : coeurs pleins, coeurs vides pour les vies perdues. */
export function HpBar({ hp, max }: { hp: number; max: number }) {
  return (
    <span className="hp" aria-label={`${hp}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} className={`heart ${i < hp ? '' : 'off'}`} viewBox="0 0 24 22" aria-hidden="true"><path d={HEART} /></svg>
      ))}
    </span>
  );
}

/**
 * Carte du run : on choisit un noeud atteignable. Elle occupe toute la zone sous la barre du haut : ecran en largeur
 * (telephones et tablettes du jeu, fenetres de bureau), depart a gauche et boss a droite ; ecran en hauteur, depart en
 * bas et boss en haut. Les noeuds sont des boutons places en proportion de la zone (--t le long du parcours, --c en
 * travers), les chemins un dessin etire dessous dont les traits gardent leur epaisseur : rien a mesurer, la carte suit
 * l'ecran. Noeuds et textes ont une taille fixe a l'ecran, seuls les ecarts grandissent avec la place. Seuls les lieux
 * atteignables et le boss sont nommes ; les autres le sont au survol.
 */
export function MapScreen({ state, update, onExit }: Props) {
  const t = useT();
  const lang = useLang();
  const run = state.run!;
  const map = run.map;
  const current = nodeById(map, run.current);
  const reachable = new Set(current.next);
  const visited = new Set(run.visited);
  const portrait = useMediaQuery('(orientation: portrait)');
  // Place de chaque noeud : t de 0 (depart) a 1 (boss) ; c en travers, le decalage aleatoire de la carte attenue pour
  // garder de l'air entre voisins d'une meme rangee.
  const perLayer = new Map<number, number>();
  for (const n of map.nodes) perLayer.set(n.layer, (perLayer.get(n.layer) ?? 0) + 1);
  const place = (n: MapNode) => {
    const base = (n.col + 0.5) / (perLayer.get(n.layer) ?? 1);
    return { t: n.layer / (map.layers - 1), c: base + (n.x - base) * 0.4 };
  };
  // Chemins sur une grille de 1000 x 1000 etiree sur la zone des noeuds.
  const at = (n: MapNode) => { const p = place(n); return portrait ? { x: p.c * 1000, y: (1 - p.t) * 1000 } : { x: p.t * 1000, y: p.c * 1000 }; };
  // Nom du boss masque quand des lieux atteignables sont dans la rangee juste avant lui (leurs noms prendraient sa place).
  const bossNamed = ![...reachable].some((id) => { const m = nodeById(map, id); return m.type !== 'boss' && m.layer >= map.layers - 2; });
  const label = (n: MapNode) => {
    if (n.situation) { const s = SITUATION_BY_ID.get(n.situation); if (s) return lang === 'en' ? s.en : s.fr; }
    return t(NODE_KEY[n.type]);
  };
  const abandon = () => { if (confirm(t('confirmAbandon'))) { update(endRun); onExit(); } };

  return (
    <div className="app wide map on-photo">
      <div className="scene-bg" style={{ backgroundImage: `url(${backgroundFor('directions')})` }} aria-hidden="true" />
      <TopBar
        left={<HpBar hp={run.hp} max={run.maxHp} />}
        title={<span className="map-title"><span className="day-badge">{t('dayN', { n: run.day })}</span><span className="small muted">{t('mapHint')}</span></span>}
        right={<span className="badge">{t('deckCount', { n: state.unlocked.length, total: WORDS.length })}</span>}
      />
      <div className="map-area" role="group" aria-label={t('mapHint')}>
        <div className="map-field" style={{ '--gaps': map.layers - 1 } as CSSProperties}>
          <svg className="map-edges" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            {map.nodes.flatMap((n) => n.next.map((id) => {
              const m = nodeById(map, id);
              const taken = visited.has(n.id) && visited.has(id) && run.visited.indexOf(id) === run.visited.indexOf(n.id) + 1;
              const open = n.id === current.id && reachable.has(id);
              const p = at(n);
              const q = at(m);
              return <line key={n.id + id} className={taken ? 'taken' : open ? 'open' : ''} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
            }))}
          </svg>
          {map.nodes.map((n) => {
            const canGo = reachable.has(n.id);
            const cls = ['map-node', n.type];
            if (visited.has(n.id)) cls.push('visited');
            if (n.id === current.id) cls.push('current');
            if (canGo) cls.push('reachable');
            else if (!visited.has(n.id)) cls.push('locked');
            const { t: tt, c } = place(n);
            const name = label(n);
            return (
              <button
                key={n.id}
                type="button"
                className={cls.join(' ')}
                style={{ '--t': tt, '--c': c } as CSSProperties}
                title={name}
                aria-label={n.type === 'start' ? name : `${name} (${t(NODE_KEY[n.type])})`}
                aria-current={n.id === current.id ? 'location' : undefined}
                aria-disabled={!canGo}
                tabIndex={canGo ? 0 : -1}
                onClick={() => { if (canGo) update((s) => enterNode(s, n.id)); }}
              >
                <span className="dot" aria-hidden="true">{NODE_ICON[n.type]}</span>
                {(canGo || (n.type === 'boss' && bossNamed)) && <span className="label" aria-hidden="true">{name}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="actions">
        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={onExit}><Icon name="back" /> {t('backToCamp')}</button>
          <button type="button" className="btn ghost" onClick={abandon}>{t('abandonRun')}</button>
        </div>
      </div>
    </div>
  );
}
