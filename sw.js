/* ===================================================
   MUSICALA – sw.js  (service worker, v2.1)
   Soporte sin conexión para el juego local.

   Estrategias:
   - HTML / CSS / JS propios  → red primero, caché si no hay red
     (siempre se ve la última versión cuando hay conexión).
   - Imágenes, iconos y audio → caché primero (no cambian).
   - Fuentes de Google y SDK de Firebase → caché con
     actualización en segundo plano.
   - Firestore / Auth          → nunca se interceptan.

   Al publicar una versión nueva, sube CACHE_VERSION.
   =================================================== */

const CACHE_VERSION = 'v2.1.0';
const SHELL_CACHE   = `musicala-shell-${CACHE_VERSION}`;
const ASSET_CACHE   = `musicala-assets-${CACHE_VERSION}`;
const RUNTIME_CACHE = `musicala-runtime-${CACHE_VERSION}`;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'logo.png',
  'css/tokens.css', 'css/style.css', 'css/card.css', 'css/animations.css',
  'css/enhancements.css', 'css/game-events.css', 'css/card-menu.css',
  'css/layout.css', 'css/motion.css', 'css/a11y.css',
  'js/boot.js', 'js/settings.js', 'js/sfx.js', 'js/fx.js', 'js/cards.js', 'js/game.js',
  'js/ui.js', 'js/persist.js', 'js/tutorial.js', 'js/firebase.js', 'js/online.js',
  'js/game-events.js', 'js/audio.js', 'js/main.js',
];

const CARD_NAMES = [
  'nota_do', 'nota_re', 'nota_mi', 'nota_fa', 'nota_sol', 'nota_la', 'nota_si',
  'carta_sostenido', 'carta_bemol', 'carta_becuadro',
  'carta_roba_show', 'carta_silencio', 'carta_nota_fantasma', 'carta_improvisacion',
  'carta_ensayo', 'carta_partitura', 'carta_nota_paso', 'carta_rotacion',
  'carta_cambio_notas', 'carta_barra_rep', 'carta_cambio_dir', 'carta_desafinacion',
];

const ASSETS = [
  'assets/backs/back-sm.webp',
  'assets/backs/back.webp',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  ...CARD_NAMES.map(n => `assets/cards/sm/${n}.webp`),
  ...CARD_NAMES.map(n => `assets/cards/${n}.webp`),
  'assets/audio/musicala_bg_loop.mp3',
];

// ── Instalación: la interfaz es obligatoria; las cartas y el audio se
//    guardan después, sin bloquear ni hacer fallar la instalación. ──
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    const assets = await caches.open(ASSET_CACHE);
    await Promise.allSettled(ASSETS.map(u => assets.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('musicala-') && !keep.has(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// ── Utilidades ──

async function fromCache(request) {
  // ignoreSearch: los archivos se piden con ?v=… pero se guardan sin él.
  return caches.match(request, { ignoreSearch: true });
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await fromCache(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await fromCache(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && (fresh.ok || fresh.type === 'opaque')) {
    const cache = await caches.open(cacheName);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const update = fetch(request).then((fresh) => {
    if (fresh && (fresh.ok || fresh.type === 'opaque')) cache.put(request, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached || (await update) || Response.error();
}

// El elemento <audio> pide rangos de bytes; desde la caché hay que responder 206.
async function rangeFromCache(request) {
  const cached = await fromCache(new Request(request.url));
  if (!cached) return fetch(request);
  const header = request.headers.get('range') || '';
  const match = /bytes=(\d*)-(\d*)/.exec(header);
  const buffer = await cached.arrayBuffer();
  const size = buffer.byteLength;
  let start = match && match[1] ? parseInt(match[1], 10) : 0;
  let end   = match && match[2] ? parseInt(match[2], 10) : size - 1;
  if (match && !match[1] && match[2]) { start = size - parseInt(match[2], 10); end = size - 1; }
  start = Math.max(0, Math.min(start, size - 1));
  end   = Math.max(start, Math.min(end, size - 1));
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

// ── Peticiones ──
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Recursos propios
  if (url.origin === self.location.origin) {
    if (request.headers.has('range')) {
      event.respondWith(rangeFromCache(request));
      return;
    }
    const isStatic = /\.(?:webp|png|jpg|jpeg|svg|mp3|ogg|woff2?)$/i.test(url.pathname);
    event.respondWith(isStatic ? cacheFirst(request, ASSET_CACHE) : networkFirst(request));
    return;
  }

  // Fuentes de Google y módulos del SDK de Firebase (URL versionadas)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
      || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Todo lo demás (Firestore, Auth, Google): directo a la red.
});
