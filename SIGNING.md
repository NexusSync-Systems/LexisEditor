# Podpis a notarizace macOS + test zálohy (blocker 4)

Bez podpisu macOS Gatekeeper aplikaci zablokuje a působí nedůvěryhodně.
Toto je připraveno; chybí jen tvůj Apple Developer certifikát a spuštění.

## Předpoklady (jednorázově)
1. **Apple Developer Program** (99 USD/rok) → certifikát **Developer ID Application**.
2. Certifikát nainstalovaný v Keychainu (Xcode → Settings → Accounts → Manage Certificates, nebo import .p12).
3. **Notarizační přihlašovací údaje** — buď App Store Connect **API key** (doporučeno), nebo Apple ID + app-specific password.

## Podepsaný + notarizovaný build
```bash
# 1) Zjisti přesný název certifikátu:
security find-identity -p codesigning -v      # → "Developer ID Application: Tvé Jméno (TEAMID)"

# 2) Notarizace přes API key (do prostředí, NECOMMITOVAT):
export APPLE_API_KEY=~/keys/AuthKey_XXXX.p8
export APPLE_API_KEY_ID=XXXXXXXXXX
export APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# 3) V package.json build.mac přepni na podpis:
#    "identity": "Developer ID Application: Tvé Jméno (TEAMID)",
#    "notarize": { "teamId": "TEAMID" }

# 4) Build:
npm run dist:signed        # nebo: electron-builder --mac
```

electron-builder appku podepíše (hardened runtime + entitlements z build/entitlements.mac.plist)
a odešle k notarizaci. Ověř: `spctl -a -vv "dist/mac/LexisEditor.app"` → "accepted, source=Notarized Developer ID".

## Test zálohy a obnovy klíče (proveď před pilotem)
Cíl: klient nesmí přijít o data ani o šifrovací klíč.

1. V appce vytvoř dokument, pak **Nastavení → Záloha klíče → exportuj** zálohu klíče na bezpečné místo.
2. Na **čistém** macOS profilu (nebo po přeinstalaci): nainstaluj podepsaný build.
3. **Obnov klíč ze zálohy**, otevři aplikaci → původní dokument musí být čitelný.
4. Ověř negativně: bez klíče data zůstávají šifrovaná / nečitelná.
5. Zdokumentuj postup zálohy do quick-startu pro AK (kam klíč uložit, jak často).

## Windows (volitelně)
Pro pilot na macOS není nutné. Pro Windows později: EV/OV code-signing certifikát a `win.certificateFile`.
