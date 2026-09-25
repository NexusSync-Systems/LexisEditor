# QA audit — Externí rešerše (LawGPT) + roj, release-prep

*2026-09-25 · fokus: změny této dávky (cloud egress, mlčenlivost, agent tooly, opt-in). Repozitáře LexisEditor + LexisLocal.*

## Shrnutí
Feature „Externí rešerše" (LawGPT, zdarma) je funkčně kompletní a backend security posture je dobrá (loopback default, globální auth, anti-rebind). Hlavní rizika jsou v oblasti **advokátní mlčenlivosti u cloudového odchozího provozu** — ne v přístupu k datům. Žádný kritický nález blokující vydání; dvě střední zjištění k mlčenlivosti doporučuji vyřešit před širší distribucí.

---

## Nálezy dle závažnosti

### STŘEDNÍ — 1. Programové API rešerše obchází opt-in i anonymizaci (mlčenlivost)
- **Důkaz:** `LexisEditor/js/providers/lexis-research.js` — `findCaseLaw`, `findLaw`, `findByProvision` volají pouze `ensureReady()` (kontrola připravenosti poskytovatele), NE `ensureOptIn()` ani `maybeAnonymize()`. Opt-in a nabídka anonymizace jsou jen v UI cestě `runAction()` (ensureOptIn ~ř. 367, maybeAnonymize ~ř. 379).
- **Scénář selhání:** jakýkoli kód volající `window.LexisResearch.findCaseLaw(text)` přímo (plánovaný „Legal Linker boost", §3/Fáze 3 návrhu, nebo budoucí automatizace) odešle text do cloudu LawGPT **bez souhlasu uživatele a bez anonymizace**. Dnes všechny dosažitelné cesty jdou přes `runAction`, takže je to latentní past, ne aktivní únik — ale první přímý caller ji spustí.
- **Oprava:** přesunout opt-in/anonymizační bránu do programového API (ať `findCaseLaw/findLaw/findByProvision` samy zavolají `ensureOptIn()`+`maybeAnonymize()`), nebo zavést jeden interní `run(kind, text)` a UI i programové API ho sdílí. Cíl: žádná cesta ke cloudu bez souhlasu.

### STŘEDNÍ — 2. Cloud tool roje spoléhá na model, že do dotazu nedá klientské PII (mlčenlivost)
- **Důkaz:** `LexisLocal/backend/lib/agent_tools.js` — `search_caselaw_online.impl` → `_lawgptJudgments(args.query)` posílá `q = args.query` na `https://lawgpt.cz/api/judgments/search`. Popis nástroje varuje „posílá se jen dotaz, nikdy klientský spis ani osobní údaje", ale nic to nevynucuje — text dotazu skládá LLM.
- **Scénář selhání:** agent formuluje dotaz jako „ověř judikaturu k případu Jan Novák, RČ …" → RČ/jméno odejde do cloudu. Gating (opt-in flag + local-only) je správný, ale obsah dotazu nefiltrovaný.
- **Oprava:** (a) lehký PII strip před odesláním (RČ regex, e-maily, čísla účtů) NEBO (b) explicitní instrukce v system promptu rešeršních rolí + ponechat audit (audit callback už volání loguje). Minimálně zdokumentovat jako známé riziko a nechat default vypnuto (viz nález 3).

### NÍZKÉ (vědomé) — 3. `AGENT_EXTERNAL_RESEARCH=1` zapnuto v .env na mlčenlivost-citlivém produktu
- **Důkaz:** `LexisLocal/.env` (gitignored) — flag zapnut v této session na žádost.
- **Scénář:** pro solo/pilotní běh OK; pro distribuci by měl být **default vypnuto** a advokát ho zapíná vědomě (stejně jako opt-in v editoru).
- **Oprava:** v distribuční/`.env.example` nechat `AGENT_EXTERNAL_RESEARCH=0`; zapnutí = vědomá volba. (Kód default už má vypnuto — jde jen o konkrétní .env.)

### NÍZKÉ — 4. Datové mezery „ručení za DPH" a „vada výrobku" bez lokálního pokrytí
- **Důkaz:** eval sweep + gap smoke test — obě témata (NSS/NS agenda) nemá open-data obecných soudů; řeší je jen cloud tier.
- **Scénář:** s vypnutým cloudem tyto dotazy nevrátí relevantní judikát. Není bug, je to hranice zdroje.
- **Oprava / poznámka do release notes:** uvést jako známé omezení; plné pokrytí až přes placený zdroj (Sbírka/NALUS) nebo zapnutý LawGPT tier.

### NÍZKÉ — 5. Odkaz na zdroj = Google search ECLI (klik uživatele)
- **Důkaz:** `lexis-research.js` `normalizeItem` — když poskytovatel nedá `url`, staví se `google.com/search?q="<ECLI/sp.zn./číslo předpisu>"`.
- **Scénář:** klik odešle veřejný identifikátor (ECLI) do Googlu — ne PII, iniciováno uživatelem. Přijatelné; případně nabídnout justice.cz/NALUS místo Googlu.

---

## Ověřeno jako v pořádku (pozitivní)
- **Bind + auth (LexisLocal `backend/server.js`):** default `BIND_HOST=127.0.0.1` (LAN nedostupné), globální `authenticate` middleware (ř. 154) s `apiToken`/`enforceToken`, CORS omezené na loopback, ochrana proti DNS-rebindingu (cizí Host → 403). Cloud tool je dosažitelný jen přes autentizovaný loopback.
- **Gating cloud toolu:** `toolsForAgent` skryje `search_caselaw_online` bez `AGENT_EXTERNAL_RESEARCH=1` nebo v local-only režimu; `execTool`/`impl` to gate ještě jednou. 25/25 testů zeleně (spuštěno reálně).
- **Odchozí data:** cloud tool posílá jen `encodeURIComponent(query)`, žádné hlavičky s tokenem/PII; timeout 20 s; chyby fail-closed na `{error}`.
- **Opt-in UI (editor):** `runAction` má souhlas + cloud marker „☁" + nabídku anonymizace (GDPR Shield) — v souladu s §3 návrhu.

## Nedořešené ověření (kvalita)
- **Editor jest sada nespuštěna** (FUSE most) — 17 research + 6 linker testů je napsáno, ale zeleň nepotvrzena mnou; před vydáním spustit `npm test` lokálně.
