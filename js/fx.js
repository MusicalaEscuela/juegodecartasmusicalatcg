/* ===================================================
   MUSICALA – fx.js  (v2.1)
   Efectos de "sensación de juego": cartas que vuelan,
   reparto con volteo y vibración háptica.
   Es solo presentación: nunca toca el estado G ni las
   reglas. Si algo falla aquí, el juego sigue igual.
   Respeta prefers-reduced-motion y la velocidad elegida.
   =================================================== */

'use strict';

const MFx = (function () {
  const BACK_SRC = 'assets/backs/back-sm.webp';
  const reduceQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function reduced() { return reduceQuery.matches; }

  function speed() {
    return (window.MSettings && MSettings.speedFactor) ? MSettings.speedFactor() : 1;
  }

  function rectOf(target) {
    if (!target) return null;
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    return (r.width && r.height) ? r : null;
  }

  /**
   * Hace volar una carta "fantasma" de un rectángulo a otro.
   * opts: { src, duration, fade, spin }
   */
  function fly(fromRect, toRect, opts) {
    if (reduced() || !fromRect || !toRect) return;
    if (document.hidden || typeof document.body.animate !== 'function') return;
    opts = opts || {};

    const ghost = document.createElement('div');
    ghost.className = 'fx-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    // Tamaño de carta (proporción 0.7) centrado en el origen.
    const h = Math.max(70, Math.min(fromRect.height, 150));
    const w = h * 0.7;
    const x0 = fromRect.left + fromRect.width / 2 - w / 2;
    const y0 = fromRect.top + fromRect.height / 2 - h / 2;
    ghost.style.cssText = `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;`;

    const img = document.createElement('img');
    img.src = opts.src || BACK_SRC;
    img.alt = '';
    img.decoding = 'async';
    ghost.appendChild(img);
    document.body.appendChild(ghost);

    const dx = (toRect.left + toRect.width / 2) - (x0 + w / 2);
    const dy = (toRect.top + toRect.height / 2) - (y0 + h / 2);
    const scale = Math.max(0.35, Math.min(toRect.height / h, 1.6));
    const rot = opts.spin ? (dx > 0 ? 8 : -8) : 0;

    const anim = ghost.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 18}px) scale(${(1 + scale) / 2 + 0.06}) rotate(${rot}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`, opacity: opts.fade === false ? 1 : 0 },
    ], {
      duration: Math.round((opts.duration || 340) * speed()),
      easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      fill: 'forwards',
    });
    const done = () => ghost.remove();
    anim.onfinish = done;
    anim.oncancel = done;
    // Red de seguridad: nunca dejar fantasmas en el DOM.
    setTimeout(done, 1500);
  }

  /** Carta jugada: del origen a la carta central. */
  function playCard(fromRect, src) {
    fly(fromRect, rectOf('#active-note-card'), { src, spin: true });
  }

  /** Carta robada: del mazo al destino (mano u oponente), boca abajo. */
  function drawCard(toTarget) {
    fly(rectOf('#deck-pile'), rectOf(toTarget), { src: BACK_SRC, duration: 300 });
  }

  /** Slot de un oponente por índice de jugador. */
  function opponentSlot(playerIdx) {
    return document.querySelector(`.opponent-slot[data-player-idx="${playerIdx}"]`);
  }

  /** Reparto inicial: las cartas de la mano entran una a una y se voltean. */
  function dealHand() {
    const container = document.getElementById('hand-cards');
    if (!container || reduced()) return;
    const cards = container.querySelectorAll('.card');
    cards.forEach((c, i) => c.style.setProperty('--deal-i', i));
    container.classList.remove('dealing');
    void container.offsetWidth;
    container.classList.add('dealing');
    const total = Math.round((cards.length * 70 + 520) * speed());
    setTimeout(() => {
      container.classList.remove('dealing');
      cards.forEach(c => c.style.removeProperty('--deal-i'));
    }, total);
    if (window.MSfx) MSfx.play('deal', cards.length);
  }

  // ── Vibración háptica (opcional, solo donde el dispositivo la soporta) ──
  const HAPTICS = {
    tap:     8,
    play:    14,
    draw:    [8, 30, 8],
    special: [12, 40, 20],
    error:   [30, 40, 30],
    turn:    18,
    win:     [20, 60, 20, 60, 60],
  };

  function haptic(kind) {
    if (!navigator.vibrate) return;
    if (window.MSettings && MSettings.get('hapticsEnabled') === false) return;
    // El navegador bloquea (y registra un error) si aún no hubo un toque real.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(HAPTICS[kind] || 10); } catch (err) { /* sin soporte */ }
  }

  return { reduced, rectOf, fly, playCard, drawCard, opponentSlot, dealHand, haptic };
})();

window.MFx = MFx;
