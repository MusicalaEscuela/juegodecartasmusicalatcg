/* ===================================================
   MUSICALA – sfx.js
   Efectos de sonido sintetizados con Web Audio API.
   No requiere archivos de audio: si más adelante se
   agregan .mp3, basta con reemplazar play() por <audio>.
   Respeta la preferencia soundEnabled de MSettings.
   =================================================== */

'use strict';

const MSfx = (function () {
  let ctx = null;

  // Frecuencias aproximadas de la 4ª octava para mapear notas.
  const NOTE_FREQ = {
    DO: 261.63, RE: 293.66, MI: 329.63, FA: 349.23,
    SOL: 392.00, LA: 440.00, SI: 493.88,
  };

  function ensureCtx() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      } catch (err) {
        ctx = null;
      }
    }
    // Los navegadores suspenden el contexto hasta la primera interacción.
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function enabled() {
    if (window.MSettings && typeof MSettings.get === 'function') {
      return MSettings.get('soundEnabled') !== false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, whenOffset) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + (whenOffset || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /**
   * Reproduce un efecto.
   * @param {string} kind  'play' | 'draw' | 'special' | 'error' | 'win' | 'scale' | 'select'
   * @param {string|string[]} opt  Nota (para 'play') o lista de notas (para 'scale').
   */
  function play(kind, opt) {
    if (!enabled()) return;
    switch (kind) {
      case 'play':
        tone((opt && NOTE_FREQ[opt]) || 392, 0.18, 'triangle', 0.16);
        break;
      case 'select':
        tone(660, 0.07, 'sine', 0.09);
        break;
      case 'draw':
        tone(190, 0.12, 'sine', 0.13);
        tone(130, 0.16, 'sine', 0.10, 0.05);
        break;
      case 'special':
        tone(523, 0.10, 'square', 0.08);
        tone(659, 0.12, 'square', 0.08, 0.06);
        tone(784, 0.14, 'square', 0.07, 0.12);
        break;
      case 'error':
        tone(170, 0.16, 'sawtooth', 0.10);
        tone(130, 0.18, 'sawtooth', 0.09, 0.05);
        break;
      case 'scale': {
        const notes = Array.isArray(opt) ? opt : [];
        notes.forEach((n, i) => tone(NOTE_FREQ[n] || 392, 0.16, 'triangle', 0.15, i * 0.1));
        break;
      }
      case 'win':
        ['DO', 'MI', 'SOL', 'DO'].forEach((n, i) =>
          tone(NOTE_FREQ[n] * (i === 3 ? 2 : 1), 0.32, 'triangle', 0.16, i * 0.15));
        break;
      default:
        break;
    }
  }

  return { play, enabled };
})();

window.MSfx = MSfx;
