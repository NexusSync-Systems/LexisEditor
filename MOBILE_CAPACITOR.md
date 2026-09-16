# LexisEditor — mobilní verze (Capacitor, companion)

Telefon = **companion** k desktopu: číst / prohlížet / lehce editovat dokumenty a
ptát se AI (vzdálená Ollama nebo LexisLocal hub na LAN IP). Těžké právní úkony
(podpis PDF certifikátem, **odeslání** do ISDS, nativní docx, render PDF) zůstávají
na desktopu — na mobilu se slušně odkloní hláškou „dokončete na počítači".

## Co je hotové (scaffold)

- `capacitor.config.json` — appId `com.lexiseditor.mobile`, webDir `mobile/www`.
- `js/capacitor-bridge.js` — mobilní náhrada Electron IPC (v Electronu no-op).
- `scripts/build-mobile.mjs` — sestaví `mobile/www` a uvolní CSP jen v mobilní kopii.
- `package.json` — přidány `@capacitor/*` závislosti a skripty `build:mobile`, `cap:sync`, `cap:ios`, `cap:android`.
- `index.html` — přidán `<script src="js/capacitor-bridge.js">` (první, no-op v Electronu).

## První spuštění (na Macu, Xcode + Android Studio už máš)

```bash
cd ~/Projects/LexisEditor

# 1) doinstaluj závislosti (Capacitor)
npm install

# 2) sestav webDir (mobile/www) — build React + kopie + CSP
npm run build:mobile

# 3) přidej nativní platformy (vytvoří složky ios/ a android/)
npx cap add ios
npx cap add android

# 4) nasyncuj web do nativních projektů
npx cap sync

# 5) otevři a spusť v simulátoru
npx cap open ios       # → v Xcode zvol simulátor a Run (▶)
npx cap open android   # → v Android Studiu zvol emulátor a Run
```

Při každé změně webu pak stačí: `npm run cap:sync` (nebo `npm run cap:ios` / `cap:android`, což sync + otevření spojí).

## Nastavení AI na telefonu

localhost na telefonu = telefon, ne tvůj Mac. V appce v nastavení AI zadej **LAN IP
desktopu**, kde běží Ollama / LexisLocal, např.:

- Ollama: `http://192.168.1.50:11434/api/generate`
- LexisLocal hub: `http://192.168.1.50:4000`

(IP Macu zjistíš: `ipconfig getifaddr en0`. Telefon i Mac musí být na stejné Wi-Fi.)

## Co na mobilu funguje vs. co je odkloněné

| Funguje (companion) | Odkloněno na desktop |
| --- | --- |
| Otevření/čtení/editace v editoru (Quill) | Podpis PDF certifikátem, výběr certifikátu |
| Dotazy na AI (vzdálená Ollama / hub) | **Odeslání** do ISDS, doručenky, outbox |
| Uložení AI/ISDS/Pošta konfigurace, šablon | Nativní docx export/import (OOXML, revize) |
| Kalendář `.ics` (přes OS) | Render PDF, export bundle, e-mail přes klienta |
| Bezpečnostní zámek (základní) | Záloha šifrovacího klíče, ARES lustrace |

Nedefinované volání IPC nikdy nespadne — Proxy vrátí bezpečnou hodnotu a zaloguje
`[capacitor-bridge] nedefinovaná electronAPI metoda: …`. Podle konzole simulátoru
poznáme, co appka reálně volá, a postupně to doimplementujeme (fáze směrem k plné paritě).

## Iterace

Po prvním `Run` v simulátoru mi pošli:
- co se **zobrazí** (naběhla appka? start screen? editor?),
- warnings `[capacitor-bridge] nedefinovaná …` z konzole (Xcode → debug area / Android Studio → Logcat),
- cokoliv, co viditelně nefunguje.

Podle toho doladím most a UI (skrytí desktop-only tlačítek přes `window.LEXIS_MOBILE`).

## Podpis / distribuce (až bude appka běžet — zatím NEŘEŠIT)

- **iOS**: potřebuje **iOS Distribution** certifikát + provisioning profil (jiné než
  Developer ID, co jsme dělali pro Mac). Distribuce pro pilot → **TestFlight**.
  Bundle ID `com.lexiseditor.mobile` uprav v `capacitor.config.json` + Xcode, pokud
  chceš jiný (musí být unikátní v Apple účtu).
- **Android**: vlastní **keystore** (`keytool -genkey …`), pak APK / Google Play.
- Obojí lze později hodit i do GitHub Actions, stejně jako desktop.
