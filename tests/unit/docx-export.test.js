/**
 * @jest-environment node
 *
 * Skutečný export do .docx: html-to-docx + hlavička/patička z LexisLetterhead.
 * Ověří, že vzniklý .docx je platný ZIP s word/document.xml, header a footer
 * a že obsahují očekávaný text (tělo, identita kanceláře, datová schránka).
 * Spustí se jen když jsou nainstalované `html-to-docx` a `jszip`.
 */
let libs = true;
try { require.resolve('html-to-docx'); require.resolve('jszip'); } catch (e) { libs = false; }
const d = libs ? describe : describe.skip;

global.window = global.window || {};
require('../../js/ui/lexis-letterhead.js');
const LH = global.window.LexisLetterhead;

function buildDocxOptions(headerHtml, footerHtml) {
  return {
    orientation: 'portrait',
    pageSize: { width: 11906, height: 16838 },
    margins: { top: 1417, right: 1417, bottom: 1417, left: 1417, header: 708, footer: 708, gutter: 0 },
    lang: 'cs-CZ', creator: 'LexisEditor',
    table: { row: { cantSplit: true } },
    header: !!headerHtml, footer: !!footerHtml, pageNumber: true,
  };
}

d('DOCX export (html-to-docx + letterhead)', () => {
  const HTMLToDOCX = require('html-to-docx');
  const JSZip = require('jszip');
  const profile = { title:'JUDr.', name:'Zdeněk Dias', firm:'Dias, Novák & Partneři, advokátní kancelář s.r.o.', role:'advokát', license:'18742', address:'Karolinská 661/4, 186 00 Praha 8', ico:'12345678', tel:'+420 222 333 444', email:'kancelar@dnplegal.cz', web:'www.dnplegal.cz' };
  const headerHtml = LH.buildHeaderHtml(profile);
  const footerHtml = LH.buildFooterHtml(Object.assign({}, profile, { isds:'ab1cde2' }));
  const body = '<h2>Vážený kliente,</h2><p>ve věci vedené u Městského soudu v Praze bylo nařízeno jednání.</p>';

  let zip, names, docXml, headerXml, footerXml, buf;
  beforeAll(async () => {
    buf = await HTMLToDOCX(body, headerHtml, buildDocxOptions(headerHtml, footerHtml), footerHtml);
    zip = await JSZip.loadAsync(buf);
    names = Object.keys(zip.files);
    docXml = await zip.file('word/document.xml').async('string');
    const hf = names.find(n => /word\/header\d+\.xml/.test(n));
    const ff = names.find(n => /word\/footer\d+\.xml/.test(n));
    headerXml = hf ? await zip.file(hf).async('string') : '';
    footerXml = ff ? await zip.file(ff).async('string') : '';
  }, 30000);

  test('vznikne platný .docx (ZIP + povinné části)', () => {
    expect(buf[0]).toBe(0x50); expect(buf[1]).toBe(0x4B); // PK
    expect(names).toContain('[Content_Types].xml');
    expect(names).toContain('word/document.xml');
  });
  test('tělo obsahuje text dokumentu', () => {
    expect(docXml).toContain('Vážený kliente');
    expect(docXml).toContain('Městského soudu');
  });
  test('hlavička obsahuje identitu kanceláře', () => {
    expect(headerXml).not.toBe('');
    expect(/Dias|Novák/.test(headerXml)).toBe(true);
    expect(headerXml).toContain('12345678');
  });
  test('patička obsahuje datovou schránku', () => {
    expect(footerXml).toContain('ab1cde2');
  });
});
