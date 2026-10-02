/**
 * @jest-environment node
 *
 * Spárování editoru se vzdáleným LexisLocal přes otisk klíče (js/core/lexis-server-pin.js).
 * Bezpečnostně kritické: jiný klíč = odmítnout; ostatní weby = běžná kontrola.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');
const pinLib = require('../../js/core/lexis-server-pin');

let hasOpenssl = true;
try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); } catch (e) { hasOpenssl = false; }
const d = hasOpenssl ? describe : describe.skip;

function makeCert(dir, name) {
    const key = path.join(dir, name + '.key'), cert = path.join(dir, name + '.crt');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=LexisLocal',
        '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert], { stdio: 'ignore' });
    return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

describe('parseConnectUrl', () => {
    const fp = 'sha256/' + 'A'.repeat(43);
    test('odkaz s kódem', () => {
        expect(pinLib.parseConnectUrl(`lexis://192.168.1.20:8443/?fp=${encodeURIComponent(fp)}&code=Ab-1`))
            .toEqual({ host: '192.168.1.20', port: 8443, fp, code: 'Ab-1', token: null, baseUrl: 'https://192.168.1.20:8443' });
    });
    test('výchozí port 443 a odkaz bez lexis://', () => {
        expect(pinLib.parseConnectUrl(`10.0.0.5/?fp=${fp}&token=t`)).toMatchObject({ port: 443, baseUrl: 'https://10.0.0.5', token: 't' });
    });
    test('bez otisku, s neplatným otiskem nebo bez kódu/tokenu → chyba', () => {
        expect(pinLib.parseConnectUrl('lexis://10.0.0.5/?code=x').error).toMatch(/otisk/);
        expect(pinLib.parseConnectUrl('lexis://10.0.0.5/?fp=sha256/kratky&code=x').error).toMatch(/otisk/);
        expect(pinLib.parseConnectUrl(`lexis://10.0.0.5/?fp=${fp}`).error).toMatch(/kód/);
        expect(pinLib.parseConnectUrl('').error).toBeTruthy();
    });
});

d('spárování proti skutečnému HTTPS serveru', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexis_pin_'));
    let server, port, good, evil;
    const TOKEN = 'tok-' + Date.now();
    beforeAll(done => {
        good = makeCert(dir, 'good'); evil = makeCert(dir, 'evil');
        server = https.createServer({ key: good.key, cert: good.cert }, (req, res) => {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', () => {
                res.setHeader('Content-Type', 'application/json');
                if (req.url === '/api/pair/claim') {
                    const code = JSON.parse(body || '{}').code;
                    if (code === 'OK-CODE') { res.end(JSON.stringify({ token: TOKEN })); }
                    else { res.statusCode = 404; res.end('{}'); }
                } else if (req.url === '/api/status') {
                    res.statusCode = req.headers['x-api-token'] === TOKEN ? 200 : 401; res.end('{}');
                } else { res.statusCode = 404; res.end('{}'); }
            });
        }).listen(0, '127.0.0.1', () => { port = server.address().port; done(); });
    });
    afterAll(done => { server.close(done); }); // jest 30: done-callback nesmí nic vracet
    const link = (fp, extra) => `lexis://127.0.0.1:${port}/?fp=${encodeURIComponent(fp)}&${extra}`;

    test('správný otisk + kód → token a adresa serveru', async () => {
        const r = await pinLib.pairWithServer(link(pinLib.spkiPin(good.cert), 'code=OK-CODE'));
        expect(r).toMatchObject({ host: '127.0.0.1', port, pin: pinLib.spkiPin(good.cert), token: TOKEN, baseUrl: `https://127.0.0.1:${port}` });
    });
    test('jiný otisk (podvržený server) → odmítnuto, kód se NEodešle', async () => {
        await expect(pinLib.pairWithServer(link(pinLib.spkiPin(evil.cert), 'code=OK-CODE'))).rejects.toMatchObject({ code: 'PIN_MISMATCH' });
    });
    test('vypršelý kód → srozumitelná chyba', async () => {
        await expect(pinLib.pairWithServer(link(pinLib.spkiPin(good.cert), 'code=STARY'))).rejects.toThrow(/vypršel/);
    });
    test('token v odkazu se ověří; špatný token → chyba', async () => {
        await expect(pinLib.pairWithServer(link(pinLib.spkiPin(good.cert), 'token=' + TOKEN))).resolves.toMatchObject({ token: TOKEN });
        await expect(pinLib.pairWithServer(link(pinLib.spkiPin(good.cert), 'token=spatny'))).rejects.toThrow(/odmítl/);
    });
    test('pairedRequest: doplní token, zahodí podvržený X-API-Token, jen /api/…', async () => {
        const pairing = { host: '127.0.0.1', port, pin: pinLib.spkiPin(good.cert), token: TOKEN };
        let saved = null;
        const r = await pinLib.pairedRequest(pairing, { method: 'GET', path: '/api/status', headers: { 'X-API-Token': 'podvrh' } }, {}, pem => { saved = pem; });
        expect(r.status).toBe(200);
        expect(saved).toMatch(/BEGIN CERTIFICATE/);
        await expect(pinLib.pairedRequest(pairing, { method: 'GET', path: '/etc/passwd' })).rejects.toThrow(/\/api\//);
    });
    test('pairedRequest: obnovený certifikát se STEJNÝM klíčem projde, jiný klíč ne', async () => {
        const pin = pinLib.spkiPin(good.cert);
        // „starý“ certifikát se stejným klíčem jako server, ale jiným obsahem
        const renewed = execFileSync('openssl', ['req', '-x509', '-key', path.join(dir, 'good.key'), '-days', '1', '-subj', '/CN=Stary'], {}).toString();
        expect(pinLib.spkiPin(renewed)).toBe(pin);
        const r = await pinLib.pairedRequest({ host: '127.0.0.1', port, pin, pem: renewed, token: TOKEN }, { method: 'GET', path: '/api/status' });
        expect(r.status).toBe(200);
        await expect(pinLib.pairedRequest({ host: '127.0.0.1', port, pin: pinLib.spkiPin(evil.cert), pem: evil.cert.toString(), token: TOKEN }, { method: 'GET', path: '/api/status' }))
            .rejects.toMatchObject({ code: 'PIN_MISMATCH' });
    });
    test('certificateDecision: spárovaný host jen se svým klíčem, ostatní weby běžně', () => {
        const pins = { '127.0.0.1': { pin: pinLib.spkiPin(good.cert) } };
        expect(pinLib.certificateDecision('127.0.0.1', good.cert.toString(), pins)).toBe(0);
        expect(pinLib.certificateDecision('127.0.0.1', evil.cert.toString(), pins)).toBe(-2);
        expect(pinLib.certificateDecision('infojednani.gov.cz', evil.cert.toString(), pins)).toBe(-3);
        expect(pinLib.certificateDecision('127.0.0.1', 'nesmysl', pins)).toBe(-2);
    });
});
