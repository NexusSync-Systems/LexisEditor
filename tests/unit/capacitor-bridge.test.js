/**
 * @jest-environment jsdom
 *
 * Unit testy mobilního mostu (js/capacitor-bridge.js).
 * Most je IIFE, které mutuje `window`. Testujeme obě větve (Electron vs. mobil),
 * companion implementace, odklon desktop-only akcí a Proxy fallback.
 * Bez sítě, deterministické, běží v CI (jsdom).
 */
const path = require('path');
const BRIDGE = path.join(__dirname, '..', '..', 'js', 'capacitor-bridge.js');

// Nahraje most načisto do aktuálního window (IIFE se spustí při require).
function loadBridge() {
  jest.resetModules();
  require(BRIDGE);
}

beforeEach(() => {
  // čistý výchozí stav okna pro každý test
  try { window.localStorage.clear(); } catch (e) {}
  delete window.electronAPI;
  delete window.LEXIS_MOBILE;
  // window.open v jsdom není implementované → nahradíme špionem
  window.open = jest.fn();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('detekce prostředí', () => {
  test('v Electronu (electronAPI už existuje) je most NO-OP', () => {
    const sentinel = { __electron: true, getAppVersion: () => 'desktop' };
    window.electronAPI = sentinel;
    loadBridge();
    expect(window.electronAPI).toBe(sentinel);          // nepřepsáno
    expect(window.LEXIS_MOBILE).toBeUndefined();         // příznak se nenastavil
  });

  test('na mobilu/v prohlížeči definuje electronAPI a nastaví LEXIS_MOBILE', () => {
    loadBridge();
    expect(typeof window.electronAPI).toBe('object');
    expect(window.LEXIS_MOBILE).toBe(true);
  });
});

describe('companion implementace', () => {
  beforeEach(() => loadBridge());

  test('getAppVersion vrací "mobile"', async () => {
    await expect(window.electronAPI.getAppVersion()).resolves.toBe('mobile');
  });

  test('getLexisLocalToken je prázdný řetězec', () => {
    expect(window.electronAPI.getLexisLocalToken()).toBe('');
  });

  test('AI konfigurace přežije uložení a načtení (localStorage)', async () => {
    const cfg = { endpoint: 'http://192.168.1.50:11434/api/generate', model: 'llama3' };
    await expect(window.electronAPI.saveAIConfig(cfg)).resolves.toBe(true);
    await expect(window.electronAPI.getAIConfig()).resolves.toEqual(cfg);
  });

  test('ISDS konfigurace roundtrip — necitlivá pole přežijí', async () => {
    await window.electronAPI.saveIsdsConfig({ environment: 'production', hasConfig: true });
    await expect(window.electronAPI.getIsdsConfig()).resolves.toEqual({ environment: 'production', hasConfig: true });
  });

  test('nenastavená konfigurace vrací null', async () => {
    await expect(window.electronAPI.getAIConfig()).resolves.toBeNull();
    await expect(window.electronAPI.getPostConfig()).resolves.toBeNull();
  });

  test('šablony: uložení obsahu a jeho čtení', async () => {
    await window.electronAPI.saveTemplate('zaloba', '<p>vzor</p>');
    await expect(window.electronAPI.getTemplateContent('zaloba')).resolves.toBe('<p>vzor</p>');
    await expect(window.electronAPI.getTemplateContent('neexistuje')).resolves.toBe('');
    await expect(window.electronAPI.getTemplates()).resolves.toEqual([]);
  });

  test('secureEncrypt/secureDecrypt jsou na mobilu passthrough', () => {
    expect(window.electronAPI.secureEncrypt('tajne')).toBe('tajne');
    expect(window.electronAPI.secureDecrypt('tajne')).toBe('tajne');
  });

  test('zámek: uložení, čtení a smazání konfigurace', async () => {
    await window.electronAPI.lockSaveConfig({ pin: '1234' });
    await expect(window.electronAPI.lockGetConfig()).resolves.toEqual({ pin: '1234' });
    await window.electronAPI.lockDeleteConfig();
    await expect(window.electronAPI.lockGetConfig()).resolves.toBeNull();
  });

  test('biometrika není na mobilu k dispozici (stub)', async () => {
    await expect(window.electronAPI.lockTouchIdAvailable()).resolves.toBe(false);
    await expect(window.electronAPI.authenticateBiometric()).resolves.toMatchObject({ success: true, mobileStub: true });
  });

  test('openExternalUrl otevře nové okno', async () => {
    await window.electronAPI.openExternalUrl('https://example.org');
    expect(window.open).toHaveBeenCalledWith('https://example.org', '_blank');
  });

  test('kalendář nabídne .ics přes data URL', async () => {
    await window.electronAPI.calendarOpenIcs('BEGIN:VCALENDAR');
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(String(window.open.mock.calls[0][0])).toMatch(/^data:text\/calendar/);
  });

  test('prázdné seznamy ISDS', async () => {
    await expect(window.electronAPI.isdsInboxList()).resolves.toEqual([]);
    await expect(window.electronAPI.isdsOutboxList()).resolves.toEqual([]);
  });
});

describe('desktop-only akce se slušně odkloní', () => {
  beforeEach(() => loadBridge());

  test.each([
    'signPdf', 'pickCertificate', 'exportDocx', 'searchAres',
    'isdsSendMessage', 'testIsdsConnection', 'importPdf', 'composeEmailAttach',
  ])('%s vrací zamítnutí s příznakem mobileUnavailable', async (method) => {
    await expect(window.electronAPI[method]()).rejects.toMatchObject({ mobileUnavailable: true, method });
  });

  test('odklon zobrazí toast (vloží prvek do DOM)', async () => {
    await window.electronAPI.signPdf().catch(() => {});
    const toast = document.querySelector('[role="status"]');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toMatch(/na počítači/i);
  });
});

describe('bezpečnost: přihlašovací údaje se na mobilu neukládají', () => {
  beforeEach(() => loadBridge());

  test('saveIsdsConfig odstraní login i heslo před zápisem do localStorage', async () => {
    await window.electronAPI.saveIsdsConfig({
      login: 'k6t5jp', password: 'tajneHeslo', environment: 'production', hasConfig: true,
    });
    // v surovém localStorage nesmí zůstat ani stopa po přihlašovacích údajích
    const raw = window.localStorage.getItem('lexis-isds-config') || '';
    expect(raw).not.toMatch(/tajneHeslo/);
    expect(raw).not.toMatch(/k6t5jp/);
    expect(raw).not.toMatch(/password|login/);
    // necitlivá pole ale zůstanou (UI pozná, že konfigurace existuje)
    const cfg = await window.electronAPI.getIsdsConfig();
    expect(cfg).toEqual({ environment: 'production', hasConfig: true });
  });

  test('savePostConfig strippne apiKey/heslo i ve vnořeném objektu', async () => {
    await window.electronAPI.savePostConfig({
      endpoint: 'https://b2b.postaonline.cz', apiKey: 'AK-123',
      credentials: { username: 'advokat', password: 'x' },
    });
    const raw = window.localStorage.getItem('lexis-post-config') || '';
    expect(raw).not.toMatch(/AK-123/);
    expect(raw).not.toMatch(/advokat/);
    const cfg = await window.electronAPI.getPostConfig();
    expect(cfg).toEqual({ endpoint: 'https://b2b.postaonline.cz', credentials: {} });
  });

  test('prázdná / neobjektová konfigurace projde bez chyby', async () => {
    await expect(window.electronAPI.saveIsdsConfig(null)).resolves.toBe(true);
    await expect(window.electronAPI.saveIsdsConfig({})).resolves.toBe(true);
  });
});

describe('Proxy fallback pro nepokryté metody', () => {
  beforeEach(() => loadBridge());

  test('neznámá metoda nespadne a vrátí Promise<null>', async () => {
    await expect(window.electronAPI.uplneNovaMetoda()).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  test('neznámý on* handler je bezpečný no-op (vrací undefined)', () => {
    expect(window.electronAPI.onNeexistujiciEvent(() => {})).toBeUndefined();
  });

  test('event subscription funkce jsou no-op', () => {
    expect(window.electronAPI.onUpdateMessage(() => {})).toBeUndefined();
    expect(window.electronAPI.onIsdsOutboxChanged(() => {})).toBeUndefined();
  });
});
