/* ===================================================
   MUSICALA – persist.js  (v2.1)
   Guarda la partida local en curso (CPU / multijugador
   local) para que sobreviva a una recarga o a que el
   sistema cierre la app en segundo plano.
   Las partidas en línea no se guardan aquí: su estado
   vive en Firestore.
   =================================================== */

'use strict';

const MSave = (function () {
  const KEY = 'musicala_save_v1';
  const VERSION = 1;
  const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;   // 14 días

  function storage() {
    try { return window.localStorage; } catch (err) { return null; }
  }

  /** Guarda el estado actual. Se llama al final de cada renderGame(). */
  function auto() {
    if (typeof G === 'undefined' || !G || G._onlineMode) return;
    if (G.winner !== null && G.winner !== undefined) { clear(); return; }
    const ls = storage();
    if (!ls) return;
    try {
      const snapshot = { ...G, selectedCards: [] };
      ls.setItem(KEY, JSON.stringify({
        v: VERSION,
        ts: Date.now(),
        game: snapshot,
        setupPlayers: (typeof setupPlayers !== 'undefined') ? setupPlayers : null,
      }));
    } catch (err) {
      /* almacenamiento lleno o no disponible: se juega sin guardado */
    }
  }

  function clear() {
    const ls = storage();
    if (!ls) return;
    try { ls.removeItem(KEY); } catch (err) { /* nada que hacer */ }
  }

  function isValidGame(g) {
    return !!g
      && Array.isArray(g.players) && g.players.length >= 2
      && g.players.every(p => p && typeof p.name === 'string' && Array.isArray(p.hand))
      && Array.isArray(g.deck) && Array.isArray(g.discard) && Array.isArray(g.log)
      && typeof NOTES !== 'undefined' && NOTES.includes(g.currentNote)
      && Number.isInteger(g.currentPlayer) && g.currentPlayer >= 0 && g.currentPlayer < g.players.length
      && (g.direction === 1 || g.direction === -1)
      && g.winner === null
      && !g._onlineMode;
  }

  /** Devuelve la partida guardada o null. Descarta guardados dañados o viejos. */
  function load() {
    const ls = storage();
    if (!ls) return null;
    try {
      const raw = ls.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== VERSION || !isValidGame(data.game)) { clear(); return null; }
      if (Date.now() - (data.ts || 0) > MAX_AGE_MS) { clear(); return null; }
      return data;
    } catch (err) {
      clear();
      return null;
    }
  }

  function has() { return load() !== null; }

  return { auto, clear, load, has };
})();

window.MSave = MSave;
