/* global window */
/**
 * LexisLetterhead — sestavení „hlavičkového papíru" advokáta ze uloženého profilu.
 * Z profilu (jméno/AK, sídlo, IČO/DIČ, ev. č. ČAK, kontakt, datová schránka, logo)
 * vygeneruje HTML do záhlaví a patičky dokumentu.
 *
 * Rozvržení hlavičky: čistý „hlavičkový papír" — logo vlevo, identita a údaje
 * kanceláře vpravo zarovnané, pod tím jemná linka. Bez loga se identita zarovná
 * vlevo přes celou šířku. Tabulkové rozvržení (ne flexbox), aby spolehlivě přežilo
 * i export do Wordu (DOCX). Vkládá se automaticky do nových dokumentů
 * (viz resetHeaderFooterDOM), s možností vypnout přepínačem v profilu.
 */
(function () {
    'use strict';

    // Seznam polí profilu (klíče v úložišti settings mají prefix `lawyer-`).
    const FIELDS = ['title', 'name', 'firm', 'role', 'license', 'address', 'ico', 'dic', 'tel', 'email', 'web', 'isds', 'logo', 'auto'];

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    // Má profil aspoň nějaký smysluplný obsah pro hlavičku?
    function hasContent(p) {
        if (!p) return false;
        return !!(p.name || p.firm || p.address || p.ico || p.license || p.tel || p.email || p.web || p.isds || p.logo);
    }

    // Bezpečné logo: jen data:image/... (žádné externí URL / skripty).
    function safeLogo(logo) {
        const s = String(logo || '');
        return /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);/i.test(s) ? s : '';
    }

    // Řádky identity vpravo (název/jméno · role, adresa, IČO · DIČ · ČAK, tel · e-mail · web).
    function identityLines(p) {
        const nameFull = [p.title, p.name].filter(Boolean).join(' ');
        const firm = p.firm || '';
        const mainName = firm || nameFull || '';
        const lines = [];
        if (mainName) lines.push('<div style="font-weight:700; color:#23201b;">' + esc(mainName) + '</div>');
        if (firm && nameFull) {
            const sub = [nameFull];
            if (p.role) sub.push(p.role); else if (p.license) sub.push('advokát');
            lines.push('<div>' + sub.map(esc).join(' · ') + '</div>');
        } else if (p.role) {
            lines.push('<div>' + esc(p.role) + '</div>');
        }
        if (p.address) lines.push('<div>' + esc(p.address) + '</div>');
        const reg = [];
        if (p.ico) reg.push('IČO ' + p.ico);
        if (p.dic) reg.push('DIČ ' + p.dic);
        if (p.license) reg.push('ev. č. ČAK ' + p.license);
        if (reg.length) lines.push('<div>' + reg.map(esc).join(' · ') + '</div>');
        const contact = [];
        if (p.tel) contact.push('tel. ' + p.tel);
        if (p.email) contact.push(p.email);
        if (p.web) contact.push(p.web);
        if (contact.length) lines.push('<div>' + contact.map(esc).join(' · ') + '</div>');
        return lines.join('');
    }

    // Hlavička: logo vlevo, identita vpravo, jemná linka pod tím.
    function buildHeaderHtml(p) {
        if (!hasContent(p)) return '';
        const logo = safeLogo(p.logo);
        const identity = identityLines(p);
        if (!identity && !logo) return '';
        const logoCell = logo
            ? '<td style="vertical-align:middle; white-space:nowrap; padding-right:16px; width:1%;"><img src="' + logo + '" alt="logo" style="max-height:60px; max-width:220px; vertical-align:middle;"></td>'
            : '';
        const align = logo ? 'right' : 'left';
        return ('<table style="width:100%; border-collapse:collapse; font-family:\'Segoe UI\',Arial,sans-serif; border-bottom:1px solid #ddd6cb;">'
            + '<tr>'
            + logoCell
            + '<td style="vertical-align:middle; text-align:' + align + '; font-size:9.5pt; color:#4a453f; line-height:1.45; padding-bottom:8px;">' + identity + '</td>'
            + '</tr>'
            + '</table>');
    }

    // Patička: jen to, co není v hlavičce (datová schránka), drobně a vycentrovaně.
    function buildFooterHtml(p) {
        if (!hasContent(p)) return '';
        const parts = [];
        if (p.isds) parts.push('datová schránka ' + p.isds);
        if (!parts.length) return '';
        const sep = '&nbsp;&nbsp;·&nbsp;&nbsp;';
        return ('<table style="width:100%; border-collapse:collapse; font-family:\'Segoe UI\',Arial,sans-serif; border-top:1px solid #e0dbd3;">'
            + '<tr><td style="text-align:center; font-size:7.5pt; color:#888; padding-top:6px; line-height:1.6;">' + parts.map(esc).join(sep) + '</td></tr>'
            + '</table>');
    }

    window.LexisLetterhead = { FIELDS, buildHeaderHtml, buildFooterHtml, hasContent, safeLogo, identityLines };
})();
