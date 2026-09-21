/**
 * Přehledné okno Nastavení (svislý panel se sekcemi) — nahrazuje matoucí
 * vodorovnou lištu jako hlavní vstup. Napojeno na reálné existující funkce.
 */
(function () {
  const GEAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const ic = (p) => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const I_AI = ic('<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/>');
  const I_DS = ic('<path d="M14 3.5v5h5"/><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M8.8 14.2l2 2 4.2-4.4"/>');
  const I_DB = ic('<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V6"/><path d="M5 12c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6"/>');
  const I_LOOK = ic('<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="9.5" r="1"/><circle cx="15.5" cy="9.5" r="1"/><circle cx="9" cy="15" r="1"/><path d="M12 20.5a8.5 8.5 0 0 0 0-17"/>');
  const I_HELP = ic('<path d="M9 16a5.5 5.5 0 1 1 6 0v1.5H9z"/><path d="M9.4 20h5.2M10.5 21.6h3"/>');
  const I_LOCK = ic('<rect x="5" y="10.2" width="14" height="9.8" rx="2"/><path d="M8 10.2V7a4 4 0 0 1 8 0v3.2"/><circle cx="12" cy="14.6" r="1.1"/>');

  const card = (icon, title, rows) =>
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:4px 20px 12px;box-shadow:var(--shadow-card);">'
    + '<div style="display:flex;align-items:center;gap:10px;padding:14px 0 6px;">' + icon + '<span style="font:700 14.5px var(--font-ui);color:var(--ink);">' + title + '</span></div>'
    + rows + '</div>';
  const row = (label, help, control) =>
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-top:1px solid var(--border-soft);">'
    + '<div style="min-width:0;"><div style="font:600 13.5px var(--font-ui);color:var(--ink);">' + label + '</div>'
    + (help ? '<div style="font-size:12px;color:var(--text-faint);margin-top:1px;">' + help + '</div>' : '') + '</div>'
    + control + '</div>';
  const btn = (id, text, primary) => '<button id="' + id + '" style="flex:none;border:' + (primary ? 'none' : '1px solid var(--border-strong)') + ';background:' + (primary ? 'var(--btn-primary-bg)' : 'var(--surface-2)') + ';color:' + (primary ? 'var(--btn-primary-text)' : 'var(--ink)') + ';font:600 13px var(--font-ui);padding:9px 16px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;">' + text + '</button>';
  const toggle = (id, on) => '<div id="' + id + '" style="width:40px;height:23px;border-radius:12px;background:' + (on ? 'var(--accent)' : 'var(--border-strong)') + ';position:relative;flex:none;cursor:pointer;"><div style="width:19px;height:19px;border-radius:50%;background:#fff;position:absolute;top:2px;left:' + (on ? '19px' : '2px') + ';box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .15s;"></div></div>';

  window.showSettingsModal = function () {
    const old = document.getElementById('lexis-settings-modal'); if (old) old.remove();
    const provEl = document.getElementById('ai-provider');
    const pv = provEl ? provEl.value : 'lexislocal';
    const pmap = { lexislocal: 'LexisLocal (offline)', apfel: 'Apple Intelligence', ollama: 'Ollama (lokální)', lmstudio: 'LM Studio (lokální)' };
    const provLabel = pmap[pv] || 'Lokální model';
    const isDark = document.body.classList.contains('dark-mode');

    const aiNote = '<div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding:11px 13px;background:rgba(90,138,74,.10);border:1px solid rgba(90,138,74,.28);border-radius:10px;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4a7a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l7 3v5.4c0 4.2-3 6.8-7 7.9-4-1.1-7-3.7-7-7.9V6.5z"/><path d="M9.2 11.8l2 2 3.8-4"/></svg><span style="font-size:12.5px;color:#3f6a33;line-height:1.45;"><b style="color:#2f5626;">Jen lokální AI.</b> Text klienta neopouští zařízení.</span></div>';

    const ov = document.createElement('div');
    ov.id = 'lexis-settings-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:36px 16px;backdrop-filter:blur(2px);';
    ov.innerHTML =
      '<div style="background:var(--bg-workspace);border:1px solid var(--border);border-radius:16px;max-width:720px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.28);overflow:hidden;font-family:var(--font-ui);">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;background:var(--surface);border-bottom:1px solid var(--border);color:var(--ink);">'
      +   '<div style="display:flex;align-items:center;gap:11px;">' + GEAR + '<span style="font:700 18px var(--font-ui);letter-spacing:-.01em;">Nastavení</span></div>'
      +   '<div id="set-close" title="Zavřít" style="cursor:pointer;color:var(--text-faint);font-size:20px;line-height:1;padding:4px 8px;border-radius:8px;">✕</div>'
      + '</div>'
      + '<div style="padding:20px 24px 26px;display:flex;flex-direction:column;gap:14px;">'
      +   card(I_LOCK, 'Zabezpečení',
            row('Zámek aplikace', 'PIN/heslo, Touch ID a automatický zámek', btn('set-security', 'Nastavit')))
      +   card(I_AI, 'Umělá inteligence',
            row('Poskytovatel', 'Model běžící na tomto počítači', '<span style="flex:none;font:600 13px var(--font-ui);color:var(--ink);background:var(--surface-2);border:1px solid var(--border-strong);border-radius:8px;padding:8px 12px;">' + provLabel + '</span>')
            + row('Pokročilé nastavení AI', 'Model, endpoint, agenti', btn('set-ai-adv', 'Otevřít'))
            + aiNote)
      +   card(I_DS, 'Datová schránka',
            row('Připojení schránky', 'Přihlášení pro odesílání podání', btn('set-isds', 'Nastavit'))
            + row('Doručené a odeslané', 'Schránka datových zpráv', btn('set-datovky', 'Otevřít')))
      +   card(I_DB, 'Data a zálohy',
            row('Záloha šifrovacího klíče', 'Bez klíče nelze data obnovit', btn('set-keybackup', 'Zálohovat')))
      +   card(I_LOOK, 'Vzhled',
            row('Noční režim', 'Tmavé rozhraní', toggle('set-dark', isDark)))
      +   card(I_HELP, 'Podpora',
            row('Něco nefunguje?', 'Pošlete nám report — reagujeme rychle.', btn('set-feedback', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8V6a4 4 0 0 1 8 0v2"/><rect x="6" y="8" width="12" height="10" rx="4"/><path d="M3.5 11H6M18 11h2.5M3.5 16H6M18 16h2.5M12 8v10"/></svg> Nahlásit chybu', true))
            + '<div style="padding-top:12px;border-top:1px solid var(--border-soft);font-size:12px;color:var(--text-faint);">LexisEditor 3.4.3 · data lokálně a šifrovaně na tomto zařízení</div>')
      + '</div></div>';

    document.body.appendChild(ov);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) ov.remove(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } });
    const $ = (s) => ov.querySelector(s);
    $('#set-close').onclick = () => ov.remove();
    const wire = (s, fn, close) => { const el = $(s); if (el) el.onclick = () => { if (close) ov.remove(); try { fn(); } catch (e) {} }; };
    wire('#set-security', () => { if (window.lockScreen) window.lockScreen.openSecuritySettings(); }, true);
    wire('#set-ai-adv', () => { if (window.switchTab) window.switchTab('tab-settings'); }, true);
    wire('#set-isds', () => { if (window.openIsdsSettings) window.openIsdsSettings(); }, false);
    wire('#set-datovky', () => { if (window.openDatovkaDialog) window.openDatovkaDialog(); }, true);
    wire('#set-keybackup', () => { if (window.openKeyBackup) window.openKeyBackup(); }, false);
    wire('#set-feedback', () => { if (window.openFeedback) window.openFeedback(); }, false);
    const dk = $('#set-dark');
    if (dk) dk.onclick = () => { if (window.toggleDarkMode) window.toggleDarkMode(); ov.remove(); setTimeout(() => window.showSettingsModal(), 60); };
  };
})();
