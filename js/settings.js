/* ===================================================
   MUSICALA – settings.js
   Preferencias persistentes (localStorage).
   Controla dificultad, personalización de partida,
   accesibilidad y audio. Cargado ANTES que el resto.
   =================================================== */

'use strict';

const MSettings = (function () {
  const KEY = 'musicala_settings_v1';

  const DEFAULTS = {
    difficulty:     'media',   // 'facil' | 'media' | 'dificil'
    initialCards:   7,         // 5 | 7 | 9
    specialsEnabled: true,     // incluir cartas especiales en el mazo
    scalesEnabled:   true,     // permitir jugar escalas (3+ notas)
    animSpeed:      'normal',  // 'lenta' | 'normal' | 'rapida'
    soundEnabled:    true,     // efectos de sonido
    hapticsEnabled:  true,     // vibración en móviles compatibles
    privacyScreen:   true,     // pantalla "pasa el dispositivo"
    passCountdown:   false,    // cuenta regresiva de 3s antes de mostrar la mano
    tutorialSeen:    false,    // si ya vio el tutorial alguna vez
  };

  let state = { ...DEFAULTS };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { ...DEFAULTS, ...parsed };
      }
    } catch (err) {
      state = { ...DEFAULTS };
    }
    applyAnimSpeed();
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      /* localStorage puede no estar disponible en contextos restringidos */
    }
  }

  function get(key) {
    if (key === undefined) return { ...state };
    return state[key];
  }

  function set(key, value) {
    state[key] = value;
    save();
    if (key === 'animSpeed') applyAnimSpeed();
  }

  // Refleja la velocidad de animación en el <body> para que el CSS la lea.
  function applyAnimSpeed() {
    if (document && document.body) {
      document.body.setAttribute('data-anim', state.animSpeed || 'normal');
    }
  }

  // Multiplicador para temporizadores en JS (turno de la CPU, etc.)
  function speedFactor() {
    if (state.animSpeed === 'rapida') return 0.5;
    if (state.animSpeed === 'lenta')  return 1.7;
    return 1;
  }

  return { load, save, get, set, speedFactor, applyAnimSpeed, DEFAULTS };
})();

window.MSettings = MSettings;

// Cargar lo antes posible.
MSettings.load();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MSettings.applyAnimSpeed(), { once: true });
} else {
  MSettings.applyAnimSpeed();
}
