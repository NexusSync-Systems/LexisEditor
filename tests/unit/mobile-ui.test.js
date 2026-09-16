/**
 * @jest-environment jsdom
 *
 * Unit testy mobilní UX vrstvy (js/mobile-ui.js).
 * IIFE, které se aktivuje jen když window.LEXIS_MOBILE === true. Testujeme:
 * no-op na desktopu, přidání třídy lexis-mobile, companion baner, helper
 * lexisMobileHide a jeho odolnost proti neplatnému selektoru.
 */
const path = require('path');
const MOBILE_UI = path.join(__dirname, '..', '..', 'js', 'mobile-ui.js');

function loadMobileUi() {
  jest.resetModules();
  require(MOBILE_UI);
}

beforeEach(() => {
  document.documentElement.className = '';
  document.body.innerHTML = '';
  delete window.LEXIS_MOBILE;
  delete window.lexisMobileHide;
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('detekce prostředí', () => {
  test('bez LEXIS_MOBILE (desktop/Electron) je skript NO-OP', () => {
    loadMobileUi();
    expect(document.documentElement.classList.contains('lexis-mobile')).toBe(false);
    expect(document.querySelector('.lexis-mobile-banner')).toBeNull();
    expect(window.lexisMobileHide).toBeUndefined();
  });

  test('s LEXIS_MOBILE přidá třídu a helper', () => {
    window.LEXIS_MOBILE = true;
    loadMobileUi();
    expect(document.documentElement.classList.contains('lexis-mobile')).toBe(true);
    expect(typeof window.lexisMobileHide).toBe('function');
  });
});

describe('companion baner', () => {
  beforeEach(() => { window.LEXIS_MOBILE = true; loadMobileUi(); });

  test('baner se vloží do DOM a zmíní počítač', () => {
    const bar = document.querySelector('.lexis-mobile-banner');
    expect(bar).not.toBeNull();
    expect(bar.textContent).toMatch(/na počítači/i);
  });

  test('tlačítko „Rozumím" baner schová', () => {
    const bar = document.querySelector('.lexis-mobile-banner');
    bar.querySelector('.lmb-close').click();
    expect(bar.hidden).toBe(true);
  });

  test('opakované spuštění nevloží druhý baner', () => {
    loadMobileUi();
    expect(document.querySelectorAll('.lexis-mobile-banner').length).toBe(1);
  });
});

describe('lexisMobileHide helper', () => {
  beforeEach(() => { window.LEXIS_MOBILE = true; loadMobileUi(); });

  test('označí prvky jako desktop-only', () => {
    document.body.innerHTML = '<button id="a"></button><button id="b"></button>';
    const n = window.lexisMobileHide(['#a', '#b']);
    expect(n).toBe(2);
    expect(document.getElementById('a').hasAttribute('data-desktop-only')).toBe(true);
    expect(document.getElementById('b').hasAttribute('data-desktop-only')).toBe(true);
  });

  test('přijme i jediný selektor jako string', () => {
    document.body.innerHTML = '<button class="x"></button>';
    expect(window.lexisMobileHide('.x')).toBe(1);
  });

  test('neplatný selektor nespadne (vrátí 0)', () => {
    expect(window.lexisMobileHide('::::nonsense')).toBe(0);
    expect(window.lexisMobileHide(null)).toBe(0);
  });
});
