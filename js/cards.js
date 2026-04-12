/* ===================================================
   MUSICALA – cards.js
   Definición de cartas, mazo y utilidades
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
  { id: 'roba_show',    name: 'Roba el Show',          icon: '★', cssClass: 'roba_show',    desc: 'Elige un jugador. Ese jugador roba 1 carta del mazo.',                                          effect: 'robaShow',    targetPlayer: true  },
  { id: 'silencio',     name: 'Silencio de Negra',      icon: '♩', cssClass: 'silencio',     desc: 'Pasa tu turno sin jugar ninguna carta. La secuencia continúa.',                               effect: 'silencio',    targetPlayer: false },
  { id: 'nota_fantasma',name: 'Nota Fantasma',          icon: '☁', cssClass: 'nota_fantasma',desc: 'El siguiente jugador pierde su turno.',                                                        effect: 'fantasma',    targetPlayer: false },
  { id: 'improvisacion',name: 'Improvisación',          icon: '♪', cssClass: 'improvisacion',desc: 'Juega cualquier carta de nota de tu mano, ignorando el orden musical.',                       effect: 'improvisacion',targetPlayer: false, needsNoteFollow: true },
  { id: 'ensayo',       name: 'Ensayo Sorpresa',        icon: '!', cssClass: 'ensayo',       desc: 'El jugador que elijas debe robar 2 cartas.',                                                   effect: 'ensayo',      targetPlayer: true  },
  { id: 'partitura',    name: 'Partitura',              icon: '♬', cssClass: 'partitura',    desc: 'Todos los demás jugadores roban cartas hasta tener 7. Tú mantienes tu mano.',                effect: 'partitura',   targetPlayer: false, removeAfterPlay: true },
  { id: 'nota_paso',    name: 'Nota de Paso',           icon: '↔', cssClass: 'nota_paso',    desc: 'Úsala como nota anterior o posterior válida (no como la misma nota).',                        effect: 'notaPaso',    targetPlayer: false },
  { id: 'rotacion',     name: 'Rotación de Orquesta',  icon: '↺', cssClass: 'rotacion',     desc: 'Todos los jugadores pasan su mano al jugador de al lado.',                                    effect: 'rotacion',    targetPlayer: false },
  { id: 'cambio_notas', name: 'Cambio de Notas',        icon: '⇌', cssClass: 'cambio_notas', desc: 'Cambia toda tu mano con la de otro jugador.',                                                  effect: 'cambioNotas', targetPlayer: true  },
  { id: 'barra_rep',    name: 'Barra de Repetición',   icon: '‖', cssClass: 'barra_rep',    desc: 'El jugador anterior debe volver a jugar una carta.',                                           effect: 'barraRep',    targetPlayer: false },
  { id: 'cambio_dir',   name: 'Cambio de Dirección',   icon: '⟳', cssClass: 'cambio_dir',   desc: 'Cambia el sentido del turno (horario ↔ antihorario).',                                        effect: 'cambioDir',   targetPlayer: false },
  { id: 'desafinacion', name: 'Desafinación',           icon: '✗', cssClass: 'desafinacion', desc: 'Juégala durante el turno de otro jugador. Cancela su carta y ese jugador pierde el turno.',  effect: 'desafinacion',targetPlayer: false, reactive: true },
];

const ALTERATION_DEFS = [
  { id: 'sostenido', name: 'Sostenido ♯', icon: '♯', cssClass: 'sostenido', desc: 'El siguiente jugador debe continuar en sentido ascendente. No puede jugarse sobre MI ni SI.',  effect: 'sostenido', forbidden: ['MI','SI'] },
  { id: 'bemol',     name: 'Bemol ♭',     icon: '♭', cssClass: 'bemol',     desc: 'El siguiente jugador debe continuar en sentido descendente. No puede jugarse sobre FA ni DO.', effect: 'bemol',     forbidden: ['FA','DO'] },
  { id: 'becuadro',  name: 'Becuadro ♮',  icon: '♮', cssClass: 'becuadro',  desc: 'Cancela sostenido o bemol activo. Solo se puede usar si hay una alteración activa.',           effect: 'becuadro',  forbidden: [] },
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
    if (forcedDir === 'asc')  return ni === ci + 1;
    if (forcedDir === 'desc') return ni === ci - 1;
    return ni === ci || ni === ci + 1 || ni === ci - 1;
  }
  return false;
}

function getValidMask(hand, currentNote, forcedDir) {
  return hand.map(card => isValidPlay(card, currentNote, forcedDir));
}

/**
 * Valida si un conjunto de índices forma una escala jugable (mínimo 3 notas consecutivas).
 * Devuelve { valid, dir, lastNote, playOrder } o { valid: false }
 */
function getScaleValidation(selectedIndices, hand, currentNote, forcedDir) {
  if (selectedIndices.length < 3) return { valid: false };
  const cards = selectedIndices.map(i => hand[i]);
  if (cards.some(c => c.type !== 'note')) return { valid: false };

  const idxs = cards.map(c => noteIndex(c.note));
  if (new Set(idxs).size !== idxs.length) return { valid: false }; // sin duplicados

  const sorted = [...idxs].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return { valid: false }; // deben ser consecutivas
  }

  const ci  = noteIndex(currentNote);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const canAsc  = (min >= ci - 1 && min <= ci + 1) && forcedDir !== 'desc';
  const canDesc = (max >= ci - 1 && max <= ci + 1) && forcedDir !== 'asc';
  if (!canAsc && !canDesc) return { valid: false };

  let dir = canAsc ? 'asc' : 'desc';
  if (forcedDir === 'asc')  dir = 'asc';
  if (forcedDir === 'desc') dir = 'desc';

  const lastNote  = dir === 'asc' ? NOTES[max] : NOTES[min];
  const playOrder = dir === 'asc'
    ? sorted.map(i => NOTES[i])
    : [...sorted].reverse().map(i => NOTES[i]);

  return { valid: true, dir, lastNote, playOrder };
}
