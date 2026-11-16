# Empaquetar Musicala para Android (Play Store)

Estado: **el juego ya es una PWA instalable y funciona sin conexión**, pero todavía no está
empaquetado. Este documento explica las dos rutas posibles y lo que hay que resolver antes.

> Las versiones de herramientas y las políticas de Google Play cambian. Antes de empezar,
> confirma los comandos en la documentación oficial de Capacitor / Bubblewrap y los requisitos
> vigentes en Play Console.

## 0. APK de prueba (ya configurado)

El proyecto ya tiene Capacitor en `android-app/` y genera un APK de prueba (sin firmar para
Play Store, solo para instalar en teléfonos). Requisitos: Node.js, el SDK de Android de
Android Studio y **JDK 21** (el JDK que trae Android Studio es más nuevo y Gradle lo rechaza).

```bash
cd android-app
```

```bash
npm install
```

```bash
npm run sync
```

Luego abre `android-app/android` en Android Studio y usa *Build → Build APK(s)*, o desde la
terminal con `JAVA_HOME` apuntando al JDK 21: `cd android && gradlew.bat assembleDebug`.
El APK queda en `android-app/android/app/build/outputs/apk/debug/app-debug.apk`.

Notas de esta versión:
- `npm run sync` copia el juego (raíz del repositorio) a `android-app/www` y lo pasa al
  proyecto Android. Hay que repetirlo cada vez que cambie el juego.
- La ruta del proyecto tiene una tilde ("Programación"); por eso
  `android-app/android/gradle.properties` incluye `android.overridePathCheck=true`.
- Dentro de la app el modo en línea muestra un aviso: el inicio de sesión con Google
  necesita un plugin nativo (sección 4.3).
- El botón Atrás de Android cierra la app; la partida local se guarda y se puede continuar.
- Para la Play Store hace falta un `.aab` firmado (*Build → Generate Signed Bundle*).

## 1. Qué ruta elegir

| | **TWA (Trusted Web Activity)** | **Capacitor** |
|---|---|---|
| Qué es | La app abre tu web publicada, a pantalla completa, usando Chrome | La app lleva los archivos dentro y los muestra en un WebView |
| Necesita hosting HTTPS | **Sí** (obligatorio) | No |
| Inicio de sesión con Google (modo en línea) | **Funciona tal cual** | **Hay que cambiarlo** (ver 4.3) |
| Actualizar el juego | Publicas la web y listo | Hay que subir una versión nueva a Play |
| Funciona sin conexión | Sí, tras la primera apertura (service worker) | Sí, siempre |
| Acceso a funciones nativas | Limitado | Completo (plugins) |
| Trabajo extra | Bajo | Medio |

**Recomendación:** TWA. El juego ya cumple los requisitos de PWA y el login con Google sigue
funcionando sin tocar código. Capacitor solo compensa si quieres que funcione sin conexión
desde el primer segundo o necesitas funciones nativas.

## 2. Antes de empaquetar (común a las dos rutas)

1. **Reglas de Firestore.** Hoy cualquier usuario con sesión puede leer y escribir cualquier
   sala y cualquier mano (`firestore.rules`). Para una app pública conviene restringir la
   escritura a los jugadores de la sala. No se han tocado.
2. **Decisiones de juego pendientes** (ver README, sección "Pendiente").
3. **Subir `CACHE_VERSION` en `sw.js`** cada vez que publiques cambios, para que los
   dispositivos descarguen los archivos nuevos.
4. **Material para la ficha de Play:**
   - Icono de 512×512 (hay uno en `assets/icons/icon-512.png`; se generó ampliando
     `logo.png` de 500 px, así que conviene rehacerlo desde el logo vectorial).
   - Gráfico destacado de 1024×500.
   - Mínimo 2 capturas de teléfono.
   - Descripción corta y larga.
   - **Política de privacidad** en una URL pública (obligatoria: el juego usa inicio de
     sesión con Google y guarda nombre y foto del jugador en la sala).
   - Formulario de seguridad de los datos y clasificación de contenido.
5. **Cuenta de desarrollador de Google Play** (pago único). Las cuentas personales nuevas
   suelen tener que pasar una prueba cerrada con testers antes de publicar en producción;
   revisa el requisito vigente en Play Console.

## 3. Ruta A — TWA con Bubblewrap

### 3.1 Publicar la web
Sube el contenido del proyecto a un hosting HTTPS (Firebase Hosting encaja, ya usas Firebase).
**No subas `assets-src/`** (82 MB de originales): en Firebase Hosting, añádela a `ignore` en
`firebase.json`.

Comprueba en Chrome (DevTools → Application) que el manifest y el service worker no dan
errores y que aparece la opción "Instalar".

### 3.2 Generar el proyecto Android
Requisitos: Node.js y JDK 17 (Bubblewrap puede descargar el JDK y el SDK de Android).

```bash
npm i -g @bubblewrap/cli
```

```bash
bubblewrap init --manifest https://TU-DOMINIO/manifest.webmanifest
```

Te preguntará el identificador de la app (por ejemplo `com.musicala.cartas`), el nombre,
los colores y creará una clave de firma. **Guarda el archivo de la clave y sus contraseñas:
sin ellos no podrás actualizar la app.**

```bash
bubblewrap build
```

Esto produce `app-release-bundle.aab` (para Play) y un `.apk` para probar en tu teléfono.

### 3.3 Vincular la web con la app (Digital Asset Links)
Para que no aparezca la barra de direcciones, la web debe declarar que confía en la app.
Bubblewrap genera `assetlinks.json`; publícalo en:

```
https://TU-DOMINIO/.well-known/assetlinks.json
```

Si usas la firma de apps de Google Play (lo habitual), añade también la huella SHA-256 que
muestra Play Console en *Integridad de la app*.

### 3.4 Subir a Play Console
Crea la app, sube el `.aab` a una prueba interna, instala desde el enlace de prueba y revisa:
pantalla completa sin barra de direcciones, inicio de sesión con Google, partida sin conexión.

## 4. Ruta B — Capacitor

### 4.1 Preparar la carpeta web
Capacitor copia una carpeta entera dentro de la app. La raíz del proyecto incluye
`assets-src/` y `.git/`, así que hay que copiar solo lo necesario a `www/`:

```
index.html, manifest.webmanifest, sw.js, logo.png, css/, js/, assets/
```

### 4.2 Crear el proyecto
Requisitos: Node.js, Android Studio y JDK 17.

```bash
npm init -y
```

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
```

```bash
npx cap init Musicala com.musicala.cartas --web-dir www
```

```bash
npx cap add android
```

Cada vez que cambie el juego:

```bash
npx cap sync android
```

```bash
npx cap open android
```

En Android Studio: *Build → Generate Signed Bundle* para obtener el `.aab`.

### 4.3 Cambios de código necesarios
- **Inicio de sesión con Google:** `signInWithPopup` (en `js/online.js`) no funciona dentro
  de un WebView. Hay que usar un plugin de inicio de sesión nativo (por ejemplo
  `@capacitor-firebase/authentication`), obtener el token de Google y pasarlo a Firebase con
  `signInWithCredential`. También hay que registrar la huella SHA-1 de la app en la consola
  de Firebase.
- **Orientación:** fijarla en `android/app/src/main/AndroidManifest.xml`
  (`android:screenOrientation="portrait"`); el `manifest.webmanifest` no se aplica aquí.
- **Icono y splash nativos:** generarlos con `@capacitor/assets` a partir de un icono de
  1024×1024 y una imagen de splash de 2732×2732.
- **Botón Atrás de Android:** conviene que cierre el diálogo abierto o pregunte antes de
  salir de una partida (`@capacitor/app`, evento `backButton`).
- **Vibración:** `navigator.vibrate` funciona en el WebView de Android; no hace falta plugin.

## 5. Qué ya está listo en el proyecto

- `manifest.webmanifest`: nombre, colores, `display: standalone`, `orientation: portrait`,
  iconos de 48 a 512 px y versiones *maskable*.
- `sw.js`: interfaz, cartas y música disponibles sin conexión.
- Pantalla de carga con progreso (`js/boot.js`) y `theme-color`.
- Zonas seguras (notch y barra de gestos) con `viewport-fit=cover`.
- Zonas táctiles de 44 px y diseño vertical para teléfono.
- La partida local se guarda sola y se puede continuar si Android cierra la app.

## 6. Pendiente de decidir

- **Orientación:** está fijada en vertical. Si quieres permitir horizontal en tabletas,
  cambia `"orientation"` a `"any"` en `manifest.webmanifest`.
- **Splash en iOS:** no se han generado imágenes `apple-touch-startup-image` (solo aplica si
  algún día se instala como PWA en iPhone/iPad).
- **Fuentes:** se cargan de Google Fonts y quedan en caché tras la primera visita. Para que
  funcionen sin conexión desde el primer arranque (necesario en Capacitor), descarga los
  archivos `.woff2` de Nunito y Fredoka One a `assets/fonts/` y decláralos con `@font-face`.
