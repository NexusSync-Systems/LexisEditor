/*
 * page-guides.js — živé rozvržení stránek (A4) v souvislém editoru LexisEditor.
 *
 * Editor je jeden souvislý Quill „papír". Tento modul přes něj kreslí vodicí
 * linky tam, kde skončí stránka, a čísluje strany — a živě počítá stavový
 * řádek (Strana X z Y, Slova, Znaky, Normostrany).
 *
 * DŮLEŽITÉ: počet stran se počítá STEJNĚ jako v náhledu „Tisk"
 * (paginated-view.js) — každá strana má vlastní záhlaví + zápatí, takže
 * využitelná výška strany = A4 − záhlaví − zápatí − okraje. Zlomy padají na
 * hranice bloků (odstavců), takže se text nikdy nerozdělí uprostřed.
 *
 * Čistě vizuální vrstva (žádná změna dokumentu ani exportu). Čisté funkce
 * (countChars/countWords/normostrany/pageCountFromHeight/snapToGap) jsou
 * testovatelné v Node/jsdom.
 */
(function (glob) {
  'use strict';

  var A4_MM = 297;                 // výška A4 na výšku
  var MARGIN_MM = 15;              // okraj (shodně s .ql-editor padding)
  var NS_CHARS = 1800;             // 1 normostrana = 1800 znaků vč. mezer
  var MM_FALLBACK = 96 / 25.4;     // 96 dpi fallback (≈3.7795 px/mm)

  // ── čisté funkce (testovatelné) ─────────────────────────────────────────────
  function countChars(text) {
    if (!text) return 0;
    return String(text).replace(/\n$/, '').length; // bez koncového '\n' z Quillu
  }
  function countWords(text) {
    if (!text) return 0;
    var t = String(text).trim();
    return t ? t.split(/\s+/).length : 0;
  }
  function normostrany(chars) {
    return (Math.max(0, chars) / NS_CHARS);
  }
  // Ponecháno pro zpětnou kompatibilitu/testy: hrubý počet stran z výšky.
  function pageCountFromHeight(heightPx, pagePx) {
    if (!(pagePx > 0)) return 1;
    return Math.max(1, Math.ceil((heightPx - 2) / pagePx));
  }
  // Posuň ideální zlom do MEZERY mezi řádky (ponecháno + testováno; využívá se
  // jako pojistka, hlavní zlomy teď padají rovnou na hranice bloků).
  function snapToGap(idealY, boxes) {
    if (!boxes || !boxes.length) return idealY;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (idealY < b.top) return idealY;
      if (idealY <= b.bottom) return b.top - 1;
    }
    return idealY;
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
    var scroller = opts.scroller || (wrapper && wrapper.closest ? wrapper.closest('.editor-scroll') : null);
    var quill = opts.quill || null;
    if (!wrapper || typeof document === 'undefined') return null;

    var overlay = document.createElement('div');
    overlay.className = 'lexis-page-guides';
    overlay.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(overlay);

    var pxPerMm = null;
    var enabled = true;
    var scheduled = false;
    var curPage = 1;
    var totalPages = 1;
    var breaksY = [];   // wrapper-relativní Y jednotlivých zlomů (začátky stran 2..N)

    function editorEl() {
      return wrapper.querySelector('.ql-editor') || wrapper.querySelector('#editor');
    }

    // Geometrie strany: využitelná výška = A4 − záhlaví − zápatí − 2× okraj.
    function pageGeom() {
      if (pxPerMm == null) pxPerMm = measurePxPerMm(wrapper);
      var padPx = MARGIN_MM * pxPerMm;
      var pagePx = A4_MM * pxPerMm;
      var h = document.getElementById('header-area');
      var f = document.getElementById('footer-area');
      var headerPx = h ? h.offsetHeight : 0;
      var footerPx = f ? f.offsetHeight : 0;
      var usable = pagePx - headerPx - footerPx - 2 * padPx;
      if (!(usable > 60)) usable = pagePx - 2 * padPx; // pojistka
      return { pagePx: pagePx, usable: usable };
    }

    // Zlomy stran metodou toku bloků (shodně s náhledem „Tisk"): plň stranu bloky,
    // dokud se vejdou do využitelné výšky; jinak zlom PŘED blokem, který přeteče.
    function computeBreaks() {
      var ed = editorEl();
      if (!ed) return [];
      var cap = pageGeom().usable;
      if (!(cap > 0)) return [];
      var wTop = wrapper.getBoundingClientRect().top;
      var blocks = ed.children;
      var out = [];
      var pageStartTop = null; // viewport-Y horní hrany první bloku na aktuální straně
      var firstIdx = -1;
      for (var i = 0; i < blocks.length; i++) {
        var r = blocks[i].getBoundingClientRect();
        if (r.height <= 0) continue;
        if (pageStartTop == null) { pageStartTop = r.top; firstIdx = i; }
        if ((r.bottom - pageStartTop) > cap && i > firstIdx) {
          out.push(r.top - wTop);   // zlom začíná tímto blokem
          pageStartTop = r.top;
          firstIdx = i;
        }
      }
      return out;
    }

    function computeCurrentPage() {
      if (!scroller) return 1;
      try {
        var scTop = scroller.getBoundingClientRect().top;
        var wTop = wrapper.getBoundingClientRect().top;
        var into = (scTop - wTop) + 4; // kolik px wrapperu je nad horním okrajem viewportu
        var cp = 1;
        for (var i = 0; i < breaksY.length; i++) {
          if (breaksY[i] <= into) cp++; else break;
        }
        return Math.min(totalPages, cp);
      } catch (e) { return 1; }
    }

    function setStatus() {
      // v režimu náhledu „Tisk" o stavový řádek pečuje paginated-view
      try { if (document.body.classList.contains('lex-paginated-on')) return; } catch (e) {}
      var chars = 0, words = 0;
      if (quill && typeof quill.getText === 'function') {
        var txt = quill.getText();
        chars = countChars(txt);
        words = countWords(txt);
      }
      var pc = document.getElementById('page-count');
      if (pc) pc.textContent = 'Strana ' + Math.min(curPage, totalPages) + ' z ' + totalPages;
      var wc = document.getElementById('word-cnt');
      if (wc) wc.textContent = String(words);
      var cc = document.getElementById('char-cnt');
      if (cc) cc.textContent = String(chars);
      var ns = document.getElementById('ns-cnt');
      if (ns) ns.textContent = normostrany(chars).toFixed(2);
    }

    function draw() {
      scheduled = false;
      breaksY = computeBreaks();
      totalPages = breaksY.length + 1;
      curPage = computeCurrentPage();
      setStatus();

      if (!enabled) { overlay.innerHTML = ''; overlay.style.display = 'none'; return; }
      overlay.style.display = 'block';
      overlay.innerHTML = '';

      // číslo strany nahoře v oblasti každé strany
      for (var i = 0; i < totalPages; i++) {
        var topY = (i === 0) ? 6 : (breaksY[i - 1] + 6);
        var num = document.createElement('div');
        num.className = 'lpg-pagenum';
        num.style.top = topY + 'px';
        num.textContent = 'strana ' + (i + 1);
        overlay.appendChild(num);
      }
      // dělicí linka na začátku každé další strany (leží na hranici bloku)
      for (var j = 0; j < breaksY.length; j++) {
        var line = document.createElement('div');
        line.className = 'lpg-line';
        line.style.top = breaksY[j] + 'px';
        var tag = document.createElement('span');
        tag.className = 'lpg-line-tag';
        tag.textContent = 'konec strany ' + (j + 1);
        line.appendChild(tag);
        overlay.appendChild(line);
      }
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      (glob.requestAnimationFrame || function (f) { setTimeout(f, 16); })(draw);
    }

    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule);
      ro.observe(wrapper);
    }
    if (glob.addEventListener) glob.addEventListener('resize', function () {
      pxPerMm = null;
      schedule();
    });
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
          curPage = computeCurrentPage();
          setStatus();
        });
      }, { passive: true });
    }

    function setEnabled(on) {
      enabled = !!on;
      try { wrapper.classList.toggle('lexis-pages-on', enabled); } catch (e) {}
      schedule();
    }
    setEnabled(true);
    schedule();

    return {
      refresh: function () { pxPerMm = null; schedule(); },
      setEnabled: setEnabled,
      isEnabled: function () { return enabled; },
      pageCount: function () { return totalPages; },
      destroy: function () { try { if (ro) ro.disconnect(); overlay.remove(); } catch (e) {} }
    };
  }

  var api = {
    countChars: countChars,
    countWords: countWords,
    normostrany: normostrany,
    pageCountFromHeight: pageCountFromHeight,
    snapToGap: snapToGap,
    create: create
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LexisPageGuides = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
