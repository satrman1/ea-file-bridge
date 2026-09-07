---
name: emr-konvence
description: Sdílené konvence systémové analýzy nad EMR — pravidla zápisu do EA (větve, idempotence, pojmenování, typy MDG, konektory, stav artefaktu, bezpečný AI zápis), QA checklisty per fáze F0/F1/F3/F4/FINAL, HITL brány G0–G3 a gate package, pravidla SA disciplíny. Načti, když skládáš zápis do EMR, spouštíš QA, připravuješ bránu nebo píšeš SAR podklad.
---

# emr-konvence — rozcestník nad sdílenými pravidly

Tento skill nic nového nedefinuje — říká, **kterou referenci kdy číst**. Reference jsou kopie sdílených pravidel kanonu; needituj je zde (lekce jdou do kanonu, odtud se buildí znovu).

| Situace | Čti | Sekce |
|---|---|---|
| Skládám zápisovou dávku do EMR (kam, jak pojmenovat, jaký typ, jaký konektor) | [pravidla zápisu do EMR](references/emr-zapis-pravidla.md) | §1 větve · §2 idempotence · §3 pojmenování · §4 typy MDG · §5 konektory · §6 stav artefaktu, Gate Records, pracovní prostor · §8 po zápisu |
| Scénáře, constrainty, lokální BRU, přesun, tagged values na package — co jde dávkou a jak | [pravidla zápisu do EMR](references/emr-zapis-pravidla.md) | §7 (+ §7c–§7h ověřené vzory a nálezy) |
| Katalog atributů, doménové typy, Kafka | [pravidla zápisu do EMR](references/emr-zapis-pravidla.md) | §9, §10 |
| Audit, autorství, bezpečné mazání, bezpečný AI zápis (razítka, mikro-baselines, journal, objem, UNDO) | [pravidla zápisu do EMR](references/emr-zapis-pravidla.md) | §11, §12 |
| Reference na kód (`code-*`, `re-origin`) | [pravidla zápisu do EMR](references/emr-zapis-pravidla.md) | §13 |
| Spouštím QA (`emr-qa`) — jaké kontroly, závažnosti, formát reportu, verdikt jako filtr brány | [QA checklisty](references/qa-checklisty.md) | sada dle fáze |
| SQL kontroly verzování (F4) | [qc-verzovani.sql](references/qc-verzovani.sql) | — |
| Připravuji bránu G0–G3, gate package, tier review, confidence flags, kategorie vrácení | [HITL brány](references/hitl-brany.md) | celé |
| Píšu SAR podklad (SA-G0..G3), architektura IDesign, QA checklist SA | [pravidla SA disciplíny](references/sar-pravidla.md) | celé |
| Reverse engineering rozhraní z kódu (IR YAML) | [IR formát](references/ir-format.md) | celé |
| Dělba rolí analytik × vykonavatel (historický protokol dvou agentů — platí jen tabulka „Dělba rolí") | [bridge protokol](references/emr-bridge-protokol.md) | jen Dělba rolí |

Pravidla načítej **po sekcích**, ne celý soubor — `emr-zapis-pravidla.md` je velký. Destilát obecné části (§1–§6, §8, §11, §12) se ti navíc aktivuje automaticky jako instrukce, když pracuješ se soubory `requests/**/*.json`.
