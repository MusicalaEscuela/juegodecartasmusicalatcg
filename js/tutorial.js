/* ===================================================
   MUSICALA – tutorial.js
   Tutorial interactivo paso a paso para la primera
   partida. Se puede saltar y reabrir desde el botón
   de ayuda "?" o el menú. Guarda en localStorage si
   ya se vio (vía MSettings.tutorialSeen).
   =================================================== */

'use strict';

const MTutorial = (function () {
  let overlay = null;
  let stepIdx = 0;

  // Mini-escala reutilizable para los pasos visuales.
  const NOTE_COLORS_T = {
    DO: '#E53935', RE: '#E57C00', MI: '#C6A800', FA: '#1B8C3E',
    SOL: '#1565C0', LA: '#6A1B9A', SI: '#AD1457',
  };

  function scaleStrip(highlight) {
    const order = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];
    return `<div class="tut-scale">` + order.map((n, i) => {
      const arrow = i < order.length - 1 ? '<span class="tut-arrow">→</span>' : '';
      const hl = highlight && highlight.includes(n) ? ' tut-note-hl' : '';
      return `<span class="tut-note${hl}" style="background:${NOTE_COLORS_T[n]}">${n}</span>${arrow}`;
    }).join('') + `</div>`;
  }

  const STEPS = [
    {
      icon: '🎯',
      title: '¡Bienvenido a Musicala!',
      body: `El objetivo es muy simple: <strong>sé el primero en quedarte sin cartas</strong>.
             Cada jugador empieza con varias cartas y, por turnos, las va soltando sobre la mesa.`,
      visual: () => `<div class="tut-bigemoji">🃏 ➜ 🎉</div>`,
    },
    {
      icon: '🎵',
      title: 'La escala musical',
      body: `Las notas siguen el orden de la escala: <strong>DO · RE · MI · FA · SOL · LA · SI</strong>
             … y vuelve a empezar. Te conviene tenerlo presente para saber qué nota va antes y cuál después.`,
      visual: () => scaleStrip(),
    },
    {
      icon: '✅',
      title: '¿Qué carta puedes jugar?',
      body: `Sobre la nota en juego puedes poner:
             <ul class="tut-list">
               <li>La <strong>misma nota</strong></li>
               <li>La <strong>nota anterior</strong> en la escala</li>
               <li>La <strong>nota siguiente</strong> en la escala</li>
             </ul>
             Por ejemplo, sobre <strong>FA</strong> puedes jugar MI, FA o SOL.`,
      visual: () => scaleStrip(['MI', 'FA', 'SOL']),
    },
    {
      icon: '🎼',
      title: 'Jugar una escala',
      body: `Si tienes <strong>3 o más notas consecutivas</strong>, puedes soltarlas todas de un golpe.
             Toca las cartas para seleccionarlas (se elevan) y pulsa <strong>«Jugar escala»</strong>.
             ¡Es la forma más rápida de vaciar tu mano!`,
      visual: () => scaleStrip(['FA', 'SOL', 'LA']),
    },
    {
      icon: '⭐',
      title: 'Cartas especiales',
      body: `Algunas cartas cambian el rumbo de la partida: hacen robar cartas a otros, cambian el sentido
             del turno, intercambian manos o te dejan improvisar una nota. Cuando juegues una, verás un
             <strong>mensaje explicando su efecto</strong>. Toca el botón <strong>ⓘ</strong> de cada carta para leer qué hace.`,
      visual: () => `<div class="tut-special-row">
          <span class="tut-special-chip">🔄 Cambio de dirección</span>
          <span class="tut-special-chip">🃏 Roba el show</span>
          <span class="tut-special-chip">🎻 Rotación</span>
        </div>`,
    },
    {
      icon: '🃏',
      title: 'Si no puedes jugar…',
      body: `Cuando ninguna de tus cartas sirva, el <strong>mazo se ilumina</strong>.
             Toca el mazo para <strong>robar una carta</strong>. Si la robada sí se puede jugar, la juegas;
             si no, pasas el turno. ¡Tranquilo, es parte del juego!`,
      visual: () => `<div class="tut-bigemoji">🚫 ➜ 🃏 ➜ 👉</div>`,
    },
    {
      icon: '🎹',
      title: '¡Listo para tocar!',
      body: `Eso es todo lo básico. Puedes volver a ver este tutorial cuando quieras desde el botón
             <strong>«?»</strong> (abajo a la derecha) o el menú de opciones. ¡Que empiece la música!`,
      visual: () => `<div class="tut-bigemoji">🎶 🎉 🎶</div>`,
    },
  ];

  function build() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.id = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tut-title">
        <button class="tutorial-skip" id="tut-skip" type="button">Saltar ✕</button>
        <div class="tutorial-icon" id="tut-icon">🎯</div>
        <h2 class="tutorial-title" id="tut-title">Título</h2>
        <div class="tutorial-visual" id="tut-visual"></div>
        <p class="tutorial-body" id="tut-body">Texto</p>
        <div class="tutorial-dots" id="tut-dots"></div>
        <div class="tutorial-nav">
          <button class="btn-secondary" id="tut-prev" type="button">← Atrás</button>
          <button class="btn-primary" id="tut-next" type="button">Siguiente →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#tut-skip').addEventListener('click', close);
    overlay.querySelector('#tut-prev').addEventListener('click', prev);
    overlay.querySelector('#tut-next').addEventListener('click', next);
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });
  }

  function render() {
    const step = STEPS[stepIdx];
    overlay.querySelector('#tut-icon').textContent = step.icon;
    overlay.querySelector('#tut-title').innerHTML = step.title;
    overlay.querySelector('#tut-body').innerHTML = step.body;
    overlay.querySelector('#tut-visual').innerHTML = step.visual ? step.visual() : '';

    const dots = STEPS.map((_, i) =>
      `<span class="tut-dot${i === stepIdx ? ' active' : ''}"></span>`).join('');
    overlay.querySelector('#tut-dots').innerHTML = dots;

    const prevBtn = overlay.querySelector('#tut-prev');
    const nextBtn = overlay.querySelector('#tut-next');
    prevBtn.style.visibility = stepIdx === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = stepIdx === STEPS.length - 1 ? '¡Entendido! 🎵' : 'Siguiente →';
  }

  function next() {
    if (stepIdx < STEPS.length - 1) {
      stepIdx++;
      render();
    } else {
      close();
    }
  }

  function prev() {
    if (stepIdx > 0) {
      stepIdx--;
      render();
    }
  }

  function open(fromStep) {
    build();
    stepIdx = fromStep || 0;
    render();
    overlay.classList.add('open');
    // Marcar como visto en cuanto se abre, para no forzarlo de nuevo.
    if (window.MSettings) MSettings.set('tutorialSeen', true);
    const card = overlay.querySelector('.tutorial-card');
    if (card) card.setAttribute('tabindex', '-1'), card.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('open');
    if (window.MSettings) MSettings.set('tutorialSeen', true);
  }

  // Devuelve true si nunca se ha visto el tutorial.
  function shouldAutoShow() {
    return !(window.MSettings && MSettings.get('tutorialSeen'));
  }

  return { open, close, shouldAutoShow };
})();

window.MTutorial = MTutorial;
