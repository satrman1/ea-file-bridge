---
name: structural-modeller
description: >
  Expert na třídové a datové modelování — návrh analytických třídových modelů
  i logických datových modelů v 3NF, vše jako Mermaid classDiagram.
  Použij tento skill kdykoliv uživatel chce navrhnout třídový model, datový model,
  ER diagram, doménový model, nebo potřebuje vymodelovat entity, atributy, relace
  a operace z business zadání. Spouštěj i při zmínce "class diagram", "třídový diagram",
  "datový model", "3NF", "normalizace", "entity", "doménové typy", "enumerátor",
  "logický model", "analytický model", nebo když uživatel přiloží business zadání
  a chce z něj odvodit strukturu dat.
---

# Structural Modeller

Tento skill pokrývá dva režimy strukturálního modelování:

1. **Třídový model** — analytický třídový diagram s entitami, atributy, operacemi a relacemi
2. **Datový model** — logický datový model v 3. normální formě s doménovými typy a enumerátory

Oba režimy produkují Mermaid classDiagram a sdílejí jmenné konvence pro atributy. Třídový model navíc zahrnuje operace a zaměřuje se na business logiku, datový model na normalizaci a datovou integritu.

## Jak poznat, co uživatel chce

- "třídový model", "class diagram", "operace", "metody" → **Třídový model**
- "datový model", "3NF", "normalizace", "doménové typy", "ER" → **Datový model**
- Pokud je to nejasné, navrhni vhodnější režim na základě zadání, nebo se zeptej

---

## Režim 1: Třídový model

### Postup

1. Identifikuj business entity (třídy), jejich atributy a operace.
2. Pojmenuj atributy dle [attribute-naming-conventions](references/attribute-naming-conventions.md).
3. Pojmenuj operace dle [operation-name-rules](references/operation-name-rules.md).
4. Urči relace (asociace, kompozice, dědičnost, závislost) včetně multiplicit.
5. Sestroj Mermaid classDiagram.

### Pravidla

- Třídy v angličtině, PascalCase.
- Stereotypy dle charakteru třídy (`<<Entity>>`, `<<ValueObject>>`, `<<Enumeration>>`).
- Atributy řaď: klíče/identifikátory → analytické → popisné → číselné. Důvod: čtenář vidí nejdůležitější atributy první.
- Každý atribut má popis v češtině vysvětlující business význam.
- Relace s multiplicitou (např. `"1" --> "0..*"`).

### Výstup

- Seznam tříd s krátkým popisem
- Mermaid classDiagram s třídami, atributy, operacemi a relacemi

---

## Režim 2: Datový model

### Postup

1. Identifikuj business entity a jejich atributy.
2. Normalizuj do 3NF — odstraň tranzitivní závislosti, každý neklíčový atribut závisí pouze na primárním klíči.
3. Pojmenuj atributy dle [attribute-naming-conventions](references/attribute-naming-conventions.md).
4. Přiřaď doménové typy z [domain-types](references/domain-types.md) (prefix `dt`).
5. Identifikuj enumerátory → stereotyp `<<Enumeration>>`.
6. Urči relace včetně multiplicit a pojmenování.
7. Sestroj Mermaid classDiagram.

### Pravidla

- Entity v angličtině, PascalCase.
- Stereotypy: `<<Entity>>` pro entity, `<<Enumeration>>` pro enumerátory.
- Atributy řaď: klíče/identifikátory → analytické → popisné → číselné.
- Každý atribut má doménový typ z katalogu a popis v češtině.
- Klíčové atributy `+` (public), cizí klíče `<<FK>>` v popisu.
- Relace s multiplicitou a pojmenováním (např. `"1" --> "0..*" : "obsahuje"`).

### Výstup

- Seznam entit s krátkým popisem
- Mermaid classDiagram s entitami, atributy (včetně doménových typů), relacemi a enumerátory

---

## Reference — kdy co číst

Nečti všechno dopředu — přečti jen to, co aktuální režim vyžaduje:

- [attribute-naming-conventions](references/attribute-naming-conventions.md) — **oba režimy** — jmenné konvence pro atributy (PascalCase, kvalifikátory, pořadí slov)
- [domain-types](references/domain-types.md) — **jen datový model** — katalog doménových typů (dtAmount, dtFlag, dtIdentifier...)
- [operation-name-rules](references/operation-name-rules.md) — **jen třídový model** — CRUD konvence pro operace (Create/Get/Modify/Delete...)
- [mermaid-rules](references/mermaid-rules.md) — **oba režimy, pokud si nejsi jistý syntaxí** — pravidla pro validní Mermaid kód

## Jazyk

Popisy v češtině, identifikátory v angličtině.

## Chování po aktivaci

Okamžitě začni pracovat se zadáním. Ze zadání odvoď režim. Pokud to z kontextu nejde poznat, navrhni vhodný režim nebo se zeptej.
