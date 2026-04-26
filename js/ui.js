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
  el.style.display = 'flex';
}

function dismissPassScreen() {
  const el = document.getElementById('pass-screen-overlay');
  if (el) el.style.display = 'none';
  if (typeof _passScreenCallback === 'function') {
    const cb = _passScreenCallback;
    _passScreenCallback = null;
    cb();
  }
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

function renderHeader() {
  const chipTurn   = document.getElementById('chip-turn');
  const chipDir    = document.getElementById('chip-direction');
  const chipDeck   = document.getElementById('chip-deck');
  const chipOnline = document.getElementById('chip-online');
  const cur        = G.players[G.currentPlayer];
  const isMyTurn   = G._onlineMode ? isMyOnlineTurn() : isHumanTurn();

  chipTurn.textContent = isMyTurn ? `¡Turno de ${cur.name}!` : `Turno: ${cur.name}`;
  chipTurn.className   = 'status-chip' + (isMyTurn ? ' highlight' : (!cur.isHuman ? ' cpu-active' : ''));
  chipDir.textContent  = G.direction === 1 ? '⟳ Horario' : '⟲ Antihorario';
  chipDeck.textContent = `Mazo: ${G.deck.length}`;

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

    const miniCards = p.hand.slice(0, 14).map(() =>
      `<div class="opp-mini-card"><img src="assets/backs/back.png" onerror="this.style.display='none'" alt=""></div>`
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

  const imgSrc = `assets/cards/nota_${G.currentNote.toLowerCase()}.png`;
  noteImg.src = imgSrc;
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

function renderHistory() {
  const strip = document.getElementById('history-entries');
  if (!strip || !G) return;

  const recentLog = G.log.slice(0, 4);
  const chipsHtml = (G.noteHistory || []).slice(-MAX_HISTORY_CHIPS).map(note =>
    `<span class="seq-chip-inline" style="background:${NOTE_COLORS[note] || '#555'}">${note}</span>`
  ).join('');

  const logText = recentLog.length > 0
    ? `<span class="history-entry">${escHtml(typeof recentLog[0] === 'string' ? recentLog[0] : recentLog[0].msg)}</span>`
    : '';

  strip.innerHTML = chipsHtml + (chipsHtml && logText ? '<span style="color:var(--text-dim);font-size:11px;margin:0 4px">·</span>' : '') + logText;
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
    hint.textContent = 'Selecciona una carta de NOTA para improvisar.';
  } else if (isMy) {
    const hasValid = mask.some(v => v);
    hint.textContent = hasValid
      ? 'Toca para seleccionar. Vuelve a tocar para jugar. Para escala: selecciona 3+ y pulsa Jugar escala.'
      : 'No tienes carta válida. Roba del mazo.';
  } else {
    hint.textContent = `Esperando a ${G.players[G.currentPlayer].name}…`;
  }

  container.innerHTML = '';
  realHand.forEach((card, idx) => {
    const el = buildCardElement(card, idx, isMy, mask);
    container.appendChild(el);
  });
}

// ── Card element builder ──────────────────────────────────────────────────────

function getCardImageSrc(card) {
  if (card.type === 'note')    return `assets/cards/nota_${card.note.toLowerCase()}.png`;
  if (card.type === 'alt')     return `assets/cards/carta_${card.id}.png`;
  if (card.type === 'special') return `assets/cards/carta_${card.id}.png`;
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
  const imgSrc    = getCardImageSrc(card);
  const typeIcon  = card.type === 'note' ? '♩' : (card.type === 'alt' ? '♯' : '★');

  el.innerHTML = `
    <div class="card-inner">
      <div class="card-front">
        <div class="card-header">
          <span class="card-note-label">${escHtml(noteLabel)}</span>
          <span class="card-type-icon">${typeIcon}</span>
        </div>
        <div class="card-img-area">
          ${imgSrc
            ? `<img class="card-face-img" src="${imgSrc}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" alt="${escHtml(subLabel)}">
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
        <img src="assets/backs/back.png" onerror="this.style.display='none'" alt="">
      </div>
    </div>
  `;

  if (interactive) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (valid) {
        // ── Carta válida: jugar directamente, sin pasar por el menú ──
        handleCardClick(idx);
      } else {
        showToast('Esa carta no es válida ahora.');
      }
    });
  }

  return el;
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

  if (alreadySelected) {
    if (G.selectedCards.length === 1) {
      G.selectedCards = [];
      const result = playFn(idx);
      if (!result.ok) { showToast(result.error || 'No puedes jugar esa carta.'); renderGame(); return; }
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
      handlePostPlay(result);
      return;
    }
    G.selectedCards.push(idx);
    renderHand(); updateScaleButton();
  }
}

function updateScaleButton() {
  const btn = document.getElementById('btn-play-scale');
  const isMy = G && (G._onlineMode ? isMyOnlineTurn() : isHumanTurn());
  if (!btn || !G || !isMy || G.phase === 'improvisacion') { if (btn) btn.style.display = 'none'; return; }
  const hand = G._onlineMode ? ON.myHand : G.players[humanIndex()].hand;
  const sel  = G.selectedCards;
  if (sel.length >= 3) {
    const v = getScaleValidation(sel, hand, G.currentNote, G.forcedDir);
    if (v.valid) {
      btn.style.display = 'inline-block';
      const dirLabel = v.dir === 'asc' ? '↑' : (v.dir === 'desc' ? '↓' : '↕');
      btn.textContent   = `🎵 Escala ${dirLabel} (${sel.length} notas)`;
      btn.classList.add('active-scale');
      return;
    }
  }
  btn.style.display = 'none';
  btn.classList.remove('active-scale');
}

function handlePostPlay(result) {
  if (result.pendingOnlinePush) {
    renderGame();
    return;
  }

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
  btnDraw.disabled = !isMy || hasValid || G.phase === 'improvisacion' || !!G.winner;
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

function showWinnerScreen() {
  const winner = G.players[G.winner];
  document.getElementById('winner-title').textContent = `¡${winner.name} gana! 🎵`;
  document.getElementById('winner-sub').textContent   = winner.isHuman
    ? '¡Primer músico en quedarse sin cartas!'
    : `${winner.name} se quedó sin cartas primero.`;
  const sorted = [...G.players].sort((a, b) => a.hand.length - b.hand.length);
  document.getElementById('winner-stats').innerHTML = `
    <div class="stat-row"><span>Ganador</span><strong>${escHtml(winner.name)}</strong></div>
    <div class="stat-row"><span>Turnos</span><strong>${G.turnCount}</strong></div>
    ${sorted.map(p => `<div class="stat-row"><span>${escHtml(p.name)}</span><strong>${p.hand.length} cartas restantes</strong></div>`).join('')}
  `;
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
  const tipNote = document.getElementById('help-tip-note');
  const tipUp   = document.getElementById('help-tip-up');
  const tipDown = document.getElementById('help-tip-down');
  if (!tip) return;

  const cur  = G.currentNote;
  const ci   = NOTES.indexOf(cur);
  const up   = ci < NOTES.length - 1 ? NOTES[ci + 1] : '—';
  const down = ci > 0 ? NOTES[ci - 1] : '—';

  if (tipNote) tipNote.textContent = cur;
  if (tipUp)   tipUp.textContent   = G.forcedDir === 'desc' ? '—' : up;
  if (tipDown) tipDown.textContent = G.forcedDir === 'asc'  ? '—' : down;

  if (tip && G.forcedDir) {
    tip.innerHTML = G.forcedDir === 'asc'
      ? `💡 Hay un <strong>Sostenido ♯</strong> activo. Solo puedes subir → <strong id="help-tip-up">${up}</strong>`
      : `💡 Hay un <strong>Bemol ♭</strong> activo. Solo puedes bajar → <strong id="help-tip-down">${down}</strong>`;
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

    if (isMultiHuman && prevHuman) {
      showPassScreen(cur.name, () => { renderGame(); });
    } else {
      renderGame();
    }
    return;
  }

  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = setTimeout(() => runAIStep(), 900);
}

function scheduleAI() { scheduleNextTurn(); }

function runAIStep() {
  if (!G || G.winner || isHumanTurn()) return;
  aiTurn(G.currentPlayer);
  renderGame();
  if (G.winner !== null) { setTimeout(() => showWinnerScreen(), 700); return; }
  scheduleNextTurn();
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Card Zoom ─────────────────────────────────────────────────────────────────

function openCardZoom(card) {
  const overlay  = document.getElementById('card-zoom-overlay');
  const zoomImg  = document.getElementById('card-zoom-img');
  const zoomIcon = document.getElementById('card-zoom-icon');
  const zoomName = document.getElementById('card-zoom-name');
  const zoomType = document.getElementById('card-zoom-type');
  const zoomDesc = document.getElementById('card-zoom-desc');

  const imgSrc  = getCardImageSrc(card);
  const typeMap = { note: 'Nota musical', alt: 'Alteración', special: 'Carta especial' };
  const label   = card.type === 'note' ? card.note : (card.name || card.label || '');
  const desc    = card.desc || '';

  if (imgSrc) {
    zoomImg.src = imgSrc;
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
