# VYSLEDKY 2026-10-12 — pumpa v0.6 (balík D) — vlákno Z261004b-5

Dávka `IT-ANALYSIS/zaprah-vlaken-2026-10-04b.md` (Z261004b-5). Podklady: revize usability pumpy 4. 10. kap. 6.1 řádek D (FB-PU-02, -03, -04, -05, -07, -10, -11, -13, -14, -15, -18), KONCEPCE potvrzovacích oken pravidla 5 a 6 + kap. 7 (výchozí Storno — rozhodnutí Miloše 4. 10.), FB-UI-08, nález N-E2E-4 (bod 11 promptu). Stav před: `main` = `6adff66` = `origin/main`, harness 520/520, pumpa v0.5, kód v0.17.

**Souhrn:** `pump.wsf` v0.6 + src v0.18 (3 nové operace, 8 upravených souborů, bootstrap), harness **544/544**, `diff-signatures v0.14 HEAD` beze změny (4 změněné signatury z v0.17, vše `typeof`), živě doma 17:18–17:56 nad EAExample: **všech 9 bodů kroku 9 + T6-10a ✅** (schránka a re-attach po restartu EA — kap. 3). Dvě lekce: nové operace v modelu vidí EA runtime (menu) až po restartu EA; kód v0.18 se nasazuje **starou** pumpou, pak teprve start v0.6 (pumpa to sama hlídá — fail-closed).

## 1. Co se změnilo

### 1.1 `pump.wsf` v0.6

| Nález / pravidlo | Řešení v pumpě |
|---|---|
| FB-PU-03 stavový soubor | `responses\pump-status.json`: `phase` (idle / waiting_ea / processing / waiting_confirm / stopped), `file`, `since`, `heartbeat` (~10 s v klidu), **`aliveUntil`** (klid = tep + 30 s; během `FB_Main` = od převzetí + 30 min; během okna = od otevření + 300 + 30 s — smyčka je jedno vlákno a tep během nich neobnovuje), `repository`, `pendingCount`, `lastResult`, `ignored[]`, `pump{version, fingerprint, path, started}`. Pravidlo pro čtenáře: pumpa neběží, když `aliveUntil` minul nebo soubor chybí. |
| FB-PU-07 zámek pro uživatele | `%LOCALAPPDATA%\EA-File-Bridge\pump.lock` (stejná semantika jako zámek složky — otevřený pro zápis, držený handle); uvnitř cesta běžící pumpy. Druhá pumpa z jiné složky: `Pumpa uz bezi z JINE slozky: <cesta>`, exit 2. |
| FB-PU-04 konzole | `announce()` = jeden řádek na dávku z `res`: `OK n/n`, `CHYBA op[i] <kód> … (ok k/n) - zpráva`, `CHYBA <kód> …`, `ZAMITNUTO …`, `CEKA NA TEBE (okno potvrzeni) …`; `lastResult` ve stavu. |
| FB-PU-05 texty | `spust bootstrap (scripts\ITAN-Bootstrap File Bridge.js v EA Scripting), nebo se obrat na spravce` (2×, místo ITAN-Inject); hláška nezkompilované operace říká, co dělat. |
| FB-PU-02 banner | `=== EA File Bridge pumpa v0.6 (eafb/0.2) ===` + po připojení `Pumpa v0.6, otisk <12 hex>` (sha256 souboru přes `FB_FileBytes` + `FB_Sha256` z modelu = hodnota `PUMP-VERSION`). |
| FB-PU-10 | watcher bere jen `req-*.json`; ostatní soubory v `requests\` (kromě `.pump.lock`) ohlásí jednou (`IGNORUJI …`), nechá ležet, drží v `ignored[]`, po zmizení souboru zapomene. |
| FB-PU-11 `processing\` | před `FB_Main` přesun do `requests\processing\`; při startu `recoverProcessing`: res final = `DOKONCENA` → `processed\`; jinak `PRERUSENA` → res `E_INTERRUPTED` (vlastní odpověď pumpy), soubor `rejected\…interrupted.json`, řádek do Output tabu; potvrzený běh má marker `processing\<jméno>.confirmed` → přerušená potvrzená dávka se po startu nenabídne (res `E_INTERRUPTED`, `rejected\`, index bez ní). |
| FB-PU-13 | `errorResponse()` přes `bridge.FB_JsonStringify`, `protocol eafb/0.2`, `id` z dávky (regex nad souborem), `madeBy: "pumpa v0.6"`; fallback vlastní mini serializer, dokud bridge není načtený. |
| FB-PU-14 log | `responses\pump-RRRR-MM-DD.log` (konstanta `PUMP_LOG`, ANSI/CP1250, append po řádku) = tytéž řádky jako konzole. Umožnil i tohle ověření bez čtení obrazovky. |
| pravidlo 5 / FB-PU-18 / FB-UI-08 | typ okna `3 + ikona + 512 + 4096` (výchozí **Storno**); ikona 48 u `delete_/remove_/move_/clone_/import_element_linked/apply_classifier`, kaskád a důvodů s rebuild/prepis/smaz/presun/klon, jinak 32; text = `FB_ConfirmSummary` (jediná legenda — druhá legenda pumpy smazána) + `Ceka od … (N min)` + „Kdyz nerozhodnes do 5 minut, davka pocka a okno se vrati, az ji agent posle znovu nebo az pumpu spustis znovu."; konzole `--- CEKA NA TEBE: okno "<titulek>" (… Enter = Storno) ---`; stav `waiting_confirm`. |
| pravidlo 6 / FB-PU-15/-17 | okno bez restartu = `FB_Main` vrátí stávající `res` (src z -3) → pumpa ho vidí jako `confirm_required` a okno nabídne; při startu `FB_PendingSweep` (expirované jen vypíše `VYPRSELA … -> rejected\`), neexpirované seřazené podle `since` (nejstarší první), položky bez indexu doplněné z `DateLastModified`. |
| bod 11 (N-E2E-4) | po `rucni baseline stale chybi` → jedna věta `NEPROVEDENO …: chybi cerstva rucni baseline. Udelej ji v EA (Ctrl+Alt+B …, jmeno bez FB-AUTO) …`, návrat bez dalšího kola; okno se vrátí při dalším průchodu (tentýž soubor znovu / restart). „Stisk klávesy" z promptu není realizovaný: cscript nemá neblokující čtení klávesnice, smyčka by stála. |
| po reloadu | `reloadCode()` po `deploy_src` volá znovu `FB_SessionStart` (identita repa, vlastní prvky pravidla 3) a znovu spočítá otisk pumpy. |
| fail-closed | `checkCodeVersion()`: chybí-li v modelu `FB_PumpAlive`/`FB_CodeInfo` (kód < v0.18), pumpa dávky nebere — `STOP: kod v modelu je STARSI nez pumpa v0.6 …`. Důvod: starý `FB_Main` by z cesty `requests\processing\…` odvodil `res` do `requests\responses` a `pending` do `processing\pending`. |

Rejected seznam pumpy beze změny (`E_PARSE`, `E_RISK_BLOCKED`, `E_RISK_CONFIRM`, `E_NO_BASELINE`, `E_BLACKLIST`, `E_SCOPE_CONFIG`) — stejné řazení jako adaptéry; `E_INTERRUPTED`/`E_DUPLICATE_ID` z `FB_Main` jdou dál do `processed\`.

### 1.2 src v0.18

- **Otisk nasazeného kódu (FB-PU-02) — volba a zdůvodnění.** Zvolen **hash ne-konfiguračních souborů `src\`** zapsaný do modelu, ne soubor VERSION při tagu: bootstrap v bance nemá git a kód v modelu není nutně stav tagu (doma `deploy_src` denně, v bance to, co přivezl kurýr) — VERSION by říkal, co bylo tagnuto, ne co je v modelu; konfigurace se doma a v bance liší, proto se vynechává (`FB_Config`, `FB_WriteScope`, `FB_OpsAllowed`, `FB_RiskPolicy`, `FB_AccessGroups`, `FB_QcConfig`, `FB_ScaffoldConfig`) a stejný kód dá stejný otisk v obou prostředích. Algoritmus (`FB_CodeFingerprint(files)` = `tools/code-fingerprint.py`): op name → bez konfigurace; text bez BOM, CRLF→LF, bílé znaky na konci pryč + `\n`; seřazeno ASCII; `"<Op>\n<text>\n"` zřetězeno; sha256 UTF-8. Ověřeno: JS i Python nad `src\` = `5e8a6c035d66…` (127 souborů), harness má testovací vektor přes `crypto`.
- Zápis: bootstrap (bod 8; `FB_Sha256` + `FB_CodeFingerprint` zkompiluje ze souborů) a plný `deploy_src` → tagged values `fb.code.fingerprint`, `fb.code.files`, `fb.code.deployedAt`, `fb.code.deployedBy` na `AICodeBridge`; částečný `deploy_src` (`only`) otisk smaže a označí „castecny" (model je směs). Čtení: `FB_CodeInfo(Repository)` (SQL nad `t_objectproperties`) → ping `codeInfo{}`, chat ACK `| kod: <short> (<datum> <kdo>)`, About AI Bridge, `FB_SessionStart`.
- `FB_SessionStart` pod pumpou: verze pumpy z hlavičky `pumpa vX.Y` + sha256 souboru (`this._fbPumpInfo` → ping `pump{}`), porovnání s `PUMP_REQUIRED = "0.6"` → `POZOR: pumpa vX.Y je starsi nez kod v modelu (potrebuje pumpu v0.6+)`; jinak `Pumpa v0.6, otisk …`.
- `FB_PumpAlive(Repository, baseDir, nowMs)` čte `pump-status.json` (`running` = `aliveUntil` v budoucnu a faze ≠ stopped); `FB_ClipboardImport` + `FB_ProcessFolder` při `running` vrátí `BEZI PUMPA v0.6 (<cesta>) - faze … Davky zpracovava pumpa: poloz req-*.json do requests\, nebo pumpu zavri …` a nic nezpracují (Output tab má řádek).
- `FB_Main` v0.18: `reqDirM` i `pendDir` odvozené s výjimkou pro `\processing` (jako `\pending`); `Log` i u předčasných návratů (`E_PARSE` ×3 → `FB ? -> E_PARSE …`, `E_ARGS` zástupný text v `repo`, `E_REPO` deklarace, prázdné `ops`).
- `FB_OpPing`: `codeInfo` (pole `code` je vyhrazené chybám, proto jiný název) + pod pumpou `pump`; `FB_ChatRender` segment pingu; `EA_MenuClick` About s otiskem a „pumpa (pump.wsf)" mezi režimy.
- `tools/code-fingerprint.py` (`--expect`, `--json`).

### 1.3 Harness 520 → 544

Blok „BALÍK D — PUMPA v0.6": `pumpSim()` bere funkce `pad2 … eaAlive` doslova z `pump.wsf` (vzor `pumpsim.js` z revize) nad mocky (WScript, Popup s odpověďmi a snímkem stavového souboru, MockFso rozšířený o `GetFile`, `OpenTextFile`, `Size`/`DateLastModified`; `GetFolder` teď bere i cestu bez koncového `\`). 15 testů pumpy (hlavička/legenda/typ okna; stav + jeden řádek; CHYBA op[N]/E_REPO/CEKA NA TEBE; okno 3+48+512+4096 vs 3+32+512+4096, věta o limitu, jedna legenda, Storno → okno znovu bez restartu; waiting_confirm s aliveUntil = tep + 330 s, Ne = rejected; Ano s markerem; N-E2E-4 jedno okno; processing\ recovery vč. pending pod `requests\`; přerušená potvrzená dávka; IGNORUJI; vlastní odpovědi; čekající po startu s expirací a pořadím; zrcadlo rejected) + 7 testů src (`FB_CodeFingerprint` vektor a vyloučení konfigurace, `FB_CodeInfo`/ping/ACK/About/`pump`, `deploy_src` tagy vč. částečného, bootstrap bod 8 vč. idempotence, `FB_SessionStart` verze pumpy, `FB_PumpAlive`, schránka + GUI fallback při běžící pumpě, `FB_Main` Log předčasných návratů). Upravený starý test „B1 pravidlo 8 kódové kotvy" (pumpa se už mění; kontroluje jen rejected seznam). `bootElement` má `TaggedValues`.

## 2. Živý běh doma (EAExample, 12. 10. 2026 17:18–17:56)

Postup: dávky vhazoval Claude (`docs/e2e-pumpa/ready-v06/`), okna klikal Claude přes computer use (pravidlo 5 paměti klikaci-protokoly; Miloš jen schválil přístup, zavřel starou pumpu a spustil novou, restartoval EA). Čtení výhradně z `res-*.json`, `pump-status.json` a logu `responses/pump-2026-10-12.log`.

| # | Krok | Výsledek |
|---|---|---|
| 0 | `req-v06-00-ping` starou pumpou v0.5 | `done`, bez `codeInfo` (starý kód) — výchozí stav |
| 1 | `req-v06-01-deploy` (deploy_src starou pumpou, Ano kliknuto) | `done`, 134 operací, `created: FB_CodeFingerprint, FB_CodeInfo, FB_PumpAlive`; bez `code` v odpovědi (běžel **starý** `FB_OpDeploySrc`) |
| 2 | `req-v06-02-deploy2` (podruhé, nový deploy_src) | `done`, `code.short = 5e8a6c035d66`, 127 souborů = `tools/code-fingerprint.py` ✅ |
| 3 | `req-v06-03-ping` | `codeInfo.found true`, `5e8a6c035d66`, `deployedBy deploy_src` ✅; `pump{}` chybí (v0.5 po reloadu `FB_SessionStart` nevolá — správně) |
| — | před startem v0.6 položeno: `requests\processing\req-v06-04-prerusena.json` + `res … processing`, `requests\poznamka.txt`, `requests\request-spatne.json` | stará pumpa v0.5 `request-spatne.json` ihned zpracovala → `resuest-spatne.json` (FB-PU-10 reprodukován živě) |
| 4 | Miloš zavřel v0.5, spustil `pump.wsf` v0.6 (17:28:10) | log: banner, řádek Stav/log/zámek uživatele, `Pripojeno`, `Code loader: 135`, `Pumpa v0.6, otisk 946dd26e06b0`, hlášení session s `Otisk kodu v modelu: 5e8a6c035d66 … | Pumpa v0.6, otisk 946dd26e06b0 (C:\GIT\ea-file-bridge\pump.wsf)`, **`PRERUSENA req-v06-04-prerusena.json … -> rejected\`** (res `E_INTERRUPTED`, `id v06-04-prerusena`, `interrupted.since 17:00:00`, soubor `…interrupted.json`), **`IGNORUJI poznamka.txt`**; stav `waiting_ea` → `idle`, `ignored: ["poznamka.txt"]` ✅ |
| 5 | `req-v06-05-ping` | `OK 1/1 req-v06-05-ping.json` (jeden řádek), `lastResult` totéž, ping `pump{version 0.6, short 946dd26e06b0, path}` ✅ |
| 6–7 | `find_packages_by_name FBT-VOLNE`, založení `V06-SMAZAT-A/B` | `OK 1/1` ×2 (LOW, bez okna) |
| 8 | `req-v06-08-delete` (ELEVATED) → okno; **stav během okna `waiting_confirm`, `file req-v06-08-delete.json`, `aliveUntil` = since + 330 s** ✅; okno: ikona upozornění, jedna legenda, `Ceka od 2026-10-12 17:29:25`, věta o limitu, výchozí Zrušit; **Enter** (po kliku do okna) → `CEKA req-v06-08-delete.json (Storno) - davka ceka v pending\ …`, stav `idle`, `pendingCount 1`, res `confirm_required`, nic neprovedeno ✅ |
| 8b | tentýž soubor znovu do `requests\` | okno se vrátilo bez restartu (`duplicate` exemplář v `rejected\`), klik **Ne** → `ZAMITNUTO E_RISK_REJECTED req-v06-08-delete.json - …`, `status rejected`, soubor v `rejected\` ✅ |
| 9 | `req-v06-09-delete-ano` → **Ano** | `OK 1/1`, `done`, `processing\` prázdná (marker smazán) ✅ |
| 10 | druhá pumpa: kopie `pump.wsf` v `C:\Users\milos\CLAUDE\_tmp-pumpa-test\` spuštěná z Total Commanderu | její log: `Pumpa uz bezi z JINE slozky: C:\GIT\ea-file-bridge\pump.wsf (zamek C:\Users\milos\AppData\Local\EA-File-Bridge\pump.lock) …`, okno se po 10 s zavřelo, první pumpa nerušena ✅ (složku `_tmp-pumpa-test` smaž — Claude mazat v CLAUDE nemůže) |
| 11 | EA menu *Zpracovat davku ze schranky* při běžící pumpě (před restartem EA) | dialog „Schranka neobsahuje eafb davku" = starý kód: `FB_PumpAlive` je **nová operace** a EA runtime ji vidí až po restartu EA (`this.FB_PumpAlive` undefined, try/catch) → krok 15 po restartu |
| 12 | T6-10a: `FB_RiskPolicy` dočasně `subtreeMax 10, thresholdsShadow false, requireRecoveryForUpdates true` (deploy_src, Ano — okno s otazníkem ✅), 9 výplňových prvků do `FBT-VOLNE` (12 > 10), `req-v06-14-t610a` update notes `V06-SMAZAT-B` → okno „BEZ AUTOMATICKE ZALOHY … nad prahem (podstrom 12 > subtreeMax 10) … PRED potvrzenim udelej rucni baseline" → **Ano bez baseline** | **jedno okno, pak klid**: `NEPROVEDENO req-v06-14-t610a.json: chybi cerstva rucni baseline. Udelej ji v EA (Ctrl+Alt+B …, jmeno bez FB-AUTO), pak at agent posle tentyz soubor znovu (nebo restartuj pumpu) …`, res `confirm_required` s novým nonce, dávka v `pending\`, stav `idle` ✅ (v0.5 by okno ukázala ihned znovu — N-E2E-4 uzavřen) |
| 13 | politika obnovena (`req-v06-15-deploy-restore`, Ano) | `OK 1/1`, otisk kódu beze změny `5e8a6c035d66` (konfigurace se nehashuje ✅) |

## 3. Po restartu EA (17:49–17:56)

| # | Krok | Výsledek |
|---|---|---|
| 14 | Miloš zavřel a znovu otevřel EA (pumpa běžela dál) | pumpa si ztráty EA **nevšimla** (stav `idle`, tep běžel) — v0.5 i v0.6 kontrolovaly `eaAlive` jen při výjimce u dávky; až ping `req-v06-16` → `Spojeni s EA ztraceno` → `Pripojeno na EA` → Code loader → hlášení session → **`Cekajicich davek v pending\: 1`** → okno `v06-14-t610a` s „Ceka od 2026-10-12 17:35:51 (15 min)" → klik **Ne** → `E_RISK_REJECTED` ✅ (re-attach i nabídka po restartu EA fungují). **Oprava hned (`f88b5de722ed`):** `eaAlive(ea)` se kontroluje v každém průchodu smyčky → `waiting_ea` ve stavu a re-attach bez čekání na dávku. Harness 544/544. Běžící pumpa je ještě verze `946dd26e06b0` — po restartu pumpy platí nová. |
| 15 | EA menu *Zpracovat davku ze schranky* při běžící pumpě (po restartu EA — nové operace v modelu vidí EA runtime až teď) | dialog + Output tab: `FB -> BEZI PUMPA v0.6 (C:\GIT\ea-file-bridge\pump.wsf) - faze idle od 2026-10-12 17:52:30. Davky zpracovava pumpa: poloz req-*.json do requests\, nebo pumpu zavri a klikni znovu.` — nic nezpracováno ✅ |
| 16 | úklid: `req-v06-18-uklid` (smazání 10 testovacích prvků V06-* z FBT-VOLNE, Ano) | `OK 1/1`; `pending\` i `processing\` prázdné ✅ |

Neověřeno živě: About AI Bridge (otisk kódu v dialogu — stejný `FB_CodeInfo` jako ping, který živě prošel; harness má test) a zavření pumpy skutečně uprostřed `FB_Main` (dávky trvají < 1 s — stav „soubor v `processing\` + res `processing`" byl položen ručně a odpovídá tomu, co by zavření nechalo).

## 4. Lekce

1. **Pořadí nasazení:** kód v0.18 se nasazuje **starou pumpou** (deploy_src běží ještě starým `FB_OpDeploySrc` → otisk se zapíše až druhým deploy_src nebo bootstrapem), teprve pak start pumpy v0.6. Opačné pořadí hlídá pumpa (`STOP: kod v modelu je STARSI nez pumpa`). V bance: bootstrap (zapíše otisk hned), plný restart EA, pak nová pumpa.
2. **Nové operace v modelu vidí EA runtime (menu, dialogy) až po plném restartu EA** — těla existujících operací se čtou čerstvě, nové metody ne (`this.FB_PumpAlive` undefined → tichý pád do try/catch). Pumpa je má hned po reloadu.
3. **Stará pumpa v0.5 vedle v0.6:** zámek pro uživatele brání jen druhé v0.6; vendorovaná kopie v0.5 v `ai-transfer` poběží vedle, dokud ji refresh nevymění (`POZOR: pumpa v0.5 je starsi` to řekne při startu).
4. **Computer use:** konzolové okno pumpy (Windows Terminal host) je mimo allowlist = černý obdélník, číst ho nejde — **log `responses\pump-RRRR-MM-DD.log` ho nahradil úplně** (všechna ověření výše jsou z logu a stavového souboru). Okno pumpy přebírá fokus až po kliku do něj (Enter z EA nedoletí). Zavření staré pumpy a start nové = ruční krok (hlavní panel je jen „click", jump list na kliknutí nereaguje). `Textinputhost` zase blokoval jako popředí — grant pomohl.
5. Log je ANSI (CP1250): znak „…" z patičky `FB_ConfirmSummary` se v UTF-8 čtečce zobrazí jako �; v konzoli i okně je správně.

## 5. Co zbývá

- **Hotovo 18:05–18:12 (Claude po připomínce Miloše — složku `ai-transfer` si připojil sám):** refresh workspace `C:\GIT\ai-transfer` (pumpa v0.6 `f88b5de722ed`, `PUMP-VERSION` → `d0a0762`, `.github\` 30 souborů, verify OK), commit `9ba8323`; testovací složka `CLAUDE\_tmp-pumpa-test\` smazána.
- **Miloš:** (a) restartovat pumpu (zavřít okno, dvojklik `pump.wsf`) — běží ještě verze před opravou re-attachu (`946dd26e06b0`), v repu i ve workspace je `f88b5de722ed`; (b) push `ea-file-bridge` (`d0a0762`) a `ai-transfer` (`9ba8323`) z VS Code — z VM chybí přihlášení.
- **Další vlákna:** -6 (texty okna FB-UI-08 — pumpa už žádnou legendu nepřidává, text je celý z `FB_ConfirmSummary`); -8 návody (tabulka hlášek konzole je zatím v `NAVOD-NASAZENI-KLIKACI.md` 6.1); „stisk klávesy" pro opětovnou nabídku čekající dávky nerealizován (cscript nemá neblokující vstup) — náhrada = tentýž soubor znovu / restart pumpy.
