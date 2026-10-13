# Plán dne nasazení v0.21 v bance — 2026-10-16 (vlákno Z261013‑2 → provádí Z261013‑3)

*Verze 1.0, 2026-10-13 (vlákno Z261013‑2, bez Miloše). Kód: tag **v0.21** = `45de928` (na GitHubu, ověřeno 13. 10. 16:19). Předchozí stav v bance: **v0.14** = `75534f1` + opravy `d53164c`/`47fdbb2` přenesené schránkou 10. 9. 2026, bankovní adaptace v korporátním repu (commit „adaptace banka v0.14"). Tento soubor nese žádné interní hodnoty banky — jen placeholdery z tabulky níže. Kódy vláken s U+2011 (sweep).*

> **Co tenhle soubor je.** Pořadí kroků dne D shora dolů s odkazy na kapitoly `docs/NAVOD-NASAZENI-KLIKACI.md` v1.5a (dál jen **NAVOD**). Plán NAVOD neopisuje — říká **co se od 10. 9. změnilo**, **v jakém pořadí** to kliknout, **co čekat** a **kdy zastavit**. Každý krok: CO – KDE – JAK – OČEKÁVANÝ VÝSLEDEK – KDYŽ SELŽE.
> **Co tenhle soubor NENÍ.** Není to návod (ten je NAVOD) ani protokol testu. Výsledky dne D patří do `docs/e2e-banka/VYSLEDKY-2026-10-16.md` (šablona v kap. H).
> **Kdo co dělá:** Miloš u bankovní stanice kliká; vlákno Z261013‑3 vede krok po kroku; dávky dosazuje `tools\banka-dosad.cmd` z `config\banka-hodnoty.json`; výtahy z `res-*.json` dělá bankovní Copilot podle promptu v kap. H (pravidlo `<skryto>`).

## 0. Rychlý přehled dne

| Blok | Co | Kde | Odhad | Kap. NAVOD |
|---|---|---|---|---|
| A | Před dnem D (doma) | VS Code doma | 15 min | — |
| B | Kurýrní klon → korporátní repo (pull, diff, adaptace zpět, commit) | VS Code v bance | 30 min | 1.1–1.3 |
| C | Šest configů = bankovní položky do souborů v0.21 (Copilot) | VS Code v bance, Copilot | 30 min | 5.1–5.6 |
| D | Bootstrap → plný restart EA → Manage Add-Ins → pumpa v0.6 → kontrola parametrů | EA, pumpa | 20 min | 2.2, 4, 3, 4a |
| E | Ping (pumpa, schránka) → checklist → recon → blacklist naostro → LOW + audit → ELEVATED Ne/Ano → deny naostro → úklid | pumpa, EA | 40 min | 6.1–6.4, 7.3a, 7.5 |
| F | Blok 2 (jen když zbývá čas): workspace analytika | VS Code v bance | 30 min | `docs/WORKSPACE-METODIKY.md` kap. 5 |
| G | Go/no-go | — | 5 min | — |
| H | Co přinést domů | Copilot výtahy | 10 min | — |

Celkem ≈ 2 h Miloše bez bloku F. **STOP body** (nepokračovat, zapsat, volat vlákno): bootstrap `STOP:` nebo 0 nahraných; kontrola parametrů ≠ 0 rozdílů; ping `writeScope.problems` neprázdné nebo `repository` ≠ `<TEST-DB>`; `E_SCOPE_CONFIG` kdekoli; cokoli nečekaného v diffu (NAVOD 1.2).

## Placeholdery — dosazuj lokálně, do repa NIKDY

Tabulka NAVOD „Placeholdery" platí celá. Navíc pro tento den (**doplň do `config\banka-hodnoty.json` před blokem E**):

| Placeholder | Co dosadit | Kde se používá |
|---|---|---|
| `<TEST-DB>` | název testovací databáze (identita repozitáře, `DB_NAME()`) | všech 6 configů, každá dávka |
| `<WRITE-GROUP>` | EA security skupina pro write fíčury (rozhodnuto 9. 9., jen korp. repo) | `FB_AccessGroups` |
| `<GUID-AILOG>` | GUID package auditu `<AI-LOG>` **se složenými závorkami** `{…}` | `FB_Config.auditPkg`, dávky `blacklist-22`, `audit-21`, `kalibrace-oken` |
| `<PROTECTED-PKG-1>` | GUID první chráněné větve (blacklist) **se závorkami** — kterou větev, rozhodne Miloš (karta) | `FB_WriteScope`, dávka `blacklist-21` |
| `<PROTECTED-PKG-1-NAME>` | přesné jméno toho balíčku (druhá polovina klíče) | `FB_WriteScope` |
| `<WORK-PKG>` | **nový** — GUID pracovního balíčku pro LOW zápis dne D (doporučení: bývalý `#FB-TEST`, obsah z POC 10.–13. 9. tam je) **se závorkami** | dávky `low-21`, `elevated-2x`, `uklid-21` |
| `<LOGIN>` | EA login uživatele, pod kterým pumpa běží | dávka `recon-21` |
| `<GUID-LOW-EL>` | GUID prvku založeného dávkou `low-21` — z `res-banka-low-21.json` (dosadí Copilot, jako `<GUID-A3>` 13. 9.) | dávky `elevated-21`, `elevated-22` |
| `<GUID-LOW-PKG>` | GUID balíčku založeného dávkou `low-21` — tamtéž | dávka `uklid-21` |
| `<KORP>` | cesta pracovní kopie korporátního repa bridge (pumpa, `requests\`, `src\`) | bloky B–D |
| `<KLON>` | cesta kurýrního klonu | blok B |

**Pravidlo závorek:** v `banka-hodnoty.json` jsou všechny GUIDy **se složenými závorkami** (tak je nese `t_package.ea_guid` i dávky; bridge od v0.20 bere GUID i bez nich, SQL v dávkách ne). Ve `FB_WriteScope` píše Copilot `pkg: "{…}"` ručně — jeden pár závorek, ne dva.

**Dosazování:** dávky z `docs\e2e-banka\ready\` → zkopíruj do `<KORP>\banka-ready\` → dvojklik `<KORP>\tools\banka-dosad.cmd` (bankovní verze z 10. 9., napsaná Copilotem; fail-closed — nenahrazený `<…>` = dávka se neuloží). Nové klíče `WORK-PKG`, `GUID-LOW-EL`, `GUID-LOW-PKG`, `PROTECTED-PKG-1`: když bankovní `banka-dosad` neumí klíč, který není ve své tabulce, nech ho Copilotem doplnit (prompt C.7) — **ověř na první dávce** `ping-21`.

---

## 1. Prescan: bankovní adaptace v0.14 → v0.21 (základ plánu)

Z `git diff --name-status v0.14..v0.21 -- src\` (ověřeno 13. 10. 2026): **101 souborů** v `src\` změněno — **35 nových**, **1 smazaný** (`FB_Whitelist`), 65 upravených; `src\` má **140 souborů = 139 operací + `gatekeeper.ps1`**. Změněné signatury existujících operací: **6** (`FB_Audit` +`human`, `FB_ConfirmSummary` +`ageInfo`, `FB_ResolveEl` +`mode`, `FB_ResolvePkg` +`mode`, `FB_RiskAuditTags` +`baseline`, `FB_RiskNote` +`baseline`; všechny čtou nový parametr přes `typeof`). Mimo `src\`: nový `pump.wsf` **v0.6** (pumpa 10. 9. byla v0.5), nové/změněné docs, `tools\`, `config\`.

### 1.1 Tabulka adaptací (co v bankovních položkách přibývá / mizí)

| Soubor | Stav v bance po 10. 9. | Co přidat ve v0.21 | Co odebrat | Vzor položky (placeholdery) |
|---|---|---|---|---|
| `src\AICodeBridge.FB_WriteScope.js` | **neexistuje** (byl `FB_Whitelist.js` s položkou `{ repo: "<TEST-DB>", pkg: "{<GUID-SANDBOX>}" }`) | **nová položka** (NAVOD 5.2): `cascadeDelete: "block"`, `blacklist[]` s aspoň jednou větví; `name` povinné | `src\AICodeBridge.FB_Whitelist.js` **smazat ze `<KORP>\src\`** (překopírování ho nesmaže — nález N‑P‑2); osiřelou operaci `FB_Whitelist` v modelu nechat (NAVOD 1.2) | `{ repo: "<TEST-DB>", cascadeDelete: "block", blacklist: [ { pkg: "{<PROTECTED-PKG-1>}", name: "<PROTECTED-PKG-1-NAME>", note: "proc je chranena" } ] }` |
| `src\AICodeBridge.FB_Config.js` | položka `{ repo, baseDir: "<KORP>", srcDir: "<KORP>\\src\\", navProbe: false, auditPkg: "{<GUID-AILOG>}" }` | nic nového povinného; **`baseDir` = `<KORP>` ponechat** (N‑GEN‑3: jen tak schránkový kanál odmítne `BEZI PUMPA`); `auditPkg` od v0.17 **povinný** (chybí = `E_SCOPE_CONFIG`) | **žádný klíč `gatekeeper`** (vrátný se v bance nenasazuje, FB‑PU‑43) | `{ repo: "<TEST-DB>", baseDir: "<KORP>", srcDir: "<KORP>\\src\\", navProbe: false, auditPkg: "{<GUID-AILOG>}" }` |
| `src\AICodeBridge.FB_RiskPolicy.js` | `BANK_CLASSES` = kopie `DEV_CLASSES` + `deploy_src: "BLOCKED"`; položka bez `baseline` | **sekce `baseline`** (šablona v komentáři souboru, par. 5 Baseline politiky): kopie `DEV_BASELINE` s `requireRecoveryForUpdates: true`, `sessionBaseline: "off"`; **`ownSessionLow: false`**; **`confirmMaxAgeMin: 480`**. Bez sekce `baseline` by každý start session hlásil varování „polozka nema sekci baseline" a platily defaulty (funkčně totéž, ale varování na startu = šum) | — | viz prompt C.5 |
| `src\AICodeBridge.FB_OpsAllowed.js` | položka `allow: ["*"]`, deny 6 operací | beze změny (jen komentáře) | — | `{ repo: "<TEST-DB>", allow: ["*"], deny: ["delete_from_model", "delete_taggedvalue_from_model", "remove_elements_from_diagram", "clone_package", "clone_elements", "deploy_src"] }` |
| `src\AICodeBridge.FB_AccessGroups.js` | položka `{ repo, writeGroups: ["<WRITE-GROUP>"] }` | beze změny | — | `{ repo: "<TEST-DB>", writeGroups: ["<WRITE-GROUP>"] }` |
| `src\AICodeBridge.FB_QcConfig.js` | bankovní podmnožina kontrol z 10. 9. | beze změny (jen komentář); QC se od v0.21 hlásí větou `Kontrola kvality: …` v Outputu a auditu | — | položka z 10. 9. beze změny |
| `.github\copilot-instructions.md` | ručně adaptovaný kit thin v0.13 (N‑B‑11) | pro den D **není potřeba** (dávky jsou hotové, agent se nepouští); kit = blok F / jiné vlákno | — | — |
| `pump.wsf` | v0.5 | **v0.6** přijde kopií z klonu do `<KORP>` — starou pumpu před startem zavřít | — | — |
| `src-bak\` (mimo git) | záloha z 10. 9. měla být smazána (N‑B‑9) | nová dočasná záloha šesti configů **mimo `<KORP>`** (blok B.0) | po dni D smazat | — |

### 1.2 Co bootstrap v bance vypíše (odvozeno z diffu; čísla ověř)

- `Element AICodeBridge uz existuje (<ID>)` + **`VAROVANI: v modelu je 2 elementu jmenem AICodeBridge`** s výpisem (N‑B‑4 z 10. 9. trvá: druhý bez stereotypu) — kód dostane ten se stereotypem (`<- CIL`). **Není STOP.** `STOP: 2 elementy … se stereotypem JavascriptAddin` by znamenal, že se v modelu něco změnilo — nepokračovat.
- **6 řádků `PX`** (signatury výše) a souhrn **`Hotovo: 35 operaci zalozeno, 139 nahran kod (souboru v src: 139). Parametry: 6 operaci srovnano podle hlavicky (radky PX). Receptions: 0 zalozeno, 0 prepnuto na lokalni Signal, 0 parametry opraveny.`** (receptions založil a opravil bootstrap 10. 9.; žádný nový `EA_*` handler od v0.14 nepřibyl).
- `Otisk kodu v modelu: c37e5f8a4c1a (132 souboru bez konfigurace, …)` — musí sedět na otisk klonu (`python tools\code-fingerprint.py` doma 13. 10. = `c37e5f8a4c1a`; v bance totéž nad `<KLON>`, Python 3.12 je).
- Po restartu: **Code loader 140 operací** (139 + osiřelá `FB_Whitelist`); kontrola parametrů (4a): `operaci v modelu: 140, souboru v src: 139, rozdilu: 0` + jeden řádek `V MODELU NAVIC (bez souboru v src): FB_Whitelist`.

---

## 2. Plán dne — kroky

### A. Před dnem D (Miloš doma, ≤ 15 min)

| # | CO | KDE | JAK | OČEKÁVANÝ VÝSLEDEK | KDYŽ SELŽE |
|---|---|---|---|---|---|
| A1 | Tag `v0.21` je na GitHubu | GitHub `satrman1/ea-file-bridge` v prohlížeči | Code → větev/tag přepínač → Tags | `v0.21` v seznamu (13. 10. 16:19 ověřeno: `4b87c4c` → `45de928`) | VS Code doma: Source Control → … → Push → „Push (Follow Tags)" |
| A2 | Token kurýra platí | — | karta `_FRONTA/PROBLEMS-obnova-tokenu-kuryrniho-kanalu.md` | platí do ≈ 27. 10. 2026 → pro 16. 10. stačí; obnova zůstává kartou | pull v bance spadne na přihlášení → obnovit token před dnem D |
| A3 | ZIP kitů M365 | — | netřeba — kity M365 se dne D nepoužívají | — | — |
| A4 | Odpovědi na kartu rozhodnutí (kap. 3) | `_FRONTA/` | Q1 kit/profil, Q2 druhý účet, Q3 den D, Q4 chráněná větev | odpovězeno před dnem D | bez odpovědi platí doporučení karty (vlákno Z261013‑3 je zopakuje na začátku) |
| A5 | Tento plán a dávky v klonu | — | commit tohoto vlákna je v `main` před tagem? **Ne** — plán vznikl **po** tagu `v0.21`; banka ho dostane pullem `main` (A1 = tag, plán = HEAD) | po pullu je v `<KLON>\docs\e2e-banka\PLAN-NASAZENI-2026-10-16.md` | pull jen tagu by plán nepřinesl — pull `main` (B1) |

### B. Kurýrní klon → korporátní repo (NAVOD 1.1–1.3)

| # | CO | KDE | JAK | OČEKÁVANÝ VÝSLEDEK | KDYŽ SELŽE |
|---|---|---|---|---|---|
| B0 | **Záloha bankovních configů** (6 souborů) před přepisem | Průzkumník | `<KORP>\src\AICodeBridge.FB_Whitelist.js`, `FB_Config.js`, `FB_RiskPolicy.js`, `FB_OpsAllowed.js`, `FB_AccessGroups.js`, `FB_QcConfig.js` → zkopíruj do nové složky **mimo repo**, např. `<KORP>\..\adaptace-banka-v014\` | 6 souborů v záloze — zdroj pro Copilota v bloku C | — |
| B1 | Pull kurýrního klonu | VS Code nad `<KLON>` | NAVOD 1.1: Source Control → … → Pull (větev `main`) | poslední commit = **`docs(e2e-banka): plan nasazeni v0.21 …`** (toto vlákno) nad `45de928` (`docs(e2e-nasazeni): generalka v0.21 …`); … → Checkout to… ukáže i tag `v0.21`. Checkout tagu **nedělej** (plán a dávky jsou až za tagem) | „Repository not found" → identita `satrman1@` (kanál fáze D); přihlášení → token (A2) |
| B2 | Diff klon × korp. repo | VS Code nad `<KORP>` | NAVOD 1.2: kopie obsahu `<KLON>` **bez `.git`** přes `<KORP>` → Source Control ukáže změny | řádově **stovky** změněných souborů (47 commitů od v0.14: `src\` 101, `docs\`, `tools\`, `config\`, `pump.wsf`, `.github\`); **6 configů** ukážou domácí verzi místo bankovní (zálohováno v B0) | nečekaná položka (soubor, který ani doma neexistuje) = stop, vyšetřit |
| B3 | **Smazat `FB_Whitelist.js`** | Průzkumník `<KORP>\src\` | smaž `AICodeBridge.FB_Whitelist.js` (v klonu už není; kopie ho nesmaže — N‑P‑2) | Source Control: soubor jako „Deleted"; `src\` má **140 souborů** (Průzkumník: označ vše → stavový řádek) | zůstane-li, bootstrap ho nahraje jako 140. operaci se souborem — neškodí, ale otisk souborů v src bude 140 a kontrola parametrů nebude sedět na „139" |
| B4 | Checklist adaptací (kap. 1.1) — **zatím jen poznamenat**, přepis dělá blok C | — | projdi tabulku 1.1: 6 configů = po kopii domácí verze (správně — blok C do nich vloží bankovní položku); `pump.wsf` nový; `.github\` domácí (nechat, blok F) | víš, které soubory blok C upraví | — |
| B5 | Commit importu — **až po bloku C** (jeden commit s položkami, ne dva) | VS Code nad `<KORP>` | NAVOD 1.3, zpráva: `import v0.21 + adaptace banka` | jeden commit; Source Control prázdný; **kurýrní klon needitován** | — |

### C. Configy v korporátním repu (NAVOD 5.1–5.6) — prompty pro bankovního Copilota

Postup z 10. 9.: Copilot v bance píše položky **podle promptu**, hodnoty bere z `config\banka-hodnoty.json` (gitignored) a ze zálohy B0; do repa jde jen výsledek. Každý prompt vlož **celý** do chatu Copilota ve VS Code nad `<KORP>` (agent mode; terminál není potřeba). Po každém prompte **otevři soubor a přečti položku** — Copilot je editor, ty schvaluješ.

**C.1 `FB_WriteScope` (nový soubor, nová položka)**

```text
Soubor src\AICodeBridge.FB_WriteScope.js (verze z kurýra v0.21) vrací pole položek per repozitář.
Přidej na konec pole (za položku EA17_Yoga_QEA2.qeax) bankovní položku podle komentáře
„Bankovní šablona" v hlavičce souboru:
  { repo: "<TEST-DB>", cascadeDelete: "block",
    blacklist: [ { pkg: "{<PROTECTED-PKG-1>}", name: "<PROTECTED-PKG-1-NAME>", note: "<PROTECTED-PKG-1-NOTE>" } ] }
Hodnoty vezmi z config\banka-hodnoty.json: TEST-DB → repo; PROTECTED-PKG-1 → pkg
(hodnota v configu už má složené závorky — nezdvojuj je); PROTECTED-PKG-1-NAME → name;
PROTECTED-PKG-1-NOTE → note (když klíč v configu chybí, napiš note: "chranena vetev - rozhodnuti spravce 2026-10-16").
Domácí položky (EAEXAMPLE.QEA, EA17_Yoga_QEA2.qeax) nech beze změny.
Kontrola, kterou mi vypiš: (1) soubor je validní JScript (žádná čárka navíc před ]),
(2) v bankovní položce není žádný text ve tvaru <…>, (3) repo je stejný řetězec jako
ve FB_Config, FB_OpsAllowed, FB_AccessGroups, FB_RiskPolicy, FB_QcConfig — porovnej doslova.
Nic jiného v souboru neměň. Nevypisuj mi hodnoty z configu do chatu — jen „ok / rozdíl v souboru X".
```

**C.2 `FB_Config` (položka existovala — ověř a přenes)**

```text
Soubor src\AICodeBridge.FB_Config.js (verze z kurýra v0.21). V záloze <ZALOHA>\AICodeBridge.FB_Config.js
je bankovní verze z 10. 9. 2026 s položkou pro repozitář <TEST-DB> (repo, baseDir, srcDir, navProbe, auditPkg).
Přenes tuto položku do nového souboru na konec pole (za položku EA17_Yoga_QEA2.qeax), beze změny hodnot.
Ověř: baseDir = kořen pracovní kopie korporátního repa (složka, kde leží pump.wsf a requests\),
srcDir = tatáž složka + \src\ (s dvojitými zpětnými lomítky v řetězci), navProbe: false,
auditPkg = GUID balíčku auditu se složenými závorkami (klíč GUID-AILOG v config\banka-hodnoty.json).
V bankovní položce NESMÍ být klíč gatekeeper (vrátný se v bance nenasazuje).
Domácí položky nech beze změny. Vypiš jen: „položka přenesena, klíče: …", bez hodnot.
```

**C.3 `FB_OpsAllowed`**

```text
Soubor src\AICodeBridge.FB_OpsAllowed.js (v0.21). Přidej na konec pole bankovní položku
  { repo: "<TEST-DB>", allow: ["*"],
    deny: ["delete_from_model", "delete_taggedvalue_from_model", "remove_elements_from_diagram",
           "clone_package", "clone_elements", "deploy_src"] }
s repo = klíč TEST-DB z config\banka-hodnoty.json. Porovnej s bankovní verzí v záloze
<ZALOHA>\AICodeBridge.FB_OpsAllowed.js — seznam deny musí být stejný (6 operací). Domácí položky beze změny.
Vypiš jen „ok, deny 6" nebo rozdíl.
```

**C.4 `FB_AccessGroups`**

```text
Soubor src\AICodeBridge.FB_AccessGroups.js (v0.21). Přenes bankovní položku
  { repo: "<TEST-DB>", writeGroups: ["<WRITE-GROUP>"] }
ze zálohy <ZALOHA>\AICodeBridge.FB_AccessGroups.js na konec pole nového souboru (repo = TEST-DB,
writeGroups = WRITE-GROUP z config\banka-hodnoty.json — jméno skupiny opiš přesně). Domácí položky beze změny.
Vypiš jen „ok" nebo rozdíl, název skupiny do chatu nepiš.
```

**C.5 `FB_RiskPolicy` (položka existovala, přibývá sekce `baseline` + 2 klíče)**

```text
Soubor src\AICodeBridge.FB_RiskPolicy.js (v0.21). Nový soubor má proměnné DEV_CLASSES, DEV_ELEVATE,
DEV_BLOCK a nově DEV_BASELINE a v komentáři na konci bankovní šablonu. Udělej:
1. Před `return [` vlož (pokud tam po kopii není):
   var BANK_CLASSES = {}; for (var bk in DEV_CLASSES) { BANK_CLASSES[bk] = DEV_CLASSES[bk]; }
   BANK_CLASSES["deploy_src"] = "BLOCKED";
   var BANK_BASELINE = {}; for (var bb in DEV_BASELINE) { BANK_BASELINE[bb] = DEV_BASELINE[bb]; }
   BANK_BASELINE.cleanup = {}; for (var bc in DEV_BASELINE.cleanup) { BANK_BASELINE.cleanup[bc] = DEV_BASELINE.cleanup[bc]; }
   BANK_BASELINE.requireRecoveryForUpdates = true;
   BANK_BASELINE.sessionBaseline = "off";
2. Na konec pole přidej položku
   { repo: "<TEST-DB>", classes: BANK_CLASSES, elevate: DEV_ELEVATE, block: DEV_BLOCK,
     budgetMs: 8000, hashMaxChars: 2000000, baseline: BANK_BASELINE,
     ownSessionLow: false, confirmMaxAgeMin: 480 }
   s repo = klíč TEST-DB z config\banka-hodnoty.json.
3. Porovnej s bankovní verzí v záloze <ZALOHA>\AICodeBridge.FB_RiskPolicy.js: prahy elevate/block,
   budgetMs a hashMaxChars musí zůstat stejné jako 10. 9. (parita s domovem); nové je jen baseline,
   ownSessionLow a confirmMaxAgeMin.
Domácí položky beze změny. Vypiš jen „ok" nebo co se liší.
```

**C.6 `FB_QcConfig`**

```text
Soubor src\AICodeBridge.FB_QcConfig.js (v0.21). Přenes bankovní položku (repo + checks[]) ze zálohy
<ZALOHA>\AICodeBridge.FB_QcConfig.js na konec pole nového souboru beze změny. Repo = TEST-DB z configu.
Ověř, že každé SQL v checks používá jen standardní sloupce EA a žádnou dialektovou funkci. Vypiš jen „ok, N kontrol".
```

**C.7 Společná kontrola (po C.1–C.6) + nové klíče pro `banka-dosad`**

```text
Zkontroluj šest souborů src\AICodeBridge.FB_WriteScope.js, FB_Config.js, FB_OpsAllowed.js,
FB_AccessGroups.js, FB_RiskPolicy.js, FB_QcConfig.js:
(1) každý má přesně jednu položku s repo = hodnota TEST-DB z config\banka-hodnoty.json, doslova shodnou ve všech šesti;
(2) v žádném z nich není text <…> (placeholder);
(3) v src\ neexistuje soubor AICodeBridge.FB_Whitelist.js;
(4) FB_Config bankovní položka nemá klíč gatekeeper; FB_WriteScope bankovní položka má cascadeDelete "block"
    a každá položka blacklistu má pkg ve tvaru {GUID}, name a note.
Pak otevři tools\banka-dosad.py a řekni mi, zda umí dosadit libovolný klíč <NAZEV> z config\banka-hodnoty.json,
nebo jen pevný seznam. Pokud jen pevný seznam, rozšiř ho o klíče WORK-PKG, GUID-LOW-EL, GUID-LOW-PKG,
PROTECTED-PKG-1 (stejná mechanika jako u GUID-AILOG) a nech chování fail-closed beze změny.
Do chatu nepiš žádné hodnoty z configu — jen „ok" / „chybí X" / „banka-dosad rozšířen".
```

**C.8 `FB_Whitelist` v modelu:** nechat. Operace v modelu zůstane osiřelá (140. operace), nikdo ji nevolá, bootstrap ji nemaže, kontrola parametrů ji hlásí jako „v modelu navíc" — ne jako rozdíl (NAVOD 1.2, N‑GEN‑6). **Zapsáno; žádný krok.**

**C.9 Commit** (B5): `import v0.21 + adaptace banka` — pak teprve blok D (bootstrap čte `<KORP>\src\` z disku, commit na to vliv nemá, ale evidence je čistá).

### D. Model: bootstrap, restart, add-in, pumpa, kontrola parametrů

| # | CO | KDE | JAK | OČEKÁVANÝ VÝSLEDEK | KDYŽ SELŽE |
|---|---|---|---|---|---|
| D0 | Zavřít starou pumpu (v0.5) a mít **jedinou** EA s `<TEST-DB>` | hlavní panel | křížek na konzoli pumpy; title bar EA = `<TEST-DB>` | žádná konzole pumpy; jedna EA | druhá EA = pumpa by se připojila na první (NAVOD 4b) |
| D1 | **Bootstrap** | EA → Specialize → Scripting → skript `ITAN-Bootstrap` (z 10. 9.) | NAVOD 2.2: obsah `<KORP>\scripts\ITAN-Bootstrap File Bridge.js` vložit přes schránku (skript se od 10. 9. změnil — Ctrl+A, Ctrl+V, Save) → **Run** (ne „Run with Debugger" — výpis by šel do panelu Debug, N‑GEN‑2) → dialog na cestu → `<KORP>\src` | System Output → Script: výpis podle kap. 1.2 (**6× `PX`**, `Hotovo: 35 operaci zalozeno, 139 nahran kod (souboru v src: 139). Parametry: 6 …`, `VAROVANI: … 2 elementu` = očekávané, N‑B‑4). **Zapiš** počty a řádky PX | `STOP:` → nepokračovat; jiný počet `zalozeno`/`nahran kod` → zjisti, kolik souborů má `<KORP>\src\` (B3); `BEZ RECEPTION` → nález, pumpa funguje |
| D2 | **Plný restart EA** | EA | NAVOD 4: File → Exit → spustit → `<TEST-DB>` | Specialize → **AI Bridge** má **6 položek** (NAVOD 4; bez „Zapnout AI import rezim", bez „Nav spike") | menu mlčí → NAVOD 7.1; klik = `Unhandled menu item` → 7.10 |
| D3 | Manage Add-Ins | EA → Specialize → Manage Add-Ins | NAVOD 3.1: **jen pohledem** — řádek AICodeBridge: Groups = skupina z 10. 9., Status **Optional**, Load on Startup ✓ | beze změny proti 10. 9.; nic neklikat | Disabled → receptions (7.1), pak až oprávnění |
| D4 | **Start pumpy v0.6** | `<KORP>\pump.wsf` (nový soubor z kopie B2) | dvojklik; „Vyberte aplikaci" → Windows Based Script Host | konzole podle NAVOD 6.1: banner `v0.6`, `Code loader: 140 operaci`, `==== AI Bridge pripraven ====` **bez varování**, `Repozitar: <TEST-DB>`, `Zapis: blacklist (1 chranenych vetvi)`, `EA security zapnuta`, `chraneno: …`, `bridge chrani i sam sebe: …`, `kaskady … zakazane (block)`, `Otisk kodu v modelu: c37e5f8a4c1a … bootstrap`, `Pumpa v0.6, otisk 943a3941ff62`; v `responses\` vznikne `pump-status.json` a `pump-2026-10-16.log` | `POZOR: repozitar nema polozku ve FB_WriteScope` → C.1 identita; `CHYBA konfigurace cile zapisu (E_SCOPE_CONFIG …)` → 7.3b (**STOP**, opravit C → D1 → D2); `Pumpa uz bezi` → D0; `STOP: kod v modelu je STARSI` → D1 neproběhl nad tímhle elementem; otisk ≠ `c37e5f8a4c1a` → bootstrap z jiné kopie `src\` |
| D5 | **Kontrola parametrů** (NAVOD 4a) | `banka-ready\` → `banka-dosad` → `requests\` | dávka `ready\req-banka-kontrola-parametru.json` (id `banka-kontrola-parametru`) → vyhodnocení: dvojklik **`ready\kontrola-parametru.cmd`** (spustí `docs\e2e-nasazeni\ready-generalka\params-check.py` nad `responses\res-banka-kontrola-parametru.json` a `src\`; Python 3.12 pro stanici); záloha = prompt pro Copilota níže | poslední řádek **`operaci v modelu: 140, souboru v src: 139, rozdilu: 0`** + jeden řádek `V MODELU NAVIC (bez souboru v src): FB_Whitelist […]` | `rozdilu: N` → **STOP**: bootstrap neběžel nad elementem, nad kterým běží pumpa (N‑B‑4: dva elementy — porovnej `ElementID` z výpisu bootstrapu `<- CIL` s tím, co má pumpa), nebo jiný projekt; znovu D1 → D2 → D5 |

Prompt pro Copilota (záloha, když `.cmd` nejde):

```text
Otevři responses\res-banka-kontrola-parametru.json. Pole results[0].rows má řádky {operace, Pos, parametr}.
Pro každou operaci sestav seznam parametrů seřazený podle Pos (stejné Pos nepřerovnávej). Porovnej s prvním
řádkem každého souboru src\AICodeBridge.<operace>.js ve tvaru // AICodeBridge.<operace>(a, b, c);
operace EA_* bez závorek v hlavičce porovnej proti: EA_Connect(Repository), EA_Disconnect(),
EA_GetMenuItems(Repository, MenuLocation, MenuName), EA_MenuClick(Repository, MenuLocation, MenuName, ItemName),
EA_GetMenuState(Repository, MenuLocation, MenuName, ItemName, IsEnabled, IsChecked),
EA_OnOutputItemDoubleClicked(Repository, TabName, LineText, ID), EA_OnOutputItemClicked(Repository, TabName, LineText, ID).
Vypiš: operace jen v modelu (bez souboru), operace jen v src, operace s rozdílným seznamem (model vs src)
a poslední řádek přesně „operaci v modelu: N, souboru v src: M, rozdilu: R". Žádné GUIDy ani cesty do chatu.
```

### E. Ping, checklist, recon, zápisy

Pořadí dávek dne D a jejich soubory v `docs\e2e-banka\ready\` (všechny `protocol eafb/0.2`, `repo <TEST-DB>`, id unikátní — v bance dosud nepoužité):

| # | Dávka | Kanál | CO ověřuje | OČEKÁVANÝ VÝSLEDEK | KDYŽ SELŽE |
|---|---|---|---|---|---|
| E1 | `req-banka-ping-21.json` | **pumpa** (NAVOD 6.1) | kotva session, `writeScope`, `access`, `codeInfo`, `pump` | konzole `OK 1/1 req-banka-ping-21.json`; `res`: `status done`, `repository <TEST-DB>`, `writeScope{mode blacklist, repoKnown true, problems [], cascadeDelete block, securityEnabled true, blacklist[0].found true + path, implicit[audit, addin]}`, `access.access write` (člen `<WRITE-GROUP>`), `codeInfo.short c37e5f8a4c1a`, `pump.version 0.6`, `agentNotes` 6 řádků; **chat ACK nikde** (správně) | `problems` neprázdné → `E_SCOPE_CONFIG` → **STOP** (C → D1 → D2 → D4); `access read` → členství + plný restart EA (pumpa v0.6 se připojí sama, 7.2); `E_REPO` → placeholder v dávce (dosazuj nástrojem, 7.9) |
| E2 | **checklist NAVOD 6.3** | `res-banka-ping-21.json` (Copilot výtah H.2) | 8 položek 6.3 | vše ✓; `Zapis: blacklist …` v konzoli = `writeScope.summary` | cokoli ✗ → nepokračovat zápisem |
| E3 | `req-banka-ping-22.json` | **schránka** (NAVOD 6.2) | interaktivní kanál + chat ACK | **nejdřív s běžící pumpou**: menu „Zpracovat davku ze schranky" → Output `BEZI PUMPA v0.6 (<KORP>) …`, nic se neprovede (`baseDir` = složka pumpy, N‑GEN‑3 ✓) → **zavři pumpu** → znovu: EA dialog `EAFB OK banka-ping-22: 1/1 ops | ping: EA 17.1.x, repo <TEST-DB> | zapis: blacklist (1 chranenych vetvi, EA security zapnuta): <cesty>` + řádek `access`; totéž ve schránce; nad ACK věta `Kontrola kvality` není (čtecí dávka) | ACK v dialogu, ne ve schránce = známé (6.2, dialog autoritativní); `BEZI PUMPA` nepřišlo = `baseDir` ≠ složka pumpy → nález, ne STOP |
| E4 | `req-banka-recon-21.json` | pumpa (znovu spustit `pump.wsf`) | NAVOD 6.4 + §6g: security tabulky, aktivace add-inu (`GroupSettings`/`UserSettings`), členství `<LOGIN>`, počet elementů `AICodeBridge`, počet `#AI-LOG`, **osiřelé `UserSettings`** (N‑K8‑5, poprvé na MS SQL), záměrně prázdný dotaz | `done 7/7`; `t_secusergroup` v seznamu; `AICodeBridge` = **2 řádky** (1 se stereotypem, N‑B‑4); `#AI-LOG` = 1; osiřelé `UserSettings`: počet řádků (0 = čisté; > 0 = kandidáti úklidu správcem, jen počet domů); prázdný dotaz = `ok / rowCount 0 / warning` | `E_SQL` = modální dialog v EA (7.7) → zavřít, dotaz opravit; visí na `Zpracovavam` > 1 min = 7.11 |
| E5 | `req-banka-blacklist-21.json` | pumpa | **blacklist naostro** (6.3 poslední odstavec): `create_or_update_package` s `parent` = `<PROTECTED-PKG-1>` | konzole `CHYBA E_BLACKLIST req-…`; `res`: `error E_BLACKLIST` v **předběžné kontrole** (`problems[0].path ops[0].parent`, text „Bridge sem nezapisuje…"), žádné okno, žádná záloha, soubor v `requests\rejected\`, **audit Artifact `FB banka-blacklist-21`** v `<AI-LOG>` („ODMITNUTA pred zapisem") | balíček vznikl = blacklist neplatí → **STOP** (C.1 GUID/name, ping `found`) |
| E5b | `req-banka-blacklist-22.json` | pumpa | implicitní ochrana: `parent` = `<GUID-AILOG>` (balíček auditu) | `E_BLACKLIST` stejně jako E5 (funguje i s prázdným blacklistem) | — |
| E6 | `req-banka-low-21.json` | pumpa | **LOW zápis** do `<WORK-PKG>`: balíček `NAS-1016 v0.21 LOW` + prvek Class `$0` | `OK 2/2`; `res done`, `riskLevel LOW`, **bez okna**, `baseline none (cisty create)`; Output: blok změn `[vytvoreno]` ×2 s markery `(pkg:ID)`/`(el:ID)` + řádek **`Kontrola kvality: …`** (podle `FB_QcConfig`: `ciste (N kontrol…)` nebo `bez kontrol - …`); dvojklik na řádek označí prvek | `E_ADDIN_ACCESS` → 7.2; `E_PERMISSION` → `<WORK-PKG>` zamčený (7.4) — jiný pracovní balíček; `E_NO_BASELINE` → viz 7.9 „chybi cerstva rucni baseline" (Baseline politika odmítla zálohu — zapiš text, nález) |
| E7 | `req-banka-audit-21.json` | pumpa | **audit Notes v0.21**: Artifacty `FB banka-low-21`, `FB banka-blacklist-21`, `FB banka-blacklist-22` + GUIDy nových objektů pro další dávky | `done`; Notes `FB banka-low-21` začínají **„Davka banka-low-21 skoncila USPESNE: 2 z 2 operaci provedeno."**, „Uroven rizika: bez potvrzeni.", „Zaloha: …", „Kontrola kvality: …", pak `--- strojovy zaznam (beze zmeny) ---` a `--- request ---`; tagy `ai.risk.level=LOW`, `ai.risk.codes`, `result` = strojový řádek; **z řádků s `GUID-LOW-EL` / `GUID-LOW-PKG` dosadí Copilot do `banka-hodnoty.json`** (H.2) | Notes ve starém tvaru (jen strojový řádek) = kód v modelu starší → D1 neproběhl |
| E8 | `req-banka-elevated-21.json` | pumpa | **ELEVATED → Ne**: `move_elements` prvku `<GUID-LOW-EL>` z balíčku `NAS-1016 v0.21 LOW` o úroveň výš do `<WORK-PKG>` (přesun = ELEVATED vždy, NAVOD 5.5; `delete_*` je v bance v deny — nález N‑P‑1; cíl = existující balíček, aby záloha měla nad čím vzniknout) | konzole `CEKA NA TEBE (okno potvrzeni)`; okno podle NAVOD 7.5 („AI chce PRESUNOUT …", Co se stane, Kde, Zaloha, Proc se ptam, Ceka od, Ano/Ne/Storno, výchozí **Storno**, Enter nic) → klikni **Ne** → konzole `ZAMITNUTA`, `res rejected E_RISK_REJECTED`, soubor v `rejected\`, audit „ZAMITL uzivatel v okne pumpy …"; prvek zůstal, kde byl | okno nepřišlo a dávka prošla LOW → politika nemá `move_elements` ELEVATED → **STOP** (C.5) |
| E9 | `req-banka-elevated-22.json` | pumpa | **ELEVATED → Ano** (nový id — tentýž soubor po Ne = `E_DUPLICATE_ID`, N‑GEN‑4) | okno → **Ano** → `OK 1/1`; `res done`, `confirmedByUser true`; prvek `NAS-1016 prvek` je přímo v `<WORK-PKG>` (Project Browser); **záloha** `FB-AUTO <login> s… 2026-10-16 …` nad `<WORK-PKG>` — v EA Baselines; audit „Potvrdil uzivatel v okne pumpy …", `ai.baseline=…decision=created` | `E_NO_BASELINE` (`requireRecoveryForUpdates: true` + záloha nešla, např. `<WORK-PKG>` nad `subtreeMax`) → udělej ruční baseline nad `<WORK-PKG>` (Ctrl+Alt+B, jméno bez `FB-AUTO`) a pošli **tentýž soubor** znovu (čekající po `NEPROVEDENO`, ne po Ne) |
| E10 | `req-banka-uklid-21.json` | pumpa | **deny naostro** (NAVOD 5.3): `delete_from_model` balíčku `<GUID-LOW-PKG>` | `CHYBA E_OP_FORBIDDEN`, nic se neprovede, bez okna; audit zapsán | balíček smazán = `deploy`/`delete` není v deny → **STOP**, C.3 |
| E11 | úklid **ručně** | EA Project Browser | smaž balíček `NAS-1016 v0.21 LOW` a prvek `NAS-1016 prvek` (po E9 leží přímo v `<WORK-PKG>`) ručně (`delete_from_model` je v deny — jako po POC 10.–13. 9.); baselines `FB-AUTO …` z dne D nech (úklid = report) | `<WORK-PKG>` bez balíčků `NAS-1016 …`; `requests\pending\` a `processing\` prázdné | — |
| E12 | volitelně `req-banka-kalibrace-oken.json` (existuje) | pumpa | první kalibrační čtení nad tagy `ai.risk.*` (PROTOKOL §11a) — dnes jen ověření dotazu na MS SQL | `done`; řádky podle `ai.risk.codes` (po dni D: LOW bez okna 1, CLASS_ELEVATED zamítnuto 1 / potvrzeno 1, odmítnuté před zápisem …) | `E_SQL` → dialekt, nález |

### F. Blok 2 — workspace analytika v bance (jen když zbývá čas; bridge bez něj funguje)

Podle `docs/WORKSPACE-METODIKY.md` kap. 5: korporátní **workspace** repo = import `ai-transfer` (`fa42180` na `satrman1/ai-transfer`, kryje ho týž PAT) bez `.git` + `config\banka-hodnoty.json` (kopie z `<KORP>`) + `EA-Repozitar-Kontext-banka.md` + `.github\` přestavěné profilem `banka`.

| # | CO | JAK | POZOR |
|---|---|---|---|
| F1 | Klon `ai-transfer` kurýrem (NAVOD 1.1 nad druhým repem, identita `satrman1@`) | VS Code → Git: Clone `https://satrman1@github.com/satrman1/ai-transfer.git` | PAT se neptá (mlčení = scope sedí) |
| F2 | Import jako korporátní workspace repo | kopie bez `.git` → nové korp. repo → commit `import ai-transfer fa42180` | `PUMP-VERSION` ve workspace musí říkat **0.6** (ověř — vendorovaná pumpa z 13. 10.); jinak kopie `pump.wsf` z `<KORP>` |
| F3 | Config + kontext | `config\banka-hodnoty.json` ← kopie z `<KORP>`; `EA-Repozitar-Kontext.example.md` → `EA-Repozitar-Kontext-banka.md` (doplnit tabulku velkých tabulek: `t_seclocks` ≈ 1,45 M řádků 10. 9., N‑B‑3) | gitignored soubory nikdy do kurýra |
| F4 | `.github\` profilem banka | **v bance nejde** — `refresh-workspace.py --profile banka` potřebuje kanon `Skilly\`, který v bance není (N‑B‑11, nález N‑P‑8). Profil `config\vscode-profile.banka.json` (gitignored, z `.example`) by Miloš doplnil jen pro build; dnes = kit zůstává ručně udržovaný z 11. 9. (`ready\kit-thin-banka\`) | hotový build profilem banka s placeholdery kurýrem = jiné vlákno (Q1 karty) |
| F5 | Pumpa z workspace | od F2 analytik startuje `pump.wsf` **z workspace**, ne z `<KORP>`; `FB_Config.baseDir` pak musí ukazovat na workspace (jinak schránka a *Stav bridge* ukážou jinou složku, N‑GEN‑3) → změna C.2 + bootstrap + restart | dne D pumpa běží z `<KORP>` — přepnutí `baseDir` až s F |

### G. Go/no-go

| Kritérium | Zdroj | GO když | NO‑GO → |
|---|---|---|---|
| Bootstrap souhrn | D1 | `35 zalozeno / 139 nahran / Parametry 6`, žádný `STOP:` | D1 znovu po B3 |
| Kontrola parametrů | D5 | **0 rozdílů**, 140 v modelu / 139 v src | STOP, D1 → D2 → D5 |
| Ping pumpou | E1 | `problems []`, `repository <TEST-DB>`, `access write`, otisk `c37e5f8a4c1a`, pumpa 0.6 | C → D |
| Ping schránkou | E3 | ACK se segmentem `zapis: blacklist`; `BEZI PUMPA` při běžící pumpě | nález (ne STOP, pokud ACK přišel) |
| `E_BLACKLIST` | E5 (+E5b) | v předběžné kontrole, balíček nevznikl, audit | STOP (konfigurace) |
| LOW + audit v0.21 | E6, E7 | `done` bez okna, Notes větami, `Kontrola kvality` řádek | STOP (kód v modelu) |
| ELEVATED Ne / Ano | E8, E9 | okno FB‑UI‑08, Ne = `E_RISK_REJECTED`, Ano = `done` + `FB-AUTO` záloha + audit | STOP (politika) |
| `E_OP_FORBIDDEN` | E10 | delete odmítnut | STOP (`FB_OpsAllowed`) |
| `E_ADDIN_ACCESS` u nečlena | jen s druhým účtem (Q2); dávka `ready\req-banka-A2-write.json` (10. 9., `parent` `<GUID-SANDBOX>` → stejnou hodnotu jako `<WORK-PKG>`) | nečlen → `E_ADDIN_ACCESS`, nic se neprovede | bez druhého účtu **přeskočit** (doloženo 13. 9.) |

**Při NO‑GO:** v modelu **zůstává kód v0.21** (rollback kódu se nedělá — chyba je vždy v konfiguraci nebo prostředí, kód prošel generálkou). Oprava = soubor v `<KORP>\src\` → bootstrap (D1) → plný restart EA (D2) → pumpa (D4) → ping (E1). **Návrat k v0.14** (jen kdyby v0.21 blokoval práci analytiků a oprava nebyla do konce dne): v `<KORP>` Source Control → … → Checkout to… → commit „adaptace banka v0.14" (před importem) → bootstrap z toho `src\` (nahraje starý kód do všech 105 operací; 35 nových zůstane v modelu osiřelých — neškodí, nikdo je nevolá) → plný restart EA → **starou pumpu v0.5** (z téhož checkoutu) — pumpa v0.6 nad kódem bez `FB_PumpAlive` odmítne (`STOP: kod v modelu je STARSI`). Pak zpět na `main`.

### H. Co přinést domů (bez interních hodnot)

**H.1 Šablona `docs/e2e-banka/VYSLEDKY-2026-10-16.md`** (vyplní vlákno Z261013‑3 z výtahů):

```markdown
# Nasazení v0.21 v bance — výsledky živého běhu 2026-10-16 (vlákno Z261013‑3)
*Repozitář `<TEST-DB>` (MS SQL 2022, EA 17.1.x, security zapnutá). Kód v0.21 = 45de928, otisk c37e5f8a4c1a, pumpa v0.6 (943a3941ff62). Plán: PLAN-NASAZENI-2026-10-16.md. Žádné interní hodnoty.*

## 1. Shrnutí (3 věty: prošlo/neprošlo, odchylky, go/no-go)

## 2. Tabulka bloků
| Blok/krok | CO | VÝSLEDEK ✅/⚠/❌ | Čas | Doklad (`res-…`, výtah) | Poznámka |
|---|---|---|---|---|---|
| B1–B5 | import v0.21 | | | commit „import v0.21 + adaptace banka" | počet změněných souborů v diffu |
| C.1–C.7 | configy | | | kontrola C.7 | |
| D1 | bootstrap | | | výpis: zalozeno / nahran / PX / VAROVANI | |
| D2–D4 | restart, add-in, pumpa | | | konzole: Code loader, otisk | |
| D5 | kontrola parametrů | | | `operaci v modelu / souboru / rozdilu` | |
| E1–E3 | ping pumpa + schránka | | | `writeScope.problems`, `access`, ACK | |
| E4 | recon | | | počty (sec tabulky, AICodeBridge, #AI-LOG, osiřelé UserSettings) | |
| E5/E5b | E_BLACKLIST | | | kód, `problems[0].path`, audit | |
| E6–E7 | LOW + audit | | | riskLevel, QC řádek, Notes první věta | |
| E8–E9 | ELEVATED Ne / Ano | | | text okna (první řádek), audit věta, záloha FB-AUTO | |
| E10–E11 | deny + úklid | | | E_OP_FORBIDDEN; ruční úklid | |
| F | workspace (blok 2) | | | | |

## 3. Doložená čísla (smí do vaultu)
| Co | Hodnota | Kde změřeno |
|---|---|---|
| EA verze | | ping `eaVersion` |
| Operace v modelu po bootstrapu | 140 (139 + FB_Whitelist)? | kontrola parametrů |
| Osiřelé UserSettings | počet | recon-21 |
| Doba bootstrapu / kontroly parametrů / recon | s | konzole |
| Kalibrace oken — řádky | | kalibrace-oken |

## 4. Texty dialogů a hlášek (doslova, `<skryto>` místo hodnot)
- okno ELEVATED (E8): první řádek, řádek Zaloha, řádek Proc se ptam
- ACK schránky (E3)
- hlášky pumpy, které NAVOD nezná

## 5. Nálezy N‑B2‑1… (klasifikace: šablona · kanon · bridge · prostředí · banka · obsluha)
| # | Co se stalo | Klasifikace | Stav |
|---|---|---|---|

## 6. Go/no-go (tabulka G s výsledky) a co zbývá
```

**H.2 Prompt pro bankovního Copilota — výtah z `res` (pravidlo `<skryto>`), použij pro každou dávku:**

```text
Otevři responses\res-<ID>.json. Vypiš mi výtah pro protokol: status, code, message (prvních 300 znaků),
pro každou položku results[]: op, status, code, a tato pole, pokud existují: riskLevel, confirmedByUser,
baseline (jen decision a name), rowCount, truncated, warnings[], problems[] (path + text), writeScope
(mode, repoKnown, problems, cascadeDelete, securityEnabled, počet položek blacklist a zda mají found true,
implicit[].kind), access (access, securityEnabled, reason), codeInfo.short, pump.version, qcLine.
Pravidlo <skryto>: každý GUID, login, název repozitáře/databáze, cestu v souborovém systému i tečkovou
cestu balíčků v modelu nahraď textem <skryto>; jména balíčků NAS-1016 … a jména dávek nech. Počty řádků
dotazů (rows) vypiš jen jako číslo. Nic jiného z res do chatu nekopíruj.
Když dávka je banka-low-21 nebo banka-audit-21: navíc do config\banka-hodnoty.json dopiš klíče
GUID-LOW-EL a GUID-LOW-PKG (GUID se složenými závorkami nového prvku „NAS-1016 prvek" a balíčku
„NAS-1016 v0.21 LOW" z results) a potvrď mi jen „doplněno" — hodnoty do chatu nepiš.
```

**H.3 Co dál domů:** výpis bootstrapu (bez cesty `src`), konzole pumpy při startu (bez cesty a identity → `<skryto>`), text okna ELEVATED, ACK schránky, počty z recon, nálezy, čas každého bloku; **commit** `<KORP>` je bankovní — domů jde jen VYSLEDKY + případné opravy kódu (ne tento den: kód se nemění).

---

## 3. Otázky pro Miloše (jedna karta `rozhodni` ve frontě: `_FRONTA/IT-ANALYSIS-rozhodnout-den-nasazeni-v021.md` — balík, položky a = Q3, b = Q2, c = Q4, d = Q1)

| Q | Otázka | Doporučení | Důsledek |
|---|---|---|---|
| Q1 | Kit `.github` v bance: nechat ručně udržovaný z 11. 9. (a), nebo před dnem D postavit doma build profilem banka s placeholdery a poslat kurýrem (b)? | **a** pro den D — kit není pro nasazení potřeba (dávky jsou hotové); b = nové vlákno po 16. 10. | b posouvá den D |
| Q2 | Je k dispozici druhý účet (nečlen `<WRITE-GROUP>`) pro `E_ADDIN_ACCESS` naostro? | **ne** → přeskočit (doloženo 13. 9. A2) | s účtem +10 min (restart EA + pumpy 2×) |
| Q3 | Den D: Čt 15. 10. (a) nebo Pá 16. 10. (b)? | **a** — pátek zůstane jako rezerva na opravu konfigurace; vlákno Z261013‑3 je připravené od 14. 10. | b = bez rezervy |
| Q4 | Chráněná větev `<PROTECTED-PKG-1>`: jedna skutečná větev (master katalogy / šablony) (a), nebo prázdný blacklist a test jen přes balíček auditu (b)? | **a** — bez skutečné větve blacklist v bance nikdy nikdo neověřil; hodnotu zapiš jen do `banka-hodnoty.json` | b = E5 odpadá, zůstává E5b |

Dál platí bez otázky (rozhodnuto dřív): `baseDir` = `<KORP>` (NAVOD 5.1, N‑GEN‑3), `cascadeDelete: "block"`, `ownSessionLow: false`, deny 6 operací, vrátný se nenasazuje, `FB_Whitelist` v modelu zůstává.

## 4. Nálezy tohoto vlákna (rozpory návodu × kód × zadání; oprava = jiné vlákno)

| # | Nález | Kde | Dopad na plán |
|---|---|---|---|
| N‑P‑1 | Zadání Z261013‑2 chtělo ELEVATED test jako `delete $N z low` — v bance je `delete_from_model` trvale v deny (`FB_OpsAllowed`, NAVOD 5.3) → přišel by `E_OP_FORBIDDEN`, ne okno | zadání × NAVOD 5.3 | ELEVATED = `move_elements` (třída ELEVATED vždy, NAVOD 5.5); `delete` = test deny (E10); úklid ručně (E11) |
| N‑P‑2 | NAVOD 1.2 „zkopíruj obsah klonu přes korp. repo" **nesmaže** soubory, které v klonu zanikly — `src\AICodeBridge.FB_Whitelist.js` by v `<KORP>` zůstal a bootstrap by ho nahrál jako operaci se souborem (140 v src) | NAVOD 1.2 × git diff `D` | krok B3; kandidát do NAVOD 1.2: „soubory smazané mezi tagy smaž ručně (seznam v release poznámce)" |
| N‑P‑3 | NAVOD 4a uvádí očekávaný počet „10. 10. 2026: 119", 6.3 „12. 10.: 139", 2.1 „140 operací" — pro v0.21 v bance platí **140 v modelu / 139 v src** (osiřelá `FB_Whitelist`) | NAVOD 4a/6.3/2.1 | čísla v D5; kandidát: sjednotit na „139 + osiřelé" |
| N‑P‑4 | NAVOD (Placeholdery, 4a, 6.1) posílá na `<KORP>\tools\banka-dosad.cmd` v repu **bridge**; `WORKSPACE-METODIKY` kap. 5 říká, že `banka-dosad` žije ve **workspace** `ai-transfer`; repo bridge `tools\` žádný `banka-dosad` nemá — v bance existuje jen verze, kterou 10. 9. napsal Copilot do `<KORP>` | NAVOD × WORKSPACE-METODIKY × `tools\` | dne D bankovní verze z `<KORP>`; nové klíče ověřit (C.7); po bloku F = verze z workspace |
| N‑P‑5 | NAVOD 5.5 „nejmenší funkční zápis" RiskPolicy nemá sekci `baseline`, `ownSessionLow`, `confirmMaxAgeMin`; šablona v komentáři `FB_RiskPolicy.js` je má | NAVOD 5.5 × src | prompt C.5 podle src; kandidát NAVOD 5.5 |
| N‑P‑6 | Tabulka Placeholderů v NAVOD nezná `<LOGIN>` (užívá ho 6.4 a `banka-dosad`), ani `<WORK-PKG>`, `<GUID-LOW-EL>`, `<GUID-LOW-PKG>`, `<PROTECTED-PKG-1-NAME>` | NAVOD Placeholdery | tabulka v tomto plánu; kandidát NAVOD |
| N‑P‑7 | `config\vscode-profile.banka.example.json` má `denyOps` 3 (`deploy_src`, `delete_from_model`, `clone_package`); `FB_OpsAllowed` v bance deny **6** — kit by analytikovi říkal méně zákazů, než bridge vynucuje | config × NAVOD 5.3 | netýká se dne D (kit se nestaví); kandidát: sjednotit example na 6 |
| N‑P‑8 | Zadání bloku F předpokládá „refresh profilem banka z korp. repa bridge" — `refresh-workspace.py` potřebuje `--kanon`, kanon v bance není (N‑B‑11) → kit v bance z buildu nevznikne | zadání × WORKSPACE-METODIKY kap. 5 | F4 = jen import + pumpa + config; kit = Q1 |
| N‑P‑9 | N‑B‑4 (druhý element `AICodeBridge` bez stereotypu) od 10. 9. neuklizen → bootstrap vypíše `VAROVANI`, kontrola parametrů (dotaz filtruje stereotyp) ho nevidí | PROTOKOL‑POC §Nálezy | očekávané, ne STOP; úklid druhého elementu = ruční krok správce (kandidát karta po dni D) |
| N‑P‑10 | Konvence závorek u GUID placeholderů nebyla nikde zapsaná (`{<PROTECTED-PKG-1>}` v šabloně config vs `'<GUID-AILOG>'` v SQL vs `"parent": "<GUID-SANDBOX>"` v dávkách) | NAVOD, dávky 10. 9. | pravidlo „v configu vždy se závorkami" v tabulce Placeholderů |
| N‑P‑11 | NAVOD 1.1 „Checkout to… ukáže tag verze" — plán a dávky vznikly **po** tagu `v0.21`; banka musí pullovat `main` (HEAD), checkout tagu by plán nepřinesl | NAVOD 1.1 × tento commit | B1 |

## 5. Zdroje

`docs/NAVOD-NASAZENI-KLIKACI.md` v1.5a (kap. 1–8) · `docs/NAVOD-NASAZENI-BANKA.md` §6 · `docs/e2e-banka/PROTOKOL-POC-BANKA-2026-09-10.md` (N‑B‑1…18) · `docs/e2e-nasazeni/VYSLEDKY-2026-10-13-generalka.md` (kap. 6 N‑GEN‑1…6, kap. 8 release) · `docs/WORKSPACE-METODIKY.md` kap. 5 · `PROBLEMS/kuryrni-kanal-prenos-repa.md` fáze D–F · `IT-ANALYSIS/ZADANI-cil-zapisu-ea-file-bridge.md` kap. 2 (R5), 5.2 · `src\AICodeBridge.FB_RiskPolicy.js`, `FB_WriteScope.js`, `FB_Config.js` (bankovní šablony v komentářích) · `git diff v0.14..v0.21`.

## Changelog

- **v1.0 — 2026-10-13** (vlákno Z261013‑2): vznik. Dávky `ready\req-banka-ping-21/22, recon-21, blacklist-21/22, low-21, audit-21, elevated-21/22, uklid-21.json` + `ready\kontrola-parametru.cmd`.
