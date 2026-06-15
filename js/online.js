/* ============================================================
   DAMAS ROYALE — Modo Online (Firebase)
   Auth anônima + Google · Firestore: matchmaking por faixa de
   Elo, salas, relógios sincronizados, recuperação de sessão,
   histórico de partidas, espectador, emotes e rating Elo
   ============================================================ */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { RATING_INICIAL, eloDelta } from './elo.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2';
const HEARTBEAT_MS = 20000;
const RATING_HISTORY_MAX = 30;

export class OnlineManager {
  constructor() {
    this.ready = false;
    this.uid = null;
    this.profile = null;
    this.f = null;             /* namespace do firestore */
    this.authM = null;         /* namespace do firebase-auth */
    this.auth = null;
    this.db = null;
    this.game = null;          /* { id, ref, myColor, data, started, spectate } */
    this.unsubGame = null;
    this.unsubLobby = null;
    this.hbTimer = null;
    this.presenceTimer = null;
    this.searchTimer = null;
    this.searchStart = 0;
    this.appliedMoves = 0;
    this.rated = false;
    this.lastDelta = 0;
    this.lastEmoteT = 0;

    /* Callbacks (ligados pelo main.js) */
    this.onMatchFound = null;   /* ({ myColor, opponent, code, resume, moves, data }) */
    this.onOpponentMove = null; /* (serializedMove) */
    this.onGameEnd = null;      /* (winner, reason) */
    this.onRated = null;        /* (delta, newRating) */
    this.onDrawOffer = null;    /* () */
    this.onPresence = null;     /* (segundosDesdeUltimoSinal) */
    this.onEmote = null;        /* (byColor, emote) */
    this.onSearchBand = null;   /* (faixaElo | null) — feedback da fila */
  }

  /* ============ INICIALIZAÇÃO ============ */
  async init(nick) {
    if (!isFirebaseConfigured) return false;
    try {
      const [appM, authM, fsM] = await Promise.all([
        import(`${FB}/firebase-app.js`),
        import(`${FB}/firebase-auth.js`),
        import(`${FB}/firebase-firestore.js`)
      ]);
      this.f = fsM;
      this.authM = authM;
      const app = appM.initializeApp(firebaseConfig);
      this.auth = authM.getAuth(app);
      this.db = fsM.getFirestore(app);
      await new Promise(res => {
        const stop = authM.onAuthStateChanged(this.auth, () => { stop(); res(); });
      });
      if (!this.auth.currentUser) await authM.signInAnonymously(this.auth);
      
      try {
        const result = await authM.getRedirectResult(this.auth);
        if (result && result.user) {
          this.uid = result.user.uid;
          await this._loadProfile(nick);
          await this._syncGoogleInfo(result.user);
          this.redirectResultMsg = 'CONTA GOOGLE VINCULADA ✓';
        }
      } catch (e) {
        if (e.code === 'auth/credential-already-in-use') {
          const credential = authM.GoogleAuthProvider.credentialFromError(e);
          if (credential) {
            const res = await authM.signInWithCredential(this.auth, credential);
            this.uid = res.user.uid;
            await this._loadProfile(nick);
            await this._syncGoogleInfo(res.user);
            this.redirectResultMsg = 'CONECTADO À SUA CONTA GOOGLE';
          }
        } else {
          console.error('Erro no getRedirectResult:', e);
        }
      }
      
      this.uid = this.auth.currentUser.uid;
      await this._loadProfile(nick);
      this.ready = true;
      return true;
    } catch (e) {
      console.error('Falha ao iniciar Firebase:', e);
      return false;
    }
  }

  _defaultProfile(nick) {
    return {
      name: nick || 'JOGADOR', rating: RATING_INICIAL,
      wins: 0, losses: 0, draws: 0, games: 0,
      streak: 0, bestStreak: 0,
      ratingHistory: [RATING_INICIAL],
      photoURL: null, google: false
    };
  }

  async _loadProfile(nick) {
    const f = this.f;
    const ref = f.doc(this.db, 'players', this.uid);
    const snap = await f.getDoc(ref);
    if (snap.exists()) {
      /* Preenche campos novos em perfis antigos */
      this.profile = { ...this._defaultProfile(nick), ...snap.data() };
      if (nick && nick !== this.profile.name) await this.setName(nick);
    } else {
      this.profile = this._defaultProfile(nick);
      await f.setDoc(ref, { ...this.profile, createdAt: f.serverTimestamp() });
    }
  }

  async setName(name) {
    if (!this.profile) return;
    this.profile.name = name;
    try {
      await this.f.updateDoc(this.f.doc(this.db, 'players', this.uid), { name });
    } catch (e) { console.error('Erro ao salvar apelido:', e); }
  }

  /* ============ GOOGLE AUTH (FASE 1) ============ */
  /* Vincula a conta Google ao perfil anônimo (preserva o Elo).
     Se o Google já tiver outro perfil, troca para ele. */
  async linkGoogle() {
    const { GoogleAuthProvider, linkWithRedirect } = this.authM;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await linkWithRedirect(this.auth.currentUser, provider);
  }

  async _syncGoogleInfo(user) {
    const photoURL = user.photoURL || null;
    this.profile.photoURL = photoURL;
    this.profile.google = true;
    try {
      await this.f.updateDoc(this.f.doc(this.db, 'players', this.uid),
        { photoURL, google: true });
    } catch (e) { console.error('Erro ao sincronizar Google:', e); }
  }

  _me() {
    return {
      uid: this.uid, name: this.profile.name,
      rating: this.profile.rating, photoURL: this.profile.photoURL || null
    };
  }

  /* tc: { base: ms (0 = livre), inc: ms por lance } */
  _newGameDoc(white, black, status, tc) {
    tc = tc || { base: 0, inc: 0 };
    return {
      status, white, black, moves: [],
      drawOffer: null, winner: null, reason: null,
      hbWhite: Date.now(), hbBlack: Date.now(),
      tc, clockW: tc.base, clockB: tc.base,
      turnStartedAt: this.f.serverTimestamp(),
      emote: null,
      createdAt: this.f.serverTimestamp()
    };
  }

  /* ============ PARTIDA RÁPIDA — FILA POR FAIXA DE ELO (FASE 5) ============ */
  async quickMatch(tc) {
    const f = this.f;
    this.searchStart = Date.now();
    /* Entra na fila imediatamente (para que outros possam nos achar) */
    const myRef = f.doc(this.db, 'lobby', this.uid);
    await f.setDoc(myRef, {
      ...this._me(), tc: tc || { base: 0, inc: 0 },
      gameId: null, createdAt: f.serverTimestamp()
    });
    this.unsubLobby = f.onSnapshot(myRef, s => {
      const v = s.data();
      if (v && v.gameId && !this.game) {
        this._stopSearch();
        f.deleteDoc(myRef).catch(() => {});
        this._attachGame(v.gameId, 1);
      }
    });
    /* Varre a fila agora e a cada 5 s, expandindo a faixa de Elo */
    this._scanLobby();
    this.searchTimer = setInterval(() => this._scanLobby(), 5000);
  }

  _searchBand() {
    const sec = (Date.now() - this.searchStart) / 1000;
    if (sec >= 20) return Infinity;
    return 150 + Math.floor(sec / 5) * 100;
  }

  async _scanLobby() {
    if (this.game || !this.unsubLobby) return;
    const f = this.f;
    const band = this._searchBand();
    if (this.onSearchBand) this.onSearchBand(band);
    let snap;
    try {
      snap = await f.getDocs(f.query(
        f.collection(this.db, 'lobby'), f.orderBy('createdAt'), f.limit(15)
      ));
    } catch (e) { console.error('Erro ao varrer a fila:', e); return; }

    const myRef = f.doc(this.db, 'lobby', this.uid);
    for (const d of snap.docs) {
      const e = d.data();
      if (e.uid === this.uid || e.gameId) continue;
      if (band !== Infinity && Math.abs((e.rating || RATING_INICIAL) - this.profile.rating) > band) continue;
      const gameId = this._randomId(10);
      try {
        let matchedId = null;
        await f.runTransaction(this.db, async tx => {
          /* Alguém já nos pareou enquanto procurávamos? */
          const mine = await tx.get(myRef);
          if (mine.exists() && mine.data().gameId) {
            matchedId = mine.data().gameId;
            return;
          }
          const fresh = await tx.get(d.ref);
          if (!fresh.exists() || fresh.data().gameId) throw new Error('ocupado');
          const host = fresh.data();
          /* Quem espera há mais tempo joga de claras; o tempo é o do anfitrião */
          tx.set(f.doc(this.db, 'games', gameId), this._newGameDoc(
            { uid: host.uid, name: host.name, rating: host.rating, photoURL: host.photoURL || null },
            this._me(), 'active', host.tc
          ));
          tx.update(d.ref, { gameId });
          tx.delete(myRef);
        });
        if (this.game) return;
        this._stopSearch();
        if (matchedId) {
          f.deleteDoc(myRef).catch(() => {});
          this._attachGame(matchedId, 1);
        } else {
          this._attachGame(gameId, -1);
        }
        return;
      } catch (err) { /* candidato ocupado — tenta o próximo */ }
    }
  }

  async cancelSearch() {
    this._stopSearch();
    if (this.f) {
      await this.f.deleteDoc(this.f.doc(this.db, 'lobby', this.uid)).catch(() => {});
    }
  }

  _stopSearch() {
    if (this.unsubLobby) { this.unsubLobby(); this.unsubLobby = null; }
    if (this.searchTimer) { clearInterval(this.searchTimer); this.searchTimer = null; }
  }

  /* ============ SALAS COM CÓDIGO / LINK (FASE 2) ============ */
  async createRoom(tc) {
    const f = this.f;
    const code = this._randomId(6);
    await f.setDoc(f.doc(this.db, 'games', code),
      this._newGameDoc(this._me(), null, 'waiting', tc));
    this._attachGame(code, 1);
    return code;
  }

  roomLink(code) {
    return window.location.origin + window.location.pathname + '?room=' + code;
  }

  async cancelRoom() {
    if (!this.game) return;
    const ref = this.game.ref;
    const waiting = !this.game.started;
    this._detachGame();
    if (waiting) await this.f.deleteDoc(ref).catch(() => {});
  }

  async joinRoom(code) {
    const f = this.f;
    code = code.trim().toUpperCase();
    const ref = f.doc(this.db, 'games', code);
    await f.runTransaction(this.db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('SALA NÃO ENCONTRADA');
      const g = snap.data();
      if (g.status !== 'waiting') throw new Error('SALA JÁ ESTÁ CHEIA');
      if (g.white.uid === this.uid) throw new Error('VOCÊ CRIOU ESTA SALA');
      tx.update(ref, {
        black: this._me(), status: 'active',
        hbBlack: Date.now(), turnStartedAt: f.serverTimestamp()
      });
    });
    this._attachGame(code, -1);
  }

  /* ============ RECUPERAÇÃO DE SESSÃO (FASE 3) ============ */
  async resumeGame(gameId, myColor) {
    const f = this.f;
    try {
      const snap = await f.getDoc(f.doc(this.db, 'games', gameId));
      if (!snap.exists() || snap.data().status !== 'active') return false;
      this._attachGame(gameId, myColor, { resume: true });
      return true;
    } catch (e) {
      console.error('Erro ao recuperar sessão:', e);
      return false;
    }
  }

  /* ============ ESPECTADOR (FASE 7) ============ */
  async listActiveGames(top = 20) {
    const f = this.f;
    const snap = await f.getDocs(f.query(
      f.collection(this.db, 'games'),
      f.where('status', '==', 'active'), f.limit(top)
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(g => g.white && g.black);
  }

  spectate(gameId) {
    this._attachGame(gameId, 0, { resume: true, spectate: true });
  }

  /* ============ SINCRONIZAÇÃO DA PARTIDA ============ */
  _attachGame(gameId, myColor, opts = {}) {
    const f = this.f;
    this._detachGame();
    this.appliedMoves = 0;
    this.rated = false;
    this.lastDelta = 0;
    const ref = f.doc(this.db, 'games', gameId);
    this.game = {
      id: gameId, ref, myColor, data: null, started: false,
      spectate: !!opts.spectate, lastOppHb: null, lastOppSeen: Date.now()
    };

    this.unsubGame = f.onSnapshot(ref, snap => {
      if (!snap.exists() || !this.game) return;
      const g = snap.data();
      this.game.data = g;

      /* Início (ou retomada) da partida */
      if (!this.game.started && g.status !== 'waiting') {
        this.game.started = true;
        this.lastEmoteT = g.emote?.t || 0;
        const resume = !!opts.resume;
        if (resume) this.appliedMoves = (g.moves || []).length;
        if (!this.game.spectate) this._startHeartbeat();
        const opponent = myColor === -1 ? g.white : g.black;
        if (this.onMatchFound) {
          this.onMatchFound({
            myColor, opponent, code: gameId, resume,
            moves: (g.moves || []).map(s => JSON.parse(s).m),
            data: g
          });
        }
      }

      /* Lances novos */
      const moves = g.moves || [];
      while (this.appliedMoves < moves.length) {
        const entry = JSON.parse(moves[this.appliedMoves]);
        this.appliedMoves++;
        if (entry.by !== this.uid && this.onOpponentMove) this.onOpponentMove(entry.m);
      }

      /* Emote (FASE 8) */
      if (g.emote && g.emote.t !== this.lastEmoteT) {
        this.lastEmoteT = g.emote.t;
        if (g.emote.by !== this.uid && this.onEmote && g.white && g.black) {
          this.onEmote(g.emote.by === g.white.uid ? 1 : -1, g.emote.e);
        }
      }

      /* Proposta de empate do oponente */
      if (g.status === 'active' && g.drawOffer && g.drawOffer !== this.uid &&
          !this.game.spectate && this.onDrawOffer) {
        this.onDrawOffer();
      }

      /* Presença do oponente (heartbeat) */
      const oppHb = myColor === 1 ? g.hbBlack : g.hbWhite;
      if (oppHb !== this.game.lastOppHb) {
        this.game.lastOppHb = oppHb;
        this.game.lastOppSeen = Date.now();
      }

      /* Fim de jogo */
      if (g.status === 'finished' && !this.rated) {
        this.rated = true;
        if (!this.game.spectate) {
          this._applyRating(g);
          this._saveMatchHistory(gameId, g);
        }
        this._stopTimers();
        if (this.onGameEnd) this.onGameEnd(g.winner, g.reason);
      }
    }, e => console.error('Erro no snapshot da partida:', e));

    /* Monitor de presença (1 s) */
    if (!opts.spectate) {
      this.presenceTimer = setInterval(() => {
        if (!this.game || !this.game.started) return;
        if (this.game.data && this.game.data.status !== 'active') return;
        if (this.onPresence) {
          this.onPresence(Math.floor((Date.now() - this.game.lastOppSeen) / 1000));
        }
      }, 1000);
    }
  }

  _startHeartbeat() {
    const f = this.f;
    const field = this.game.myColor === 1 ? 'hbWhite' : 'hbBlack';
    const beat = () => {
      if (!this.game || !this.game.data || this.game.data.status !== 'active') return;
      f.updateDoc(this.game.ref, { [field]: Date.now() }).catch(() => {});
    };
    beat();
    this.hbTimer = setInterval(beat, HEARTBEAT_MS);
  }

  _stopTimers() {
    if (this.hbTimer) { clearInterval(this.hbTimer); this.hbTimer = null; }
    if (this.presenceTimer) { clearInterval(this.presenceTimer); this.presenceTimer = null; }
  }

  _detachGame() {
    this._stopTimers();
    if (this.unsubGame) { this.unsubGame(); this.unsubGame = null; }
    this.game = null;
  }

  /* Envia o meu lance + relógio restante (FASE 4).
     myClockMs: tempo restante do MEU relógio após o lance (já com acréscimo) */
  async sendMove(serialized, myClockMs = null) {
    if (!this.game || !this.game.data) return;
    const f = this.f;
    const n = (this.game.data.moves || []).length;
    const upd = {
      moves: f.arrayUnion(JSON.stringify({ n, by: this.uid, m: serialized })),
      drawOffer: null,
      turnStartedAt: f.serverTimestamp(),
      updatedAt: f.serverTimestamp()
    };
    if (myClockMs !== null) {
      upd[this.game.myColor === 1 ? 'clockW' : 'clockB'] = Math.max(0, Math.round(myClockMs));
    }
    await f.updateDoc(this.game.ref, upd)
      .catch(e => console.error('Erro ao enviar lance:', e));
  }

  /* ============ EMOTES (FASE 8) ============ */
  async sendEmote(e) {
    if (!this.game || !this.game.data || this.game.spectate) return;
    await this.f.updateDoc(this.game.ref, {
      emote: { by: this.uid, e, t: Date.now() }
    }).catch(() => {});
  }

  /* ============ ENCERRAMENTO ============ */
  async finishGame(winner, reason) {
    if (!this.game || !this.game.data || this.game.data.status === 'finished') return;
    if (this.game.spectate) return;
    await this.f.updateDoc(this.game.ref, { status: 'finished', winner, reason })
      .catch(() => {});
  }

  resign() {
    if (!this.game) return Promise.resolve();
    return this.finishGame(-this.game.myColor, 'resign');
  }

  claimAbandon() {
    if (!this.game) return Promise.resolve();
    return this.finishGame(this.game.myColor, 'abandon');
  }

  claimTimeout() {
    if (!this.game) return Promise.resolve();
    return this.finishGame(this.game.myColor, 'timeout');
  }

  async offerDraw() {
    if (!this.game || this.game.spectate) return;
    await this.f.updateDoc(this.game.ref, { drawOffer: this.uid }).catch(() => {});
  }

  async respondDraw(accept) {
    if (!this.game) return;
    if (accept) await this.finishGame(0, 'draw');
    else await this.f.updateDoc(this.game.ref, { drawOffer: null }).catch(() => {});
  }

  /* Sai da partida (desiste se ainda estiver ativa; espectador só desconecta) */
  async leaveGame() {
    if (this.game && !this.game.spectate &&
        this.game.data && this.game.data.status === 'active') {
      await this.resign();
    }
    this._detachGame();
  }

  /* ============ RATING (ELO) ============ */
  async _applyRating(g) {
    if (!g.white || !g.black) return;
    const myColor = this.game.myColor;
    const opp = myColor === 1 ? g.black : g.white;
    const score = g.winner === 0 ? 0.5 : (g.winner === myColor ? 1 : 0);
    const delta = eloDelta(this.profile.rating, opp.rating, score, this.profile.games);
    this.lastDelta = delta;

    const p = this.profile;
    p.rating += delta;
    p.games += 1;
    if (score === 1) { p.wins++; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak); }
    else if (score === 0) { p.losses++; p.streak = 0; }
    else { p.draws++; p.streak = 0; }
    p.ratingHistory = [...(p.ratingHistory || []), p.rating].slice(-RATING_HISTORY_MAX);

    try {
      await this.f.updateDoc(this.f.doc(this.db, 'players', this.uid), {
        rating: p.rating, games: p.games,
        wins: p.wins, losses: p.losses, draws: p.draws,
        streak: p.streak, bestStreak: p.bestStreak,
        ratingHistory: p.ratingHistory
      });
    } catch (e) { console.error('Erro ao salvar rating:', e); }
    if (this.onRated) this.onRated(delta, p.rating);
  }

  /* ============ HISTÓRICO DE PARTIDAS (FASE 6) ============ */
  async _saveMatchHistory(gameId, g) {
    if (!g.white || !g.black) return;
    try {
      await this.f.setDoc(this.f.doc(this.db, 'match_history', gameId), {
        players: [g.white.uid, g.black.uid],
        white: { uid: g.white.uid, name: g.white.name, rating: g.white.rating },
        black: { uid: g.black.uid, name: g.black.name, rating: g.black.rating },
        winner: g.winner, reason: g.reason || 'game',
        moves: g.moves || [], tc: g.tc || { base: 0, inc: 0 },
        endedAtMs: Date.now(), endedAt: this.f.serverTimestamp()
      }, { merge: true });
    } catch (e) { console.error('Erro ao salvar histórico:', e); }
  }

  async myMatches(top = 10) {
    const f = this.f;
    const snap = await f.getDocs(f.query(
      f.collection(this.db, 'match_history'),
      f.where('players', 'array-contains', this.uid), f.limit(50)
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.endedAtMs || 0) - (a.endedAtMs || 0))
      .slice(0, top);
  }

  async fetchMatch(id) {
    const snap = await this.f.getDoc(this.f.doc(this.db, 'match_history', id));
    return snap.exists() ? { id, ...snap.data() } : null;
  }

  /* ============ PRESENÇA E DESAFIOS (ONLINE/DESAFIOS) ============ */
  async updateActive() {
    if (!this.ready || !this.uid) return;
    const f = this.f;
    await f.updateDoc(f.doc(this.db, 'players', this.uid), {
      lastActive: Date.now()
    }).catch(() => {});
  }

  async listOnlinePlayers() {
    if (!this.ready) return [];
    const f = this.f;
    const cutoff = Date.now() - 5 * 60 * 1000; /* Últimos 5 minutos */
    const snap = await f.getDocs(f.query(
      f.collection(this.db, 'players'),
      f.where('lastActive', '>=', cutoff),
      f.limit(50)
    ));
    return snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(p => p.uid !== this.uid);
  }

  async sendChallenge(targetUid, targetName, targetRating) {
    if (!this.ready || !this.uid) return null;
    const f = this.f;
    const ref = f.doc(this.db, 'challenges', this.uid);
    const challengeData = {
      from: this._me(),
      to: { uid: targetUid, name: targetName, rating: targetRating },
      status: 'pending',
      createdAt: Date.now(),
      gameId: null
    };
    await f.setDoc(ref, challengeData);
    return ref;
  }

  listenToIncomingChallenges(onChallengeReceived) {
    if (!this.ready || !this.uid) return () => {};
    const f = this.f;
    return f.onSnapshot(f.query(
      f.collection(this.db, 'challenges'),
      f.where('to.uid', '==', this.uid),
      f.where('status', '==', 'pending')
    ), snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const challenge = { id: change.doc.id, ...change.doc.data() };
          onChallengeReceived(challenge);
        } else if (change.type === 'removed') {
          onChallengeReceived({ id: change.doc.id, status: 'cancelled' });
        }
      });
    });
  }

  listenToOutgoingChallenge(onAccepted, onDeclined, onCancelled) {
    if (!this.ready || !this.uid) return () => {};
    const f = this.f;
    const ref = f.doc(this.db, 'challenges', this.uid);
    return f.onSnapshot(ref, snap => {
      if (!snap.exists()) {
        onCancelled();
        return;
      }
      const data = snap.data();
      if (data.status === 'accepted') {
        onAccepted(data.gameId);
      } else if (data.status === 'declined') {
        onDeclined();
      }
    });
  }

  async acceptChallenge(challenge) {
    if (!this.ready) return null;
    const f = this.f;
    const gameId = this._randomId(10);
    await f.setDoc(f.doc(this.db, 'games', gameId), this._newGameDoc(
      challenge.from,
      challenge.to
    ));
    await f.updateDoc(f.doc(this.db, 'challenges', challenge.id), {
      status: 'accepted',
      gameId: gameId
    });
    return gameId;
  }

  async declineChallenge(challenge) {
    if (!this.ready) return;
    const f = this.f;
    await f.updateDoc(f.doc(this.db, 'challenges', challenge.id), {
      status: 'declined'
    });
    await f.deleteDoc(f.doc(this.db, 'challenges', challenge.id)).catch(() => {});
  }

  async cancelOutgoingChallenge() {
    if (!this.ready || !this.uid) return;
    const f = this.f;
    await f.deleteDoc(f.doc(this.db, 'challenges', this.uid)).catch(() => {});
  }

  /* ============ RANKING ============ */
  async leaderboard(top = 10) {
    const f = this.f;
    const snap = await f.getDocs(f.query(
      f.collection(this.db, 'players'),
      f.where('google', '==', true),
      f.orderBy('rating', 'desc'), f.limit(top)
    ));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  }

  /* ============ UTIL ============ */
  _randomId(len) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < len; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }
}
