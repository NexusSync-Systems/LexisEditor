// --- lexis-pairing — UI pro spárování se vzdáleným serverem LexisLocal ---
// Odkaz (lexis://host:port/?fp=…&code=…) se vezme z dashboardu LexisLocal → Spárovat.
// Ověření otisku i výměna kódu za token běží v main procesu (js/core/lexis-server-pin.js);
// renderer token nikdy nevidí — jen adresu serveru a krátký otisk k vizuální kontrole.
(function () {
    'use strict';
    const esc = s => (window.escapeHTML ? window.escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s));
    const ui = () => window.lexisUI;
    const alertBox = html => (ui() && ui().customAlert ? ui().customAlert(html) : window.alert(html.replace(/<[^>]+>/g, '')));

    function applyEndpoint(baseUrl) {
        const prov = document.getElementById('ai-provider');
        if (prov && [...prov.options].some(o => o.value === 'lexislocal')) prov.value = 'lexislocal';
        const ep = document.getElementById('ai-endpoint');
        if (ep) ep.value = baseUrl;
        const key = document.getElementById('ai-apikey');
        if (key) key.value = ''; // token drží main proces (šifrovaně), ne pole v UI
        if (typeof window.saveAISettings === 'function') window.saveAISettings();
    }

    async function pair() {
        const api = window.electronAPI;
        if (!api || !api.pairLexisLocal) { alertBox('Spárování se serverem je dostupné jen v desktopové aplikaci.'); return; }
        const st = await api.lexisLocalPairStatus().catch(() => ({ paired: false }));
        const intro = (st && st.paired
            ? `Aktuálně spárováno s <b>${esc(st.serverUrl)}</b> (otisk ${esc(st.pinShort)}).<br><br>`
            : '') +
            '🔐 <b>Spárovat se serverem LexisLocal</b><br><br>V LexisLocal otevřete <i>Spárovat telefon</i> a zkopírujte <b>odkaz pro LexisEditor</b> (lexis://…). Vložte ho sem:';
        ui().customPrompt(intro, '', async (link) => {
            if (!link) return;
            const r = await api.pairLexisLocal(link);
            if (r && r.success) {
                applyEndpoint(r.baseUrl); // lexisll://server → main proces → spárovaný server
                alertBox(`✅ <b>Spárováno se serverem ${esc(r.serverUrl)}</b><br><br>Otisk klíče serveru: <b style="font-family:monospace">${esc(r.pinShort)}</b><br>Ověřte, že je stejný jako na stránce Spárovat v LexisLocal.`);
            } else {
                const mismatch = r && r.code === 'PIN_MISMATCH';
                alertBox(`${mismatch ? '🛑' : '❌'} <b>Spárování se nepodařilo</b><br><br>${esc(r && r.error || 'Neznámá chyba.')}`);
            }
        });
    }

    async function unpair() {
        const api = window.electronAPI;
        if (!api || !api.unpairLexisLocal) return;
        await api.unpairLexisLocal();
        applyEndpoint('http://localhost:4000');
        alertBox('Spárování se vzdáleným serverem bylo zrušeno. Editor se vrátil k místnímu LexisLocal.');
    }

    window.lexisPairServer = pair;
    window.lexisUnpairServer = unpair;
})();
