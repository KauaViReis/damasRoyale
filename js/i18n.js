/* ============================================================
   DAMAS ROYALE — Internacionalização (i18n)
   Dicionários por chave. Elementos com [data-i18n] recebem o texto
   traduzido (apenas nós-folha, para não apagar filhos como badges).
   Strings dinâmicas (toasts) permanecem em PT por enquanto.
   ============================================================ */

export const LANGS = ['pt', 'en', 'es'];

const DICT = {
  pt: {
    subtitle: 'REGRAS OFICIAIS BRASILEIRAS',
    nick: 'SEU APELIDO',
    mode: 'MODO DE JOGO',
    mode_local: 'LOCAL', mode_ai: 'MÁQUINA', mode_online: 'ONLINE',
    difficulty: 'DIFICULDADE DA MÁQUINA',
    diff_easy: 'FÁCIL', diff_medium: 'MÉDIO', diff_hard: 'DIFÍCIL',
    time: 'TEMPO (MINUTOS)', time_free: 'LIVRE',
    pace: 'RITMO DA PARTIDA',
    quick: '⚡ PARTIDA RÁPIDA',
    players: '👥 JOGADORES ONLINE & DESAFIOS',
    friends: '🫂 AMIGOS',
    createRoom: 'CRIAR SALA', joinRoom: 'ENTRAR',
    spectate: '👁 ASSISTIR PARTIDAS AO VIVO',
    loadout: '🧰 PERSONALIZAR ARENA E EXÉRCITO',
    start: 'COMEÇAR PARTIDA',
    language: 'IDIOMA',
    rematch: 'JOGAR NOVAMENTE', share: '📸 COMPARTILHAR RESULTADO',
    backMenu: 'VOLTAR AO MENU',
    googleConnect: 'Entrar com Google', googleConnected: '✓ Conectado com Google',
    authSignin: 'ENTRAR'
  },
  en: {
    subtitle: 'OFFICIAL BRAZILIAN RULES',
    nick: 'YOUR NICKNAME',
    mode: 'GAME MODE',
    mode_local: 'LOCAL', mode_ai: 'COMPUTER', mode_online: 'ONLINE',
    difficulty: 'COMPUTER DIFFICULTY',
    diff_easy: 'EASY', diff_medium: 'MEDIUM', diff_hard: 'HARD',
    time: 'TIME (MINUTES)', time_free: 'UNLIMITED',
    pace: 'GAME PACE',
    quick: '⚡ QUICK MATCH',
    players: '👥 ONLINE PLAYERS & CHALLENGES',
    friends: '🫂 FRIENDS',
    createRoom: 'CREATE ROOM', joinRoom: 'JOIN',
    spectate: '👁 WATCH LIVE GAMES',
    loadout: '🧰 CUSTOMIZE ARENA & ARMY',
    start: 'START GAME',
    language: 'LANGUAGE',
    rematch: 'PLAY AGAIN', share: '📸 SHARE RESULT',
    backMenu: 'BACK TO MENU',
    googleConnect: 'Sign in with Google', googleConnected: '✓ Signed in with Google',
    authSignin: 'SIGN IN'
  },
  es: {
    subtitle: 'REGLAS OFICIALES BRASILEÑAS',
    nick: 'TU APODO',
    mode: 'MODO DE JUEGO',
    mode_local: 'LOCAL', mode_ai: 'MÁQUINA', mode_online: 'EN LÍNEA',
    difficulty: 'DIFICULTAD DE LA MÁQUINA',
    diff_easy: 'FÁCIL', diff_medium: 'MEDIO', diff_hard: 'DIFÍCIL',
    time: 'TIEMPO (MINUTOS)', time_free: 'LIBRE',
    pace: 'RITMO DE LA PARTIDA',
    quick: '⚡ PARTIDA RÁPIDA',
    players: '👥 JUGADORES EN LÍNEA Y DESAFÍOS',
    friends: '🫂 AMIGOS',
    createRoom: 'CREAR SALA', joinRoom: 'ENTRAR',
    spectate: '👁 VER PARTIDAS EN VIVO',
    loadout: '🧰 PERSONALIZAR ARENA Y EJÉRCITO',
    start: 'COMENZAR PARTIDA',
    language: 'IDIOMA',
    rematch: 'JUGAR DE NUEVO', share: '📸 COMPARTIR RESULTADO',
    backMenu: 'VOLVER AL MENÚ',
    googleConnect: 'Entrar con Google', googleConnected: '✓ Conectado con Google',
    authSignin: 'ENTRAR'
  }
};

export function t(key, lang = 'pt') {
  return (DICT[lang] && DICT[lang][key]) || DICT.pt[key] || key;
}

/* Aplica o idioma a todos os elementos com [data-i18n] */
export function applyI18n(lang) {
  if (!DICT[lang]) lang = 'pt';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n, lang);
    if (v) el.textContent = v;
  });
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
}
