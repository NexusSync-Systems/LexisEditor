/*
 * custom-menu.js — uživatelsky konfigurovatelné položky kontextového menu editoru.
 *
 * Advokát si v malém správci nadefinuje vlastní položky, které se pak objeví
 * v kontextovém menu (pravý klik) editoru. Každá položka:
 *   • label — název v menu
 *   • type  — 'insertText' (vloží text na pozici kurzoru) | 'aiRewrite'
 *             (spustí instrukci nad výběrem přes revizi/AI)
 *   • value — vkládaný text (podporuje {datum},{rok},{cas}) nebo AI instrukce
 *
 * Perzistence běží přes app storage (settings/custom-context-items) — zajišťuje
 * volající (lexis-ui). Tento modul je bez závislostí na konkrétním úložišti.
 *
 * Čisté funkce (normalizeItems, applyPlaceholders, validateItem) jsou
 * testovatelné v Node/jsdom; render + správce běží jen v prohlížeči/Webwindow.
 */
(function (glob) {
  'use strict';

  var TYPES = { insertText: 1, aiRewrite: 1 };
  var MAX_ITEMS = 30;
  var MAX_LABEL = 60;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // {datum} → 21.09.2026, {rok} → 2026, {cas} → 14:05
  function applyPlaceholders(text, now) {
    if (!text) return '';
    var d = now || new Date();
    return String(text)
      .replace(/\{datum\}/g, pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear())
      .replace(/\{rok\}/g, String(d.getFullYear()))
      .replace(/\{cas\}/g, pad(d.getHours()) + ':' + pad(d.getMinutes()));
  }

  function validateItem(item) {
    if (!item || typeof item !== 'object') return { ok: false, error: 'Chybí data položky.' };
    var label = String(item.label == null ? '' : item.label).trim();
    if (!label) return { ok: false, error: 'Vyplňte název položky.' };
    if (label.length > MAX_LABEL) return { ok: false, error: 'Název je příliš dlouhý (max ' + MAX_LABEL + ' znaků).' };
    if (!TYPES[item.type]) return { ok: false, error: 'Neplatný typ akce.' };
    if (!String(item.value == null ? '' : item.value).trim()) {
      return { ok: false, error: item.type === 'aiRewrite' ? 'Zadejte instrukci pro AI.' : 'Zadejte text k vložení.' };
    }
    return { ok: true };
  }

  // Očistí a znormalizuje pole položek z úložiště (odolné vůči nesmyslům).
  function normalizeItems(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    for (var i = 0; i < raw.length && out.length < MAX_ITEMS; i++) {
      var it = raw[i];
      if (!it || typeof it !== 'object') continue;
      var label = String(it.label == null ? '' : it.label).trim().slice(0, MAX_LABEL);
      if (!label) continue;
      var type = TYPES[it.type] ? it.type : 'insertText';
      var value = String(it.value == null ? '' : it.value);
      if (!value.trim()) continue;
      out.push({
        id: it.id || ('cm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)),
        label: label, type: type, value: value
      });
    }
    return out;
  }

  // ── render do kontextového menu (prohlížeč) ─────────────────────────────────
  function renderInto(menuEl, items, onExec) {
    if (!menuEl || typeof document === 'undefined') return;
    Array.prototype.forEach.call(menuEl.querySelectorAll('.lexis-custom-item'), function (n) { n.remove(); });
    var anchor = menuEl.querySelector('#cm-manage-item'); // vkládáme před „Upravit…"
    (items || []).forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'context-menu-item lexis-custom-item';
      var ic = document.createElement('span');
      ic.className = 'icon';
      ic.textContent = item.type === 'aiRewrite' ? '✨' : '＋';
      div.appendChild(ic);
      div.appendChild(document.createTextNode(' ' + item.label)); // textContent = bez HTML injekce
      div.addEventListener('click', function () { if (onExec) onExec(item); });
      if (anchor) menuEl.insertBefore(div, anchor); else menuEl.appendChild(div);
    });
  }

  // Provede položku: vloží text (s náhradami), nebo pošle instrukci AI nad výběrem.
  function executeItem(item, ctx) {
    if (!item || !ctx) return;
    var quill = ctx.quill, ui = ctx.ui;
    if (item.type === 'aiRewrite') {
      if (ui && typeof ui.reviseSelectionAsRedline === 'function') ui.reviseSelectionAsRedline(item.value);
      return;
    }
    // insertText
    if (!quill) return;
    var text = applyPlaceholders(item.value, new Date());
    var r = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
    if (r.length) quill.deleteText(r.index, r.length, 'user');
    quill.insertText(r.index, text, 'user');
    quill.setSelection(r.index + text.length, 0, 'silent');
  }

  // ── správce (modál sestavený v JS, žádný zásah do index.html) ───────────────
  function openManager(opts) {
    if (typeof document === 'undefined') return;
    opts = opts || {};
    var items = normalizeItems((opts.items || []).slice());

    var ov = document.createElement('div');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Vlastní položky kontextového menu');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(20,18,17,.42);' +
      'display:flex;align-items:center;justify-content:center;font:400 14px/1.5 system-ui,-apple-system,sans-serif;';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;color:#201e1d;width:min(560px,94vw);max-height:88vh;overflow:auto;' +
      'border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:20px 22px;';
    ov.appendChild(panel);

    function h(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

    function close(save) {
      if (save && typeof opts.save === 'function') opts.save(normalizeItems(items));
      ov.remove();
      document.removeEventListener('keydown', onKey, true);
    }
    function onKey(e) { if (e.key === 'Escape') close(true); }

    function render() {
      panel.innerHTML = '';
      var title = h('<h2 style="margin:0 0 4px;font:800 20px/1.2 system-ui;letter-spacing:-.01em">Vlastní položky menu</h2>');
      var sub = h('<p style="margin:0 0 16px;color:#605d5d;font-size:13px">Objeví se v kontextovém menu editoru (pravý klik). V textu můžete použít <b>{datum}</b>, <b>{rok}</b>, <b>{cas}</b>.</p>');
      panel.appendChild(title); panel.appendChild(sub);

      var list = document.createElement('div');
      if (!items.length) {
        list.appendChild(h('<div style="padding:14px;border:1px dashed #d7d3d3;border-radius:8px;color:#7d7979;text-align:center">Zatím žádné položky. Přidejte první níže.</div>'));
      }
      items.forEach(function (it, i) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #eae9e9;border-radius:8px;margin-bottom:6px';
        var badge = it.type === 'aiRewrite' ? '✨ AI' : '＋ text';
        var meta = document.createElement('div');
        meta.style.cssText = 'flex:1;min-width:0';
        var nm = document.createElement('div'); nm.style.cssText = 'font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; nm.textContent = it.label;
        var ty = document.createElement('div'); ty.style.cssText = 'font-size:11px;color:#7d7979'; ty.textContent = badge;
        meta.appendChild(nm); meta.appendChild(ty);
        var del = h('<button type="button" style="border:1px solid #d7d3d3;background:#fff;border-radius:6px;padding:5px 10px;cursor:pointer;font:600 12px system-ui;color:#a52218">Smazat</button>');
        del.addEventListener('click', function () { items.splice(i, 1); render(); });
        row.appendChild(meta); row.appendChild(del);
        list.appendChild(row);
      });
      panel.appendChild(list);

      // formulář „přidat"
      var form = document.createElement('div');
      form.style.cssText = 'margin-top:14px;padding-top:14px;border-top:2px solid #201e1d';
      var inLabel = h('<input type="text" maxlength="60" placeholder="Název (např. Doložka o mlčenlivosti)" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d7d3d3;border-radius:8px;margin-bottom:8px;font:inherit">');
      var selType = h('<select style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d7d3d3;border-radius:8px;margin-bottom:8px;font:inherit"><option value="insertText">Vložit text na pozici kurzoru</option><option value="aiRewrite">AI: přepsat výběr podle instrukce</option></select>');
      var inValue = h('<textarea rows="3" placeholder="Text k vložení, nebo AI instrukce (např. „přepiš spisovnou češtinou")" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d7d3d3;border-radius:8px;font:inherit;resize:vertical"></textarea>');
      var err = h('<div style="color:#a52218;font-size:12px;min-height:16px;margin:4px 0"></div>');
      var addBtn = h('<button type="button" style="border:0;background:#201e1d;color:#f3f2f2;border-radius:8px;padding:9px 16px;cursor:pointer;font:700 13px system-ui">Přidat položku</button>');
      addBtn.addEventListener('click', function () {
        var cand = { label: inLabel.value, type: selType.value, value: inValue.value };
        var v = validateItem(cand);
        if (!v.ok) { err.textContent = v.error; return; }
        items = normalizeItems(items.concat([cand]));
        render();
      });
      form.appendChild(inLabel); form.appendChild(selType); form.appendChild(inValue); form.appendChild(err); form.appendChild(addBtn);
      panel.appendChild(form);

      // patička
      var foot = document.createElement('div');
      foot.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
      var done = h('<button type="button" style="border:1px solid #201e1d;background:#fff;border-radius:8px;padding:9px 16px;cursor:pointer;font:700 13px system-ui">Hotovo</button>');
      done.addEventListener('click', function () { close(true); });
      foot.appendChild(done);
      panel.appendChild(foot);
    }

    render();
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(true); });
    document.addEventListener('keydown', onKey, true);
    (document.body || document.documentElement).appendChild(ov);
  }

  var api = {
    applyPlaceholders: applyPlaceholders,
    validateItem: validateItem,
    normalizeItems: normalizeItems,
    renderInto: renderInto,
    executeItem: executeItem,
    openManager: openManager
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LexisCustomMenu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
