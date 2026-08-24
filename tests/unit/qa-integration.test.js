/**
 * Předpilotní integritní testy — zamykají „tiché" třídy chyb nalezené při QA průletu:
 * chybějící most v preloadu (třída 401), IPC kanály bez handleru, duplicitní id,
 * externí závislosti (offline riziko). Staví na sdíleném scripts/qa-checks.js.
 */
'use strict';
const path = require('path');
const qa = require('../../scripts/qa-checks');
const root = path.join(__dirname, '..', '..');

describe('integrita rendereru ↔ main (preload most)', () => {
  test('každé electronAPI.X volané rendererem je vystaveno v preloadu', () => {
    expect(qa.findMissingElectronApi(root)).toEqual([]);
  });
  test('každý IPC kanál z preloadu má handler v main.js', () => {
    expect(qa.findUnhandledIpc(root)).toEqual([]);
  });
});

describe('integrita index.html', () => {
  test('žádná duplicitní id', () => {
    expect(qa.findDuplicateIds(root)).toEqual([]);
  });
  test('žádné externí <script>/<link> (aplikace je offline-first)', () => {
    expect(qa.findExternalResources(root)).toEqual([]);
  });
});
