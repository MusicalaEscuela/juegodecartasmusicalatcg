/* ===================================================
   MUSICALA – online.js
   Modo online: autenticación, lobby y sincronización
   =================================================== */

'use strict';

// ── Estado online ─────────────────────────────────────────────────────────────

const ON = {
  user:        null,   // { uid, name, photoURL }
  roomCode:    null,
  myIndex:     -1,     // índice de este jugador en room.players
  roomUnsub:   null,   // unsubscribe del listener de la sala
  myHand:      [],     // mano privada de este jugador
  isHost:      false,
  latestState: null,   // último gameState recibido de Firestore
};

// ── Auth ──────────────────────────────────────────────────────────────────────

async function onlineLogin() {
  const { auth, signInWithPopup, GoogleAuthProvider } = window.FB;
  const provider = new GoogleAuthProvider();
  const result   = await signInWithPopup(auth, provider);
  const user     = result.user;
  ON.user = { uid: user.uid, name: user.displayName || 'Jugador', photoURL: user.photoURL };
  renderOnlineAuth();
}

async function onlineLogout() {
  const { auth, signOut } = window.FB;
  if (ON.roomCode) await leaveRoom(ON.roomCode);
  await signOut(auth);
  ON.user = null;
  ON.roomCode = null;
  renderOnlineAuth();
}

// ── Pantalla online: login / lobby ────────────────────────────────────────────

function renderOnlineAuth() {
  const el = document.getElementById('online-auth-area');
  if (!el) return;
  if (!ON.user) {
    el.innerHTML = `
      <div class="online-login-box">
        <p class="online-subtitle">Inicia sesión para jugar en línea</p>
        <button class="btn-google" id="btn-google-login">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.3 30.1 0 24 0 14.6 0 6.6 5.5 2.6 13.5l7.8 6C12.3 13.1 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.7 37.5 46.5 31.4 46.5 24.5z"/><path fill="#FBBC05" d="M10.4 28.5A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.5l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.3z"/><path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.4l-7.5-5.8c-2 1.4-4.6 2.2-7.5 2.2-6.3 0-11.6-4.2-13.5-9.9l-7.8 6.2C6.6 42.5 14.6 48 24 48z"/></svg>
          Continuar con Google
        </button>
      </div>
    `;
    document.getElementById('btn-google-login').addEventListener('click', onlineLogin);
  } else {
    el.innerHTML = `
      <div class="online-user-row">
        ${ON.user.photoURL ? `<img class="online-avatar" src="${ON.user.photoURL}" alt="">` : ''}
        <span class="online-username">${escHtml(ON.user.name)}</span>
        <button class="btn-link-small" id="btn-online-logout">Cerrar sesión</button>
      </div>
    `;
    document.getElementById('btn-online-logout').addEventListener('click', onlineLogout);
    renderLobbyActions();
  }
}

function renderLobbyActions() {
  const el = document.getElementById('online-lobby-actions');
  if (!el) return;
  el.innerHTML = `
    <div class="lobby-actions-row">
      <button class="btn-primary" id="btn-create-room">Crear sala</button>
      <span class="lobby-or">o</span>
      <div class="join-row">
        <input class="join-input" id="join-code-input" type="text" maxlength="4"
               placeholder="Código" autocomplete="off" style="text-transform:uppercase">
        <button class="btn-secondary" id="btn-join-room">Unirse</button>
      </div>
    </div>
  `;
  document.getElementById('btn-create-room').addEventListener('click', handleCreateRoom);
  document.getElementById('btn-join-room').addEventListener('click', handleJoinRoom);
  document.getElementById('join-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleJoinRoom();
  });
}

// ── Crear / Unirse a sala ─────────────────────────────────────────────────────

async function handleCreateRoom() {
  try {
    showOnlineSpinner(true);
    const code = await createRoom(ON.user.name);
    ON.roomCode = code;
    ON.isHost   = true;
    showScreen('screen-lobby');
    subscribeToRoom(code);
  } catch (e) {
    showToast('Error al crear sala: ' + e.message);
  } finally {
    showOnlineSpinner(false);
  }
}

async function handleJoinRoom() {
  const input = document.getElementById('join-code-input');
  const code  = (input?.value || '').trim().toUpperCase();
  if (code.length !== 4) { showToast('Ingresa el código de 4 letras.'); return; }
  try {
    showOnlineSpinner(true);
    await joinRoom(code, ON.user.name);
    ON.roomCode = code;
    ON.isHost   = false;
    showScreen('screen-lobby');
    subscribeToRoom(code);
  } catch (e) {
    showToast(e.message || 'No se pudo unir a la sala.');
  } finally {
    showOnlineSpinner(false);
  }
}

// ── Suscripción en tiempo real a la sala ──────────────────────────────────────

function subscribeToRoom(code) {
  if (ON.roomUnsub) ON.roomUnsub();
  const { db, doc, onSnapshot } = window.FB;
  ON.roomUnsub = onSnapshot(doc(db, 'rooms', code), async (snap) => {
    if (!snap.exists()) {
      showToast('La sala fue cerrada.');
      exitOnlineMode();
      return;
    }
    const room = snap.data();

    // Encontrar mi índice
    ON.myIndex = room.players.findIndex(p => p.uid === ON.user.uid);

    if (room.status === 'waiting') {
      renderLobbyScreen(room);
    }

    if (room.status === 'playing') {
      // Si acabo de entrar a la partida, cargar mi mano
      if (!ON.myHand.length || ON.latestState?.turnCount !== room.gameState?.turnCount) {
        ON.myHand = await readMyHand(code, ON.user.uid);
      }
      ON.latestState = room.gameState;
      syncOnlineStateToG(room.gameState, room.players);

      if (document.getElementById('screen-game').classList.contains('active')) {
        renderGame();
        // Si es mi turno y gané
        if (G.winner !== null) {
          setTimeout(() => showWinnerScreen(), 600);
        }
      } else {
        showScreen('screen-game');
        renderGame();
      }
    }

    if (room.status === 'ended') {
      showToast('La partida terminó.');
    }
  });
}

// ── Lobby screen ──────────────────────────────────────────────────────────────

function renderLobbyScreen(room) {
  const el = document.getElementById('lobby-players-list');
  if (!el) return;

  document.getElementById('lobby-code-display').textContent = room.code;

  el.innerHTML = room.players.map((p, i) => `
    <div class="lobby-player-row ${p.uid === ON.user.uid ? 'me' : ''}">
      <span class="lobby-player-num">${i + 1}</span>
      <span class="lobby-player-name">${escHtml(p.name)}</span>
      ${p.uid === room.hostUid ? '<span class="lobby-host-badge">Anfitrión</span>' : ''}
    </div>
  `).join('');

  const btnStart = document.getElementById('btn-lobby-start');
  if (btnStart) {
    const isHost   = room.hostUid === ON.user.uid;
    const canStart = isHost && room.players.length >= 2;
    btnStart.style.display  = isHost ? 'block' : 'none';
    btnStart.disabled       = !canStart;
    btnStart.textContent    = canStart
      ? `¡Empezar partida! (${room.players.length} jugadores)`
      : `Esperando jugadores… (${room.players.length}/2 mín.)`;
  }
}

async function handleLobbyStart() {
  if (!ON.isHost) return;
  try {
    showOnlineSpinner(true);
    await startOnlineGame(ON.roomCode);
    // El listener onSnapshot se encargará de mover a todos a la pantalla de juego
  } catch (e) {
    showToast('Error al iniciar: ' + e.message);
  } finally {
    showOnlineSpinner(false);
  }
}

// ── Sincronizar estado Firestore → G local ────────────────────────────────────

function syncOnlineStateToG(gameState, roomPlayers) {
  if (!gameState) return;

  // Reconstituir G mezclando estado público con mi mano privada
  G = {
    ...gameState,
    players: gameState.players.map((p, i) => ({
      name:              p.name,
      uid:               p.uid,
      isHuman:           true,    // todos son humanos en online
      musicalaAnnounced: p.musicalaAnnounced,
      // Solo YO tengo mi mano real; los demás tienen array vacío (su conteo está en handCount)
      hand: p.uid === ON.user.uid ? ON.myHand : Array(p.handCount).fill({ type: '_hidden' }),
    })),
    _onlineMode: true,
    _roomCode:   ON.roomCode,
    _myUid:      ON.user.uid,
    _myIndex:    ON.myIndex,
  };
}

// ── Overrides de humanPlayCard / humanDraw para modo online ───────────────────
// En modo online, después de cada jugada escribimos el estado a Firestore

const _origHumanPlayCard  = typeof humanPlayCard  !== 'undefined' ? humanPlayCard  : null;
const _origHumanDraw      = typeof humanDraw      !== 'undefined' ? humanDraw      : null;
const _origHumanPlayScale = typeof humanPlayScale !== 'undefined' ? humanPlayScale : null;

function onlineHumanPlayCard(cardIdx) {
  if (!G._onlineMode) return humanPlayCard(cardIdx);
  if (ON.myIndex !== G.currentPlayer) return { ok: false, error: 'No es tu turno.' };

  // Ejecutar lógica local primero
  const result = humanPlayCard(cardIdx);
  if (result.ok) _pushOnlineState();
  return result;
}

function onlineHumanDraw() {
  if (!G._onlineMode) return humanDraw();
  if (ON.myIndex !== G.currentPlayer) return { ok: false, error: 'No es tu turno.' };
  const result = humanDraw();
  if (result.ok) _pushOnlineState();
  return result;
}

function onlineHumanPlayScale(indices) {
  if (!G._onlineMode) return humanPlayScale(indices);
  if (ON.myIndex !== G.currentPlayer) return { ok: false, error: 'No es tu turno.' };
  const result = humanPlayScale(indices);
  if (result.ok) _pushOnlineState();
  return result;
}

async function _pushOnlineState() {
  if (!G._onlineMode) return;
  // Serializar G → Firestore (sin las manos privadas, solo handCounts)
  const publicState = buildPublicState();
  await writeGameState(ON.roomCode, publicState);
  // Guardar mi mano privada actualizada
  await writeMyHand(ON.roomCode, ON.user.uid, ON.myHand = G.players[ON.myIndex].hand);
}

function buildPublicState() {
  return {
    deck:          G.deck,
    discard:       G.discard,
    currentNote:   G.currentNote,
    currentPlayer: G.currentPlayer,
    direction:     G.direction,
    skipNext:      G.skipNext,
    forcedDir:     G.forcedDir,
    selectedCards: G.selectedCards,
    log:           G.log,
    noteHistory:   G.noteHistory,
    winner:        G.winner,
    phase:         G.phase,
    turnCount:     G.turnCount,
    players:       G.players.map(p => ({
      uid:               p.uid,
      name:              p.name,
      handCount:         p.hand.filter(c => c.type !== '_hidden').length || p.hand.length,
      musicalaAnnounced: p.musicalaAnnounced,
    })),
  };
}

// ── isHumanTurn para modo online ──────────────────────────────────────────────
// Reemplaza la función original cuando estamos en modo online

function isMyOnlineTurn() {
  if (!G || !G._onlineMode) return isHumanTurn();
  return G.currentPlayer === ON.myIndex;
}

// ── Salir del modo online ─────────────────────────────────────────────────────

async function exitOnlineMode() {
  if (ON.roomUnsub) { ON.roomUnsub(); ON.roomUnsub = null; }
  if (ON.roomCode)  { await leaveRoom(ON.roomCode).catch(() => {}); }
  ON.roomCode    = null;
  ON.myIndex     = -1;
  ON.myHand      = [];
  ON.latestState = null;
  ON.isHost      = false;
  G = null;
  showScreen('screen-intro');
}

// ── Spinner helper ────────────────────────────────────────────────────────────

function showOnlineSpinner(show) {
  const el = document.getElementById('online-spinner');
  if (el) el.style.display = show ? 'flex' : 'none';
}
