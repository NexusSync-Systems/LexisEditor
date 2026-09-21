/*
 * page-guides.js — živé rozvržení stránek (A4) v editoru LexisEditor.
 *
 * Editor je jeden souvislý „papír" (#editor-wrapper, 210mm široký, roste do
 * výšky). Uživatel proto viděl „jednu dlouhatánskou stránku". Tento modul
 * nakreslí PŘES obsah vodicí linky přesně po výšce A4 (297 mm) a očísluje
 * strany — takže je vidět, kde stránka končí a začíná další, aniž by se
 * zasahovalo do toku textu nebo do exportu (PDF/DOCX stránkuje samo).
 *
 * Zároveň dopočítává živě stavový řádek: Strana X z Y, Slova, Znaky,
 * Normostrany (1 NS = 1800 znaků vč. mezer) — dosud byly tyto ukazatele
 * statické.
 *
 * Vizuální vrstva (žádná změna výstupu). Bez závislostí; čistá logika
 * (countWords, countChars, normostrany, pageCountFromHeight) je testovatelná
 * v Node/jsdom.
 */
(function (glob) {
  'use strict';

  var A4_MM = 297;                 // výška A4 na výšku
  var NS_CHARS = 1800;             // 1 normostrana = 1800 znaků vč. mezer
  var MM_FALLBACK = 96 / 25.4;     // 96 dpi fallback (≈3.7795 px/mm)

  // ── čisté funkce (testovatelné) ─────────────────────────────────────────────
  function countChars(text) {
    if (!text) return 0;
    // Quill vrací text s koncovým '\n' — ten do počtu znaků nepatří.
    return String(text).replace(/\n$/, '').length;
  }
  function countWords(text) {
    if (!text) return 0;
    var t = String(text).trim();
    return t ? t.split(/\s+/).length : 0;
  }
  function normostrany(chars) {
    return (Math.max(0, chars) / NS_CHARS);
  }
  // Počet vizuálních A4 stran z výšky obsahu (px) a výšky jedné strany (px).
  function pageCountFromHeight(heightPx, pagePx) {
    if (!(pagePx > 0)) return 1;
    // malá tolerance kvůli sub-pixelovému zaokrouhlení, ať poslední „skoro
    // plná" strana nepřeskočí zbytečně na další.
    return Math.max(1, Math.ceil((heightPx - 2) / pagePx));
  }

  // ── DOM část (jen prohlížeč / WebView) ──────────────────────────────────────
  function measurePxPerMm(container) {
    if (typeof document === 'undefined') return MM_FALLBACK;
    try {
      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;height:100mm;' +
        'width:1mm;visibility:hidden;pointer-events:none;';
      (container || document.body).appendChild(probe);
      var h = probe.getBoundingClientRect().height || probe.offsetHeight;
      probe.parentNode.removeChild(probe);
      return h > 0 ? h / 100 : MM_FALLBACK;
    } catch (e) { return MM_FALLBACK; }
  }

  function create(opts) {
    opts = opts || {};
    var wrapper = opts.wrapper;
    var quill = opts.quill || null;
    var scroller = opts.scroller || (wrapper.closest ? wrapper.closest('.editor-scroll') : null);
    if (!wrapper || typeof document === 'undefined') return null;

    var overlay = document.createElement('div');
    overlay.className = 'lexis-page-guides';
    overlay.setAttribute('aria-hidden', 'true');
    // wrapper má position:relative → overlay se posadí přesně na něj.
    wrapper.appendChild(overlay);

    var pxPerMm = null;
    var enabled = true;
    var scheduled = false;
    var lastSig = '';
    var curPage = 1;
    var totalPages = 1;

    function pagePx() {
      if (pxPerMm == null) pxPerMm = measurePxPerMm(wrapper);
      return A4_MM * pxPerMm;
    }

    function computeCurrentPage(pp, pages) {
      if (!scroller || !(pp > 0)) return 1;
      try {
        var scRect = scroller.getBoundingClientRect();
        var wRect = wrapper.getBoundingClientRect();
        // kolik px wrapperu je nad horním okrajem viewportu (+ malý posun do strany)
        var into = (scRect.top - wRect.top) + 4;
        return Math.min(pages, Math.max(1, Math.floor(into / pp) + 1));
      } catch (e) { return 1; }
    }

    function setStatus(pages) {
      var chars = 0, words = 0;
      if (quill && typeof quill.getText === 'function') {
        var txt = quill.getText();
        chars = countChars(txt);
        words = countWords(txt);
      }
      var pc = document.getElementById('page-count');
      if (pc) pc.textContent = 'Strana ' + Math.min(curPage, pages) + ' z ' + pages;
      var wc = document.getElementById('word-cnt');
      if (wc) wc.textContent = String(words);
      var cc = document.getElementById('char-cnt');
      if (cc) cc.textContent = String(chars);
      var ns = document.getElementById('ns-cnt');
      if (ns) ns.textContent = normostrany(chars).toFixed(2);
    }

    function draw() {
      scheduled = false;
      var pp = pagePx();
      var h = wrapper.offsetHeight || 0;
      var pages = pageCountFromHeight(h, pp);
      totalPages = pages;
      curPage = computeCurrentPage(pp, pages);

      // vždy aktualizuj stavový řádek (i když se linky nepřekreslují)
      setStatus(pages);

      if (!enabled) { overlay.innerHTML = ''; overlay.style.display = 'none'; return; }
      overlay.style.display = 'block';

      // překresli jen když se změnil počet stran nebo výška strany (výkon)
      var sig = pages + '@' + Math.round(pp);
      if (sig === lastSig && overlay.childNodes.length) return;
      lastSig = sig;

      overlay.innerHTML = '';
      // číslo strany pro každou stranu (vpravo nahoře v oblasti strany)
      for (var i = 0; i < pages; i++) {
        var num = document.createElement('div');
        num.className = 'lpg-pagenum';
        num.style.top = (i * pp + 6) + 'px';
        num.textContent = 'strana ' + (i + 1);
        overlay.appendChild(num);
      }
      // dělicí linka na konci každé strany kromě poslední
      for (var j = 1; j < pages; j++) {
        var line = document.createElement('div');
        line.className = 'lpg-line';
        line.style.top = (j * pp) + 'px';
        var tag = document.createElement('span');
        tag.className = 'lpg-line-tag';
        tag.textContent = 'konec strany ' + j;
        line.appendChild(tag);
        overlay.appendChild(line);
      }
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      (glob.requestAnimationFrame || function (f) { setTimeout(f, 16); })(draw);
    }

    // ResizeObserver = nejspolehlivější spouštěč: chytí každou změnu výšky
    // wrapperu (psaní, obrázky, hlavička/patička, změna režimu, zoom).
    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule);
      ro.observe(wrapper);
    }
    if (glob.addEventListener) glob.addEventListener('resize', function () {
      pxPerMm = null;         // px/mm se může změnit při zoomu okna
      lastSig = '';
      schedule();
    });
    // psaní také přepočítá slova/znaky hned (ResizeObserver řeší jen výšku)
    if (quill && typeof quill.on === 'function') {
      quill.on('text-change', schedule);
    }
    // posun = jen přepočítej „Strana X z Y" (bez překreslování linek → plynulé)
    if (scroller && scroller.addEventListener) {
      var scrollRaf = false;
      scroller.addEventListener('scroll', function () {
        if (scrollRaf) return;
        scrollRaf = true;
        (glob.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () {
          scrollRaf = false;
          var pp = pagePx();
          curPage = computeCurrentPage(pp, totalPages);
          setStatus(totalPages);
        });
      }, { passive: true });
    }

    function setEnabled(on) {
      enabled = !!on;
      try { wrapper.classList.toggle('lexis-pages-on', enabled); } catch (e) {}
      lastSig = '';
      schedule();
    }
    setEnabled(true);
    schedule();

    return {
      refresh: function () { pxPerMm = null; lastSig = ''; schedule(); },
      setEnabled: setEnabled,
      isEnabled: function () { return enabled; },
      pageCount: function () { return pageCountFromHeight(wrapper.offsetHeight || 0, pagePx()); },
      destroy: function () { try { if (ro) ro.disconnect(); overlay.remove(); } catch (e) {} }
    };
  }

  var api = {
    countChars: countChars,
    countWords: countWords,
    normostrany: normostrany,
    pageCountFromHeight: pageCountFromHeight,
    create: create
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LexisPageGuides = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
