# Ověření S-oprav bridge v0.13 — 8. 9. 2026 (Z260908-1)

Tři opravy z nálezů živého E2E ve VS Code 7. 9. (`PROTOKOL-E2E-VSCODE.md`, N2 / N4 / N5): `E_SQL` místo falešné nuly, zámek jediné pumpy, odsazený res. Harness 235/235 (bylo 223). Živě zbývá ~5 minut u **eaexample** (pumpa, ne VS Code). Dávky leží v `docs\e2e-vscode\ready\`, kopírují se do `requests\`. Res soubory nečti — vyhodnotí je vlákno **Z260908-2** (nebo Z260908-1, když ještě běží); sem patří jen to, co je vidět na obrazovce.

Pořadí je závazné: zámek žije v `pump.wsf` (soubor na disku → nový kód až po **restartu pumpy**), kdežto V0 nasazuje kód do modelu (pumpa se přenačte sama).

| Krok | CO | KDE | VÝSLEDEK, který máš vidět |
|---|---|---|---|
| **1 — V2 zámek** | Zavři běžící okno pumpy (má-li nějaké běžet). Dvojklik `pump.wsf` → počkej na `Pripojeno na EA`. Pak **dvojklik `pump.wsf` podruhé.** | Explorer, `C:\GIT\ea-file-bridge\` | Druhé okno vypíše jeden řádek `Pumpa uz bezi (zamek requests\.pump.lock) - zavri toto okno.` a po ~8 s **samo zmizí**. První okno běží dál beze změny. Zapiš: druhé okno zmizelo samo ✅/❌; první okno něco vypsalo? (nemá) |
| **2 — V0 deploy** | Zkopíruj `ready\req-20260908-V0.json` do `requests\`. | Explorer → konzole pumpy → popup | Konzole `CEKA NA POTVRZENI req-20260908-V0.json`, popup s souhrnem (deploy_src = ELEVATED) → **Ano**. Pak `POTVRZENO a provedeno` a `deploy_src -> prenacitam kod z modelu ...`. Zapiš: popup ukázal 1 op deploy_src ✅/❌; řádek `prenacitam` ✅/❌. Případný `paramsSynced` u `FB_JsonStringify` (nový parametr `indent`) je v pořádku — hlásí ho res, ne obrazovka. |
| **3 — V1 chybný SQL** | Zkopíruj `ready\req-20260908-V1.json` do `requests\`. **Sleduj okno EA.** | Explorer → konzole pumpy → **EA** | Konzole `Hotovo req-20260908-V1.json -> res-20260908-V1.json` **do 2 s** a v EA **žádný dialog** „SQL API Open FAILED". Zapiš: dialog v EA ANO/NE (klíčový bod; před opravou byl ANO a muselo se odkliknout). Jestli dialog přesto vyskočil: odklikni, zapiš přesný titulek + text. |
| **4 — V3 správný SQL** | Zkopíruj `ready\req-20260908-V3.json` do `requests\`. | Explorer → konzole pumpy → EA | Konzole `Hotovo req-20260908-V3.json -> res-20260908-V3.json`, žádný dialog v EA. Zapiš: Hotovo ✅/❌. (Nula řádků je tu legitimní, když v `#FB-TEST` už nejsou constrainty — rozliší res, ne obrazovka.) |

Výsledek = čtyři řádky „krok — ✅/❌ — poznámka" do vlákna Z260908-2 (nebo sem). Pumpa může zůstat běžet.

## Co vyhodnotí vlákno z res souborů (pro úplnost, ne pro Miloše)

- `res-20260908-V0.json`: `status done`, `deploy_src` `updated` = FB_OpQuery, FB_JsonStringify, FB_Main; `paramsSynced` obsahuje `FB_JsonStringify: (v) -> (v, indent)`; `reloadCode true`. Soubor je ještě **kompaktní** (psal ho starý FB_Main).
- `res-20260908-V1.json`: **odsazený** (první res novým kódem), `status error`, `results[0]` = `{op query, status error, code E_SQL, message "SQL API Open FAILED: no such column: Type" (nebo jiný první řádek hlášky EA), sql ...}`. Když by tu bylo `ok/rowCount 0`, je detekce „bez `<Dataset_0>` = chyba" špatně — EA vrací pro chybný SQL něco jiného, než se čekalo; pak zapsat přesný obsah, co `SQLQuery` vrátil (dá se zjistit dočasným zápisem `xml` do message).
- `res-20260908-V3.json`: `status done`, `results[0]` `ok`, `rowCount` 0 nebo 1 (podle stavu constraintů v modelu), odsazený.
- `requests\.pump.lock`: existuje, obsah `pumpa start=<čas> id=<číslo>` (Write se může propsat až po ukončení pumpy — prázdný soubor za běhu není chyba; zámek drží handle, ne obsah).
