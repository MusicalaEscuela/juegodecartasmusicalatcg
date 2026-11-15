/* ===================================================
   MUSICALA – boot.js  (v2.1)
   Arranque: pantalla de carga con progreso real,
   precarga de las cartas pequeñas, registro del
   service worker e invitación a instalar la app.
   Nunca bloquea: si algo tarda, la carga se cierra
   sola y el juego queda disponible.
   =================================================== */

'use strict';

(function () {
  const MAX_WAIT_MS = 3500;          // tope: el juego nunca espera más que esto
  const loader = document.getElementById('app-loader');
  const bar    = document.getElementById('app-loader-bar');
  const label  = document.getElementById('app-loader-label');

  const CARD_NAMES = [
    'nota_do', 'nota_re', 'nota_mi', 'nota_fa', 'nota_sol', 'nota_la', 'nota_si',
    'carta_sostenido', 'carta_bemol', 'carta_becuadro',
    'carta_roba_show', 'carta_silencio', 'carta_nota_fantasma', 'carta_improvisacion',
    'carta_ensayo', 'carta_partitura', 'carta_nota_paso', 'carta_rotacion',
    'carta_cambio_notas', 'carta_barra_rep', 'carta_cambio_dir', 'carta_desafinacion',
  ];

  // Lo que se necesita para la primera partida: cartas pequeñas, reverso y notas grandes.
  const CRITICAL = [
    'assets/backs/back-sm.webp',
    ...CARD_NAMES.map(n => `assets/cards/sm/${n}.webp`),
  ];
  // Lo demás se trae después, cuando el navegador está libre.
  const LAZY = CARD_NAMES.map(n => `assets/cards/${n}.webp`);

  let done = 0;
  let finished = false;
  const total = CRITICAL.length + 1;       // +1 = fuentes

  function setProgress() {
    const pct = Math.min(100, Math.round((done / total) * 100));
    if (bar) bar.style.transform = `scaleX(${pct / 100})`;
    if (loader) loader.setAttribute('aria-valuenow', String(pct));
    if (label) label.textContent = `Cargando… ${pct}%`;
  }

  function step() {
    done++;
    setProgress();
    if (done >= total) finish();
  }

  function preload(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => resolve();
      img.src = src;
    });
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (loader) {
      loader.classList.add('is-done');
      setTimeout(() => loader.remove(), 350);
    }
    document.documentElement.classList.add('app-ready');
    // Precarga diferida de las cartas grandes (zoom / carta central).
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 800));
    idle(() => LAZY.forEach(src => { preload(src); }));
  }

  setProgress();
  CRITICAL.forEach(src => preload(src).then(step));
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  fontsReady.then(step, step);
  setTimeout(finish, MAX_WAIT_MS);

  // ── Service worker (offline) ──
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('[Musicala] No se pudo registrar el service worker:', err);
      });
    });
  }

  // ── Instalación como app (Chrome / Android) ──
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    const btn = document.getElementById('btn-intro-install');
    if (btn) btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    const btn = document.getElementById('btn-intro-install');
    if (btn) btn.hidden = true;
  });
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-intro-install');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!installEvent) return;
      installEvent.prompt();
      try { await installEvent.userChoice; } catch (err) { /* cancelado */ }
      installEvent = null;
      btn.hidden = true;
    });
  });
})();
