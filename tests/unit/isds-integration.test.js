/**
 * @jest-environment node
 *
 * INTEGRAČNÍ test ISDS: reálný transport (js/core/isds-transport.js) + reálný SOAP
 * klient (js/core/isds-client.js) proti LOKÁLNÍMU mock serveru přes skutečný soket.
 *
 * Neimportuje main.js (Electron), ale věrně zrcadlí jeho non-cert cestu isdsCall():
 *   buildRequest() → POST(headers, body) → parse odpovědi.
 * Ověřuje celý řetězec: výběr endpointu, Basic auth, SOAPAction, tělo s IČO,
 * zpracování odpovědi i HTTP chyby, a SSRF ochranu na hranici požadavku.
 * Bez sítě ven — server běží na 127.0.0.1 na efemérním portu.
 */
const http = require('http');
const path = require('path');
const isdsClient = require(path.join(__dirname, '..', '..', 'js', 'core', 'isds-client.js'));
const isdsTransport = require(path.join(__dirname, '..', '..', 'js', 'core', 'isds-transport.js'));

// Mirror main.js httpsPostWithCert(), ale přes plain http (mock nemá TLS).
function postSoap(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      method: 'POST', hostname: u.hostname, port: u.port,
      path: u.pathname + u.search,
      headers: Object.assign({ 'Content-Length': Buffer.byteLength(body) }, headers),
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ httpStatus: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text: data, url }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
  });
}

// Spustí mock ISDS, předá control funkci, vždy uklidí server.
async function withMockIsds(responder, fn) {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      received.push({ method: req.method, headers: req.headers, body });
      const { status = 200, xml = '<x/>', contentType = 'text/xml; charset=utf-8' } = responder(req, body) || {};
      res.writeHead(status, { 'Content-Type': contentType });
      res.end(xml);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    return await fn({ mockUrl: `http://127.0.0.1:${port}/DS/x`, received });
  } finally {
    await new Promise(r => server.close(r));
  }
}

const FIND_OK = '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
  '<FindDataBoxResponse><dbResults><dbOwnerInfo><dbID>abc12de</dbID><dbType>PO</dbType><dbState>1</dbState>' +
  '<firmName>Testovací Firma s.r.o.</firmName><ic>27074358</ic></dbOwnerInfo></dbResults>' +
  '<dbStatus><dbStatusCode>0000</dbStatusCode><dbStatusMessage>OK</dbStatusMessage></dbStatus></FindDataBoxResponse>' +
  '</soap:Body></soap:Envelope>';

const OWNER_OK = '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
  '<GetOwnerInfoFromLoginResponse><dbStatusCode>0000</dbStatusCode><dbStatusMessage>OK</dbStatusMessage>' +
  '<dbOwnerInfo><dbID>mybox1</dbID><firmName>Moje AK, s.r.o.</firmName></dbOwnerInfo>' +
  '</GetOwnerInfoFromLoginResponse></soap:Body></soap:Envelope>';

describe('ISDS integrace — FindDataBox přes reálný soket', () => {
  test('sestaví správný požadavek, mock odpoví, klient zparsuje schránku', async () => {
    const creds = { login: 'lawyer', pass: 'pw', env: 'test' };
    const soapBody = isdsClient.buildFindDataBoxRequest({ ic: '27074358' });
    const built = isdsTransport.buildRequest(creds, 'search', 'FindDataBox', { isdsClient });

    // transport: testovací endpoint, Basic auth, SOAPAction
    expect(built.url).toBe('https://ws1.czebox.cz/DS/df');
    expect(built.headers.Authorization).toBe('Basic ' + Buffer.from('lawyer:pw').toString('base64'));
    expect(built.useCert).toBe(false);

    await withMockIsds(() => ({ xml: FIND_OK }), async ({ mockUrl, received }) => {
      const resp = await postSoap(mockUrl, built.headers, soapBody);
      expect(resp.ok).toBe(true);

      // server dostal správné hlavičky a tělo s IČO
      const got = received[0];
      expect(got.headers['content-type']).toMatch(/text\/xml/);
      expect(got.headers['authorization']).toBe(built.headers.Authorization);
      expect(got.headers['soapaction']).toBe(built.headers.SOAPAction);
      expect(got.body).toContain('27074358');

      // klient zparsuje odpověď
      const parsed = isdsClient.parseFindDataBoxResponse(resp.text);
      expect(parsed.status.ok).toBe(true);
      expect(parsed.boxes[0]).toMatchObject({ dbID: 'abc12de', firmName: 'Testovací Firma s.r.o.' });
    });
  });
});

describe('ISDS integrace — test připojení (GetOwnerInfoFromLogin)', () => {
  test('produkční endpoint, ověření vlastní schránky', async () => {
    const creds = { login: 'ak', pass: 'tajne', env: 'production' };
    const soapBody = isdsClient.buildGetOwnerInfoRequest();
    const built = isdsTransport.buildRequest(creds, 'info', 'GetOwnerInfoFromLogin', { isdsClient });
    expect(built.url).toBe('https://ws1.mojedatovaschranka.cz/DS/dx');

    await withMockIsds(() => ({ xml: OWNER_OK }), async ({ mockUrl, received }) => {
      const resp = await postSoap(mockUrl, built.headers, soapBody);
      expect(received[0].headers['authorization']).toBe('Basic ' + Buffer.from('ak:tajne').toString('base64'));
      const parsed = isdsClient.parseGetOwnerInfoResponse(resp.text);
      expect(parsed.status.ok).toBe(true);
      expect(parsed).toMatchObject({ dbID: 'mybox1', firmName: 'Moje AK, s.r.o.' });
    });
  });
});

describe('ISDS integrace — chybové a bezpečnostní chování', () => {
  test('HTTP 500 z ISDS → ok:false (parsování se nespustí)', async () => {
    const creds = { login: 'a', pass: 'b', env: 'test' };
    const built = isdsTransport.buildRequest(creds, 'search', 'FindDataBox', { isdsClient });
    await withMockIsds(() => ({ status: 500, xml: '<error/>' }), async ({ mockUrl }) => {
      const resp = await postSoap(mockUrl, built.headers, isdsClient.buildFindDataBoxRequest({ ic: '27074358' }));
      expect(resp.ok).toBe(false);
      expect(resp.httpStatus).toBe(500);
    });
  });

  test('bez přihlášení se hlavička Authorization vůbec nepřipojí', async () => {
    const built = isdsTransport.buildRequest({ env: 'test' }, 'search', 'FindDataBox', { isdsClient });
    expect(built.headers.Authorization).toBeUndefined();
    await withMockIsds(() => ({ xml: FIND_OK }), async ({ mockUrl, received }) => {
      await postSoap(mockUrl, built.headers, isdsClient.buildFindDataBoxRequest({ ic: '27074358' }));
      expect(received[0].headers['authorization']).toBeUndefined();
    });
  });

  test('SSRF: override na cizí host se ignoruje → míří na oficiální ISDS', () => {
    const built = isdsTransport.buildRequest(
      { login: 'a', pass: 'b', env: 'test', host: 'evil.example.com', basePath: '/steal' },
      'search', 'FindDataBox', { isdsClient });
    expect(built.url).toBe('https://ws1.czebox.cz/DS/df');   // ne evil.example.com
    expect(built.override).toBeNull();
  });
});
