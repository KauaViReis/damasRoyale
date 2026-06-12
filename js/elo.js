/* ============================================================
   DAMAS ROYALE — Sistema de Rating (Elo)
   K dinâmico: jogadores novos sobem/descem mais rápido
   ============================================================ */

export const RATING_INICIAL = 1000;

/* Fator K conforme experiência do jogador */
export function kFactor(games) {
  if (games < 10) return 40;
  if (games < 30) return 32;
  return 24;
}

/* Pontuação esperada do jogador A contra B */
export function expectedScore(ra, rb) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/* Variação de rating: score = 1 (vitória), 0.5 (empate), 0 (derrota) */
export function eloDelta(myRating, oppRating, score, myGames = 30) {
  const k = kFactor(myGames);
  return Math.round(k * (score - expectedScore(myRating, oppRating)));
}

/* Título exibido conforme o rating */
export function ratingTitle(r) {
  if (r >= 1800) return 'GRÃO-MESTRE';
  if (r >= 1600) return 'MESTRE';
  if (r >= 1400) return 'EXPERT';
  if (r >= 1200) return 'VETERANO';
  if (r >= 1050) return 'COMPETIDOR';
  return 'INICIANTE';
}
