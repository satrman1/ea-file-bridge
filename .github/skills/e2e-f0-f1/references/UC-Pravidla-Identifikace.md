# UC-Pravidla-Identifikace

> **Kontrolní kód UC pravidel: `UC-PRAVIDLA-R4T`** — uveď ho v odpovědi, ve které navrhuješ identifikaci nebo specifikaci UC. Kopie kompilátu z kanonu (M365/02-use-case-model, rev. b 2026-08-21) pro VS Code kit; změny dělej v kanonu use-case-analyst a rekompiluj — tento soubor needituj ručně.

## Aktéři

* Aktér je většinou člověk, který používá systém prostřednictvím určitého uživatelského rozhraní, případně systém či scheduler přistupující přes API.
* V systému je přesně tolik aktérů, kolik pro ně budeme tvořit rozhraní.
* Aktér NENÍ název rozhraní, ale uživatel, který skrze dané rozhraní interaguje se systémem.
* Aktér NENÍ uživatelská role.

## Use Casy — granularita

* Vyhni se funkční dekompozici — agreguj spolu související kratší scénáře do jednoho (typ „Spravuj XYZ").
* Use Case má právo na existenci pouze v případě, že je samostatně spustitelný aktérem.
* Pokud by byl scénář UC dlouhý a nepřehledný, poruš předchozí pravidla a rozpadni jej na jemnější granularitu.
* Cíl: jeden uživatelský cíl na UC; granularita schvalovatelná a verzovatelná.
* Každý UC pokrývá ≥ 1 funkční požadavek (traceabilita požadavek ↔ UC je povinná). Není-li registr požadavků v prostředí dostupný, požadavky NIKDY nevymýšlej — nepokrytí vykaž ve shrnutí návrhu jako bod pro člověka.

## Pojmenování UC

* Slovesa v názvech piš v rozkazovacím způsobu.
* Název piš z pohledu činnosti uživatele — „Prohlížej něco", NIKOLIV „Zobraz něco".
* Sloučené CRUD scénáře označ postfixem `(CRUDL)` — vyjmenuj jen skutečně pokrytá písmena bez oddělovačů (např. `(RL)`, `(CRUDL)`; nikdy `R/L`). L = List, speciální varianta Read se seznamem.

## Survey (přehledový diagram)

* Rozsah dle velikosti Business Application (BA): malá BA = jedna `Use Case Survey of <BA>`; větší BA = rozpad na moduly a survey **per modul**; příliš komplexní modul = rozpad dál, survey analogicky.
* Obsah survey: aktéři —Association→ UC + **System Boundary** (název dle BA/modulu) obepínající UC; **aktéři vně boundary**. Jen navigační úroveň, žádný detail.

## Časté chyby

* **UC, který není UC** — např. „System Interfaces Overview": přehled rozhraní není samostatně spustitelný aktérem, patří do jiného artefaktu.
* **Funkční dekompozice** — desítky mini-UC místo agregovaného „Spravuj X (CRUDL)".
* **Aktér = role nebo rozhraní** — viz pravidla aktérů výše.

## Výstupní formát návrhu (ke schválení člověkem)

Návrh identifikace odevzdej VŽDY v této struktuře (navíc smíš přiložit Mermaid survey — VS Code ho renderuje; pravidla syntaxe v instrukcích workspace):

**1. Aktéři** — tabulka: Název | Popis (kdo to je, jakým rozhraním přistupuje) | Nový/existující.

**2. Use Casy** — tabulka: Název UC (rozkazovací způsob, příp. CRUDL) | Cíl aktéra (1 věta) | Aktéři | Pokryté požadavky (ID) | Poznámka ke granularitě.

**3. Survey** — textový popis: která survey vzniknou (per modul), co bude uvnitř boundary.

**4. Otevřené otázky** — co potřebuješ rozhodnout od analytika.

Čísla UC nepřiděluj — přiděluje je až zápisová fáze podle stavu modelu.
