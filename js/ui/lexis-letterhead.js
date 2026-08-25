/* global window */
/**
 * LexisLetterhead — sestavení „hlavičkového papíru" advokáta ze uloženého profilu.
 * Z profilu (jméno/AK, sídlo, IČO/DIČ, ev. č. ČAK, kontakt, datová schránka, logo)
 * vygeneruje HTML do záhlaví a patičky dokumentu — tak, jak je u advokátních podání
 * zvykem: nahoře minimální identita (logo + název AK + jméno · role) vycentrovaná
 * s linkou; všechny registrační a kontaktní údaje dole v tenké patičce.
 * Vkládá se automaticky do nových dokumentů (viz resetHeaderFooterDOM v lexis-ui),
 * s možností vypnout přepínačem v profilu.
 */
(function () {
    'use strict';

    // Seznam polí profilu (klíče v úložišti settings mají prefix `lawyer-` —
    // ponechány kvůli zpětné kompatibilitě uložených profilů). `role` (funkce/
    // profese) je obecné a volitelné; `license` (ev. č. ČAK) a `isds` jsou právní.
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

    // Sestaví HTML záhlaví: vycentrované logo + název AK + řádek „jméno · role",
    // pod tím linka přes celou šířku. Minimální — detaily patří do patičky.
    // Mezihodnoty jsou RAW; escapuje se JEN na výstupu (žádné dvojité escapování).
    function buildHeaderHtml(p) {
        if (!hasContent(p)) return '';
        const nameFull = [p.title, p.name].filter(Boolean).join(' ');
        const firm = p.firm || '';
        const mainName = firm || nameFull || '';

        // Sub-řádek: je-li vyplněná AK, přidá se jméno; pak role/profese.
        // Historicky se předpokládal „advokát" — ten zachováme jen u profilů
        // s ev. č. ČAK (to má jen advokát). Obecný uživatel může mít vlastní `role`.
        const subParts = [];
        if (firm && nameFull) subParts.push(nameFull);
        if (p.role) subParts.push(p.role);
        else if (p.license) subParts.push('advokát');

        const logo = safeLogo(p.logo);
        if (!mainName && !logo && !subParts.length) return '';

        const logoHtml = logo
            ? `<div style="margin-bottom:6px;"><img src="${logo}" alt="logo" style="max-height:66px; max-width:190px; vertical-align:middle;"></div>`
            : '';
        const nameHtml = mainName
            ? `<div style="font-weight:700; font-size:13.5pt; color:#111; line-height:1.2;">${esc(mainName)}</div>`
            : '';
        const subHtml = subParts.length
            ? `<div style="font-size:9pt; color:#666; margin-top:2px;">${subParts.map(esc).join(' · ')}</div>`
            : '';

        // Tabulkové rozvržení (ne flexbox) — spolehlivě přežije i export do Wordu (DOCX).
        return `
<table style="width:100%; border-collapse:collapse; font-family:'Times New Roman', serif; border-bottom:1.5px solid #2b2926;">
    <tr>
        <td style="text-align:center; padding-bottom:9px;">${logoHtml}${nameHtml}${subHtml}</td>
    </tr>
</table>`.trim();
    }

    // Patička: všechny kontaktní a registrační údaje, drobně, vycentrovaně,
    // s linkou nahoře. 1. řádek = sídlo · tel · e-mail · web,
    // 2. řádek = ev. č. ČAK · IČO · DIČ · datová schránka.
    function buildFooterHtml(p) {
        if (!hasContent(p)) return '';
        const contact = [];
        if (p.address) contact.push(p.address);
        if (p.tel) contact.push('tel. ' + p.tel);
        if (p.email) contact.push(p.email);
        if (p.web) contact.push(p.web);
        const reg = [];
        if (p.license) reg.push('ev. č. ČAK ' + p.license);
        if (p.ico) reg.push('IČO ' + p.ico);
        if (p.dic) reg.push('DIČ ' + p.dic);
        if (p.isds) reg.push('datová schránka ' + p.isds);

        const sep = '&nbsp;&nbsp;·&nbsp;&nbsp;';
        const l1 = contact.length ? `<div>${contact.map(esc).join(sep)}</div>` : '';
        const l2 = reg.length ? `<div style="margin-top:2px;">${reg.map(esc).join(sep)}</div>` : '';
        if (!l1 && !l2) return '';

        // Tabulkové rozvržení (ne flexbox) — spolehlivě přežije i export do Wordu (DOCX).
        return `
<table style="width:100%; border-collapse:collapse; font-family:'Times New Roman', serif; border-top:1px solid #e0dbd3;">
    <tr><td style="text-align:center; font-size:7.5pt; color:#888; padding-top:6px; line-height:1.6;">${l1}${l2}</td></tr>
</table>`.trim();
    }

    window.LexisLetterhead = { FIELDS, buildHeaderHtml, buildFooterHtml, hasContent, safeLogo };
})();
