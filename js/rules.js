/* ============================================================
   DAMAS 3D — Regras Brasileiras (Lógica Pura)
   • Captura obrigatória + Lei da Maioria (máximo de peças)
   • Pedra captura para frente e para trás
   • Dama voadora (move e captura a qualquer distância)
   • Promoção apenas quando o lance TERMINA na última linha
   • Peça capturada não pode ser saltada duas vezes
   ============================================================ */

export const N = 8;
export const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
export const idx = (r, c) => r * 8 + c;
export const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const isDark = (r, c) => ((r + c) & 1) === 1;

/* Notação algébrica: coluna a-h, linha 8-1 (de cima para baixo no array) */
const COL = 'abcdefgh';
export function posToNotation(r, c) {
  return COL[c] + (8 - r);
}

export function moveToNotation(move) {
  const from = posToNotation(move.from[0], move.from[1]);
  const sep = move.capture ? 'x' : '-';
  if (move.steps.length === 1) {
    return from + sep + posToNotation(move.steps[0].r, move.steps[0].c);
  }
  return from + move.steps.map(s => sep + posToNotation(s.r, s.c)).join('');
}

/* DFS para capturas de pedra (homem) */
function manCapDFS(bd, player, r, c, cap, path, res) {
  let found = false;
  for (const [dr, dc] of DIRS) {
    const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
    if (!inB(lr, lc)) continue;
    const mi = idx(mr, mc), li = idx(lr, lc);
    const mv = bd[mi];
    if (mv !== 0 && Math.sign(mv) !== player && !cap.has(mi) && bd[li] === 0) {
      found = true;
      cap.add(mi);
      path.push({ r: lr, c: lc, capR: mr, capC: mc });
      manCapDFS(bd, player, lr, lc, cap, path, res);
      path.pop();
      cap.delete(mi);
    }
  }
  if (!found && path.length) res.push(path.slice());
}

/* DFS para capturas de dama (voadora) */
function kingCapDFS(bd, player, r, c, cap, path, res) {
  let found = false;
  for (const [dr, dc] of DIRS) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc) && bd[idx(rr, cc)] === 0) { rr += dr; cc += dc; }
    if (!inB(rr, cc)) continue;
    const mi = idx(rr, cc), mv = bd[mi];
    if (Math.sign(mv) === player || cap.has(mi)) continue;
    let lr = rr + dr, lc = cc + dc;
    while (inB(lr, lc) && bd[idx(lr, lc)] === 0) {
      found = true;
      cap.add(mi);
      path.push({ r: lr, c: lc, capR: rr, capC: cc });
      kingCapDFS(bd, player, lr, lc, cap, path, res);
      path.pop();
      cap.delete(mi);
      lr += dr; lc += dc;
    }
  }
  if (!found && path.length) res.push(path.slice());
}

/* Gera todos os movimentos legais para um jogador */
export function genMoves(bd, player) {
  const caps = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const v = bd[idx(r, c)];
    if (v === 0 || Math.sign(v) !== player) continue;
    const res = [], cap = new Set();
    bd[idx(r, c)] = 0;
    if (Math.abs(v) === 2) kingCapDFS(bd, player, r, c, cap, [], res);
    else manCapDFS(bd, player, r, c, cap, [], res);
    bd[idx(r, c)] = v;
    for (const seq of res) caps.push({ from: [r, c], steps: seq, capture: true });
  }
  if (caps.length) {
    let max = 0;
    for (const m of caps) if (m.steps.length > max) max = m.steps.length;
    return caps.filter(m => m.steps.length === max);
  }
  const moves = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const v = bd[idx(r, c)];
    if (v === 0 || Math.sign(v) !== player) continue;
    if (Math.abs(v) === 1) {
      const dr = player === 1 ? -1 : 1;
      for (const dc of [-1, 1]) {
        const nr = r + dr, nc = c + dc;
        if (inB(nr, nc) && bd[idx(nr, nc)] === 0)
          moves.push({ from: [r, c], steps: [{ r: nr, c: nc }], capture: false });
      }
    } else {
      for (const [dr, dc] of DIRS) {
        let nr = r + dr, nc = c + dc;
        while (inB(nr, nc) && bd[idx(nr, nc)] === 0) {
          moves.push({ from: [r, c], steps: [{ r: nr, c: nc }], capture: false });
          nr += dr; nc += dc;
        }
      }
    }
  }
  return moves;
}

/* Aplica um movimento ao tabuleiro (muta o array) */
export function applyMove(bd, m) {
  const fi = idx(m.from[0], m.from[1]);
  let v = bd[fi];
  bd[fi] = 0;
  for (const s of m.steps) if (s.capR !== undefined) bd[idx(s.capR, s.capC)] = 0;
  const last = m.steps[m.steps.length - 1];
  const player = v > 0 ? 1 : -1;
  if (Math.abs(v) === 1 && last.r === (player === 1 ? 0 : 7)) v = 2 * player;
  bd[idx(last.r, last.c)] = v;
}

/* ====== Serialização de lances (modo online) ====== */
export function serializeMove(m) {
  return JSON.stringify({
    f: m.from,
    s: m.steps.map(s => s.capR !== undefined
      ? [s.r, s.c, s.capR, s.capC]
      : [s.r, s.c]),
    c: m.capture ? 1 : 0
  });
}

export function deserializeMove(str) {
  const o = JSON.parse(str);
  return {
    from: o.f,
    steps: o.s.map(a => a.length === 4
      ? { r: a[0], c: a[1], capR: a[2], capC: a[3] }
      : { r: a[0], c: a[1] }),
    capture: !!o.c
  };
}

/* Compara um lance recebido com um lance gerado localmente */
export function sameMove(a, b) {
  if (a.from[0] !== b.from[0] || a.from[1] !== b.from[1]) return false;
  if (a.steps.length !== b.steps.length) return false;
  for (let i = 0; i < a.steps.length; i++) {
    if (a.steps[i].r !== b.steps[i].r || a.steps[i].c !== b.steps[i].c) return false;
  }
  return true;
}

/* Chave única da posição (para detecção de repetição tripla) */
export function boardKey(bd, turn) {
  let k = turn === 1 ? 'w' : 'b';
  for (let i = 0; i < 64; i++) if (bd[i] !== 0) k += i + ':' + bd[i] + ';';
  return k;
}

/* Conta peças de cada jogador: { men1, kings1, men2, kings2 } */
export function countPieces(bd) {
  const n = { men1: 0, kings1: 0, men2: 0, kings2: 0 };
  for (let i = 0; i < 64; i++) {
    const v = bd[i];
    if (v === 1) n.men1++;
    else if (v === 2) n.kings1++;
    else if (v === -1) n.men2++;
    else if (v === -2) n.kings2++;
  }
  return n;
}

/* Inicializa o tabuleiro na posição padrão */
export function initBoard(bd) {
  bd.fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if (isDark(r, c)) bd[idx(r, c)] = -1;
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if (isDark(r, c)) bd[idx(r, c)] = 1;
}
