// Široký funkční smoke: zavolá řadu funkcí lexisUI/globálů se stub electronAPI
// a hlídá výjimky + neodchycené page errors. Cíl: „projde většina funkcí bez pádu".
const { test, expect } = require('@playwright/test');
const path = require('path');

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
  // Utlum modální alerty/prompty, ať smoke neuvízne
  window.__origAlert = null;
}

test('funkční smoke: řada funkcí lexisUI proběhne bez výjimky', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript(installElectronStub);
  await page.goto('file://' + path.resolve(__dirname, '..', '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.lexisUI && typeof window.lexisUI === 'object', { timeout: 8000 });
  await page.waitForTimeout(800);

  const results = await page.evaluate(async () => {
    const ui = window.lexisUI;
    // Utlum blokující dialogy
    try { ui.customAlert = () => {}; ui.customPrompt = (_m,_d,cb)=>{ if(cb) cb(null); }; ui.customConfirm = (_m,cb)=>{ if(cb) cb(false); }; } catch(e){}
    // otevři prázdný dokument, ať editor existuje
    try { if (ui.openStartDocument) ui.openStartDocument('blank'); } catch(e){}

    // Curated bezpečný seznam (bez native pickerů/exportů/tisku/mazání)
    const calls = [
      ['updateStats', () => ui.updateStats && ui.updateStats()],
      ['updateDocumentOutline', () => ui.updateDocumentOutline && ui.updateDocumentOutline()],
      ['insertDate', () => ui.insertDate && ui.insertDate()],
      ['insertPageNumber', () => ui.insertPageNumber && ui.insertPageNumber()],
      ['insertTOC', () => ui.insertTOC && ui.insertTOC()],
      ['insertTitlePage', () => ui.insertTitlePage && ui.insertTitlePage()],
      ['insertBookmark', () => ui.insertBookmark && ui.insertBookmark()],
      ['insertSignatureBlock', () => ui.insertSignatureBlock && ui.insertSignatureBlock()],
      ['insertParagraph', () => ui.insertParagraph && ui.insertParagraph()],
      ['insertArticle', () => ui.insertArticle && ui.insertArticle()],
      ['insertSectionSign', () => ui.insertSectionSign && ui.insertSectionSign()],
      ['setLineHeight', () => ui.setLineHeight && ui.setLineHeight('1.5')],
      ['applyStyle', () => ui.applyStyle && ui.applyStyle('p')],
      ['setColumns', () => ui.setColumns && ui.setColumns(1)],
      ['setMargins', () => ui.setMargins && ui.setMargins('normal')],
      ['setOrientation', () => ui.setOrientation && ui.setOrientation('portrait')],
      ['editHeader', () => ui.editHeader && ui.editHeader()],
      ['closeHFModal(header)', () => ui.closeHFModal && ui.closeHFModal()],
      ['editFooter', () => ui.editFooter && ui.editFooter()],
      ['switchHFTab(templates)', () => ui.switchHFTab && ui.switchHFTab('templates')],
      ['applyHFTemplate(firma)', () => ui.applyHFTemplate && ui.applyHFTemplate('firma')],
      ['applyHFTemplate(advokatura)', () => ui.applyHFTemplate && ui.applyHFTemplate('advokatura')],
      ['applyHFTemplate(soud)', () => ui.applyHFTemplate && ui.applyHFTemplate('soud')],
      ['updateHFPreview', () => ui.updateHFPreview && ui.updateHFPreview()],
      ['insertFirmLogo', () => ui.insertFirmLogo && ui.insertFirmLogo('left')],
      ['closeHFModal(2)', () => ui.closeHFModal && ui.closeHFModal()],
      ['insertLetterhead', () => ui.insertLetterhead && ui.insertLetterhead()],
      ['setViewMode(print)', () => ui.setViewMode && ui.setViewMode('print')],
      ['setViewMode(reading)', () => ui.setViewMode && ui.setViewMode('reading')],
      ['setViewMode(web)', () => ui.setViewMode && ui.setViewMode('web')],
      ['setViewMode(off)', () => ui.setViewMode && ui.setViewMode('print')],
      ['switchTab(home)', () => ui.switchTab && ui.switchTab('home')],
      ['toggleAIDrawer', () => ui.toggleAIDrawer && ui.toggleAIDrawer()],
      ['toggleAIDrawer(2)', () => ui.toggleAIDrawer && ui.toggleAIDrawer()],
      ['showFindReplace', () => ui.showFindReplace && ui.showFindReplace()],
      ['readLawyerProfile', () => ui.readLawyerProfile && ui.readLawyerProfile()],
      ['loadLetterheadProfile', () => ui.loadLetterheadProfile && ui.loadLetterheadProfile()],
      ['resetHeaderFooterDOM', () => ui.resetHeaderFooterDOM && ui.resetHeaderFooterDOM()],
      ['scanForVariables', () => ui.scanForVariables && ui.scanForVariables()],
      ['formatLegal', () => ui.formatLegal && ui.formatLegal()],
    ];
    const out = [];
    for (const [name, fn] of calls) {
      try { const r = fn(); if (r && typeof r.then === 'function') await r; out.push({ name, ok: true }); }
      catch (e) { out.push({ name, ok: false, err: String(e && e.message || e).slice(0,120) }); }
      await new Promise(r => setTimeout(r, 15));
    }
    return out;
  });

  const failed = results.filter(r => !r.ok);
  console.log('CALLED', results.length, 'functions; FAILED', failed.length);
  failed.forEach(f => console.log('  ✗', f.name, '→', f.err));
  results.filter(r=>r.ok).forEach(f => console.log('  ✓', f.name));
  console.log('PAGE ERRORS during run:', pageErrors.length);
  pageErrors.slice(0,10).forEach(e => console.log('  !', e));

  // Tvrzení: žádná volaná funkce nesmí vyhodit výjimku, žádné neodchycené chyby.
  expect(failed.map(f=>f.name+': '+f.err)).toEqual([]);
  expect(pageErrors).toEqual([]);
});
