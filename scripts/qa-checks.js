#!/usr/bin/env node
/**
 * Předpilotní integritní kontroly (sdílené CLI + testy). Chytají „tiché" chyby,
 * co se projeví až za běhu: chybějící most v preloadu (třída 401), duplicitní id,
 * externí závislosti (offline riziko), IPC kanály bez handleru.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readAllJs = (root) => { const out = []; (function w(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()){ if(!/vendor|node_modules/.test(p)) w(p);} else if(e.name.endsWith('.js')) out.push(fs.readFileSync(p,'utf8')); } })(path.join(root,'js')); return out.join('\n'); };
// Odstraní JS komentáře (blokové i řádkové), ať se detekce nechytá na texty
// jako „electronAPI.xxx" uvnitř komentářů. Není string-aware, pro tyto skeny stačí;
// řádkové komentáře vynechá u "://" (URL).
function stripJsComments(s) {
  return String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// electronAPI.X voláno rendererem, ale nevystaveno v preloadu (guardované optional API v allowlistu).
const OPTIONAL_API = new Set(['saveFile']); // guardované + má fallback (viz saveDocument)
function findMissingElectronApi(root) {
  const preload = fs.readFileSync(path.join(root,'preload.js'),'utf8');
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const src = stripJsComments(readAllJs(root)) + '\n' + html;
  const exposed = new Set([...preload.matchAll(/(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*:/gm)].map(m=>m[1]));
  const used = new Set([...src.matchAll(/electronAPI\.([A-Za-z_$][\w$]*)/g)].map(m=>m[1]));
  return [...used].filter(x => !exposed.has(x) && !OPTIONAL_API.has(x)).sort();
}
// IPC kanály volané z preloadu bez ipcMain handleru v main.js
function findUnhandledIpc(root) {
  const preload = fs.readFileSync(path.join(root,'preload.js'),'utf8');
  const main = fs.readFileSync(path.join(root,'main.js'),'utf8');
  const inv = new Set([...preload.matchAll(/ipcRenderer\.(?:invoke|send|sendSync)\(\s*['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]));
  const handled = new Set([...main.matchAll(/ipcMain\.(?:handle|on)\(\s*['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]));
  return [...inv].filter(c => !handled.has(c)).sort();
}
// duplicitní id v index.html
function findDuplicateIds(root) {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const c = {}; for (const m of html.matchAll(/\sid="([^"]+)"/g)) c[m[1]] = (c[m[1]]||0)+1;
  return Object.entries(c).filter(([,v]) => v>1).map(([k,v]) => k+' ('+v+'×)').sort();
}
// externí <script>/<link> v index.html (local-first app má být offline)
function findExternalResources(root) {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  return [...new Set([...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m=>m[1]))].sort();
}
module.exports = { findMissingElectronApi, findUnhandledIpc, findDuplicateIds, findExternalResources };
// Typy doložek nabízené v menu (lexis-shell CLAUSES) musí existovat v mapě insertClause.
function findClauseMismatch(root) {
  const shell = fs.readFileSync(path.join(root,'js/core/lexis-shell.js'),'utf8');
  const ui = fs.readFileSync(path.join(root,'js/ui/lexis-ui-1.js'),'utf8');
  const cm = shell.match(/CLAUSES\s*=\s*\[([\s\S]*?)\]/);
  const menu = cm ? [...cm[1].matchAll(/\[\s*'([a-z_]+)'/g)].map(m=>m[1]) : [];
  const im = ui.match(/insertClause\(type\)\s*\{[\s\S]*?const clauses = \{([\s\S]*?)\};/);
  const map = new Set(im ? [...im[1].matchAll(/'([a-z_]+)'\s*:/g)].map(m=>m[1]) : []);
  return menu.filter(k => !map.has(k));
}
module.exports.findClauseMismatch = findClauseMismatch;


if (require.main === module) {
  const root = path.join(__dirname,'..');
  let fail = 0;
  const rep = (name, arr) => { if (arr.length) { fail++; console.error('❌ '+name+':\n   '+arr.join('\n   ')); } else console.log('✅ '+name); };
  rep('electronAPI most (preload)', findMissingElectronApi(root));
  rep('IPC kanály s handlerem', findUnhandledIpc(root));
  rep('žádné duplicitní id', findDuplicateIds(root));
  rep('žádné externí zdroje (offline)', findExternalResources(root));
  rep('doložky menu ⊆ insertClause', findClauseMismatch(root));
  process.exit(fail ? 1 : 0);
}
