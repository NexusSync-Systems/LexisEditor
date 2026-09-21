// tests/e2e/context-menu.spec.js
// E2E pro nové funkce editoru: kontextové menu (parita + „jen text"),
// uživatelské vlastní položky a přepínač stylů vložení.
// Stejně jako smoke.spec.js běží přes file://index.html v Chromiu se stubem
// electronAPI (nespouští celý Electron). Spuštění: npm run test:e2e
const { test, expect } = require('@playwright/test');
const path = require('path');

// --- stub electronAPI (shodný se smoke.spec.js) ---
function installElectronStub() {
  const def = (name) => {
    if (/^on[A-Z]/.test(name)) return () => () => {};
    const map = {
      getAppVersion: '0.0.0-test',
      lockGetConfig: { enabled: false, touchIdEnabled: false, hasPassword: false, method: 'password' },
      lockTouchIdAvailable: { available: false, biometricName: 'Touch ID' },
      getTemplates: [], getTemplateContent: '',
      getAIConfig: { provider: 'lexislocal', models: [] },
      getIsdsConfig: {}, licenseEdition: 'Free', lexisLocalToken: null,
    };
    return () => Promise.resolve(name in map ? map[name] : {});
  };
  window.electronAPI = new Proxy({}, { get: (_t, prop) => (typeof prop === 'string' ? def(prop) : undefined) });
}

async function boot(page) {
  await page.addInitScript(installElectronStub);
  await page.goto('file://' + path.resolve(__dirname, '..', '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  // Quill i UI musí být připravené.
  await page.waitForFunction(() => window.lexisCore && window.lexisCore.quill && window.lexisUI, null, { timeout: 8000 });
}

function openContextMenu(page) {
  return page.evaluate(() => {
    const ed = document.querySelector('.ql-editor');
    ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 120 }));
    const menu = document.getElementById('editor-context-menu');
    return {
      visible: menu && menu.style.display === 'block',
      text: menu ? menu.innerText : ''
    };
  });
}

test('kontextové menu: nové položky (parita + jen text + správce) jsou přítomné', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);

  const menu = await openContextMenu(page);
  expect(menu.visible).toBe(true);
  expect(menu.text).toContain('Vložit jako čistý text');
  expect(menu.text).toContain('Vložit odkaz');
  expect(menu.text).toContain('Přeložit výběr');
  expect(menu.text).toContain('Upravit vlastní položky');
  expect(errors, 'page errors: ' + errors.join(' | ')).toEqual([]);
});

test('vlastní položky: zobrazí se v menu a vloží text na kurzor', async ({ page }) => {
  await boot(page);

  const inserted = await page.evaluate(() => {
    // nastav jednu vlastní položku a otevři menu
    window.lexisUI._customMenuItems = window.LexisCustomMenu.normalizeItems([
      { label: 'TESTITEM', type: 'insertText', value: 'TESTSNIPPET' }
    ]);
    const q = window.lexisCore.quill;
    q.setText('start\n');
    q.setSelection(5, 0); // za slovo „start"
    const ed = document.querySelector('.ql-editor');
    ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 120 }));

    const menu = document.getElementById('editor-context-menu');
    const item = Array.from(menu.querySelectorAll('.lexis-custom-item'))
      .find(el => el.textContent.includes('TESTITEM'));
    if (!item) return { found: false };
    item.click();
    return { found: true, text: q.getText() };
  });

  expect(inserted.found).toBe(true);
  expect(inserted.text).toContain('TESTSNIPPET');
});

test('přepínač stylů vložení: panel se třemi volbami + „Jen text" funguje', async ({ page }) => {
  await boot(page);

  const res = await page.evaluate(() => {
    const q = window.lexisCore.quill;
    q.setText('\n');
    const at = 0;
    const before = q.getLength();
    q.clipboard.dangerouslyPasteHTML(at, '<b>BOLDPASTE</b>', 'user');
    const insertedLen = q.getLength() - before;

    const ctrl = window.LexisPasteStyles.createController(q);
    ctrl.show(at, insertedLen, '<b>BOLDPASTE</b>', 'BOLDPASTE');

    const panel = document.querySelector('.lexis-paste-options');
    const btns = panel ? Array.from(panel.querySelectorAll('button')).map(b => b.textContent) : [];

    // klikni „Jen text" (3. tlačítko)
    let plainOk = null;
    if (panel && panel.querySelectorAll('button')[2]) {
      panel.querySelectorAll('button')[2].click();
      plainOk = q.getText().includes('BOLDPASTE');
    }
    return { panel: !!panel, btns, plainOk };
  });

  expect(res.panel).toBe(true);
  expect(res.btns).toEqual(['Zdroj', 'Sloučit', 'Jen text']);
  expect(res.plainOk).toBe(true);
});
