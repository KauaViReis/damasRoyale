/* ============================================================
   DAMAS ROYALE — Constantes compartilhadas
   Dados puros (sem estado nem dependências) usados pelo main.js
   ============================================================ */

/* Chaves de persistência no localStorage */
export const PREFS_KEY = 'damasRoyale.prefs';
export const ACTIVE_KEY = 'damasRoyale.activeGame';

/* Estados da máquina de turnos */
export const ST = { menu: 0, human: 1, anim: 2, ai: 3, over: 4, remote: 5, replay: 6 };

/* Controles de tempo online (base + acréscimo por lance, em ms; 0 = livre) */
export const TC_PRESETS = {
  0: { base: 0, inc: 0 },
  3: { base: 3 * 60000, inc: 2000 },
  5: { base: 5 * 60000, inc: 2000 },
  10: { base: 10 * 60000, inc: 5000 }
};

/* Texto exibido no fim de jogo conforme o motivo */
export const REASON_TXT = {
  resign: 'VITÓRIA POR DESISTÊNCIA',
  abandon: 'O OPONENTE ABANDONOU A PARTIDA',
  timeout: 'VITÓRIA POR TEMPO ESGOTADO',
  draw: 'EMPATE ACORDADO ENTRE OS JOGADORES',
  repetition: 'EMPATE POR REPETIÇÃO TRIPLA DE POSIÇÃO',
  kings20: 'EMPATE: 20 LANCES DE DAMAS SEM CAPTURA'
};
