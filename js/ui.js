/* ============================================================
   DAMAS ROYALE — Gerenciamento de DOM (UI)
   ============================================================ */

import { hex } from './utils.js';
import { BOARD_THEMES, PIECE_THEMES } from './themes.js';
import { ratingTitle } from './elo.js';
import { leagueOf } from './leagues.js';
import { ACHIEVEMENTS } from './achievements.js';

export class UIManager {
  constructor() {
    this.toastTimer = null;
    /* Nomes personalizados (modo online) — { '1': nome, '-1': nome } */
    this.nameOverride = null;
    this.bubbleTimers = { '1': null, '-1': null };
  }

  $(s) { return document.querySelector(s); }

  toast(msg, red = false) {
    const t = this.$('#toast');
    t.textContent = msg;
    t.classList.toggle('red', red);
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  pName(pl, mode, pieceTheme) {
    if (this.nameOverride && this.nameOverride[String(pl)]) {
      return this.nameOverride[String(pl)];
    }
    const th = PIECE_THEMES[pieceTheme];
    if (pl === 1) return th.n1;
    return (mode === 'pve') ? 'MÁQUINA' : th.n2;
  }

  updateScore(capCount, winCount, mode, pieceTheme) {
    const th = PIECE_THEMES[pieceTheme];
    this.$('#name1').textContent = this.pName(1, mode, pieceTheme);
    this.$('#name2').textContent = this.pName(-1, mode, pieceTheme);
    this.$('#chip1').style.background = hex(th.p1);
    this.$('#chip2').style.background = hex(th.p2);
    this.$('#cap1').textContent = capCount['1'];
    this.$('#cap2').textContent = capCount['-1'];
    this.$('#win1').textContent = winCount['1'];
    this.$('#win2').textContent = winCount['-1'];
  }

  updateTurn(turn, thinking, hasCapture, mode, pieceTheme, thinkingTxt = 'MÁQUINA PENSANDO…') {
    const th = PIECE_THEMES[pieceTheme];
    this.$('#turnDot').style.background = hex(turn === 1 ? th.p1 : th.p2);
    this.$('#turnTxt').textContent = thinking
      ? thinkingTxt
      : 'VEZ: ' + this.pName(turn, mode, pieceTheme);
    this.$('#spin').style.display = thinking ? 'block' : 'none';
    this.$('#turnSub').style.display = (!thinking && hasCapture) ? 'block' : 'none';
    this.$('#card1').classList.toggle('active', turn === 1);
    this.$('#card2').classList.toggle('active', turn === -1);
  }

  /* Formata MS para MM:SS */
  fmtTime(ms) {
    if (ms <= 0) return '00:00';
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m.toString().padStart(2, '0')}:${rs.toString().padStart(2, '0')}`;
  }

  updateTimer(time1, time2) {
    const t1 = this.$('#time1');
    const t2 = this.$('#time2');
    if (time1 === null) {
      t1.style.display = 'none';
      t2.style.display = 'none';
      return;
    }
    t1.style.display = 'block';
    t2.style.display = 'block';
    t1.textContent = this.fmtTime(time1);
    t2.textContent = this.fmtTime(time2);
    t1.classList.toggle('warning', time1 <= 15000);
    t2.classList.toggle('warning', time2 <= 15000);
  }

  showUndo(show) {
    this.$('#undoBtn').style.display = show ? 'block' : 'none';
  }

  /* winner: 1 / -1 / 0 (empate) */
  showGameOver(winner, capCount, mode, pieceTheme, reasonTxt = '', deltaTxt = '') {
    const th = PIECE_THEMES[pieceTheme];
    if (winner === 0) {
      this.$('#overChip').style.background =
        `linear-gradient(135deg, ${hex(th.p1)} 50%, ${hex(th.p2)} 50%)`;
      this.$('#overTitle').textContent = 'EMPATE!';
    } else {
      this.$('#overChip').style.background = hex(winner === 1 ? th.p1 : th.p2);
      this.$('#overTitle').textContent = this.pName(winner, mode, pieceTheme) + ' VENCE!';
    }
    this.$('#overSub').textContent = reasonTxt ||
      ('CAPTURAS — ' + this.pName(1, mode, pieceTheme) + ': ' + capCount['1'] +
       '  •  ' + this.pName(-1, mode, pieceTheme) + ': ' + capCount['-1']);
    this.setRatingDelta(deltaTxt);
    setTimeout(() => this.$('#over').classList.remove('hide'), 650);
  }

  setRatingDelta(txt, positive = null) {
    const el = this.$('#overDelta');
    if (!el) return;
    el.textContent = txt;
    el.style.display = txt ? 'block' : 'none';
    el.classList.toggle('up', positive === true);
    el.classList.toggle('down', positive === false);
  }

  hideOverlay(id) { this.$('#' + id).classList.add('hide'); }
  showOverlay(id) { this.$('#' + id).classList.remove('hide'); }

  /* ============ MENU / ONLINE ============ */
  setMenuTab(tab) {
    this.$('#mGrpDiff').style.display = tab === 'pve' ? 'block' : 'none';
    this.$('#mGrpTime').style.display = tab !== 'online' ? 'block' : 'none';
    this.$('#mGrpOnline').style.display = tab === 'online' ? 'block' : 'none';
    this.$('#btnStart').style.display = tab !== 'online' ? 'block' : 'none';
  }

  setOnlineStatus(txt, searching = false) {
    const box = this.$('#onlineStatus');
    box.textContent = txt;
    box.style.display = txt ? 'block' : 'none';
    this.$('#searchSpin').style.display = searching ? 'inline-block' : 'none';
  }

  setSearchMode(on) {
    this.$('#onlineActions').style.display = on ? 'none' : 'block';
    this.$('#searchBox').style.display = on ? 'block' : 'none';
  }

  showRoomCode(code) {
    const box = this.$('#roomBox');
    box.style.display = code ? 'block' : 'none';
    if (code) this.$('#roomCodeShow').textContent = code;
  }

  updateRatingBadge(profile) {
    const badge = this.$('#ratingBadge');
    if (!profile) { badge.style.display = 'none'; return; }
    badge.style.display = 'flex';
    const btnProf = this.$('#btnProfile');
    if (btnProf) {
      const lg = leagueOf(profile.rating);
      btnProf.textContent = `👤 ${lg.label} · ${profile.rating} ELO`;
    }
    this.setAuthUI(profile);
  }

  /* Atualiza o chip de conta (canto) e o botão "Entrar com Google" do menu.
     connected = perfil com Google vinculado. */
  setAuthUI(profile) {
    const connected = !!(profile && profile.google);
    const chip = this.$('#authChip');
    if (chip) {
      chip.classList.toggle('connected', connected);
      const icon = this.$('#authChipIcon');
      const av = this.$('#authChipAvatar');
      const txt = this.$('#authChipText');
      if (connected) {
        if (icon) icon.style.display = 'none';
        if (profile.photoURL) { av.src = profile.photoURL; av.style.display = 'block'; }
        else { av.style.display = 'none'; if (icon) icon.style.display = 'block'; }
        txt.textContent = profile.name || 'PERFIL';
      } else {
        if (icon) icon.style.display = 'block';
        av.style.display = 'none';
        txt.textContent = this._authSigninLabel || 'ENTRAR';
      }
    }
    /* Botão grande do menu só aparece quando ainda não conectou ao Google */
    const gbtn = this.$('#googleConnectBtn');
    if (gbtn) gbtn.style.display = connected ? 'none' : 'flex';
  }

  /* Preenche o emblema de liga + barra de progresso de um perfil */
  _renderLeague(rating) {
    const lg = leagueOf(rating);
    const chip = this.$('#profLeagueChip');
    const fill = this.$('#profLeagueFill');
    const txt = this.$('#profLeagueTxt');
    if (!chip) return;
    chip.textContent = lg.label;
    chip.style.color = lg.color;
    chip.style.borderColor = lg.color;
    if (fill) {
      fill.style.width = lg.progressPct.toFixed(0) + '%';
      fill.style.background = lg.color;
    }
    if (txt) {
      txt.textContent = lg.isApex
        ? 'ÁPICE'
        : `${rating} → ${lg.nextRating} (próxima divisão)`;
    }
    /* Tinge o título e o anel do avatar com a cor da liga (consistência visual) */
    const title = this.$('#profTitle');
    if (title) title.style.color = lg.color;
    const wrap = this.$('.avatarWrap');
    if (wrap) wrap.style.boxShadow = `0 0 0 3px ${lg.color}`;
  }

  /* ============ PERFIL (FASE 1) ============ */
  renderProfile(profile) {
    this.$('#profName').textContent = profile.name;
    this.$('#profTitle').textContent = ratingTitle(profile.rating);
    this.$('#profRating').textContent = profile.rating;
    this._renderLeague(profile.rating);
    const photo = this.$('#profPhoto');
    const crown = this.$('#profCrown');
    if (profile.photoURL) {
      photo.src = profile.photoURL;
      photo.style.display = 'block';
      crown.style.display = 'none';
    } else {
      photo.style.display = 'none';
      crown.style.display = 'block';
    }
    this.$('#btnGoogleLink').style.display = profile.google ? 'none' : 'block';

    this.$('#stGames').textContent = profile.games;
    this.$('#stWins').textContent = profile.wins;
    this.$('#stLosses').textContent = profile.losses;
    this.$('#stDraws').textContent = profile.draws;
    const rate = profile.games > 0 ? Math.round(100 * profile.wins / profile.games) : 0;
    this.$('#stRate').textContent = rate + '%';
    this.$('#stStreak').textContent = profile.bestStreak || 0;

    this._drawSparkline(profile.ratingHistory || [profile.rating]);
  }

  /* Gráfico de evolução do rating (SVG puro) */
  _drawSparkline(hist) {
    const svg = this.$('#sparkline');
    if (hist.length < 2) hist = [hist[0] || 1000, hist[0] || 1000];
    const W = 320, H = 70, PAD = 6;
    const min = Math.min(...hist), max = Math.max(...hist);
    const span = Math.max(max - min, 20);
    const px = i => PAD + (i / (hist.length - 1)) * (W - 2 * PAD);
    const py = v => H - PAD - ((v - min) / span) * (H - 2 * PAD);
    const pts = hist.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
    const last = hist[hist.length - 1];
    svg.innerHTML =
      `<polyline points="${PAD},${H - PAD} ${pts.join(' ')} ${W - PAD},${H - PAD}"
         fill="rgba(227,169,78,.12)" stroke="none"/>` +
      `<polyline points="${pts.join(' ')}" fill="none" stroke="#E3A94E"
         stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<circle cx="${px(hist.length - 1)}" cy="${py(last)}" r="3.4"
         fill="#F6D27A" stroke="#15120C" stroke-width="1"/>`;
  }

  /* Grade de conquistas: mostra todo o catálogo, esmaecendo as bloqueadas */
  renderAchievements(unlocked) {
    const el = this.$('#achGrid');
    if (!el) return;
    const have = new Set((unlocked || []).map(a => a.id));
    el.innerHTML = ACHIEVEMENTS.map(a => {
      const got = have.has(a.id);
      return `<div class="achCard${got ? '' : ' locked'}" title="${this._esc(a.desc)}">
        <span class="achIcon">${got ? a.icon : '🔒'}</span>
        <span class="achName">${this._esc(a.name)}</span>
      </div>`;
    }).join('');
  }

  /* Lista de partidas recentes (FASE 6) */
  renderMatchList(list, myUid, onReplay, onShare) {
    const el = this.$('#matchList');
    el.innerHTML = '';
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="lb-empty">NENHUMA PARTIDA ONLINE AINDA</div>';
      return;
    }
    for (const m of list) {
      const meWhite = m.white.uid === myUid;
      const opp = meWhite ? m.black : m.white;
      const myCol = meWhite ? 1 : -1;
      const res = m.winner === 0 ? 'd' : (m.winner === myCol ? 'w' : 'l');
      const resTxt = res === 'w' ? 'VITÓRIA' : res === 'l' ? 'DERROTA' : 'EMPATE';
      const when = m.endedAtMs ? new Date(m.endedAtMs).toLocaleDateString('pt-BR') : '';
      const row = document.createElement('div');
      row.className = 'mh-row';
      row.innerHTML =
        `<span class="mh-dot ${res}"></span>` +
        `<span class="mh-vs">VS ${this._esc(opp.name)} (${opp.rating})<small>${when} · ${(m.moves || []).length} LANCES</small></span>` +
        `<span class="mh-res">${resTxt}</span>`;
      const btn = document.createElement('button');
      btn.className = 'mh-replay';
      btn.textContent = '▶ REPLAY';
      btn.onclick = () => onReplay(m);
      row.appendChild(btn);
      if (onShare) {
        const sh = document.createElement('button');
        sh.className = 'mh-replay ghost';
        sh.textContent = '🔗';
        sh.title = 'Copiar link do replay';
        sh.onclick = () => onShare(m);
        row.appendChild(sh);
      }
      el.appendChild(row);
    }
  }

  /* Lista de partidas ao vivo (FASE 7) */
  renderLiveList(list, onWatch) {
    const el = this.$('#liveList');
    el.innerHTML = '';
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="lb-empty">NENHUMA PARTIDA AO VIVO AGORA</div>';
      return;
    }
    for (const g of list) {
      const row = document.createElement('div');
      row.className = 'live-row';
      row.innerHTML =
        `<span class="live-dot"></span>` +
        `<span class="live-names">${this._esc(g.white.name)} × ${this._esc(g.black.name)}` +
        `<small>${g.white.rating} × ${g.black.rating} · ${(g.moves || []).length} LANCES</small></span>`;
      const btn = document.createElement('button');
      btn.className = 'live-watch';
      btn.textContent = '👁 ASSISTIR';
      btn.onclick = () => onWatch(g.id);
      row.appendChild(btn);
      el.appendChild(row);
    }
  }

  /* Lista de jogadores online ativos (Fase Desafios) */
  renderOnlinePlayers(list, myUid, onChallenge, onAddFriend, onOpen) {
    const el = this.$('#onlinePlayersList');
    el.innerHTML = '';
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="lb-empty">NENHUM OUTRO JOGADOR ONLINE AGORA</div>';
      return;
    }
    for (const p of list) {
      const row = document.createElement('div');
      row.className = 'player-row';
      const info = document.createElement('div');
      info.className = 'player-info clickable';
      info.innerHTML = `${this._esc(p.name)}<small>${p.rating} ELO · ${p.wins}V - ${p.losses}D</small>`;
      if (onOpen) info.onclick = () => onOpen(p);
      row.innerHTML = `<span class="player-status-dot"></span>`;
      row.appendChild(info);

      if (onAddFriend) {
        const fbtn = document.createElement('button');
        fbtn.className = 'player-btn ghost';
        fbtn.textContent = '➕';
        fbtn.title = 'Adicionar amigo';
        fbtn.onclick = () => onAddFriend(p);
        row.appendChild(fbtn);
      }
      const btn = document.createElement('button');
      btn.className = 'player-btn';
      btn.textContent = '⚔️ DESAFIAR';
      btn.onclick = () => onChallenge(p);
      row.appendChild(btn);
      el.appendChild(row);
    }
  }

  /* ============ AMIGOS (FASE 1C) ============ */
  renderFriends(list, onChallenge, onRemove, onOpen) {
    const el = this.$('#friendsList');
    el.innerHTML = '';
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="lb-empty">VOCÊ AINDA NÃO TEM AMIGOS</div>';
      return;
    }
    for (const p of list) {
      const row = document.createElement('div');
      row.className = 'player-row';
      const info = document.createElement('div');
      info.className = 'player-info clickable';
      info.innerHTML = this._esc(p.name || '???');
      if (onOpen) info.onclick = () => onOpen(p);
      row.innerHTML = `<span class="player-status-dot"></span>`;
      row.appendChild(info);

      const rem = document.createElement('button');
      rem.className = 'player-btn ghost';
      rem.textContent = '✕';
      rem.title = 'Remover amigo';
      rem.onclick = () => onRemove(p);
      row.appendChild(rem);

      const ch = document.createElement('button');
      ch.className = 'player-btn';
      ch.textContent = '⚔️ DESAFIAR';
      ch.onclick = () => onChallenge(p);
      row.appendChild(ch);
      el.appendChild(row);
    }
  }

  renderFriendRequests(reqs, onAccept, onDecline) {
    const el = this.$('#friendReqList');
    const label = this.$('#friendReqLabel');
    el.innerHTML = '';
    const has = reqs && reqs.length > 0;
    if (label) label.style.display = has ? 'block' : 'none';
    if (!has) return;
    for (const r of reqs) {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML =
        `<span class="player-status-dot" style="background:var(--acc);box-shadow:0 0 8px var(--acc)"></span>` +
        `<div class="player-info">${this._esc(r.from.name)}<small>${r.from.rating} ELO</small></div>`;
      const ok = document.createElement('button');
      ok.className = 'player-btn';
      ok.textContent = '✓';
      ok.onclick = () => onAccept(r);
      row.appendChild(ok);
      const no = document.createElement('button');
      no.className = 'player-btn ghost';
      no.textContent = '✕';
      no.onclick = () => onDecline(r);
      row.appendChild(no);
      el.appendChild(row);
    }
  }

  setFriendReqBadge(n) {
    const b = this.$('#friendReqBadge');
    if (!b) return;
    if (n > 0) { b.textContent = n; b.style.display = 'inline-block'; }
    else b.style.display = 'none';
  }

  /* ============ PRESENÇA (FASE 3) ============ */
  setPresence(seconds) {
    const bar = this.$('#presenceBar');
    if (seconds === null) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    this.$('#presenceTxt').textContent =
      `OPONENTE DESCONECTADO — AGUARDANDO RECONEXÃO… (${seconds}s)`;
  }

  /* ============ EMOTES (FASE 8) ============ */
  showEmoteBubble(color, emote) {
    const el = this.$(color === 1 ? '#bubble1' : '#bubble2');
    el.textContent = emote;
    el.classList.add('show');
    clearTimeout(this.bubbleTimers[String(color)]);
    this.bubbleTimers[String(color)] =
      setTimeout(() => el.classList.remove('show'), 2600);
  }

  toggleEmotePalette(force) {
    const p = this.$('#emotePalette');
    const show = force !== undefined ? force : p.style.display === 'none';
    p.style.display = show ? 'grid' : 'none';
  }

  /* ============ REPLAY (FASE 6) ============ */
  showReplayBar(show, total = 0) {
    this.$('#replayBar').style.display = show ? 'flex' : 'none';
    if (show) {
      const s = this.$('#rpSlider');
      s.max = total;
      s.value = 0;
    }
  }

  updateReplay(idx, total, playing) {
    this.$('#rpSlider').value = idx;
    this.$('#rpCounter').textContent = `${idx} / ${total}`;
    this.$('#rpPlay').textContent = playing ? '⏸' : '▶';
  }

  setSearchBand(band) {
    const el = this.$('#searchBandTxt');
    if (band === null) { el.textContent = ''; return; }
    el.textContent = band === Infinity
      ? 'BUSCANDO QUALQUER OPONENTE'
      : `FAIXA DE ELO: ±${band}`;
  }

  /* ============ CÂMERA / VISÃO (P0 MOBILE) ============ */
  setCamButton(topDown) {
    const b = this.$('#camToggle');
    if (b) b.classList.toggle('on', topDown);
  }

  /* ============ BARRA DE VANTAGEM DA IA (LINHA DE ANÁLISE) ============
     score > 0 favorece as CLARAS (jogador 1). Comprime via tanh para %. */
  updateEvalBar(score, names) {
    const bar = this.$('#evalBar');
    if (!bar) return;
    const pctWhite = 50 + 50 * Math.tanh(score / 600);
    this.$('#evalFill').style.height = pctWhite.toFixed(1) + '%';
    const adv = Math.abs(score);
    let txt;
    if (adv < 40) txt = 'EQUILÍBRIO';
    else {
      const lead = score > 0 ? names[1] : names[-1];
      txt = `${lead} +${(adv / 100).toFixed(1)}`;
    }
    this.$('#evalTxt').textContent = txt;
  }

  showEvalBar(show) {
    const bar = this.$('#evalBar');
    if (bar) bar.style.display = show ? 'flex' : 'none';
  }

  /* ============ MÚSICA (P1) ============ */
  setMusicUI(on, volume) {
    this.setSeg('#segMusic', on ? 1 : 0);
    const sl = this.$('#musicVol');
    if (sl) sl.value = Math.round(volume * 100);
  }

  /* ============ RANKING ============ */
  renderLeaderboard(list, myUid, isSearch = false) {
    const el = this.$('#lbList');
    el.innerHTML = '';
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="lb-empty">NENHUM JOGADOR AINDA</div>';
      return;
    }
    list.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row' + (p.uid === myUid ? ' me' : '');
      const medal = isSearch ? '👤' : (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.');
      const lg = leagueOf(p.rating);
      row.innerHTML =
        `<span class="lb-pos">${medal}</span>` +
        `<span class="lb-name clickable" data-uid="${this._esc(p.uid)}">${this._esc(p.name || '???')}</span>` +
        `<span class="lb-title" style="color:${lg.color}">${lg.label}</span>` +
        `<span class="lb-rating">${p.rating}</span>`;
      el.appendChild(row);
    });
  }

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  /* ============ BARRA DE AÇÕES ============ */
  /* opts: { hint, resign, draw, claim, emote, leaveWatch } */
  setActions(opts) {
    this.$('#btnHint').style.display = opts.hint ? 'flex' : 'none';
    this.$('#btnResign').style.display = opts.resign ? 'flex' : 'none';
    this.$('#btnDrawOffer').style.display = opts.draw ? 'flex' : 'none';
    this.$('#btnClaimWin').style.display = opts.claim ? 'flex' : 'none';
    this.$('#btnEmote').style.display = opts.emote ? 'flex' : 'none';
    this.$('#btnLeaveWatch').style.display = opts.leaveWatch ? 'flex' : 'none';
    if (!opts.emote) this.toggleEmotePalette(false);
  }

  showDrawOffer(show) {
    this.$('#drawOfferBar').style.display = show ? 'flex' : 'none';
  }

  setSoundIcon(muted) {
    this.$('#btnSound').textContent = muted ? '🔇' : '🔊';
  }

  /* ============ SEGMENTED BUTTONS ============ */
  segBind(id, cb) {
    const seg = this.$(id);
    if (!seg) return;
    seg.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        cb(b.dataset.v);
      };
    });
  }

  setSeg(id, v) {
    const seg = this.$(id);
    if (!seg) return;
    seg.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', b.dataset.v === String(v))
    );
  }

  /* ============ TEMAS ============ */
  buildSwatches(onBoard, onPiece, boardIdx = 0, pieceIdx = 0) {
    const renderCards = (containerId, data, currentIdx, isBoard, callback) => {
      const container = this.$(containerId);
      if(!container) return;
      container.innerHTML = '';
      data.forEach((t, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn' + (i === currentIdx ? ' prim' : '');
        btn.style.marginBottom = '0';
        btn.style.height = '60px';
        btn.style.display = 'flex';
        btn.style.flexDirection = 'column';
        btn.style.justifyContent = 'center';
        btn.style.alignItems = 'center';
        btn.style.gap = '4px';
        
        let c1, c2;
        if(isBoard) { c1 = hex(t.light); c2 = hex(t.dark); }
        else { c1 = hex(t.p1); c2 = hex(t.p2); }
        
        btn.innerHTML = `<div style="font-size:12px; white-space:normal; line-height:1.1; font-weight:bold">${t.nome}</div>
                         <div style="width:40px;height:12px;border-radius:6px;background:linear-gradient(90deg, ${c1} 50%, ${c2} 50%); border:1px solid rgba(255,255,255,0.2)"></div>`;
        btn.onclick = () => callback(i);
        container.appendChild(btn);
      });
    };
    
    renderCards('#arenaGrid', BOARD_THEMES, boardIdx, true, onBoard);
    renderCards('#skinGrid', PIECE_THEMES, pieceIdx, false, onPiece);
  }

  updateBoardSwatches(idx) {
    document.querySelectorAll('#arenaGrid .btn').forEach((el, j) =>
      el.classList.toggle('prim', j === idx)
    );
  }

  updatePieceSwatches(idx) {
    document.querySelectorAll('#skinGrid .btn').forEach((el, j) =>
      el.classList.toggle('prim', j === idx)
    );
  }
}
