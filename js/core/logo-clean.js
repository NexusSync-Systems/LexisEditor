/*
 * logo-clean.js — automatické očištění loga při vložení do záhlaví/zápatí.
 *
 * Cíl: aby nebylo poznat, že je logo „vložený obrázek". Při vložení proto:
 *   1) odstraní (skoro) bílé POZADÍ → průhledné (flood-fill od okrajů, takže
 *      bílá UVNITŘ znaků/písmen zůstane a nevzniknou díry),
 *   2) těsně OŘÍZNE na obsah (odstraní bílé okraje),
 *   3) volitelně zmenší na rozumnou velikost.
 *
 * Čistá funkce keyAndBBox(px,w,h,threshold) je testovatelná v Node (pracuje jen
 * s polem pixelů). cleanLogo(dataUrl) je DOM část (canvas), vrací Promise<dataUrl>.
 */
(function (glob) {
  'use strict';

  // Flood-fill od okrajů: pixely „skoro bílé" spojené s okrajem → alpha 0.
  // Vrací bounding box neprůhledného obsahu. MUTUJE px (Uint8ClampedArray/Array).
  function keyAndBBox(px, w, h, threshold) {
    var thr = threshold || 236;
    function isBg(i) { return px[i] >= thr && px[i + 1] >= thr && px[i + 2] >= thr; }
    var visited = new Uint8Array(w * h);
    var stack = [];
    function pushIf(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      var p = y * w + x;
      if (visited[p]) return;
      visited[p] = 1;
      var i = p * 4;
      if (px[i + 3] !== 0 && isBg(i)) { px[i + 3] = 0; stack.push(p); }
    }
    var x, y;
    for (x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
    for (y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
    while (stack.length) {
      var p = stack.pop(); var py = (p / w) | 0, pxx = p % w;
      pushIf(pxx + 1, py); pushIf(pxx - 1, py); pushIf(pxx, py + 1); pushIf(pxx, py - 1);
    }
    // bbox neprůhledných pixelů
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] > 12) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  // ── DOM část (canvas) ───────────────────────────────────────────────────
  function cleanLogo(dataUrl, opts) {
    opts = opts || {};
    var maxDim = opts.maxDim || 1400;
    var pad = (opts.pad == null) ? 2 : opts.pad;
    var threshold = opts.threshold || 236;
    return new Promise(function (resolve) {
      if (typeof document === 'undefined' || !dataUrl) { resolve(dataUrl); return; }
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) { resolve(dataUrl); return; }
          // případné zmenšení kvůli výkonu i velikosti výstupu
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var sw = Math.max(1, Math.round(w * scale));
          var sh = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = sw; canvas.height = sh;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, sw, sh);
          var imageData;
          try { imageData = ctx.getImageData(0, 0, sw, sh); }
          catch (e) { resolve(dataUrl); return; } // taint apod. → nech původní
          var box = keyAndBBox(imageData.data, sw, sh, threshold);
          if (box.maxX < box.minX || box.maxY < box.minY) { resolve(dataUrl); return; }
          ctx.putImageData(imageData, 0, 0);
          var minX = Math.max(0, box.minX - pad), minY = Math.max(0, box.minY - pad);
          var maxX = Math.min(sw - 1, box.maxX + pad), maxY = Math.min(sh - 1, box.maxY + pad);
          var cw = maxX - minX + 1, ch = maxY - minY + 1;
          var out = document.createElement('canvas');
          out.width = cw; out.height = ch;
          out.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
          resolve(out.toDataURL('image/png'));
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  // Ověří, že obrázek jde plně dekódovat (odhalí useknuté/poškozené soubory,
  // které se v prohlížeči „napůl" vykreslí jako šum). Vrací Promise<boolean>.
  function isDecodable(dataUrl) {
    return new Promise(function (res) {
      if (typeof document === 'undefined' || !dataUrl) { res(true); return; }
      var img = new Image();
      if (typeof img.decode === 'function') {
        img.src = dataUrl;
        img.decode().then(function () { res(true); }).catch(function () { res(false); });
      } else {
        img.onload = function () { res(true); };
        img.onerror = function () { res(false); };
        img.src = dataUrl;
      }
    });
  }

  var api = { keyAndBBox: keyAndBBox, cleanLogo: cleanLogo, isDecodable: isDecodable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LexisLogoClean = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
