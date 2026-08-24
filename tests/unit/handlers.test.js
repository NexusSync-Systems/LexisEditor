/**
 * Fáze 0: zamyká třídu chyb „tlačítko volá nedefinovanou funkci".
 * Staví na stejné logice jako scripts/check-handlers.js (sdílený modul),
 * takže test i build-pojistka hlásí totéž.
 */
'use strict';
const path = require('path');
const { findBrokenHandlers } = require('../../scripts/check-handlers');

describe('integrita on*-handlerů', () => {
  const root = path.join(__dirname, '..', '..');
  const { broken, checked } = findBrokenHandlers(root);

  test('kontroluje se rozumný počet handlerů (sanity)', () => {
    expect(checked).toBeGreaterThan(100);
  });

  test('žádný onclick/onchange handler nevolá nedefinovanou funkci', () => {
    expect(broken).toEqual([]);
  });
});
