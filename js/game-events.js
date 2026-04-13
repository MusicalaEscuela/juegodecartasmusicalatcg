/* ============================================================
   MUSICALA – game-events.js
   Sistema de notificaciones en tiempo real + efectos visuales

   INSTRUCCIÓN DE CARGA:
   Agregar en index.html, ANTES de </body> y DESPUÉS de ui.js:
     <script src="js/game-events.js"></script>

   DESPUÉS de cargar este archivo, llama initGameEvents()
   desde main.js (ver sección INTEGRACIÓN al final de este archivo).
============================================================ */

'use strict';

// ── Configuración ────────────────────────────────────────────────────────────

const GE = {
  MAX_VISIBLE:   3,       // máximo de toasts simultáneos
  DURATION:      2600,    // ms que dura cada toast
  LEAVE_AFTER:   2200,    // ms antes de iniciar animación de salida
  queue:         [],      // cola interna
  active:        [],      // toasts activos en DOM
};

// ── Mapa de tipos → ícono ────────────────────────────────────────────────────

const EVT_ICONS = {
  play:     '🎵',
  special:  '⭐',
  draw:     '🃏',
  skip:     '🚫',
  reverse:  '🔄',
  turn:     '▶️',
  warn:     '⚠️',
  musicala: '🎶',
  default:  '💬',
};

// ── API pública: showGameEvent ───────────────────────────────────────────────

/**
 * Muestra una notificación de juego.
 *
 * @param {string} message  Texto del mensaje (ej: "Cata jugó DO")
 * @param {string} type     Tipo: 'play' | 'special' | 'draw' | 'skip' |
 *                                'reverse' | 'turn' | 'warn' | 'musicala'
 * @param {object} opts     Opciones adicionales (actualmente sin uso, reservado)
 */
function showGameEvent(message, type = 'play', opts = {}) {
  if (!message) return;
  const feed = document.getElementById('event-feed');
  if (!feed) return;

  // Limpiar si hay demasiados activos → sacar el más viejo
  if (GE.active.length >= GE.MAX_VISIBLE) {
    _dismissToast(GE.active[0], true);
  }

  // Crear elemento
  const toast = document.createElement('div');
  toast.className = `event-toast type-${type}`;
  toast.innerHTML = `
    <span class="evt-icon">${EVT_ICONS[type] || EVT_ICONS.default}</span>
    <span class="evt-msg">${_escHtml(message)}</span>
  `;

  feed.appendChild(toast);
  GE.active.push(toast);

  // Programar salida
  const leaveTimer = setTimeout(() => _dismissToast(toast), GE.LEAVE_AFTER);
  toast._leaveTimer = leaveTimer;
}

// ── Dismiss interno ──────────────────────────────────────────────────────────

function _dismissToast(toast, immediate = false) {
  if (!toast || !toast.parentNode) return;
  clearTimeout(toast._leaveTimer);

  const idx = GE.active.indexOf(toast);
  if (idx !== -1) GE.active.splice(idx, 1);

  if (immediate) {
    toast.remove();
    return;
  }

  toast.classList.add('leaving');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  // Fallback por si la animación no dispara
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
}

// ── Turn Banner ──────────────────────────────────────────────────────────────

let _bannerTimer = null;

/**
 * Muestra brevemente "Turno de X" encima de la carta activa.
 * @param {string} playerName
 */
function showTurnBanner(playerName) {
  const banner = document.getElementById('turn-banner');
  if (!banner) return;

  clearTimeout(_bannerTimer);

  banner.textContent = `▶ Turno de ${playerName}`;
  banner.classList.add('visible');

  _bannerTimer = setTimeout(() => {
    banner.classList.remove('visible');
  }, 1800);
}

// ── Carta activa: pop + ring ──────────────────────────────────────────────────

/**
 * Dispara animación de "pop" en la carta central del tablero.
 */
function animateActiveCard() {
  const card = document.getElementById('active-note-card');
  if (!card) return;

  card.classList.remove('card-played-pop');
  // Forzar reflow para reiniciar la animación
  void card.offsetWidth;
  card.classList.add('card-played-pop');

  card.addEventListener('animationend', () => {
    card.classList.remove('card-played-pop');
  }, { once: true });
}

// ── Efecto especial (etiqueta flotante bajo la carta) ────────────────────────

let _effectTimer = null;

/**
 * Muestra una etiqueta de efecto debajo de la carta activa.
 * @param {string} label   Texto (ej: "🔄 Cambio de dirección")
 * @param {string} variant 'reverse' | 'skip' | 'draw' | 'swap'
 * @param {number} duration ms (default 1600)
 */
function showSpecialEffect(label, variant = 'reverse', duration = 1600) {
  const el = document.getElementById('special-effect-label');
  if (!el) return;

  clearTimeout(_effectTimer);

  el.textContent = label;
  el.className   = `effect-${variant} show`;
  // force reflow
  void el.offsetWidth;
  el.classList.add('show');

  _effectTimer = setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    el.addEventListener('animationend', () => {
      el.className = '';
      el.textContent = '';
    }, { once: true });
  }, duration);
}

// ── Chip dirección: flash ────────────────────────────────────────────────────

function flashDirectionChip() {
  const chip = document.getElementById('chip-direction');
  if (!chip) return;
  chip.classList.remove('direction-changed');
  void chip.offsetWidth;
  chip.classList.add('direction-changed');
  chip.addEventListener('animationend', () => {
    chip.classList.remove('direction-changed');
  }, { once: true });
}

// ── Utilidad interna ─────────────────────────────────────────────────────────

function _escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Parche de integración ────────────────────────────────────────────────────
//
//  Esta sección envuelve las funciones existentes del juego para inyectar
//  las notificaciones sin reescribir la lógica.
//  Se ejecuta UNA VEZ al llamar initGameEvents() desde main.js.
//

function initGameEvents() {
  // Crear el feed en el DOM si no existe
  if (!document.getElementById('event-feed')) {
    const feed = document.createElement('div');
    feed.id = 'event-feed';
    document.body.appendChild(feed);
  }

  // Crear el turn-banner si no existe
  if (!document.getElementById('turn-banner')) {
    const bc = document.querySelector('.board-center');
    if (bc) {
      const banner = document.createElement('div');
      banner.id = 'turn-banner';
      bc.appendChild(banner);
    }
  }

  // Crear el special-effect-label si no existe
  if (!document.getElementById('special-effect-label')) {
    const bc = document.querySelector('.board-center');
    if (bc) {
      const el = document.createElement('div');
      el.id = 'special-effect-label';
      bc.appendChild(el);
    }
  }

  // ── Parchear addLog ───────────────────────────────────────────────────────
  //  addLog es la función central del juego que registra todos los eventos.
  //  La envolvemos para disparar showGameEvent automáticamente.

  if (typeof addLog === 'function' && !addLog._patched) {
    const _originalAddLog = addLog;

    window.addLog = function(msg) {
      _originalAddLog(msg);
      _dispatchGameEvent(msg);
    };

    window.addLog._patched = true;
  }

  // ── Parchear renderBoard ──────────────────────────────────────────────────
  //  Dispara animación de pop en la carta central cada vez que se renderiza
  //  una nueva carta jugada.

  if (typeof renderBoard === 'function' && !renderBoard._patched) {
    const _originalRenderBoard = renderBoard;
    let _lastNote = null;

    window.renderBoard = function() {
      _originalRenderBoard();
      if (G && G.currentNote !== _lastNote) {
        _lastNote = G.currentNote;
        animateActiveCard();
      }
    };

    window.renderBoard._patched = true;
  }

  // ── Parchear advanceTurn ──────────────────────────────────────────────────
  //  Muestra el banner de turno al cambiar de jugador.

  if (typeof advanceTurn === 'function' && !advanceTurn._patched) {
    const _originalAdvanceTurn = advanceTurn;

    window.advanceTurn = function() {
      _originalAdvanceTurn();
      if (G && !G.winner) {
        const cur = G.players[G.currentPlayer];
        if (cur) showTurnBanner(cur.name);
      }
    };

    window.advanceTurn._patched = true;
  }
}

// ── Dispatcher: convierte logs en eventos tipados ────────────────────────────

function _dispatchGameEvent(msg) {
  if (!msg) return;

  const m = msg.toLowerCase();

  // Musicala
  if (m.includes('musicala')) {
    showGameEvent(msg, 'musicala');
    return;
  }

  // Ganador
  if (m.includes('gana la partida') || m.includes('🏆')) {
    showGameEvent(msg, 'musicala');
    return;
  }

  // Cambio de dirección
  if (m.includes('sentido') || m.includes('cambio') && m.includes('dir') || m.includes('antihorario') || m.includes('horario')) {
    showGameEvent(msg, 'reverse');
    showSpecialEffect('🔄 Dirección cambiada', 'reverse', 1500);
    flashDirectionChip();
    return;
  }

  // Pierde turno / skip
  if (m.includes('pierde su turno') || m.includes('pasa su turno') || m.includes('nota fantasma') || m.includes('silencio')) {
    showGameEvent(msg, 'skip');
    showSpecialEffect('🚫 Turno saltado', 'skip', 1400);
    return;
  }

  // Roba cartas (ensayo / roba show)
  if (m.includes('roba 2') || m.includes('ensayo')) {
    showGameEvent(msg, 'draw');
    showSpecialEffect('🃏 +2 cartas', 'draw', 1400);
    return;
  }
  if (m.includes('roba 1') || m.includes('roba una carta')) {
    showGameEvent(msg, 'draw');
    return;
  }

  // Intercambio manos
  if (m.includes('intercambian manos') || m.includes('cambio de notas')) {
    showGameEvent(msg, 'special');
    showSpecialEffect('🔀 ¡Manos intercambiadas!', 'swap', 1600);
    return;
  }

  // Rotación de orquesta
  if (m.includes('rotación') || m.includes('rotacion')) {
    showGameEvent(msg, 'special');
    showSpecialEffect('🎻 Rotación de orquesta', 'swap', 1600);
    return;
  }

  // Partitura
  if (m.includes('partitura')) {
    showGameEvent(msg, 'special');
    return;
  }

  // Improvisación
  if (m.includes('improvisación') || m.includes('improvisacion') || m.includes('improvisa')) {
    showGameEvent(msg, 'special');
    return;
  }

  // Cartas especiales genéricas
  if (m.includes('jugó') && (
      m.includes('sostenido') || m.includes('bemol') || m.includes('becuadro') ||
      m.includes('nota de paso') || m.includes('desafinación') || m.includes('barra')
  )) {
    showGameEvent(msg, 'special');
    return;
  }

  // Jugada de nota normal (más frecuente → menos intrusivo)
  if (m.includes('jugó') || m.includes('jugo') || m.includes('escala')) {
    showGameEvent(msg, 'play');
    return;
  }

  // Mazo barajado / reshuffle
  if (m.includes('barajaron') || m.includes('agotó') || m.includes('agoto')) {
    showGameEvent(msg, 'warn');
    return;
  }

  // Penalización
  if (m.includes('no gritó') || m.includes('penaliz')) {
    showGameEvent(msg, 'warn');
    return;
  }

  // Fallback genérico
  showGameEvent(msg, 'play');
}

/* ============================================================
   INTEGRACIÓN EN main.js
   ─────────────────────────────────────────────────────────────
   En tu main.js, busca el lugar donde se inicializa el juego
   (normalmente en el listener del botón "Iniciar partida" o
   en la función startGame / initGame). Añade esta llamada:

     initGameEvents();

   Ejemplo:

     function startGame() {
       initGame(setupPlayers);
       initGameEvents();   // ← agregar aquí
       showScreen('screen-game');
       renderGame();
       scheduleNextTurn();
     }

   ── HTML (index.html) ────────────────────────────────────────
   1. En <head>, agrega:
      <link rel="stylesheet" href="css/game-events.css">

   2. Antes de </body>, después de ui.js:
      <script src="js/game-events.js"></script>

   ── Eso es todo. No hay más cambios necesarios. ──────────────
============================================================ */