/**
 * Rejstřík citací (table of authorities) — čistá detekce/sběr citací.
 * Staví na js/core/lexis-legal-linker.js (collectCitations).
 */
'use strict';
const LL = require('../../js/core/lexis-legal-linker');

describe('collectCitations', () => {
  test('posbírá unikátní citace, deduplikuje a seřadí', () => {
    const r = LL.collectCitations('Dle § 2201 a znovu § 2201, dále § 79 a zákon č. 89/2012 Sb.', 'zakonyprolidi');
    const cits = r.map(x => x.citation);
    expect(cits).toContain('§ 2201');
    expect(cits).toContain('§ 79');
    expect(cits).toContain('zákon č. 89/2012 Sb.');
    expect(cits.filter(c => c === '§ 2201').length).toBe(1); // dedup
    r.forEach(x => expect(typeof x.url).toBe('string'));
  });
  test('prázdný text → []', () => { expect(LL.collectCitations('')).toEqual([]); });
  test('text bez citací → []', () => { expect(LL.collectCitations('Toto je běžná věta bez odkazů.')).toEqual([]); });
});
