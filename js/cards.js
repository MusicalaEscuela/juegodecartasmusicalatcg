/* ===================================================
   MUSICALA  cards.js
   Definicin de cartas, mazo y utilidades
   =================================================== */

'use strict';

const NOTES = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];

const NOTE_COLORS = {
  DO:  '#E53935', RE:  '#E57C00', MI:  '#B8860B', FA:  '#2E7D32',
  SOL: '#1565C0', LA:  '#6A1B9A', SI:  '#AD1457',
};

const NOTE_LABELS = {
  DO: 'Nota Do', RE: 'Nota Re', MI: 'Nota Mi', FA: 'Nota Fa',
  SOL: 'Nota Sol', LA: 'Nota La', SI: 'Nota Si',
};

const SPECIAL_DEFS = [
  { id: 'roba_show',    name: 'Roba el Show',          icon: '', cssClass: 'roba_show',    desc: 'Elige un jugador. Ese jugador roba 1 carta del mazo.',                                          effect: 'robaShow',    targetPlayer: true  },
  { id: 'silencio',     name: 'Silencio de Negra',      icon: '', cssClass: 'silencio',     desc: 'Pasa tu turno sin jugar ninguna carta. La secuencia contina.',                               effect: 'silencio',    targetPlayer: false },
  { id: 'nota_fantasma',name: 'Nota Fantasma',          icon: '', cssClass: 'nota_fantasma',desc: 'El siguiente jugador pierde su turno.',                                                        effect: 'fantasma',    targetPlayer: false },
  { id: 'improvisacion',name: 'Improvisacin',          icon: '', cssClass: 'improvisacion',desc: 'Juega cualquier carta de nota de tu mano, ignorando el orden musical.',                       effect: 'improvisacion',targetPlayer: false, needsNoteFollow: true },
  { id: 'ensayo',       name: 'Ensayo Sorpresa',        icon: '!', cssClass: 'ensayo',       desc: 'El jugador que elijas debe robar 2 cartas.',                                                   effect: 'ensayo',      targetPlayer: true  },
  { id: 'partitura',    name: 'Partitura',              icon: '', cssClass: 'partitura',    desc: 'Todos los dems jugadores roban cartas hasta tener 7. T mantienes tu mano.',                effect: 'partitura',   targetPlayer: false, removeAfterPlay: true },
  { id: 'nota_paso',    name: 'Nota de Paso',           icon: '', cssClass: 'nota_paso',    desc: 'sala como nota anterior o posterior vlida (no como la misma nota).',                        effect: 'notaPaso',    targetPlayer: false },
  { id: 'rotacion',     name: 'Rotacin de Orquesta',  icon: '', cssClass: 'rotacion',     desc: 'Todos los jugadores pasan su mano al jugador de al lado.',                                    effect: 'rotacion',    targetPlayer: false },
  { id: 'cambio_notas', name: 'Cambio de Notas',        icon: '', cssClass: 'cambio_notas', desc: 'Cambia toda tu mano con la de otro jugador.',                                                  effect: 'cambioNotas', targetPlayer: true  },
  { id: 'barra_rep',    name: 'Barra de Repeticin',   icon: '', cssClass: 'barra_rep',    desc: 'El jugador anterior debe volver a jugar una carta.',                                           effect: 'barraRep',    targetPlayer: false },
  { id: 'cambio_dir',   name: 'Cambio de Direccin',   icon: '', cssClass: 'cambio_dir',   desc: 'Cambia el sentido del turno (horario  antihorario).',                                        effect: 'cambioDir',   targetPlayer: false },
  { id: 'desafinacion', name: 'Desafinacin',           icon: '', cssClass: 'desafinacion', desc: 'Jugala durante el turno de otro jugador. Cancela su carta y ese jugador pierde el turno.',  effect: 'desafinacion',targetPlayer: false, reactive: true },
];

const ALTERATION_DEFS = [
  { id: 'sostenido', name: 'Sostenido ', icon: '', cssClass: 'sostenido', desc: 'El siguiente jugador debe continuar en sentido ascendente. No puede jugarse sobre MI ni SI.',  effect: 'sostenido', forbidden: ['MI','SI'] },
  { id: 'bemol',     name: 'Bemol ',     icon: '', cssClass: 'bemol',     desc: 'El siguiente jugador debe continuar en sentido descendente. No puede jugarse sobre FA ni DO.', effect: 'bemol',     forbidden: ['FA','DO'] },
  { id: 'becuadro',  name: 'Becuadro ',  icon: '', cssClass: 'becuadro',  desc: 'Cancela sostenido o bemol activo. Solo se puede usar si hay una alteracin activa.',           effect: 'becuadro',  forbidden: [] },
];

function buildDeck() {
  const deck = [];
  NOTES.forEach(note => {
    for (let i = 0; i < 8; i++) {
      deck.push({ uid: `note_${note}_${i}`, type: 'note', note, color: NOTE_COLORS[note], label: NOTE_LABELS[note] });
    }
  });
  SPECIAL_DEFS.forEach(def => {
    for (let i = 0; i < 2; i++) deck.push({ uid: `${def.id}_${i}`, type: 'special', ...def });
  });
  ALTERATION_DEFS.forEach(def => {
    for (let i = 0; i < 2; i++) deck.push({ uid: `${def.id}_${i}`, type: 'alt', ...def });
  });
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function noteIndex(note) { return NOTES.indexOf(note); }

function nextNoteIndex(idx) { return (idx + 1) % NOTES.length; }
function prevNoteIndex(idx) { return (idx - 1 + NOTES.length) % NOTES.length; }
function nextIdxByDir(idx, dir) { return dir === 'asc' ? nextNoteIndex(idx) : prevNoteIndex(idx); }

function buildCircularOrder(indices, dir) {
  const set = new Set(indices);
  for (const start of indices) {
    const order = [start];
    let cur = start;
    let ok = true;
    for (let i = 1; i < indices.length; i++) {
      cur = nextIdxByDir(cur, dir);
      if (!set.has(cur)) { ok = false; break; }
      order.push(cur);
    }
    if (ok) return order;
  }
  return null;
}

function isValidPlay(card, currentNote, forcedDir) {
  if (card.type === 'special') return true;
  if (card.type === 'alt') {
    if (card.effect === 'sostenido') return !['MI','SI'].includes(currentNote);
    if (card.effect === 'bemol')     return !['FA','DO'].includes(currentNote);
    // REGLA: Becuadro solo se puede jugar si hay un sostenido o bemol activo
    if (card.effect === 'becuadro')  return forcedDir !== null;
    return false;
  }
  if (card.type === 'note') {
    const ci = noteIndex(currentNote);
    const ni = noteIndex(card.note);
    if (forcedDir === 'asc')  return ni === nextNoteIndex(ci);
    if (forcedDir === 'desc') return ni === prevNoteIndex(ci);
    return ni === ci || ni === nextNoteIndex(ci) || ni === prevNoteIndex(ci);
  }
  return false;
}

function getValidMask(hand, currentNote, forcedDir) {
  return hand.map(card => isValidPlay(card, currentNote, forcedDir));
}

/**
 * Valida si un conjunto de indices forma una frase jugable de 3+ notas.
 * Respeta el orden de seleccion y permite devolverse paso a paso en la escala.
 * Devuelve { valid, dir, lastNote, playOrder, playIndices } o { valid: false }
 */
function getScaleValidation(selectedIndices, hand, currentNote, forcedDir) {
  if (selectedIndices.length < 3) return { valid: false };
  const cards = selectedIndices.map(i => hand[i]);
  if (cards.some(c => c.type !== 'note')) return { valid: false };

  const idxs = cards.map(c => noteIndex(c.note));
  const ci  = noteIndex(currentNote);
  if (ci < 0 || idxs.some(i => i < 0)) return { valid: false };

  const isNearCurrent = (idx) => (
    idx === ci || idx === nextNoteIndex(ci) || idx === prevNoteIndex(ci)
  );

  const first = idxs[0];
  if (!isNearCurrent(first)) return { valid: false };
  if (forcedDir === 'asc' && first !== nextNoteIndex(ci)) return { valid: false };
  if (forcedDir === 'desc' && first !== prevNoteIndex(ci)) return { valid: false };

  const steps = [];
  for (let i = 1; i < idxs.length; i++) {
    const prev = idxs[i - 1];
    const cur = idxs[i];
    if (cur === nextNoteIndex(prev)) steps.push('asc');
    else if (cur === prevNoteIndex(prev)) steps.push('desc');
    else return { valid: false };
  }

  const uniqueSteps = [...new Set(steps)];
  const dir = uniqueSteps.length === 1 ? uniqueSteps[0] : 'mixed';
  const lastNote  = NOTES[idxs[idxs.length - 1]];
  const playOrder = idxs.map(i => NOTES[i]);

  return { valid: true, dir, lastNote, playOrder, playIndices: [...selectedIndices] };
}

