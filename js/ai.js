/* ============================================================
   DAMAS ROYALE — Inteligência Artificial
   Minimax com poda Alfa-Beta + Quiescence Search
   Avaliação: material, avanço, centro, defesa da base
   ============================================================ */

import { genMoves, applyMove } from './rules.js';

/* Avaliação heurística da posição (positivo = bom para o jogador 1) */
export function evaluate(bd) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const v = bd[i];
    if (v === 0) continue;
    const r = i >> 3, c = i & 7;
    const isKing = Math.abs(v) === 2;
    let val = isKing ? 290 : 100;
    if (!isKing) {
      /* Avanço em direção à promoção */
      val += (v > 0 ? (7 - r) : r) * 4;
      /* Pedras guardando a própria base dificultam promoções inimigas */
      if ((v > 0 && r === 7) || (v < 0 && r === 0)) val += 8;
      /* Bordas são mais seguras, mas menos ativas: leve bônus central */
      val += (3.5 - Math.abs(3.5 - c)) * 2;
    } else {
      /* Damas valem mais no centro (mobilidade) */
      val += (3.5 - Math.abs(3.5 - r)) * 3 + (3.5 - Math.abs(3.5 - c)) * 3;
    }
    s += v > 0 ? val : -val;
  }
  return s;
}

/* Ordena movimentos para melhorar a poda (capturas longas e centrais primeiro) */
function orderMoves(moves) {
  return moves.slice().sort((a, b) => {
    if (a.steps.length !== b.steps.length) return b.steps.length - a.steps.length;
    const aL = a.steps[a.steps.length - 1];
    const bL = b.steps[b.steps.length - 1];
    const aDist = Math.abs(3.5 - aL.r) + Math.abs(3.5 - aL.c);
    const bDist = Math.abs(3.5 - bL.r) + Math.abs(3.5 - bL.c);
    return aDist - bDist;
  });
}

/* Busca Minimax com alfa-beta e quiescence */
function search(b, d, alpha, beta, player, q) {
  const moves = genMoves(b, player);
  if (moves.length === 0) return player === 1 ? -100000 - d : 100000 + d;
  const isCap = moves[0].capture;
  if (d <= 0 && (!isCap || q <= 0)) return evaluate(b);
  const nd = d > 0 ? d - 1 : 0, nq = d > 0 ? q : q - 1;
  const ordered = orderMoves(moves);
  if (player === 1) {
    let best = -Infinity;
    for (const m of ordered) {
      const nb = b.slice(); applyMove(nb, m);
      const sc = search(nb, nd, alpha, beta, -1, nq);
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of ordered) {
      const nb = b.slice(); applyMove(nb, m);
      const sc = search(nb, nd, alpha, beta, 1, nq);
      if (sc < best) best = sc;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

/* Melhor lance para qualquer jogador.
   randomize=true varia entre lances quase equivalentes (aberturas diferentes) */
export function bestMove(bd, player, depth, randomize = true) {
  const moves = genMoves(bd, player);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const scored = [];
  let best = player === 1 ? -Infinity : Infinity;
  for (const m of orderMoves(moves)) {
    const nb = bd.slice(); applyMove(nb, m);
    const sc = search(nb, depth - 1, -Infinity, Infinity, -player, 6);
    scored.push({ m, sc });
    if (player === 1 ? sc > best : sc < best) best = sc;
  }
  if (!randomize) {
    return scored.find(x => x.sc === best).m;
  }
  /* Tolerância maior em dificuldades menores para variar aberturas */
  const tol = depth <= 2 ? 40 : depth <= 4 ? 12 : 1;
  const pool = scored.filter(x => player === 1 ? x.sc >= best - tol : x.sc <= best + tol);
  return pool[Math.floor(Math.random() * pool.length)].m;
}

/* IA padrão (joga com as escuras, jogador -1) */
export const bestMoveAI = (bd, depth) => bestMove(bd, -1, depth, true);

/* Sugestão de lance para o jogador atual (botão DICA) */
export const getHint = (bd, player) => bestMove(bd, player, 5, false);
