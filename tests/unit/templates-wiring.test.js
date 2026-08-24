/**
 * Fáze 0: zamyká propojení tlačítek šablon na úvodní obrazovce s reálnými
 * klíči v defaultTemplates (main.js) a vystavení IPC v preloadu. Dřív tlačítka
 * posílala 'blank' a preload getTemplateContent nevystavoval — obojí rozbité.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');

// klíče, na které míří tlačítka šablon (start-tpl)
const tplKeys = [...html.matchAll(/class="start-tpl"[^>]*openStartDocument\('([a-zA-Z]+)'\)/g)].map(m => m[1]);
// klíče definované v defaultTemplates
const defKeys = new Set([...main.matchAll(/"([a-zA-Z]+)":\s*\{\s*\n?\s*"title"/g)].map(m => m[1]));

describe('propojení šablon na úvodce', () => {
  test('existují 4 tlačítka šablon, žádné nemíří na prázdný dokument', () => {
    expect(tplKeys.length).toBe(4);
    expect(tplKeys).not.toContain('blank');
  });

  test('každé tlačítko šablony míří na klíč existující v defaultTemplates', () => {
    for (const k of tplKeys) {
      expect(defKeys.has(k)).toBe(true);
    }
  });

  test('preload vystavuje getTemplateContent (jinak by renderer handler nezavolal)', () => {
    expect(preload).toMatch(/getTemplateContent:\s*\([^)]*\)\s*=>\s*ipcRenderer\.invoke\('get-template-content'/);
  });
});
