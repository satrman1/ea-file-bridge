# E2E protokol — iterace 5 (autorizace, zvýraznění v browseru, kontext výběru)

Klikací návod pro živé ověření u stroje (eaexample, EA 17.1.5). Dávky `req-20260821-*` v této složce. Offline harness prošel **131/131** — tady se ověřuje jen to, co mock nechytí (nativní navigace, EA runtime, dual-runtime pasti §1a/4).

**Předpoklad:** nasazené dávky iterace 4 — dle `requests\processed\` máš k 2026-08-20 nasazeno -00/-06/-07/-08/**-11** (combined). Dávka **-12 (FB_InterpretError) nasazená NENÍ — je proto přibalená do deploy dávky -01 níže**, samostatně ji nepouštěj.

Dávky pouštěj **clipboard režimem** (Copy obsahu req souboru → Specialize → AI Bridge → Zpracovat dávku ze schránky), nebo pumpou (soubor do `requests\`). U deploy dávek čekej potvrzovací dialog (deploy_src = ELEVATED) → **Ano**.

## K1 — deploy + restart

1. Pusť `req-20260821-01-deploy.json` → dialog → Ano → `EAFB OK 20260821-01: 1/1 ops`.
2. **PLNÝ restart EA** (menu + EA runtime kód; Reload nestačí — §1a/3).

## K2 — prescan po restartu

3. Pusť `req-20260821-00-prescan.json` → v odpovědi `cnt` = **101** operací na AICodeBridge = 87 (v0.9) + 7 (clipboard/UX vlna 08-20: FB_ClipboardImport, FB_ClipboardSearch, FB_ElementPath, FB_LogChanges, FB_ShowInBrowser, FB_Status, FB_ResolveBaseDir) + 1 (FB_InterpretError z nenasazené -12) + 6 (iterace 5: FB_AccessGroups, FB_UserAccess, FB_Changes, FB_NavProbe, FB_OpSelectedContext, FB_InBranch). Nižší číslo = deploy neprošel celý. **✅ Živě ověřeno 2026-08-20: `cnt: 101`** (dávka -00; původní očekávání 94 bylo podpočítané — §12 nezahrnoval clipboard/UX vlnu).
4. V menu Specialize → AI Bridge musí být nová položka **„Nav spike (test navigace)"** (jen doma — `navProbe: true`).

## K3 — Output proklik (B-V1)

5. Pusť `req-20260821-04-uxwrite.json` (LOW zápis, bez dialogu).
6. Otevři Output tab **„AI Bridge"** → řádek `[vytvoreno] "FBT IT5 UX" @ …` → **DVOJKLIK na řádek** → Project browser označí prvek FBT IT5 UX. ✅/❌ zapsat.

**⚠ Nález z 1. běhu (2026-08-20): dvojklik NEFUNGOVAL — příčina v deploy_src, ne v mechanismu.** `deploy_src` u existující operace přepisoval jen Code, signaturu ne → `Log` v modelu zůstal 2-parametrový, EA runtime ho kompiloval bez `id` (`typeof id == "undefined"` → 0) → WriteOutput bez navigačního ID. Oprava = sync signatur v deploy_src (`paramsSynced` v response). **Postup opravy (POUZE PUMPOU — deploy_src je JScript-only, v clipboard režimu spadne na ActiveXObject):**

- K3a: pusť `req-20260821-06-deploy-fix-deploysrc.json` (nasadí opravený deploy_src; pumpa si nový kód přenačte až PO doběhnutí dávky — §6a).
- K3b: pusť `req-20260821-07-deploy-log-sync.json` (už novým deploy_src) → response musí nést **`paramsSynced: ["Log: (Repository, msg) -> (Repository, msg, id)"]`**.
- K3c: **PLNÝ restart EA** (EA runtime musí Log překompilovat s novou signaturou).
- K3d: pusť `req-20260821-05-uxwrite2.json` → řádek `[upraveno] "FBT IT5 UX" @ …` → dvojklik → skok v browseru. ✅/❌.

**⚠ Nález 2 z živého běhu (K3d ❌ i s opravenou signaturou): u CUSTOM Output tabu EA dvojklikem nativně NEnaviguje** — tvrzení GUI-KATALOGU §5 platilo nejspíš jen pro handler vendor demo add-inu. Dvojklik vysílá broadcast a obsloužit ho musí **reception** `EA_OnOutputItemDoubleClicked` (t_operation se `StyleEx Reception=1;SignalGUID=…` — ověřeno čtecími dávkami -08/-09; Signal v modelu = el. 10303). Nový handler volá `ShowInProjectView` z user-gesture kontextu = **zároveň živý spike b1** (může spadnout — pak Manage Add-Ins + restart a `FB_Config.outputNav: false`). Pokračování (deploje PUMPOU):

- K3e: pusť `req-20260821-10-deploy-deploysrc-reception.json` (deploy_src umí zakládat receptions) → Ano.
- K3f: pusť `req-20260821-11-deploy-dblclick.json` → Ano → response musí nést **`created: ["EA_OnOutputItemDoubleClicked"]`** a **`receptions: ["EA_OnOutputItemDoubleClicked -> Signal {5F05064B-…}"]`**.
- K3g: **PLNÝ restart EA**.
- K3h: pusť `req-20260821-12-uxwrite3.json` → řádek `[upraveno] "FBT IT5 UX" @ …` → **dvojklik** → skok v browseru. Výsledek zapiš (✅ = K3 i spike b1 potvrzeny; ❌ pád add-inu = spike b1 vyvrácen → obnova, `outputNav: false`, navigace zůstává na FB_Changes).

**⚠ Nálezy 3+4 z živého běhu (K3h ❌ bez pádu + spike 2× krok 1):** (3) model-based add-in dostává broadcast jako **`(Repository, Info)`** s `Info.Get(i).Value` (EventProperties, vendor vzor EA_OnPreDeleteAttribute) — ne COM signaturu (TabName, LineText, ID); handler přepsán, čte jménem i pozicí. (4) **EA runtime nedrží `this._fb*` mezi invokacemi** (§1a/5) — čítač spiku, `_fbLastWriteReqId` i W8 flag nově přežívají ve state souborech `<baseDir>\state-*.txt` (`FB_StateFile`). Bonus nález: `RefreshModelView(0)` (krok 1 spiku) **sbalí strom browseru**. Pokračování:

- K3i: PUMPOU pusť `req-20260821-13-deploy-info-statefile.json` → Ano → v response zkontroluj **`paramsSynced` obsahuje `EA_OnOutputItemDoubleClicked: (Repository, TabName, LineText, ID) -> (Repository, Info)`** a `created: ["FB_StateFile"]`.
- K3j: vypni pumpu → **PLNÝ restart EA**.
- K3k: pusť `req-20260821-14-uxwrite4.json` (clipboard režim OK) → dvojklik na řádek `[upraveno] …`. Díky `navProbe: true` se při dvojkliku zapíše i řádek **`dblclick debug: tab='…' id=… line='…'`** do Output tabu — kdyby navigace zase nešla, tenhle řádek prozradí, co v Info skutečně přišlo (pošli screenshot). ✅ = skok v browseru; pád add-inu = spike b1 ❌.

## K4 — search FB_Changes (B-V2)

7. **Jednorázově** založ hledání: Find in Project (Ctrl+F) → New Search → jméno `FB_Changes` → Group Type **Search** → „Add-in Name and method" = `AICodeBridge.FB_Changes` (**TEČKA**, ne lomítko — lekce T4-0a).
8. Spusť hledání `FB_Changes` s **prázdným** textem → výsledky = prvky poslední dávky (FBT IT5 UX; pokud EA mezitím restartovala, zadej do pole id `20260821-04`). **Dvojklik na výsledek** → skok v browseru. ✅/❌.

## K5 — get_selected_context (C)

9. V Project browseru **označ** FBT IT5 UX → pusť `req-20260821-02-selctx.json` → v odpovědi: `context.type: "Element"`, `name: "FBT IT5 UX"`, `path` = tečková cesta, `branchGuid` = GUID #FB-TEST, `inWhitelist: true`. ✅/❌.
10. Označ libovolný prvek **mimo** #FB-TEST (např. AICodeBridge) → táž dávka s novým id → `inWhitelist: false` + `whitelistNote`. ✅/❌.
11. Nic neoznačuj (klikni do prázdna / zavři diagramy) → táž dávka → `selected: false` + message. (Nepovinné.)

## K6 — scope na find (C)

12. Pusť `req-20260821-03-scope.json` → op 1 (bez scope): `count: 1` (AICodeBridge); op 2 (scope #FB-TEST): `count: 0` + blok `scope` s cestou. ✅/❌.

## K7 — spike navigace (B-V3)

13. Postupuj podle **`SPIKE-NAV.md`** (5 kroků po jednom kliku; výsledky zapiš tam). Až po závěru spiku případně zapínat `showInBrowser`.

## K8 — feature A živě: NEJDŘÍV DOMA V QEAX (rozhodnutí 2026-08-20), pak banka

Na eaexample je security vypnutá → gate se neuplatní; logiku kryje harness. **Živý test běží doma v QEAX modelu se zapnutou security** (E2E model s existujícím vendor add-inem) = zároveň generálka na bankovní nasazení do repa s cizím add-inem. Kompletní plán = **`IT-ANALYSIS\zaprah-vlaken-2026-08-21.md`** (samostatné vlákno). Připraveno předem (2026-08-20/21): MCP recon QEAX (signály Add-In Events kompletní, ExtendedPropertiesAddin 2076), balíčky **#FB-TEST (685)** a **#AI-LOG (686)** založeny přes MCP pod Test Data (377), deploy_src umí přepnout receptions na lokální SignalGUID (přenos add-inu mezi modely, commit c46a8ec). Testy: A1 člen skupiny zapíše (+proklik), A2 nečlen → `E_ADDIN_ACCESS` (čtení projde; pozor cache FB_UserAccess = změna členství chce plný restart EA), A3 zápis bez balíčkových práv → syrová EA hláška → přesný vzor do `FB_InterpretError`, A4 `t_xrefsystem` UserSettings/GroupSettings (aktivace add-inu).

**V bance potom** (s kurýrem): čtecí dávkou jména tabulek (`INFORMATION_SCHEMA … LIKE 't_sec%'`, čekáme `t_secuser`/`t_secgroup`/`t_secuser_group`), `FB_AccessGroups` se skutečnou skupinou JEN v korporátním repu (pravidlo očisty), test s omezeným uživatelem.

## Úklid

`FBT IT5 UX` smazat po testech (delete dávka → ELEVATED → potvrdit), nebo nechat do hromadného úklidu FBT-*.

## Výsledky (živě 2026-08-20, eaexample EA 17.1.5)

| Krok | Výsledek | Poznámka |
|---|---|---|
| K2 počet operací | ✅ | `cnt: 101` (dávka -00; očekávání opraveno z 94 — §12 nepočítal clipboard/UX vlnu) |
| K3 dvojklik Output | ✅ | po 5 iteracích ladění (K3a–K3k + v3–v5): sync signatur deploy_src → reception `EA_OnOutputItemDoubleClicked` → argumenty = zabalené objekty s `.val` (dávky -05…-20); **skok v browseru funguje** |
| K4 FB_Changes | ⚠ vypuštěno | alternativa ke K3, K3 funguje → netestuje se dál (rozhodnutí Miloš). Pozorování z dřívějšího pokusu (po paměti, neretestováno): výsledek dohledal balíček místo elementu a proklik nešel ani Alt+G — kdyby se search někdy oživoval, začít tady |
| K5 kontext (3 případy) | ✅ | -02 element FBT IT5 UX (path+branch+`inWhitelist:true`), -21 AICodeBridge (`inWhitelist:false`+note), -22 kořen (`type:Package`); `currentDiagram` se vrací vždy |
| K6 scope | ✅ | -03: bez scope count 1, se scope #FB-TEST count 0 + `scope` blok s cestou |
| K7 spike | ✅ uzavřen | kroky 1–2 OK (krok 1 sbalí strom), **b1 potvrzen prokllikem** (ShowInProjectView z user-gesture bez pádu); kroky 4–5 + fáze D se nestaví — viz SPIKE-NAV.md |
| K8 security živě | ⏳ | nejdřív DOMA v QEAX (zápřah `zaprah-vlaken-2026-08-21.md`; #FB-TEST 685 + #AI-LOG 686 už založeny přes MCP), pak banka s kurýrem |
