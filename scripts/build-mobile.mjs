// build-mobile.mjs — sestaví webDir pro Capacitor: mobile/www
//   = index.html + css/ + js/ (+ čerstvý react-islands build)
// a v mobilní KOPII index.html uvolní CSP connect-src, aby appka mohla mluvit
// s desktopem na LAN IP (Ollama :11434 / LexisLocal hub :4000). Electroní
// index.html zůstává přísný — tady měníme jen kopii.
import { rmSync, mkdirSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'mobile/www';
const ASSETS = ['index.html', 'css', 'js'];

// 1) čerstvý React-island build (zapíše js/react-islands.js). Když selže, jedeme
//    s tím, co v js/ už je — ať scaffolding nespadne kvůli chybějícímu vite.
import { execSync } from 'node:child_process';
try {
  execSync('npm run build:react', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠ build:react selhal, používám existující js/react-islands.js');
}

// 2) čistý výstup
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 3) kopie aktiv
for (const p of ASSETS) {
  if (existsSync(p)) cpSync(p, `${OUT}/${p}`, { recursive: true });
  else console.warn(`⚠ chybí aktivum: ${p}`);
}

// 4) uvolni CSP connect-src v mobilní kopii (desktop na LAN má libovolnou IP:port)
const idx = `${OUT}/index.html`;
if (existsSync(idx)) {
  let html = readFileSync(idx, 'utf8');
  html = html.replace(/connect-src[^;]*;/i,
    "connect-src 'self' http://* https://* ws://* wss://* data: blob:;");
  writeFileSync(idx, html);
  console.log('✓ CSP connect-src uvolněno pro mobilní build');
}

console.log('✓ mobile/www hotovo — spusť `npx cap sync`');
