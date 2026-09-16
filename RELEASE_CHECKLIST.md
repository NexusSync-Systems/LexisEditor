# RELEASE CHECKLIST — LexisEditor

Postup pro sestavení a vydání desktopové aplikace (Electron, electron-builder).
Aktuální verze: viz `package.json` (`version`). Publish cíl: GitHub **`NexusSync-Systems/LexisEditor`**.
Podpis maců i Windows viz **SIGNING.md**.

> Pozn.: kód se needituje na této VM; tento checklist popisuje ruční kroky na Macu/PC.

## 1. Před buildem
- [ ] Zelené testy: `npm test` (jest) a ideálně `npm run test:all` (+ e2e).
- [ ] `node --check main.js preload.js` a klíčové `js/**` bez syntaktických chyb.
- [ ] Doplnit **CHANGELOG.md** o aktuální verzi (auto-updater ukazuje changelog uživateli).
- [ ] Zkontrolovat, že verze v UI se čte z `package.json` (jeden zdroj pravdy).
- [ ] Zkontrolovat, že `build.publish.owner` = `NexusSync-Systems` (ne starý `Zdenekdi`).

## 2. Ikony a assety (OVĚŘENO)
- [x] `build/icon.png` = **skutečné PNG 1024×1024** (dřív JPEG přejmenovaný na .png → build ikon by selhal; opraveno).
- [x] `build/background.png` = skutečné PNG (pozadí DMG).
- electron-builder generuje `.icns`/`.ico` automaticky z `build/icon.png`.
- Pozn.: `dmg.background` je 1024×1024; okno DMG je menší — obrázek se přeškáluje (kosmetika).

## 3. Verze — POZOR na auto-bump
- Skript `dist` = `npm version patch --no-git-tag-version && electron-builder` → **každé `npm run dist` zvýší patch verzi**.
- Chceš-li build bez zvýšení verze: `npm run pack` (jen `--dir`) nebo přímo `npx electron-builder`.

## 4. Build a podpis — přes CI (doporučeno)
Ostré, podepsané buildy dělá **GitHub Actions**, ne lokální stroj:

- **macOS + Windows release najednou:** vytvoř a pushni tag `vX.Y.Z` → workflow
  `release.yml` sestaví, **macOS podepíše (Developer ID) a notarizuje**, a publikuje
  GitHub Release. (Windows větev v `release.yml` je zatím nepodepsaná — viz níže.)
- **Podepsaný Windows instalátor:** ručně **Actions → „Windows build + Azure
  Artifact Signing" → Run workflow** (na `main`) → vypadne artefakt
  `LexisEditor-windows-signed`. Detaily a diagnostika v **SIGNING.md**.

Lokální build (jen pro vývoj/test): `npm run dist` (macOS), `npx electron-builder --win`
(na Macu vyžaduje wine — Windows radši buildit přes CI), `npm run pack` (bez instalátoru).

## 5. Podpis a notarizace — STAV
- **macOS:** ✅ podepsané (Developer ID Application) + notarizované automaticky v CI
  (`release.yml`, secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Ověření: `spctl -a -vv dist/mac/LexisEditor.app`.
- **Windows:** ✅ podpis přes **Azure Artifact Signing (OIDC)** ve `windows-sign.yml`
  (žádný cert v repu). Postup + zádrhely (immutable subject federace) viz **SIGNING.md**.
- **Auto-update:** funguje spolehlivě jen u podepsané macOS appky (electron-updater).

## 6. Publish / auto-update
- Auto-update zapnutý (`electron-updater`, `checkForUpdatesAndNotify`, `autoInstallOnAppQuit`).
- Release přes CI: `release.yml` nahraje artefakty + `latest.yml`/`latest-mac.yml` + blockmapy
  na GitHub Release (přes `GITHUB_TOKEN`).
- [ ] Ověřit, že `latest*.yml` odpovídá nahraným souborům a že Release **není draft**.

## 7. Po buildu — smoke test balíčku
- [ ] Nainstalovat DMG/EXE na čistém profilu, spustit.
- [ ] Ověřit ikonu v Docku/liště a v okně „O aplikaci".
- [ ] Otevřít vzor z úvodní obrazovky (šablony) → musí se načíst obsah.
- [ ] Vyzkoušet napojení na LexisLocal (token se čte automaticky), AI dotaz, export DOCX/PDF.
- [ ] (macOS) ověřit auto-update z předchozí verze.
- [ ] (Windows) pravým na `.exe` → Vlastnosti → Digitální podpisy → platný podpis **s časovým razítkem**.

## Známé mezery
- CHANGELOG doplnit k aktuální verzi.
- Windows větev v `release.yml` je nepodepsaná — podepsaný Windows build dělá zvlášť `windows-sign.yml`.
  (Sloučení do jednoho tag-triggered release s podpisem Windows = budoucí vylepšení.)
