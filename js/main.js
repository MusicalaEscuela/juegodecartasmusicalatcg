/* ===================================================
   MUSICALA  main.js  v2
   Punto de entrada y orquestacin
   =================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  //  Fonts (Nunito + Fredoka One) 
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;900&display=swap';
  document.head.appendChild(fontLink);

  //  Card Action Menu  inicializar eventos 
  initCardActionMenu();

  //  Intro 
  document.getElementById('btn-intro-play').addEventListener('click', () => {
    showScreen('screen-setup'); renderSetup();
  });
  document.getElementById('btn-intro-library').addEventListener('click', showCardLibraryModal);
  document.getElementById('btn-intro-rules').addEventListener('click', showRulesModal);

  //  Online mode 
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
    navigator.clipboard.writeText(code).then(() => showToast(`Cdigo ${code} copiado `));
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

  document.getElementById('btn-play-scale').addEventListener('click', () => {
    if (!G) return;
    const isOnline = G._onlineMode;
    if (isOnline ? !isMyOnlineTurn() : !isHumanTurn()) return;
    const scaleFn = isOnline ? onlineHumanPlayScale : humanPlayScale;
    const result  = scaleFn(G.selectedCards);
    if (!result.ok) { showToast(result.error || 'Escala invlida.'); return; }
    handlePostPlay(result);
  });

  document.getElementById('btn-history').addEventListener('click', showFullHistory);

  document.getElementById('btn-new-game').addEventListener('click', () => {
    showModal(`
      <p class="modal-title">Nueva partida?</p>
      <p class="modal-body">Se perder el progreso actual.</p>
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
        <button class="modal-btn primary"   onclick="closeModal(); startGame();">Reiniciar partida</button>
        <button class="modal-btn secondary" onclick="closeModal(); showFullHistory();"> Historial</button>
        <button class="modal-btn secondary" onclick="closeModal(); showScreen('screen-setup'); renderSetup();">Cambiar jugadores</button>
        <button class="modal-btn secondary" onclick="closeModal(); showRulesModal();">Ver reglas</button>
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

  //  Modal backdrop 
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

});

//  Start game 

function startGame() {
  if (typeof window.startBackgroundMusic === 'function') {
    window.startBackgroundMusic();
  }

  if (aiTimer) clearTimeout(aiTimer);
  initGame(setupPlayers);
  showScreen('screen-game');
  renderGame();
  if (!isHumanTurn()) scheduleNextTurn();
}

//  Rules modal 

function showRulesModal() {
  showModal(`
    <p class="modal-title">Reglas de Musicala</p>
    <div class="modal-body rules-body">
      <p><strong> Objetivo:</strong> S el primero en quedarte sin cartas.</p>

      <p><strong> En tu turno puedes jugar:</strong></p>
      <ul>
        <li>La nota siguiente en la secuencia</li>
        <li>La nota anterior en la secuencia</li>
        <li>La misma nota que est en juego</li>
        <li>Una carta especial o de alteracin vlida</li>
      </ul>

      <p><strong> Escalas:</strong> Selecciona 3+ notas consecutivas y usa el botn "Escala" para jugarlas todas de un golpe.</p>

      <p><strong> Sin carta vlida:</strong> Roba una del mazo. Si es vlida, puedes jugarla; si no, pierdes el turno.</p>

      <p><strong> Sostenido:</strong> Obliga al siguiente a subir. No sobre MI ni SI.</p>
      <p><strong> Bemol:</strong> Obliga al siguiente a bajar. No sobre FA ni DO.</p>
      <p><strong> Becuadro:</strong> Cancela la alteracin activa.</p>

      <p><strong> Multijugador local:</strong> Cuando haya varios humanos, el juego pedir pasar el dispositivo entre cada turno para que nadie vea la mano del otro.</p>
    </div>
    <div class="modal-actions">
      <button class="modal-btn primary" onclick="closeModal()">Entendido</button>
    </div>
  `);
}

function showCardLibraryModal() {
  const noteCards = NOTES.map(note => ({
    title: `Nota ${note}`,
    desc: 'Carta de nota',
    src: `assets/cards/nota_${note.toLowerCase()}.png`,
  }));
  const specialCards = SPECIAL_DEFS.map(card => ({
    title: card.name,
    desc: card.desc || 'Carta especial',
    src: `assets/cards/carta_${card.id}.png`,
  }));
  const altCards = ALTERATION_DEFS.map(card => ({
    title: card.name,
    desc: card.desc || 'Carta de alteracion',
    src: `assets/cards/carta_${card.id}.png`,
  }));

  const renderSection = (title, cards) => `
    <div style="margin-top:12px">
      <p class="modal-title" style="font-size:16px;margin-bottom:8px">${title}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px">
        ${cards.map(c => `
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:8px">
            <img src="${c.src}" alt="${c.title}" style="width:100%;aspect-ratio:63/88;object-fit:contain;background:rgba(0,0,0,0.18);border-radius:8px;display:block">
            <div style="margin-top:6px;font-size:11px;font-weight:800;color:#fff">${c.title}</div>
            <div style="margin-top:2px;font-size:10px;color:rgba(255,255,255,0.65)">${c.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  showModal(`
    <p class="modal-title">Biblioteca de cartas</p>
    <p class="modal-body">Explora las cartas y su arte completo antes de iniciar partida.</p>
    ${renderSection('Notas', noteCards)}
    ${renderSection('Alteraciones', altCards)}
    ${renderSection('Especiales', specialCards)}
    <div class="modal-actions">
      <button class="modal-btn primary" onclick="closeModal()">Cerrar</button>
    </div>
  `);
}

