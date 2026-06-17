/* ============================================================
   DAMAS ROYALE — Tutorial de primeira partida
   Guia o jogador no primeiro jogo (uma vez só, salvo no localStorage).
   ============================================================ */

const KEY = 'damasRoyale.tutorialDone';

export class Tutorial {
  constructor(ui) {
    this.ui = ui;
    this.done = localStorage.getItem(KEY) === 'true';
    this.step = 0;
  }

  /* ctx: { humanTurn, hasSelection, hasCapture } */
  update(ctx) {
    if (this.done) return;
    const overlay = this.ui.$('#tutorialOverlay');
    if (!overlay) return;
    const msg = this.ui.$('#tutorialMsg');

    if (!ctx.humanTurn) { overlay.style.display = 'none'; return; }
    overlay.style.display = 'block';

    if (this.step === 0) {
      msg.innerHTML = '<b>Sua vez!</b><br>Toque em uma peça sua.';
      if (ctx.hasSelection) this.step = 1;
    }
    if (this.step === 1) {
      if (!ctx.hasSelection) { this.step = 0; return this.update(ctx); }
      msg.innerHTML = ctx.hasCapture
        ? '<b>Captura obrigatória!</b><br>Toque no alvo vermelho para pular.'
        : '<b>Movimento</b><br>Toque na casa de destino amarela.';
    }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    localStorage.setItem(KEY, 'true');
    const overlay = this.ui.$('#tutorialOverlay');
    if (overlay) overlay.style.display = 'none';
    this.ui.toast('Excelente! Boa sorte na partida.');
  }
}
