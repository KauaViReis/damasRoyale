/* ============================================================
   DAMAS 3D — Utilitários Compartilhados
   ============================================================ */

export const easeIO = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

export const easeOutBack = k => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

export const easeOutCubic = k => 1 - Math.pow(1 - k, 3);

export function tween(dur, fn) {
  return new Promise(res => {
    const t0 = performance.now();
    let done = false;
    const finish = () => { if (!done) { done = true; fn(1); res(); } };
    /* rAF congela em aba oculta — o timeout garante a conclusão
       (senão lances online ficariam presos até a aba voltar ao foco) */
    const tm = setTimeout(finish, dur + 150);
    (function step(t) {
      if (done) return;
      const k = Math.min(1, (t - t0) / dur);
      fn(k);
      if (k < 1) requestAnimationFrame(step);
      else { clearTimeout(tm); finish(); }
    })(t0);
  });
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const hex = c => '#' + c.toString(16).padStart(6, '0');

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
