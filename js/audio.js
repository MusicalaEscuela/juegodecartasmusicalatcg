(function () {
  'use strict';

  const STORAGE_KEY = 'musicala_bg_music_enabled';
  const DEFAULT_VOLUME = 0.25;

  let audioEl = null;
  let toggleBtn = null;
  let enabled = false;

  function readPreference() {
    try {
      const savedValue = localStorage.getItem(STORAGE_KEY);
      if (savedValue === null) return null;
      return savedValue === 'true';
    } catch (err) {
      return null;
    }
  }

  function savePreference(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch (err) {
      // localStorage can be unavailable in restrictive browser contexts.
    }
  }

  function ensureElements() {
    if (!audioEl) {
      audioEl = document.getElementById('bg-music');
      if (audioEl) {
        audioEl.volume = DEFAULT_VOLUME;
        audioEl.loop = true;
      }
    }

    if (!toggleBtn) {
      toggleBtn = document.getElementById('btn-audio-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleBackgroundMusic);
      }
    }

    return Boolean(audioEl);
  }

  function updateButton() {
    if (!toggleBtn) return;

    toggleBtn.textContent = enabled ? '🔊' : '🔇';
    toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    toggleBtn.classList.toggle('is-on', enabled);
  }

  function startBackgroundMusic(force) {
    const preference = readPreference();
    if (force !== true && preference === false) {
      enabled = false;
      ensureElements();
      if (audioEl) audioEl.pause();
      updateButton();
      return;
    }

    enabled = true;
    savePreference(true);
    ensureElements();
    updateButton();

    if (!audioEl) return;

    audioEl.volume = DEFAULT_VOLUME;
    audioEl.loop = true;

    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        updateButton();
      });
    }
  }

  function pauseBackgroundMusic() {
    enabled = false;
    savePreference(false);
    ensureElements();

    if (audioEl) {
      audioEl.pause();
    }

    updateButton();
  }

  function toggleBackgroundMusic() {
    ensureElements();

    if (enabled && audioEl && !audioEl.paused) {
      pauseBackgroundMusic();
      return;
    }

    startBackgroundMusic(true);
  }

  function initBackgroundMusic() {
    enabled = readPreference() === true;
    ensureElements();
    updateButton();
  }

  window.startBackgroundMusic = startBackgroundMusic;
  window.pauseBackgroundMusic = pauseBackgroundMusic;
  window.toggleBackgroundMusic = toggleBackgroundMusic;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackgroundMusic, { once: true });
  } else {
    initBackgroundMusic();
  }
})();
