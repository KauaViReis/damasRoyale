/* ============================================================
   DAMAS ROYALE — Ligas competitivas
   9 ligas (Ferro→Grão-Mestre) com subdivisões I–IV, derivadas do Elo.
   Faixas: divisão = 50 Elo, liga = 200 Elo, base = 600.
   Grão-Mestre é o ápice (sem divisões).
   ============================================================ */

export const BASE_RATING = 600;
export const DIVISION_WIDTH = 50;
export const LEAGUE_WIDTH = 200;   /* 4 divisões */

/* Ordem e identidade visual das ligas */
export const LEAGUES = [
  { key: 'ferro',       name: 'FERRO',       color: '#7d7d7d' },
  { key: 'bronze',      name: 'BRONZE',      color: '#cd7f32' },
  { key: 'prata',       name: 'PRATA',       color: '#c0c6cc' },
  { key: 'ouro',        name: 'OURO',        color: '#e3a94e' },
  { key: 'platina',     name: 'PLATINA',     color: '#4fd1c5' },
  { key: 'esmeralda',   name: 'ESMERALDA',   color: '#2ecc71' },
  { key: 'diamante',    name: 'DIAMANTE',    color: '#5da9e9' },
  { key: 'mestre',      name: 'MESTRE',      color: '#b06be3' },
  { key: 'graomestre',  name: 'GRÃO-MESTRE', color: '#e3554b' }
];

/* Divisões da mais baixa (IV) para a mais alta (I) */
const DIVISIONS = ['IV', 'III', 'II', 'I'];
const APEX = LEAGUES.length - 1;           /* índice do Grão-Mestre */
const APEX_MIN = BASE_RATING + APEX * LEAGUE_WIDTH;   /* 2200 */
const APEX_SPAN = 400;                     /* escala da barra de progresso no ápice */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Descreve a liga/divisão de um rating.
   Retorna { index, key, name, division, label, color, minRating,
             nextRating, progressPct, isApex } */
export function leagueOf(rating) {
  const r = Math.round(rating || 0);
  const index = clamp(Math.floor((r - BASE_RATING) / LEAGUE_WIDTH), 0, APEX);
  const league = LEAGUES[index];
  const leagueBase = BASE_RATING + index * LEAGUE_WIDTH;

  if (index === APEX) {
    const into = Math.max(0, r - APEX_MIN);
    return {
      index, key: league.key, name: league.name,
      division: null, label: league.name, color: league.color,
      minRating: APEX_MIN, nextRating: null,
      progressPct: clamp((into / APEX_SPAN) * 100, 0, 100),
      isApex: true
    };
  }

  const offset = clamp(r - leagueBase, 0, LEAGUE_WIDTH - 1);
  const divIdx = Math.floor(offset / DIVISION_WIDTH);          /* 0..3 */
  const division = DIVISIONS[divIdx];
  const minRating = leagueBase + divIdx * DIVISION_WIDTH;
  const nextRating = minRating + DIVISION_WIDTH;
  const progressPct = clamp(((r - minRating) / DIVISION_WIDTH) * 100, 0, 100);

  return {
    index, key: league.key, name: league.name,
    division, label: `${league.name} ${division}`, color: league.color,
    minRating, nextRating, progressPct, isApex: false
  };
}

/* Título curto exibido (compatível com ratingTitle antigo) */
export function leagueLabel(rating) {
  return leagueOf(rating).label;
}
