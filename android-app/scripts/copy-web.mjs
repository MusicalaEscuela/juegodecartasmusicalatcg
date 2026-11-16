// Copia el juego web (carpeta raíz del repositorio) a android-app/www,
// que es lo que Capacitor mete dentro del APK. No copia assets-src/,
// docs/, .git/ ni esta carpeta.
// (Copia archivo por archivo: fs.cpSync falla en Windows dentro de OneDrive.)
import { readdirSync, statSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out  = join(here, '..', 'www');

const ITEMS = ['index.html', 'manifest.webmanifest', 'sw.js', 'logo.png', 'css', 'js', 'assets'];

function copy(src, dest) {
  if (statSync(src).isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const name of readdirSync(src)) {
      if (name === '.gitkeep') continue;
      copy(join(src, name), join(dest, name));
    }
  } else {
    writeFileSync(dest, readFileSync(src));
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of ITEMS) copy(join(root, item), join(out, item));
console.log(`Juego copiado a ${out}`);
