/*
 * paginated-view.js — živý náhled skutečných stránek (A4) pro LexisEditor.
 *
 * Editor je jeden souvislý Quill „papír". Tento modul z jeho obsahu poskládá
 * READ-ONLY náhled skutečných A4 listů za sebou (s mezerou mezi nimi), kde má
 * KAŽDÁ strana stejné záhlaví i zápatí a v zápatí „Strana X z Y". Obsah se
 * rozteče po stránkách podle výšky (zlom mezi bloky, text se needělí uprostřed).
 *
 * Zapíná/vypíná se přes režim „Tisk" (setViewMode('print')). Editace probíhá
 * dál v souvislém režimu; sem se jen přepne pro věrný náhled. Náhled je čistě
 * vizuální — nemění dokument ani export (PDF/DOCX jde z editoru/modelu).
 *
 * Bez závislostí; jediná čistá funkce (distribute) je popsaná níže.
 */
(function (glob) {
  'use strict';

  function create(opts) {
    opts = opts || {};
    var wrapper = opts.wrapper;                 // #editor-wrapper (zdroj obsahu)
    var scroller = opts.scroller || (wrapper && wrapper.closest ? wrapper.closest('.editor-scroll') : null);
    var quill = opts.quill || null;
    if (!wrapper || !scroller || typeof document === 'undefined') return null;

    var container = null;
    var active = false;
    var rafPending = false;

    function ensureContainer() {
      if (container && container.parentNode) return container;
      container = document.createElement('div');
      container.className = 'lex-paginated';
      container.setAttribute('aria-label', 'Náhled stránek');
      // vložíme hned za #editor-wrapper do stejného scrolleru
      var host = wrapper.parentNode || scroller;
      host.appendChild(container);
      return container;
    }

    function sourceEditor() {
      return wrapper.querySelector('.ql-editor') || wrapper.querySelector('#editor');
    }

    function headerHtml() {
      var h = document.getElementById('header-area');
      return h ? h.innerHTML : '';
    }
    function footerNodeFor(pageNo, total) {
      var f = document.getElementById('footer-area');
      var foot = document.createElement('div');
      foot.className = 'page-footer lex-sheet-footer';
      foot.innerHTML = f ? f.innerHTML : '';
      // nahraď „Strana X z Y" skutečnými čísly; když vzor chybí, doplň vpravo
      var replaced = false;
      var walker = document.createTreeWalker(foot, NodeFilter.SHOW_TEXT, null);
      var re = /Strana\s+\d+\s+z\s+\d+/i;
      var n;
      while ((n = walker.nextNode())) {
        if (re.test(n.nodeValue)) {
          n.nodeValue = n.nodeValue.replace(re, 'Strana ' + pageNo + ' z ' + total);
          replaced = true;
        }
      }
      if (!replaced) {
        var pn = document.createElement('div');
        pn.style.cssText = 'margin-left:auto;text-align:right;';
        pn.textContent = 'Strana ' + pageNo + ' z ' + total;
        foot.appendChild(pn);
      }
      return foot;
    }

    function makeSheet() {
      var sheet = document.createElement('div');
      sheet.className = 'lex-sheet';
      var head = document.createElement('div');
      head.className = 'page-header lex-sheet-header';
      head.innerHTML = headerHtml();
      var body = document.createElement('div');
      body.className = 'ql-editor lex-sheet-body';   // třída ql-editor → zdědí formátování
      sheet.appendChild(head);
      sheet.appendChild(body);
      // footer se doplní až na konci (kvůli celkovému počtu stran) — placeholder
      sheet.__body = body;
      return sheet;
    }

    // Rozteče bloky editoru po stránkách: klonuje bloky do těla aktuální strany,
    // a jakmile přeteče, přesune poslední blok na novou stranu. Vrací pole stran
    // (jejich DOM). Blok vyšší než celá strana zůstane (přeteče) a další jde dál.
    function build() {
      var ed = sourceEditor();
      ensureContainer();
      container.innerHTML = '';
      if (!ed) return;

      var blocks = Array.prototype.slice.call(ed.children);
      var sheets = [];
      var sheet = makeSheet();
      container.appendChild(sheet);
      sheets.push(sheet);
      var body = sheet.__body;

      for (var i = 0; i < blocks.length; i++) {
        var clone = blocks[i].cloneNode(true);
        body.appendChild(clone);
        if (body.scrollHeight > body.clientHeight + 1) {
          // přeteklo: pokud je na straně víc než tento blok, přesuň ho na novou
          if (body.childNodes.length > 1) {
            body.removeChild(clone);
            sheet = makeSheet();
            container.appendChild(sheet);
            sheets.push(sheet);
            body = sheet.__body;
            body.appendChild(clone);
          }
          // když blok sám přeteče stranu, necháme ho (v1) a pokračujeme dál
        }
      }

      // doplň zápatí s číslováním „Strana X z Y" (teď známe celkový počet)
      var total = sheets.length;
      for (var s = 0; s < sheets.length; s++) {
        var num = document.createElement('div');
        num.className = 'lpg-sheet-num';
        num.textContent = 'strana ' + (s + 1) + ' / ' + total;
        sheets[s].appendChild(num);
        sheets[s].appendChild(footerNodeFor(s + 1, total));
      }

      // stavový řádek: Strana 1 z N (v náhledu ukazujeme celkový počet listů)
      var pc = document.getElementById('page-count');
      if (pc) pc.textContent = 'Strana 1 z ' + total;
    }

    function rebuild() {
      if (!active) return;
      if (rafPending) return;
      rafPending = true;
      (glob.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () {
        rafPending = false;
        build();
      });
    }

    function enable() {
      if (active) { rebuild(); return; }
      active = true;
      document.body.classList.add('lex-paginated-on');
      build();
    }
    function disable() {
      if (!active) return;
      active = false;
      document.body.classList.remove('lex-paginated-on');
      if (container) container.innerHTML = '';
    }

    // když se obsah změní programově během náhledu, přestav (debounced)
    if (quill && typeof quill.on === 'function') {
      quill.on('text-change', rebuild);
    }
    if (glob.addEventListener) glob.addEventListener('resize', rebuild);

    return {
      enable: enable,
      disable: disable,
      rebuild: rebuild,
      isActive: function () { return active; }
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LexisPaginated = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
