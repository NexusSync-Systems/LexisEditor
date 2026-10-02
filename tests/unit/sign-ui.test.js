/**
 * Podpisový dialog a zpráva o ověření podpisu (js/ui/lexis-ui-4.js).
 * Data o podpisu pocházejí z cizího PDF → musí být escapovaná.
 */
const fs = require('fs');
const path = require('path');

beforeAll(() => {
    global.LexisUI = function () {};
    window.LexisUI = global.LexisUI;
    window.escapeHTML = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    global.eIco = (s) => s; window.eIco = global.eIco;
    const src = fs.readFileSync(path.join(__dirname, '../../js/ui/lexis-ui-4.js'), 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('LexisUI', 'eIco', src)(global.LexisUI, global.eIco);
});

function makeUI(electronAPI, store) {
    const ui = new global.LexisUI();
    const data = Object.assign({}, store || {});
    ui.core = { storage: { get: async (_s, k) => data[k], set: async (_s, o) => { data[o.key] = o.value; } }, getContent: () => '<p>Text</p>' };
    ui.alerts = []; ui.customAlert = (m) => ui.alerts.push(m);
    ui.checkEnterpriseFeature = (_n, fn) => fn();
    ui.setDocumentStatus = jest.fn();
    window.electronAPI = electronAPI;
    return { ui, data };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => { document.body.innerHTML = ''; delete window.electronAPI; });

test('zpráva o podpisu escapuje data z PDF (XSS)', () => {
    const { ui } = makeUI({});
    const html = ui.renderSignatureReport({
        fileName: '<img src=x onerror=alert(1)>.pdf', summary: '1× podpis',
        signatures: [{ index: 1, valid: true, level: 'zaručený', signer: { name: '<script>x</script>', issuer: 'CN=<b>', validFrom: '2026-01-01T00:00:00Z', validTo: '2027-01-01T00:00:00Z' },
            signingTime: '2026-10-02T10:00:00Z', timestamp: { present: true, valid: true, time: '2026-10-02T10:00:01Z', tsa: '<i>tsa</i>' }, warnings: ['<u>w</u>'] }]
    });
    expect(html).not.toMatch(/<img|<script|<i>|<u>/);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('✅');
});

test('neplatný podpis je jasně označen', () => {
    const { ui } = makeUI({});
    const html = ui.renderSignatureReport({ fileName: 'a.pdf', summary: '', signatures: [{ index: 1, valid: false, integrity: false, level: 'neplatný', warnings: [] }] });
    expect(html).toContain('❌');
    expect(html).toContain('změněn');
});

test('podpis předá razítko a viditelnost do main procesu a uloží volby bez hesla', async () => {
    const signPdf = jest.fn(async () => ({ success: true, filePath: '/tmp/a.pdf' }));
    const { ui, data } = makeUI({ signPdf, pickCertificate: async () => ({ path: '/Users/x/cert.p12' }) }, { 'lawyer-name': 'JUDr. Test' });
    await ui.signDigital(); await flush();
    document.getElementById('isds-cert-browse').click(); await flush();
    document.getElementById('isds-cert-pin').value = 'tajne';
    document.getElementById('sign-visible').checked = false;
    const sel = document.getElementById('sign-tsa-mode'); sel.value = 'custom'; sel.onchange();
    document.getElementById('sign-tsa-url').value = 'https://tsa.example.cz/tsp';
    await document.getElementById('isds-sign-confirm').onclick(); await flush();
    expect(signPdf).toHaveBeenCalledTimes(1);
    const p = signPdf.mock.calls[0][0];
    expect(p).toMatchObject({ p12Path: '/Users/x/cert.p12', password: 'tajne', visible: false, tsaUrl: 'https://tsa.example.cz/tsp' });
    expect(p.meta.name).toBe('JUDr. Test');
    expect(data['sign-options']).toEqual({ visible: false, tsaMode: 'custom', tsaUrl: 'https://tsa.example.cz/tsp' });
    expect(JSON.stringify(data['sign-options'])).not.toContain('tajne');
    expect(ui.alerts.join(' ')).toContain('časové razítko');
});

test('bez certifikátu nepodepíše; vlastní TSA bez adresy odmítne', async () => {
    const signPdf = jest.fn();
    const { ui } = makeUI({ signPdf, pickCertificate: async () => ({ path: '/c.p12' }) });
    await ui.signDigital(); await flush();
    await document.getElementById('isds-sign-confirm').onclick();
    expect(signPdf).not.toHaveBeenCalled();
    document.getElementById('isds-cert-browse').click(); await flush();
    const sel = document.getElementById('sign-tsa-mode'); sel.value = 'custom'; sel.onchange();
    document.getElementById('sign-tsa-url').value = 'file:///etc/passwd';
    await document.getElementById('isds-sign-confirm').onclick();
    expect(signPdf).not.toHaveBeenCalled();
    expect(ui.alerts.join(' ')).toMatch(/https/);
});

test('podpis hotového PDF a ověření volají správná IPC', async () => {
    const signExistingPdf = jest.fn(async () => ({ success: true, filePath: '/tmp/b_podepsano.pdf' }));
    const verifyPdfSignatures = jest.fn(async () => ({ success: true, fileName: 'b.pdf', summary: 'Dokument není elektronicky podepsán.', signatures: [] }));
    const { ui } = makeUI({ signPdf: jest.fn(), signExistingPdf, verifyPdfSignatures, pickCertificate: async () => ({ path: '/c.p12' }) });
    await ui.signDigital(); await flush();
    document.getElementById('isds-cert-browse').click(); await flush();
    await document.getElementById('sign-existing').onclick();
    expect(signExistingPdf).toHaveBeenCalledWith(expect.objectContaining({ p12Path: '/c.p12', tsaUrl: null, visible: true }));
    await ui.verifyPdfSignature();
    expect(verifyPdfSignatures).toHaveBeenCalledWith();
    expect(ui.alerts.pop()).toContain('není elektronicky podepsán');
});
