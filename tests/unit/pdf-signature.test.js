/**
 * @jest-environment node
 *
 * Podpis PDF (PAdES) + časové razítko + ověření podpisů (pdf-signature.js, pades-sign.js).
 * Časové razítko vystavuje v testu skutečná TSA přes `openssl ts` (bez sítě).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const { signPdfBuffer, signExistingPdf, looksSigned, signedName } = require('../../js/core/pades-sign');
const { verifyPdfSignatures } = require('../../js/core/pdf-signature');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexis_sig_'));
// Test potřebuje `openssl ts` (OpenSSL 1.1+/3). macOS LibreSSL ho nemá → testy se přeskočí.
let hasTs = true;
try {
    fs.writeFileSync(path.join(dir, 'probe.txt'), 'x');
    execFileSync('openssl', ['ts', '-query', '-data', path.join(dir, 'probe.txt'), '-sha256', '-no_nonce', '-out', path.join(dir, 'probe.tsq')], { stdio: 'ignore' });
    hasTs = fs.existsSync(path.join(dir, 'probe.tsq'));
} catch (e) { hasTs = false; }
if (!hasTs) console.warn('pdf-signature.test: `openssl ts` není k dispozici (LibreSSL?) — testy podpisu přeskočeny. Na macOS: brew install openssl@3 a dát ho do PATH.');
const t = hasTs ? test : test.skip;
jest.setTimeout(60000);

const sh = (args, opts) => execFileSync('openssl', args, Object.assign({ cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] }, opts || {}));

function makeP12(name, { qualified = false, legacy = true } = {}) {
    const cnf = path.join(dir, name + '.cnf');
    fs.writeFileSync(cnf, `[req]\ndistinguished_name=dn\nprompt=no\nx509_extensions=ext\n[dn]\nCN=${name}\nC=CZ\n[ext]\nkeyUsage=critical,digitalSignature,nonRepudiation\n` +
        (qualified ? `1.3.6.1.5.5.7.1.3=DER:3014300806060400 8e4601013008060604008e460104\n`.replace(/ /g, '') : ''));
    sh(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30', '-config', cnf, '-keyout', name + '.key', '-out', name + '.crt']);
    sh(['pkcs12', '-export', ...(legacy ? ['-keypbe', 'PBE-SHA1-3DES', '-certpbe', 'PBE-SHA1-3DES', '-macalg', 'sha1'] : []),
        '-inkey', name + '.key', '-in', name + '.crt', '-passout', 'pass:heslo123', '-out', name + '.p12']);
    return fs.readFileSync(path.join(dir, name + '.p12'));
}

function setupTsa() {
    fs.writeFileSync(path.join(dir, 'tsa.cnf'), `[req]\ndistinguished_name=dn\nprompt=no\nx509_extensions=ext\n[dn]\nCN=Test TSA\nC=CZ\n[ext]\nextendedKeyUsage=critical,timeStamping\nkeyUsage=critical,digitalSignature\n` +
        `[tsa]\ndefault_tsa=tsa_config1\n[tsa_config1]\ndir=${dir}\nserial=${dir}/tsaserial\nsigner_cert=${dir}/tsa.crt\nsigner_key=${dir}/tsa.key\nsigner_digest=sha256\ndefault_policy=1.2.3.4.1\ndigests=sha256\naccuracy=secs:1\nordering=yes\ntsa_name=no\ness_cert_id_chain=no\ness_cert_id_alg=sha256\ncerts=${dir}/tsa.crt\n`);
    fs.writeFileSync(path.join(dir, 'tsaserial'), '01\n');
    sh(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30', '-config', 'tsa.cnf', '-keyout', 'tsa.key', '-out', 'tsa.crt']);
}
// „TSA přes HTTP“: vezme TimeStampReq a vrátí TimeStampResp z openssl ts -reply
const tsaFetch = jest.fn(async (url, init) => {
    fs.writeFileSync(path.join(dir, 'req.tsq'), init.body);
    sh(['ts', '-reply', '-config', 'tsa.cnf', '-queryfile', 'req.tsq', '-out', 'resp.tsr']);
    const body = fs.readFileSync(path.join(dir, 'resp.tsr'));
    return { ok: true, status: 200, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) };
});

async function samplePdf() {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]).drawText('Plna moc - testovaci dokument.', { x: 50, y: 780, size: 14 });
    return Buffer.from(await doc.save());
}

let p12, pdf;
beforeAll(async () => { if (hasTs) { p12 = makeP12('Advokat Test'); setupTsa(); } pdf = await samplePdf(); });

t('podpis bez razítka: platný, celý dokument, upozornění na chybějící razítko', async () => {
    const signed = await signPdfBuffer(pdf, p12, 'heslo123', { name: 'Advokát Test', reason: 'Plná moc' });
    expect(looksSigned(signed)).toBe(true);
    const v = verifyPdfSignatures(signed);
    expect(v.signed).toBe(true);
    const s = v.signatures[0];
    expect(s).toMatchObject({ valid: true, integrity: true, signatureValid: true, coversWholeDocument: true, level: 'zaručený (AdES)' });
    expect(s.signer.name).toBe('Advokat Test');
    expect(s.timestamp.present).toBe(false);
    expect(s.warnings.join(' ')).toMatch(/Bez časového razítka/);
});

t('změna jediného bajtu → podpis neplatný', async () => {
    const signed = await signPdfBuffer(pdf, p12, 'heslo123', {});
    // bajt uvnitř podepsaného rozsahu (hlavička PDF za „%PDF-1.x“)
    const bad = Buffer.from(signed); const i = 20; bad[i] = bad[i] ^ 0x01;
    const s = verifyPdfSignatures(bad).signatures[0];
    expect(s.integrity).toBe(false);
    expect(s.valid).toBe(false);
});

t('obsah přidaný po podpisu → varování', async () => {
    const signed = await signPdfBuffer(pdf, p12, 'heslo123', {});
    const s = verifyPdfSignatures(Buffer.concat([signed, Buffer.from('\n% pridano pozdeji\n')])).signatures[0];
    expect(s.coversWholeDocument).toBe(false);
    expect(s.warnings.join(' ')).toMatch(/přidán další obsah/);
});

t('časové razítko z TSA (RFC 3161) → PAdES-B-T, razítko ověřené', async () => {
    const signed = await signPdfBuffer(pdf, p12, 'heslo123', { name: 'Advokát Test' }, { tsaUrl: 'https://tsa.test/tsr', fetch: tsaFetch, visible: true });
    expect(tsaFetch).toHaveBeenCalled();
    const s = verifyPdfSignatures(signed).signatures[0];
    expect(s.valid).toBe(true);
    expect(s.timestamp).toMatchObject({ present: true, valid: true });
    expect(new Date(s.timestamp.time).getTime()).toBeGreaterThan(Date.now() - 120000);
    expect(s.timestamp.tsa).toMatch(/Test TSA/);
    expect(s.warnings.join(' ')).not.toMatch(/Bez časového razítka/);
});

t('kvalifikovaný certifikát (QcStatements, QcSSCD) se rozpozná', async () => {
    const q = makeP12('Advokat Kvalif', { qualified: true });
    const s = verifyPdfSignatures(await signPdfBuffer(pdf, q, 'heslo123', {})).signatures[0];
    expect(s.qualifiedCertificate).toBe(true);
    expect(s.qualifiedDevice).toBe(true);
    expect(s.level).toMatch(/kvalifikovaný/);
});

t('certifikát exportovaný moderním openssl (AES/PBKDF2) jde použít', async () => {
    const modern = makeP12('Advokat Moderni', { legacy: false });
    const s = verifyPdfSignatures(await signPdfBuffer(pdf, modern, 'heslo123', {})).signatures[0];
    expect(s.valid).toBe(true);
});

t('signExistingPdf: hotové PDF podepíše; podepsané nebo zašifrované odmítne', async () => {
    const f = path.join(dir, 'smlouva.pdf'); fs.writeFileSync(f, pdf);
    const signed = await signExistingPdf(f, p12, 'heslo123', {});
    expect(verifyPdfSignatures(signed).signatures[0].valid).toBe(true);
    const f2 = path.join(dir, 'podepsana.pdf'); fs.writeFileSync(f2, signed);
    await expect(signExistingPdf(f2, p12, 'heslo123', {})).rejects.toThrow(/už obsahuje/);
    expect(signedName('/x/smlouva.pdf')).toBe('smlouva_podepsano.pdf');
});

test('nepodepsané PDF', async () => {
    expect(verifyPdfSignatures(pdf)).toMatchObject({ signed: false, signatures: [] });
});
