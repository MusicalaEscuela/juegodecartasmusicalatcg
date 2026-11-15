/* MUSICALA - game-events.js: toasts de eventos, banner de turno y efectos.
   Envuelve addLog, renderBoard y advanceTurn sin tocar su logica. */
(function () {
  'use strict';

  //  Refs a elementos DOM 
  // Los elementos #turn-banner y #special-effect-label ya estn en el HTML.
  // #event-feed se crea en initGameEvents().
  let feedEl         = null;
  let bannerEl       = null;
  let specialLabelEl = null;

  // G se declara con `let` en game.js, asi que no vive en window.
  function getG() { return (typeof G !== 'undefined' && G) ? G : null; }

  //  Tabla de clasificacin de mensajes 
  const MSG_RULES = [
    [/musicala/i,                                             'musicala'],
    [/roba\s*2|\+2\s*carta/i,                                'draw'    ],
    [/salta(do)?|turno\s+salte/i,                            'skip'    ],
    [/cambio\s+de?\s+direcci|reversa/i,                      'reverse' ],
    [/intercambi|swap/i,                                     'special' ],
    [/especial|improvisac|desafinac|silencio|partitura|ensayo|nota\s+paso|fantasma|sostenido|bemol|becuadro/i, 'special'],
    [/roba\b/i,                                              'draw'    ],
    [/jug[oó]/i,                                           'play'    ],
    [/turno\s+de\b/i,                                        'turn'    ],
  ];

  function classify(msg) {
    for (const [re, type] of MSG_RULES) {
      if (re.test(msg)) return type;
    }
    return 'play';
  }

  //  Toast stack 
  const MAX_TOASTS = 3;

  window.showGameEvent = function (msg, type) {
    if (!feedEl) return;
    type = type || classify(msg);

    // Eliminar el mas antiguo si ya hay MAX_TOASTS
    while (feedEl.children.length >= MAX_TOASTS) {
      feedEl.removeChild(feedEl.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = 'game-toast t-' + type;
    toast.textContent = msg;
    feedEl.appendChild(toast);

    // Auto-dismiss a los 2.6 s
    const DISMISS_MS = 2600;
    setTimeout(function () {
      toast.classList.add('exiting');
      toast.addEventListener('animationend', function () { toast.remove(); }, { once: true });
    }, DISMISS_MS);
  };

  //  Turn banner 
  window.showTurnBanner = function (name) {
    if (!bannerEl) return;
    bannerEl.textContent = '▶ Turno de ' + name;
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth; // force reflow para reiniciar animacin
    bannerEl.classList.add('show');
    bannerEl.addEventListener('animationend', function () {
      bannerEl.classList.remove('show');
    }, { once: true });
  };

  //  Pop de la carta central 
  window.animateActiveCard = function () {
    const card = document.getElementById('active-note-card');
    if (!card) return;
    card.classList.remove('ge-pop');
    void card.offsetWidth;
    card.classList.add('ge-pop');
    card.addEventListener('animationend', function () {
      card.classList.remove('ge-pop');
    }, { once: true });
  };

  //  Etiqueta de efecto especial 
  window.showSpecialEffect = function (text, type) {
    if (!specialLabelEl) return;
    specialLabelEl.textContent = text;
    specialLabelEl.className = 't-' + type; // resetear clase
    void specialLabelEl.offsetWidth;
    specialLabelEl.classList.add('ge-show');
    specialLabelEl.addEventListener('animationend', function () {
      specialLabelEl.className = '';
    }, { once: true });
  };

  //  Flash del chip de direccin 
  window.flashDirectionChip = function () {
    const chip = document.getElementById('chip-direction');
    if (!chip) return;
    chip.classList.remove('ge-flashing');
    void chip.offsetWidth;
    chip.classList.add('ge-flashing');
    chip.addEventListener('animationend', function () {
      chip.classList.remove('ge-flashing');
    }, { once: true });
  };

  //  Despachar evento desde mensaje de log 
  function _dispatchGameEvent(msg) {
    var type = classify(msg);
    showGameEvent(msg, type);

    if (type === 'reverse') {
      flashDirectionChip();
      showSpecialEffect('🔄 Cambio de dirección', 'reverse');
    } else if (type === 'skip') {
      showSpecialEffect('🚫 Turno saltado', 'skip');
    } else if (type === 'draw') {
      showSpecialEffect(/roba\s*2|\+2/i.test(msg) ? '🃏 +2 cartas' : '🃏 +1 carta', 'draw');
    } else if (type === 'musicala') {
      showSpecialEffect('🎶 ¡MUSICALA!', 'swap');
    }
  }

  //  Nota previa (para detectar cambio en renderBoard) 
  var _prevNote = null;

  //  initGameEvents - punto de entrada pblico 
  window.initGameEvents = function () {
    if (window.initGameEvents._patched) return;
    window.initGameEvents._patched = true;

    // 1. Crear / recuperar el feed de toasts
    feedEl = document.getElementById('event-feed');
    if (!feedEl) {
      feedEl = document.createElement('div');
      feedEl.id = 'event-feed';
      document.body.appendChild(feedEl);
    }

    // 2. Banner de turno (ya declarado en el HTML, dentro de .board-center)
    bannerEl = document.getElementById('turn-banner');

    // 3. Etiqueta de efecto especial (ya declarada en el HTML)
    specialLabelEl = document.getElementById('special-effect-label');

    // 4. Parchear addLog  aade toast sin tocar la lgica original
    if (typeof window.addLog === 'function' && !window.addLog._gePatch) {
      var _origLog = window.addLog;
      window.addLog = function (msg) {
        _origLog.call(this, msg);
        _dispatchGameEvent(msg);
      };
      window.addLog._gePatch = true;
    }

    // 5. Parchear renderBoard  detecta cambio de nota  pop
    if (typeof window.renderBoard === 'function' && !window.renderBoard._gePatch) {
      var _origRB = window.renderBoard;
      window.renderBoard = function () {
        var noteBefore = _prevNote;
        _origRB.apply(this, arguments);
        var g = getG();
        var noteAfter = g && g.currentNote;
        if (noteAfter && noteAfter !== noteBefore) {
          _prevNote = noteAfter;
          animateActiveCard();
        }
      };
      window.renderBoard._gePatch = true;
    }

    // 6. Parchear advanceTurn  muestra banner del nuevo jugador
    if (typeof window.advanceTurn === 'function' && !window.advanceTurn._gePatch) {
      var _origAT = window.advanceTurn;
      window.advanceTurn = function () {
        _origAT.apply(this, arguments);
        var g = getG();
        if (g && g.players && g.winner === null) {
          var cur = g.players[g.currentPlayer];
          if (cur) showTurnBanner(cur.name);
        }
      };
      window.advanceTurn._gePatch = true;
    }
  };

})();
