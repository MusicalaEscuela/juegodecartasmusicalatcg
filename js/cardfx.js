/* ===================================================
   MUSICALA – cardfx.js  (v2.2)
   Un efecto visual y sonoro propio para cada carta de
   efecto (12 especiales + 3 alteraciones).
   Solo presentación: lo dispara game.js al aplicar la
   carta, pero nunca cambia el estado ni las reglas.
   =================================================== */

'use strict';

const MCardFx = (function () {
  const NOTE_HUES = ['#E53935', '#E57C00', '#C6A800', '#1B8C3E', '#1565C0', '#6A1B9A', '#AD1457'];

  /* Cada carta: símbolo central, título, colores, y cómo se mueven sus partículas.
     motion: burst | rise | fall | sweep | rewind | orbit | cross | float | wave | ring */
  const DEFS = {
    robaShow:      { glyph: '🎤', title: 'Roba el Show',         c1: '#FFD54A', c2: '#FF8A00', motion: 'burst',  chars: ['★', '✦', '★', '✧'], count: 16, extra: 'spotlight' },
    silencio:      { glyph: '🤫', title: 'Silencio de Negra',    c1: '#B0BEC5', c2: '#455A64', motion: 'fall',   chars: ['♪', '♩'],            count: 7,  board: 'fx-mute', duck: true },
    fantasma:      { glyph: '👻', title: 'Nota Fantasma',        c1: '#80FFEA', c2: '#3D5AFE', motion: 'float',  chars: ['♪', '♫', '👻'],      count: 8,  board: 'fx-ghost' },
    improvisacion: { glyph: '🎷', title: '¡Improvisación!',      c1: '#FF4FA3', c2: '#7C4DFF', motion: 'burst',  chars: ['♪', '♫', '♬', '♩'],  count: 22, rainbow: true },
    ensayo:        { glyph: '+2', title: 'Ensayo Sorpresa',      c1: '#FF5252', c2: '#B71C1C', motion: 'fall',   chars: ['CARD'],              count: 2,  board: 'fx-shake', extra: 'alarm', big: true },
    partitura:     { glyph: '🎼', title: 'Partitura',            c1: '#FFE9A8', c2: '#C89B3C', motion: 'sweep',  chars: ['♩', '♪', '♫', '♬'],  count: 12, extra: 'staff' },
    notaPaso:      { glyph: '↕',  title: 'Nota de Paso',         c1: '#4DD0E1', c2: '#00838F', motion: 'step',   chars: ['♪'],                 count: 6 },
    rotacion:      { glyph: '↻',  title: 'Rotación de Orquesta', c1: '#B388FF', c2: '#651FFF', motion: 'orbit',  chars: ['CARD'],              count: 8,  spin: true },
    cambioNotas:   { glyph: '⇄',  title: 'Cambio de Notas',      c1: '#FFB74D', c2: '#E65100', motion: 'cross',  chars: ['CARD'],              count: 6 },
    barraRep:      { glyph: '↺',  title: 'Barra de Repetición',  c1: '#9FA8FF', c2: '#3949AB', motion: 'rewind', chars: ['◀', '◀◀'],           count: 10, extra: 'repeat' },
    cambioDir:     { glyph: '⇆',  title: 'Cambio de Dirección',  c1: '#64B5F6', c2: '#0D47A1', motion: 'sweep',  chars: ['➜'],                 count: 9,  flip: true },
    desafinacion:  { glyph: '🎺', title: '¡Desafinación!',       c1: '#C6FF00', c2: '#D500F9', motion: 'wave',   chars: ['〰', '♯', '♭', '?'], count: 12, board: 'fx-wobble' },
    sostenido:     { glyph: '♯',  title: 'Sostenido',            c1: '#69F0AE', c2: '#00C853', motion: 'rise',   chars: ['▲', '♪'],            count: 12 },
    bemol:         { glyph: '♭',  title: 'Bemol',                c1: '#82B1FF', c2: '#2962FF', motion: 'fall',   chars: ['▼', '♪'],            count: 12 },
    becuadro:      { glyph: '♮',  title: 'Becuadro',             c1: '#FFFFFF', c2: '#B0BEC5', motion: 'ring',   chars: ['•'],                 count: 14, extra: 'flash' },
  };

  let layer = null;
  let clearTimer = null;
  let boardTimer = null;
  let lastAt = 0;

  function reduced() { return !!(window.MFx && MFx.reduced()); }
  function speed()   { return (window.MSettings && MSettings.speedFactor) ? MSettings.speedFactor() : 1; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function ensureLayer() {
    const screen = document.getElementById('screen-game');
    if (!screen || !screen.classList.contains('active')) return null;
    if (!layer || !screen.contains(layer)) {
      layer = document.createElement('div');
      layer.id = 'card-fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      screen.appendChild(layer);
    }
    return layer;
  }

  function particle(def, i) {
    const p = document.createElement('span');
    p.className = 'cfx-p';
    const ch = def.chars[i % def.chars.length];
    if (ch === 'CARD') p.classList.add('cfx-cardback');   // reverso real de la baraja
    else p.textContent = ch;
    const n = def.count;
    const angle = (i / n) * Math.PI * 2 + rnd(-0.25, 0.25);
    const dist = rnd(28, 46);
    p.style.setProperty('--i', i);
    p.style.setProperty('--n', n);
    p.style.setProperty('--tx', `${Math.cos(angle) * dist}vmin`);
    p.style.setProperty('--ty', `${Math.sin(angle) * dist}vmin`);
    p.style.setProperty('--x', `${rnd(4, 96)}%`);
    p.style.setProperty('--y', `${rnd(12, 88)}%`);
    p.style.setProperty('--rot', `${rnd(-200, 200)}deg`);
    p.style.setProperty('--sz', `${rnd(0.8, 1.7)}`);
    p.style.setProperty('--delay', `${rnd(0, 0.35)}s`);
    p.style.setProperty('--angle', `${(i / n) * 360}deg`);
    p.style.setProperty('--side', i % 2 === 0 ? '1' : '-1');
    if (def.rainbow) p.style.color = NOTE_HUES[i % NOTE_HUES.length];
    return p;
  }

  /** Dispara el efecto de una carta. `effect` es card.effect (p. ej. 'rotacion'). */
  function trigger(effect) {
    try {
      const def = DEFS[effect];
      if (!def) return;
      lastAt = Date.now();
      sound(effect);

      const host = ensureLayer();
      if (!host || document.hidden) return;

      const dur = Math.round(1500 * Math.max(0.6, speed()));
      host.innerHTML = '';
      host.className = '';
      void host.offsetWidth;                      // reinicia las animaciones
      host.className = `cfx-on cfx-m-${def.motion} cfx-${effect}` + (reduced() ? ' cfx-static' : '');
      host.style.setProperty('--c1', def.c1);
      host.style.setProperty('--c2', def.c2);
      host.style.setProperty('--dur', `${dur}ms`);

      const wash = document.createElement('div');
      wash.className = 'cfx-wash' + (def.extra ? ` cfx-x-${def.extra}` : '');
      host.appendChild(wash);

      if (def.extra === 'staff' && !reduced()) {
        const staff = document.createElement('div');
        staff.className = 'cfx-staff';
        staff.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
        host.appendChild(staff);
      }

      if (!reduced()) {
        const parts = document.createElement('div');
        parts.className = 'cfx-parts';
        for (let i = 0; i < def.count; i++) parts.appendChild(particle(def, i));
        host.appendChild(parts);
      }

      const stamp = document.createElement('div');
      stamp.className = 'cfx-stamp';
      const glyph = document.createElement('span');
      glyph.className = 'cfx-glyph' + (def.big ? ' is-text' : '') + (def.spin ? ' is-spin' : '') + (def.flip ? ' is-flip' : '');
      glyph.textContent = def.glyph;
      const title = document.createElement('span');
      title.className = 'cfx-title';
      title.textContent = def.title;
      stamp.appendChild(glyph);
      stamp.appendChild(title);
      host.appendChild(stamp);

      // Efecto sobre toda la mesa (temblor, desafinado, silencio…)
      const screen = document.getElementById('screen-game');
      if (def.board && screen && !reduced()) {
        screen.classList.remove('fx-shake', 'fx-wobble', 'fx-mute', 'fx-ghost');
        void screen.offsetWidth;
        screen.classList.add(def.board);
        if (boardTimer) clearTimeout(boardTimer);
        boardTimer = setTimeout(() => screen.classList.remove(def.board), dur);
      }
      if (def.duck) duckMusic(dur);

      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        if (layer) { layer.className = ''; layer.innerHTML = ''; }
      }, dur + 80);
    } catch (err) {
      /* un efecto nunca debe interrumpir la partida */
    }
  }

  // Silencio de Negra: la música de fondo baja un momento.
  function duckMusic(ms) {
    const audio = document.getElementById('bg-music');
    if (!audio || audio.paused) return;
    const original = audio.volume;
    audio.volume = Math.max(0, original * 0.12);
    setTimeout(() => { audio.volume = original; }, ms);
  }

  // Firma sonora de cada carta: [frecuencia, duración, onda, volumen, retraso]
  const MOTIFS = {
    robaShow:      [[784, .09, 'triangle', .10, 0], [988, .09, 'triangle', .10, .08], [1319, .22, 'triangle', .10, .16]],
    silencio:      [[330, .30, 'sine', .08, 0], [220, .45, 'sine', .06, .12]],
    fantasma:      [[880, .35, 'sine', .05, 0], [932, .40, 'sine', .05, .10], [698, .50, 'sine', .04, .25]],
    improvisacion: [[392, .08, 'triangle', .10, 0], [494, .08, 'triangle', .10, .07], [466, .08, 'triangle', .10, .14], [587, .08, 'triangle', .10, .21], [740, .20, 'triangle', .10, .28]],
    ensayo:        [[196, .12, 'square', .08, 0], [196, .12, 'square', .08, .16], [147, .28, 'square', .08, .32]],
    partitura:     [[523, .10, 'sine', .09, 0], [659, .10, 'sine', .09, .09], [784, .10, 'sine', .09, .18], [1047, .28, 'sine', .09, .27]],
    notaPaso:      [[440, .10, 'triangle', .10, 0], [494, .10, 'triangle', .10, .10], [440, .16, 'triangle', .10, .20]],
    rotacion:      [[330, .10, 'sine', .08, 0], [415, .10, 'sine', .08, .08], [494, .10, 'sine', .08, .16], [415, .10, 'sine', .08, .24], [330, .20, 'sine', .08, .32]],
    cambioNotas:   [[587, .10, 'triangle', .09, 0], [392, .10, 'triangle', .09, .10], [587, .10, 'triangle', .09, .20], [392, .18, 'triangle', .09, .30]],
    barraRep:      [[659, .08, 'square', .06, 0], [587, .08, 'square', .06, .08], [523, .08, 'square', .06, .16], [659, .16, 'square', .06, .30]],
    cambioDir:     [[880, .10, 'sine', .09, 0], [660, .10, 'sine', .09, .09], [440, .20, 'sine', .09, .18]],
    desafinacion:  [[440, .30, 'sawtooth', .06, 0], [466, .30, 'sawtooth', .06, 0], [415, .40, 'sawtooth', .05, .22]],
    sostenido:     [[523, .09, 'triangle', .10, 0], [554, .20, 'triangle', .10, .09]],
    bemol:         [[523, .09, 'triangle', .10, 0], [494, .20, 'triangle', .10, .09]],
    becuadro:      [[784, .06, 'sine', .09, 0], [523, .22, 'sine', .09, .07]],
  };

  function sound(effect) {
    if (window.MSfx && typeof MSfx.motif === 'function') MSfx.motif(MOTIFS[effect]);
  }

  /** true si una carta acaba de lanzar su propio sonido (evita solapar el genérico). */
  function justPlayed() { return Date.now() - lastAt < 400; }

  return { trigger, justPlayed, DEFS };
})();

window.MCardFx = MCardFx;
