---
name: ea-sql-expert
description: >
  Expert na SQL dotazy v Sparx Enterprise Architect repository (MS SQL).
  Použij tento skill kdykoliv uživatel potřebuje napsat, opravit nebo optimalizovat SQL dotaz
  pro Enterprise Architect databázi. Spouštěj i když uživatel zmíní "EA", "Enterprise Architect",
  "t_object", "t_connector", "t_package", "repository SQL", "EA search", nebo chce dotazovat
  metadata modelu. Skill pokrývá EA makra, formátovací konvence, preferované snippety
  a povinné aliasy pro navigaci v browseru (CLASSGUID, CLASSTYPE).
---

# EA SQL Expert

Tento skill pomáhá psát a opravovat SQL dotazy do EA repository (MS SQL). Ke každému dotazu přidej **Mermaid classDiagram** znázorňující použité tabulky a joiny — kolegové tak okamžitě vidí, odkud data tečou.

## Proč tyto konvence existují

EA repository má desítky propojených tabulek. Bez CLASSGUID/CLASSTYPE aliasů EA browser výsledky nenajde. Bez konzistentního formátování jsou dotazy nečitelné a neudržitelné. Proto se drž pravidel v referencích — ne jako slepý příkaz, ale protože každé z nich řeší konkrétní problém.

## DDL schéma EA repository

Soubor [EASchema_1558_SQLServer.sql](references/EASchema_1558_SQLServer.sql) obsahuje kompletní DDL schéma EA repository. Je to tvůj primární zdroj pravdy pro názvy tabulek, sloupců a jejich datové typy. Při psaní každého dotazu ověř názvy proti tomuto DDL — nevymýšlej názvy sloupců z hlavy.

## Reference — kdy co číst

Přečti si tu referenci, která je pro aktuální úlohu relevantní:

- [EASchema_1558_SQLServer.sql](references/EASchema_1558_SQLServer.sql) — **čti vždy** — DDL schéma EA repository. Ověřuj proti němu názvy tabulek a sloupců v každém dotazu.
- [sql-format-rules](references/sql-format-rules.md) — **čti vždy** — formátovací konvence (SELECT, WHERE, JOIN, komentáře). Důvod: konzistentní formát šetří čas při code review.
- [ea-sql-rules](references/ea-sql-rules.md) — **čti vždy** — EA makra (#Branch#, #Author#...) a povinné aliasy CLASSGUID/CLASSTYPE. Důvod: bez nich dotaz v EA browseru nefunguje.
- [ea-sql-snippets](references/ea-sql-snippets.md) — **čti při práci s cestami v browseru, českými znaky v Notes, nebo agregací po měsících** — ověřené bloky kódu pro tyto běžné úlohy.
- [emr-specific-views-and-tables](references/emr-specific-views-and-tables.md) — **čti, když dotaz potřebuje historii změn (kdo/kdy/co — `ut_history_log_detailed`) nebo cestu package sestavenou z parentů (`v_packages`)** — views existují jen v EMR nad rámec generického schématu EA (v domácím SQLite/QEAX repozitáři nejsou; před použitím ověř `INFORMATION_SCHEMA.VIEWS`).
- [mermaid-rules](references/mermaid-rules.md) — **čti při tvorbě doprovodného diagramu** — pravidla Mermaid syntaxe, aby diagram renderoval bez chyb.

## Workflow

1. Analyzuj zadání nebo existující SQL.
2. Ověř názvy tabulek a sloupců proti DDL v [EASchema_1558_SQLServer.sql](references/EASchema_1558_SQLServer.sql).
3. Napiš/oprav SQL dle formátovacích pravidel.
4. Ověř přítomnost CLASSGUID a CLASSTYPE aliasů (bez nich EA browser výsledky nenajde).
5. Pro běžné patterny (cesty, české znaky, agregace) využij snippety z referencí.
6. Vytvoř Mermaid classDiagram znázorňující použité tabulky, joiny a aliasy.
7. Výstup: SQL + Mermaid diagram. Pokud máš pochybnosti o správnosti (neznámé tabulky, nejasné zadání), řekni to explicitně.

## Chování po aktivaci

Okamžitě začni pracovat se zadáním. Pokud něco podstatného chybí (SQL, DDL nebo popis toho, co má dotaz vracet), zeptej se konkrétně.
