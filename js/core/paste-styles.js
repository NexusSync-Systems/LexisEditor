/*
 * paste-styles.js — wordovský přepínač stylů vložení pro LexisEditor (Quill).
 *
 * Po vložení formátovaného obsahu ukáže u kurzoru malý panel se třemi volbami:
 *   • Zdroj   — zachovat zdrojové formátování (výchozí, co dělal editor dosud)
 *   • Sloučit — převzít styl cílového dokumentu (zachová tučné/kurzívu/seznamy,
 *               zahodí fonty, barvy, velikosti) = „Merge formatting" ve Wordu
 *   • Jen text — vložit jako čistý text
 *
 * Přepnutí smaže právě vložený rozsah a vloží ho znovu podle zvoleného stylu.
 *
 * Soubor má dvě části:
 *   1) ČISTÉ funkce (mergeFormattingHtml, htmlToPlainText) — bez DOM závislostí
 *      na window, testovatelné v jsdom i Node.
 *   2) createController(quill) — plovoucí UI panel (jen v prohlížeči/WebView).
 *
 * Export: v prohlížeči jako window.LexisPasteStyles; v Node jako module.exports.
 */
(function (root) {
  'use strict';

  // Tagy, které „Sloučit" zachovává (struktura + zvýraznění). Vše ostatní se
  // rozbalí (span, font, …) a všechny atributy kromě href/title na odkazech se
  // zahodí → obsah převezme výchozí styly cílového dokumentu.
  var ALLOWED = {
    P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1,
    SUB: 1, SUP: 1, UL: 1, OL: 1, LI: 1, A: 1, BLOCKQUOTE: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1
  };
  var KEEP_ATTR = { A: { href: 1, title: 1 } };

  function getParser() {
    if (typeof DOMParser !== 'undefined') return new DOMParser();
    return null;
  }

  // Rozbalí zakázané tagy, přejmenuje DIV→P, zahodí atributy a inline styly.
  function cleanNode(node) {
    var children = Array.prototype.slice.call(node.childNodes);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === 3) continue;          // text — necháme
      if (child.nodeType !== 1) { child.remove(); continue; } // komentáře apod.
      cleanNode(child);                             // nejdřív potomci
      var tag = child.tagName;
      if (tag === 'DIV') {                          // DIV → P (odstavec)
        var p = child.ownerDocument.createElement('p');
        while (child.firstChild) p.appendChild(child.firstChild);
        child.parentNode.replaceChild(p, child);
        continue;
      }
      if (!ALLOWED[tag]) {                          // rozbal (span, font, …)
        var parent = child.parentNode;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
        continue;
      }
      var keep = KEEP_ATTR[tag];                    // zahoď atributy/styly
      var attrs = Array.prototype.slice.call(child.attributes);
      for (var a = 0; a < attrs.length; a++) {
        var name = attrs[a].name.toLowerCase();
        if (!keep || !keep[name]) child.removeAttribute(attrs[a].name);
      }
    }
  }

  function mergeFormattingHtml(html) {
    if (!html) return '';
    var parser = getParser();
    if (!parser) return htmlToPlainText(html); // bez DOMParseru bezpečný fallback
    var doc = parser.parseFromString(String(html), 'text/html');
    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  function htmlToPlainText(html) {
    if (!html) return '';
    var parser = getParser();
    if (parser) {
      var doc = parser.parseFromString(String(html), 'text/html');
      return doc.body.textContent || '';
    }
    return String(html).replace(/<[^>]*>/g, ''); // hrubý fallback
  }

  // ── UI kontroler (jen prohlížeč/WebView) ────────────────────────────────────
  function createController(quill) {
    if (!quill || typeof document === 'undefined') return null;

    var state = null;   // { index, length, html, text }
    var hideTimer = null;
    var el = document.createElement('div');
    el.className = 'lexis-paste-options';
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', 'Možnosti vložení');
    el.style.cssText =
      'position:absolute;z-index:2147483000;display:none;gap:2px;padding:3px;' +
      'background:#201e1d;border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.32);' +
      'font:600 12px/1 system-ui,-apple-system,sans-serif;white-space:nowrap;';

    function mkBtn(label, title, style) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.style.cssText =
        'appearance:none;border:0;cursor:pointer;color:#f3f2f2;background:transparent;' +
        'padding:6px 9px;border-radius:6px;font:inherit;';
      b.addEventListener('mouseenter', function () { b.style.background = 'rgba(255,255,255,.14)'; });
      b.addEventListener('mouseleave', function () { b.style.background = 'transparent'; });
      b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // neztratit výběr/fokus
      b.addEventListener('click', function () { apply(style); });
      return b;
    }
    el.appendChild(mkBtn('Zdroj', 'Zachovat zdrojové formátování', 'source'));
    el.appendChild(mkBtn('Sloučit', 'Převzít styl dokumentu (zachovat tučné, kurzívu, seznamy)', 'merge'));
    el.appendChild(mkBtn('Jen text', 'Vložit jako čistý text', 'text'));

    (quill.container || document.body).appendChild(el);

    function place() {
      try {
        var end = state.index + state.length;
        var b = quill.getBounds(end > 0 ? end - 1 : 0);
        el.style.left = Math.max(0, b.left) + 'px';
        el.style.top = (b.top + b.height + 4) + 'px';
      } catch (e) { /* když se nepovede, panel prostě zůstane, kde je */ }
    }

    function hide() {
      el.style.display = 'none';
      state = null;
      clearTimeout(hideTimer);
      document.removeEventListener('mousedown', onDocDown, true);
      document.removeEventListener('keydown', onKey, true);
    }

    function onDocDown(e) { if (!el.contains(e.target)) hide(); }
    function onKey(e) { if (e.key === 'Escape') hide(); }

    function apply(style) {
      if (!state) return;
      var q = quill;
      var at = state.index;
      // smaž právě vložený rozsah
      if (state.length > 0) q.deleteText(at, state.length, 'user');
      var lenBefore = q.getLength();
      if (style === 'text') {
        q.insertText(at, state.text || htmlToPlainText(state.html), 'user');
      } else if (style === 'merge') {
        q.clipboard.dangerouslyPasteHTML(at, mergeFormattingHtml(state.html), 'user');
      } else { // source
        q.clipboard.dangerouslyPasteHTML(at, state.html, 'user');
      }
      state.length = q.getLength() - lenBefore; // nová délka pro případné další přepnutí
      q.setSelection(at + state.length, 0, 'silent');
      place();
      armAutohide();
    }

    function armAutohide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, 8000); // panel po chvíli sám zmizí
    }

    // index = kam se vkládalo, length = délka vloženého, html = sanitizované HTML,
    // text = prostý text ze schránky (může být prázdný → dopočítá se z HTML).
    function show(index, length, html, text) {
      if (!html || length <= 0) return; // není co přepínat (prázdné / čistý text)
      state = { index: index, length: length, html: html, text: text || '' };
      el.style.display = 'inline-flex';
      place();
      armAutohide();
      document.addEventListener('mousedown', onDocDown, true);
      document.addEventListener('keydown', onKey, true);
    }

    return { show: show, hide: hide };
  }

  var api = {
    mergeFormattingHtml: mergeFormattingHtml,
    htmlToPlainText: htmlToPlainText,
    createController: createController
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LexisPasteStyles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
