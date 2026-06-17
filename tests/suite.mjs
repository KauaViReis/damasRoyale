/* ============================================================
   DAMAS ROYALE — Suíte de testes (lógica pura, sem dependências)
   Cobre rules.js, elo.js e ai.js. Roda no Node e no navegador.
   ============================================================ */

import {
  idx, isDark, initBoard, genMoves, applyMove,
  serializeMove, deserializeMove, sameMove, boardKey, countPieces,
  moveToNotation, posToNotation
} from '../js/rules.js';
import { kFactor, expectedScore, eloDelta, ratingTitle, RATING_INICIAL } from '../js/elo.js';
import { evaluate, bestMove, getHint } from '../js/ai.js';

/* ---- micro-framework ---- */
let passed = 0, failed = 0;
const fails = [];
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; fails.push(`✗ ${name}\n    ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'esperado'}: ${JSON.stringify(b)}, obtido: ${JSON.stringify(a)}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'condição falsa'); }
const board = () => new Int8Array(64);

/* ============ RULES — posição inicial ============ */
test('initBoard coloca 12 peças de cada lado', () => {
  const bd = board(); initBoard(bd);
  const c = countPieces(bd);
  eq(c.men1, 12, 'men1'); eq(c.men2, 12, 'men2');
  eq(c.kings1, 0, 'kings1'); eq(c.kings2, 0, 'kings2');
});

test('aberturas: 7 lances simples para cada lado', () => {
  const bd = board(); initBoard(bd);
  eq(genMoves(bd, 1).length, 7, 'lances das claras');
  eq(genMoves(bd, -1).length, 7, 'lances das escuras');
  ok(genMoves(bd, 1).every(m => !m.capture), 'nenhuma captura na abertura');
});

/* ============ RULES — captura obrigatória + lei da maioria ============ */
test('lei da maioria: só o lance de maior captura é permitido', () => {
  const bd = board();
  bd[idx(6, 1)] = 1;  // peça A: cadeia de 2
  bd[idx(6, 5)] = 1;  // peça B: captura simples
  bd[idx(5, 2)] = -1; bd[idx(3, 4)] = -1;  // vítimas de A
  bd[idx(5, 6)] = -1;                       // vítima de B
  const ms = genMoves(bd, 1);
  eq(ms.length, 1, 'apenas a cadeia máxima');
  ok(ms[0].capture, 'é captura');
  eq(ms[0].steps.length, 2, 'duas capturas');
  eq(ms[0].from[0], 6, 'origem r'); eq(ms[0].from[1], 1, 'origem c (B excluído)');
});

test('captura é obrigatória quando existe', () => {
  const bd = board();
  bd[idx(5, 2)] = 1;
  bd[idx(4, 3)] = -1;   // (5,2) salta (4,3) -> (3,4)
  const ms = genMoves(bd, 1);
  ok(ms.length >= 1 && ms.every(m => m.capture), 'todos os lances são capturas');
});

test('pedra captura para trás também (regra brasileira)', () => {
  const bd = board();
  bd[idx(2, 2)] = 1;     // pedra das claras já avançada
  bd[idx(3, 3)] = -1;    // vítima atrás dela (r maior)
  const ms = genMoves(bd, 1);
  ok(ms.some(m => m.capture && m.steps.some(s => s.capR === 3 && s.capC === 3)),
    'captura para trás disponível');
});

/* ============ RULES — dama voadora ============ */
test('dama anda longe sem capturar', () => {
  const bd = board();
  bd[idx(7, 0)] = 2;     // dama das claras no canto
  const ms = genMoves(bd, 1);
  ok(ms.every(m => !m.capture), 'sem capturas');
  eq(ms.length, 7, 'toda a diagonal livre (7 casas)');
});

test('dama captura à distância (voadora) e pousa além', () => {
  const bd = board();
  bd[idx(7, 0)] = 2;
  bd[idx(4, 3)] = -1;    // vítima distante na diagonal
  const ms = genMoves(bd, 1);
  ok(ms.length >= 1 && ms.every(m => m.capture), 'capturas obrigatórias');
  ok(ms.some(m => {
    const last = m.steps[m.steps.length - 1];
    return last.r < 4;   // pousou além da vítima (3,4)/(2,5)/(1,6)/(0,7)
  }), 'pousa além da vítima');
});

/* ============ RULES — promoção ============ */
test('pedra promove ao terminar na última linha', () => {
  const bd = board();
  bd[idx(1, 2)] = 1;
  const m = genMoves(bd, 1).find(x => x.steps[0].r === 0);
  ok(m, 'há lance para a linha 0');
  applyMove(bd, m);
  const last = m.steps[m.steps.length - 1];
  eq(bd[idx(last.r, last.c)], 2, 'virou dama');
});

test('pedra NÃO promove fora da última linha', () => {
  const bd = board();
  bd[idx(4, 2)] = 1;
  const m = genMoves(bd, 1).find(x => x.steps[0].r === 3);
  applyMove(bd, m);
  const last = m.steps[m.steps.length - 1];
  eq(bd[idx(last.r, last.c)], 1, 'continua pedra');
});

/* ============ RULES — serialização / notação / chave ============ */
test('serializeMove ↔ deserializeMove (ida e volta)', () => {
  const bd = board();
  bd[idx(6, 1)] = 1; bd[idx(5, 2)] = -1; bd[idx(3, 4)] = -1;
  const m = genMoves(bd, 1)[0];
  const back = deserializeMove(serializeMove(m));
  ok(sameMove(m, back), 'mesmo lance após round-trip');
  eq(back.capture, m.capture, 'flag de captura preservada');
});

test('boardKey muda conforme o turno e o tabuleiro', () => {
  const bd = board(); initBoard(bd);
  ok(boardKey(bd, 1) !== boardKey(bd, -1), 'turno afeta a chave');
  const bd2 = board(); initBoard(bd2); bd2[idx(5, 2)] = 0;
  ok(boardKey(bd, 1) !== boardKey(bd2, 1), 'posição afeta a chave');
});

test('notação algébrica básica', () => {
  eq(posToNotation(7, 0), 'a1', 'canto inferior-esquerdo');
  eq(posToNotation(0, 7), 'h8', 'canto superior-direito');
});

/* ============ ELO ============ */
test('expectedScore é 0.5 entre iguais e simétrico', () => {
  eq(expectedScore(1000, 1000), 0.5, 'iguais');
  ok(expectedScore(1200, 1000) > 0.5, 'favorito > 0.5');
  ok(Math.abs(expectedScore(1200, 1000) + expectedScore(1000, 1200) - 1) < 1e-9, 'soma = 1');
});

test('kFactor cai com a experiência', () => {
  eq(kFactor(0), 40); eq(kFactor(9), 40);
  eq(kFactor(10), 32); eq(kFactor(29), 32);
  eq(kFactor(30), 24); eq(kFactor(500), 24);
});

test('eloDelta: vitória sobe, derrota desce, empate ~0 entre iguais', () => {
  eq(eloDelta(1000, 1000, 1, 5), 20, 'vitória novato');
  eq(eloDelta(1000, 1000, 0, 5), -20, 'derrota novato');
  eq(eloDelta(1000, 1000, 0.5, 5), 0, 'empate igual');
  ok(eloDelta(1000, 1400, 1, 30) > eloDelta(1400, 1000, 1, 30), 'zebra vale mais');
});

test('ratingTitle nos limiares', () => {
  eq(ratingTitle(1000), 'INICIANTE');
  eq(ratingTitle(1050), 'COMPETIDOR');
  eq(ratingTitle(1200), 'VETERANO');
  eq(ratingTitle(1400), 'EXPERT');
  eq(ratingTitle(1600), 'MESTRE');
  eq(ratingTitle(1800), 'GRÃO-MESTRE');
});

/* ============ IA ============ */
test('evaluate ~0 na posição inicial (simétrica)', () => {
  const bd = board(); initBoard(bd);
  ok(Math.abs(evaluate(bd)) < 5, `eval inicial deveria ser ~0, foi ${evaluate(bd)}`);
});

test('evaluate favorece quem tem mais material', () => {
  const bd = board();
  bd[idx(5, 2)] = 1; bd[idx(5, 4)] = 1;   // claras +2 pedras
  bd[idx(2, 3)] = -1;                       // escuras 1 pedra
  ok(evaluate(bd) > 0, 'vantagem material das claras → positivo');
});

test('bestMove/getHint retornam lance legal', () => {
  const bd = board(); initBoard(bd);
  const legais = genMoves(bd, 1);
  const mv = bestMove(bd, 1, 4, false);
  ok(mv && legais.some(m => sameMove(m, mv)), 'bestMove é legal');
  const hint = getHint(bd, 1);
  ok(hint && legais.some(m => sameMove(m, hint)), 'getHint é legal');
});

test('IA escolhe a captura quando obrigatória', () => {
  const bd = board();
  bd[idx(5, 2)] = 1; bd[idx(4, 3)] = -1;   // captura disponível
  bd[idx(7, 0)] = 1;                        // peça alternativa sem captura
  const mv = bestMove(bd, 1, 4, false);
  ok(mv.capture, 'a IA não ignora a captura obrigatória');
});

/* ============ RELATÓRIO ============ */
export function run() {
  const total = passed + failed;
  const lines = [`\nDAMAS ROYALE — testes: ${passed}/${total} passaram`];
  if (failed) lines.push('', ...fails);
  const report = lines.join('\n');
  return { passed, failed, total, report };
}

/* Execução automática no Node */
if (typeof process !== 'undefined' && process.argv?.[1]?.includes('suite.mjs')) {
  const r = run();
  console.log(r.report);
  process.exit(r.failed ? 1 : 0);
}
