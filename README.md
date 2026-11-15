# juegodecartasmusicalatcg
Juego de cartas Musicala TCG

## Probar en local

Es un sitio estático, sin paso de compilación. Sirve la carpeta con cualquier servidor HTTP:

```bash
python -m http.server 8753
```

y abre `http://localhost:8753`. (Abrir `index.html` con doble clic no sirve: el service
worker y los módulos de Firebase necesitan HTTP.)

## Estructura

```
index.html              Marcado de todas las pantallas (sin CSS/JS incrustado)
manifest.webmanifest    Datos de la app instalable (PWA)
sw.js                   Service worker: soporte sin conexión
css/
  tokens.css            Escalas de diseño: espaciado, tipografía, táctil, movimiento
  style.css             Estilos base y colores de marca
  card.css              Cartas
  animations.css        Animaciones base
  enhancements.css      Tutorial, opciones, biblioteca
  game-events.css       Avisos de jugadas y banner de turno
  card-menu.css         Hoja de acciones de carta
  layout.css            Mesa mobile-first, zonas táctiles
  motion.css            Transiciones, reparto, cartas en vuelo
  a11y.css              Foco, contraste, tamaños mínimos
js/
  boot.js               Pantalla de carga, precarga, registro del service worker
  settings.js           Preferencias (localStorage)
  sfx.js                Efectos de sonido (Web Audio)
  fx.js                 Animaciones de cartas y vibración
  cards.js              Definición de cartas y validación de jugadas
  game.js               Reglas y CPU
  ui.js                 Renderizado e interacción
  persist.js            Guardado automático de la partida local
  tutorial.js           Tutorial
  firebase.js           Carga de Firebase y salas
  online.js             Modo en línea
  game-events.js        Avisos visuales de jugadas
  audio.js              Música de fondo
  main.js               Arranque y eventos
assets/                 Lo que carga la app (WebP, iconos, audio comprimido)
assets-src/             Originales (PNG 1414×2000, MP3 original). No se publican.
docs/EMPAQUETADO-ANDROID.md   Pasos para Play Store (Capacitor / TWA)
```

## Regenerar imágenes

Si cambias una carta en `assets-src/cards/`, vuelve a generar sus dos tamaños con ffmpeg:

```bash
ffmpeg -y -i assets-src/cards/NOMBRE.png -vf scale=640:-2:flags=lanczos -c:v libwebp -quality 80 assets/cards/NOMBRE.webp
```

```bash
ffmpeg -y -i assets-src/cards/NOMBRE.png -vf scale=260:-2:flags=lanczos -c:v libwebp -quality 78 assets/cards/sm/NOMBRE.webp
```

Después sube `CACHE_VERSION` en `sw.js` para que los dispositivos descarguen la imagen nueva.

## Pendiente

- **Cancelar una elección:** cerrar el diálogo de "elige un jugador" o de Nota de Paso deja
  la carta gastada sin efecto y el turno sin avanzar.
- **Contraste de las píldoras de nota** (texto blanco sobre RE y MI): cambiarlo toca los
  colores de marca de las notas.
- **Reglas de Firestore:** abiertas a cualquier usuario con sesión.
- **Modo en línea:** los cambios de manejo de errores y "Volver a la sala" no se han probado
  con una partida real (requiere iniciar sesión con Google y dos jugadores).
