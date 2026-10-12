# VYSLEDKY 2026-10-12 — audit a kontrola kvality pro člověka (Z261004b‑12, src v0.21)

Vlákno Z261004b‑12 (dávka `IT-ANALYSIS/zaprah-vlaken-2026-10-04b.md`), předchůdce Z261004b‑7 DOBĚHLO (`2f278be`, harness 590/590). Podklad: `IT-ANALYSIS/UI-Vystupy-EA-File-Bridge.md` kap. 3.1 (FB‑UI‑01), 3.2 (FB‑UI‑02), 3.6 (FB‑UI‑06), 3.11 (FB‑UI‑11); pravidlo 2 z paměti `klikaci-protokoly-a-srozumitelnost` (věty bez kódů nahoře, detail dole).

Cíl: auditní záznam v `#AI-LOG` a výsledek kontroly kvality čte člověk bez znalosti kódů; strojový řádek auditu zůstává doslova beze změny; QA report v `#QA` má vzor „verdikt první větou, nálezy nahoře".

## 1. Co se změnilo (src, v0.21 — otisk kódu v modelu `c37e5f8a4c1a`, 132 souborů bez konfigurace, 139 operací)

| Vzor | Soubor | Změna |
|---|---|---|
| FB‑UI‑06 | **nový `FB_AuditText(kind, resp, risk, baseline, qc, extra)`** | Věty pro člověka: „Davka <id> skoncila USPESNE/CHYBOU: N z M operaci provedeno." · „Uroven rizika: bez potvrzeni / vyzadovala potvrzeni / blokovano." + „Potvrdil/Zamitl uzivatel v okne pumpy / dialogu EA / okne bridge <datum cas>." (+ „Potvrzeni neplati: obsah davky se mezitim zmenil." u integrity) · „Proc potvrzeni: <věty z `FB_ReasonText`>" (jen ne‑LOW) · „Zaloha: '<jmeno>' nad balickem <cesta> / neporizovala se (<duvod>) / nepodarilo se ji poridit (<duvod>) / automaticka se neporizovala, davka je nad prahem …" · „Kontrola kvality: …" (z `FB_QcText`, jen konečný audit zápisové dávky). `kind` = `final` nebo kód odmítnutí: `E_BLACKLIST` (a ostatní kódy předběžné kontroly — „ODMITNUTA predbeznou kontrolou (<kód>)"), `E_ADDIN_ACCESS`, `E_RISK_BLOCKED`, `E_NO_BASELINE`, `E_RISK_REJECTED`, `E_RISK_INTEGRITY`; u odmítnutí navíc „Duvod: <message>" (max 300 znaků) a „Nic se nezapsalo." Čtecí dávka: „Uroven rizika: davka jen cte, nic nezapisuje." Celé tělo v try/catch → při chybě `""` (audit nesmí spadnout kvůli větám). Texty bez diakritiky. |
| FB‑UI‑06 | `FB_Audit` | Hlavička `(Repository, reqId, summary, requestText, human)`; `human` čten **jen přes `typeof`**; Notes = `human + "\n\n--- strojovy zaznam (beze zmeny) ---\n" + summary + "\n\n--- request ---\n" + requestText` (bez `human` původní tvar). **Tag `result` = `summary.substring(0, 250)` beze změny.** |
| FB‑UI‑06 | `FB_Main` (5×), `FB_ConfirmPending` (2×) | Všech 7 volajících skládá `human` přes `FB_AuditText` (vlastní try/catch) a předává ho jako 5. parametr: P2 `emitPrecheck` (E_BLACKLIST aj.), `E_ADDIN_ACCESS`, `E_RISK_BLOCKED`, `emitNoBaseline`, konečný audit (až **po** `FB_QcRun` — pořadí ř. 1118 → 1150 ponecháno, `resp.qc` jde do vět), zamítnutí a `E_RISK_INTEGRITY`. |
| FB‑UI‑11 | **nový `FB_QcText(qc)`** → `{ line, samples[] }` | „Kontrola kvality: ciste (N kontrol, bez nalezu)." · „Kontrola kvality: NALEZ - <desc> (<id>, Nx)[; …]. Zapis probehl; kontrola hlida cele dotcene balicky, nalez nemusi pochazet z teto davky." + `samples[]` (max 3 řádky prvků na kontrolu, `Name`/`Object_ID` ze `sample`, marker `(el:ID)` + navId) · „Kontrola kvality neprobehla: <reason> - zapis tim neni dotcen." · „Kontrola kvality: bez kontrol - <reason>." Skloňování 1 kontrola / 2–4 kontroly / 5+ kontrol. |
| FB‑UI‑11 | `FB_Main` | Hned za `FB_LogChanges` jeden řádek Output `FB <id> - Kontrola kvality: …` + řádky prvků nálezu s navId (dvojklik). |
| FB‑UI‑11 | `FB_ClipboardImport`, `FB_ProcessFolder` | Dialog schránky: věta QC **nad ACK** (za „Davka <id> zpracovana."); ACK do schránky beze změny (skládá se před větou). GUI fallback: věta v souhrnu za jménem dávky. `FB_ChatRender.qcLine` **nezměněn** (model čte ACK). |

`diff-signatures v0.14 HEAD` po commitu: +1 změněná signatura (`FB_Audit` +`human`, typeof) = 6 celkem; nové soubory `FB_AuditText`, `FB_QcText` (deploy_src je založil: `created: ["FB_AuditText","FB_QcText"]`, `paramsSynced: FB_Audit (…) -> (…, human)`). Registr 42 operací beze změny — oba pomocníci nejsou operace dávky.

## 2. Kanon (FB‑UI‑01 / FB‑UI‑02) a kit

- `IT-ANALYSIS/Skilly/_shared/qa-checklisty.md`: sekce **QA report** → nová podsekce *Vzor notes QA reportu* (první řádek `Výsledek: VYHOVUJE | VYHOVUJE S VÝHRADAMI | NEVYHOVUJE — N blokujících nálezů, N varování, N informací.`, pak CO ŘEŠIT PŘED BRÁNOU (B), VAROVÁNÍ (W, se zdůvodněním), CO STROJ OVĚŘIL A PROŠLO (jeden odstavec), RUČNÍ KROKY, čára „technický detail" s GUIDy/dávkami/I) + 5 tvrdých pravidel; číselník tagged value `vysledek` = `pass` / `pass-s-varováními` / `fail`. Sekce **QA verdikt jako filtr brány** → tvar sekce 2 gate package „Kontrola kvality — co musíš rozhodnout" (úvodní věta s počty slovy, číslované „Brání schválení" s návrhem schválit s podmínkou / vrátit, „Zůstává se zdůvodněním", odkaz na plný report; bez GUIDů; prázdná skupina se vynechá).
- `IT-ANALYSIS/Skilly/emr-qa/SKILL.md`: krok 6 a 7 odkazují na vzor; **Tvrdá pravidla** + bod „QA report i filtrovaná podoba dodržují vzor … report, který začíná scopem, GUIDem nebo výčtem prošlých kontrol, se před zápisem přepíše"; **Kontrola výstupu** + bod „Report dodržuje vzor" (co se kontroluje).
- Kódy vzorů v kanonu psány s U+2011 (`FB‑UI‑01`) — sweep kitu je jinak hlásí jako Jira klíč (5 neošetřených nálezů při prvním buildu).
- Kit `.github` (doma, `--set full`): přegenerován, **103 souborů, verify OK, sweep NEOŠETŘENÉ 0**; změněné `skills/emr-konvence/references/qa-checklisty.md`, `skills/emr-qa/SKILL.md`, `skills-manifest.md`. `IT-ANALYSIS/M365\` a `IT-ANALYSIS/emr-bridge\` (mimo `archive/`): grep `qa-checklisty` = 0 → bankovní kity a ZIP se nemění (QA kanon do banky nejde).

## 3. Harness

590 → **603/603** (`HARNESS_SKIP_DIFFSIG=1`; blok „Z261004b-12 (FB-UI-06 / FB-UI-11)", 11 testů + 2 syntax): (a) UI‑06 a/a2 — Notes v pořadí věty / oddělovač / strojový záznam **doslova** / request, `tag result == summary.substring(0, 250)` a nezačíná větou, bez `human` původní tvar, signatura z modelu v0.20 (4 parametry) nad novým tělem nespadne; (b) b1 ELEVATED potvrzená v pumpě („Potvrdil uzivatel v okne pumpy", důvody větami, záloha jménem), b2 zamítnutá v dialogu EA, b3 `E_BLACKLIST` z P2, b4 `E_RISK_INTEGRITY`, b5 všech 7 volajících předává `human` + pořadí `FB_QcRun` → konečný audit; (c) UI‑11 c1 čtyři stavy `FB_QcText`, c2 řádek v Outputu za blokem změn pro ciste / nalez (prvek s `(el:501)` a navId) / nedobehlo / bez_kontrol **a ACK `qcLine` beze změny** (stávající testy I7 zelené), c3 dialog schránky a GUI fallback ze zdroje; (d) žádná diakritika v nových zdrojích. `test/build-vscode.test.py` **30/30 OK** (spuštěno mimo mount — na mountu přesahuje 3 min).

## 4. Živé ověření doma — EAExample, pumpa v0.6, 12. 10. 2026 21:18–21:27 (bez Miloše u klávesnice; okna pumpy přes computer use)

Dávky v `docs/e2e-pumpa/ready-aq/`, odpovědi `responses/res-aq-*.json`.

| # | Dávka | Výsledek |
|---|---|---|
| 00 | `aq-00-read` (GUID `FBT-VOLNE`, `#AI-LOG`) | done; `FBT-VOLNE` = `{07475E42-13BC-4182-B01E-AB46EDA94BBE}` (1118), `#AI-LOG` 1055 |
| 01 | `aq-01-deploy` (`deploy_src`) | okno pumpy ELEVATED → **Ano přes computer use** (tool `right_click` = fyzický levý); done, 139 operací, `created: FB_AuditText, FB_QcText`, `paramsSynced: FB_Audit +human`, otisk `c37e5f8a4c1a`; reload pumpy, `FB_SessionStart` ukazuje nový otisk. Audit této dávky ještě **starým** kódem (Notes bez vět) — očekávané. |
| 02 | `aq-02-low` (create `AQ Prvek auditu` v `FBT-VOLNE`, LOW) | done bez okna; `qc.status = ciste` (1 kontrola); audit `{5DF84B48-…}` |
| 03 | `aq-03-notes` (úprava notes prvku 11905 přes `id`, LOW) | done bez okna; baseline `reused` (FB-AUTO téže session), `qc = bez_kontrol`; audit `{1AE88085-…}` |
| 04 | `aq-04-read` (Note + tagy auditů) | **Notes `FB aq-02-low`**: `Davka aq-02-low skoncila USPESNE: 1 z 1 operace provedeno.` / `Uroven rizika: bez potvrzeni.` / `Zaloha: neporizovala se (cisty create).` / `Kontrola kvality: ciste (1 kontrola, bez nalezu).` / prázdný řádek / `--- strojovy zaznam (beze zmeny) ---` / `done: 1 ops (1 ok, 0 chyb) \| risk=LOW writeOps=1 … \| baseline=none (cisty create)` / `--- request ---` / JSON. **Tag `result`** = strojový řádek (250 znaků), ne věty ✅. `FB aq-03-notes`: `Zaloha: 'FB-AUTO - s20261012-1 2026-10-12 17:30:55' nad balickem Example Model.FBT-VOLNE (pouzita cerstva zaloha z teto session).`, `Kontrola kvality: bez kontrol - zadna kontrola se netykala teto zmeny (scope balicku neznamy).` ✅ |
| 05 | `aq-05-delete` (smazání fixtury 11905, ELEVATED) | okno → Ano přes computer use; done, `deleted: true`, `confirm.channel = pumpa` |
| 06 | `aq-06-read` | **Notes `FB aq-05-delete`**: `Uroven rizika: vyzadovala potvrzeni. Potvrdil uzivatel v okne pumpy 2026-10-12 21:25:54.` / `Proc potvrzeni: Mazani a odebirani nejde vzit zpet jednim krokem, proto ho vzdy potvrzuje clovek. Davka maze 1 cil; bez potvrzeni je dovoleno nejvys 0.` / `Zaloha: 'FB-AUTO …' nad balickem Example Model.FBT-VOLNE (…)` ✅; tag `ai.risk.codes = CLASS_ELEVATED;THRESHOLD_ELEVATED`, `ai.risk.confirm = required=1;confirmedByUser=1;channel=pumpa;at=…`, `result` = strojový řádek ✅; `COUNT(*)` prvku 11905 = 0 (fixtura uklizena). |

**Output tab EA (screenshot přes computer use, zoom):** `FB aq-02-low - zmeny v modelu (…)` / `[vytvoreno] "AQ Prvek auditu" @ Example Model.FBT-VOLNE.AQ Prvek auditu (el:11905)` / **`FB aq-02-low - Kontrola kvality: ciste (1 kontrola, bez nalezu).`** / `FB aq-02-low -> done: 1 ops (1 ok, 0 chyb) | risk=LOW …`; u `aq-03-notes` **`Kontrola kvality: bez kontrol - zadna kontrola se netykala teto zmeny (scope balicku neznamy).`** ✅ (řádek za blokem změn, před souhrnným řádkem). Stav NALEZ a NEPROBĚHLA jen harnessem (v EAExample je jediná QC kontrola a prošla).

Fixtury: `AQ Prvek auditu` smazán dávkou 05; auditní Artifacty `FB aq-*` v `#AI-LOG` zůstávají (audit se neuklízí). Dialog schránky / GUI fallbacku živě neověřen (kód v EA runtime se mění až plným restartem EA — N-B2O-1; změna je jedna věta nad ACK, kryje harness c3).

## 5. Nálezy

- **N-AQ-1 (otevřený):** při reloadu kódu po `deploy_src` (21:21:29 → `Code loader` 21:23:47, běžně ~15 s) se v EA objevil **modální dialog SQL chyby**, který odkliknul Miloš (21:23); text dialogu nezachycen, pumpa po kliknutí pokračovala normálně, `FB_SessionStart` i všechny další dávky v pořádku. Časově to padá do `pump.wsf loadBridge` (SQL `t_object` na `AICodeBridge` + enumerace `Methods`/`Parameters`) hned po prvním `paramsSynced` přes `deploy_src` pumpou doma (parametry `FB_Audit` smazány `DeleteAt` a znovu založeny). Hypotéza: EA po přestavbě parametrů metody vydá SQL chybu při prvním čtení `Parameters` (`Position`); při dalších deployích se sync neopakuje, takže se to nemusí projevit. Co udělat: při příštím deployi se změněnou signaturou nechat EA v popředí a dialog vyfotit; pokud se opakuje, místo `DeleteAt`/`AddNew` zkusit přejmenování existujících parametrů + `Update()`.
- N-AQ-2 (poznámka): audit dávky `deploy_src` samotné je vždy ve tvaru **starého** kódu (skládá ho `FB_Main` před reloadem) — u prvního nasazení v0.21 v bance bude jeden audit bez vět; není to chyba.
- N-AQ-3 (poznámka): v tabulce 3.0 `UI-Vystupy` nebyl u FB‑UI‑08 (hotovo v Z261004b‑6) stav Prov. aktualizován — doplněno jen do hlavičky stavu dokumentu, řádek tabulky ponechán („nic jiného neměň").

## 6. Co zbývá

- Push `main` (Miloš z Windows — VM nemá přihlášení).
- Rozhodnutí o diakritice (spike S1, UI-Vystupy kap. 3.15) — tady se neotvírá; po něm je přepis vět v `FB_AuditText`/`FB_QcText` mechanický.
- Z261004b‑8 (návody) může startovat — v navodech zmínit tvar auditu (§8 bod 5 PROTOKOL) a řádek QC v Outputu.
- N-AQ-1 ověřit při dalším deployi se změněnou signaturou.
