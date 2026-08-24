#!/usr/bin/env node
/**
 * Fáze 0 pojistka: najde HTML on*-handlery (onclick, onchange, …), které volají
 * funkci bez definice. Rozumí i registraci přes helper def('name', fn) v
 * lexis-actions.js i nativním funkcím prohlížeče, aby nehlásil falešné poplachy.
 *
 * CLI:      node scripts/check-handlers.js   (exit 1 při nálezu — vhodné do prebuild/precommit)
 * V testu:  const { findBrokenHandlers } = require('../../scripts/check-handlers');
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KEYWORDS = new Set(['if','for','while','switch','return','event','window','document','lexisUI','this','function','true','false','new','typeof','void','delete']);
const NATIVE = new Set(['print','alert','confirm','prompt','open','close','focus','blur','scrollTo','requestAnimationFrame','setTimeout','setInterval','fetch']);

function collectDefs(src, set) {
  const patterns = [
    /window\.([A-Za-z_$][\w$]*)\s*=/g,
    /function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /def\(\s*['"]([A-Za-z_$][\w$]*)['"]/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
  ];
  for (const re of patterns) { let m; while ((m = re.exec(src))) set.add(m[1]); }
}
function walkJs(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/vendor|node_modules/.test(p)) walkJs(p, cb); }
    else if (e.name.endsWith('.js')) cb(fs.readFileSync(p, 'utf8'));
  }
}

/** Vrátí seřazené pole jmen handlerů bez definice (prázdné = vše OK). */
function findBrokenHandlers(root) {
  root = root || path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const called = new Set();
  { let m; const re = /on(?:click|change|input|submit|keyup|keydown|focus|blur)="\s*(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/g;
    while ((m = re.exec(html))) called.add(m[1]); }
  const defined = new Set([...KEYWORDS, ...NATIVE]);
  collectDefs(html, defined);
  walkJs(path.join(root, 'js'), (src) => collectDefs(src, defined));
  const methods = new Set();
  walkJs(path.join(root, 'js'), (src) => { let m; const rm = /^\s{4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm; while ((m = rm.exec(src))) methods.add(m[1]); });
  return { broken: [...called].filter((n) => !defined.has(n) && !methods.has(n)).sort(), checked: called.size };
}

module.exports = { findBrokenHandlers };

if (require.main === module) {
  const { broken, checked } = findBrokenHandlers();
  if (broken.length) {
    console.error('❌ Rozbité on*-handlery (volají nedefinovanou funkci):');
    for (const b of broken) console.error('   • ' + b + '()');
    console.error('\nZkontrolováno ' + checked + ' handlerů. Definuj chybějící funkce, nebo odeber/zakryj tlačítko.');
    process.exit(1);
  }
  console.log('✅ Všech ' + checked + ' on*-handlerů má definici.');
}
