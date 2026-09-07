---
name: prevzeti-zadani
description: F0 — převzetí business zadání a vymezení řešení. Projde všechny požadavky (funkční, nefunkční, přechodové) a architektonické mantinely, zjistí existující kontext v EMR, určí hranici řešení, zaregistruje požadavky do Projects a připraví traceabilitu. Absorboval pozadavky-traceabilita-priprava.
license: Complete terms in LICENSE.txt
---

# prevzeti-zadani

> Konvence: `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md). Vzor požadavku: DEMO (Requirement `DEMO-27698 Zobrazení potvrzení o transakci`, notes s JIRA odkazem — viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §10). Formát vstupu ✅ F1, mantinely ✅ F2, traceabilita ✅ F3 (2026-07-06, MLA).

## Zařazení
- **Typ:** Produkční · **Role:** Systémový analytik · **Fáze:** F0 · **Brána:** G0

## Vstupy
- **Primárně JIRA:** issue type Requirement, pole dle `JIRA pole - Requirement.md` (mimo workspace — vyžádej od uživatele). Scope pro funkční analýzu: `Requirement Types BABOKv3 = FR` a `ICT impact = Yes` (JQL, případně pole ITAN). Strojově čitelný vstup, existuje-li brq běh: `requirements.json` / `report.csv` (viz `BRQ AI - Implementace.md` (mimo workspace — vyžádej od uživatele) M2/M9).
- **Zadání zvládni v různých formách (✅ F1):** granulární BRQ z JIRA (výhledově načítané přímo/automaticky do EMR jako Requirement elementy), NEBO business zadání jako **BRD dokument** — u dokumentu si požadavky nejdřív vyextrahuj a strukturuj, pak teprve registruj.
- **Architektonické mantinely (✅ F2):** jsou vždy dané **Dynamickým pohledem napojeného Core Use Case**. SOS (Solution Architecture) žije v projektové složce `/Projects/<Projekt>/Solution Architecture (SOS)` vč. Core Use Cases a jejich Dynamic View — na vstupu si vyžádej **odkaz na SOS**; výběr/napojení Core UC je human krok doporučený AI (✅ D6).

## Kroky
1. Přečti VŠECHNY požadavky, ne jen funkční — sám urči, co dopadá do funkční analýzy, co do logického designu a co je mimo hranici (NFR, přechodové → poznamenej kam patří; routing dle BRQ klasifikace 8.1 je advisory — sekce reportu „mimo scope" a `classification_mismatch` projdi zvlášť). Prošel-li požadavek BRQ bránou s verdiktem RETURN, neregistruj ho a vrať BAN (v pilotu brány jen warning); bez BRQ brány použij rubriku (`BRQ Management.md` (mimo workspace — vyžádej od uživatele) §4) jako triage checklist.
2. Prohledej existující kontext v EMR (`find_packages_by_name`, `find_elements_by_name`): existuje BA, moduly, příbuzné UC, služby, rozhraní? Modelování bez kontextu je anti-pattern.
3. Urči hranici řešení: co se modeluje nově, co se mění (→ verzování), co se přepoužívá. Pozor na příliš hrubou/jemnou granularitu budoucích UC.
4. Zaregistruj požadavky do `/Projects/<Projekt>/Business Requirements`: Requirement elementy `<JIRA-ID> Název`, notes = Description + Acceptance criteria + Weight + odkaz do zdroje (AK jsou vstup pro scénáře F1 a test analytika — nepřenést je = ztráta).
5. Připrav traceabilitu: seznam požadavek → očekávané UC (vazby založí `use-case-model`). ✅ F3: **stačí konektory** — matici lze generovat z EA (Relationship Matrix) ad hoc; pokrytí každého funkčního solution BRQ ≥1 UC ověřuje QA (kontrola 2) + CRUD cross-check business objektů (kontrola 2b).
6. Výstup pro G0: hranice řešení, mapa kontextu EMR, registrované požadavky, návrh struktury pro `emr-scaffold` (režim A).

## Kontrola výstupu
Hranice jednoznačná; žádný požadavek nezůstal nezařazený; existující artefakty EMR zohledněny. K dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4, ✅ 2026-07-17). Pak `emr-qa` (sada F0) → G0 dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md).

## EA MCP
`find_packages_by_name, find_elements_by_name, get_elements_information, create_or_update_elements`
