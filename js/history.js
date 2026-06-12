/* ============================================================
   DAMAS 3D — Histórico de Movimentos
   Registra jogadas em notação algébrica de damas
   ============================================================ */

import { moveToNotation } from './rules.js';

export class MoveHistory {
  constructor() {
    this.entries = []; // { moveNum, whiteNotation, blackNotation }
    this.container = null;
  }

  bind(container) {
    this.container = container;
  }

  record(move, turn) {
    const notation = moveToNotation(move);
    if (turn === 1) {
      /* Claras (brancas) iniciam um novo par */
      this.entries.push({ num: this.entries.length + 1, w: notation, b: null });
    } else {
      /* Escuras (pretas) completam o par */
      if (this.entries.length > 0 && this.entries[this.entries.length - 1].b === null) {
        this.entries[this.entries.length - 1].b = notation;
      } else {
        this.entries.push({ num: this.entries.length + 1, w: '...', b: notation });
      }
    }
    this._render();
  }

  clear() {
    this.entries = [];
    this._render();
  }

  _render() {
    if (!this.container) return;
    const list = this.container.querySelector('.hist-list');
    if (!list) return;

    list.innerHTML = '';
    for (const e of this.entries) {
      const row = document.createElement('div');
      row.className = 'hist-row';

      const num = document.createElement('span');
      num.className = 'hist-num';
      num.textContent = e.num + '.';

      const w = document.createElement('span');
      w.className = 'hist-move hist-w';
      w.textContent = e.w;

      const b = document.createElement('span');
      b.className = 'hist-move hist-b';
      b.textContent = e.b || '';

      row.appendChild(num);
      row.appendChild(w);
      row.appendChild(b);
      list.appendChild(row);
    }

    /* Auto-scroll para a última jogada */
    list.scrollTop = list.scrollHeight;
  }

  getFullText() {
    return this.entries.map(e =>
      `${e.num}. ${e.w}${e.b ? ' ' + e.b : ''}`
    ).join('\n');
  }
}
