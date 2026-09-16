/**
 * Unit testy ISDS klienta (js/core/isds-client.js).
 * Čistě sestavování a parsování SOAP — bez sítě, deterministické, běží v CI.
 * Ověřuje jmenný prostor, výběr endpointů, skládání requestů a extrakci z odpovědí.
 */
const isds = require('../../js/core/isds-client.js');

describe('buildEndpoint — výběr prostředí, služby a přístupu certifikátem', () => {
  test('test prostředí, vyhledávání schránek → czebox /DS/df', () => {
    expect(isds.buildEndpoint('test', 'search', null, false))
      .toBe('https://ws1.czebox.cz/DS/df');
  });
  test('produkce, zprávy → mojedatovaschranka /DS/dz', () => {
    expect(isds.buildEndpoint('production', 'messages', null, false))
      .toBe('https://ws1.mojedatovaschranka.cz/DS/dz');
  });
  test('přístup certifikátem → ws1c a /cert/DS', () => {
    expect(isds.buildEndpoint('production', 'info', null, true))
      .toBe('https://ws1c.mojedatovaschranka.cz/cert/DS/dx');
  });
  test('neznámé prostředí spadne do test (fail-safe)', () => {
    expect(isds.buildEndpoint('nesmysl', 'search', null, false))
      .toBe('https://ws1.czebox.cz/DS/df');
  });
  test('override hostitele a cesty má přednost', () => {
    expect(isds.buildEndpoint('test', 'search', { host: 'https://x.example', basePath: '/y' }, false))
      .toBe('https://x.example/y/df');
  });
});

describe('escapeXml — bezpečné vkládání do XML', () => {
  test('escapuje všech pět speciálních znaků', () => {
    expect(isds.escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
  test('null/undefined → prázdný řetězec', () => {
    expect(isds.escapeXml(null)).toBe('');
    expect(isds.escapeXml(undefined)).toBe('');
  });
});

describe('soapEnvelope / soapAction', () => {
  test('obálka obsahuje jmenný prostor v20 a soap:Body', () => {
    const env = isds.soapEnvelope('<p:X/>');
    expect(env).toContain('http://isds.czechpoint.cz/v20');
    expect(env).toContain('<soap:Body><p:X/></soap:Body>');
  });
  test('soapAction je uvozovkovaný NS/operace', () => {
    expect(isds.soapAction('FindDataBox'))
      .toBe('"http://isds.czechpoint.cz/v20/FindDataBox"');
  });
});

describe('parseStatus — stavový kód ISDS', () => {
  test('0000 → ok:true', () => {
    const s = isds.parseStatus('<dmStatusCode>0000</dmStatusCode><dmStatusMessage>OK</dmStatusMessage>');
    expect(s).toEqual({ code: '0000', message: 'OK', ok: true });
  });
  test('dbStatusCode jako alternativa a chybový kód → ok:false', () => {
    const s = isds.parseStatus('<dbStatusCode>1004</dbStatusCode><dbStatusMessage>Chyba</dbStatusMessage>');
    expect(s.code).toBe('1004');
    expect(s.ok).toBe(false);
  });
});

describe('FindDataBox — sestavení a parsování', () => {
  test('request obsahuje operaci, dbOwnerInfo a escapované IČO', () => {
    const xml = isds.buildFindDataBoxRequest({ ic: '270 & 74358', firmName: 'Test s.r.o.' });
    expect(xml).toContain('<p:FindDataBox><p:dbOwnerInfo>');
    expect(xml).toContain('<p:ic>270 &amp; 74358</p:ic>');
    expect(xml).toContain('<p:firmName>Test s.r.o.</p:firmName>');
  });
  test('prázdný dotaz → prázdné dbOwnerInfo (žádné pole)', () => {
    const xml = isds.buildFindDataBoxRequest({});
    expect(xml).toContain('<p:dbOwnerInfo></p:dbOwnerInfo>');
  });
  test('parsuje jednu schránku i status', () => {
    const resp = `<x><dbStatusCode>0000</dbStatusCode>
      <dbResults><dbOwnerInfo><dbID>abc12de</dbID><dbType>PO</dbType><dbState>1</dbState>
      <firmName>Firma a.s.</firmName><ic>27074358</ic></dbOwnerInfo></dbResults></x>`;
    const r = isds.parseFindDataBoxResponse(resp);
    expect(r.status.ok).toBe(true);
    expect(r.boxes).toHaveLength(1);
    expect(r.boxes[0]).toMatchObject({ dbID: 'abc12de', dbType: 'PO', dbState: '1', firmName: 'Firma a.s.', ic: '27074358' });
  });
  test('parsuje více schránek a odfiltruje záznam bez dbID', () => {
    const resp = `<x><dbOwnerInfo><dbID>id1aaaa</dbID></dbOwnerInfo>
      <dbOwnerInfo><firmName>bez id</firmName></dbOwnerInfo>
      <dbOwnerInfo><dbID>id2bbbb</dbID></dbOwnerInfo></x>`;
    const r = isds.parseFindDataBoxResponse(resp);
    expect(r.boxes.map(b => b.dbID)).toEqual(['id1aaaa', 'id2bbbb']);
  });
});

describe('isDeliverableState', () => {
  test('aktivní schránka (1) je doručitelná', () => {
    expect(isds.isDeliverableState('1')).toBe(true);
    expect(isds.isDeliverableState(1)).toBe(true);
  });
  test('jiné stavy nejsou doručitelné', () => {
    ['2', '3', '5', null, undefined, ''].forEach(s => expect(isds.isDeliverableState(s)).toBe(false));
  });
});

describe('CreateMessage — odeslání zprávy', () => {
  test('sestaví obálku s příjemcem, anotací a přílohami (main + enclosure)', () => {
    const xml = isds.buildCreateMessageRequest({
      dbIDRecipient: 'box123', annotation: 'Předmět',
      files: [
        { name: 'zaloba.pdf', mimeType: 'application/pdf', base64: 'AA AA\nBB' },
        { name: 'priloha.pdf', mimeType: 'application/pdf', base64: 'CCCC' },
      ],
    });
    expect(xml).toContain('<p:dbIDRecipient>box123</p:dbIDRecipient>');
    expect(xml).toContain('<p:dmAnnotation>Předmět</p:dmAnnotation>');
    expect(xml).toContain('dmFileMetaType="main"');
    expect(xml).toContain('dmFileMetaType="enclosure"');
    // base64 se zbavuje bílých znaků
    expect(xml).toContain('<p:dmEncodedContent>AAAABB</p:dmEncodedContent>');
  });
  test('výchozí anotace a mimeType, když chybí', () => {
    const xml = isds.buildCreateMessageRequest({ dbIDRecipient: 'b', files: [{ base64: 'X' }] });
    expect(xml).toContain('<p:dmAnnotation>Bez předmětu</p:dmAnnotation>');
    expect(xml).toContain('dmMimeType="application/octet-stream"');
  });
  test('parsuje dmID a status z odpovědi', () => {
    const r = isds.parseCreateMessageResponse('<x><dmStatusCode>0000</dmStatusCode><dmID>987654</dmID></x>');
    expect(r).toEqual({ status: { code: '0000', message: null, ok: true }, dmID: '987654' });
  });
});

describe('GetDeliveryInfo — doručenka', () => {
  test('request obsahuje dmID', () => {
    expect(isds.buildGetDeliveryInfoRequest('555')).toContain('<p:dmID>555</p:dmID>');
  });
  test('parsuje seznam událostí doručení', () => {
    const resp = `<x><dmStatusCode>0000</dmStatusCode><dmID>555</dmID>
      <dmEvent><dmEventTime>2026-08-27T09:00:00</dmEventTime><dmEventDescr>Dodání</dmEventDescr></dmEvent>
      <dmEvent><dmEventTime>2026-08-27T10:00:00</dmEventTime><dmEventDescr>Doručení</dmEventDescr></dmEvent></x>`;
    const r = isds.parseGetDeliveryInfoResponse(resp);
    expect(r.dmID).toBe('555');
    expect(r.events).toEqual([
      { time: '2026-08-27T09:00:00', descr: 'Dodání' },
      { time: '2026-08-27T10:00:00', descr: 'Doručení' },
    ]);
  });
});

describe('GetOwnerInfo — ověření přihlášení', () => {
  test('parsuje dbID a firmName vlastní schránky', () => {
    const r = isds.parseGetOwnerInfoResponse('<x><dbStatusCode>0000</dbStatusCode><dbID>mybox1</dbID><firmName>Moje AK</firmName></x>');
    expect(r).toMatchObject({ dbID: 'mybox1', firmName: 'Moje AK' });
    expect(r.status.ok).toBe(true);
  });
});
