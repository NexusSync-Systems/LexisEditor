// lexis-ui-5.js — část UI vytažená z lexis-ui.js (prototype-mixin, beze změny chování).
// Načítá se v index.html PO lexis-ui.js. Obsahuje: insertSectionSign, lookupCaseLaw, logTime, showTimeTrackingDialog, exportTimesheet, setMargins, setOrientation, setColumns, insertSubjectHeader, scanTextForCourtHearings, promptAddHearingToCalendar, editHeader, editFooter, _openHFModal, closeHFModal, switchHFTab, updateHFPreview, pickHFImage, onHFImagePicked, applyHFChanges, applyHFTemplate, saveHFAsTemplate, setViewMode, closeCampaign, parseCsvToRecords, _setCampaignAction, _campaignPreviewNav, _updateCampaignRecordsPreview, exportCampaignRecord, onCampaignCsvPicked, _getContacts, openContacts, closeContacts, renderContactsList
Object.assign(LexisUI.prototype, {

    insertSectionSign() {
        const range = this.core.quill.getSelection(true);
        if (range) {
            this.core.quill.insertText(range.index, "§ ");
            this.core.quill.setSelection(range.index + 2);
        } else {
            this.core.quill.insertText(this.core.quill.getLength(), "§ ");
        }
    },

    lookupCaseLaw() {
        this.switchSidebarTab('chat');
        const input = document.getElementById('ai-prompt');
        if (input) {
            input.value = "Najdi judikaturu Nejvyššího soudu ohledně náhrady škody způsobené vadou výrobku podle nového občanského zákoníku.";
            this.customAlert("🏛️ <b>Judikatura spuštěna!</b><br><br>V pravém AI panelu byl přednastaven dotaz na judikaturu.");
        }
    },

    async logTime() {
        this.checkEnterpriseFeature("Evidence práce", () => {
            this.showTimeTrackingDialog();
        });
    },

    showTimeTrackingDialog(prefilledHours = null, onComplete = null) {
        // Calculate default hours
        let defaultHours = "0.25";
        if (prefilledHours !== null) {
            defaultHours = parseFloat(prefilledHours).toFixed(2);
        } else if (this.activeSessionTimeMs && this.activeSessionTimeMs > 0) {
            const calculated = this.activeSessionTimeMs / (3600 * 1000);
            defaultHours = Math.max(0.1, parseFloat(calculated.toFixed(2))).toString();
        }

        const defaultDocName = this.currentDocumentTitle || "Nový dokument";
        const todayStr = new Date().toISOString().split('T')[0];

        const overlay = document.createElement('div');
        overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:'Inter',sans-serif;";
        
        const modal = document.createElement('div');
        modal.style = "background:#ffffff;border-radius:16px;width:480px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #e0dbd3;display:flex;flex-direction:column;overflow:hidden;animation: modalFadeIn 0.25s ease-out;";

        // Ensure keyframes animation is present
        if (!document.getElementById('modal-fade-in-style')) {
            const styleSheet = document.createElement("style");
            styleSheet.id = 'modal-fade-in-style';
            styleSheet.innerText = `
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(styleSheet);
        }

        modal.innerHTML = eIco(`
            <div style="padding:20px 24px;background:#faf9f7;border-bottom:1px solid #e0dbd3;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h2 style="margin:0;font-size:16px;font-weight:700;color:#2b2926;display:flex;align-items:center;gap:8px;">⏱️ Vykázat činnost</h2>
                    <p style="margin:2px 0 0 0;font-size:11px;color:#77716a;">Zapsat odpracovaný čas do výkazů v LexisLocal</p>
                </div>
                <button id="tt-close" style="background:none;border:none;font-size:24px;color:#a09a92;cursor:pointer;line-height:1;outline:none;padding:0;">&times;</button>
            </div>
            
            <div style="padding:24px;display:flex;flex-direction:column;gap:16px;box-sizing:border-box;">
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <label style="font-size:12px;font-weight:600;color:#5c574f;">Spis / Věc / Dokument</label>
                    <input type="text" id="tt-doc-name" placeholder="např. sp. zn. 77 EX 123/2026" style="width:100%;padding:10px;border:1px solid #ddd6cb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.2s;" value="${defaultDocName}">
                </div>
                
                <div style="display:flex;gap:16px;">
                    <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                        <label style="font-size:12px;font-weight:600;color:#5c574f;">Datum</label>
                        <input type="date" id="tt-date" style="width:100%;padding:10px;border:1px solid #ddd6cb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;background:#fff;" value="${todayStr}">
                    </div>
                    <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                        <label style="font-size:12px;font-weight:600;color:#5c574f;">Čas (hodiny)</label>
                        <input type="number" id="tt-hours" step="0.05" min="0.05" style="width:100%;padding:10px;border:1px solid #ddd6cb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;" value="${defaultHours}">
                    </div>
                </div>
                
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <label style="font-size:12px;font-weight:600;color:#5c574f;">Typ úkonu</label>
                    <select id="tt-action-type" style="width:100%;padding:10px;border:1px solid #ddd6cb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;background:#fff;appearance:none;-webkit-appearance:none;">
                        <option value="psaní" selected>Sepisování a úpravy dokumentu</option>
                        <option value="revize">Revize a kontrola</option>
                        <option value="studium">Studium spisu</option>
                        <option value="právní analýza">Právní analýza a rešerše</option>
                        <option value="ostatní">Ostatní administrativní činnost</option>
                    </select>
                </div>
                
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <label style="font-size:12px;font-weight:600;color:#5c574f;">Popis (nepovinné)</label>
                    <input type="text" id="tt-desc" placeholder="např. Příprava žaloby na zaplacení" style="width:100%;padding:10px;border:1px solid #ddd6cb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;">
                </div>
            </div>
            
            <div style="padding:16px 24px;background:#faf9f7;border-top:1px solid #e0dbd3;display:flex;justify-content:flex-end;gap:12px;">
                <button id="tt-cancel" style="padding:10px 18px;background:#edeae4;color:#5c574f;font-weight:600;font-size:13px;border:none;border-radius:8px;cursor:pointer;transition:background 0.2s;">Zrušit</button>
                <button id="tt-submit" style="padding:10px 20px;background:#9a5b22;color:#ffffff;font-weight:600;font-size:13px;border:none;border-radius:8px;cursor:pointer;box-shadow:0 4px 6px -1px rgba(37,99,235,0.2);transition:background 0.2s;">Vykázat</button>
            </div>
        `);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Bind events
        document.getElementById('tt-close').onclick = () => overlay.remove();
        document.getElementById('tt-cancel').onclick = () => overlay.remove();
        
        const submitBtn = document.getElementById('tt-submit');
        submitBtn.onmouseover = () => submitBtn.style.background = "#8a5320";
        submitBtn.onmouseout = () => submitBtn.style.background = "#9a5b22";
        const cancelBtn = document.getElementById('tt-cancel');
        cancelBtn.onmouseover = () => cancelBtn.style.background = "#e0dbd3";
        cancelBtn.onmouseout = () => cancelBtn.style.background = "#edeae4";

        submitBtn.onclick = async () => {
            const documentName = document.getElementById('tt-doc-name').value.trim();
            const date = document.getElementById('tt-date').value;
            const hoursVal = parseFloat(document.getElementById('tt-hours').value);
            const actionType = document.getElementById('tt-action-type').value;
            const desc = document.getElementById('tt-desc').value.trim() || actionType;

            if (!documentName) {
                this.customAlert("⚠️ Prosím vyplňte název dokumentu / spisu.");
                return;
            }
            if (isNaN(hoursVal) || hoursVal <= 0) {
                this.customAlert("⚠️ Prosím vyplňte platný počet hodin.");
                return;
            }
            if (!date) {
                this.customAlert("⚠️ Prosím vyplňte datum.");
                return;
            }

            // Post to LexisLocal backend
            let success = false;
            try {
                const { baseUrl, headers } = this.getLexisLocalConnection();
                const res = await fetch(`${baseUrl}/api/activity/custom`, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        documentName,
                        hours: hoursVal,
                        actionType: desc,
                        date
                    })
                });

                const data = await res.json();
                if (data.success) {
                    success = true;
                }
            } catch (err) {
                console.warn("Timesheet logging to LexisLocal failed, falling back to local database:", err.message);
            }

            // Fallback (save locally in settings storage so we don't lose the log)
            try {
                const log = {
                    desc: desc,
                    hours: hoursVal,
                    date: new Date(date).toLocaleDateString('cs-CZ'),
                    timestamp: Date.now(),
                    synced: success
                };

                const savedLogs = await this.core.storage.get('settings', 'timesheet-logs') || [];
                savedLogs.push(log);
                await this.core.storage.set('settings', { key: 'timesheet-logs', value: savedLogs });
            } catch (err) {
                console.error("Local storage logging failed:", err.message);
            }

            // Reset session time tracker since we've logged it
            this.activeSessionTimeMs = 0;

            overlay.remove();
            
            if (success) {
                this.customAlert(`✅ <b>Činnost vykázána!</b><br><br>Čas <b>${hoursVal} hod.</b> na spis <b>${documentName}</b> byl úspěšně zaznamenán do LexisLocal.`);
            } else {
                this.customAlert(`✅ <b>Uloženo lokálně</b><br><br>Čas <b>${hoursVal} hod.</b> byl zaznamenán offline v editoru. Bude synchronizován po spuštění LexisLocal.`);
            }

            // Run callback (e.g. exit start screen transition)
            if (onComplete) {
                await onComplete();
            }
        };
    },

    async exportTimesheet() {
        this.checkEnterpriseFeature("Export výkazu", async () => {
            const savedLogs = await this.core.storage.get('settings', 'timesheet-logs') || [];
            if (savedLogs.length === 0) {
                return this.customAlert("Žádné zapsané úkony k exportu nebyly nalezeny.");
            }

            let text = "VÝKAZ PRÁCE - LEXISEDITOR\n==========================\n\n";
            let total = 0;
            savedLogs.forEach(log => {
                text += `📅 ${log.date} | ⏱️ ${log.hours} hod. | 📝 ${log.desc}\n`;
                total += log.hours;
            });
            text += `\n==========================\nCELKEM: ${total} hod.`;

            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vykaz_prace_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            this.customAlert("✅ <b>Výkaz exportován!</b><br><br>Soubor s přehledem zapsaných úkonů byl úspěšně stažen do vašeho počítače.");
        });
    },

    setMargins(m) {
        const editor = document.querySelector('.ql-editor');
        if (!editor) return;
        if (m === 'narrow') {
            editor.style.setProperty('padding', '15mm', 'important');
        } else if (m === 'wide') {
            editor.style.setProperty('padding', '35mm', 'important');
        } else {
            editor.style.setProperty('padding', '25mm', 'important');
        }
    },

    setOrientation(o) {
        const wrapper = document.getElementById('editor-wrapper');
        if (!wrapper) return;
        if (o === 'landscape') {
            wrapper.style.width = '297mm';
            wrapper.style.minHeight = '210mm';
        } else {
            wrapper.style.width = '210mm';
            wrapper.style.minHeight = '297mm';
        }
    },

    setColumns(c) {
        const editor = document.querySelector('.ql-editor');
        if (!editor) return;
        editor.style.columnCount = c;
        editor.style.columnGap = '10mm';
    },

    insertSubjectHeader(type) {
        let html = "";
        const baseStyle = "padding: 20px 25px; margin: 30px 0; background: #ffffff; border-radius: 12px; font-family: 'Inter', sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e0dbd3; position: relative; overflow: hidden;";
        
        if (type === 'person') {
            html = `
                <div style="${baseStyle}">
                    <div style="position: absolute; top: 0; left: 0; width: 6px; height: 100%; background: linear-gradient(to bottom, #9a5b22, #9a5b22);"></div>
                    <p style="margin-bottom: 8px; color: #9a5b22; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Identifikace: Fyzická osoba</p>
                    <p style="font-size: 18px; margin: 0; color: #2b2926;"><strong>[JMÉNO A PŘÍJMENÍ]</strong></p>
                    <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #5c574f;">
                        <div><strong>Narozen(a):</strong> [DATUM]</div>
                        <div><strong>ID DS:</strong> [ID DATOVÉ SCHRÁNKY]</div>
                        <div style="grid-column: span 2;"><strong>Bytem:</strong> [ADRESA TRVALÉHO POBYTU]</div>
                    </div>
                </div>
                <p><br></p>
            `;
        } else if (type === 'entrepreneur') {
            html = `
                <div style="${baseStyle}">
                    <div style="position: absolute; top: 0; left: 0; width: 6px; height: 100%; background: linear-gradient(to bottom, #d9a441, #b06a2a);"></div>
                    <p style="margin-bottom: 8px; color: #b06a2a; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Identifikace: Podnikající fyzická osoba</p>
                    <p style="font-size: 18px; margin: 0; color: #2b2926;"><strong>[JMÉNO A PŘÍJMENÍ]</strong></p>
                    <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #5c574f;">
                        <div><strong>IČO:</strong> [IČO]</div>
                        <div><strong>DIČ:</strong> [DIČ]</div>
                        <div style="grid-column: span 2;"><strong>Sídlo:</strong> [ADRESA MÍSTA PODNIKÁNÍ]</div>
                        <div style="grid-column: span 2; font-size: 11px; color: #a09a92;">Zapsán v živnostenském rejstříku vedeném [ÚŘAD]</div>
                    </div>
                </div>
                <p><br></p>
            `;
        } else if (type === 'company') {
            html = `
                <div style="${baseStyle}">
                    <div style="position: absolute; top: 0; left: 0; width: 6px; height: 100%; background: linear-gradient(to bottom, #5a8a4a, #4f7a41);"></div>
                    <p style="margin-bottom: 8px; color: #5a8a4a; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Identifikace: Právnická osoba</p>
                    <p style="font-size: 18px; margin: 0; color: #2b2926;"><strong>[OBCHODNÍ FIRMA / NÁZEV]</strong></p>
                    <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #5c574f;">
                        <div><strong>IČO:</strong> [IČO]</div>
                        <div><strong>DIČ:</strong> [DIČ]</div>
                        <div style="grid-column: span 2;"><strong>Sídlo:</strong> [ADRESA SÍDLA]</div>
                        <div style="grid-column: span 2;"><strong>Zastoupená:</strong> [JMÉNO], [FUNKCE]</div>
                        <div style="grid-column: span 2; font-size: 11px; color: #a09a92; font-style: italic;">Zapsaná v obchodním rejstříku vedeném [SOUD] v [MĚSTO], oddíl [ODDÍL], vložka [VLOŽKA]</div>
                    </div>
                </div>
                <p><br></p>
            `;
        }
        
        const range = this.core.quill.getSelection(true);
        const index = range ? range.index : this.core.quill.getLength();
        this.core.safePasteHTML(index, html);
        this.saveActiveDocumentState();
        this.updateDocumentOutline();
    },

    scanTextForCourtHearings(text) {
        if (!text) return;
        
        let detectedCourt = null;
        
        // Detekce soudu — jeden zdroj (window.LexisCourt.detect z js/core/court-data.js).
        if (window.LexisCourt && window.LexisCourt.detect) {
            detectedCourt = window.LexisCourt.detect(text);
        }
        
        // Spisová značka — jeden zdroj pravdy: sdílená extrakce (LexisReply.extract)
        // + strukturovaný parser (LexisReply.parseSpzn). Dřív tu byl vlastní regex,
        // který se mohl rozejít s hlavní extrakcí náležitostí.
        let detectedSpzn = null;
        if (window.LexisReply && window.LexisReply.extract && window.LexisReply.parseSpzn) {
            const spznStr = window.LexisReply.extract(text).spzn;
            detectedSpzn = window.LexisReply.parseSpzn(spznStr);
        }
        
        const hearingsSection = document.getElementById('court-hearings-section');
        const hearingsList = document.getElementById('hearings-list');
        
        if (!hearingsSection || !hearingsList) return;
        
        // Vyžaduj i kód soudu — bez něj nelze sestavit dotaz a .kod.startsWith
        // by spadl (Cannot read properties of undefined).
        if (detectedCourt && detectedCourt.kod && detectedSpzn) {
            hearingsSection.style.display = 'block';
            hearingsList.innerHTML = eIco(`
                <div style="font-size: 11px; color: #77716a; text-align: center; padding: 10px; font-style: italic;">
                    🔍 Vyhledávám nařízená jednání u ${detectedCourt.nazev}...
                </div>
            `);
            
            const queryParams = {
                druhOrganizace: null,
                okresniSoud: null,
                cisloSenatu: detectedSpzn.cisloSenatu,
                druhVeci: detectedSpzn.druhVeci,
                bcVec: detectedSpzn.bcVec,
                rocnik: detectedSpzn.rocnik,
                agenda: null,
                typHledani: "SPZN"
            };
            
            if (detectedCourt.kod.startsWith('OS')) {
                queryParams.okresniSoud = detectedCourt.kod;
            } else {
                queryParams.druhOrganizace = detectedCourt.kod;
            }
            
            window.electronAPI.queryInfoJednani(queryParams).then((res) => {
                if (res && res.success && res.data) {
                    const data = res.data;
                    const udalosti = data.udalosti || [];
                    if (udalosti.length > 0) {
                        hearingsList.innerHTML = eIco(udalosti.map((u, idx) => {
                            const dateStr = u.datum || '';
                            const timeStr = u.cas || '';
                            const room = u.jednaciSin || 'Neznámá síň';
                            const type = u.druhJednani || 'Soudní jednání';
                            const judge = u.resitel || 'Neuveden';
                            const isCancelled = u.jednaciZruseno === 'Ano' || u.jednaciZruseno === true;
                            
                            const statusPill = isCancelled 
                                ? `<span style="background: #f0dcd6; color: #8a3626; border: 1px solid #e0a99d; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block;">❌ ZRUŠENO</span>`
                                : `<span style="background: #d9e6d0; color: #4f7a41; border: 1px solid #d9e6d0; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block;">📅 NAŘÍZENO</span>`;

                            const hearingData = {
                                id: 'hearing_' + Date.now() + '_' + idx,
                                title: type,
                                spzn: detectedSpzn.fullText,
                                courtName: data.organizace || detectedCourt.nazev,
                                courtCode: detectedCourt.kod,
                                spisovaZnacka: {
                                    cisloSenatu: detectedSpzn.cisloSenatu,
                                    druhVeci: detectedSpzn.druhVeci,
                                    bcVec: detectedSpzn.bcVec,
                                    rocnik: detectedSpzn.rocnik
                                },
                                date: dateStr,
                                time: timeStr,
                                location: (data.organizace || detectedCourt.nazev) + ', síň ' + room
                            };

                            return `
                                <div style="background: white; border: 1px solid #d9e6d0; border-radius: 6px; padding: 8px; margin-bottom: 6px; font-size: 11px; color: #33562a;">
                                    <div style="font-weight: bold; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <span>⚖️ ${window.escapeHTML(type)}</span>
                                        ${statusPill}
                                    </div>
                                    <div style="margin-bottom: 3px;"><b>Sp. zn.:</b> ${window.escapeHTML(detectedSpzn.fullText)}</div>
                                    <div style="margin-bottom: 3px;"><b>Termín:</b> ${window.escapeHTML(dateStr)} v ${window.escapeHTML(timeStr)}</div>
                                    <div style="margin-bottom: 3px;"><b>Místo:</b> ${window.escapeHTML(data.organizace || detectedCourt.nazev)}, síň ${window.escapeHTML(room)}</div>
                                    <div style="margin-bottom: 5px;"><b>Soudce:</b> ${window.escapeHTML(judge)}</div>
                                    ${!isCancelled ? `
                                        <button onclick="window.saveHearingToCalendar('${encodeURIComponent(JSON.stringify(hearingData))}')" style="background: #5a8a4a; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 10px; font-weight: bold; cursor: pointer; transition: all 0.2s; width: 100%; text-align: center;">📅 Zapsat do kalendáře</button>
                                    ` : ''}
                                </div>
                            `;
                        }).join(''));
                    } else {
                        hearingsList.innerHTML = eIco(`
                            <div style="font-size: 11px; color: #77716a; text-align: center; padding: 10px; font-style: italic;">
                                Pro sp. zn. <b>${detectedSpzn.fullText}</b> není u ${detectedCourt.nazev} v následujících 30 dnech nařízeno žádné jednání.
                            </div>
                        `);
                    }
                } else {
                    hearingsList.innerHTML = eIco(`
                        <div style="font-size: 11px; color: #c0553f; text-align: center; padding: 10px; font-style: italic;">
                            ⚠️ Nepodařilo se načíst jednání z InfoJednání.
                        </div>
                    `);
                }
            }).catch((err) => {
                console.error("Chyba InfoJednání API:", err);
                hearingsList.innerHTML = eIco(`
                    <div style="font-size: 11px; color: #c0553f; text-align: center; padding: 10px; font-style: italic;">
                        ⚠️ Chyba spojení s portálem InfoJednání.
                    </div>
                `);
            });
        } else {
            hearingsSection.style.display = 'none';
        }
    },

    promptAddHearingToCalendar(data) {
        const title = `Jednání sp. zn. ${data.spzn} - ${data.title}`;
        this.customPrompt(`💡 <b>Zapsat jednání do kalendáře</b><br><br>Upravte název události (např. <i>Hlavní líčení sp. zn. ${data.spzn}</i>):`, title, async (userTitle) => {
            if (!userTitle) return;
            
            // Format DD.MM.YYYY to YYYY-MM-DD
            let isoDate = data.date;
            const parts = data.date.replace(/\s+/g, '').split('.');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                isoDate = `${year}-${month}-${day}`;
            }
            
            const body = {
                id: data.id,
                title: userTitle,
                dueDate: isoDate,
                time: data.time,
                location: data.location,
                context: `Soudní jednání u ${data.courtName}.\nSpisová značka: ${data.spzn}\nDetekováno z portálu InfoJednání.`,
                isHearing: true,
                courtCode: data.courtCode,
                spisovaZnacka: data.spisovaZnacka
            };
            
            try {
                const conn = this.getLexisLocalConnection();
                const res = await fetch(`${conn.baseUrl}/api/calendar/add`, {
                    method: 'POST',
                    headers: conn.headers,
                    body: JSON.stringify(body)
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const resData = await res.json();
                this.customAlert(`📅 <b>Jednání zapsáno do kalendáře!</b><br><br>Událost byla úspěšně uložena a byl vygenerován kalendářový soubor:<br><span style="font-size: 11px; color:#5a8a4a; font-family:monospace; word-break: break-all;">${resData.filePath}</span>`);
            } catch (e) {
                console.error(e);
                this.customAlert("❌ <b>Chyba zapsání do kalendáře</b><br><br>LexisLocal backend je offline, nebo se nepodařilo uložit událost.");
            }
        });
    },

    editHeader() {
        this._currentHFTarget = 'header';
        this._openHFModal();
    },

    editFooter() {
        this._currentHFTarget = 'footer';
        this._openHFModal();
    },

    _openHFModal() {
        const overlay = document.getElementById('hf-modal-overlay');
        const title = document.getElementById('hf-modal-title');
        if (!overlay) return;

        if (title) title.textContent = this._currentHFTarget === 'header' ? 'Editor záhlaví' : 'Editor zápatí';

        // Load current content from the actual header/footer area
        const areaId = this._currentHFTarget === 'header' ? 'header-area' : 'footer-area';
        const area = document.getElementById(areaId);

        // Try to restore structured data if available
        const savedKey = `hf-data-${this._currentHFTarget}`;
        const saved = this._hfData?.[this._currentHFTarget];
        if (saved) {
            const l = document.getElementById('hf-left');
            const c = document.getElementById('hf-center');
            const r = document.getElementById('hf-right');
            if (l) l.value = saved.left || '';
            if (c) c.value = saved.center || '';
            if (r) r.value = saved.right || '';
        } else {
            // Default content from textarea
            ['left','center','right'].forEach(pos => {
                const el = document.getElementById(`hf-${pos}`);
                if (el) el.value = '';
            });
        }

        // Reset images
        ['left','center','right'].forEach(pos => {
            const img = document.getElementById(`hf-img-${pos}`);
            if (img) {
                const savedImg = this._hfImages[pos];
                img.src = savedImg || '';
                img.style.display = savedImg ? 'block' : 'none';
            }
        });

        this.switchHFTab('layout');
        this.updateHFPreview();
        overlay.style.display = 'flex';
    },

    closeHFModal() {
        const overlay = document.getElementById('hf-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    switchHFTab(tab) {
        ['layout','style','templates'].forEach(t => {
            const btn = document.getElementById(`hf-tab-${t}`);
            const panel = document.getElementById(`hf-panel-${t}`);
            if (btn) btn.classList.toggle('active', t === tab);
            if (panel) panel.style.display = t === tab ? 'block' : 'none';
        });
    },

    updateHFPreview() {
        const left = document.getElementById('hf-left')?.value || '';
        const center = document.getElementById('hf-center')?.value || '';
        const right = document.getElementById('hf-right')?.value || '';
        const fontSize = document.getElementById('hf-fontsize')?.value || '11px';

        const today = new Date().toLocaleDateString('cs-CZ');
        const docTitle = document.getElementById('window-doc-title')?.innerText || 'Dokument';

        const resolve = (text) => text
            .replace(/{DATUM}/g, today)
            .replace(/{STRANA}/g, '1')
            .replace(/{TITULEK}/g, docTitle)
            .replace(/\n/g, '<br>');

        const pl = document.getElementById('hf-preview-left');
        const pc = document.getElementById('hf-preview-center');
        const pr = document.getElementById('hf-preview-right');
        const previewEl = document.getElementById('hf-preview-content');

        // Show image if set
        const imgLeft = this._hfImages['left'];
        const imgCenter = this._hfImages['center'];
        const imgRight = this._hfImages['right'];

        if (pl) pl.innerHTML = eIco(imgLeft
            ? `<img src="${imgLeft}" style="max-height:50px; max-width:180px; object-fit:contain;"><br>${resolve(left)}`
            : resolve(left) || '<span style="color:#ddd6cb">—</span>');
        if (pc) pc.innerHTML = eIco(imgCenter
            ? `<img src="${imgCenter}" style="max-height:50px; max-width:180px; object-fit:contain;"><br>${resolve(center)}`
            : resolve(center) || '<span style="color:#ddd6cb">—</span>');
        if (pr) pr.innerHTML = eIco(imgRight
            ? `<img src="${imgRight}" style="max-height:50px; max-width:180px; object-fit:contain;"><br>${resolve(right)}`
            : resolve(right) || '<span style="color:#ddd6cb">—</span>');

        if (previewEl) previewEl.style.fontSize = fontSize;
    },

    pickHFImage(position) {
        const input = document.getElementById(`hf-img-input-${position}`);
        if (input) input.click();
    },

    onHFImagePicked(position, input) {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const raw = e.target.result;
            const apply = (dataUrl) => {
                this._hfImages[position] = dataUrl;
                const imgEl = document.getElementById(`hf-img-${position}`);
                if (imgEl) { imgEl.src = dataUrl; imgEl.style.display = 'block'; }
                this.updateHFPreview();
            };
            // Automaticky očisti logo: odstraň (bílé) pozadí a těsně ořízni,
            // ať není poznat, že jde o vložený obrázek. Při chybě → původní.
            if (window.LexisLogoClean && window.LexisLogoClean.cleanLogo) {
                window.LexisLogoClean.cleanLogo(raw).then(apply).catch(() => apply(raw));
            } else {
                apply(raw);
            }
        };
        reader.readAsDataURL(file);
        input.value = ''; // reset so same file can be picked again
    },

    // Vloží firemní logo (DNP LEGAL) přímo, bez nutnosti vybírat soubor.
    // Logo je uložené v aplikaci; automaticky se očistí (pozadí je průhledné → beze změny).
    insertFirmLogo(position) {
        position = position || 'left';
        const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAB2gAAADoCAYAAAAql7T6AAAWfmNhQlgAABZ+anVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNjMnBhAAAAFlhqdW1iAAAAR2p1bWRjMm1hABEAEIAAAKoAOJtxA3VybjpjMnBhOjBmOGY0NDcyLTllNjItNGViOS1iN2Q5LWI2MWU4NDFhOTc0ZQAAAAOTanVtYgAAAClqdW1kYzJhcwARABCAAACqADibcQNjMnBhLmFzc2VydGlvbnMAAAAAuGp1bWIAAABEanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5pbmdyZWRpZW50LnYzAAAAABhjMnNoHueaysnPoW9yt4NBebRlMgAAAGxjYm9yo2lkYzpmb3JtYXRpaW1hZ2UvcG5namluc3RhbmNlSUR4LHhtcDppaWQ6NjBmZjNiMGYtMGU1ZC00ODI1LThmNDAtMmMxZDE3NzdmODI5bHJlbGF0aW9uc2hpcGhwYXJlbnRPZgAAAeJqdW1iAAAAQWp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuYWN0aW9ucy52MgAAAAAYYzJzaECL2GFNpMKSAzKrUUvNBmoAAAGZY2JvcqJnYWN0aW9uc4KiZmFjdGlvbmtjMnBhLm9wZW5lZGpwYXJhbWV0ZXJzoWtpbmdyZWRpZW50c4GiY3VybHgtc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5pbmdyZWRpZW50LnYzZGhhc2hYIPtOwUQ6xi7RU62uPWSLlloDrKIPoqFDyLBl1L7iZLIEpGZhY3Rpb254HWNvbS5hbnRocm9waWMuY2xhdWRlLnByb3ZpZGVkanBhcmFtZXRlcnOheB9jb20uYW50aHJvcGljLm9yaWdpbi1jb25maWRlbmNlZ3Vua25vd25rZGVzY3JpcHRpb254ZkNsYXVkZSBwcm92aWRlZCB0aGlzIGZpbGUgYXQgdGhlIHJlcXVlc3Qgb2YgYSB1c2VyIGFuZCBtYXkgaGF2ZSBjcmVhdGVkIG9yIG1vZGlmaWVkIHRoZSBmaWxlIGNvbnRlbnRzLm1zb2Z0d2FyZUFnZW50oWRuYW1lZkNsYXVkZXJhbGxBY3Rpb25zSW5jbHVkZWT1AAAAyGp1bWIAAABAanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5oYXNoLmRhdGEAAAAAGGMyc2iO+B6CurtoUrbKY96IhsoKAAAAgGNib3KlY2FsZ2ZzaGEyNTZjcGFkTQAAAAAAAAAAAAAAAABkaGFzaFggbqVuK1wqNytdLE48xH07aoWbjKyl5fPUlPuZ96LHwI9kbmFtZW5qdW1iZiBtYW5pZmVzdGpleGNsdXNpb25zgaJlc3RhcnQYIWZsZW5ndGgZFooAAAI+anVtYgAAACdqdW1kYzJjbAARABCAAACqADibcQNjMnBhLmNsYWltLnYyAAAAAg9jYm9ypWNhbGdmc2hhMjU2aXNpZ25hdHVyZXhNc2VsZiNqdW1iZj0vYzJwYS91cm46YzJwYTowZjhmNDQ3Mi05ZTYyLTRlYjktYjdkOS1iNjFlODQxYTk3NGUvYzJwYS5zaWduYXR1cmVqaW5zdGFuY2VJRHgseG1wOmlpZDpjZGYzMmQ1My1mZTk4LTQ1NTQtYTdlMS0wNDNkNDNkY2JiODFyY3JlYXRlZF9hc3NlcnRpb25zg6JjdXJseC1zZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmluZ3JlZGllbnQudjNkaGFzaFgg+07BRDrGLtFTra49ZIuWWgOsog+ioUPIsGXUvuJksgSiY3VybHgqc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5hY3Rpb25zLnYyZGhhc2hYIIQjBO0PU+bU5rpc+sG5RI6oAC6ghwTaX7ziZwE/s0mQomN1cmx4KXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaGFzaC5kYXRhZGhhc2hYIO3W8/Zh7vIkSeoEvjBRKuvqUviIfZ9IP4e8Uh5xeYX1dGNsYWltX2dlbmVyYXRvcl9pbmZvo2RuYW1lb0FudGhyb3BpYyBGaWxlc2d2ZXJzaW9uZTEuMC4wa3NwZWNWZXJzaW9uZTIuNC4wAAAQOGp1bWIAAAAoanVtZGMyY3MAEQAQgAAAqgA4m3EDYzJwYS5zaWduYXR1cmUAAAAQCGNib3LShFkCEqIBJhghWQIKMIICBjCCAY2gAwIBAgIUQOWgCu7COdC+uIP6BkIFPWdVEwAwCgYIKoZIzj0EAwMwSTEXMBUGA1UEChMOQW50aHJvcGljLCBQQkMxLjAsBgNVBAMTJUFudGhyb3BpYyBDb250ZW50IENyZWRlbnRpYWxzIFJvb3QgQ0EwHhcNMjYwODA3MTg0MzU2WhcNMjgwODA2MTk0MzU2WjBEMRcwFQYDVQQKEw5BbnRocm9waWMsIFBCQzEpMCcGA1UEAxMgQW50aHJvcGljIENsYXVkZSBDb250ZW50IFNpZ25pbmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASYegpry1AYBRTVNL1CpTlbROnY3dey+UrsF9C3phYrATN3ZHf93Mo8RQN0KOUuOn19P4oWNFWe5n2/She9N7eTo1gwVjAOBgNVHQ8BAf8EBAMCB4AwFQYDVR0lBA4wDAYKKwYBBAGD6F4CATAMBgNVHRMBAf8EAjAAMB8GA1UdIwQYMBaAFM5R4gSBTmRbI/jjxM+aPpzB11zCMAoGCCqGSM49BAMDA2cAMGQCMDFzHRSeAXrSy1WOzkbhPZ6Km2wGTmZ/2gK18k8BQGXyqz88Rdrz6CTX9flAnYNVxgIwcF9c3fVhqmJKpi+UhasNUMko69cyX6STPfta3Q8EjyzDjzoyrol46FP6VFHhvUcJoWNwYWRZDZ4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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';
        const apply = (dataUrl) => {
            this._hfImages[position] = dataUrl;
            const imgEl = document.getElementById(`hf-img-${position}`);
            if (imgEl) { imgEl.src = dataUrl; imgEl.style.display = 'block'; }
            this.updateHFPreview();
        };
        if (window.LexisLogoClean && window.LexisLogoClean.cleanLogo) {
            window.LexisLogoClean.cleanLogo(LOGO).then(apply).catch(() => apply(LOGO));
        } else { apply(LOGO); }
    },

    applyHFChanges() {
        const left = document.getElementById('hf-left')?.value || '';
        const center = document.getElementById('hf-center')?.value || '';
        const right = document.getElementById('hf-right')?.value || '';
        const showLine = document.getElementById('hf-show-line')?.checked ?? true;
        const height = document.getElementById('hf-height')?.value || 'normal';
        const fontSize = document.getElementById('hf-fontsize')?.value || '11px';
        const bgColor = document.getElementById('hf-bg-color')?.value || '#ffffff';
        const textColor = document.getElementById('hf-text-color')?.value || '#4a453f';
        const lineColor = document.getElementById('hf-line-color')?.value || '#ddd6cb';
        const fontFamily = document.getElementById('hf-font-family')?.value || "'Segoe UI', sans-serif";

        const today = new Date().toLocaleDateString('cs-CZ');
        const docTitle = document.getElementById('window-doc-title')?.innerText || 'Dokument';

        const resolve = (text) => text
            .replace(/{DATUM}/g, today)
            .replace(/{STRANA}/g, '1')
            .replace(/{TITULEK}/g, docTitle);

        // Build HTML for header/footer area
        const paddingMap = { compact: '5mm 15mm', normal: '10mm 15mm', tall: '15mm 15mm' };
        const padding = paddingMap[height] || '10mm 15mm';

        // Čistá „hlavičková" sazba: logo v rozumné velikosti + text s klidným
        // řádkováním. Mřížka 1fr / auto / 1fr → střed zabere jen potřebné místo,
        // levý a pravý díl se dělí o zbytek; prázdné buňky nic nezabírají.
        const buildCell = (text, imgSrc, align) => {
            const cross = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
            let inner = '';
            if (imgSrc) {
                inner += `<img src="${imgSrc}" style="max-height:60px; max-width:220px; width:auto; height:auto; object-fit:contain; display:block;">`;
            }
            const txt = resolve(text);
            if (txt && txt.trim()) {
                inner += `<div style="white-space:pre-line; line-height:1.4;${imgSrc ? ' margin-top:5px;' : ''}">${txt}</div>`;
            }
            return `<div style="display:flex; flex-direction:column; justify-content:center; align-items:${cross}; text-align:${align}; min-width:0;">${inner}</div>`;
        };

        const borderStyle = showLine ? `border-bottom:1px solid ${lineColor}; padding-bottom:8px;` : '';
        const areaHtml = `<div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; column-gap:18px; padding:${padding}; background:${bgColor}; font-family:${fontFamily}; font-size:${fontSize}; color:${textColor}; letter-spacing:0.01em; ${borderStyle}">
            ${buildCell(left, this._hfImages['left'], 'left')}
            ${buildCell(center, this._hfImages['center'], 'center')}
            ${buildCell(right, this._hfImages['right'], 'right')}
        </div>`;

        const areaId = this._currentHFTarget === 'header' ? 'header-area' : 'footer-area';
        const area = document.getElementById(areaId);
        if (area) {
            area.innerHTML = eIco(areaHtml);
            area.contentEditable = 'false'; // Lock from direct editing now
        }

        // Save structured data for re-editing
        if (!this._hfData) this._hfData = {};
        this._hfData[this._currentHFTarget] = { left, center, right, showLine, height, fontSize, bgColor, textColor, lineColor, fontFamily };

        this.closeHFModal();
        this.saveActiveDocumentState();
        this.customAlert(`✅ <b>Záhlaví použito!</b><br><br>Záhlaví dokumentu bylo aktualizováno. Změny jsou uloženy se stavem dokumentu.`);
    },

    applyHFTemplate(type) {
        const templates = {
            advokatura: {
                left: 'Advokátní kancelář\nJUDr. Jan Novák\nwww.ak-novak.cz',
                center: '',
                right: 'Č.j.: {TITULEK}\nDatum: {DATUM}\nStrana: {STRANA}'
            },
            urad: {
                left: 'Logo úřadu', // user can replace with image
                center: '{TITULEK}\nRef. č.: 2025/001',
                right: 'V Praze dne {DATUM}'
            },
            soud: {
                left: 'Sp. zn.: \nK rukám soudu',
                center: 'Krajský soud v Praze\nNáměstí Kinských 34\n150 00 Praha 5',
                right: '{DATUM}\nStrana {STRANA}'
            },
            smlouva: {
                left: '',
                center: '',
                right: 'Strana {STRANA}'
            }
        };

        const tpl = templates[type];
        if (!tpl) return;

        ['left','center','right'].forEach(pos => {
            const el = document.getElementById(`hf-${pos}`);
            if (el) el.value = tpl[pos] || '';
        });

        this.switchHFTab('layout');
        this.updateHFPreview();
    },

    async saveHFAsTemplate() {
        this.customPrompt('Zadejte název šablony záhlaví:', 'Moje záhlaví', async (name) => {
            if (!name) return;
            const left = document.getElementById('hf-left')?.value || '';
            const center = document.getElementById('hf-center')?.value || '';
            const right = document.getElementById('hf-right')?.value || '';

            const templates = await this.core.storage.get('settings', 'hf-templates') || {};
            templates[`hf_${Date.now()}`] = { name, left, center, right };
            await this.core.storage.set('settings', { key: 'hf-templates', value: templates });
            this.customAlert(`✅ <b>Šablona uložena!</b><br><br>Šablona záhlaví <b>${name}</b> je uložena pro budoucí použití.`);
        });
    },

    setViewMode(mode) {
        // Remove all view mode classes
        document.body.classList.remove('reading-mode', 'print-layout', 'web-layout');

        // Update button active states
        ['reading','print','web'].forEach(m => {
            const btn = document.getElementById(`view-btn-${m}`);
            if (btn) btn.classList.remove('view-mode-active');
        });

        if (mode === 'normal' || mode === this._currentViewMode) {
            // Toggle off — return to normal
            this._currentViewMode = 'normal';
            if (this._paginated) this._paginated.disable();
            if (this._pageGuides) this._pageGuides.refresh();
            return;
        }

        this._currentViewMode = mode;

        // stránkový náhled patří jen k režimu „Tisk"
        if (mode !== 'print' && this._paginated) this._paginated.disable();

        if (mode === 'reading') {
            document.body.classList.add('reading-mode');
            const btn = document.getElementById('view-btn-reading');
            if (btn) btn.classList.add('view-mode-active');
        } else if (mode === 'print') {
            document.body.classList.add('print-layout');
            const btn = document.getElementById('view-btn-print');
            if (btn) btn.classList.add('view-mode-active');
            if (this._paginated) this._paginated.enable();
        } else if (mode === 'web') {
            document.body.classList.add('web-layout');
            const btn = document.getElementById('view-btn-web');
            if (btn) btn.classList.add('view-mode-active');
        }

        if (this._pageGuides) this._pageGuides.refresh();
    },

    closeCampaign() {
        const overlay = document.getElementById('campaign-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    parseCsvToRecords(csvText) {
        // Delegace na sdílenou, testovanou logiku (js/core/lexis-merge.js) — jeden zdroj
        // pravdy, navíc s podporou uvozovek (adresa s čárkou). Fallback pro jistotu.
        if (window.LexisMerge && window.LexisMerge.parseCsvToRecords) {
            return window.LexisMerge.parseCsvToRecords(csvText);
        }
        const lines = csvText.trim().split('\n').filter(l => l.trim());
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const vals = line.split(',').map(v => v.trim());
            const record = {};
            headers.forEach((h, i) => { record[h] = vals[i] || ''; });
            return record;
        });
    },

    _setCampaignAction(action) {
        this._campaignAction = action;
        document.querySelectorAll('.campaign-action-card').forEach(card => card.classList.remove('selected'));
        // Re-render step 4
        this.renderCampaignStep(4);
    },

    _campaignPreviewNav(dir) {
        const count = this._campaignRecords.length;
        this._campaignPreviewIdx = (this._campaignPreviewIdx + dir + count) % count;
        this.renderCampaignStep(3);
    },

    _updateCampaignRecordsPreview() {
        const ta = document.getElementById('campaign-csv-ta');
        const preview = document.getElementById('campaign-table-preview');
        if (!ta || !preview) return;
        const csvText = ta.value;
        this._campaignCsvText = csvText;
        const records = this.parseCsvToRecords(csvText);
        this._campaignRecords = records;

        if (records.length === 0) {
            preview.innerHTML = eIco('<div style="font-size:12px;color:#a09a92;padding:8px;">Žádné záznamy.</div>');
            return;
        }
        const headers = Object.keys(records[0]);
        preview.innerHTML = eIco(`
            <table class="campaign-recipients-table">
                <thead><tr>${headers.map(h => `<th>${this._esc(h)}</th>`).join('')}<th>Adresát č.</th></tr></thead>
                <tbody>${records.map((r, i) => `<tr><td>${headers.map(h => this._esc(r[h])).join('</td><td>')}</td><td>#${i+1}</td></tr>`).join('')}</tbody>
            </table>
        `);
    },

    exportCampaignRecord(record, templateHtml) {
        let html = templateHtml;
        for (const [key, val] of Object.entries(record)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            html = html.replace(regex, `<span class="filled-var">${this._esc(val)}</span>`);
        }
        return html;
    },

    onCampaignCsvPicked(input) {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this._campaignCsvText = e.target.result;
            const ta = document.getElementById('campaign-csv-ta');
            if (ta) {
                ta.value = this._campaignCsvText;
                this._updateCampaignRecordsPreview();
            }
        };
        reader.readAsText(file, 'utf-8');
        input.value = '';
    },

    _getContacts() {
        if (!this._contacts) {
            this._contacts = new LexisContacts(this.core.storage);
        }
        return this._contacts;
    },

    async openContacts() {
        const overlay = document.getElementById('contacts-modal-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        await this.renderContactsList();
        await this._renderContactGroupFilter();
    },

    closeContacts() {
        const overlay = document.getElementById('contacts-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    async renderContactsList() {
        const tbody = document.getElementById('contacts-table-body');
        const countEl = document.getElementById('contacts-count');
        if (!tbody) return;

        const search = (document.getElementById('contacts-search')?.value || '').toLowerCase();
        const typeFilter = document.getElementById('contacts-type-filter')?.value || '';
        const activeGroup = this._contactsActiveGroup || '';

        tbody.innerHTML = eIco(`<tr><td colspan="6" style="padding:30px;text-align:center;color:#a09a92;">⏳ Načítám...</td></tr>`);

        const all = await this._getContacts().getAll();
        let filtered = all.filter(c => {
            const matchSearch = !search ||
                (c.jmeno || '').toLowerCase().includes(search) ||
                (c.adresa || '').toLowerCase().includes(search) ||
                (c.mesto || '').toLowerCase().includes(search) ||
                (c.isds || '').toLowerCase().includes(search) ||
                (c.email || '').toLowerCase().includes(search);
            const matchType = !typeFilter || c.typ === typeFilter;
            const matchGroup = !activeGroup || (c.skupiny || []).includes(activeGroup);
            return matchSearch && matchType && matchGroup;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = eIco(`<tr><td colspan="6" style="padding:40px;text-align:center;color:#a09a92;font-size:13px;">
                📭 Žádné kontakty. Přidejte první kontakt tlačítkem "+ Nový kontakt" nebo importujte CSV.
            </td></tr>`);
            if (countEl) countEl.textContent = `Celkem: 0 kontaktů`;
            return;
        }

        const typLabels = { fyzicka: '👤 FO', pravnicka: '🏢 PO', organ: '🏛️ Úřad', soud: '⚖️ Soud' };

        tbody.innerHTML = eIco(filtered.map(c => `
            <tr>
                <td style="padding:10px 16px;">
                    <div style="font-weight:700;color:#2b2926;font-size:13px;">${this._esc(c.jmeno || '')}</div>
                    <div style="font-size:11px;color:#a09a92;margin-top:2px;">${typLabels[c.typ] || ''}${c.ic ? ` · IČO: ${c.ic}` : ''}</div>
                </td>
                <td style="padding:10px 16px;font-size:12px;color:#5c574f;">
                    ${c.adresa ? `${this._esc(c.adresa)}<br>` : ''}
                    ${c.psc || c.mesto ? `${c.psc || ''} ${c.mesto || ''}`.trim() : '<span style="color:#ddd6cb">—</span>'}
                </td>
                <td style="padding:10px 16px;">
                    ${c.isds ? `<span class="court-isds-badge">${this._esc(c.isds)}</span>` : '<span style="font-size:11px;color:#ddd6cb">—</span>'}
                </td>
                <td style="padding:10px 16px;font-size:12px;color:#5c574f;">
                    ${c.email ? `📧 ${this._esc(c.email)}<br>` : ''}
                    ${c.tel ? `📞 ${this._esc(c.tel)}` : ''}
                    ${!c.email && !c.tel ? '<span style="color:#ddd6cb">—</span>' : ''}
                </td>
                <td style="padding:10px 16px;">
                    <div style="display:flex;flex-wrap:wrap;gap:4px;">
                        ${(c.skupiny || []).map(g => `<span style="background:#f6efe4;color:#9a5b22;border:1px solid #efe3cf;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;">${this._esc(g)}</span>`).join('')}
                    </div>
                </td>
                <td style="padding:10px 16px;text-align:center;">
                    <div style="display:flex;gap:6px;justify-content:center;">
                        <button onclick="lexisUI.insertContactToDoc('${c.id}')" style="padding:5px 10px;border-radius:6px;background:#5a8a4a;color:white;border:none;font-size:11px;font-weight:700;cursor:pointer;">✅ Vložit</button>
                        <button onclick="lexisUI.openContactForm('${c.id}')" style="padding:5px 10px;border-radius:6px;background:#edeae4;border:1px solid #e0dbd3;font-size:11px;font-weight:700;cursor:pointer;color:#4a453f;">✏️ Upravit</button>
                        <button onclick="lexisUI.deleteContact('${c.id}')" style="padding:5px 10px;border-radius:6px;background:#f6ebe7;border:1px solid #e6c3ba;font-size:11px;font-weight:700;cursor:pointer;color:#8a3626;">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join(''));

        if (countEl) countEl.textContent = `Zobrazeno: ${filtered.length} / ${all.length} kontaktů`;
    }

});
