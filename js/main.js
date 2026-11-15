/* ===================================================
   MUSICALA  main.js  v2
   Punto de entrada y orquestacin
   =================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  //  Card Action Menu  inicializar eventos 
  initCardActionMenu();

  //  Intro 
  const _btnContinue = document.getElementById('btn-intro-continue');
  if (_btnContinue) _btnContinue.addEventListener('click', resumeSavedGame);
  updateContinueButton();

  document.getElementById('btn-intro-play').addEventListener('click', () => {
    showScreen('screen-setup'); renderSetup();
  });
  document.getElementById('btn-intro-library').addEventListener('click', showCardLibraryModal);
  document.getElementById('btn-intro-rules').addEventListener('click', showRulesModal);

  //  Online mode 
  document.getElementById('btn-intro-online').addEventListener('click', async () => {
    showScreen('screen-online');
    await loadFirebase();
    if (!window.FB) { renderOnlineUnavailable(); return; }
    // Registrar el listener de sesion una sola vez (antes se duplicaba en cada clic).
    if (!ON.authUnsub) {
      ON.authUnsub = window.FB.onAuthStateChanged(window.FB.auth, (user) => {
        ON.user = user
          ? { uid: user.uid, name: user.displayName || 'Jugador', photoURL: user.photoURL }
          : null;
        renderOnlineAuth();
      });
    }
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
    navigator.clipboard.writeText(code).then(() => showToast(`Código ${code} copiado ✅`));
  });

  //  Setup 
  renderSetup();
  document.getElementById('btn-add-player').addEventListener('click', () => addPlayer());

  document.getElementById('btn-start').addEventListener('click', () => {
    if (setupPlayers.length < 2) { showToast('Necesitas al menos 2 jugadores.'); return; }
    document.querySelectorAll('.player-name-input').forEach((inp, i) => {
      if (setupPlayers[i]) setupPlayers[i].name = inp.value.trim() || `Jugador ${i + 1}`;
    });
    startGame();
  });

  //  Game actions
  document.getElementById('deck-pile').addEventListener('click', handleDrawClick);
  const _btnDraw = document.getElementById('btn-draw');
  if (_btnDraw) _btnDraw.addEventListener('click', handleDrawClick);

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
      <p class="modal-title">Opciones</p>
      <div class="modal-actions" style="flex-direction:column;gap:10px;">
        <button class="modal-btn primary"   onclick="closeModal(); startGame();">🔄 Reiniciar partida</button>
        <button class="modal-btn secondary" onclick="closeModal(); showSettingsModal();">⚙️ Configuración</button>
        <button class="modal-btn secondary" onclick="closeModal(); MTutorial && MTutorial.open(0);">📖 Ver tutorial</button>
        <button class="modal-btn secondary" onclick="closeModal(); showFullHistory();">📋 Historial</button>
        <button class="modal-btn secondary" onclick="closeModal(); showScreen('screen-setup'); renderSetup();">👥 Cambiar jugadores</button>
        <button class="modal-btn secondary" onclick="closeModal(); showRulesModal();">📜 Ver reglas</button>
        <button class="modal-btn secondary" onclick="closeModal()">Cancelar</button>
      </div>
    `);
  });

  //  Pass-screen dismiss 
  document.getElementById('btn-pass-ready').addEventListener('click', () => {
    dismissPassScreen();
  });

  //  Winner screen
  document.getElementById('btn-play-again').addEventListener('click', () => startGame());
  document.getElementById('btn-change-players').addEventListener('click', () => {
    showScreen('screen-setup'); renderSetup();
  });
  const _btnWinnerHome = document.getElementById('btn-winner-home');
  if (_btnWinnerHome) _btnWinnerHome.addEventListener('click', () => {
    if (aiTimer) clearTimeout(aiTimer);
    showScreen('screen-intro');
  });

  //  Sonido/vibración sutil en cualquier botón (un solo listener delegado)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (window.MSfx) MSfx.play('tap');
    if (window.MFx) MFx.haptic('tap');
  }, { passive: true });

  //  Modal backdrop 
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

});

//  Start game 

function startGame() {
  // Los envoltorios de eventos deben estar listos antes del primer render.
  if (typeof window.initGameEvents === 'function') window.initGameEvents();

  if (typeof window.startBackgroundMusic === 'function') {
    window.startBackgroundMusic();
  }

  if (aiTimer) clearTimeout(aiTimer);
  initGame(setupPlayers);
  showScreen('screen-game');
  renderGame();
  if (window.MFx) MFx.dealHand();

  // Tutorial automático la primera vez que se juega.
  if (window.MTutorial && MTutorial.shouldAutoShow()) {
    setTimeout(() => MTutorial.open(0), 350);
  }

  if (!isHumanTurn()) scheduleNextTurn();
}

// ── Continuar una partida local guardada ─────────────────────────────────────

function updateContinueButton() {
  const btn = document.getElementById('btn-intro-continue');
  if (!btn) return;
  const data = window.MSave ? MSave.load() : null;
  btn.hidden = !data;
  if (data) {
    const names = data.game.players.map(p => p.name).join(' · ');
    btn.textContent = '▶ Continuar partida';
    btn.title = `Turno ${data.game.turnCount + 1} — ${names}`;
    const sub = document.getElementById('intro-continue-sub');
    if (sub) { sub.hidden = false; sub.textContent = `Partida guardada: turno ${data.game.turnCount + 1} · ${names}`; }
  } else {
    const sub = document.getElementById('intro-continue-sub');
    if (sub) sub.hidden = true;
  }
}

function resumeSavedGame() {
  const data = window.MSave ? MSave.load() : null;
  if (!data) {
    updateContinueButton();
    showToast('No hay ninguna partida guardada.');
    return;
  }
  if (aiTimer) clearTimeout(aiTimer);
  if (typeof window.startBackgroundMusic === 'function') window.startBackgroundMusic();
  if (typeof window.initGameEvents === 'function') window.initGameEvents();

  G = data.game;
  G.selectedCards = [];
  if (Array.isArray(data.setupPlayers) && data.setupPlayers.length >= 2) setupPlayers = data.setupPlayers;

  showScreen('screen-game');
  renderGame();

  // Si se recargó a mitad de una elección (jugador objetivo / Nota de Paso), se vuelve a pedir.
  if (G._pending) { handlePostPlay({ ok: true, ...G._pending }); return; }
  if (G.phase === 'improvisacion' && isHumanTurn()) {
    showToast('¡Improvisación! Elige una carta de nota.');
    return;
  }
  scheduleNextTurn();
}

// Robar carta (mazo o botón). Sonido + mensaje claro + animación.
function handleDrawClick() {
  if (!G || G.winner) return;
  const drawFn = G._onlineMode ? onlineHumanDraw : humanDraw;
  const result = drawFn();
  if (!result.ok) {
    if (result.error) { showToast(result.error); if (window.MSfx) MSfx.play('error'); if (window.MFx) MFx.haptic('error'); }
    return;
  }
  if (window.MSfx) MSfx.play('draw');
  if (window.MFx) MFx.haptic('draw');
  renderGame();
  animateDrawnCard();
  if (window.MFx) {
    const hand = document.getElementById('hand-cards');
    MFx.drawCard((hand && hand.lastElementChild) || hand);
    const pile = document.getElementById('deck-pile');
    if (pile) {
      pile.classList.remove('fx-tap'); void pile.offsetWidth; pile.classList.add('fx-tap');
    }
  }
  if (result.drewPlayable) {
    showToast('🃏 La carta robada es válida. ¡Puedes jugarla ahora!');
  } else if (result.drew) {
    showToast('La carta robada no se puede jugar. Pierdes el turno.');
  }
  if (!G._onlineMode && !isHumanTurn()) scheduleNextTurn();
}

//  Rules modal 

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

      <p><strong>🎼 Escalas:</strong> Selecciona 3+ notas consecutivas y usa el botón «Jugar escala» para jugarlas todas de un golpe.</p>

      <p><strong>🃏 Sin carta válida:</strong> Roba una del mazo. Si es válida, puedes jugarla; si no, pierdes el turno.</p>

      <p><strong>♯ Sostenido:</strong> Obliga al siguiente a subir. No sobre MI ni SI.</p>
      <p><strong>♭ Bemol:</strong> Obliga al siguiente a bajar. No sobre FA ni DO.</p>
      <p><strong>♮ Becuadro:</strong> Cancela la alteración activa.</p>

      <p><strong>⭐ Cartas especiales:</strong> Cambian el rumbo del juego (robar, cambiar dirección, intercambiar manos, improvisar…). Al jugarlas verás un mensaje con su efecto. Toca el botón <strong>ⓘ</strong> de cada carta para leer qué hace.</p>

      <p><strong>🤝 Multijugador local:</strong> Cuando haya varios humanos, el juego pedirá pasar el dispositivo entre cada turno para que nadie vea la mano del otro.</p>
    </div>
    <div class="modal-actions">
      <button class="modal-btn secondary" onclick="closeModal(); if(window.MTutorial) MTutorial.open(0);">📖 Tutorial interactivo</button>
      <button class="modal-btn primary" onclick="closeModal()">Entendido</button>
    </div>
  `);
}

// ── Biblioteca de cartas con filtros + buscador + zoom ────────────────────────

let _libState   = { filter: 'all', query: '' };
let _libCurrent = [];

function _libraryItems() {
  const items = [];
  NOTES.forEach(note => items.push({
    type: 'note', note, id: `nota_${note.toLowerCase()}`,
    color: NOTE_COLORS[note], label: NOTE_LABELS[note], name: `Nota ${note}`,
    desc: `Nota musical ${note}. Se juega sobre la misma nota, la anterior o la siguiente de la escala.`,
  }));
  ALTERATION_DEFS.forEach(d => items.push({ ...d, type: 'alt' }));
  SPECIAL_DEFS.forEach(d => items.push({ ...d, type: 'special' }));
  return items;
}

function showCardLibraryModal() {
  _libState = { filter: 'all', query: '' };
  showModal(`
    <p class="modal-title">📚 Biblioteca de cartas</p>
    <div class="lib-controls">
      <input id="lib-search" class="lib-search" type="text" placeholder="🔍 Buscar por nombre…" autocomplete="off" />
      <div class="lib-filters" id="lib-filters">
        <button type="button" class="lib-filter active" data-f="all">Todas</button>
        <button type="button" class="lib-filter" data-f="note">Notas</button>
        <button type="button" class="lib-filter" data-f="alt">Alteraciones</button>
        <button type="button" class="lib-filter" data-f="special">Especiales</button>
      </div>
    </div>
    <div class="lib-grid" id="lib-grid"></div>
    <div class="modal-actions">
      <button class="modal-btn primary" onclick="closeModal()">Cerrar</button>
    </div>
  `);

  const search = document.getElementById('lib-search');
  if (search) search.addEventListener('input', () => {
    _libState.query = search.value.toLowerCase().trim();
    renderLibraryGrid();
  });
  document.querySelectorAll('#lib-filters .lib-filter').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#lib-filters .lib-filter').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      _libState.filter = b.dataset.f;
      renderLibraryGrid();
    });
  });
  renderLibraryGrid();
}

function renderLibraryGrid() {
  const grid = document.getElementById('lib-grid');
  if (!grid) return;
  const items = _libraryItems().filter(it => {
    if (_libState.filter !== 'all' && it.type !== _libState.filter) return false;
    if (_libState.query) {
      const hay = `${it.name || ''} ${it.note || ''} ${it.desc || ''}`.toLowerCase();
      if (!hay.includes(_libState.query)) return false;
    }
    return true;
  });
  _libCurrent = items;

  if (items.length === 0) {
    grid.innerHTML = `<p class="lib-empty">No se encontraron cartas para «${escHtml(_libState.query)}».</p>`;
    return;
  }

  grid.innerHTML = items.map((it, i) => {
    const title = it.type === 'note' ? `Nota ${it.note}` : (it.name || '');
    const src = getCardImageSrc(it, 'sm');
    return `<button type="button" class="lib-card" onclick="openLibraryCard(${i})" aria-label="${escHtml(title)}">
        <img src="${src}" alt="${escHtml(title)}" loading="lazy" decoding="async" onerror="this.style.opacity='0.12'">
        <span class="lib-card-name">${escHtml(title)}</span>
      </button>`;
  }).join('');
}

function openLibraryCard(i) {
  const card = _libCurrent[i];
  if (card) openCardZoom(card, null);
}

// ── Configuración dentro de la partida ────────────────────────────────────────

function showSettingsModal() {
  showModal(`
    <p class="modal-title">⚙️ Configuración</p>
    <div id="game-settings"></div>
    <p class="settings-note">La dificultad se aplica de inmediato. Las cartas iniciales y el mazo cambian en la próxima partida (ajústalos en «Cambiar jugadores»).</p>
    <div class="modal-actions">
      <button class="modal-btn secondary" onclick="closeModal(); if(window.MTutorial) MTutorial.open(0);">📖 Ver tutorial</button>
      <button class="modal-btn primary" onclick="closeModal()">Listo</button>
    </div>
  `);
  renderGameSettings();
}

function renderGameSettings() {
  const host = document.getElementById('game-settings');
  if (!host || !window.MSettings) return;
  const S = MSettings.get();
  const yn = [{ val: true, label: 'Sí' }, { val: false, label: 'No' }];
  const row = (icon, title, control) => `
    <div class="opt-row"><div class="opt-label">${icon} ${title}</div>${control}</div>`;
  host.innerHTML = `
    <div class="opt-grid">
      ${row('🔊', 'Sonido', _optSeg('soundEnabled', S.soundEnabled, yn, 'setGameSetting'))}
      ${row('📳', 'Vibración', _optSeg('hapticsEnabled', S.hapticsEnabled, yn, 'setGameSetting'))}
      ${row('⚡', 'Velocidad', _optSeg('animSpeed', S.animSpeed, [
        { val: 'lenta', label: 'Lenta' }, { val: 'normal', label: 'Normal' }, { val: 'rapida', label: 'Rápida' }], 'setGameSetting'))}
      ${row('🤖', 'Dificultad CPU', _optSeg('difficulty', S.difficulty, [
        { val: 'facil', label: 'Fácil' }, { val: 'media', label: 'Media' }, { val: 'dificil', label: 'Difícil' }], 'setGameSetting'))}
      ${row('🔒', 'Pasar dispositivo', _optSeg('privacyScreen', S.privacyScreen, yn, 'setGameSetting'))}
      ${row('⏱️', 'Cuenta regresiva', _optSeg('passCountdown', S.passCountdown, yn, 'setGameSetting'))}
    </div>`;
}

function setGameSetting(key, value) {
  if (!window.MSettings) return;
  MSettings.set(key, value);
  // La dificultad se aplica a la partida en curso (la CPU la lee cada turno).
  if (key === 'difficulty' && G) { G.difficulty = value; renderGame(); }
  renderGameSettings();
  if (key === 'soundEnabled' && value === true && window.MSfx) MSfx.play('select');
}

