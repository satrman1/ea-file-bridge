---
name: verzovani-release
description: Kompletní verzovací a release cyklus v EMR — příprava (root elementy + version diagram + baseline), clone structure as new version s release postfixem, úklid po release a kontrola čitelnosti v Infoportu. Sloučeno z verzovani-priprava + verzovani-clone + verzovani-cleanup + publikace-infoport (historický název — Infoport žádnou publikaci nepotřebuje).
license: Complete terms in LICENSE.txt
---

# verzovani-release

> Konvence verzování ověřeny v EMR (version_ diagramy, #ARCHIVE — viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §9). Klonovací mechanismus ověřen testem 2026-07-05 (`Feedback-Verzovani-Mechanismus.md` (mimo workspace — vyžádej od uživatele)) — V1 z technické stránky vyřešeno, zbývá jen formát `ARELYYMM`. Konvence zápisu: `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md). Mezery vůči plnému toolguide doplněny dle `Verzovani-Kritika-a-Redesign.md` (mimo workspace — vyžádej od uživatele) (v1.4, § 2.8 + rozhodnutí § 6.2c) — viz Changelog skillu.
>
> **Oficiální EA postup (`emr-versionining-oficial.png` (mimo workspace — vyžádej od uživatele)) nedělá plnou kopii package** — nová `_ARELyymm` package vznikne prázdná (jen `version_` diagram), obsah se do ní dostává dvěma cestami: (a) skutečně měněné elementy se klonují jednotlivě, (b) nezměněné se **přesunou** (move), ne kopírují — přesun ověřeně zachovává elementID/GUID (test 2026-07-05), takže externí vazby (Usage impact, 505-1) na nezměněné elementy zůstávají platné bez zásahu. To je přesnější a na referenční integritu šetrnější než plný `clone_package` (viz krok 3 níže, který zůstává jednodušší, ale dražší alternativou).

## Zařazení
- **Typ:** Produkční · **Role:** Správce repozitáře · **Fáze:** F4–F5 · **Brána:** G3

## Vstupy
- Schválená G2; seznam verzovaných packages (UC packages, service packages) a co se v nich mění.

## Kroky

**Příprava:**
1. Per verzovaná package ověř: hlavní elementy v rootu, `version_<Název package>` diagram (`CSOB-ITAN::Version Root Diagram`, jen root elementy, bez atributů/operací). Chybějící doplň.
2. `create_baseline` na úrovni **KAŽDÉ verzované package** (checklist bod 14) — ne jen nad rooty (#PILOT/BA; precedent kola 2 byl špatně — ✅ N-K3-8, vrácení G3 kola 3). Návratový bod a zdroj diffu; bez baseline nepokračuj. Restore manifest a všechny podklady bran uvádějí **plné Path reference** (`/Logical Design/…/DEMO Manager/DeleteMyReservation`), ne jen ID.

2b. **Baseline konvence (toolguide):** verze baseline = verze package (atribut `Version`, viz krok 5b). Pracovní baselines značíme prefixem `work_` — po finalizaci analýzy se **mažou**. Cílový stav per package: typicky 1 baseline pro finální verzi + případné hotfixové.

**Klonování (as-is / to-be) — dvě cesty, vyber podle rizika:**

*Cesta A — přesná (preferovaná, šetří GUIDy nezměněných elementů):*
3. Založ novou prázdnou package s postfixem `ARELYYMM` (⚠ jen doslovný formát potvrdit) + fresh `version_<Název package>` diagram v ní (stejný název jako vždy, typ `CSOB-ITAN::Version Root Diagram`).
4. Elementy, které se **nemění**: přesuň operací **`move_elements`** (`package` = společná cílová package a/nebo `elements[{element, package}]`, `withChildren` default `true`; Risk Gate **ELEVATED vždy** — potvrzuje člověk) — elementID/GUID se zachová (ověřeno testem 2026-07-05 i round-tripem bridge 2026-08-21), element zmizí z originálu a objeví se v nové package; vlastněné potomky a diagramy si přesun bere s sebou (response `children`/`diagrams`). Žádné riziko pro externí vazby. ⚠ Přesun **nikdy** přes `create_or_update_elements` s novým package — update package nemění, vrací jen warning a element zůstane v originálu (N-P2).
5. Elementy, které se **mění**: pokud nejsou kompozitní (nemají vlastní diagram), `clone_elements` je bezpečné. Pokud **jsou** kompozitní (UC/UCR/LS/SR/DTO) — `clone_elements` jejich vlastní diagram **nezkopíruje** (ověřeno, prázdná schránka bez lifelinů/zpráv). Buď diagram ručně přebuduj (`create_or_update_diagram` + `place_elements_on_diagram` + `create_or_update_messages` podle obsahu originálu přečteného přes `get_diagrams_information`), nebo tenhle konkrétní element přenech člověku v EA (nativní Clone Element as New Version + fix skript, krok 7b).

5b. **Atribut `Version`** (oficiální konvence toolguide): při release navyš o **+1** (celé číslo) na verzované **package** (B4), na klonovaných **elementech** (C3) i na **diagramech**; HOTFIX navyšuje o **+0.1**. Verze v názvu package/elementu *není* verze — atribut `Version` je jediný nositel posunu v čase, suffix `_AREL` nese stav (plánovaný vs. produkční), ne verzi. Zpětně se `Version` nedopočítává — začíná se od aktuální hodnoty (migrace dle kritiky kap. 5). ✅ Zápis `Version` (i `Author`) přes ea-file-bridge je **ověřen** (MATICE-PARITY K6): elementy `create_or_update_elements` (pole `version`, `author`), package `create_or_update_package` (`version`, `author`), diagramy `update_diagram_properties` nebo `create_or_update_diagram` — nastavuj dávkou v témže kroku jako klon/přesun, ne jako manuální krok (N-P3).

*Cesta B — jednoduchá (`clone_package`), cena = ztráta GUID kontinuity:*
3b. `clone_package` na celou package najednou — ověřeno bezpečné pro vnitřní vazby (Message endpoints, `operationID` binding se přemapují správně) i pro kompozitní diagramy (přenesou se pod nová elementID). Rychlejší, ale **úplně všechno** (i nezměněné elementy) dostane nový GUID — externí vazby na nezměněné elementy z jiných packages zůstanou ukazovat na starou (originální) package, ne na nový release. Vhodné pro malé package nebo když návaznost nezměněných elementů zvenčí není kritická. ⚠ **V bance je `clone_package` (spolu s `delete_from_model` a `deploy_src`) trvale v deny whitelistu executoru** (`FB_OpsAllowed`, `NAVOD-NASAZENI-KLIKACI.md` §5.3 v repu ea-file-bridge) — dávka skončí `E_OP_FORBIDDEN`; cesta B je tam **ruční krok člověka v EA** (nativní Clone Structure as New Version), agent připraví jen podklad (co klonovat, název `_ARELYYMM`). Cesta A (`move_elements` + `clone_elements`) zůstává dávkou (N-P10).

Obě cesty: HOTFIX, který má platit pro as-is i to-be zároveň, se nehlídá automaticky — zapsat ručně do obou (`Version` +0.1 v obou, krok 5b). Opomenutí detekuje QC „HOTFIX guard" v [qc-verzovani.sql](references/qc-verzovani.sql) — pusť ji před G3.

6. Po klonu vizuálně / v notes odliš, co se v tomto release skutečně mění (inspirace `emr-versionining-alternative_*.png` (mimo workspace — vyžádej od uživatele): šedivé/neaktivní odlišení nezměněných elementů na verzovacím diagramu, kumulativní changelog poznámka s AREL/datem/autorem/popisem přímo na version diagramu). As-is (originální package) zůstává nedotčen, dokud úklid (kroky 8+) neprovede přejmenování/archivaci.
7. Změny modeluj v klonu/nové package (volání příslušných produkčních skillů nad to-be packagí).

**Vizuální oprava diagramu (manuální fallback):**
7b. Pokud po klonu (přes AI kanál/bridge i po ručním EA zásahu) vypadá zkopírovaný sekvenční diagram vizuálně rozbitě (zprávy překryté / na špatné výšce), jde o známou chybu Time Aware Modeling verzování EA (souřadnice connectoru se nezkopírují správně). Oprava existuje jako EA skript `Scripts/EA162-ONLY-ITAN-Fix Versioned Sequence Diagram.js` (Specialize > Script na diagramu, EA 16.2) — přes bridge spustit nejde (spouštění EA skriptů není v protokolu — záměrně manuální), vykaž jako manuální krok pro člověka. Skript vyžaduje, aby na diagramu nebyly `Constraint` elementy mimo package diagramu (jinak žádá ruční „odverzování" napřed).

**Úklid po release (začištění):**
8. **Koordinace termínu (HITL):** termín začištění je **dohoda LITANA × AIL** — koordinaci termínu vykaž jako HITL krok dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md). Bez potvrzeného termínu začištění neprováděj.

8b. **Mazání nerelevantních klonů:** klonované elementy, které v nové verzi už nejsou relevantní, se **mažou** (ne archivují). Před každým smazáním ověř (`get_elements_information` / `get_packages_information` — plná Path reference), že mažeš **ze správné package** — z nové produkční, ne z originálu ani z archivu. Destruktivní krok → jmenovitý seznam mazaných elementů do shrnutí producenta (HITL). **V bance je `delete_from_model` v deny** (`FB_OpsAllowed`, NAVOD §5.3) → mazání = **ruční krok člověka** přes delete-request workflow (§12a pravidel: GUID + zdůvodnění + výskyt na diagramech čtecí dávkou `query` nad `t_diagramobjects`); dávku s delete neposílej (N-P10).

8c. **Archivace — konvence pojmenování (rozhodnutí kritiky § 6.2c, formát upřesněn 16. 8.):** historické verze (zbylý obsah originální package) přesuň do archivního snapshotu s payload názvem **`BEFORE_ARELYYMM`** — kotví **release, který ukončil platnost** (údaj zjistitelný i u historických artefaktů, u nových vždy; sémanticky bohatší než datum). `#` prefix disciplína (převzato z MAPI praxe): prefix `#` dostane archivní **package i všechny diagramy v ní** — v Usage/dopadovce je hned vidět, co ignorovat. **Datum do názvu jen při kolizi** dvou snapshotů uvnitř jednoho ARELu (typicky hotfix). Datovaná konvence `#ARCHIV_YYYY_MM_DD` se NEzavádí (byla by čtvrtou konvencí vedle existujících).

8d. **Fallback pojmenování:** pokud AREL, který platnost ukončil, nelze zjistit (typicky starší obsah bez dohledatelného release), použij toolguide fallback **`_hist<NN>`** (NN = pořadové číslo v rámci package). Staré archivy v cizích konvencích (`#ARCHIVE`, `#ARCHIV_YYYY_MM_DD`) se zpětně nepřejmenovávají — convert-on-touch dle kritiky kap. 5.

8e. Zruš dočasné struktury včetně **`work_` baselines** (krok 2b); vyprázdni #TODO-IN/OUT dotčené větve.

9. `emr-qa` (sada F4): baseline + version diagramy + žádné orphany po klonu/přesunu. Navíc pusť QC kontroly [qc-verzovani.sql](references/qc-verzovani.sql) — „vazby do archivu" (505-1/Usage mířící do archivu, kritika 2.3) a „HOTFIX guard" (kritika 2.6); nálezy do podkladů G3.

**Čitelnost mimo EA (handoff):**
10. Infoport je **tenký klient nad EMR** — obsah je v něm vidět průběžně, žádný export/publikační krok neexistuje (HTML export je jen starší doplňková cesta, metodika §9.2). Člověku předej pouze kontrolu čitelnosti (checklist bod 15): klíčové diagramy uložené, notes bez šablonových zelených textů, navigace od survey k detailu funguje (`get_diagram_image` pro vizuální kontrolu).

## Kontrola výstupu
As-is i to-be vedle sebe, diff dohledatelný z baseline, žádné orphany. K dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4, ✅ 2026-07-17 — „žádné nejistoty" explicitně; typický flag: nejednoznačné mapování katalog↔LD, formát `ARELYYMM`). Pak `emr-qa` (FINAL) → podklad pro G3 dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md).

## Operace ea-file-bridge
`create_baseline, get_baselines, baseline_diff, move_elements (přesun nezměněných elementů, ELEVATED), clone_elements, clone_package (v bance deny → ruční krok), create_or_update_package (version/author K6), create_or_update_elements (version/author K6), create_or_update_diagram, update_diagram_properties, get_diagrams_information (čtení originálu při ručním přebudování kompozitního diagramu), place_elements_on_diagram, create_or_update_messages, get_packages_information, get_diagram_image, delete_from_model (v bance deny → delete-request)`

> ✅ Rev. 2026-08-29 (framecheck): `create_baseline` (K5), `clone_package`/`clone_elements` (K3) i `create_or_update_messages` (K1) jsou v bridge **implementované** (Dokumentace v0.9 §4.1–4.4; historicky iterace 3 — naplněno). Ruční krok / handoff platí jen pro operace držené v produkci v deny whitelistu executoru. `get_diagram_image` = PNG export iterace 2.

> Restore z baseline (`apply_baseline`) je pro AI **trvale zakázán** (§12a pravidel) — provádí jen admin ručně v EA.

## Changelog skillu

- **2026-09-11** — Z260911‑1 (kanon před set full): krok 4 přesun = `move_elements` (N-P2, ne update s novým package); krok 5b `Version`/`Author` přes bridge ověřeno K6 — věta „vendor ask“ odstraněna (N-P3); cesta B (`clone_package`) a úklid 8b (`delete_from_model`) v bance deny → ruční krok člověka + odkaz NAVOD-NASAZENI-KLIKACI §5.3 (N-P10); 8b bez MCP operace `get_current_package`; seznam operací srovnán s registrem bridge.
- **2026-08-16** — doplněny mezery vůči oficiálnímu toolguide dle `Verzovani-Kritika-a-Redesign.md` (mimo workspace — vyžádej od uživatele) v1.3 § 2.8 a rozhodnutí § 6.2c (soulad s guidance dle § 6.1 krok 1, žádný redesign): krok 2b (baseline konvence — verze baseline = verze package, `work_` prefix + smazání po finalizaci), krok 5b (atribut `Version` +1/release, +0.1/HOTFIX na package/element/diagram; zápis přes MCP/bridge neověřen → vendor ask), kroky 8–8e (HITL koordinace termínu začištění LITANA×AIL, mazání nerelevantních klonů s kontrolou správné package, archivní konvence `BEFORE_ARELYYMM` (plný závazný tvar dle kritiky v1.4, § 6.2c) + `#` prefix na package i diagramech, datum jen při kolizi v jednom ARELu, fallback `_hist<NN>`), krok 9 (odkaz na nové QC kontroly [qc-verzovani.sql](references/qc-verzovani.sql)). Mimochodem opraven chybný odkaz v kroku 5 („krok 6b" → 7b). Redesignová část (stavová TV, barvy, paralelní elementy — syntéza V4+V2) se do skillu **nezapisuje** — čeká na pilot K5.
- **do 2026-08-10** — původní verze: sloučení verzovani-priprava + verzovani-clone + verzovani-cleanup + publikace-infoport; klonovací mechanismus ověřen testem 2026-07-05.
