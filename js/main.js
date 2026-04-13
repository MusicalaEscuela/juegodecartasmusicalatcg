/* ===================================================
   MUSICALA – main.js  v2
   Punto de entrada y orquestación
   =================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ── Fonts (Nunito + Fredoka One) ──────────────────────────────────────────
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;900&display=swap';
  document.head.appendChild(fontLink);

  // ── Card Action Menu — inicializar eventos ────────────────────────────────
  initCardActionMenu();

  // ── Intro ────────────────────────────────────────────────────────────────
  document.getElementById('btn-intro-play').addEventListener('click', () => {
    showScreen('screen-setup'); renderSetup();
  });
  document.getElementById('btn-intro-rules').addEventListener('click', showRulesModal);

  // ── Online mode ───────────────────────────────────────────────────────────
  document.getElementById('btn-intro-online').addEventListener('click', async () => {
    showScreen('screen-online');
    await loadFirebase();
    window.FB.onAuthStateChanged(window.FB.auth, (user) => {
      if (user) {
        ON.user = { uid: user.uid, name: user.displayName || 'Jugador', photoURL: user.photoURL };
      }
      renderOnlineAuth();
    });
  });

  document.getElementById('btn-online-back').addEventListener('click', () => {
    showScreen('screen-intro');
  });

  document.getElementById('btn-lobby-start').addEventListener('click', handleLobbyStart);

  document.getElementById('btn-lobby-leave').addEventListener('click', async () => {
    await exitOnlineMode();
    showScreen('screen-intro');
  });

  document.getElementById('btn-copy-code').addEventListener('click', () => {
    const code = document.getElementById('lobby-code-display').textContent;
    navigator.clipboard.writeText(code).then(() => showToast(`Código ${code} copiado ✓`));
  });

  // ── Setup ─────────────────────────────────────────────────────────────────
  renderSetup();
  document.getElementById('btn-add-player').addEventListener('click', () => addPlayer());

  document.getElementById('btn-start').addEventListener('click', () => {
    if (setupPlayers.length < 2) { showToast('Necesitas al menos 2 jugadores.'); return; }
    document.querySelectorAll('.player-name-input').forEach((inp, i) => {
      if (setupPlayers[i]) setupPlayers[i].name = inp.value.trim() || `Jugador ${i + 1}`;
    });
    startGame();
  });

  // ── Game actions ──────────────────────────────────────────────────────────
  document.getElementById('deck-pile').addEventListener('click', () => {
    if (!G || G.winner) return;
    const drawFn = G._onlineMode ? onlineHumanDraw : humanDraw;
    const result = drawFn();
    if (!result.ok) { if (result.error) showToast(result.error); return; }
    renderGame();
    if (!G._onlineMode && !isHumanTurn()) scheduleNextTurn();
  });

  document.getElementById('btn-draw').addEventListener('click', () => {
    if (!G || G.winner) return;
    const drawFn = G._onlineMode ? onlineHumanDraw : humanDraw;
    const result = drawFn();
    if (!result.ok) { if (result.error) showToast(result.error); return; }
    renderGame();
    if (!G._onlineMode && !isHumanTurn()) scheduleNextTurn();
  });

  document.getElementById('btn-musicala').addEventListener('click', () => {
    const result = humanAnnounceMusica();
    if (!result.ok) showToast(result.error || 'No puedes gritar MUSICALA ahora.');
    else { showToast('¡MUSICALA! Anunciado. 🎵'); renderGame(); }
  });

  document.getElementById('btn-play-scale').addEventListener('click', () => {
    if (!G) return;
    const isOnline = G._onlineMode;
    if (isOnline ? !isMyOnlineTurn() : !isHumanTurn()) return;
    const scaleFn = isOnline ? onlineHumanPlayScale : humanPlayScale;
    const result  = scaleFn(G.selectedCards);
    if (!result.ok) { showToast(result.error || 'Escala inválida.'); return; }
    handlePostPlay(result);
  });

  document.getElementById('btn-history').addEventListener('click', showFullHistory);

  document.getElementById('btn-new-game').addEventListener('click', () => {
    showModal(`
      <p class="modal-title">¿Nueva partida?</p>
      <p class="modal-body">Se perderá el progreso actual.</p>
      <div class="modal-actions">
        <button class="modal-btn primary" onclick="closeModal(); startGame();">Reiniciar</button>
        <button class="modal-btn secondary" onclick="closeModal()">Cancelar</button>
      </div>
    `);
  });

  document.getElementById('btn-menu').addEventListener('click', () => {
    showModal(`
      <p class="modal-title">Menú</p>
      <div class="modal-actions" style="flex-direction:column;gap:10px;">
        <button class="modal-btn primary"   onclick="closeModal(); startGame();">Reiniciar partida</button>
        <button class="modal-btn secondary" onclick="closeModal(); showFullHistory();">📋 Historial</button>
        <button class="modal-btn secondary" onclick="closeModal(); showScreen('screen-setup'); renderSetup();">Cambiar jugadores</button>
        <button class="modal-btn secondary" onclick="closeModal(); showRulesModal();">Ver reglas</button>
        <button class="modal-btn secondary" onclick="closeModal()">Cancelar</button>
      </div>
    `);
  });

  // ── Pass-screen dismiss ───────────────────────────────────────────────────
  document.getElementById('btn-pass-ready').addEventListener('click', () => {
    dismissPassScreen();
  });

  // ── Winner screen ─────────────────────────────────────────────────────────
  document.getElementById('btn-play-again').addEventListener('click', () => startGame());
  document.getElementById('btn-change-players').addEventListener('click', () => {
    showScreen('screen-setup'); renderSetup();
  });

  // ── Modal backdrop ────────────────────────────────────────────────────────
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

});

// ── Start game ────────────────────────────────────────────────────────────────

function startGame() {
  if (aiTimer) clearTimeout(aiTimer);
  initGame(setupPlayers);
  showScreen('screen-game');
  renderGame();
  if (!isHumanTurn()) scheduleNextTurn();
}

// ── Rules modal ───────────────────────────────────────────────────────────────

function showRulesModal() {
  showModal(`
    <p class="modal-title">Reglas de Musicala</p>
    <div class="modal-body rules-body">
      <p><strong>🎯 Objetivo:</strong> Sé el primero en quedarte sin cartas.</p>

      <p><strong>🎵 En tu turno puedes jugar:</strong></p>
      <ul>
        <li>La nota siguiente en la secuencia</li>
        <li>La nota anterior en la secuencia</li>
        <li>La misma nota que está en juego</li>
        <li>Una carta especial o de alteración válida</li>
      </ul>

      <p><strong>🎼 Escalas:</strong> Selecciona 3+ notas consecutivas y usa el botón "Escala" para jugarlas todas de un golpe.</p>

      <p><strong>🃏 Sin carta válida:</strong> Roba una del mazo. Si es válida, puedes jugarla; si no, pierdes el turno.</p>

      <p><strong>📢 MUSICALA:</strong> Cuando te quede 1 carta, presiona <em>¡MUSICALA!</em>. Si no lo haces antes del siguiente turno, robas 2 cartas.</p>

      <p><strong>♯ Sostenido:</strong> Obliga al siguiente a subir. No sobre MI ni SI.</p>
      <p><strong>♭ Bemol:</strong> Obliga al siguiente a bajar. No sobre FA ni DO.</p>
      <p><strong>♮ Becuadro:</strong> Cancela la alteración activa.</p>

      <p><strong>👥 Multijugador local:</strong> Cuando haya varios humanos, el juego pedirá pasar el dispositivo entre cada turno para que nadie vea la mano del otro.</p>
    </div>
    <div class="modal-actions">
      <button class="modal-btn primary" onclick="closeModal()">Entendido</button>
    </div>
  `);
}