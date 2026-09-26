// tests/unit/research.test.js
// -----------------------------------------------------------------------------
// Testy modulu Externí rešerše (js/providers/lexis-research.js).
// Ověřuje: výchozí stav (VYPNUTO), registr poskytovatelů, sestavení URL pro
// LawGPT, defenzivní normalizaci odpovědi a self-mount sekce nastavení.
// Běží v jsdom (viz jest.config).
// -----------------------------------------------------------------------------

// fetch v jsdom není — namockujeme před načtením modulu.
let lastUrl = null;
let nextJson = [];
beforeAll(() => {
  global.fetch = jest.fn((url) => {
    lastUrl = url;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(nextJson) });
  });
  require('../../js/providers/lexis-research.js');
});

beforeEach(() => {
  lastUrl = null;
  nextJson = [];
  global.fetch.mockClear();
  try { localStorage.clear(); } catch (e) { /* noop */ }
});

const R = () => window.LexisResearch;
function optIn() { try { localStorage.setItem('lexis_research_enabled', '1'); localStorage.setItem('lexis_research_optin_ack', '1'); } catch (e) { /* noop */ } }

describe('Externí rešerše — stav a registr', () => {
  test('modul se exportuje na window.LexisResearch', () => {
    expect(R()).toBeTruthy();
    expect(typeof R().verifyCitation).toBe('function');
    expect(typeof R().findCaseLaw).toBe('function');
    expect(typeof R().findLaw).toBe('function');
  });

  test('výchozí stav je VYPNUTO a poskytovatel LawGPT', () => {
    expect(R().isEnabled()).toBe(false);
    expect(R().activeId()).toBe('lawgpt');
  });

  test('registr obsahuje lawgpt (zdarma, jediný poskytovatel)', () => {
    expect(R().PROVIDER_ORDER).toEqual(['lawgpt']);
    expect(R().PROVIDERS.lawgpt.ready).toBe(true);
    expect(R().PROVIDERS.lawgpt.auth).toBe('none');
    expect(R().PROVIDERS.directcase).toBeUndefined();
  });

  test('setEnabled se persistuje a neznámý poskytovatel se ignoruje', () => {
    R().setEnabled(true);
    expect(R().isEnabled()).toBe(true);
    R().setActiveProvider('nesmysl');
    expect(R().activeId()).toBe('lawgpt');
  });
});

describe('Externí rešerše — LawGPT dotazy', () => {
  beforeEach(() => { optIn(); });
  test('findCaseLaw staví správnou URL judikatury', async () => {
    nextJson = [];
    await R().findCaseLaw('neplatnost smlouvy');
    expect(lastUrl).toContain('https://lawgpt.cz/api/judgments/search');
    expect(lastUrl).toContain('q=neplatnost%20smlouvy');
    expect(lastUrl).toContain('source=all');
    expect(lastUrl).toContain('limit=8');
  });

  test('findLaw staví správnou URL eSbírky', async () => {
    nextJson = [];
    await R().findLaw('nájemní smlouva');
    expect(lastUrl).toContain('https://lawgpt.cz/api/esbirka/search');
    expect(lastUrl).toContain('in=all');
  });

  test('verifyCitation používá vyhledávání judikatury', async () => {
    nextJson = [];
    const out = await R().verifyCitation('26 Cdo 1230/2021');
    expect(lastUrl).toContain('/api/judgments/search');
    expect(out.provider).toBe('lawgpt');
    expect(out.kind).toBe('citace');
  });

  test('neúspěšný status vyhodí chybu', async () => {
    global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    await expect(R().findCaseLaw('cokoliv')).rejects.toThrow(/500/);
  });
});

describe('Externí rešerše — normalizace odpovědi (defenzivní)', () => {
  test('mapuje pole judikatury (soud, sp. zn., datum, url, výřez)', async () => {
    nextJson = [{
      court: 'Nejvyšší soud',
      spisova_znacka: '26 Cdo 1230/2021',
      date: '2021-05-04',
      url: 'https://example.cz/j/1',
      snippet: 'Právní věta…'
    }];
    const out = await R().findCaseLaw('x');
    expect(out.results).toHaveLength(1);
    const r = out.results[0];
    expect(r.meta).toContain('Nejvyšší soud');
    expect(r.meta).toContain('26 Cdo 1230/2021');
    expect(r.url).toBe('https://example.cz/j/1');
    expect(r.snippet).toBe('Právní věta…');
  });

  test('zvládne obálku {results:[...]} i holé řetězce', async () => {
    nextJson = { results: ['jen text výřezu'] };
    const out = await R().findCaseLaw('x');
    expect(out.results).toHaveLength(1);
    expect(out.results[0].snippet).toBe('jen text výřezu');
  });

  test('prázdná odpověď → prázdné výsledky, nikoli chyba', async () => {
    nextJson = {};
    const out = await R().findCaseLaw('x');
    expect(Array.isArray(out.results)).toBe(true);
    expect(out.results).toHaveLength(0);
  });
});

describe('Externí rešerše — self-mount nastavení', () => {
  test('mountSettings připojí sekci do #tab-settings a je idempotentní', () => {
    document.body.innerHTML = '<div id="tab-settings"></div>';
    R().mountSettings();
    expect(document.getElementById('research-settings-group')).toBeTruthy();
    expect(document.getElementById('research-enabled')).toBeTruthy();
    expect(document.getElementById('research-provider').value).toBe('lawgpt');
    R().mountSettings();
    expect(document.querySelectorAll('#research-settings-group')).toHaveLength(1);
  });
});

describe('Externí rešerše — by-provision a obálka odpovědi', () => {
  beforeEach(() => { optIn(); });
  test('findByProvision staví správnou URL /api/judgments/by-provision', async () => {
    nextJson = { success: true, data: { results: [] } };
    await R().findByProvision(89, 2012, 580);
    expect(lastUrl).toContain('https://lawgpt.cz/api/judgments/by-provision');
    expect(lastUrl).toContain('number=89');
    expect(lastUrl).toContain('year=2012');
    expect(lastUrl).toContain('paragraph=580');
  });

  test('normalizace rozbalí obálku {data:{results}} a čte reálná pole', async () => {
    nextJson = { success: true, data: { results: [
      { court: { code: 'NS', name: 'Nejvyšší soud' }, case_number: '29 Cdo 1/2023', decision_date: '2023-05-10', excerpt: 'text' }
    ] } };
    const out = await R().findCaseLaw('cokoliv');
    expect(out.results).toHaveLength(1);
    expect(out.results[0].title).toBe('29 Cdo 1/2023');
    expect(out.results[0].meta).toContain('Nejvyšší soud');
    expect(out.results[0].meta).toContain('2023-05-10');
  });

});

describe('Externí rešerše — odkaz na zdroj', () => {
  beforeEach(() => { optIn(); });
  test('normalizeItem doplní vyhledávací url z ECLI, když poskytovatel odkaz nedá', async () => {
    nextJson = { success: true, data: { results: [
      { ecli: 'ECLI:CZ:NS:2023:29.Cdo.1.2023', case_number: '29 Cdo 1/2023', court: { name: 'Nejvyšší soud' }, excerpt: 't' }
    ] } };
    const out = await R().findCaseLaw('x');
    expect(out.results[0].url).toContain('google.com/search');
    expect(decodeURIComponent(out.results[0].url)).toContain('ECLI:CZ:NS:2023:29.Cdo.1.2023');
  });

  test('explicitní url z odpovědi má přednost před fallbackem', async () => {
    nextJson = { success: true, data: { results: [
      { case_number: '1 As 2/2020', url: 'https://example.test/rozhodnuti/1', excerpt: 't' }
    ] } };
    const out = await R().findCaseLaw('x');
    expect(out.results[0].url).toBe('https://example.test/rozhodnuti/1');
  });
});

describe('Externí rešerše — zákony (it.law)', () => {
  beforeEach(() => { optIn(); });
  test('normalizeItem čte zákon zanořený pod it.law', async () => {
    nextJson = { success: true, data: { results: [
      { type: 'law', law: { number: 89, year: 2012, code: '89/2012 Sb.', title: 'Občanský zákoník' } }
    ] } };
    const out = await R().findLaw('nájem');
    expect(out.results).toHaveLength(1);
    expect(out.results[0].title).toBe('Občanský zákoník');
    expect(out.results[0].meta).toContain('89/2012 Sb.');
  });
});

describe('Externí rešerše — souhlas (mlčenlivost)', () => {
  test('programové findCaseLaw bez souhlasu NEfetchuje a odmítne', async () => {
    try { localStorage.clear(); } catch (e) { /* noop */ }   // žádný opt-in
    global.fetch.mockClear();
    await expect(R().findCaseLaw('citlivý dotaz')).rejects.toThrow(/souhlas/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test('po opt-inu programové findCaseLaw funguje', async () => {
    optIn();
    nextJson = { success: true, data: { results: [{ case_number: '1 As 2/2020', court: { name: 'NSS' }, excerpt: 't' }] } };
    const out = await R().findCaseLaw('dotaz');
    expect(out.results).toHaveLength(1);
  });
});
