/* ===================================================
   MUSICALA – ui.js  v2
   Renderizado, interfaz, modo multijugador local
   =================================================== */

'use strict';

// ── Screens ──────────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function showModal(html, onClose) {
  const overlay = document.getElementById('modal-overlay');
  const box     = document.getElementById('modal-box');
  box.innerHTML  = html;
  overlay.style.display = 'flex';
  overlay._onClose = onClose;
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  if (typeof overlay._onClose === 'function') overlay._onClose();
  overlay._onClose = null;
}

function showPlayerSelectModal(title, desc, excludeIdx, callback) {
  const targets = G.players.map((p, i) => ({ ...p, i })).filter(p => p.i !== excludeIdx);
  const btns = targets.map(p =>
    `<button class="player-select-btn" onclick="window._playerSelectCb(${p.i})">${escHtml(p.name)}</button>`
  ).join('');
  showModal(`
    <p class="modal-title">${title}</p>
    <p class="modal-body">${desc}</p>
    <div class="player-select-list">${btns}</div>
    <div class="modal-actions">
      <button class="modal-btn secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `);
  window._playerSelectCb = (targetIdx) => { closeModal(); callback(targetIdx); };
}

function showNotePasoChoiceModal(currentNote, options, callback) {
  const btns = options.map(note =>
    `<button class="player-select-btn" onclick="window._notePasoSelectCb('${note}')">${escHtml(note)}</button>`
  ).join('');
  const txt = options.length === 2
    ? `¿Qué nota quieres ahora? ${options[0]} o ${options[1]}.`
    : 'Elige la nota adyacente que quieres jugar.';
  showModal(`
    <p class="modal-title">Nota de Paso</p>
    <p class="modal-body">Nota actual: <strong>${escHtml(currentNote)}</strong>. ${escHtml(txt)}</p>
    <div class="player-select-list">${btns}</div>
  `);
  window._notePasoSelectCb = (chosenNote) => { closeModal(); callback(chosenNote); };
}

// ── Pass-screen (local multiplayer) ──────────────────────────────────────────

let _passScreenCallback = null;

function showPassScreen(nextPlayerName, callback) {
  _passScreenCallback = callback;
  const el = document.getElementById('pass-screen-overlay');
  if (!el) return callback();
  document.getElementById('pass-screen-name').textContent = nextPlayerName;

  // Instrucción más clara y explícita.
  const instr = document.getElementById('pass-screen-instruction');
  if (instr) {
    instr.innerHTML = `Entrega el dispositivo a <strong>${escHtml(nextPlayerName)}</strong>.<br>
      Cuando nadie más vea tu mano, presiona «Estoy listo».`;
  }
  el.style.display = 'flex';
  // Enfocar el botón para permitir continuar con Enter.
  const btn = document.getElementById('btn-pass-ready');
  if (btn) setTimeout(() => btn.focus(), 50);
}

function dismissPassScreen() {
  const el = document.getElementById('pass-screen-overlay');
  const proceed = () => {
    if (el) el.style.display = 'none';
    if (typeof _passScreenCallback === 'function') {
      const cb = _passScreenCallback;
      _passScreenCallback = null;
      cb();
    }
  };

  // Cuenta regresiva opcional de 3 segundos antes de revelar la mano.
  const wantCountdown = window.MSettings && MSettings.get('passCountdown');
  if (wantCountdown) {
    runPassCountdown(3, proceed);
  } else {
    proceed();
  }
}

function runPassCountdown(seconds, onDone) {
  const content = document.querySelector('.pass-screen-content');
  if (!content) return onDone();
  let n = seconds;
  // Overlay de cuenta regresiva reusable.
  let cd = document.getElementById('pass-countdown');
  if (!cd) {
    cd = document.createElement('div');
    cd.id = 'pass-countdown';
    cd.className = 'pass-countdown';
    document.getElementById('pass-screen-overlay').appendChild(cd);
  }
  content.style.visibility = 'hidden';
  cd.style.display = 'flex';
  const tick = () => {
    cd.textContent = n > 0 ? n : '¡Ya!';
    cd.classList.remove('pulse'); void cd.offsetWidth; cd.classList.add('pulse');
    if (n <= 0) {
      setTimeout(() => {
        cd.style.display = 'none';
        content.style.visibility = 'visible';
        onDone();
      }, 450);
      return;
    }
    n--;
    setTimeout(tick, 800);
  };
  tick();
}

// ── Setup UI ──────────────────────────────────────────────────────────────────

let setupPlayers = [
  { name: 'Jugador 1', isHuman: true },
  { name: 'Jugador 2', isHuman: false },
];

function renderSetup() {
  const grid = document.getElementById('players-config');
  grid.innerHTML = '';
  setupPlayers.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <div class="player-num">${i + 1}</div>
      <input class="player-name-input" type="text" value="${escHtml(p.name)}"
        maxlength="16" placeholder="Nombre"
        onchange="setupPlayers[${i}].name = this.value.trim() || 'Jugador ${i+1}'" />
      <div class="player-type-toggle">
        <button class="type-btn ${p.isHuman ? 'active' : ''}" onclick="setPlayerType(${i}, true)">Humano</button>
        <button class="type-btn cpu ${!p.isHuman ? 'active' : ''}" onclick="setPlayerType(${i}, false)">CPU</button>
      </div>
      ${i >= 2 ? `<button class="btn-remove" onclick="removePlayer(${i})" title="Eliminar">×</button>` : '<span></span>'}
    `;
    grid.appendChild(row);
  });

  const btnAdd = document.getElementById('btn-add-player');
  btnAdd.disabled = setupPlayers.length >= 8;
  btnAdd.style.opacity = btnAdd.disabled ? '0.4' : '1';

  const humanCount = setupPlayers.filter(p => p.isHuman).length;
  let warn = document.getElementById('multi-human-note');
  if (!warn) {
    warn = document.createElement('p');
    warn.id = 'multi-human-note';
    warn.style.cssText = 'font-size:12px;color:#a78bfa;text-align:center;margin-top:-10px;';
    document.getElementById('players-config').after(warn);
  }
  warn.textContent = humanCount > 1
    ? `✅ Modo multijugador local activado (${humanCount} humanos). El dispositivo pasará de mano en mano.`
    : '';

  renderSetupOptions();
}

// ── Opciones avanzadas de partida (persistentes) ──────────────────────────────

function _optSeg(key, current, options, setter) {
  const fn = setter || 'setSetupOption';
  return `<div class="opt-seg" role="group">` + options.map(o => {
    const val = typeof o.val === 'string' ? `'${o.val}'` : o.val;
    const active = o.val === current ? ' active' : '';
    return `<button type="button" class="opt-seg-btn${active}"
      aria-pressed="${o.val === current}"
      onclick="${fn}('${key}', ${val})">${o.label}</button>`;
  }).join('') + `</div>`;
}

function renderSetupOptions() {
  const host = document.getElementById('setup-options');
  if (!host || !window.MSettings) return;
  const S = MSettings.get();
  const yn = [{ val: true, label: 'Sí' }, { val: false, label: 'No' }];

  const row = (icon, title, hint, control) => `
    <div class="opt-row">
      <div class="opt-label">${icon} ${title}<span class="opt-hint">${hint}</span></div>
      ${control}
    </div>`;

  host.innerHTML = `
    <h2 class="section-label">Opciones de partida</h2>
    <div class="opt-grid">
      ${row('🤖', 'Dificultad CPU', 'Cómo juega la máquina',
        _optSeg('difficulty', S.difficulty, [
          { val: 'facil', label: 'Fácil' }, { val: 'media', label: 'Media' }, { val: 'dificil', label: 'Difícil' }]))}
      ${row('🃏', 'Cartas iniciales', 'Por jugador',
        _optSeg('initialCards', S.initialCards, [{ val: 5, label: '5' }, { val: 7, label: '7' }, { val: 9, label: '9' }]))}
      ${row('⭐', 'Cartas especiales', 'Efectos y alteraciones', _optSeg('specialsEnabled', S.specialsEnabled, yn))}
      ${row('🎼', 'Escalas', 'Jugar 3+ notas seguidas', _optSeg('scalesEnabled', S.scalesEnabled, yn))}
      ${row('⚡', 'Velocidad', 'Animaciones',
        _optSeg('animSpeed', S.animSpeed, [
          { val: 'lenta', label: 'Lenta' }, { val: 'normal', label: 'Normal' }, { val: 'rapida', label: 'Rápida' }]))}
      ${row('🔒', 'Pasar dispositivo', 'Privacidad multijugador local', _optSeg('privacyScreen', S.privacyScreen, yn))}
      ${row('⏱️', 'Cuenta regresiva', '3 s antes de mostrar la mano', _optSeg('passCountdown', S.passCountdown, yn))}
      ${row('🔊', 'Sonido', 'Efectos del juego', _optSeg('soundEnabled', S.soundEnabled, yn))}
      ${row('📳', 'Vibración', 'En móviles compatibles', _optSeg('hapticsEnabled', S.hapticsEnabled, yn))}
    </div>
  `;
}

function setSetupOption(key, value) {
  if (!window.MSettings) return;
  MSettings.set(key, value);
  renderSetupOptions();
  if (key === 'soundEnabled' && value === true && window.MSfx) MSfx.play('select');
  if (key === 'hapticsEnabled' && value === true && window.MFx) MFx.haptic('play');
}

function setPlayerType(idx, isHuman) { setupPlayers[idx].isHuman = isHuman; renderSetup(); }
function removePlayer(idx) { if (setupPlayers.length <= 2) return; setupPlayers.splice(idx, 1); renderSetup(); }
function addPlayer() {
  if (setupPlayers.length >= 8) return;
  setupPlayers.push({ name: `Jugador ${setupPlayers.length + 1}`, isHuman: false });
  renderSetup();
}

// ── Game render ───────────────────────────────────────────────────────────────

function renderGame() {
  if (!G) return;
  renderHeader();
  renderOpponents();
  renderBoard();
  renderHand();
  renderActionBar();
  renderHistory();
  updateHelpTip();
}

const DIFFICULTY_LABELS = {
  facil:   '🟢 Fácil',
  media:   '🟡 Media',
  dificil: '🔴 Difícil',
};

function renderHeader() {
  const chipTurn   = document.getElementById('chip-turn');
  const chipDir    = document.getElementById('chip-direction');
  const chipDeck   = document.getElementById('chip-deck');
  const chipOnline = document.getElementById('chip-online');
  const chipDiff   = document.getElementById('chip-difficulty');
  const cur        = G.players[G.currentPlayer];
  const isMyTurn   = G._onlineMode ? isMyOnlineTurn() : isHumanTurn();

  // Turno más explícito: distingue "es tu turno" de "espera a la CPU / a otro".
  if (isMyTurn) {
    chipTurn.textContent = `¡Es tu turno, ${cur.name}!`;
  } else if (!cur.isHuman) {
    chipTurn.textContent = `Esperando a ${cur.name}…`;
  } else {
    chipTurn.textContent = `Turno de ${cur.name}`;
  }
  chipTurn.className   = 'status-chip' + (isMyTurn ? ' highlight' : (!cur.isHuman ? ' cpu-active' : ''));
  chipDir.textContent  = G.direction === 1 ? '⟳ Horario' : '⟲ Antihorario';
  chipDeck.textContent = `Mazo: ${G.deck.length}`;

  // Dificultad: solo en local y solo si hay alguna CPU.
  if (chipDiff) {
    const hasCpu = !G._onlineMode && G.players.some(p => !p.isHuman);
    if (hasCpu && G.difficulty) {
      chipDiff.textContent = DIFFICULTY_LABELS[G.difficulty] || G.difficulty;
      chipDiff.style.display = 'inline-flex';
    } else {
      chipDiff.style.display = 'none';
    }
  }

  if (chipOnline) chipOnline.style.display = G._onlineMode ? 'inline-flex' : 'none';
}

function renderOpponents() {
  const row = document.getElementById('opponents-row');
  row.innerHTML = '';
  const viewerIdx = G.currentPlayer;
  G.players.forEach((p, i) => {
    if (i === viewerIdx && p.isHuman) return;
    const slot = document.createElement('div');
    slot.className = 'opponent-slot'
      + (G.currentPlayer === i ? ' active-turn' : '');
    slot.dataset.playerIdx = i;

    const miniCards = p.hand.slice(0, 14).map(() =>
      `<div class="opp-mini-card"><img src="assets/backs/back-sm.webp" width="20" height="28" decoding="async" onerror="this.style.display='none'" alt=""></div>`
    ).join('');
    const cpuBadge   = !p.isHuman ? '<span class="cpu-badge">CPU</span>' : '';
    const humanBadge = p.isHuman  ? '<span class="cpu-badge" style="background:rgba(12,65,196,0.4);color:#93c5fd">HUM</span>' : '';

    slot.innerHTML = `
      <div class="opp-name">${escHtml(p.name)}${cpuBadge}${humanBadge}</div>
      <div class="opp-cards-row">${miniCards}</div>
      <div class="opp-count">${p.hand.length} carta${p.hand.length !== 1 ? 's' : ''}</div>
    `;
    row.appendChild(slot);
  });
}

function renderBoard() {
  const card      = document.getElementById('active-note-card');
  const noteImg   = document.getElementById('active-note-img');
  const noteName  = document.getElementById('active-note-name');
  const noteLabel = document.getElementById('active-note-label');

  card.style.background = NOTE_COLORS[G.currentNote] || '#555';
  card.style.boxShadow  = `0 0 40px ${NOTE_COLORS[G.currentNote] || '#5729FF'}66`;

  const imgSrc = `assets/cards/nota_${G.currentNote.toLowerCase()}.webp`;
  if (noteImg.getAttribute('src') !== imgSrc) noteImg.src = imgSrc;
  noteImg.alt = G.currentNote;
  noteImg.style.display = 'block';
  noteName.style.display = 'none';

  noteLabel.textContent = NOTE_LABELS[G.currentNote] || '';

  const badge = document.getElementById('forced-dir-badge');
  if (G.forcedDir) {
    badge.textContent = G.forcedDir === 'asc' ? '↑ Ascendente forzado' : '↓ Descendente forzado';
    badge.className   = `forced-dir-badge show ${G.forcedDir}`;
  } else {
    badge.className = 'forced-dir-badge';
  }

  document.getElementById('deck-count').textContent = `${G.deck.length} carta${G.deck.length !== 1 ? 's' : ''}`;
}

// ── Note sequence history chips ───────────────────────────────────────────────

const MAX_HISTORY_CHIPS = 8;

function historyIcon(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('gana')) return '🏆';
  if (m.includes('roba')) return '🃏';
  if (m.includes('escala')) return '🎼';
  if (m.includes('sentido') || m.includes('direcci')) return '🔄';
  if (m.includes('pierde') || m.includes('pasa su turno') || m.includes('salta')) return '🚫';
  if (m.includes('improvisa')) return '🎹';
  if (m.includes('intercambian') || m.includes('rotaci')) return '🔀';
  if (m.includes('desafinaci')) return '🎺';
  if (m.includes('jug')) return '🎵';
  return '▶️';
}

function renderHistory() {
  const strip = document.getElementById('history-entries');
  if (!strip || !G) return;

  const latest = G.log[0] ? (typeof G.log[0] === 'string' ? G.log[0] : G.log[0].msg) : '';
  const chipsHtml = (G.noteHistory || []).slice(-MAX_HISTORY_CHIPS).map(note =>
    `<span class="seq-chip-inline" style="background:${NOTE_COLORS[note] || '#555'}">${note}</span>`
  ).join('');

  const latestHtml = latest
    ? `<span class="history-latest"><span class="history-latest-icon">${historyIcon(latest)}</span>${escHtml(latest)}</span>`
    : '';

  strip.innerHTML = latestHtml + (chipsHtml ? `<span class="history-chips">${chipsHtml}</span>` : '');
}

// ── Hand render ───────────────────────────────────────────────────────────────

function renderHand() {
  const isOnline  = G._onlineMode;
  const playerIdx = isOnline ? ON.myIndex : humanIndex();
  const player    = G.players[playerIdx];
  const container = document.getElementById('hand-cards');
  const handCount = document.getElementById('hand-count');
  const handLabel = document.getElementById('hand-label');
  const hint      = document.getElementById('hand-hint');
  const btnMusicala = document.getElementById('btn-musicala');

  handCount.textContent = `${player.hand.length} carta${player.hand.length !== 1 ? 's' : ''}`;
  handLabel.textContent = player.name || 'Mano';

  const isMy     = isOnline ? isMyOnlineTurn() : isHumanTurn();
  const realHand = isOnline ? ON.myHand : player.hand;
  const mask     = isMy ? getValidMask(realHand, G.currentNote, G.forcedDir) : [];

  btnMusicala.style.display = 'none';

  if (G.phase === 'improvisacion' && isMy) {
    hint.textContent = '🎹 Improvisación: selecciona una carta de NOTA para jugarla.';
    hint.classList.remove('hint-warn');
  } else if (isMy) {
    const hasValid = mask.some(v => v);
    if (hasValid) {
      hint.textContent = G.scalesEnabled !== false
        ? 'Toca una carta para jugarla. Para una escala: selecciona 3+ notas seguidas y pulsa «Jugar escala».'
        : 'Toca una carta para seleccionarla y vuelve a tocarla para jugarla.';
      hint.classList.remove('hint-warn');
    } else {
      hint.textContent = '🚫 No tienes carta válida. Toca el mazo iluminado para robar una carta.';
      hint.classList.add('hint-warn');
    }
  } else {
    hint.textContent = `Esperando a ${G.players[G.currentPlayer].name}…`;
    hint.classList.remove('hint-warn');
  }

  container.innerHTML = '';
  realHand.forEach((card, idx) => {
    const el = buildCardElement(card, idx, isMy, mask);
    container.appendChild(el);
  });
}

// Anima la última carta de la mano (la recién robada) con un suave "entrar".
function animateDrawnCard() {
  const container = document.getElementById('hand-cards');
  if (!container) return;
  const last = container.lastElementChild;
  if (!last) return;
  last.classList.remove('card-drawn');
  void last.offsetWidth;
  last.classList.add('card-drawn');
  last.addEventListener('animationend', () => last.classList.remove('card-drawn'), { once: true });
  // Desplazar para que la carta robada quede visible.
  try { last.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' }); } catch (e) {}
}

// ── Card element builder ──────────────────────────────────────────────────────

// size: 'lg' (640px, carta central / zoom) o 'sm' (260px, mano / biblioteca).
function getCardImageSrc(card, size) {
  const dir = size === 'sm' ? 'assets/cards/sm/' : 'assets/cards/';
  if (card.type === 'note')    return `${dir}nota_${card.note.toLowerCase()}.webp`;
  if (card.type === 'alt')     return `${dir}carta_${card.id}.webp`;
  if (card.type === 'special') return `${dir}carta_${card.id}.webp`;
  return null;
}

function buildCardElement(card, idx, interactive, mask) {
  const el = document.createElement('div');
  let classes = 'card';

  if (card.type === 'note')         classes += ` card-note-${card.note.toLowerCase()}`;
  else if (card.type === 'special') classes += ` card-special ${card.cssClass}`;
  else if (card.type === 'alt')     classes += ` card-alt ${card.cssClass}`;

  const isImprov = G.phase === 'improvisacion';
  let valid = false;

  if (interactive) {
    valid    = isImprov ? card.type === 'note' : (mask && mask[idx]);
    classes += valid ? ' valid' : ' invalid';
    if (G.selectedCards && G.selectedCards.includes(idx)) classes += ' selected';
  }

  el.className = classes;
  el.title = card.desc || card.label || card.name || '';

  const noteLabel = card.type === 'note' ? card.note : (card.icon || '?');
  const subLabel  = card.type === 'note' ? (card.label || '') : (card.name || '');
  const imgSrc    = getCardImageSrc(card, 'sm');
  const typeIcon  = card.type === 'note' ? '♩' : (card.type === 'alt' ? '♯' : '★');
  const typeWord  = card.type === 'note' ? 'Nota' : (card.type === 'alt' ? 'Alteración' : 'Carta especial');
  const altText   = card.type === 'note' ? `Carta de nota ${card.note}` : `${typeWord}: ${subLabel}`;

  // Indicador de validez NO basado solo en color (accesibilidad).
  let validBadge = '';
  if (interactive) {
    validBadge = valid
      ? `<span class="card-valid-badge ok" aria-hidden="true">✓</span>`
      : `<span class="card-valid-badge no" aria-hidden="true">✕</span>`;
  }

  // Botón de información (ⓘ): tooltip/zoom contextual sin interferir con el tap-para-jugar.
  const infoBtn = `<button class="card-info-btn" type="button" tabindex="-1" aria-label="Ver información de ${escHtml(subLabel || noteLabel)}">i</button>`;

  el.innerHTML = `
    <div class="card-inner">
      <div class="card-front">
        ${validBadge}
        ${infoBtn}
        <div class="card-header">
          <span class="card-note-label">${escHtml(noteLabel)}</span>
          <span class="card-type-icon">${typeIcon}</span>
        </div>
        <div class="card-img-area">
          ${imgSrc
            ? `<img class="card-face-img" src="${imgSrc}" decoding="async" draggable="false"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" alt="${escHtml(altText)}">
               <div class="card-icon-big" style="display:none">${escHtml(noteLabel)}</div>`
            : `<div class="card-icon-big">${escHtml(noteLabel)}</div>`
          }
        </div>
        <div class="card-footer">
          <div class="card-name">${escHtml(subLabel || noteLabel)}</div>
          ${card.desc ? `<div class="card-sub-text">${escHtml(card.desc)}</div>` : ''}
        </div>
      </div>
      <div class="card-back">
        <img src="assets/backs/back-sm.webp" loading="lazy" decoding="async" onerror="this.style.display='none'" alt="">
      </div>
    </div>
  `;

  // Accesibilidad: cada carta es un botón navegable con teclado.
  if (interactive) {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label',
      `${altText}. ${valid ? 'Jugable' : 'No jugable ahora'}.`);
  }

  // El botón de info abre el detalle de la carta (no juega la carta).
  const info = el.querySelector('.card-info-btn');
  if (info) {
    info.addEventListener('click', (e) => {
      e.stopPropagation();
      openCardInfo(card, interactive ? valid : null);
    });
  }

  if (interactive) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (valid) {
        handleCardClick(idx);
      } else {
        if (window.MSfx) MSfx.play('error');
        if (window.MFx) MFx.haptic('error');
        showToast('Esa carta no es válida ahora.');
      }
    });
    // Teclado: Enter / Espacio juega o selecciona la carta.
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (valid) handleCardClick(idx);
        else { if (window.MSfx) MSfx.play('error'); if (window.MFx) MFx.haptic('error'); showToast('Esa carta no es válida ahora.'); }
      }
    });
  }

  return el;
}

// Tooltip/detalle contextual de una carta (reusa el zoom). playable: true/false/null.
function openCardInfo(card, playable) {
  openCardZoom(card, playable);
}

// ── Card interaction ──────────────────────────────────────────────────────────
// handleCardClick es llamado directamente desde buildCardElement (carta válida)
// o desde el Card Action Menu (botón "Jugar carta").

function handleCardClick(idx) {
  const isOnline = G && G._onlineMode;
  if (isOnline) {
    if (!isMyOnlineTurn() || G.winner) return;
  } else {
    if (!isHumanTurn() || G.winner) return;
  }

  const hand = isOnline ? ON.myHand : G.players[humanIndex()].hand;
  const mask = G.phase === 'improvisacion'
    ? hand.map(c => c.type === 'note')
    : getValidMask(hand, G.currentNote, G.forcedDir);

  if (!mask[idx]) {
    showToast('Esa carta no es válida ahora.');
    return;
  }

  const playFn = isOnline ? onlineHumanPlayCard : humanPlayCard;
  const alreadySelected = G.selectedCards.includes(idx);

  // Datos para la animación de vuelo (se capturan antes de que la mano se redibuje).
  const playedCard = hand[idx];
  const cardEl     = document.getElementById('hand-cards').children[idx];
  const fromRect   = window.MFx ? MFx.rectOf(cardEl) : null;
  const flyPlayed  = () => {
    if (window.MFx && fromRect && playedCard) MFx.playCard(fromRect, getCardImageSrc(playedCard, 'sm'));
  };

  if (alreadySelected) {
    if (G.selectedCards.length === 1) {
      G.selectedCards = [];
      const result = playFn(idx);
      if (!result.ok) { showToast(result.error || 'No puedes jugar esa carta.'); renderGame(); return; }
      flyPlayed();
      handlePostPlay(result);
    } else {
      G.selectedCards = G.selectedCards.filter(i => i !== idx);
      renderHand(); updateScaleButton();
    }
  } else {
    if (hand[idx].type !== 'note') {
      G.selectedCards = [];
      const result = playFn(idx);
      if (!result.ok) { showToast(result.error || 'No puedes jugar esa carta.'); renderGame(); return; }
      flyPlayed();
      handlePostPlay(result);
      return;
    }
    G.selectedCards.push(idx);
    if (window.MSfx) MSfx.play('select');
    if (window.MFx) MFx.haptic('tap');
    renderHand(); updateScaleButton();
  }
}

function updateScaleButton() {
  const btn     = document.getElementById('btn-play-scale');
  const preview = document.getElementById('scale-preview');
  const hidePreview = () => { if (preview) { preview.style.display = 'none'; preview.className = 'scale-preview'; } };

  const isMy = G && (G._onlineMode ? isMyOnlineTurn() : isHumanTurn());
  const scalesOff = G && G.scalesEnabled === false;   // online deja undefined → permitido
  if (!btn || !G || !isMy || G.phase === 'improvisacion' || scalesOff) {
    if (btn) btn.style.display = 'none';
    hidePreview();
    return;
  }

  const hand = G._onlineMode ? ON.myHand : G.players[humanIndex()].hand;
  const sel  = G.selectedCards || [];
  const selNotes = sel.map(i => hand[i] && hand[i].note).filter(Boolean);

  // Sin selección o selección no-nota → sin preview ni botón.
  if (sel.length === 0 || selNotes.length !== sel.length) {
    btn.style.display = 'none';
    btn.classList.remove('active-scale');
    hidePreview();
    return;
  }

  if (sel.length < 3) {
    // 1-2 notas seleccionadas: guiar hacia la escala.
    btn.style.display = 'none';
    btn.classList.remove('active-scale');
    if (preview) {
      preview.style.display = 'block';
      preview.className = 'scale-preview info';
      const faltan = 3 - sel.length;
      preview.innerHTML = `Seleccionadas: <strong>${selNotes.join(' → ')}</strong> · elige ${faltan} nota${faltan !== 1 ? 's' : ''} más para una escala.`;
    }
    return;
  }

  const v = getScaleValidation(sel, hand, G.currentNote, G.forcedDir);
  if (v.valid) {
    btn.style.display = 'inline-block';
    const dirLabel = v.dir === 'asc' ? '↑' : (v.dir === 'desc' ? '↓' : '↕');
    btn.textContent = `🎵 Jugar escala ${dirLabel} (${sel.length})`;
    btn.classList.add('active-scale');
    if (preview) {
      preview.style.display = 'block';
      preview.className = 'scale-preview ok';
      preview.innerHTML = `Escala seleccionada: <strong>${(v.playOrder || selNotes).join(' → ')}</strong> ✓`;
    }
  } else {
    btn.style.display = 'none';
    btn.classList.remove('active-scale');
    if (preview) {
      preview.style.display = 'block';
      preview.className = 'scale-preview bad';
      preview.innerHTML = `Esta escala no es válida. Deben ser <strong>notas consecutivas</strong> (ej.: FA → SOL → LA).`;
    }
  }
}

function handlePostPlay(result) {
  if (result.pendingOnlinePush) {
    renderGame();
    return;
  }

  // Feedback sonoro según el tipo de jugada.
  if (window.MSfx && G.winner === null) {
    if (result.scalePlayOrder && result.scalePlayOrder.length) MSfx.play('scale', result.scalePlayOrder);
    else if (result.needsTarget || result.needsNotePasoChoice || result.phase === 'improvisacion') MSfx.play('special');
    else {
      // La nota jugada suena con su altura real; las especiales, con su propio efecto.
      const top = G.discard && G.discard[G.discard.length - 1];
      if (top && top.type === 'special') MSfx.play('special');
      else MSfx.play('play', top && top.type === 'note' ? top.note : undefined);
    }
  }
  if (window.MFx && G.winner === null) MFx.haptic(result.scalePlayOrder || result.needsTarget ? 'special' : 'play');

  const continueTurnFlow = () => {
    renderGame();
    if (G.phase === 'improvisacion') { showToast('¡Improvisación! Elige una carta de nota.'); return; }
    if (!G._onlineMode) scheduleNextTurn();
  };

  if (G.winner !== null) { renderGame(); setTimeout(() => showWinnerScreen(), 600); return; }

  if (result.needsTarget) {
    const labels = {
      robaShow:    { title: 'Roba el Show',    desc: 'Elige un jugador para que robe 1 carta.' },
      ensayo:      { title: 'Ensayo Sorpresa', desc: 'Elige un jugador para que robe 2 cartas.' },
      cambioNotas: { title: 'Cambio de Notas', desc: 'Elige el jugador con quien intercambiar tu mano.' },
    };
    const { title, desc } = labels[result.needsTarget] || { title: 'Elegir jugador', desc: '' };
    showPlayerSelectModal(title, desc, result.playerIdx, async (targetIdx) => {
      if (G._onlineMode) await onlineResolveTarget(result.needsTarget, result.playerIdx, targetIdx);
      else resolveTarget(result.needsTarget, result.playerIdx, targetIdx);
      renderGame();
      if (G.winner !== null) setTimeout(() => showWinnerScreen(), 600);
      else if (!G._onlineMode) scheduleNextTurn();
    });
    renderGame(); return;
  }

  if (result.needsNotePasoChoice) {
    const options = result.noteOptions || [];
    showNotePasoChoiceModal(G.currentNote, options, async (chosenNote) => {
      const pick = resolveNotePasoChoice(result.playerIdx, chosenNote);
      if (!pick.ok) {
        showToast(pick.error || 'No se pudo aplicar Nota de Paso.');
        renderGame();
        return;
      }
      if (G._onlineMode) await pushOnlineStateAfterPendingChoice();
      renderGame();
      if (G.winner !== null) setTimeout(() => showWinnerScreen(), 600);
      else if (!G._onlineMode) scheduleNextTurn();
    });
    renderGame(); return;
  }

  if (result.scalePlayOrder && result.scalePlayOrder.length > 0) {
    playScaleSequenceAnimation(result.scalePlayOrder, continueTurnFlow);
    return;
  }

  continueTurnFlow();
}

function playScaleSequenceAnimation(notes, onDone) {
  const board = document.querySelector('.board-center');
  if (!board || !notes || notes.length === 0) {
    if (typeof onDone === 'function') onDone();
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'scale-seq-overlay';

  notes.forEach((note, idx) => {
    const chip = document.createElement('div');
    chip.className = `scale-seq-chip ${String(note).toLowerCase()}`;
    chip.style.animationDelay = `${idx * 140}ms`;
    chip.textContent = note;
    wrap.appendChild(chip);
  });

  board.appendChild(wrap);

  const totalMs = 520 + (notes.length * 140);
  setTimeout(() => {
    wrap.classList.add('done');
    setTimeout(() => {
      wrap.remove();
      if (typeof onDone === 'function') onDone();
    }, 220);
  }, totalMs);
}

function renderActionBar() {
  const btnDraw  = document.getElementById('btn-draw');
  const isMy     = G._onlineMode ? isMyOnlineTurn() : isHumanTurn();
  const hand     = G._onlineMode ? ON.myHand : (isMy ? G.players[humanIndex()].hand : []);
  const mask     = isMy ? getValidMask(hand, G.currentNote, G.forcedDir) : [];
  const hasValid = mask.some(v => v);
  if (btnDraw) btnDraw.disabled = !isMy || hasValid || G.phase === 'improvisacion' || !!G.winner;

  // Resaltar el mazo cuando es mi turno y NO tengo carta válida (debo robar).
  const deckPile = document.getElementById('deck-pile');
  if (deckPile) {
    const mustDraw = isMy && !hasValid && G.phase !== 'improvisacion' && !G.winner;
    deckPile.classList.toggle('must-draw', mustDraw);
  }

  updateScaleButton();
}

// ── Full history modal ────────────────────────────────────────────────────────

function showFullHistory() {
  if (!G) return;
  const items = G.log.map(e => {
    const msg = typeof e === 'string' ? e : e.msg;
    return `<div class="history-full-entry">${escHtml(msg)}</div>`;
  }).join('');
  showModal(`
    <p class="modal-title">📋 Historial</p>
    <div class="history-full-list">${items || '<p style="color:var(--text-dim);text-align:center">Sin jugadas aún</p>'}</div>
    <div class="modal-actions">
      <button class="modal-btn primary" onclick="closeModal()">Cerrar</button>
    </div>
  `);
}

// ── Winner screen ─────────────────────────────────────────────────────────────

const WINNER_CHEERS = [
  '¡Afinadito quedaste, primer lugar! 🎵',
  '¡Sonaste como toda una orquesta! 🎻',
  '¡Esa mano fue pura armonía! 🎹',
  '¡Cerraste con broche de oro! 🏆',
];

function showWinnerScreen() {
  const winner = G.players[G.winner];
  document.getElementById('winner-title').textContent = `¡${winner.name} gana! 🎵`;
  document.getElementById('winner-sub').textContent = winner.isHuman
    ? WINNER_CHEERS[Math.floor(Math.random() * WINNER_CHEERS.length)]
    : `${winner.name} se quedó sin cartas primero. ¡A la revancha!`;

  const sorted = [...G.players].sort((a, b) => a.hand.length - b.hand.length);
  const totalScales   = G.players.reduce((s, p) => s + (p.scalesPlayed || 0), 0);
  const totalSpecials = G.players.reduce((s, p) => s + (p.specialsUsed || 0), 0);

  const playerRows = sorted.map(p => {
    const extra = [];
    if (p.scalesPlayed)  extra.push(`${p.scalesPlayed} escala${p.scalesPlayed !== 1 ? 's' : ''}`);
    if (p.specialsUsed)  extra.push(`${p.specialsUsed} especial${p.specialsUsed !== 1 ? 'es' : ''}`);
    const detail = extra.length ? `<span class="stat-detail">${extra.join(' · ')}</span>` : '';
    const crown  = p === winner ? '👑 ' : '';
    return `<div class="stat-row">
        <span>${crown}${escHtml(p.name)}</span>
        <strong>${p.hand.length} carta${p.hand.length !== 1 ? 's' : ''}${detail}</strong>
      </div>`;
  }).join('');

  document.getElementById('winner-stats').innerHTML = `
    <div class="stat-row"><span>🎯 Turnos jugados</span><strong>${G.turnCount}</strong></div>
    <div class="stat-row"><span>🎼 Escalas jugadas</span><strong>${totalScales}</strong></div>
    <div class="stat-row"><span>⭐ Especiales usadas</span><strong>${totalSpecials}</strong></div>
    <div class="stat-divider"></div>
    <div class="stat-section-label">Cartas restantes</div>
    ${playerRows}
  `;

  if (window.MSfx) MSfx.play('win');
  if (window.MFx) MFx.haptic('win');
  spawnConfetti();
  showScreen('screen-winner');
}

function spawnConfetti() {
  const container = document.getElementById('confetti');
  container.innerHTML = '';
  const colors = ['#0C41C4','#680DBF','#CE0071','#5729FF','#E53935','#2E7D32','#f9e44a'];
  for (let i = 0; i < 34; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `left:${Math.random()*100}%;background:${colors[i%colors.length]};width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;animation-delay:${Math.random()*1.5}s;animation-duration:${1.5+Math.random()*1.5}s;`;
    container.appendChild(el);
  }
}

// ── Floating Help (Carta de Apoyo) ────────────────────────────────────────────

function toggleHelp() {
  const panel = document.getElementById('help-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) updateHelpTip();
}

function updateHelpTip() {
  if (!G) return;
  const tip     = document.getElementById('help-tip');
  if (!tip) return;

  // La escala es circular (SI sube a DO y DO baja a SI), igual que las reglas.
  const cur  = G.currentNote;
  const ci   = NOTES.indexOf(cur);
  const up   = NOTES[(ci + 1) % NOTES.length];
  const down = NOTES[(ci - 1 + NOTES.length) % NOTES.length];

  // Se reescribe completo en cada render para que nunca quede desactualizado.
  if (G.forcedDir === 'asc') {
    tip.innerHTML = `💡 Hay un <strong>Sostenido ♯</strong> activo. Solo puedes subir → <strong>${up}</strong>`;
  } else if (G.forcedDir === 'desc') {
    tip.innerHTML = `💡 Hay un <strong>Bemol ♭</strong> activo. Solo puedes bajar → <strong>${down}</strong>`;
  } else {
    tip.innerHTML = `💡 Nota actual: <strong>${cur}</strong>.
      Puedes jugar <strong>${up}</strong> (↑), <strong>${down}</strong> (↓) o repetir <strong>${cur}</strong>.`;
  }
}

// ── AI scheduling / turn orchestration ───────────────────────────────────────

let aiTimer = null;

function scheduleNextTurn() {
  if (G.winner) return;
  if (G._onlineMode) { renderGame(); return; }

  if (isHumanTurn()) {
    const cur          = G.players[G.currentPlayer];
    const prevHuman    = G.players.find((p, i) => p.isHuman && i !== G.currentPlayer);
    const isMultiHuman = G.players.filter(p => p.isHuman).length > 1;
    const privacyOn    = !window.MSettings || MSettings.get('privacyScreen') !== false;

    if (isMultiHuman && prevHuman && privacyOn) {
      showPassScreen(cur.name, () => { renderGame(); });
    } else {
      renderGame();
    }
    // Aviso sutil de "te toca".
    if (window.MSfx) MSfx.play('turn');
    if (window.MFx) MFx.haptic('turn');
    return;
  }

  if (aiTimer) clearTimeout(aiTimer);
  const factor = window.MSettings ? MSettings.speedFactor() : 1;
  aiTimer = setTimeout(() => runAIStep(), Math.round(900 * factor));
}

function scheduleAI() { scheduleNextTurn(); }

function runAIStep() {
  if (!G || G.winner || isHumanTurn()) return;
  const aiIdx      = G.currentPlayer;
  const discardLen = G.discard.length;
  const handLen    = G.players[aiIdx].hand.length;
  aiTurn(aiIdx);
  renderGame();
  animateAIStep(aiIdx, discardLen, handLen);
  if (G.winner !== null) { setTimeout(() => showWinnerScreen(), 700); return; }
  scheduleNextTurn();
}

// Feedback visual y sonoro de la jugada de la CPU (solo presentación).
function animateAIStep(aiIdx, discardLenBefore, handLenBefore) {
  try {
    const slot = window.MFx ? MFx.opponentSlot(aiIdx) : null;
    if (G.discard.length > discardLenBefore) {
      const top = G.discard[G.discard.length - 1];
      if (slot && top) MFx.playCard(MFx.rectOf(slot), getCardImageSrc(top, 'sm'));
      if (window.MSfx) MSfx.play('cpu', top && top.type === 'note' ? top.note : undefined);
    } else if (G.players[aiIdx].hand.length > handLenBefore) {
      if (slot) MFx.drawCard(slot);
      if (window.MSfx) MSfx.play('draw');
    }
  } catch (err) { /* los efectos nunca deben interrumpir la partida */ }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Card Zoom ─────────────────────────────────────────────────────────────────

function openCardZoom(card, playable) {
  const overlay  = document.getElementById('card-zoom-overlay');
  const zoomImg  = document.getElementById('card-zoom-img');
  const zoomIcon = document.getElementById('card-zoom-icon');
  const zoomName = document.getElementById('card-zoom-name');
  const zoomType = document.getElementById('card-zoom-type');
  const zoomDesc = document.getElementById('card-zoom-desc');
  const zoomPlay = document.getElementById('card-zoom-playable');

  const imgSrc  = getCardImageSrc(card);
  const typeMap = { note: 'Nota musical', alt: 'Alteración', special: 'Carta especial' };
  const label   = card.type === 'note' ? card.note : (card.name || card.label || '');
  const desc    = card.desc || (card.type === 'note'
    ? `Juega ${card.note} sobre la misma nota, la anterior o la siguiente.` : '');

  if (imgSrc) {
    zoomImg.src = imgSrc;
    zoomImg.alt = label;
    zoomImg.style.display = 'block';
    zoomIcon.style.display = 'none';
  } else {
    zoomImg.style.display = 'none';
    zoomIcon.style.display = 'flex';
    zoomIcon.textContent = label;
  }

  zoomName.textContent = label;
  zoomType.textContent = typeMap[card.type] || '';
  zoomDesc.textContent = desc;

  // Estado "jugable ahora" (solo cuando se abre desde la mano en juego).
  if (zoomPlay) {
    if (playable === true) {
      zoomPlay.textContent = '✓ Puedes jugarla ahora';
      zoomPlay.className = 'card-zoom-playable yes';
      zoomPlay.style.display = 'block';
    } else if (playable === false) {
      zoomPlay.textContent = '✕ No puedes jugarla en este momento';
      zoomPlay.className = 'card-zoom-playable no';
      zoomPlay.style.display = 'block';
    } else {
      zoomPlay.style.display = 'none';
    }
  }

  overlay.classList.add('open');
}

function closeCardZoom() {
  document.getElementById('card-zoom-overlay').classList.remove('open');
}

// ── Card Action Menu ──────────────────────────────────────────────────────────
// Ahora solo se abre para cartas INVÁLIDAS (para mostrar el motivo).
// Las cartas válidas se juegan directo desde buildCardElement → handleCardClick.
// El botón "Jugar carta" dentro del menú sigue funcionando como antes
// por si alguien accede al menú desde otro lado.

let _camCard = null;
let _camIdx  = null;

function openCardActionMenu(card, idx, mask) {
  _camCard = card;
  _camIdx  = idx;

  const isOnline = G && G._onlineMode;
  const myTurn   = isOnline ? isMyOnlineTurn() : isHumanTurn();
  const isImprov = G && G.phase === 'improvisacion';
  const valid    = myTurn && (isImprov ? card.type === 'note' : (mask && mask[idx]));

  // Nombre en el header
  const label = card.type === 'note'
    ? card.note
    : (card.name || card.label || 'Carta especial');
  document.getElementById('cam-card-name').textContent = label;

  // Preview imagen
  const imgSrc  = getCardImageSrc(card);
  const camImg  = document.getElementById('cam-preview-img');
  const camIcon = document.getElementById('cam-preview-icon');
  if (imgSrc) {
    camImg.src = imgSrc;
    camImg.style.display = 'block';
    camIcon.style.display = 'none';
  } else {
    camImg.style.display = 'none';
    camIcon.style.display = 'flex';
    camIcon.textContent = card.icon || label;
  }

  // Estado del botón "Jugar carta"
  const btnPlay    = document.getElementById('cam-btn-play');
  const hintEl     = document.getElementById('cam-invalid-hint');
  const hintText   = document.getElementById('cam-invalid-text');
  const playSub    = document.getElementById('cam-btn-play-sub');

  if (!myTurn) {
    btnPlay.disabled     = true;
    hintEl.style.display = 'flex';
    hintText.textContent = 'No es tu turno.';
    if (playSub) playSub.textContent = 'Espera tu turno para jugar';
  } else if (!valid) {
    btnPlay.disabled     = true;
    hintEl.style.display = 'flex';
    hintText.textContent = 'Esta carta no es válida en este turno.';
    if (playSub) playSub.textContent = 'No se puede jugar ahora';
  } else {
    btnPlay.disabled     = false;
    hintEl.style.display = 'none';
    if (playSub) playSub.textContent = 'Poner esta carta en juego';
  }

  document.getElementById('card-action-overlay').classList.add('open');
}

function closeCardActionMenu() {
  document.getElementById('card-action-overlay').classList.remove('open');
  _camCard = null;
  _camIdx  = null;
}

function initCardActionMenu() {
  const overlay = document.getElementById('card-action-overlay');
  const menu    = document.getElementById('card-action-menu');

  // Click fuera del panel → cerrar
  overlay.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) closeCardActionMenu();
  });

  // Botón X
  document.getElementById('cam-close').addEventListener('click', closeCardActionMenu);

  // Botón "Ver carta"
  document.getElementById('cam-btn-view').addEventListener('click', () => {
    const card = _camCard;
    closeCardActionMenu();
    if (card) openCardZoom(card);
  });

  // Botón "Jugar carta"
  document.getElementById('cam-btn-play').addEventListener('click', () => {
    const idx = _camIdx;
    closeCardActionMenu();
    if (idx !== null) handleCardClick(idx);
  });

  // ESC cierra el menú
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      closeCardActionMenu();
    }
  });
}
