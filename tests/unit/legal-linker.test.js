// tests/unit/legal-linker.test.js
const { linkifyLegalCitations } = require('../../js/core/lexis-legal-linker.js');

describe('Legal Linker — citace se linkují správně a bez hltavosti', () => {
  test('§ s číslem zákona a "a násl." se prolinkuje', () => {
    expect(linkifyLegalCitations('viz § 2079 a násl. tohoto zákona', 'z').count).toBe(1);
    const r = linkifyLegalCitations('§ 5 zákona č. 89/2012 Sb.', 'z');
    expect(r.count).toBe(1);
    expect(r.html).toContain('89/2012 Sb.');
  });

  test('NEpohltí prózu za § (regrese)', () => {
    const r = linkifyLegalCitations('§ 5 se ruší a nahrazuje textem.', 'z');
    // odkaz smí obsahovat jen "§ 5", ne celou větu
    const m = r.html.match(/class="legal-link"[^>]*>([^<]+)</);
    expect(m).toBeTruthy();
    expect(m[1].trim()).toBe('§ 5');
    expect(r.html).not.toContain('nahrazuje textem</a>');
  });

  test('§ N odst. N písm. x)', () => {
    const r = linkifyLegalCitations('§ 2 odst. 1 písm. a) zákona', 'z');
    expect(r.count).toBe(1);
    expect(r.html).toContain('§ 2 odst. 1 písm. a)');
  });

  test('text bez citace se nezmění', () => {
    const r = linkifyLegalCitations('žádná citace zde není', 'z');
    expect(r.changed).toBe(false);
  });
});

describe('Legal Linker — parseProvision (napojení na externí rešerši)', () => {
  const { parseProvision } = require('../../js/core/lexis-legal-linker.js');

  test('vytáhne paragraph/number/year z úplné citace', () => {
    expect(parseProvision('§ 580 zákona č. 89/2012 Sb.')).toEqual({ paragraph: '580', number: '89', year: '2012' });
    expect(parseProvision('podle § 2939 odst. 1 z. č. 89/2012 Sb. a násl.')).toEqual({ paragraph: '2939', number: '89', year: '2012' });
    expect(parseProvision('§ 109 zák. č. 235/2004 Sb.')).toEqual({ paragraph: '109', number: '235', year: '2004' });
  });

  test('vrací null bez úplného ustanovení', () => {
    expect(parseProvision('§ 580')).toBeNull();          // chybí zákon
    expect(parseProvision('obecný text bez citace')).toBeNull();
    expect(parseProvision('')).toBeNull();
  });
});
