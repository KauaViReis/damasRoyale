/* ============================================================
   DAMAS ROYALE — Conquistas / Medalhas
   Catálogo puro + avaliação. Os predicados recebem um contexto
   montado no fim da partida e devolvem os ids desbloqueados.
   ============================================================ */

/* ctx = {
     result: 'win' | 'loss' | 'draw',
     myCaptures: número de peças que capturei na partida,
     lostPieces: número de peças minhas capturadas,
     madeKing: promovi uma dama nesta partida?,
     profile: { games, wins, bestStreak, streak, rating },
     leagueUp: subi de liga/divisão nesta partida?
   } */

export const ACHIEVEMENTS = [
  { id: 'first_win',   icon: '🏆', name: 'PRIMEIRA VITÓRIA',
    desc: 'Vença a sua primeira partida online.',
    check: c => c.result === 'win' && c.profile.wins >= 1 },

  { id: 'first_dama',  icon: '👑', name: 'PRIMEIRA DAMA',
    desc: 'Promova uma peça a dama.',
    check: c => !!c.madeKing },

  { id: 'flawless',    icon: '🛡️', name: 'SEM ARRANHÕES',
    desc: 'Vença sem perder nenhuma peça.',
    check: c => c.result === 'win' && c.lostPieces === 0 },

  { id: 'hunter',      icon: '🎯', name: 'CAÇADOR',
    desc: 'Capture 6 ou mais peças em uma partida.',
    check: c => c.myCaptures >= 6 },

  { id: 'streak_3',    icon: '🔥', name: 'EMBALADO',
    desc: 'Vença 3 partidas seguidas.',
    check: c => (c.profile.streak || 0) >= 3 },

  { id: 'streak_10',   icon: '⚡', name: 'IMPARÁVEL',
    desc: 'Vença 10 partidas seguidas.',
    check: c => (c.profile.bestStreak || 0) >= 10 },

  { id: 'games_10',    icon: '🎲', name: 'VETERANO',
    desc: 'Jogue 10 partidas online.',
    check: c => (c.profile.games || 0) >= 10 },

  { id: 'games_100',   icon: '💯', name: 'CENTENÁRIO',
    desc: 'Jogue 100 partidas online.',
    check: c => (c.profile.games || 0) >= 100 },

  { id: 'promotion',   icon: '📈', name: 'ASCENSÃO',
    desc: 'Suba de liga ou divisão.',
    check: c => !!c.leagueUp }
];

const BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
export const getAchievement = id => BY_ID.get(id) || null;

/* Avalia o catálogo e devolve os ids cujo predicado é verdadeiro. */
export function evaluateAchievements(ctx) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    try { if (a.check(ctx)) out.push(a.id); } catch { /* predicado tolerante */ }
  }
  return out;
}
