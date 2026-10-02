/**
 * Koncepty z LexisLocalu v editoru (js/ui/lexis-ll-drafts.js): seznam, otevření přes
 * editor-spec, uložení zpět jako nová verze, souběh (409) → samostatný koncept, ochrana
 * proti uložení jiného dokumentu, escapování dat ze serveru.
 */
const fs = require('fs');
const path = require('path');

let api;
beforeAll(() => {
    global.LexisUI = function () {};
    LexisUI.prototype.fetchInbox = async function () { this.inboxCalled = true; };
    window.LexisUI = global.LexisUI;
    window.escapeHTML = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const src = fs.readFileSync(path.join(__dirname, '../../js/ui/lexis-ll-drafts.js'), 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('LexisUI', 'module', src)(global.LexisUI, undefined);
});

function setup(routes) {
    document.body.innerHTML = '<div id="start-screen"></div><div id="app-container" style="display:none"></div>' +
        '<div id="ll-drafts-head" style="display:none"><span class="sub">sdílené v LexisLocalu</span></div><div id="ll-drafts-section" style="display:none"><div id="ll-drafts-list"></div></div>';
    const calls = [];
    global.fetch = jest.fn(async (url, opts) => {
        calls.push({ url, opts });
        const key = (opts && opts.method || 'GET') + ' ' + url.replace('http://ll', '');
        const h = routes[key];
        if (!h) return { ok: false, status: 404, json: async () => ({ error: 'nenalezeno' }) };
        const [status, body] = typeof h === 'function' ? h(opts) : h;
        return { ok: status < 300, status, json: async () => body };
    });
    const ui = new LexisUI();
    ui.getLexisLocalConnection = () => ({ baseUrl: 'http://ll', headers: { 'X-API-Token': 't' } });
    ui.alerts = []; ui.customAlert = (m) => ui.alerts.push(m);
    ui.saveActiveDocumentState = async () => {};
    window.applied = null;
    window.applyDocumentSpec = (s) => { window.applied = s; };
    window.getDocumentSpec = () => ({ blocks: [{ type: 'paragraph', text: 'Upraveno v editoru' }] });
    return { ui, calls };
}
afterEach(() => { const b = document.getElementById('ll-draft-bar'); if (b) b.remove(); });

test('úvodní obrazovka: seznam konceptů, data escapovaná; fetchInbox načte i koncepty', async () => {
    const { ui } = setup({ 'GET /api/drafts': [200, { drafts: [{ id: 'drf_1', title: '<img src=x onerror=alert(1)>', status: 'ke_kontrole', version: 2, aiGenerated: true, openComments: 1, preview: 'Text' }] }] });
    await ui.fetchInbox();
    expect(ui.inboxCalled).toBe(true);
    const list = document.getElementById('ll-drafts-list');
    expect(list.querySelectorAll('img').length).toBe(0);
    expect(list.textContent).toContain('<img src=x');
    expect(list.textContent).toContain('Ke kontrole');
    expect(list.textContent).toContain('🤖 AI');
    expect(document.getElementById('ll-drafts-section').style.display).toBe('block');
});

test('LexisLocal nedostupný → sekce skrytá', async () => {
    const { ui } = setup({});
    global.fetch = jest.fn(async () => { throw new Error('offline'); });
    await ui.fetchLLDrafts();
    expect(document.getElementById('ll-drafts-section').style.display).toBe('none');
});

test('otevření a uložení zpět jako nová verze (baseVersion)', async () => {
    const { ui, calls } = setup({
        'GET /api/drafts/drf_1/editor-spec': [200, { id: 'drf_1', version: 3, status: 'ke_kontrole', lexisSpec: { title: 'Žaloba', blocks: [{ type: 'paragraph', text: 'A' }] } }],
        'PUT /api/drafts/drf_1': [200, { version: 4, status: 'ke_kontrole' }]
    });
    await ui.openLLDraft('drf_1');
    expect(window.applied.title).toBeUndefined(); // název se nevykresluje do textu (jinak zdvojený titulek)
    expect(ui.currentDocumentTitle).toBe('Žaloba');
    expect(document.getElementById('ll-draft-bar').textContent).toContain('v3');
    await ui.saveToLLDraft();
    const put = calls.find(c => c.opts && c.opts.method === 'PUT');
    expect(JSON.parse(put.opts.body)).toMatchObject({ baseVersion: 3, spec: { blocks: [{ text: 'Upraveno v editoru' }] } });
    expect(put.opts.headers['X-API-Token']).toBe('t');
    expect(ui.llDraftLink.version).toBe(4);
    expect(ui.alerts.pop()).toContain('verze 4');
});

test('souběžná změna (409) → uloží se jako samostatný koncept', async () => {
    const { ui, calls } = setup({
        'GET /api/drafts/drf_1/editor-spec': [200, { id: 'drf_1', version: 3, status: 'koncept', lexisSpec: { title: 'Smlouva', blocks: [] } }],
        'PUT /api/drafts/drf_1': [409, { error: 'Koncept mezitím změnil Kolega.', code: 'conflict', currentVersion: 4 }],
        'POST /api/drafts': [201, { id: 'drf_2', version: 1, status: 'koncept', title: 'Smlouva (úprava z LexisEditoru)' }]
    });
    window.customConfirm = async () => true;
    await ui.openLLDraft('drf_1');
    await ui.saveToLLDraft();
    const post = calls.find(c => c.opts && c.opts.method === 'POST');
    expect(JSON.parse(post.opts.body).spec.blocks[0].text).toBe('Upraveno v editoru');
    expect(ui.llDraftLink.id).toBe('drf_2');
    delete window.customConfirm;
});

test('jiný otevřený dokument se do konceptu neuloží', async () => {
    const { ui, calls } = setup({
        'GET /api/drafts/drf_1/editor-spec': [200, { id: 'drf_1', version: 1, status: 'koncept', lexisSpec: { title: 'X', blocks: [] } }]
    });
    await ui.openLLDraft('drf_1');
    ui.currentDocumentId = 'doc_jiny';
    await ui.saveToLLDraft();
    expect(calls.some(c => c.opts && c.opts.method === 'PUT')).toBe(false);
    expect(ui.alerts.pop()).toMatch(/není otevřený z konceptu/);
    expect(document.getElementById('ll-draft-bar')).toBeNull();
});

test('schválený koncept: tlačítko uložení vypnuté', async () => {
    const { ui } = setup({
        'GET /api/drafts/drf_1/editor-spec': [200, { id: 'drf_1', version: 5, status: 'schvaleno', lexisSpec: { title: 'Hotovo', blocks: [] } }]
    });
    await ui.openLLDraft('drf_1');
    const btn = document.querySelector('#ll-draft-bar button');
    expect(btn.disabled).toBe(true);
});

test('koncept mezitím schválený (409 approved) → lišta přepne na jen pro čtení', async () => {
    const { ui } = setup({
        'GET /api/drafts/drf_1/editor-spec': [200, { id: 'drf_1', version: 1, status: 'koncept', lexisSpec: { title: 'Výzva', blocks: [] } }],
        'PUT /api/drafts/drf_1': [409, { error: 'Koncept je schválený.', code: 'approved' }]
    });
    await ui.openLLDraft('drf_1');
    await ui.saveToLLDraft();
    expect(ui.llDraftLink.status).toBe('schvaleno');
    const btn = document.querySelector('#ll-draft-bar button');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/jen pro čtení/);
    expect(ui.alerts.pop()).toMatch(/mezitím schválen/);
});

test('hlavička konceptů ukáže, pod kým je editor spárovaný (escapováno přes textContent)', async () => {
    const { ui } = setup({
        'GET /api/drafts': [200, { drafts: [] }],
        'GET /api/me': [200, { name: 'Mgr. <b>Karel</b>', roleLabel: 'Koncipient', sharedIdentity: false, device: 'LexisEditor' }]
    });
    await ui.fetchLLDrafts();
    await new Promise(r => setTimeout(r, 0));
    const sub = document.querySelector('#ll-drafts-head .sub');
    expect(sub.textContent).toBe('sdílené v LexisLocalu · jako Mgr. <b>Karel</b> (Koncipient)');
    expect(sub.querySelector('b')).toBeNull();
});

test('sdílený hlavní účet → upozornění v hlavičce', async () => {
    const { ui } = setup({ 'GET /api/drafts': [200, { drafts: [] }], 'GET /api/me': [200, { name: 'Místní uživatel', sharedIdentity: true }] });
    await ui.fetchLLDrafts();
    await new Promise(r => setTimeout(r, 0));
    expect(document.querySelector('#ll-drafts-head .sub').textContent).toMatch(/sdílený účet/);
});
