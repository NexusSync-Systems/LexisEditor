/**
 * pades-sign.js — elektronický podpis PDF ve formátu PAdES (Node/Electron main proces).
 *
 *  • Podpis certifikátem .p12/.pfx (PKCS#7/CMS, SHA-256).
 *  • Volitelně ČASOVÉ RAZÍTKO z TSA (RFC 3161) → PAdES-B-T: čas podpisu je doložen
 *    třetí stranou a podpis jde ověřit i po vypršení certifikátu podepisujícího.
 *  • Volitelně VIDITELNÝ podpisový blok na poslední straně (jméno, datum, „elektronicky podepsáno“).
 *  • signExistingPdf — podpis hotového PDF (příloha, dokument od klienta).
 *
 * Úroveň podpisu: zaručený (AdES); s KVALIFIKOVANÝM certifikátem = UZNÁVANÝ podpis
 * (§ 6 z. č. 297/2016 Sb.). KVALIFIKOVANÝ podpis (QES) vyžaduje klíč na čipu/tokenu —
 * to tento modul neřeší.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const signpdf = require('@signpdf/signpdf').default;
const { P12Signer } = require('@signpdf/signer-p12');
const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');
const { Signer } = require('@signpdf/utils');
const { timestampCms } = require('./pdf-signature');

/** Signer, který po podpisu doplní časové razítko z TSA. */
class TimestampingSigner extends Signer {
    constructor(inner, opts) { super(); this.inner = inner; this.opts = opts || {}; this.genTime = null; }
    async sign(pdfBuffer, signingTime) {
        const cms = await this.inner.sign(pdfBuffer, signingTime);
        if (!this.opts.tsaUrl) return cms;
        const r = await timestampCms(cms, this.opts);
        this.genTime = r.genTime;
        return r.cms;
    }
}

// Písmo s češtinou: systémové TTF přes fontkit (je-li nainstalován), jinak Helvetica bez diakritiky.
const SYSTEM_FONTS = [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf'
];
async function _font(pdfDoc, fontPath) {
    try {
        const fontkit = require('@pdf-lib/fontkit');
        const p = [fontPath].concat(SYSTEM_FONTS).find(f => f && fs.existsSync(f));
        if (p) { pdfDoc.registerFontkit(fontkit); return { font: await pdfDoc.embedFont(fs.readFileSync(p)), unicode: true }; }
    } catch (e) { /* fontkit není nainstalovaný */ }
    return { font: await pdfDoc.embedFont(StandardFonts.Helvetica), unicode: false };
}
const _ascii = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function _drawSignatureBlock(pdfDoc, meta, opts) {
    const page = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    const { width } = page.getSize();
    const { font, unicode } = await _font(pdfDoc, opts.fontPath);
    const t = s => unicode ? String(s) : _ascii(s);
    const W = 230, H = 62, x = width - W - 40, y = 40;
    page.drawRectangle({ x, y, width: W, height: H, borderColor: rgb(0.35, 0.54, 0.29), borderWidth: 1, color: rgb(0.97, 0.98, 0.96) });
    const when = new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
    const lines = [
        { s: t('Elektronicky podepsal(a):'), size: 7 },
        { s: t(meta.name || 'neuvedeno'), size: 10 },
        { s: t(`Datum: ${when}${opts.tsaUrl ? ' (s časovým razítkem)' : ''}`), size: 7 },
        { s: t(meta.reason || ''), size: 7 }
    ];
    let yy = y + H - 13;
    for (const l of lines) { if (l.s) { page.drawText(l.s, { x: x + 8, y: yy, size: l.size, font, color: rgb(0.17, 0.16, 0.15), maxWidth: W - 16 }); } yy -= l.size + 6; }
    return [x, y, x + W, y + H];
}

/**
 * Podepíše PDF buffer certifikátem .p12/.pfx.
 * @param {object} [opts] { tsaUrl, visible, fetch, fontPath }
 * @returns {Promise<Buffer>} podepsané PDF (pro zpětnou kompatibilitu přímo Buffer)
 */
async function signPdfBuffer(pdfBuffer, p12Buffer, passphrase, meta = {}, opts = {}) {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) throw new Error('Neplatné vstupní PDF.');
    if (!Buffer.isBuffer(p12Buffer) || p12Buffer.length === 0) throw new Error('Neplatný certifikát (.p12/.pfx).');

    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: false });
    const widgetRect = opts.visible ? await _drawSignatureBlock(pdfDoc, meta, opts) : [0, 0, 0, 0];
    pdflibAddPlaceholder({
        pdfDoc,
        reason: meta.reason || 'Podpis dokumentu',
        contactInfo: meta.contactInfo || '',
        name: meta.name || '',
        location: meta.location || '',
        widgetRect,
        // časové razítko (token TSA s certifikáty) potřebuje víc místa
        signatureLength: opts.tsaUrl ? 30000 : 16000
    });
    const withPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

    const signer = new TimestampingSigner(new P12Signer(p12Buffer, { passphrase: passphrase || '' }), opts);
    return signpdf.sign(withPlaceholder, signer);
}

/** Podpis hotového PDF souboru. Zašifrované / už podepsané PDF odmítne (podpis by se rozbil). */
async function signExistingPdf(pdfPath, p12Buffer, passphrase, meta = {}, opts = {}) {
    const pdf = fs.readFileSync(pdfPath);
    const s = pdf.toString('latin1');
    if (/\/Encrypt\b/.test(s)) throw new Error('PDF je zašifrované — nejdřív odstraňte heslo/ochranu.');
    if (/\/ByteRange\s*\[/.test(s)) throw new Error('PDF už obsahuje elektronický podpis — další podpis by ten původní zneplatnil (víc podpisů zatím nepodporujeme).');
    return signPdfBuffer(pdf, p12Buffer, passphrase, meta, opts);
}

/** Rychlá kontrola, že PDF obsahuje podpisovou strukturu (ByteRange + Contents). */
function looksSigned(pdfBuffer) {
    const s = pdfBuffer.toString('latin1');
    return s.includes('/ByteRange') && s.includes('/Contents') && /\/Type\s*\/Sig/.test(s);
}

/** Navrhne název podepsaného souboru: „smlouva.pdf“ → „smlouva_podepsano.pdf“. */
function signedName(p) {
    const b = path.basename(String(p || 'Dokument.pdf'), path.extname(String(p || '')));
    return `${b}_podepsano.pdf`;
}

module.exports = { signPdfBuffer, signExistingPdf, looksSigned, signedName, TimestampingSigner };
