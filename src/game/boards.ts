/**
 * Plateaux de jeu, un par lieu (maquettes Claude Design « Plateaux de jeu Rìcháng ») : la matiere du lieu remplace le
 * fond flou du combat et un tapis en creux recoit la main, avec un filet et le sceau rouge du lieu en chinois.
 * Matieres et couleurs : src/boards.css (.battle[data-board="<lieu>"]). Ici : le sceau et le bord du tapis.
 */
export type MatEdge = 'line' | 'stitch' | 'perf' | 'double' | 'frame' | 'fringe';

export interface Board {
  /** Nom du lieu, ecrit sur le sceau. */
  seal: string;
  /** Bord du tapis : filet, couture, perforations de timbre, double filet dore, cadre de tableau noir, serviette. */
  edge: MatEdge;
}

export const BOARDS: Record<string, Board> = {
  'night-market': { seal: '夜市', edge: 'line' },
  'drink-shop': { seal: '飲料店', edge: 'line' },
  'convenience-store': { seal: '超商', edge: 'line' },
  market: { seal: '市場', edge: 'line' },
  'family-dinner': { seal: '家宴', edge: 'line' },
  'small-talk': { seal: '咖啡廳', edge: 'line' },
  'hardware-store': { seal: '五金行', edge: 'line' },
  'clothes-shopping': { seal: '服飾店', edge: 'stitch' },
  pharmacy: { seal: '藥局', edge: 'line' },
  'post-office': { seal: '郵局', edge: 'perf' },
  bank: { seal: '銀行', edge: 'line' },
  mrt: { seal: '捷運', edge: 'line' },
  taxi: { seal: '計程車', edge: 'line' },
  airport: { seal: '機場', edge: 'line' },
  'scooter-rental': { seal: '機車行', edge: 'line' },
  directions: { seal: '街角', edge: 'line' },
  greetings: { seal: '公園', edge: 'line' },
  'daily-life': { seal: '我家', edge: 'line' },
  landlord: { seal: '租屋', edge: 'line' },
  neighbors: { seal: '樓梯間', edge: 'line' },
  'moving-in': { seal: '新家', edge: 'stitch' },
  utilities: { seal: '水電', edge: 'line' },
  weather: { seal: '大廳', edge: 'line' },
  clinic: { seal: '診所', edge: 'line' },
  dentist: { seal: '牙科', edge: 'line' },
  gym: { seal: '健身房', edge: 'line' },
  hiking: { seal: '步道', edge: 'line' },
  beach: { seal: '海灘', edge: 'fringe' },
  office: { seal: '公司', edge: 'line' },
  classroom: { seal: '教室', edge: 'frame' },
  library: { seal: '圖書館', edge: 'double' },
  'job-interview': { seal: '會議室', edge: 'stitch' },
  'making-friends': { seal: '校園', edge: 'stitch' },
  residency: { seal: '移民署', edge: 'double' },
};
