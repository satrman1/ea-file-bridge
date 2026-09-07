---
name: emr-qa
description: Jednotný QA engine nad EMR. Spouští kontrolní sadu dle fáze (F0/F1/F3/F4/FINAL) definovanou v _shared/qa-checklisty.md — placement, traceabilita, úplnost artefaktů, čistota scénářů, vazby na katalog, verzovací připravenost; SQL kontroly přes ea-sql-expert. Třídí nálezy (blokující/varování/info) a píše QA report. Použij po každém produkčním skillu a před každou bránou.
license: Complete terms in LICENSE.txt
---

# emr-qa

> Sloučeno z: funkcni-analyza-qa, logicky-design-qa, verzovani-qa, emr-placement-validator, trasovatelnost-validator, sql-kontrola-kvality, model-views-dashboard, finalni-checklist. Kontroly = data v `qa-checklisty.md` (skill `emr-konvence`, references/qa-checklisty.md), tento skill je engine.

## Zařazení
- **Typ:** QA · **Role:** Správce repozitáře / SQL Expert · **Fáze:** průřezově, vrcholí před branami G0–G3

## Vstupy
- Scope: package/větev (GUID nebo cesta) + projekt.
- Sada: `F0` | `F1` | `F3` | `F4` | `FINAL` (viz `qa-checklisty.md` (skill `emr-konvence`, references/qa-checklisty.md)).

## Kroky
1. Načti kontrolní sadu z `qa-checklisty.md` (skill `emr-konvence`, references/qa-checklisty.md) a vzory z `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele).
2. Strukturální kontroly přes EA MCP: `get_packages_information`, `get_elements_information`, `get_connectors_information`, `get_diagrams_information` — úplnost packages, konektory, tagged values, klasifikátory lifelinů, message↔operace. **Výskyt elementu na diagramech** (kontroly 6b, 9d) zjisti čtecí dávkou `query` — samostatná bridge operace pro hledání elementu na diagramech **neexistuje** (nález K11 auditu MCP→bridge, registr operací `EAFB-Operace-Registr.md` (skill `eafb-bridge`, references/EAFB-Operace-Registr.md)):

```sql
SELECT dob.Object_ID, dob.Diagram_ID, dgm.Name, dgm.Package_ID
FROM t_diagramobjects dob
JOIN t_diagram dgm ON dgm.Diagram_ID = dob.Diagram_ID
WHERE dob.Object_ID = <Object_ID>
```
3. SQL kontroly přes skill `ea-sql-expert` (orphany, duplicity, anomálie — průřezová sekce checklistů). Opakovaně potřebné dotazy navrhni k uložení jako search / model view (manuální instalace v EA).
4. Textové kontroly (čistota scénáře, soulad UCR↔scénář) proveď LLM analýzou scénářů ze **Scenarios tab** (U2 rev. 2026-08-17; čtení přes `query` nad `t_objectscenarios` — kroky jsou XML v `XMLContent` — nebo readback `create_or_update_scenarios`); nálezy vždy s citací místa.
4b. Bezpečnostní kontroly AI zápisu (`emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md) §12, u zápisů do produkční EMR): razítka `AI-Created/Session/Batch/User/Tool` úplná na všem AI-created (B), `AI-pre-*` baseline existovala pro každý dotčený existující package (B), objem dávky vykázán v result a překročení orientační soft úrovně potvrzeno uživatelem (✅ R2 — kvóty se nevynucují, jen signalizují; chybějící vykázání = W), update cizího obsahu má schválený dry-run s auditní stopou (B), restore manifest v result dávky (W).
5. Klasifikuj nálezy **B/W/I** dle checklistu. U blokujících uveď konkrétní nápravu; bezpečné opravy (chybějící konektor, špatný diagram typ) smíš po výslovném potvrzení provést a re-run.
6. Sestav QA report (sada, scope, datum, výsledek, nálezy) — zápis do `/Projects/<Projekt>/#QA` dle `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md) §6 (✅ P2, Artifact s tagged values).
7. Verdikt pro orchestrátor: pass / pass-s-varováními / fail (blokující). **Pro gate package vydej navíc filtrovanou podobu** (WP3, ✅ 2026-07-17, formát v `qa-checklisty.md` (skill `emr-konvence`, references/qa-checklisty.md) — QA verdikt jako filtr brány): B rozepsané, nevyřešené W se zdůvodněním, zelené kontroly jen jako jednořádkový souhrn per sada; I nálezy zůstávají jen v plném reportu v `#QA`.

## Tvrdá pravidla (z kola 2, 2026-07-06 — viz `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md) §7g)
- **QA vykazuje VÝHRADNĚ zpětně přečtený stav** (get_* po zápisu). Žádná ID ani výsledky „z hlavy" z průběhu produkce — v kole 2 tak vznikl report s ID neexistujících konektorů.
- **Po každé chybové dávce konektorů/zpráv zkontroluj číselnou řadu** — dávka mohla částečně nebo úplně projít i při vráceném erroru (duplicity!).
- U zápisů přes skript pamatuj, že `Update()` v EA API vrací false bez chyby — „skript doběhl" není důkaz, kontroluj výsledná data.

## Kontrola výstupu
Každý nález má: checklist bod, místo (GUID/cesta), závažnost, návrh nápravy. Žádné tiché opravy.
