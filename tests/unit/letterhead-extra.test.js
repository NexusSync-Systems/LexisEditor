/**
 * Doplňkové testy hlavičkového papíru (letterhead) — okrajové případy rozvržení,
 * diakritika, patička, dlouhé hodnoty. Doplňuje security.test.js.
 */
require('../../js/ui/lexis-letterhead.js');
const LH = global.window.LexisLetterhead;

describe('Letterhead — okrajové případy', () => {
  test('bez loga → identita zarovnaná vlevo, žádný <img>', () => {
    const h = LH.buildHeaderHtml({ firm: 'Dias, Novák & Partneři', address: 'Údolní 33, 602 00 Brno' });
    expect(h).toContain('text-align:left');
    expect(h).not.toContain('<img');
  });

  test('s logem → obsahuje <img>, linku pod hlavičkou a zarovnání vpravo', () => {
    const h = LH.buildHeaderHtml({ firm: 'DNP', logo: 'data:image/png;base64,AAAA' });
    expect(h).toContain('<img');
    expect(h).toContain('text-align:right');
    expect(h).toContain('border-bottom');
  });

  test('diakritika se zachová (nemangluje se)', () => {
    const h = LH.buildHeaderHtml({ firm: 'Žluťoučký kůň s.r.o.', address: 'Příkop 8, Brno' });
    expect(h).toContain('Žluťoučký kůň s.r.o.');
    expect(h).toContain('Příkop 8, Brno');
  });

  test('jen jméno bez firmy a bez ČAK → jméno, žádné „advokát"', () => {
    const h = LH.buildHeaderHtml({ name: 'Jan Novák' });
    expect(h).toContain('Jan Novák');
    expect(h).not.toContain('advokát');
  });

  test('jméno + ČAK bez firmy → „advokát" i ČAK (regrese)', () => {
    const h = LH.buildHeaderHtml({ name: 'Jan Novák', license: '18742' });
    expect(h).toContain('advokát');
    expect(h).toContain('ev. č. ČAK 18742');
  });

  test('IČO/DIČ/ČAK i kontakt se objeví v hlavičce', () => {
    const h = LH.buildHeaderHtml({ firm: 'AK', ico: '09876543', dic: 'CZ09876543', license: '18742', tel: '+420 542 210 111', email: 'ak@x.cz', web: 'www.x.cz' });
    ['IČO 09876543', 'DIČ CZ09876543', 'ev. č. ČAK 18742', 'tel. +420 542 210 111', 'ak@x.cz', 'www.x.cz'].forEach(t => expect(h).toContain(t));
  });

  test('patička: s datovkou obsahuje ID, bez datovky je prázdná', () => {
    expect(LH.buildFooterHtml({ firm: 'AK', isds: 'ab1cde2' })).toContain('datová schránka ab1cde2');
    expect(LH.buildFooterHtml({ firm: 'AK', email: 'a@b.cz' })).toBe('');
  });

  test('hasContent: {} = false, {logo} = true, {email} = true', () => {
    expect(LH.hasContent({})).toBe(false);
    expect(LH.hasContent({ logo: 'x' })).toBe(true);
    expect(LH.hasContent({ email: 'a@b.cz' })).toBe(true);
  });

  test('dlouhé hodnoty se vykreslí bez pádu', () => {
    const long = 'A'.repeat(400);
    const h = LH.buildHeaderHtml({ firm: long, address: long });
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(400);
  });

  test('XSS v adrese/kontaktu se escapuje', () => {
    const h = LH.buildHeaderHtml({ firm: 'AK', address: '<img src=x onerror=alert(1)>' });
    expect(h).not.toContain('<img src=x onerror');
    expect(h).toContain('&lt;img');
  });
});
