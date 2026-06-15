/* ============================================================
   DAMAS ROYALE — Orquestrador Principal
   Modos: LOCAL (pvp) · MÁQUINA (pve) · ONLINE · ESPECTADOR · REPLAY
   ============================================================ */

import * as THREE from 'three';
import {
  idx, initBoard, genMoves, applyMove, boardKey,
  serializeMove, deserializeMove, sameMove, moveToNotation
} from './rules.js';
import { bestMoveAI, getHint, evaluate } from './ai.js';
import { BOARD_THEMES, PIECE_THEMES } from './themes.js';
import { AudioManager } from './audio.js';
import { MoveHistory } from './history.js';
import { createScene, createComposer } from './scene.js';
import { createBoard, worldPos } from './board3d.js';
import { createGeometries, makePiece, addCrown, animateStep } from './pieces3d.js';
import { FXManager } from './fx.js';
import { UIManager } from './ui.js';
import { InputManager } from './input.js';
import { OnlineManager } from './online.js';
import { isFirebaseConfigured } from './firebase-config.js';
import { sleep, vibrate, setHaptics, tween, easeOutBack } from './utils.js';

/* ============ PREFERÊNCIAS PERSISTIDAS ============ */
const PREFS_KEY = 'damasRoyale.prefs';
const ACTIVE_KEY = 'damasRoyale.activeGame';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; }
  catch { return {}; }
}
const prefs = loadPrefs();
function savePrefs() {
  prefs.boardTheme = boardThemeIdx;
  prefs.pieceTheme = pieceThemeIdx;
  prefs.muted = audio.muted;
  prefs.nick = nick;
  prefs.fx = effectsOn;
  prefs.tcOnline = tcChoice;
  prefs.music = audio.musicOn;
  prefs.musicVol = audio.musicVolume;
  prefs.evalOn = evalOn;
  prefs.haptics = hapticsOn;
  prefs.fogNear = fogNearMul;
  prefs.fogFar = fogFarMul;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ok */ }
}

/* Controles de tempo online (FASE 4): base + acréscimo por lance */
const TC_PRESETS = {
  0: { base: 0, inc: 0 },
  3: { base: 3 * 60000, inc: 2000 },
  5: { base: 5 * 60000, inc: 2000 },
  10: { base: 10 * 60000, inc: 5000 }
};

/* ============ ESTADO DO JOGO ============ */
const ST = { menu: 0, human: 1, anim: 2, ai: 3, over: 4, remote: 5, replay: 6 };
let state = ST.menu;
const bd = new Int8Array(64);
let turn = 1;
let mode = 'pvp';              /* pvp | pve | online | replay */

/* Apelidos com acesso de desenvolvedor (dica/análise no online) */
const DEV_NAMES = new Set(['KAUÃ2', 'KAUA2', 'KAUA3']);
function isDev() {
  const n = (ui.$('#nickInput').value || '').trim().toUpperCase();
  return DEV_NAMES.has(n);
}
/* Dica disponível fora do online; no online apenas para o dev */
function canUseHint() {
  return mode !== 'online' || isDev();
}
let depth = 4;
let allMoves = [];
let selected = null, seqs = [], stepIdx = 0;
let capCount = { '1': 0, '-1': 0 };
let winCount = { '1': 0, '-1': 0 };
let boardThemeIdx = prefs.boardTheme ?? 0;
if (boardThemeIdx >= BOARD_THEMES.length) boardThemeIdx = 0;
let pieceThemeIdx = prefs.pieceTheme ?? 0;
if (pieceThemeIdx >= PIECE_THEMES.length) pieceThemeIdx = 0;
let pieces = [];
let grid = new Array(64).fill(null);

/* Relógio local */
let timeLimit = 0;
let time1 = null, time2 = null;
let lastTickSec = -1;

/* Relógio online sincronizado (FASE 4) */
let onlineTc = { base: 0, inc: 0 };
let clockW = 0, clockB = 0;
let clockAnchor = 0;
let timeoutClaimed = false;

/* Desfazer (apenas vs máquina) */
let historyStack = [];

/* Drag & drop de peças */
let isDragging = false;
let dragPiece = null;
let dragStartX = 0, dragStartZ = 0;

/* Regras de empate */
let quietKingMoves = 0;
let repMap = new Map();

/* Anti-spam da proposta de empate: cooldown + máximo por partida */
const DRAW_OFFER_COOLDOWN_MS = 3000;
const DRAW_OFFER_MAX = 5;
let lastDrawOfferT = 0;
let drawOfferCount = 0;

/* Online */
let myColor = 0;
let spectating = false;
let applyingRemote = false;
let remoteQueue = [];
let nick = prefs.nick || 'JOGADOR';
let lastRoomCode = null;
let lastEmoteSent = 0;
let prevModeBeforeReplay = 'pvp';

/* Desafios */
let activeIncomingChallenge = null;
let unsubIncomingChallenges = null;
let unsubOutgoingChallenge = null;

/* Replay (FASE 6) */
let replayMoves = [];
let replayIdx = 0;
let replayPlaying = false;
let replayToken = 0;

/* Efeitos (FASE 9) */
let effectsOn = !!prefs.fx;
let composer = null;
let tcChoice = prefs.tcOnline ?? 0;

/* Melhorias do relatório */
let evalOn = !!prefs.evalOn;          /* barra de vantagem da IA */
let hapticsOn = prefs.haptics !== false;  /* vibração (padrão ligada) */
let fogNearMul = prefs.fogNear ?? 1.6;   /* multiplicador de fog perto */
let fogFarMul  = prefs.fogFar  ?? 3.8;   /* multiplicador de fog longe */

/* ============ INICIALIZAÇÃO ============ */
const canvas = document.getElementById('c3d');
const { scene, camera, renderer, materials, resize } = createScene(canvas);
const { squares } = createBoard(scene, materials);
const geos = createGeometries();
const fx = new FXManager(scene, camera);
const audio = new AudioManager();
const ui = new UIManager();
const history = new MoveHistory();
const input = new InputManager(canvas, camera, () => input.syncCamera());
const online = new OnlineManager();

audio.muted = !!prefs.muted;
audio.musicVolume = prefs.musicVol ?? 0.5;
ui.setSoundIcon(audio.muted);
setHaptics(hapticsOn);
history.bind(document.getElementById('history'));

/* ============ PEÇAS ============ */
function clearPieces() {
  for (const p of pieces) scene.remove(p.mesh);
  pieces = [];
  grid.fill(null);
}

function buildPieces(animateDrop = false) {
  clearPieces();
  const th = PIECE_THEMES[pieceThemeIdx];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const v = bd[idx(r, c)];
    if (v === 0) continue;
    const p = makePiece(scene, geos, v > 0 ? 1 : -1, r, c, th);
    if (Math.abs(v) === 2) { p.king = true; addCrown(p, geos, materials.gold, false); }
    pieces.push(p);
    grid[idx(r, c)] = p;
    
    if (animateDrop) {
      p.mesh.visible = false;
      setTimeout(() => {
        p.mesh.visible = true;
        p.mesh.position.y = 3.5 + Math.random() * 1.5;
        const startY = p.mesh.position.y;
        tween(550 + Math.random() * 200, k => {
          const e = easeOutBack(k);
          p.mesh.position.y = Math.max(0, startY * (1 - e));
        }).then(() => {
          p.mesh.position.y = 0;
          fx.spawnLandingDust(r, c, p.player === 1 ? th.p1 : th.p2);
        });
      }, Math.random() * 450);
    }
  }
}

/* ============ TEMAS ============ */
function applyBoardTheme(i) {
  boardThemeIdx = i;
  const t = BOARD_THEMES[i];
  materials.lightSq.color.set(t.light);
  materials.darkSq.color.set(t.dark);
  materials.frame.color.set(t.frame);
  materials.table.color.set(t.table);
  scene.background = new THREE.Color(t.bg);
  scene.fog = new THREE.Fog(t.fogColor || t.bg, t.fogNear || 16, t.fogFar || 42);
  fx.setWeather(t.weather || 'none');
  ui.updateBoardSwatches(i);
  savePrefs();
}

function applyPieceTheme(i) {
  pieceThemeIdx = i;
  const th = PIECE_THEMES[i];
  for (const p of pieces) p.mesh.material.color.set(p.player === 1 ? th.p1 : th.p2);
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
  refreshTurnUI();
  ui.updatePieceSwatches(i);
  savePrefs();
}

function moverColorHex(pl) {
  return PIECE_THEMES[pieceThemeIdx][pl === 1 ? 'p1' : 'p2'];
}

/* ============ FLUXO DE TURNOS ============ */
/* ============ TUTORIAL (FASE D) ============ */
let tutorialDone = localStorage.getItem('damasRoyale.tutorialDone') === 'true';
let tutorialStep = 0;

function updateTutorial() {
  if (tutorialDone) return;
  const overlay = ui.$('#tutorialOverlay');
  if (!overlay) return;
  const msg = ui.$('#tutorialMsg');
  
  if (state !== ST.human) {
    overlay.style.display = 'none';
    return;
  }
  
  overlay.style.display = 'block';
  if (tutorialStep === 0) {
    msg.innerHTML = "<b>Sua vez!</b><br>Toque em uma peça sua.";
    if (selected) tutorialStep = 1;
  }
  if (tutorialStep === 1) {
    if (!selected) {
      tutorialStep = 0;
      updateTutorial();
      return;
    }
    const hasCap = allMoves.some(m => m.capture);
    if (hasCap) msg.innerHTML = "<b>Captura obrigatória!</b><br>Toque no alvo vermelho para pular.";
    else msg.innerHTML = "<b>Movimento</b><br>Toque na casa de destino amarela.";
  }
}

function finishTutorial() {
  if (tutorialDone) return;
  tutorialDone = true;
  localStorage.setItem('damasRoyale.tutorialDone', 'true');
  const overlay = ui.$('#tutorialOverlay');
  if (overlay) overlay.style.display = 'none';
  ui.toast('Excelente! Boa sorte na partida.');
}

function refreshTurnUI() {
  if (state === ST.replay) {
    ui.$('#turnTxt').textContent = 'MODO REPLAY';
    ui.$('#spin').style.display = 'none';
    ui.$('#turnSub').style.display = 'none';
    return;
  }
  const waiting = state === ST.ai || state === ST.remote;
  ui.updateTurn(turn, waiting, allMoves[0]?.capture, mode, pieceThemeIdx,
    state === ST.remote
      ? (spectating ? 'ASSISTINDO AO VIVO' : 'AGUARDANDO OPONENTE…')
      : 'MÁQUINA PENSANDO…');
}

function deselect() {
  if (selected) {
    selected.mesh.material.emissive?.set(0x000000);
    selected.mesh.position.y = 0;
  }
  selected = null; seqs = []; stepIdx = 0;
  fx.clearFx();
  updateTutorial();
}

function saveState() {
  if (mode !== 'pve') return;
  historyStack.push({
    bd: new Int8Array(bd),
    turn,
    capCount: { ...capCount },
    quiet: quietKingMoves,
    rep: Array.from(repMap),
    entries: JSON.parse(JSON.stringify(history.entries))
  });
  ui.showUndo(historyStack.length > 0);
}

function undo() {
  if (state === ST.anim || historyStack.length === 0 || mode !== 'pve') return;
  const s = historyStack.pop();
  bd.set(s.bd);
  turn = s.turn;
  capCount = s.capCount;
  quietKingMoves = s.quiet;
  repMap = new Map(s.rep);
  history.entries = s.entries;
  history._render();
  ui.showUndo(historyStack.length > 0);
  buildPieces();
  fx.clearLastMove();
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
  startTurn();
}

function showCaptureRings() {
  if (allMoves[0]?.capture) {
    const seen = new Set();
    for (const m of allMoves) {
      const k = idx(m.from[0], m.from[1]);
      if (!seen.has(k)) { seen.add(k); fx.addRing(m.from[0], m.from[1], 0xE3554B); }
    }
  }
}

function startTurn() {
  deselect();
  allMoves = genMoves(bd, turn);
  if (allMoves.length === 0) { gameOver(-turn, ''); return; }
  refreshEvalBar();

  if (mode === 'pve' && turn === -1) {
    state = ST.ai;
    refreshTurnUI();
    aiPlay();
  } else if (mode === 'online' && turn !== myColor) {
    state = ST.remote;
    refreshTurnUI();
    tryPlayRemote();
  } else {
    state = ST.human;
    refreshTurnUI();
    showCaptureRings();
  }
  updateTutorial();
}

function selectPiece(p) {
  const ms = allMoves.filter(m => m.from[0] === p.r && m.from[1] === p.c);
  if (ms.length === 0) {
    ui.toast(allMoves[0]?.capture ? 'CAPTURA OBRIGATÓRIA!' : 'SEM MOVIMENTOS', true);
    audio.error();
    return;
  }
  deselect();
  showCaptureRings();
  selected = p; seqs = ms; stepIdx = 0;
  p.mesh.material.emissive.set(0xE3A94E);
  p.mesh.material.emissiveIntensity = 0.32;
  p.mesh.position.y = 0.12;
  showTargets();
  audio.select();
  updateTutorial();
}

function showTargets() {
  fx.clearDiscs();
  const seen = new Set();
  for (const m of seqs) {
    const s = m.steps[stepIdx];
    const k = idx(s.r, s.c);
    if (seen.has(k)) continue;
    seen.add(k);
    fx.addDisc(s.r, s.c, s.capR !== undefined ? 0xE3554B : 0xE3A94E);
  }
}

function onCaptureFx(victim, s, slowMotion = false) {
  audio.capture();
  fx.shake(slowMotion ? 0.6 : 0.3);
  vibrate(40);
  fx.spawnCaptureParticles(s.capR, s.capC, moverColorHex(victim.player));
  scene.remove(victim.mesh);
  pieces = pieces.filter(p => p !== victim);
  capCount[String(turn)]++;
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
}

/* Barra de vantagem (linha de análise): visível em local/máquina/replay,
   oculta no online para não dar assistência indevida (exceto isDev). */
function refreshEvalBar() {
  const visible = evalOn && (mode !== 'online' || isDev());
  ui.showEvalBar(visible);
  if (!visible) return;
  const names = {
    1: ui.pName(1, mode, pieceThemeIdx),
    '-1': ui.pName(-1, mode, pieceThemeIdx)
  };
  ui.updateEvalBar(evaluate(bd), names);
}

async function chooseDest(r, c) {
  seqs = seqs.filter(m => { const s = m.steps[stepIdx]; return s.r === r && s.c === c; });
  if (seqs.length === 0) return;
  const step = seqs[0].steps[stepIdx];
  state = ST.anim;
  fx.clearFx();
  const isLastStep = (stepIdx === seqs[0].steps.length - 1);
  let slowMotion = false;
  if (isLastStep) {
    const simBd = new Int8Array(bd);
    applyMove(simBd, seqs[0]);
    if (genMoves(simBd, -turn).length === 0) slowMotion = true;
  }

  await animateStep(selected, step, grid, onCaptureFx, slowMotion);
  fx.spawnLandingDust(step.r, step.c, moverColorHex(turn));
  if (step.capR === undefined) audio.move();

  stepIdx++;
  if (stepIdx < seqs[0].steps.length) {
    state = ST.human;
    selected.mesh.position.y = 0.12;
    showTargets();
  } else {
    finalizeMove(seqs[0]);
  }
}

/* Relógio exibido (online): valor gravado − tempo decorrido do turno atual */
function displayedClock(color) {
  const base = color === 1 ? clockW : clockB;
  if (turn !== color || state === ST.over || state === ST.menu) return base;
  return base - (performance.now() - clockAnchor);
}

async function finalizeMove(move) {
  finishTutorial();
  const last = move.steps[move.steps.length - 1];
  const piece = selected || grid[idx(last.r, last.c)];
  const mover = turn;
  const wasMan = Math.abs(bd[idx(move.from[0], move.from[1])]) === 1;
  const nCaps = move.steps.filter(s => s.capR !== undefined).length;

  /* Snapshot para o desfazer: estado ANTES do lance humano (vs máquina) */
  if (mode === 'pve' && mover === 1) saveState();

  history.record(move, mover);
  applyMove(bd, move);

  if (piece && !piece.king && last.r === (mover === 1 ? 0 : 7)) {
    piece.king = true;
    addCrown(piece, geos, materials.gold, true);
    audio.crown();
    ui.toast('DAMA! 👑');
    fx.spawnCrownParticles(last.r, last.c);
    fx.zoomPunch(3);
    vibrate([50, 50]);
  }
  if (nCaps >= 2) { fx.zoomPunch(4); fx.shake(0.45); }

  fx.setLastMove(move.from, [last.r, last.c]);
  deselect();
  ui.showDrawOffer(false);

  /* Relógio online (FASE 4): atualiza e envia junto com o lance */
  if (mode === 'online' && onlineTc.base > 0) {
    if (mover === myColor && !applyingRemote) {
      const rem = Math.max(0, displayedClock(mover)) + onlineTc.inc;
      if (mover === 1) clockW = rem; else clockB = rem;
      online.sendMove(serializeMove(move), rem);
    } else {
      const d = online.game?.data;
      if (d) { clockW = d.clockW ?? clockW; clockB = d.clockB ?? clockB; }
    }
    clockAnchor = performance.now();
  } else if (mode === 'online' && mover === myColor && !applyingRemote) {
    online.sendMove(serializeMove(move));
  }

  turn = -turn;

  /* ===== Regras de empate ===== */
  if (move.capture || wasMan) {
    quietKingMoves = 0;
    repMap.clear();
  } else {
    quietKingMoves++;
  }
  const key = boardKey(bd, turn);
  const reps = (repMap.get(key) || 0) + 1;
  repMap.set(key, reps);

  if (reps >= 3) { gameOver(0, 'repetition'); return; }
  if (quietKingMoves >= 40) { gameOver(0, 'kings20'); return; }

  /* Rotação automática de câmera (PvP local apenas) */
  if (mode === 'pvp') input.autoRotate();

  startTurn();
}

/* ============ IA ============ */
async function aiPlay() {
  await sleep(420);
  const move = bestMoveAI(bd, depth);
  if (!move) { gameOver(1, ''); return; }
  await playScriptedMove(move);
}

/* Anima um lance vindo da IA ou do oponente online */
async function playScriptedMove(move) {
  state = ST.anim;
  refreshTurnUI();
  const piece = grid[idx(move.from[0], move.from[1])];
  selected = piece;
  for (let i = 0; i < move.steps.length; i++) {
    const s = move.steps[i];
    let slowMotion = false;
    if (i === move.steps.length - 1) {
      const simBd = new Int8Array(bd);
      applyMove(simBd, move);
      if (genMoves(simBd, -turn).length === 0) slowMotion = true;
    }
    await animateStep(piece, s, grid, onCaptureFx, slowMotion);
    fx.spawnLandingDust(s.r, s.c, moverColorHex(turn));
    if (s.capR === undefined) audio.move();
    await sleep(60);
  }
  await finalizeMove(move);
}

/* ============ ONLINE: LANCES REMOTOS ============ */
async function tryPlayRemote() {
  if (state !== ST.remote || remoteQueue.length === 0) return;
  const serialized = remoteQueue.shift();
  const incoming = deserializeMove(serialized);
  const legal = allMoves.find(m => sameMove(m, incoming));
  if (!legal) {
    ui.toast('ERRO DE SINCRONIZAÇÃO', true);
    console.error('Lance remoto ilegal:', serialized);
    return;
  }
  applyingRemote = true;
  try {
    await playScriptedMove(legal);
  } finally {
    applyingRemote = false;
  }
}

/* Aplica um lance sem animação (recuperação de sessão / replay) */
function applySilently(mv) {
  const wasMan = Math.abs(bd[idx(mv.from[0], mv.from[1])]) === 1;
  history.record(mv, turn);
  applyMove(bd, mv);
  capCount[String(turn)] += mv.steps.filter(s => s.capR !== undefined).length;
  if (mv.capture || wasMan) { quietKingMoves = 0; repMap.clear(); }
  else quietKingMoves++;
  turn = -turn;
  const key = boardKey(bd, turn);
  repMap.set(key, (repMap.get(key) || 0) + 1);
  return mv;
}

/* ============ FIM DE JOGO ============ */
let cinematicOrbit = false;

const REASON_TXT = {
  resign: 'VITÓRIA POR DESISTÊNCIA',
  abandon: 'O OPONENTE ABANDONOU A PARTIDA',
  timeout: 'VITÓRIA POR TEMPO ESGOTADO',
  draw: 'EMPATE ACORDADO ENTRE OS JOGADORES',
  repetition: 'EMPATE POR REPETIÇÃO TRIPLA DE POSIÇÃO',
  kings20: 'EMPATE: 20 LANCES DE DAMAS SEM CAPTURA'
};

function gameOver(winner, reason = '', fromServer = false) {
  if (state === ST.over) return;
  state = ST.over;
  cinematicOrbit = true;
  input.target.set(0, -0.1, 0);
  input.radius = input.fitRadius();
  input.syncCamera();
  ui.showDrawOffer(false);
  ui.setPresence(null);
  ui.showEvalBar(false);
  ui.setActions({ hint: false, resign: false, draw: false, claim: false, emote: false, leaveWatch: false });
  if (winner !== 0) {
    winCount[String(winner)]++;
    fx.startFireworks(moverColorHex(winner));
  }
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
  audio.win();
  ui.showGameOver(winner, capCount, mode, pieceThemeIdx, REASON_TXT[reason] || '');
  document.getElementById('btnRematch').style.display =
    mode === 'online' ? 'none' : 'block';

  if (mode === 'online') {
    localStorage.removeItem(ACTIVE_KEY);
    if (!fromServer && !spectating) online.finishGame(winner, reason || 'game');
  }
}

function resetMatchState(animatePieces = false) {
  cinematicOrbit = false;
  ui.hideOverlay('over');
  ui.setRatingDelta('');
  ui.setPresence(null);
  deselect();
  fx.clearLastMove();
  fx.stopFireworks();
  capCount = { '1': 0, '-1': 0 };
  quietKingMoves = 0;
  repMap.clear();
  remoteQueue = [];
  timeoutClaimed = false;
  lastDrawOfferT = 0;
  drawOfferCount = 0;
  initBoard(bd);
  buildPieces(animatePieces);
  turn = 1;
  history.clear();
  historyStack = [];
  ui.showUndo(false);
  input.resetView();   /* recentraliza e reenquadra o tabuleiro */
}

function newGame() {
  resetMatchState(true);
  time1 = timeLimit > 0 && mode !== 'online' ? timeLimit : null;
  time2 = time1;
  ui.updateTimer(time1, time2);
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
  ui.setActions({
    hint: canUseHint(),
    resign: mode === 'pve' || (mode === 'online' && !spectating),
    draw: mode === 'online' && !spectating,
    emote: mode === 'online' && !spectating,
    leaveWatch: spectating,
    claim: false
  });
  startTurn();
}

async function backToMenu() {
  if (mode === 'online') {
    await online.leaveGame();
    localStorage.removeItem(ACTIVE_KEY);
    ui.nameOverride = null;
    spectating = false;
    ui.showRoomCode(null);
    ui.setSearchMode(false);
  }
  stopReplay();
  ui.hideOverlay('over');
  ui.showOverlay('menu');
  ui.setActions({ hint: false, resign: false, draw: false, claim: false, emote: false, leaveWatch: false });
  ui.showDrawOffer(false);
  ui.setPresence(null);
  ui.showEvalBar(false);
  state = ST.menu;
}

/* ============ REPLAY (FASE 6) ============ */
function enterReplay(match) {
  prevModeBeforeReplay = mode;
  mode = 'replay';
  spectating = false;
  replayMoves = (match.moves || []).map(s => deserializeMove(JSON.parse(s).m));
  replayIdx = 0;
  replayPlaying = false;
  replayToken++;
  ui.nameOverride = {
    '1': `${match.white.name} (${match.white.rating})`,
    '-1': `${match.black.name} (${match.black.rating})`
  };
  ui.hideOverlay('profilePanel');
  ui.hideOverlay('menu');
  ui.hideOverlay('over');
  ui.setActions({ hint: false, resign: false, draw: false, claim: false, emote: false, leaveWatch: false });
  ui.showReplayBar(true, replayMoves.length);
  resetMatchState();
  state = ST.replay;
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
  ui.updateTimer(null, null);
  refreshTurnUI();
  ui.updateReplay(0, replayMoves.length, false);
  refreshEvalBar();
}

function replayGoto(i) {
  i = Math.max(0, Math.min(replayMoves.length, i));
  replayToken++;
  replayPlaying = false;
  deselect();
  capCount = { '1': 0, '-1': 0 };
  quietKingMoves = 0;
  repMap.clear();
  initBoard(bd);
  turn = 1;
  history.clear();
  fx.clearLastMove();
  for (let k = 0; k < i; k++) applySilently(replayMoves[k]);
  buildPieces();
  if (i > 0) {
    const mv = replayMoves[i - 1];
    const last = mv.steps[mv.steps.length - 1];
    fx.setLastMove(mv.from, [last.r, last.c]);
  }
  replayIdx = i;
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
  ui.updateReplay(replayIdx, replayMoves.length, false);
  refreshEvalBar();
}

async function replayNext(animate = true) {
  if (replayIdx >= replayMoves.length) { replayPlaying = false; return false; }
  const mv = replayMoves[replayIdx];
  replayIdx++;
  if (animate) {
    const piece = grid[idx(mv.from[0], mv.from[1])];
    if (piece) {
      for (const s of mv.steps) {
        await animateStep(piece, s, grid, (victim, st) => {
          audio.capture();
          fx.spawnCaptureParticles(st.capR, st.capC, moverColorHex(victim.player));
          scene.remove(victim.mesh);
          pieces = pieces.filter(p => p !== victim);
        });
        fx.spawnLandingDust(s.r, s.c, moverColorHex(turn));
        if (s.capR === undefined) audio.move();
      }
      /* Coroação visual */
      const last = mv.steps[mv.steps.length - 1];
      if (piece && !piece.king && last.r === (turn === 1 ? 0 : 7)) {
        piece.king = true;
        addCrown(piece, geos, materials.gold, true);
      }
      fx.setLastMove(mv.from, [last.r, last.c]);
    }
  }
  applySilently(mv);
  if (!animate) buildPieces();
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
  ui.updateReplay(replayIdx, replayMoves.length, replayPlaying);
  refreshEvalBar();
  return true;
}

async function replayPlayLoop() {
  const token = ++replayToken;
  replayPlaying = true;
  ui.updateReplay(replayIdx, replayMoves.length, true);
  while (replayPlaying && token === replayToken) {
    const ok = await replayNext(true);
    if (!ok) break;
    await sleep(520);
  }
  replayPlaying = false;
  ui.updateReplay(replayIdx, replayMoves.length, false);
}

function stopReplay() {
  if (mode !== 'replay') return;
  replayPlaying = false;
  replayToken++;
  ui.showReplayBar(false);
  ui.nameOverride = null;
  mode = prevModeBeforeReplay;
}

/* ============ PICKING & DRAG (INTERAÇÃO 3D) ============ */
input.onPointerDown = (clientX, clientY) => {
  if (state !== ST.human) return;
  if (mode === 'online' && turn !== myColor) return;
  let r = null, c = null;

  let hit = input.pick(clientX, clientY, pieces.map(p => p.mesh));
  if (hit) {
    let o = hit.object;
    while (o && !o.userData.piece) o = o.parent;
    if (o) { r = o.userData.piece.r; c = o.userData.piece.c; }
  }

  if (r !== null) {
    const p = grid[idx(r, c)];
    if (p && p.player === turn) {
      if (selected !== p) selectPiece(p);
      isDragging = true;
      input.isCustomDragging = true;
      dragPiece = p;
      input.dragPlane.constant = -0.12;
      const wp = worldPos(r, c);
      dragStartX = wp.x;
      dragStartZ = wp.z;
    } else if (p && p.player !== turn) {
      ui.toast('PEÇA DO ADVERSÁRIO', true); audio.error();
    }
  } else {
    /* 1) Destino tem prioridade quando há peça selecionada */
    let handled = false;
    if (selected) {
      const discs = fx.activeFx.filter(m => m.userData.kind === 'disc');
      let dhit = input.pick(clientX, clientY, discs);
      if (!dhit) dhit = input.pick(clientX, clientY, squares);
      if (dhit) {
        const tr = dhit.object.userData.r, tc = dhit.object.userData.c;
        if (seqs.some(m => { const s = m.steps[stepIdx]; return s.r === tr && s.c === tc; })) {
          chooseDest(tr, tc);
          handled = true;
        }
      }
    }
    /* 2) Hitbox ampliado: seleciona a peça própria mais próxima do toque */
    if (!handled) {
      const mine = pieces.filter(p => p.player === turn);
      const np = input.pickNearestPiece(clientX, clientY, mine, 42);
      if (np && allMoves.some(m => m.from[0] === np.r && m.from[1] === np.c)) {
        if (selected !== np) selectPiece(np);
        isDragging = true;
        input.isCustomDragging = true;
        dragPiece = np;
        input.dragPlane.constant = -0.12;
        const wp = worldPos(np.r, np.c);
        dragStartX = wp.x;
        dragStartZ = wp.z;
      } else if (selected && stepIdx === 0) {
        deselect(); showCaptureRings();
      }
    }
  }
};

input.onPointerMove = (clientX, clientY) => {
  if (!isDragging || !dragPiece) {
    if (selected && state === ST.human) {
      const discs = fx.activeFx.filter(m => m.userData.kind === 'disc');
      const hit = input.pick(clientX, clientY, discs);
      if (hit) {
        fx.showGhost(hit.object.userData.r, hit.object.userData.c, moverColorHex(turn));
      } else {
        fx.hideGhost();
      }
    }
    return;
  }

  const pos = input.intersectPlane(clientX, clientY);
  dragPiece.mesh.position.x = pos.x;
  dragPiece.mesh.position.z = pos.z;

  const dx = pos.x - dragStartX;
  const dz = pos.z - dragStartZ;
  dragPiece.mesh.rotation.z = Math.max(-0.2, Math.min(0.2, -dx * 0.15));
  dragPiece.mesh.rotation.x = Math.max(-0.2, Math.min(0.2, dz * 0.15));

  let closestDest = null;
  let minDist = 0.8;
  for (const m of seqs) {
    const s = m.steps[stepIdx];
    const wp = worldPos(s.r, s.c);
    const dist = Math.hypot(pos.x - wp.x, pos.z - wp.z);
    if (dist < minDist) { minDist = dist; closestDest = s; }
  }

  if (closestDest) {
    fx.showGhost(closestDest.r, closestDest.c, moverColorHex(turn));
  } else {
    fx.hideGhost();
  }
};

input.onPointerUp = (clientX, clientY, moved) => {
  input.isCustomDragging = false;
  if (!isDragging || !dragPiece) return;
  isDragging = false;
  fx.hideGhost();
  dragPiece.mesh.rotation.set(0, 0, 0);

  const pos = dragPiece.mesh.position;
  let droppedOn = null;
  let minDist = 0.8;
  for (const m of seqs) {
    const s = m.steps[stepIdx];
    const wp = worldPos(s.r, s.c);
    const dist = Math.hypot(pos.x - wp.x, pos.z - wp.z);
    if (dist < minDist) { minDist = dist; droppedOn = s; }
  }

  if (droppedOn) {
    audio.drop();
    chooseDest(droppedOn.r, droppedOn.c);
  } else {
    if (moved > 4) audio.drop();
    dragPiece.mesh.position.set(dragStartX, 0.12, dragStartZ);
  }
  dragPiece = null;
};

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && selected && stepIdx === 0 && state === ST.human) {
    deselect();
    showCaptureRings();
  }
});

/* ============ ONLINE: CALLBACKS ============ */
online.onMatchFound = ({ myColor: color, opponent, code, resume, moves, data }) => {
  myColor = color;
  mode = 'online';
  spectating = color === 0;
  if (spectating) {
    ui.nameOverride = {
      '1': `${data.white.name} (${data.white.rating})`,
      '-1': `${data.black.name} (${data.black.rating})`
    };
  } else {
    ui.nameOverride = {
      [String(color)]: `${online.profile?.name || 'VOCÊ'} (${online.profile?.rating ?? '?'})`,
      [String(-color)]: `${opponent?.name || 'OPONENTE'} (${opponent?.rating ?? '?'})`
    };
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ id: code, color }));
  }
  ui.setSearchMode(false);
  ui.setSearchBand(null);
  ui.showRoomCode(null);
  ui.hideOverlay('menu');
  ui.hideOverlay('spectatePanel');
  ui.toast(spectating ? 'ASSISTINDO AO VIVO' : resume ? 'PARTIDA RECUPERADA!' : 'PARTIDA ENCONTRADA!');

  /* Relógio sincronizado (FASE 4) */
  onlineTc = data.tc || { base: 0, inc: 0 };
  clockW = data.clockW ?? onlineTc.base;
  clockB = data.clockB ?? onlineTc.base;
  clockAnchor = performance.now();
  /* Ao retomar, desconta o tempo que o turno atual já consumiu */
  try {
    if (resume && data.turnStartedAt?.toMillis) {
      const elapsed = Date.now() - data.turnStartedAt.toMillis();
      if (elapsed > 0) clockAnchor -= elapsed;
    }
  } catch { /* timestamp pendente — ignora */ }

  /* Câmera no lado das minhas peças */
  input.theta = color === -1 ? Math.PI : 0;
  input.syncCamera();

  newGame();

  /* Recuperação de sessão / espectador: reaplica os lances já jogados */
  if (resume && moves && moves.length) {
    for (const s of moves) applySilently(deserializeMove(s));
    buildPieces();
    const mv = deserializeMove(moves[moves.length - 1]);
    const last = mv.steps[mv.steps.length - 1];
    fx.setLastMove(mv.from, [last.r, last.c]);
    ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
    startTurn();
  }
};

online.onOpponentMove = serialized => {
  remoteQueue.push(serialized);
  tryPlayRemote();
};

online.onGameEnd = (winner, reason) => {
  if (state !== ST.over) gameOver(winner, reason, true);
};

online.onRated = (delta, newRating) => {
  const txt = (delta >= 0 ? '+' : '') + delta + ' ELO  →  ' + newRating;
  ui.setRatingDelta(txt, delta >= 0);
  ui.updateRatingBadge(online.profile);
};

online.onDrawOffer = () => {
  if (state !== ST.over && !spectating) ui.showDrawOffer(true);
};

/* Presença e reconexão (FASE 3) */
online.onPresence = seconds => {
  if (state === ST.over || state === ST.menu || spectating) {
    ui.setPresence(null);
    return;
  }
  if (seconds < 15) {
    ui.setPresence(null);
    ui.$('#btnClaimWin').style.display = 'none';
    return;
  }
  ui.setPresence(seconds);
  ui.$('#btnClaimWin').style.display = seconds >= 60 ? 'flex' : 'none';
};

/* Emotes (FASE 8) */
online.onEmote = (byColor, e) => {
  ui.showEmoteBubble(byColor, e);
  audio.emote();
};

online.onSearchBand = band => ui.setSearchBand(band);

/* ============ PRESENÇA E DESAFIOS ============ */
function startIncomingChallengeListener() {
  if (unsubIncomingChallenges || !online.ready) return;
  unsubIncomingChallenges = online.listenToIncomingChallenges(challenge => {
    if (challenge.status === 'cancelled') {
      if (activeIncomingChallenge && activeIncomingChallenge.id === challenge.id) {
        activeIncomingChallenge = null;
        ui.hideOverlay('challengeReceivePanel');
        ui.toast('DESAFIO CANCELADO PELO ADVERSÁRIO');
      }
      return;
    }
    if (state !== ST.menu || activeIncomingChallenge || spectating || mode === 'online') {
      online.declineChallenge(challenge);
      return;
    }
    activeIncomingChallenge = challenge;
    ui.$('#challengerName').textContent = challenge.from.name;
    ui.$('#challengerRating').textContent = challenge.from.rating;
    ui.showOverlay('challengeReceivePanel');
  });
}

async function refreshOnlinePlayersList() {
  ui.$('#onlinePlayersList').innerHTML = '<div class="lb-empty">CARREGANDO…</div>';
  try {
    const list = await online.listOnlinePlayers();
    ui.renderOnlinePlayers(list, online.uid, p => challengePlayer(p));
  } catch (e) {
    console.error(e);
    ui.$('#onlinePlayersList').innerHTML = '<div class="lb-empty">ERRO AO CARREGAR JOGADORES</div>';
  }
}

async function challengePlayer(player) {
  if (unsubOutgoingChallenge) {
    ui.toast('VOCÊ JÁ POSSUI UM DESAFIO ATIVO', true);
    return;
  }
  ui.hideOverlay('playersPanel');
  ui.$('#waitOppName').textContent = player.name;
  ui.showOverlay('challengeWaitPanel');
  ui.toast('ENVIANDO DESAFIO…');

  try {
    await online.sendChallenge(player.uid, player.name, player.rating);
    
    unsubOutgoingChallenge = online.listenToOutgoingChallenge(
      async (gameId) => {
        cleanupOutgoingChallenge();
        ui.hideOverlay('challengeWaitPanel');
        await online.cancelOutgoingChallenge(); /* Limpa doc */
      },
      async () => {
        cleanupOutgoingChallenge();
        ui.hideOverlay('challengeWaitPanel');
        ui.toast('DESAFIO RECUSADO PELO ADVERSÁRIO', true);
        await online.cancelOutgoingChallenge(); /* Limpa doc após recusa */
      },
      () => {
        cleanupOutgoingChallenge();
        ui.hideOverlay('challengeWaitPanel');
      }
    );
  } catch (e) {
    console.error(e);
    cleanupOutgoingChallenge();
    ui.hideOverlay('challengeWaitPanel');
    ui.toast('FALHA AO ENVIAR DESAFIO', true);
  }
}

function cleanupOutgoingChallenge() {
  if (unsubOutgoingChallenge) {
    unsubOutgoingChallenge();
    unsubOutgoingChallenge = null;
  }
}

/* Loop periódico de atualização de atividade */
setInterval(() => {
  if (online.ready && state === ST.menu) {
    online.updateActive();
  }
}, 30000);

/* ============ ONLINE: CONEXÃO ============ */
let onlineInitPromise = null;
function ensureOnline() {
  if (!isFirebaseConfigured) {
    ui.setOnlineStatus('MODO ONLINE NÃO CONFIGURADO — VEJA O README.MD');
    return Promise.resolve(false);
  }
  if (!onlineInitPromise) {
    ui.setOnlineStatus('CONECTANDO…', true);
    onlineInitPromise = online.init(nick).then(ok => {
      if (ok) {
        ui.setOnlineStatus('');
        ui.updateRatingBadge(online.profile);
        online.updateActive();
        startIncomingChallengeListener();
        
        if (online.redirectResultMsg) {
          ui.toast(online.redirectResultMsg);
          online.redirectResultMsg = null;
          if (ui.$('#profilePanel').style.display !== 'none') {
            ui.renderProfile(online.profile);
          }
        }
      } else {
        ui.setOnlineStatus('FALHA AO CONECTAR — VERIFIQUE A CONFIGURAÇÃO');
        onlineInitPromise = null;
      }
      return ok;
    });
  }
  return onlineInitPromise;
}

/* ============ BINDINGS DE UI ============ */
const nickInput = ui.$('#nickInput');
nickInput.value = nick;
nickInput.addEventListener('change', () => {
  nick = (nickInput.value.trim() || 'JOGADOR').toUpperCase().slice(0, 16);
  nickInput.value = nick;
  savePrefs();
  if (online.ready) online.setName(nick);
});

ui.segBind('#mSegMode', v => {
  mode = v;
  ui.setMenuTab(v);
  if (v === 'online') ensureOnline();
});
ui.setMenuTab('pvp');

ui.segBind('#mSegDiff', v => { depth = +v; ui.setSeg('#segDiff', v); });
ui.segBind('#segDiff', v => { depth = +v; ui.setSeg('#mSegDiff', v); ui.toast('DIFICULDADE ALTERADA'); });

const setTimeLimit = v => { timeLimit = +v * 60 * 1000; };
ui.segBind('#segTime', v => { setTimeLimit(v); ui.setSeg('#mSegTime', v); ui.toast('TEMPO ALTERADO'); });
ui.segBind('#mSegTime', v => { setTimeLimit(v); ui.setSeg('#segTime', v); });

/* Ritmo online (FASE 4) */
ui.setSeg('#mSegTc', tcChoice);
ui.segBind('#mSegTc', v => { tcChoice = +v; savePrefs(); });

/* Efeitos visuais (FASE 9) */
ui.setSeg('#segFx', effectsOn ? 1 : 0);
ui.segBind('#segFx', async v => {
  effectsOn = v === '1';
  savePrefs();
  if (effectsOn && !composer) {
    try {
      composer = await createComposer(renderer, scene, camera);
      composer.setSize(window.innerWidth, window.innerHeight);
    } catch (e) {
      console.error('Erro ao carregar pós-processamento:', e);
      effectsOn = false;
      ui.setSeg('#segFx', 0);
      ui.toast('EFEITOS INDISPONÍVEIS', true);
    }
  }
  ui.toast(effectsOn ? 'EFEITOS LIGADOS' : 'EFEITOS DESLIGADOS');
});

/* Câmera top-down (P0 mobile) */
ui.$('#camToggle').onclick = async () => {
  const td = await input.toggleTopDown();
  ui.setCamButton(td);
  ui.toast(td ? 'VISÃO AÉREA' : 'VISÃO LIVRE');
};

/* Modo Mover: arraste de 1 dedo desloca o tabuleiro (P0 mobile) */
ui.$('#panToggle').onclick = () => {
  input.panMode = !input.panMode;
  ui.$('#panToggle').classList.toggle('on', input.panMode);
  ui.toast(input.panMode ? 'MODO MOVER: ARRASTE O TABULEIRO' : 'MODO GIRAR');
};

/* Botões de zoom (mobile) */
ui.$('#zoomIn').onclick = () => {
  input.radius = Math.max(input.radius * 0.85, input.minRadius);
  input.syncCamera();
};
ui.$('#zoomOut').onclick = () => {
  input.radius = Math.min(input.radius * 1.15, input.maxRadius);
  input.syncCamera();
};

/* Música de fundo (P1) */
ui.setMusicUI(!!prefs.music, audio.musicVolume);
ui.segBind('#segMusic', v => {
  if (v === '1') audio.startMusic(); else audio.stopMusic();
  savePrefs();
  ui.toast(v === '1' ? 'MÚSICA LIGADA' : 'MÚSICA DESLIGADA');
});
ui.$('#musicVol').oninput = e => {
  audio.setMusicVolume(+e.target.value / 100);
  savePrefs();
};

/* Análise — barra de vantagem da IA (P1) */
ui.setSeg('#segEval', evalOn ? 1 : 0);
ui.segBind('#segEval', v => {
  evalOn = v === '1';
  savePrefs();
  refreshEvalBar();
  ui.toast(evalOn ? 'ANÁLISE LIGADA' : 'ANÁLISE DESLIGADA');
});

/* Vibração (P0 mobile) */
ui.setSeg('#segHaptics', hapticsOn ? 1 : 0);
ui.segBind('#segHaptics', v => {
  hapticsOn = v === '1';
  setHaptics(hapticsOn);
  savePrefs();
  if (hapticsOn) vibrate(30);
});

/* Névoa da cena */
{
  const fogNearEl = ui.$('#fogNear');
  const fogFarEl  = ui.$('#fogFar');
  const fogNearV  = ui.$('#fogNearVal');
  const fogFarV   = ui.$('#fogFarVal');
  fogNearEl.value = fogNearMul;
  fogFarEl.value  = fogFarMul;
  fogNearV.textContent = fogNearMul.toFixed(1) + 'x';
  fogFarV.textContent  = fogFarMul.toFixed(1) + 'x';
  fogNearEl.oninput = e => {
    fogNearMul = +e.target.value;
    if (fogNearMul >= fogFarMul) { fogFarMul = fogNearMul + 0.2; fogFarEl.value = fogFarMul; fogFarV.textContent = fogFarMul.toFixed(1) + 'x'; }
    fogNearV.textContent = fogNearMul.toFixed(1) + 'x';
    savePrefs();
  };
  fogFarEl.oninput = e => {
    fogFarMul = +e.target.value;
    if (fogFarMul <= fogNearMul) { fogNearMul = fogFarMul - 0.2; fogNearEl.value = fogNearMul; fogNearV.textContent = fogNearMul.toFixed(1) + 'x'; }
    fogFarV.textContent = fogFarMul.toFixed(1) + 'x';
    savePrefs();
  };
}

ui.$('#btnLoadout').onclick = () => {
  ui.hideOverlay('menu');
  ui.showOverlay('loadoutOverlay');
};

ui.$('#btnLoadoutClose').onclick = () => {
  ui.hideOverlay('loadoutOverlay');
  ui.showOverlay('menu');
};
ui.$('#btnStart').onclick = () => {
  if (mode === 'online') return;
  ui.nameOverride = null;
  ui.$('#grpDiff').style.display = mode === 'pve' ? 'block' : 'none';
  ui.hideOverlay('menu');
  newGame();
};

/* --- Online: partida rápida (FASE 5) --- */
ui.$('#btnQuick').onclick = async () => {
  if (!(await ensureOnline())) return;
  ui.setSearchMode(true);
  try {
    await online.quickMatch(TC_PRESETS[tcChoice]);
  } catch (e) {
    console.error(e);
    ui.toast('ERRO AO PROCURAR PARTIDA', true);
    ui.setSearchMode(false);
  }
};

ui.$('#btnCancelSearch').onclick = async () => {
  await online.cancelSearch();
  ui.setSearchMode(false);
  ui.setSearchBand(null);
};

/* --- Online: salas + link de convite (FASE 2) --- */
ui.$('#btnCreateRoom').onclick = async () => {
  if (!(await ensureOnline())) return;
  ui.$('#onlineActions').style.display = 'none';
  try {
    lastRoomCode = await online.createRoom(TC_PRESETS[tcChoice]);
    ui.showRoomCode(lastRoomCode);
  } catch (e) {
    console.error(e);
    ui.toast('ERRO AO CRIAR SALA', true);
    ui.$('#onlineActions').style.display = 'block';
  }
};

ui.$('#btnCopyLink').onclick = () => {
  if (!lastRoomCode) return;
  navigator.clipboard?.writeText(online.roomLink(lastRoomCode))
    .then(() => ui.toast('LINK DE CONVITE COPIADO ✓'))
    .catch(() => ui.toast('NÃO FOI POSSÍVEL COPIAR', true));
};

ui.$('#btnCancelRoom').onclick = async () => {
  await online.cancelRoom();
  lastRoomCode = null;
  ui.showRoomCode(null);
  ui.$('#onlineActions').style.display = 'block';
};

ui.$('#btnJoinRoom').onclick = async () => {
  if (!(await ensureOnline())) return;
  const code = ui.$('#roomCodeInput').value.trim().toUpperCase();
  if (code.length < 4) { ui.toast('CÓDIGO INVÁLIDO', true); return; }
  try {
    await online.joinRoom(code);
  } catch (e) {
    ui.toast(e.message || 'ERRO AO ENTRAR NA SALA', true);
  }
};

ui.$('#roomCodeShow').onclick = () => {
  navigator.clipboard?.writeText(ui.$('#roomCodeShow').textContent)
    .then(() => ui.toast('CÓDIGO COPIADO'));
};

/* --- Espectador (FASE 7) --- */
async function refreshLiveList() {
  ui.$('#liveList').innerHTML = '<div class="lb-empty">CARREGANDO…</div>';
  try {
    const list = await online.listActiveGames(20);
    ui.renderLiveList(list, id => online.spectate(id));
  } catch (e) {
    console.error(e);
    ui.$('#liveList').innerHTML = '<div class="lb-empty">ERRO AO CARREGAR</div>';
  }
}

ui.$('#btnSpectate').onclick = async () => {
  if (!(await ensureOnline())) return;
  ui.showOverlay('spectatePanel');
  refreshLiveList();
};
ui.$('#btnLiveRefresh').onclick = refreshLiveList;
ui.$('#btnLiveClose').onclick = () => ui.hideOverlay('spectatePanel');
ui.$('#btnLeaveWatch').onclick = backToMenu;

/* --- Desafios & Lista de Jogadores --- */
ui.$('#btnShowPlayers').onclick = async () => {
  if (!(await ensureOnline())) return;
  ui.showOverlay('playersPanel');
  refreshOnlinePlayersList();
};
ui.$('#btnPlayersRefresh').onclick = refreshOnlinePlayersList;
ui.$('#btnPlayersClose').onclick = () => ui.hideOverlay('playersPanel');

ui.$('#btnCancelChallenge').onclick = async () => {
  ui.toast('DESAFIO CANCELADO');
  cleanupOutgoingChallenge();
  ui.hideOverlay('challengeWaitPanel');
  await online.cancelOutgoingChallenge();
};

ui.$('#btnAcceptChallenge').onclick = async () => {
  if (!activeIncomingChallenge) return;
  const challenge = activeIncomingChallenge;
  activeIncomingChallenge = null;
  ui.hideOverlay('challengeReceivePanel');
  ui.toast('ACEITANDO DESAFIO…');
  try {
    await online.acceptChallenge(challenge);
  } catch (e) {
    console.error(e);
    ui.toast('ERRO AO ACEITAR DESAFIO', true);
  }
};

ui.$('#btnDeclineChallenge').onclick = async () => {
  if (!activeIncomingChallenge) return;
  const challenge = activeIncomingChallenge;
  activeIncomingChallenge = null;
  ui.hideOverlay('challengeReceivePanel');
  await online.declineChallenge(challenge);
  ui.toast('DESAFIO RECUSADO');
};

/* --- Perfil (FASE 1) --- */
ui.$('#btnProfile').onclick = async () => {
  if (!(await ensureOnline())) return;
  ui.renderProfile(online.profile);
  ui.showOverlay('profilePanel');
  ui.$('#matchList').innerHTML = '<div class="lb-empty">CARREGANDO…</div>';
  try {
    const list = await online.myMatches(10);
    ui.renderMatchList(list, online.uid, m => enterReplay(m));
  } catch (e) {
    console.error(e);
    ui.$('#matchList').innerHTML = '<div class="lb-empty">ERRO AO CARREGAR</div>';
  }
};
ui.$('#btnProfClose').onclick = () => ui.hideOverlay('profilePanel');

ui.$('#btnGoogleLink').onclick = async () => {
  if (!(await ensureOnline())) return;
  try {
    ui.toast('Redirecionando para o Google...', true);
    await online.linkGoogle();
  } catch (e) {
    console.error(e);
    ui.toast('ERRO AO REDIRECIONAR', true);
  }
};

/* --- Ranking --- */
ui.$('#btnLeaderboard').onclick = async () => {
  if (!(await ensureOnline())) return;
  ui.showOverlay('lb');
  ui.$('#lbList').innerHTML = '<div class="lb-empty">CARREGANDO…</div>';
  try {
    const list = await online.leaderboard(10);
    ui.renderLeaderboard(list, online.uid);
  } catch (e) {
    ui.$('#lbList').innerHTML = '<div class="lb-empty">ERRO AO CARREGAR</div>';
  }
};
ui.$('#btnLbClose').onclick = () => ui.hideOverlay('lb');

/* --- Replay (FASE 6) --- */
ui.$('#rpFirst').onclick = () => replayGoto(0);
ui.$('#rpPrev').onclick = () => replayGoto(replayIdx - 1);
ui.$('#rpNext').onclick = () => { replayPlaying = false; replayToken++; replayNext(true); };
ui.$('#rpPlay').onclick = () => {
  if (replayPlaying) { replayPlaying = false; replayToken++; ui.updateReplay(replayIdx, replayMoves.length, false); }
  else replayPlayLoop();
};
ui.$('#rpSlider').oninput = e => replayGoto(+e.target.value);
ui.$('#rpExit').onclick = backToMenu;

/* --- Emotes (FASE 8) --- */
ui.$('#btnEmote').onclick = () => ui.toggleEmotePalette();
document.querySelectorAll('#emotePalette button').forEach(b => {
  b.onclick = () => {
    const now = Date.now();
    if (now - lastEmoteSent < 3000) {
      ui.toast('AGUARDE PARA REAGIR DE NOVO', true);
      return;
    }
    lastEmoteSent = now;
    ui.toggleEmotePalette(false);
    online.sendEmote(b.dataset.e);
    ui.showEmoteBubble(myColor, b.dataset.e);
    audio.emote();
  };
});

/* --- Barra de ações em partida --- */
ui.$('#btnHint').onclick = () => {
  /* Dev assistindo ao vivo: dica para o jogador da vez (ambos os lados). */
  const watchingAsDev = spectating && isDev();
  if (watchingAsDev) {
    /* Só entre lances (partida parada); durante a animação o tabuleiro muda. */
    if (state !== ST.remote) return;
  } else {
    if (state !== ST.human || !canUseHint()) return;
    /* Em captura múltipla o tabuleiro lógico só é atualizado no fim da
       sequência; pedir dica aqui apagaria a seleção e travaria o lance. */
    if (stepIdx > 0) { ui.toast('TERMINE A CAPTURA EM ANDAMENTO', true); audio.error(); return; }
  }
  const m = getHint(bd, turn);
  if (!m) return;
  deselect();
  showCaptureRings();
  fx.addRing(m.from[0], m.from[1], 0x3DD68C);
  const last = m.steps[m.steps.length - 1];
  fx.addDisc(last.r, last.c, 0x3DD68C);
  ui.toast('SUGESTÃO: ' + moveToNotation(m));
};

ui.$('#btnResign').onclick = () => {
  if (state === ST.over || state === ST.menu) return;
  if (mode === 'online') {
    online.resign();
  } else if (mode === 'pve') {
    gameOver(-1, 'resign');
  }
};

ui.$('#btnDrawOffer').onclick = () => {
  if (mode !== 'online' || state === ST.over) return;
  const now = Date.now();
  if (now - lastDrawOfferT < DRAW_OFFER_COOLDOWN_MS) {
    ui.toast('AGUARDE PARA PROPOR EMPATE NOVAMENTE', true);
    return;
  }
  if (drawOfferCount >= DRAW_OFFER_MAX) {
    ui.toast('LIMITE DE PROPOSTAS DE EMPATE ATINGIDO', true);
    return;
  }
  lastDrawOfferT = now;
  drawOfferCount++;
  online.offerDraw();
  ui.toast('EMPATE PROPOSTO');
};

ui.$('#btnDrawAccept').onclick = () => { ui.showDrawOffer(false); online.respondDraw(true); };
ui.$('#btnDrawDecline').onclick = () => { ui.showDrawOffer(false); online.respondDraw(false); };

ui.$('#btnClaimWin').onclick = () => {
  if (mode === 'online' && state !== ST.over) online.claimAbandon();
};

ui.$('#btnSound').onclick = () => {
  const muted = audio.toggleMute();
  ui.setSoundIcon(muted);
  savePrefs();
};

/* --- Painel lateral --- */
ui.$('#btnNew').onclick = () => {
  if (state === ST.menu) return;
  if (mode === 'online' || mode === 'replay') { ui.toast('INDISPONÍVEL NESTE MODO', true); return; }
  newGame();
  ui.toast('NOVA PARTIDA');
};

ui.$('#btnResetScore').onclick = () => {
  winCount = { '1': 0, '-1': 0 };
  ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
  ui.toast('PLACAR ZERADO');
};

ui.$('#btnBackMenu').onclick = backToMenu;
ui.$('#btnRematch').onclick = () => { if (mode !== 'online') newGame(); };
ui.$('#btnMenu').onclick = backToMenu;
ui.$('#cfgToggle').onclick = () => ui.$('#config').classList.toggle('open');
ui.$('#undoBtn').onclick = () => { undo(); ui.toast('JOGADA DESFEITA'); };

ui.$('#histToggle').onclick = () => ui.$('#history').classList.toggle('open');
ui.$('#histCopy').onclick = () => {
  navigator.clipboard.writeText(history.getFullText()).then(() => ui.toast('HISTÓRICO COPIADO'));
};

ui.buildSwatches(applyBoardTheme, applyPieceTheme, boardThemeIdx, pieceThemeIdx);

/* ============ RENDER LOOP ============ */
window.addEventListener('resize', () => {
  resize();
  input.resetView();
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});
resize();
input.resetView();
// Mobile viewport fix: force recalculation after layout settles
setTimeout(() => {
  resize();
  input.resetView();
}, 150);

/* Relógio online sincronizado (FASE 4).
   Roda em setInterval (não no rAF) para detectar timeout
   mesmo com a aba em segundo plano. */
setInterval(() => {
  if (mode !== 'online' || onlineTc.base <= 0) return;
  if (state !== ST.human && state !== ST.remote && state !== ST.anim) return;
  const d1 = displayedClock(1), d2 = displayedClock(-1);
  ui.updateTimer(Math.max(0, d1), Math.max(0, d2));

  if (spectating || timeoutClaimed) return;
  const mine = myColor === 1 ? d1 : d2;
  const theirs = myColor === 1 ? d2 : d1;
  if (mine <= 0 && turn === myColor) {
    /* Meu tempo zerou: o oponente vence */
    timeoutClaimed = true;
    gameOver(-myColor, 'timeout');
  } else if (theirs <= -2000 && turn !== myColor) {
    /* Tempo do oponente zerou (com folga de rede): reivindico a vitória */
    timeoutClaimed = true;
    online.claimTimeout();
  } else if (turn === myColor && mine > 0 && mine <= 15000) {
    const sec = Math.ceil(mine / 1000);
    if (sec !== lastTickSec) { audio.tick(); lastTickSec = sec; }
  }
}, 250);

const clock = new THREE.Clock();
let prevTime = 0;
(function loop() {
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();
  const dt = t - prevTime;
  prevTime = t;

  /* Névoa acompanha a distância da câmera: mantém o tabuleiro sempre
     nítido (sem esmaecer ao dar zoom out) e deixa a atmosfera só no fundo.
     As razões reproduzem o visual original na distância padrão (~18 / ~42). */
  if (scene.fog) {
    scene.fog.near = input.radius * fogNearMul;
    scene.fog.far  = input.radius * fogFarMul;
  }

  /* Rotação cinematográfica no fim de jogo */
  if (cinematicOrbit && !input.dragging && !input.animatingView) {
    input.theta += dt * 0.15;
    input.syncCamera();
  }

  /* Relógio (modos locais) */
  if ((state === ST.human || state === ST.ai) && timeLimit > 0 && mode !== 'online') {
    const ms = dt * 1000;
    if (turn === 1) time1 -= ms; else time2 -= ms;
    ui.updateTimer(time1, time2);

    const activeTime = turn === 1 ? time1 : time2;
    if (activeTime <= 0) {
      ui.toast('TEMPO ESGOTADO!', true);
      gameOver(-turn, 'timeout');
    } else if (activeTime <= 15000) {
      const sec = Math.ceil(activeTime / 1000);
      if (sec !== lastTickSec) {
        audio.tick();
        lastTickSec = sec;
      }
    }
  }

  fx.update(t, Math.min(dt, 0.05));
  if (effectsOn && composer) composer.render();
  else renderer.render(scene, camera);
})();

/* ============ API DE DEPURAÇÃO (console) ============ */
window.__damas = {
  clickSquare(r, c) {
    if (state !== ST.human) return 'bloqueado';
    const p = grid[idx(r, c)];
    if (p && p.player === turn) { selectPiece(p); return 'selecionou'; }
    if (selected && seqs.some(m => { const s = m.steps[stepIdx]; return s.r === r && s.c === c; })) {
      chooseDest(r, c);
      return 'moveu';
    }
    return 'nada';
  },
  get info() {
    return { state, turn, mode, myColor, lances: allMoves.length, captura: !!allMoves[0]?.capture };
  },
  input, camera, fx,
  /* Verifica se os 4 cantos do tabuleiro estão dentro da tela (NDC) */
  boardFits() {
    const pts = [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]];
    let okAll = true;
    const v = new THREE.Vector3();
    for (const [x, z] of pts) {
      v.set(x, 0, z).project(camera);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) okAll = false;
    }
    return { fits: okAll, radius: +input.radius.toFixed(2), fit: +input.fitRadius().toFixed(2),
             target: [+input.target.x.toFixed(2), +input.target.z.toFixed(2)] };
  }
};

/* ============ BOOT ============ */
applyBoardTheme(boardThemeIdx);
initBoard(bd);
buildPieces();
applyPieceTheme(pieceThemeIdx);
ui.updateScore(capCount, winCount, mode, pieceThemeIdx);
ui.updateTurn(turn, false, false, mode, pieceThemeIdx);
ui.setActions({ hint: false, resign: false, draw: false, claim: false, emote: false, leaveWatch: false });

/* Bloom ligado nas preferências: carrega já */
if (effectsOn) {
  createComposer(renderer, scene, camera)
    .then(c => { composer = c; composer.setSize(window.innerWidth, window.innerHeight); })
    .catch(() => { effectsOn = false; ui.setSeg('#segFx', 0); });
}

/* Auto-join por link (?room=CODIGO) e recuperação de sessão */
(async () => {
  if (!isFirebaseConfigured) return;
  const roomParam = new URLSearchParams(location.search).get('room');
  if (roomParam) {
    history2Clean();
    ui.setSeg('#mSegMode', 'online');
    mode = 'online';
    ui.setMenuTab('online');
    if (await ensureOnline()) {
      try {
        ui.setOnlineStatus('ENTRANDO NA SALA ' + roomParam.toUpperCase() + '…', true);
        await online.joinRoom(roomParam);
        ui.setOnlineStatus('');
      } catch (e) {
        ui.setOnlineStatus('');
        ui.toast(e.message || 'ERRO AO ENTRAR NA SALA', true);
      }
    }
    return;
  }
  /* Sessão pendente? (FASE 3) */
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(ACTIVE_KEY)); } catch { /* ok */ }
  if (saved && saved.id) {
    if (await ensureOnline()) {
      const ok = await online.resumeGame(saved.id, saved.color);
      if (!ok) localStorage.removeItem(ACTIVE_KEY);
    }
  } else {
    ensureOnline();
  }
})();

function history2Clean() {
  try { window.history.replaceState({}, '', window.location.pathname); } catch { /* ok */ }
}

/* Música só pode tocar após um gesto do usuário (política de autoplay) */
if (prefs.music) {
  const startMusicOnce = () => {
    audio.startMusic();
    window.removeEventListener('pointerdown', startMusicOnce);
  };
  window.addEventListener('pointerdown', startMusicOnce, { once: true });
}

/* PWA: registra o service worker (instalável + cache do app-shell) */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ok offline */ });
  });
}
