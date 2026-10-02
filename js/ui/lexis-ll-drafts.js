// lexis-ll-drafts.js — Koncepty z LexisLocalu (sdílené koncepty kanceláře) v LexisEditoru.
//
//  • Úvodní obrazovka: seznam konceptů z LexisLocalu (stav, AI, verze, připomínky).
//  • Otevření: GET /api/drafts/:id/editor-spec → applyDocumentSpec (bez ztráty struktury).
//  • Uložení zpět: getDocumentSpec → PUT /api/drafts/:id { spec, baseVersion } = nová verze.
//    Souběžná změna (409) → nabídne uložení jako samostatný koncept, nic se nepřepíše.
//  • Vazba platí jen pro dokument, který byl z konceptu otevřen (kontrola currentDocumentId),
//    aby se do konceptu omylem neuložil jiný dokument.
// Data ze serveru se vkládají přes textContent (žádné innerHTML s cizím obsahem).
(function () {
    'use strict';
    const STATUS = { koncept: 'Koncept', ke_kontrole: 'Ke kontrole', schvaleno: 'Schváleno' };
    const STATUS_STYLE = {
        koncept: 'color:#5c574f;background:#edeae4;',
        ke_kontrole: 'color:#8a5320;background:#faf0d9;',
        schvaleno: 'color:#3f6b31;background:#eaf3e6;'
    };

    function el(tag, style, text) {
        const e = document.createElement(tag);
        if (style) e.style.cssText = style;
        if (text != null) e.textContent = text;
        return e;
    }

    async function llFetch(ui, path, opts) {
        const conn = ui.getLexisLocalConnection ? ui.getLexisLocalConnection() : null;
        if (!conn || !conn.baseUrl) throw new Error('LexisLocal není připojen.');
        const res = await fetch(conn.baseUrl + path, Object.assign({}, opts || {}, {
            headers: Object.assign({}, conn.headers || {}, (opts && opts.headers) || {})
        }));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { const err = new Error(data.error || ('HTTP ' + res.status)); err.status = res.status; err.data = data; throw err; }
        return data;
    }

    const api = {
        async fetchLLDrafts() {
            const section = document.getElementById('ll-drafts-section');
            const head = document.getElementById('ll-drafts-head');
            const list = document.getElementById('ll-drafts-list');
            if (!section || !list) return;
            try {
                const data = await llFetch(this, '/api/drafts');
                const drafts = (data.drafts || []).slice(0, 12);
                list.textContent = '';
                if (!drafts.length) {
                    list.appendChild(el('div', 'font-size:11px;color:#a09a92;padding:12px 2px;', 'Žádné koncepty. Vznikají v LexisLocalu ručně nebo od AI agentů.'));
                }
                drafts.forEach((d) => {
                    const card = el('div', "background:white;border:1px solid #e0dbd3;padding:10px 12px;border-radius:8px;font-family:'Inter',sans-serif;display:flex;flex-direction:column;gap:5px;cursor:pointer;");
                    card.className = 'll-draft-card';
                    const top = el('div', 'display:flex;justify-content:space-between;align-items:flex-start;gap:6px;');
                    top.appendChild(el('div', 'font-weight:700;font-size:12px;color:#2b2926;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', d.title || 'Koncept'));
                    top.appendChild(el('span', 'font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;' + (STATUS_STYLE[d.status] || ''), STATUS[d.status] || d.status));
                    card.appendChild(top);
                    const meta = [];
                    if (d.aiGenerated) meta.push('🤖 AI');
                    meta.push('v' + d.version);
                    if (d.lastAuthor && d.lastAuthor.name) meta.push(d.lastAuthor.name);
                    if (d.caseNumber) meta.push(d.caseNumber);
                    if (d.openComments) meta.push('💬 ' + d.openComments);
                    if (d.lock) meta.push('🔒 ' + d.lock.name);
                    card.appendChild(el('div', 'font-size:10px;color:#77716a;', meta.join(' · ')));
                    if (d.preview) card.appendChild(el('div', 'font-size:10px;color:#77716a;font-style:italic;background:#faf9f7;padding:5px;border-radius:4px;line-height:1.3;max-height:3.9em;overflow:hidden;', d.preview));
                    card.onclick = () => this.openLLDraft(d.id);
                    list.appendChild(card);
                });
                section.style.display = 'block';
                if (head) head.style.display = '';
            } catch (e) {
                section.style.display = 'none';
                if (head) head.style.display = 'none';
            }
        },

        async openLLDraft(id) {
            const run = async () => {
                try {
                    const r = await llFetch(this, '/api/drafts/' + encodeURIComponent(id) + '/editor-spec');
                    if (!window.applyDocumentSpec) throw new Error('Editor neumí načíst strukturu dokumentu.');
                    const startScreen = document.getElementById('start-screen');
                    const appContainer = document.getElementById('app-container');
                    if (startScreen && appContainer) { startScreen.style.display = 'none'; appContainer.style.display = 'flex'; }
                    this.currentDocumentId = 'doc_' + Date.now();
                    // spec.title by editor vykreslil jako tučný řádek navíc → po uložení zdvojený titulek.
                    const spec = Object.assign({}, r.lexisSpec || {});
                    const title = r.title || spec.title || 'Koncept';
                    delete spec.title;
                    window.applyDocumentSpec(spec);
                    this.currentDocumentTitle = title;
                    if (this.updateDocTitleDOM) this.updateDocTitleDOM();
                    if (this.setDocumentStatus) this.setDocumentStatus(null, true);
                    if (this.saveActiveDocumentState) await this.saveActiveDocumentState();
                    if (typeof this.updateDocumentOutline === 'function') this.updateDocumentOutline();
                    this.llDraftLink = { id: r.id, version: r.version, status: r.status, title: this.currentDocumentTitle, docId: this.currentDocumentId };
                    this.renderLLDraftBar();
                } catch (e) {
                    this.customAlert('Koncept z LexisLocalu nejde otevřít: ' + window.escapeHTML(e.message));
                }
            };
            if (this.showLoader) this.showLoader('Otevírám koncept z LexisLocalu...', run); else await run();
        },

        llDraftLinkActive() {
            const l = this.llDraftLink;
            if (!l) return false;
            if (l.docId !== this.currentDocumentId) { this.llDraftLink = null; this.renderLLDraftBar(); return false; }
            return true;
        },

        async saveToLLDraft() {
            if (!this.llDraftLinkActive()) { this.customAlert('Tento dokument není otevřený z konceptu LexisLocalu.'); return; }
            const l = this.llDraftLink;
            let spec;
            try { spec = window.getDocumentSpec(); } catch (e) { this.customAlert('Dokument nejde přečíst: ' + window.escapeHTML(e.message)); return; }
            try {
                const r = await llFetch(this, '/api/drafts/' + encodeURIComponent(l.id), {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spec, baseVersion: l.version, note: 'Úprava v LexisEditoru' })
                });
                l.version = r.version; l.status = r.status;
                this.renderLLDraftBar();
                this.customAlert(r.unchanged ? 'Koncept je beze změny.' : ('✅ Uloženo do LexisLocalu jako verze ' + window.escapeHTML(r.version) + '.'));
            } catch (e) {
                const code = e.data && e.data.code;
                if (e.status === 409 && code === 'conflict') {
                    const ok = window.customConfirm
                        ? await window.customConfirm(window.escapeHTML(e.message) + '<br><br>Uložit vaši úpravu jako samostatný koncept? (nic se nepřepíše)')
                        : window.confirm(e.message + '\n\nUložit vaši úpravu jako samostatný koncept?');
                    if (!ok) return;
                    try {
                        const c = await llFetch(this, '/api/drafts', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: l.title + ' (úprava z LexisEditoru)', spec, note: 'Souběžná úprava k v' + l.version })
                        });
                        this.llDraftLink = { id: c.id, version: c.version, status: c.status, title: c.title, docId: this.currentDocumentId };
                        this.renderLLDraftBar();
                        this.customAlert('Uloženo jako nový koncept „' + window.escapeHTML(c.title) + '“.');
                    } catch (e2) { this.customAlert('Uložení se nezdařilo: ' + window.escapeHTML(e2.message)); }
                } else if (e.status === 409 && code === 'approved') {
                    // Koncept mezitím někdo schválil → lišta přepne na „jen pro čtení“.
                    l.status = 'schvaleno';
                    this.renderLLDraftBar();
                    this.customAlert('Koncept byl mezitím schválen a je jen pro čtení. Vaše úprava zůstává v editoru — uložte ji jako nový dokument, nebo nechte koncept v LexisLocalu vrátit do stavu Koncept.');
                } else {
                    this.customAlert('Uložení do LexisLocalu se nezdařilo: ' + window.escapeHTML(e.message));
                }
            }
        },

        unlinkLLDraft() { this.llDraftLink = null; this.renderLLDraftBar(); },

        renderLLDraftBar() {
            let bar = document.getElementById('ll-draft-bar');
            const active = this.llDraftLink && this.llDraftLink.docId === this.currentDocumentId;
            if (!active) { if (bar) bar.remove(); return; }
            const l = this.llDraftLink;
            if (!bar) {
                bar = el('div', "position:fixed;right:16px;bottom:16px;z-index:9000;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);background:#fff;border:1px solid #e0dbd3;border-left:4px solid #5a8a4a;border-radius:8px;padding:8px 10px;box-shadow:0 6px 18px rgba(0,0,0,0.12);font:12px 'Inter',sans-serif;color:#2b2926;");
                bar.id = 'll-draft-bar';
                document.body.appendChild(bar);
            }
            bar.textContent = '';
            const label = el('span', 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;');
            label.appendChild(el('b', null, 'Koncept LexisLocal: '));
            label.appendChild(document.createTextNode(l.title + ' (v' + l.version + ' · ' + (STATUS[l.status] || l.status) + ')'));
            bar.appendChild(label);
            const save = el('button', 'padding:5px 10px;font-size:11px;font-weight:700;color:#fff;background:#5a8a4a;border:none;border-radius:5px;cursor:pointer;white-space:nowrap;', l.status === 'schvaleno' ? 'Schváleno — jen pro čtení' : 'Uložit do LexisLocalu');
            save.disabled = l.status === 'schvaleno';
            if (save.disabled) save.style.opacity = '0.6';
            save.onclick = () => this.saveToLLDraft();
            bar.appendChild(save);
            const x = el('button', 'padding:4px 8px;font-size:11px;background:none;border:1px solid #e0dbd3;border-radius:5px;cursor:pointer;', '×');
            x.title = 'Zrušit vazbu na koncept (dokument zůstane otevřený)';
            x.onclick = () => this.unlinkLLDraft();
            bar.appendChild(x);
        }
    };

    if (typeof LexisUI !== 'undefined') {
        Object.assign(LexisUI.prototype, api);
        // Seznam konceptů se načte spolu s doručenou poštou na úvodní obrazovce.
        const origFetchInbox = LexisUI.prototype.fetchInbox;
        if (typeof origFetchInbox === 'function' && !origFetchInbox.__llDrafts) {
            const wrapped = async function () {
                const r = await origFetchInbox.apply(this, arguments);
                try { await this.fetchLLDrafts(); } catch (e) { /* LexisLocal nedostupný */ }
                return r;
            };
            wrapped.__llDrafts = true;
            LexisUI.prototype.fetchInbox = wrapped;
        }
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
