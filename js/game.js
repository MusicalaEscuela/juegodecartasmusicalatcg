/* ===================================================
   MUSICALA  game.js  v2
   Lgica central + soporte multijugador local
   =================================================== */

'use strict';

let G = null;

function initGame(playersConfig) {
  // Leer preferencias de partida (con valores por defecto seguros).
  const S = (window.MSettings && MSettings.get()) || {};
  const difficulty   = S.difficulty || 'media';
  const initialCards = [5, 7, 9].includes(S.initialCards) ? S.initialCards : 7;
  const specialsOn   = S.specialsEnabled !== false;
  const scalesOn     = S.scalesEnabled !== false;

  const deck = buildDeck({ specials: specialsOn });
  const n = playersConfig.length;
  const hands = playersConfig.map(() => deck.splice(0, initialCards));

  let startIdx = deck.findIndex(c => c.type === 'note');
  if (startIdx === -1) startIdx = 0;
  const [startCard] = deck.splice(startIdx, 1);

  G = {
    players: playersConfig.map((p, i) => ({
      name: p.name, isHuman: p.isHuman,
      hand: hands[i], musicalaAnnounced: false,
      // Estadísticas para la pantalla final.
      scalesPlayed: 0, specialsUsed: 0,
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
    noteHistory: [startCard.note],  //  sequence chip history
    winner: null,
    phase: 'play',
    partituraUsed: 0,
    turnCount: 0,
    // Configuración activa de esta partida.
    difficulty,
    initialCards,
    specialsEnabled: specialsOn,
    scalesEnabled: scalesOn,
  };

  addLog(`La secuencia comienza en ${startCard.note}. ¡Que empiece el juego!`);
}

//  Helpers 

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
  // Regla desactivada en modo virtual
  return;
}

function checkWinner(playerIdx) {
  // Ya hay ganador: no volver a anunciarlo (antes el aviso salía duplicado).
  if (G.winner !== null) return true;
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

//  Human plays 

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

  const playIndices = validation.playIndices || [...indices];
  const noteNames = validation.playOrder || playIndices.map(i => player.hand[i].note);
  const byDesc = [...playIndices].sort((a, b) => b - a);
  byDesc.forEach(i => {
    const card = player.hand.splice(i, 1)[0];
    G.discard.push(card);
  });

  noteNames.forEach(n => recordNote(n));
  G.currentNote  = validation.lastNote;
  G.forcedDir    = null;
  G.selectedCards = [];
  player.scalesPlayed = (player.scalesPlayed || 0) + 1;

  addLog(`${player.name} jugó escala: ${noteNames.join(' → ')}.`);
  checkMusicala(G.currentPlayer);
  if (checkWinner(G.currentPlayer)) return { ok: true, scalePlayOrder: noteNames };
  advanceTurn();
  return { ok: true, scalePlayOrder: noteNames };
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
  const playable = newMask[drawnIdx];
  if (playable) {
    addLog('La carta robada es válida. ¡Puedes jugarla!');
  } else {
    advanceTurn();
  }
  return { ok: true, drew: card, drewPlayable: playable };
}

function humanAnnounceMusica() {
  return { ok: false, error: 'La regla MUSICALA está desactivada.' };
}

function penalizeMusicalaMissed(targetIdx) {
  for (let i = 0; i < 2; i++) drawCard(targetIdx);
  addLog(`${G.players[targetIdx].name} no gritó MUSICALA a tiempo. ¡Roba 2 cartas!`);
}

//  Apply card effect 

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
  player.specialsUsed = (player.specialsUsed || 0) + 1;
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
      // Sin cartas de nota no hay con qué improvisar: el turno pasa (antes la partida se bloqueaba).
      if (!player.hand.some(c => c.type === 'note')) {
        addLog(`${player.name} no tiene notas para improvisar. Pasa el turno.`);
        advanceTurn();
        break;
      }
      G.phase = 'improvisacion';
      addLog('¡Improvisación! Elige una nota de tu mano.');
      return { ok: true, phase: 'improvisacion' };
    case 'notaPaso': {
      const ci = noteIndex(G.currentNote);
      const up = NOTES[(ci + 1) % NOTES.length];
      const down = NOTES[(ci - 1 + NOTES.length) % NOTES.length];
      const noteOptions = [up, down];
      addLog(`${player.name} jugó Nota de Paso.`);
      return { ok: true, needsNotePasoChoice: true, playerIdx, noteOptions };
    }
    case 'desafinacion': {
      // El siguiente jugador "desafina": roba 1 carta y pierde el turno.
      const nxt = nextPlayerIndex();
      drawCard(nxt);
      G.skipNext = true;
      addLog(`¡Desafinación! ${G.players[nxt].name} roba 1 carta y pierde el turno.`);
      advanceTurn();
      break;
    }
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
  const up = NOTES[(ci + 1) % NOTES.length];
  const down = NOTES[(ci - 1 + NOTES.length) % NOTES.length];
  const options = [up, down];

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

//  CPU AI
//  Tres niveles de dificultad (G.difficulty):
//   - 'facil'   : juega la primera carta válida, sin escalas ni estrategia.
//   - 'media'   : prioriza notas, juega escalas largas y usa algunas especiales;
//                 dirige sus cartas ofensivas al rival con menos cartas.
//   - 'dificil' : busca escalas siempre que pueda, conserva/usa especiales para
//                 bloquear al rival que está por ganar.

// Busca la escala monótona (ascendente o descendente) más larga jugable.
// Devuelve un array de índices de la mano en orden de juego, o null.
function findBestAIScale(hand, currentNote, forcedDir) {
  if (!G.scalesEnabled) return null;

  const byNote = {};                       // noteIndex -> [handIndex, ...]
  hand.forEach((c, i) => {
    if (c.type === 'note') {
      const ni = noteIndex(c.note);
      (byNote[ni] = byNote[ni] || []).push(i);
    }
  });

  const ci = noteIndex(currentNote);
  let best = null;

  ['asc', 'desc'].forEach(dir => {
    if (forcedDir === 'asc'  && dir !== 'asc')  return;
    if (forcedDir === 'desc' && dir !== 'desc') return;

    let starts;
    if (forcedDir === 'asc')       starts = [nextNoteIndex(ci)];
    else if (forcedDir === 'desc') starts = [prevNoteIndex(ci)];
    else                           starts = [ci, nextNoteIndex(ci), prevNoteIndex(ci)];

    starts.forEach(start => {
      if (!byNote[start]) return;
      const used = {};
      const seq = [];
      let cur = start;
      while (byNote[cur] && (used[cur] || 0) < byNote[cur].length && seq.length < NOTES.length) {
        seq.push(byNote[cur][used[cur] || 0]);
        used[cur] = (used[cur] || 0) + 1;
        cur = dir === 'asc' ? nextNoteIndex(cur) : prevNoteIndex(cur);
      }
      if (seq.length >= 3 && (!best || seq.length > best.length)) best = seq;
    });
  });

  return best;
}

// Ejecuta una escala para un jugador CPU (sin las comprobaciones de turno humano).
function aiPlayScale(playerIdx, indices) {
  const player = G.players[playerIdx];
  const validation = getScaleValidation(indices, player.hand, G.currentNote, G.forcedDir);
  if (!validation.valid) return false;

  const playIndices = validation.playIndices || [...indices];
  const noteNames = validation.playOrder || playIndices.map(i => player.hand[i].note);
  [...playIndices].sort((a, b) => b - a).forEach(i => {
    const card = player.hand.splice(i, 1)[0];
    G.discard.push(card);
  });

  noteNames.forEach(n => recordNote(n));
  G.currentNote = validation.lastNote;
  G.forcedDir = null;
  player.scalesPlayed = (player.scalesPlayed || 0) + 1;
  addLog(`${player.name} jugó escala: ${noteNames.join(' → ')}.`);
  checkMusicala(playerIdx);
  if (checkWinner(playerIdx)) return true;
  advanceTurn();
  return true;
}

function aiRandomOpponent(playerIdx) {
  const targets = G.players.map((_, i) => i).filter(i => i !== playerIdx);
  return targets[Math.floor(Math.random() * targets.length)];
}

// Rival con menos cartas (el más cerca de ganar) → recibe las cartas ofensivas.
function aiPickTarget(playerIdx) {
  const opponents = G.players
    .map((p, i) => ({ i, n: p.hand.length }))
    .filter(o => o.i !== playerIdx)
    .sort((a, b) => a.n - b.n);
  return opponents.length ? opponents[0].i : playerIdx;
}

function aiChooseCardIndex(playerIdx, validIndices, difficulty) {
  const hand = G.players[playerIdx].hand;
  if (difficulty === 'facil') return validIndices[0];

  const notes    = validIndices.filter(i => hand[i].type === 'note');
  const specials = validIndices.filter(i => hand[i].type === 'special');
  const alts     = validIndices.filter(i => hand[i].type === 'alt');

  if (difficulty === 'dificil') {
    // Si un rival está por ganar, juega una especial ofensiva para bloquearlo.
    const threat = G.players.some((p, i) => i !== playerIdx && p.hand.length <= 2);
    const offensive = specials.find(i =>
      ['ensayo', 'robaShow', 'cambioNotas', 'fantasma'].includes(hand[i].effect));
    if (threat && offensive !== undefined) return offensive;
  }

  // media y dificil (sin amenaza): nota → especial → alteración.
  return notes[0] ?? specials[0] ?? alts[0] ?? validIndices[0];
}

function aiTurn(playerIdx) {
  if (G.winner) return;
  const player = G.players[playerIdx];
  const difficulty = G.difficulty || 'media';

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
      checkMusicala(playerIdx);
      // Igual que el jugador humano: tras improvisar, el turno pasa.
      if (!checkWinner(playerIdx)) advanceTurn();
    } else {
      // Red de seguridad (p. ej. una partida guardada antes de la corrección).
      G.phase = 'play';
      addLog(`${player.name} no tiene notas para improvisar. Pasa el turno.`);
      advanceTurn();
    }
    return;
  }

  // Intento de escala (vaciar mano rápido). Difícil siempre; media solo escalas largas.
  if (difficulty !== 'facil' && G.scalesEnabled) {
    const scale = findBestAIScale(player.hand, G.currentNote, G.forcedDir);
    if (scale && (difficulty === 'dificil' || scale.length >= 4)) {
      if (aiPlayScale(playerIdx, scale)) return;
    }
  }

  const mask = getValidMask(player.hand, G.currentNote, G.forcedDir);
  const validIndices = player.hand.map((c, i) => mask[i] ? i : -1).filter(i => i >= 0);
  let playIdx = validIndices.length > 0 ? aiChooseCardIndex(playerIdx, validIndices, difficulty) : -1;

  if (playIdx >= 0) {
    const card = player.hand.splice(playIdx, 1)[0];
    const result = applyCard(card, playerIdx);
    if (result.needsTarget) {
      const t = difficulty === 'facil' ? aiRandomOpponent(playerIdx) : aiPickTarget(playerIdx);
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

