// --- lexis-server-pin — spárování se vzdáleným serverem LexisLocal (main proces) ---
//
// Server LexisLocal v kanceláři nemá doménu → self-signed certifikát. Editor mu
// NESMÍ věřit vypnutím kontroly certifikátu (kdokoli v síti by se vydával za server
// a dostal dokumenty klientů i token). Místo toho:
//   1) advokát vloží odkaz z dashboardu LexisLocal (Spárovat):
//        lexis://192.168.1.20:443/?fp=sha256/<base64url>&code=<jednorázový kód>
//      otisk veřejného klíče (SPKI SHA-256) tak přijde MIMO síťové spojení;
//   2) editor se připojí, ověří otisk a jednorázový kód vymění za token
//      (POST /api/pair/claim) — vše přes spojení ověřené TÍMTO klíčem;
//   3) Chromium (okno editoru) pak přijme pro daný host JEN certifikát s tímto
//      klíčem (session.setCertificateVerifyProc), ostatní weby beze změny.
// Otisk je z veřejného klíče, ne z celého certifikátu → přežije obnovu certifikátu
// se stejným klíčem.

'use strict';

const crypto = require('crypto');

const PIN_RE = /^sha256\/[A-Za-z0-9_-]{43}$/;
const HOST_RE = /^(?:[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*|\[[0-9a-fA-F:]+\])$/;

/** SPKI SHA-256 otisk certifikátu (PEM řetězec nebo DER Buffer) → „sha256/<base64url>“. */
function spkiPin(cert) {
    const x = new crypto.X509Certificate(cert);
    const der = x.publicKey.export({ type: 'spki', format: 'der' });
    return 'sha256/' + crypto.createHash('sha256').update(der).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function shortPin(pin) {
    const s = String(pin || '').replace(/^sha256\//, '');
    return (s.slice(0, 16).match(/.{1,4}/g) || []).join(' ');
}

/**
 * Rozebere odkaz pro spárování. Vrací { host, port, fp, code, token, baseUrl } nebo { error }.
 * Přijme i odkaz bez „lexis://“ (vložený jen „host:port/?fp=…“).
 */
function parseConnectUrl(input) {
    let s = String(input || '').trim();
    if (!s) return { error: 'Vložte odkaz pro spárování z LexisLocal.' };
    if (!/^lexis:\/\//i.test(s)) s = 'lexis://' + s.replace(/^https?:\/\//i, '');
    let u;
    try { u = new URL(s.replace(/^lexis:/i, 'https:')); } catch (e) { return { error: 'Odkaz nemá platný tvar.' }; }
    const host = u.hostname;
    if (!host || !HOST_RE.test(host)) return { error: 'Odkaz neobsahuje platnou adresu serveru.' };
    const port = u.port ? parseInt(u.port, 10) : 443;
    const fp = u.searchParams.get('fp') || '';
    if (!PIN_RE.test(fp)) return { error: 'Odkaz neobsahuje platný otisk klíče serveru (fp=sha256/…).' };
    const code = u.searchParams.get('code') || null;
    const token = u.searchParams.get('token') || null;
    if (!code && !token) return { error: 'Odkaz neobsahuje párovací kód ani token.' };
    const hostForUrl = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
    return { host, port, fp, code, token, baseUrl: `https://${hostForUrl}${port === 443 ? '' : ':' + port}` };
}

/**
 * Rozhodnutí pro Electron setCertificateVerifyProc.
 *   0  = přijmout (spárovaný host a otisk sedí — i když je certifikát self-signed)
 *  -2  = odmítnout (spárovaný host, ale JINÝ klíč → možný útok / jiný server)
 *  -3  = běžná kontrola Chromia (host není spárovaný — ostatní weby beze změny)
 */
function certificateDecision(hostname, certPem, pins) {
    const entry = pins && pins[String(hostname || '').toLowerCase()];
    if (!entry || !entry.pin) return -3;
    let pin = null;
    try { pin = spkiPin(certPem); } catch (e) { return -2; }
    return pin === entry.pin ? 0 : -2;
}

function _pemFromDer(der) {
    const b64 = Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n');
    return `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
}

/** Stáhne certifikát serveru (bez důvěry) a ověří jeho otisk. */
function fetchAndCheckCertificate({ host, port, fp }, deps = {}) {
    const tls = deps.tls || require('tls');
    return new Promise((resolve, reject) => {
        const sock = tls.connect({ host, port, servername: HOST_RE.test(host) && !/^[\d.]+$/.test(host) ? host : undefined, rejectUnauthorized: false, timeout: 10000 }, () => {
            try {
                const peer = sock.getPeerCertificate(false);
                sock.end();
                if (!peer || !peer.raw) return reject(new Error('Server neposlal certifikát.'));
                const pin = spkiPin(peer.raw);
                if (pin !== fp) {
                    const e = new Error('Otisk klíče serveru NESOUHLASÍ s odkazem. Může jít o jiný server nebo o pokus o odposlech — spojení bylo přerušeno.');
                    e.code = 'PIN_MISMATCH'; e.actual = pin;
                    return reject(e);
                }
                resolve({ pin, pem: _pemFromDer(peer.raw) });
            } catch (err) { reject(err); }
        });
        sock.on('timeout', () => { sock.destroy(); reject(new Error('Server neodpovídá (časový limit).')); });
        sock.on('error', err => reject(new Error('Server není dostupný: ' + err.message)));
    });
}

/** HTTPS požadavek důvěřující JEN certifikátu s daným otiskem. */
function pinnedRequest({ host, port, fp, pem }, { method, path, headers, body }, deps = {}) {
    const https = deps.https || require('https');
    return new Promise((resolve, reject) => {
        const req = https.request({
            host, port, method, path,
            headers: Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, headers || {}),
            ca: pem, // důvěřujeme právě tomuto certifikátu…
            rejectUnauthorized: true,
            // …a jen pokud sedí otisk (název hostu se u IP adresy neřeší — kontrolu nahrazuje otisk).
            checkServerIdentity: (_h, cert) => {
                try { return spkiPin(cert.raw) === fp ? undefined : new Error('Otisk klíče serveru nesouhlasí.'); }
                catch (e) { return e; }
            },
            timeout: 15000
        }, res => {
            const chunks = []; let size = 0;
            const MAX = (deps.maxBytes || 60 * 1024 * 1024); // velké exporty/spisy
            res.on('data', c => { size += c.length; if (size > MAX) { req.destroy(new Error('Odpověď serveru je příliš velká.')); return; } chunks.push(c); });
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                let json = null; try { json = JSON.parse(buf.toString('utf8')); } catch (e) { /* ne-JSON */ }
                resolve({ status: res.statusCode, json, buffer: buf, headers: res.headers });
            });
        });
        req.on('timeout', () => req.destroy(new Error('Server neodpovídá (časový limit).')));
        req.on('error', reject);
        if (body) req.write(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

/**
 * Celé spárování: ověř otisk → vyměň kód za token (nebo ověř token z odkazu).
 * Vrací { host, port, baseUrl, pin, token }.
 */
async function pairWithServer(link, deps = {}) {
    const p = parseConnectUrl(link);
    if (p.error) throw new Error(p.error);
    const cert = await fetchAndCheckCertificate(p, deps);
    const conn = { host: p.host, port: p.port, fp: p.fp, pem: cert.pem };
    let token = p.token;
    if (p.code) {
        const r = await pinnedRequest(conn, { method: 'POST', path: '/api/pair/claim', body: { code: p.code } }, deps);
        if (r.status !== 200 || !r.json || !r.json.token) {
            throw new Error(r.status === 404 ? 'Párovací kód je neplatný nebo vypršel (platí 2 minuty) — vygenerujte nový v LexisLocal.' : `Server odmítl spárování (HTTP ${r.status}).`);
        }
        token = r.json.token;
    }
    const check = await pinnedRequest(conn, { method: 'GET', path: '/api/status', headers: { 'X-API-Token': token } }, deps);
    if (check.status === 401) throw new Error('Server token odmítl.');
    if (check.status >= 400) throw new Error(`Server odpověděl HTTP ${check.status}.`);
    return { host: p.host, port: p.port, baseUrl: p.baseUrl, pin: p.fp, token, pem: cert.pem };
}

/**
 * Požadavek na SPÁROVANÝ server (proxy pro okno editoru). Token doplní main proces —
 * renderer ho nikdy nedostane. Když server obnovil certifikát se STEJNÝM klíčem,
 * načte se nový certifikát (otisk se znovu ověří) a požadavek se zopakuje.
 * pairing = { host, port, pin, pem, token }; onPemUpdate(pem) uloží nový certifikát.
 */
async function pairedRequest(pairing, { method, path, headers, body }, deps = {}, onPemUpdate) {
    if (!pairing || !pairing.host || !pairing.pin) throw new Error('Editor není spárovaný se serverem LexisLocal.');
    if (!/^\/api\//.test(String(path || ''))) throw new Error('Povolené jsou jen cesty /api/… serveru LexisLocal.');
    const hdrs = Object.assign({}, headers || {});
    Object.keys(hdrs).forEach(k => { if (/^(x-api-token|host|cookie|authorization)$/i.test(k)) delete hdrs[k]; });
    if (pairing.token) hdrs['X-API-Token'] = pairing.token;
    const conn = { host: pairing.host, port: pairing.port || 443, fp: pairing.pin, pem: pairing.pem };
    const attempt = () => pinnedRequest(conn, { method: method || 'GET', path, headers: hdrs, body }, deps);
    if (!conn.pem) {
        conn.pem = (await fetchAndCheckCertificate(conn, deps)).pem;
        if (onPemUpdate) onPemUpdate(conn.pem);
    }
    try {
        return await attempt();
    } catch (e) {
        // Nedůvěryhodný certifikát → zkusíme, zda je to obnovený certifikát se stejným klíčem.
        if (!/certificate|self.signed|otisk|unable to verify|CERT/i.test(String(e && (e.code || e.message)))) throw e;
        const fresh = await fetchAndCheckCertificate(conn, deps); // vyhodí PIN_MISMATCH při jiném klíči
        conn.pem = fresh.pem;
        if (onPemUpdate) onPemUpdate(fresh.pem);
        return attempt();
    }
}

module.exports = { spkiPin, shortPin, parseConnectUrl, certificateDecision, fetchAndCheckCertificate, pinnedRequest, pairedRequest, pairWithServer, PIN_RE };
