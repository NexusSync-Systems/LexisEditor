/**
 * UI spárování se vzdáleným LexisLocal (js/ui/lexis-pairing.js): po úspěchu se editor
 * přepne na lexisll://server a pole s tokenem se vyprázdní; při jiném klíči výrazné varování.
 */
describe('lexis-pairing UI', () => {
    let alerts, saved;
    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <select id="ai-provider"><option value="ollama">O</option><option value="lexislocal">L</option></select>
            <input id="ai-endpoint" value="http://localhost:11434/api/generate"><input id="ai-apikey" value="stary">`;
        alerts = []; saved = 0;
        window.saveAISettings = () => { saved++; };
        window.escapeHTML = s => String(s).replace(/</g, '&lt;');
        window.lexisUI = { customPrompt: (t, d, cb) => cb('lexis://10.0.0.5/?fp=x&code=y'), customAlert: h => alerts.push(h) };
        require('../../js/ui/lexis-pairing.js');
    });
    test('úspěch → endpoint lexisll://server, provider LexisLocal, token z pole pryč', async () => {
        window.electronAPI = {
            lexisLocalPairStatus: async () => ({ paired: false }),
            pairLexisLocal: async () => ({ success: true, baseUrl: 'lexisll://server', serverUrl: 'https://10.0.0.5', pinShort: 'ABCD EFGH' })
        };
        await window.lexisPairServer();
        await new Promise(r => setTimeout(r, 0));
        expect(document.getElementById('ai-endpoint').value).toBe('lexisll://server');
        expect(document.getElementById('ai-provider').value).toBe('lexislocal');
        expect(document.getElementById('ai-apikey').value).toBe('');
        expect(saved).toBe(1);
        expect(alerts[0]).toMatch(/ABCD EFGH/);
    });
    test('jiný klíč serveru → 🛑 a nic se nepřepne', async () => {
        window.electronAPI = {
            lexisLocalPairStatus: async () => ({ paired: false }),
            pairLexisLocal: async () => ({ success: false, code: 'PIN_MISMATCH', error: 'Otisk <b>nesouhlasí</b>' })
        };
        await window.lexisPairServer();
        await new Promise(r => setTimeout(r, 0));
        expect(document.getElementById('ai-endpoint').value).toBe('http://localhost:11434/api/generate');
        expect(alerts[0]).toMatch(/🛑/);
        expect(alerts[0]).not.toMatch(/<b>nesouhlasí/); // escapováno
    });
});
