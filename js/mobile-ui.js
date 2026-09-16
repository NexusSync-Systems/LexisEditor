/*
 * mobile-ui.js — mobilní (companion) UX vrstva LexisEditoru.
 *
 * Běží AŽ PO js/capacitor-bridge.js (ten nastaví window.LEXIS_MOBILE). Když
 * appka běží v Electronu, LEXIS_MOBILE není → tenhle skript se sám vypne a nic
 * neudělá (desktop je nedotčený). Na telefonu:
 *   1) přidá <html class="lexis-mobile"> → aktivuje pravidla z css/mobile.css,
 *   2) zobrazí nenásilný „companion" baner (telefon = doplněk desktopu),
 *   3) dá k dispozici window.lexisMobileHide(selektory) pro pozdější skrytí
 *      konkrétních desktop-only tlačítek (doladíme podle náhledu ze simulátoru).
 *
 * Bez závislostí, defenzivní (nikdy nespadne).
 */
(function () {
  'use strict';

  if (!window.LEXIS_MOBILE) return;   // Electron / desktop → konec, nic neděláme.

  var doc = document;
  var root = doc.documentElement;

  // 1) třída na <html> — okamžitě, ať CSS chytne co nejdřív (bez probliknutí)
  try { root.classList.add('lexis-mobile'); } catch (e) {}

  // 2) helper: skryj desktop-only prvky podle selektorů (idempotentní, defenzivní)
  //    Použití později: window.lexisMobileHide(['#btn-sign', '#isds-send']).
  window.lexisMobileHide = function (selectors) {
    if (!Array.isArray(selectors)) selectors = [selectors];
    var hidden = 0;
    selectors.forEach(function (sel) {
      if (typeof sel !== 'string' || !sel) return;
      var els;
      try { els = doc.querySelectorAll(sel); } catch (e) { return; }
      Array.prototype.forEach.call(els, function (el) {
        el.setAttribute('data-desktop-only', '');   // CSS ho schová
        hidden++;
      });
    });
    return hidden;
  };

  // 3) companion baner — až bude DOM připravený
  function mountBanner() {
    try {
      if (doc.querySelector('.lexis-mobile-banner')) return;
      var bar = doc.createElement('div');
      bar.className = 'lexis-mobile-banner';
      bar.setAttribute('role', 'note');

      var dot = doc.createElement('span');
      dot.className = 'lmb-dot';

      var txt = doc.createElement('span');
      txt.className = 'lmb-text';
      txt.innerHTML = '<strong>Companion režim.</strong> Čtení, náhled a lehká ' +
        'editace. Podpis, odeslání do datové schránky a export dokončíte na počítači.';

      var btn = doc.createElement('button');
      btn.className = 'lmb-close';
      btn.type = 'button';
      btn.textContent = 'Rozumím';
      btn.addEventListener('click', function () { bar.hidden = true; });

      bar.appendChild(dot);
      bar.appendChild(txt);
      bar.appendChild(btn);
      (doc.body || root).appendChild(bar);
    } catch (e) { /* baner je jen nadstavba — bez něj appka běží dál */ }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', mountBanner, { once: true });
  } else {
    mountBanner();
  }

  try { console.log('[mobile-ui] companion UX vrstva aktivní (lexis-mobile).'); } catch (e) {}
})();
