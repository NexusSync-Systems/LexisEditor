/*
 * capacitor-bridge.js — mobilní náhrada Electron IPC (companion rozsah).
 *
 * V Electronu je to NO-OP (preload už window.electronAPI nastavil).
 * Na iOS/Androidu (Capacitor) i v čistém prohlížeči definuje window.electronAPI
 * tak, aby appka naběhla a NIKDY nespadla na „electronAPI.xxx is not a function":
 *   • funkce, které na telefonu dávají smysl (AI config, otevření URL, šablony,
 *     zámek), mají reálnou (lehkou) implementaci přes localStorage / web API;
 *   • desktop-only akce (podpis PDF, výběr certifikátu, ODESLÁNÍ do ISDS, nativní
 *     docx, render PDF, e-mail přes klienta) se slušně odkloní s hláškou
 *     „dokončete na počítači";
 *   • cokoliv nedefinovaného chytí Proxy → bezpečné Promise.resolve(null).
 *
 * Companion = telefon čte / prohlíží / lehce edituje + ptá se AI (vzdálená Ollama
 * nebo LexisLocal hub na LAN IP). Těžké právní úkony zůstávají na desktopu.
 */
(function () {
  'use strict';

  // V Electronu preload nastavil electronAPI dřív než tento skript → nic neděláme.
  if (window.electronAPI) return;

  // --- drobný toast ---
  var _toastEl = null;
  function toast(msg) {
    try {
      if (!_toastEl) {
        _toastEl = document.createElement('div');
        _toastEl.setAttribute('role', 'status');
        _toastEl.style.cssText =
          'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;' +
          'max-width:86%;padding:12px 16px;border-radius:10px;background:#201e1d;color:#f3f2f2;' +
          'font:600 14px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);' +
          'opacity:0;transition:opacity .18s;pointer-events:none;text-align:center';
        (document.body || document.documentElement).appendChild(_toastEl);
      }
      _toastEl.textContent = msg;
      _toastEl.style.opacity = '1';
      clearTimeout(_toastEl._t);
      _toastEl._t = setTimeout(function () { if (_toastEl) _toastEl.style.opacity = '0'; }, 3200);
    } catch (e) { /* bez DOM to prostě přeskočíme */ }
  }

  // --- pomůcky pro perzistenci ---
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} return true; }
  function load(key, def) { try { var v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }

  // Bezpečnostní pojistka: služby ISDS a Pošta jsou na mobilu 100% desktop-only
  // (žádné síťové volání se z telefonu neprovádí — vše je deferToDesktop). Proto
  // telefon jejich přihlašovací údaje NIKDY nepotřebuje. Na desktopu je chrání
  // SafeStorage (Keychain/DPAPI); na mobilu by ale skončily v plaintextu v
  // localStorage WebView. stripSecrets() je před uložením odstraní — zůstanou jen
  // necitlivá pole (prostředí, příznaky), takže UI ví „konfigurace existuje", ale
  // heslo do datové schránky se na telefon nikdy nezapíše.
  var SECRET_KEYS = ['password', 'heslo', 'login', 'jmeno', 'username',
    'apiKey', 'api_key', 'token', 'secret', 'passphrase',
    'pfxPassword', 'certPassword', 'clientSecret'];
  function stripSecrets(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var out = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach(function (k) {
      if (SECRET_KEYS.indexOf(k) !== -1) return;            // citlivé pole zahodíme
      var v = obj[k];
      out[k] = (v && typeof v === 'object') ? stripSecrets(v) : v;
    });
    return out;
  }

  var noop = function () {};
  var resolveNull = function () { return Promise.resolve(null); };
  var resolveTrue = function () { return Promise.resolve(true); };
  var resolveEmpty = function () { return Promise.resolve([]); };

  // Akce, která na telefonu nedává smysl → hláška + odmítnutí (UI to může zachytit).
  function deferToDesktop(name) {
    return function () {
      toast('Tuto akci dokončete na počítači (LexisEditor na Macu).');
      return Promise.reject({ mobileUnavailable: true, method: name });
    };
  }

  // ── explicitní implementace (companion) ─────────────────────────────────────
  var impl = {
    // verze / licence / token LexisLocal — synchronní hodnoty i funkce
    getAppVersion: function () { return Promise.resolve('mobile'); },
    lexisLocalToken: '',
    getLexisLocalToken: function () { return ''; },
    licenseEdition: load('lexis-license-edition', ''),

    // AI konfigurace — localStorage. Uživatel zadá endpoint desktopu (LAN IP),
    // např. http://192.168.1.50:11434/api/generate nebo http://192.168.1.50:4000
    getAIConfig: function () { return Promise.resolve(load('lexis-ai-config', null)); },
    saveAIConfig: function (c) { save('lexis-ai-config', c); return Promise.resolve(true); },

    // ISDS / Pošta — jen uložení/čtení NECITLIVÉ konfigurace (odesílání je
    // desktop-only). Přihlašovací údaje (login/heslo/apiKey) se přes stripSecrets
    // na mobilu ZÁMĚRNĚ neukládají — telefon je nepotřebuje a v localStorage by
    // byly v plaintextu. Vlož je až na desktopu (chrání je SafeStorage).
    getIsdsConfig: function () { return Promise.resolve(load('lexis-isds-config', null)); },
    saveIsdsConfig: function (c) { save('lexis-isds-config', stripSecrets(c)); return Promise.resolve(true); },
    getPostConfig: function () { return Promise.resolve(load('lexis-post-config', null)); },
    savePostConfig: function (c) { save('lexis-post-config', stripSecrets(c)); return Promise.resolve(true); },

    // šablony — z localStorage, jinak prázdné (na desktopu se plní ze souborů)
    getTemplates: function () { return Promise.resolve(load('lexis-templates', [])); },
    getTemplateContent: function (t) { var m = load('lexis-templates-content', {}); return Promise.resolve(m[t] || ''); },
    saveTemplate: function (t, c) { var m = load('lexis-templates-content', {}); m[t] = c; save('lexis-templates-content', m); return Promise.resolve(true); },
    resetTemplates: resolveTrue,

    // otevření odkazu — v prohlížeči/WebView
    openExternalUrl: function (url) { try { window.open(url, '_blank'); } catch (e) {} return Promise.resolve(true); },

    // kalendář — nabídni .ics přes data URL (OS ho otevře v Kalendáři)
    calendarOpenIcs: function (ics) { try { window.open('data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)); } catch (e) {} return Promise.resolve(true); },
    calendarSaveIcs: function (ics) { try { window.open('data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)); } catch (e) {} return Promise.resolve(true); },

    // synchronní „šifrování" at-rest — na mobilu PASSTHROUGH.
    // (Companion záměrně neukládá citlivá data lokálně; plné šifrování je desktop.)
    secureEncrypt: function (s) { return s; },
    secureDecrypt: function (b) { return b; },

    // bezpečnostní zámek — jednoduchý localStorage; biometrika zatím stub
    lockGetConfig: function () { return Promise.resolve(load('lexis-lock-config', null)); },
    lockSaveConfig: function (c) { save('lexis-lock-config', c); return Promise.resolve(true); },
    lockDeleteConfig: function () { try { localStorage.removeItem('lexis-lock-config'); } catch (e) {} return Promise.resolve(true); },
    lockVerifyPassword: resolveTrue,
    lockTouchIdAvailable: function () { return Promise.resolve(false); },
    authenticateBiometric: function () { return Promise.resolve({ success: true, mobileStub: true }); },

    // záloha šifrovacího klíče — desktop-only
    keyStatus: function () { return Promise.resolve({ mobile: true }); },
    keyBackup: deferToDesktop('keyBackup'),
    keyRestore: deferToDesktop('keyRestore'),

    // spellcheck — na mobilu řeší klávesnice OS; stuby
    spellcheckStatus: function () { return Promise.resolve({ enabled: false }); },
    spellcheckSetEnabled: resolveTrue,
    spellcheckReplace: resolveNull,
    spellcheckAddWord: resolveNull,

    // seznamy ISDS — prázdné (náhled inboxu může přijít později přes HTTP na hub)
    isdsInboxList: resolveEmpty,
    isdsOutboxList: resolveEmpty,

    // potvrzení odeslání — na telefonu není co potvrzovat
    confirmLawyerSend: resolveTrue,

    // aktualizace — řeší obchod (App Store / Play), ne electron-updater
    installUpdate: noop,

    // pending open file
    getPendingOpenFile: resolveNull,

    // ── event subscriptions → no-op ──
    onOpenFilePing: noop,
    onUpdateMessage: noop,
    onIsdsOutboxChanged: noop,
    onLexisLinkCommand: noop,
    onLexisConnectImport: noop,
    onLexisLinkScan: noop,
    onSpellcheckContext: noop,

    // ── desktop-only akce → odkloň s hláškou ──
    signPdf: deferToDesktop('signPdf'),
    pickCertificate: deferToDesktop('pickCertificate'),
    exportDocx: deferToDesktop('exportDocx'),
    exportDocxV2: deferToDesktop('exportDocxV2'),
    importDocxNative: deferToDesktop('importDocxNative'),
    renderPdfBase64: deferToDesktop('renderPdfBase64'),
    exportBundle: deferToDesktop('exportBundle'),
    composeEmailAttach: deferToDesktop('composeEmailAttach'),
    selectDirectory: deferToDesktop('selectDirectory'),
    readFileBuffer: deferToDesktop('readFileBuffer'),
    readDocxSpec: deferToDesktop('readDocxSpec'),
    docxExtractText: deferToDesktop('docxExtractText'),
    extractFileText: deferToDesktop('extractFileText'),
    importPdf: deferToDesktop('importPdf'),
    importZfo: deferToDesktop('importZfo'),
    importPdfBase64: deferToDesktop('importPdfBase64'),
    searchAres: deferToDesktop('searchAres'),
    startLexisLink: deferToDesktop('startLexisLink'),
    queryInfoJednani: deferToDesktop('queryInfoJednani'),
    // ISDS síťové operace (vyžadují certifikát/heslo → desktop)
    testIsdsConnection: deferToDesktop('testIsdsConnection'),
    isdsFindDataBox: deferToDesktop('isdsFindDataBox'),
    isdsSendMessage: deferToDesktop('isdsSendMessage'),
    isdsGetDeliveryInfo: deferToDesktop('isdsGetDeliveryInfo'),
    isdsOutboxEnqueue: deferToDesktop('isdsOutboxEnqueue'),
    isdsOutboxRetry: deferToDesktop('isdsOutboxRetry'),
    isdsOutboxRefreshStatus: deferToDesktop('isdsOutboxRefreshStatus'),
    isdsSaveSignedDelivery: deferToDesktop('isdsSaveSignedDelivery'),
    isdsInboxRefresh: deferToDesktop('isdsInboxRefresh'),
    isdsInboxDownload: deferToDesktop('isdsInboxDownload'),
    isdsInboxOpenFile: deferToDesktop('isdsInboxOpenFile'),
    isdsInboxMarkDeadline: deferToDesktop('isdsInboxMarkDeadline'),
    testPostConnection: deferToDesktop('testPostConnection')
  };

  // Proxy: cokoliv, co jsem nepokryl explicitně, nespadne — vrátí bezpečnou hodnotu.
  // onXxx → no-op subscription; ostatní → Promise.resolve(null) + varování do konzole,
  // ať v logu vidíme, co appka volá, a můžeme to postupně doimplementovat.
  window.electronAPI = new Proxy(impl, {
    get: function (target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop !== 'string') return undefined;
      console.warn('[capacitor-bridge] nedefinovaná electronAPI metoda:', prop);
      if (prop.lastIndexOf('on', 0) === 0) return noop;
      return function () { return Promise.resolve(null); };
    }
  });

  // Příznak pro appku, že běží v mobilním companion režimu (může skrýt desktop-only UI).
  try { window.LEXIS_MOBILE = true; } catch (e) {}
  console.log('[capacitor-bridge] mobilní companion režim aktivní (electronAPI shim).');
})();
