/* ===================================================
   MUSICALA – game.js  v2
   Lógica central + soporte multijugador local
   =================================================== */

'use strict';

let G = null;

function initGame(playersConfig) {
  const deck = buildDeck();
  const n = playersConfig.length;
  const hands = playersConfig.map(() => deck.splice(0, 7));

  let startIdx = deck.findIndex(c => c.type === 'note');
  if (startIdx === -1) startIdx = 0;
  const [startCard] = deck.splice(startIdx, 1);

  G = {
    players: playersConfig.map((p, i) => ({
      name: p.name, isHuman: p.isHuman,
      hand: hands[i], musicalaAnnounced: false,
    })),
    deck,
    discard: [startCard],
    currentNote: startCard.note,
    currentPlayer: 0,
    direction: 1,
    skipNext: false,
    forcedDir: null,
    selectedCards: [],
    log: [],
    noteHistory: [startCard.note],  // ← sequence chip history
    winner: null,
    phase: 'play',
    partituraUsed: 0,
    turnCount: 0,
  };

  addLog(`La secuencia comienza en ${startCard.note}. ¡Que empiece el juego!`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addLog(msg) {
  G.log.unshift({ msg, turn: G.turnCount, ts: Date.now() });
  if (G.log.length > 60) G.log.pop();
}

function recordNote(note) {
  G.noteHistory.push(note);
  if (G.noteHistory.length > 20) G.noteHistory.shift();
}

function nextPlayerIndex(from = G.currentPlayer) {
  return (from + G.direction + G.players.length) % G.players.length;
}

function prevPlayerIndex(from = G.currentPlayer) {
  return (from - G.direction + G.players.length) % G.players.length;
}

function reshuffleIfNeeded() {
  if (G.deck.length === 0) {
    const last = G.discard.pop();
    G.deck = shuffle(G.discard);
    G.discard = [last];
    addLog('El mazo se agotó. Las cartas descartadas se barajaron.');
  }
}

function drawCard(playerIdx) {
  reshuffleIfNeeded();
  if (G.deck.length === 0) return null;
  const card = G.deck.pop();
  G.players[playerIdx].hand.push(card);
  return card;
}

function checkMusicala(playerIdx) {
  const p = G.players[playerIdx];
  if (p.hand.length === 1 && !p.musicalaAnnounced && !p.isHuman) {
    p.musicalaAnnounced = true;
    addLog(`¡${p.name} grita MUSICALA!`);
  }
}

function checkWinner(playerIdx) {
  if (G.players[playerIdx].hand.length === 0) {
    G.winner = playerIdx;
    G.phase = 'ended';
    addLog(`🏆 ${G.players[playerIdx].name} gana la partida.`);
    return true;
  }
  return false;
}

function advanceTurn() {
  G.currentPlayer = nextPlayerIndex();
  G.selectedCards = [];
  G.turnCount++;
  if (G.skipNext) {
    G.skipNext = false;
    addLog(`${G.players[G.currentPlayer].name} pierde su turno.`);
    G.currentPlayer = nextPlayerIndex();
    G.turnCount++;
  }
}

// ── Human plays ───────────────────────────────────────────────────────────────

function humanIndex() {
  // In multi-human: the current human is the one whose turn it is
  if (G.players[G.currentPlayer] && G.players[G.currentPlayer].isHuman) return G.currentPlayer;
  return G.players.findIndex(p => p.isHuman);
}

function isHumanTurn() { return G.players[G.currentPlayer] && G.players[G.currentPlayer].isHuman; }

function getCurrentValidMask() {
  const h = G.players[humanIndex()];
  return getValidMask(h.hand, G.currentNote, G.forcedDir);
}

function humanPlayCard(cardIdx) {
  if (G.winner || !isHumanTurn()) return { ok: false, error: 'No es tu turno.' };
  const player = G.players[G.currentPlayer];

  if (G.phase === 'improvisacion') {
    const card = player.hand[cardIdx];
    if (card.type !== 'note') return { ok: false, error: 'Selecciona una carta de NOTA.' };
    player.hand.splice(cardIdx, 1);
    G.discard.push(card);
    G.currentNote = card.note;
    recordNote(card.note);
    G.forcedDir = null;
    G.phase = 'play';
    addLog(`${player.name} improvisa con ${card.note}.`);
    checkMusicala(G.currentPlayer);
    if (checkWinner(G.currentPlayer)) return { ok: true };
    advanceTurn();
    return { ok: true };
  }

  const mask = getValidMask(player.hand, G.currentNote, G.forcedDir);
  if (!mask[cardIdx]) return { ok: false, error: 'Esa carta no es válida ahora.' };
  const card = player.hand.splice(cardIdx, 1)[0];
  return applyCard(card, G.currentPlayer);
}

function humanPlayScale(indices) {
  if (G.winner || !isHumanTurn()) return { ok: false, error: 'No es tu turno.' };
  const player = G.players[G.currentPlayer];
  const validation = getScaleValidation(indices, player.hand, G.currentNote, G.forcedDir);
  if (!validation.valid) return { ok: false, error: 'Las cartas seleccionadas no forman una escala válida.' };

  const sorted = [...indices].sort((a, b) => {
    const ni = noteIndex(player.hand[a].note);
    const nj = noteIndex(player.hand[b].note);
    return validation.dir === 'asc' ? ni - nj : nj - ni;
  });

  const noteNames = sorted.map(i => player.hand[i].note);
  const byDesc = [...sorted].sort((a, b) => b - a);
  byDesc.forEach(i => {
    const card = player.hand.splice(i, 1)[0];
    G.discard.push(card);
  });

  noteNames.forEach(n => recordNote(n));
  G.currentNote  = validation.lastNote;
  G.forcedDir    = null;
  G.selectedCards = [];

  addLog(`${player.name} jugó escala ${validation.dir === 'asc' ? '↑' : '↓'}: ${noteNames.join(' › ')}.`);
  checkMusicala(G.currentPlayer);
  if (checkWinner(G.currentPlayer)) return { ok: true };
  advanceTurn();
  return { ok: true };
}

function humanDraw() {
  if (G.winner || !isHumanTurn()) return { ok: false };
  const mask = getValidMask(G.players[G.currentPlayer].hand, G.currentNote, G.forcedDir);
  if (mask.some(v => v)) return { ok: false, error: 'Tienes cartas válidas para jugar.' };
  const card = drawCard(G.currentPlayer);
  if (!card) return { ok: false, error: 'El mazo está vacío.' };
  addLog(`${G.players[G.currentPlayer].name} roba una carta.`);
  const newMask  = getValidMask(G.players[G.currentPlayer].hand, G.currentNote, G.forcedDir);
  const drawnIdx = G.players[G.currentPlayer].hand.length - 1;
  if (newMask[drawnIdx]) {
    addLog('La carta robada es válida. ¡Puedes jugarla!');
  } else {
    advanceTurn();
  }
  return { ok: true, drew: card };
}

function humanAnnounceMusica() {
  const p = G.players[G.currentPlayer];
  if (!p.isHuman) return { ok: false };
  if (p.hand.length !== 1) return { ok: false, error: 'Solo cuando te queda 1 carta.' };
  if (p.musicalaAnnounced) return { ok: false, error: 'Ya lo anunciaste.' };
  p.musicalaAnnounced = true;
  addLog(`¡${p.name} grita MUSICALA!`);
  return { ok: true };
}

function penalizeMusicalaMissed(targetIdx) {
  for (let i = 0; i < 2; i++) drawCard(targetIdx);
  addLog(`${G.players[targetIdx].name} no gritó MUSICALA a tiempo. ¡Roba 2 cartas!`);
}

// ── Apply card effect ─────────────────────────────────────────────────────────

function applyCard(card, playerIdx) {
  G.discard.push(card);
  const player = G.players[playerIdx];

  if (card.type === 'note') {
    G.currentNote = card.note;
    recordNote(card.note);
    G.forcedDir = null;
    addLog(`${player.name} jugó ${card.note}.`);
    checkMusicala(playerIdx);
    if (checkWinner(playerIdx)) return { ok: true };
    advanceTurn();
    return { ok: true };
  }
  if (card.type === 'alt')     return applyAlteration(card, playerIdx);
  if (card.type === 'special') return applySpecial(card, playerIdx);
  return { ok: false, error: 'Tipo desconocido.' };
}

function applyAlteration(card, playerIdx) {
  const player = G.players[playerIdx];
  if (card.effect === 'sostenido') {
    if (['MI','SI'].includes(G.currentNote)) return { ok: false, error: 'El sostenido no puede jugarse sobre MI ni SI.' };
    G.forcedDir = 'asc';
    addLog(`${player.name} jugó Sostenido ♯. El siguiente debe subir.`);
  } else if (card.effect === 'bemol') {
    if (['FA','DO'].includes(G.currentNote)) return { ok: false, error: 'El bemol no puede jugarse sobre FA ni DO.' };
    G.forcedDir = 'desc';
    addLog(`${player.name} jugó Bemol ♭. El siguiente debe bajar.`);
  } else if (card.effect === 'becuadro') {
    if (G.forcedDir === null) return { ok: false, error: 'El becuadro solo se usa si hay sostenido o bemol activo.' };
    G.forcedDir = null;
    addLog(`${player.name} jugó Becuadro ♮. Alteración cancelada.`);
  }
  checkMusicala(playerIdx);
  if (checkWinner(playerIdx)) return { ok: true };
  advanceTurn();
  return { ok: true };
}

function applySpecial(card, playerIdx) {
  const player = G.players[playerIdx];
  addLog(`${player.name} jugó ${card.name}.`);

  if (card.effect === 'partitura') {
    G.players.forEach((p, i) => {
      if (i !== playerIdx) while (p.hand.length < 7) { if (!drawCard(i)) break; }
    });
    addLog('¡Partitura! Todos los demás tienen ahora 7 cartas.');
    checkMusicala(playerIdx);
    if (checkWinner(playerIdx)) return { ok: true };
    advanceTurn();
    return { ok: true };
  }

  switch (card.effect) {
    case 'silencio':   addLog(`${player.name} pasa su turno.`); advanceTurn(); break;
    case 'fantasma':   G.skipNext = true; advanceTurn(); break;
    case 'cambioDir':
      G.direction *= -1;
      addLog(`Sentido ${G.direction === 1 ? 'horario' : 'antihorario'}.`);
      advanceTurn(); break;
    case 'barraRep': {
      const prev = prevPlayerIndex();
      addLog(`${G.players[prev].name} debe repetir su turno.`);
      G.currentPlayer = prev; G.selectedCards = [];
      break;
    }
    case 'robaShow':    return { ok: true, needsTarget: 'robaShow',    playerIdx };
    case 'ensayo':      return { ok: true, needsTarget: 'ensayo',      playerIdx };
    case 'cambioNotas': return { ok: true, needsTarget: 'cambioNotas', playerIdx };
    case 'rotacion': {
      const tmp = G.players.map(p => [...p.hand]);
      G.players.forEach((p, i) => {
        p.hand = tmp[(i - G.direction + G.players.length) % G.players.length];
      });
      addLog('¡Rotación de Orquesta! Todas las manos rotaron.');
      advanceTurn(); break;
    }
    case 'improvisacion':
      G.phase = 'improvisacion';
      addLog('¡Improvisación! Elige una nota de tu mano.');
      return { ok: true, phase: 'improvisacion' };
    case 'notaPaso': {
      const ci = noteIndex(G.currentNote);
      const up = ci < NOTES.length - 1 ? NOTES[ci + 1] : null;
      const down = ci > 0 ? NOTES[ci - 1] : null;
      const noteOptions = [up, down].filter(Boolean);
      if (noteOptions.length === 0) {
        return { ok: false, error: 'No hay notas adyacentes disponibles para Nota de Paso.' };
      }
      addLog(`${player.name} jugó Nota de Paso.`);
      return { ok: true, needsNotePasoChoice: true, playerIdx, noteOptions };
    }
    case 'desafinacion':
      addLog('¡Desafinación!'); advanceTurn(); break;
    default: advanceTurn();
  }

  checkMusicala(playerIdx);
  if (checkWinner(playerIdx)) return { ok: true };
  return { ok: true };
}

function resolveTarget(effect, playerIdx, targetIdx) {
  switch (effect) {
    case 'robaShow':
      drawCard(targetIdx);
      addLog(`${G.players[targetIdx].name} roba 1 carta.`);
      break;
    case 'ensayo':
      drawCard(targetIdx); drawCard(targetIdx);
      addLog(`${G.players[targetIdx].name} roba 2 cartas.`);
      break;
    case 'cambioNotas': {
      const tmp = G.players[playerIdx].hand;
      G.players[playerIdx].hand = G.players[targetIdx].hand;
      G.players[targetIdx].hand = tmp;
      addLog(`${G.players[playerIdx].name} y ${G.players[targetIdx].name} intercambian manos.`);
      break;
    }
  }
  checkMusicala(playerIdx);
  if (checkWinner(playerIdx)) return;
  advanceTurn();
}

function resolveNotePasoChoice(playerIdx, chosenNote) {
  const ci = noteIndex(G.currentNote);
  const up = ci < NOTES.length - 1 ? NOTES[ci + 1] : null;
  const down = ci > 0 ? NOTES[ci - 1] : null;
  const options = [up, down].filter(Boolean);

  if (!options.includes(chosenNote)) {
    return { ok: false, error: 'Esa nota no es una opción válida para Nota de Paso.' };
  }

  G.currentNote = chosenNote;
  recordNote(chosenNote);
  G.forcedDir = null;
  addLog(`${G.players[playerIdx].name} elige ${chosenNote} con Nota de Paso.`);

  checkMusicala(playerIdx);
  if (checkWinner(playerIdx)) return { ok: true };
  advanceTurn();
  return { ok: true };
}

// ── CPU AI ────────────────────────────────────────────────────────────────────

function aiTurn(playerIdx) {
  if (G.winner) return;
  const player = G.players[playerIdx];

  if (G.phase === 'improvisacion') {
    const noteCards = player.hand.filter(c => c.type === 'note');
    if (noteCards.length > 0) {
      const chosen = noteCards[Math.floor(Math.random() * noteCards.length)];
      const idx = player.hand.indexOf(chosen);
      player.hand.splice(idx, 1);
      G.discard.push(chosen);
      G.currentNote = chosen.note;
      recordNote(chosen.note);
      G.forcedDir = null;
      G.phase = 'play';
      addLog(`${player.name} improvisa con ${chosen.note}.`);
      checkMusicala(playerIdx); checkWinner(playerIdx);
    }
    return;
  }

  const mask = getValidMask(player.hand, G.currentNote, G.forcedDir);
  let playIdx = -1;

  // Smart priority: prefer note → alt → special; prefer lower hand count
  const validIndices = player.hand.map((c, i) => mask[i] ? i : -1).filter(i => i >= 0);
  if (validIndices.length > 0) {
    // pick note card if possible
    playIdx = validIndices.find(i => player.hand[i].type === 'note') ?? validIndices[0];
  }

  if (playIdx >= 0) {
    const card = player.hand.splice(playIdx, 1)[0];
    const result = applyCard(card, playerIdx);
    if (result.needsTarget) {
      const targets = G.players.map((_, i) => i).filter(i => i !== playerIdx);
      const t = targets[Math.floor(Math.random() * targets.length)];
      resolveTarget(result.needsTarget, playerIdx, t);
    } else if (result.needsNotePasoChoice) {
      const options = result.noteOptions || [];
      const chosen = options[Math.floor(Math.random() * options.length)];
      if (chosen) resolveNotePasoChoice(playerIdx, chosen);
    }
  } else {
    const card = drawCard(playerIdx);
    if (card) {
      addLog(`${player.name} roba una carta.`);
      const nm = getValidMask(player.hand, G.currentNote, G.forcedDir);
      const di = player.hand.length - 1;
      if (nm[di]) {
        const drawn = player.hand.splice(di, 1)[0];
        applyCard(drawn, playerIdx);
        return;
      }
    }
    advanceTurn();
  }
  checkMusicala(playerIdx);
  checkWinner(playerIdx);
}
