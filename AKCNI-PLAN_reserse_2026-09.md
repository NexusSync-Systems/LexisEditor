# Akční plán — Externí rešerše, release-prep

*2026-09-25 · návazně na AUDIT_reserse_2026-09.md. Stavy: [ ] TODO · [~] hotovo v kódu · [✓] nasazeno/ověřeno · [–] vědomě odloženo.*

## Fáze 1 — bezpečnost a mlčenlivost (blokuje širší distribuci)
- [~] **Opt-in/anonymizace do programového API rešerše.** HOTOVO v kódu: bezpečné obálky (safeVerifyCitation/safeFindCaseLaw/…) + regresní test bez-souhlasu-nefetchuje; ověřeno node smoke. `lexis-research.js`: `findCaseLaw/findLaw/findByProvision` musí projít `ensureOptIn()`+`maybeAnonymize()` (ne jen `runAction`). Přidat regresní test: přímé volání bez souhlasu → nefetchuje.
- [~] **PII guard u cloud toolu roje.** HOTOVO v kódu: _stripPII (RČ/e-mail/účet/dlouhá čísla) před odesláním, nezasahuje právní citace ani IČO; +test, 27/27 jest. `agent_tools.js` `_lawgptJudgments`: lehký strip RČ/e-mailů/čísel účtů z `query` před odesláním, nebo tvrdá instrukce v system promptu rešeršních rolí. Test: dotaz s RČ → odchozí query bez RČ (nebo zamítnuto).
- [~] **Gating cloud egressu** (flag + local-only, dvojitá brána) — hotovo, 25/25 testů.

## Fáze 2 — integrita a spolehlivost
- [~] **Normalizace LawGPT** judikatury i zákonů (obálka `data.data.results`, `it.law`, court-objekt) — hotovo, ověřeno smoke testem proti živému API.
- [ ] **Editor `npm test`** (17 research + 6 linker) — spustit lokálně, potvrdit zeleň (přes FUSE most nešlo).
- [–] **Klikací odkaz na zdroj** — zatím Google search ECLI (funguje); odloženo: přímý odkaz na justice.cz/NALUS (netriviální tvar URL, ať se neopakuje chyba s hádaným endpointem).

## Fáze 3 — výkon
- [ ] Nic akutního. Pozn.: cloud tool má timeout 20 s; při pomalé síti agent čeká — případně zkrátit na 10 s pro interaktivní roli.

## Fáze 4 — kvalita a technický dluh
- [ ] **`.env.example` / distribuce:** `AGENT_EXTERNAL_RESEARCH=0` jako default (zapíná advokát vědomě).
- [ ] **Release notes:** známé omezení — „ručení za DPH" a „vada výrobku" (NSS/NS) nemají lokální pokrytí; řeší zapnutý cloud tier.
- [–] **DirectCase** — odloženo (placené předplatné); registr ponechán otevřený pro budoucí přidání bez zásahu do zbytku.

## Mimo scope této dávky (starší audit)
- Plný repo-audit (endpointy, platby, RLS) není součástí — tahle dávka pokrývá jen změny „externí rešerše + roj". Pro kompletní release viz starší `AUDIT_2026-08.md`.
