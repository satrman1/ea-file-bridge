## Pravidla pro Mermaid diagramy

- Každý výstupní diagram MUSÍ začínat deklarací typu (např. `flowchart LR`, `sequenceDiagram`, `classDiagram`, atd.) a správnou syntaxí diagramu.
- Identifikátory uzlů, tříd a stavů používej POUZE z `[A-Z, a-z, 0-9]` – nesmí obsahovat mezery, diakritiku ani speciální znaky (např. `/`, `(`, `)`, `č`, `í`, atd.). Pokud je potřeba víceslovný název, použij alias nebo textový popisek místo mezery v ID.
- Pokud je potřeba zobrazit popisek s mezerou, diakritikou nebo speciálním znakem, musí být tento popisek vždy uzavřen v uvozovkách, např. `Start["Začátek procesu"]`. Nikdy nepoužívej speciální znaky ani diakritiku v samotném identifikátoru uzlu, pouze v popisu. Vždy ověř, že všechny identifikátory jsou v souladu s tímto pravidlem, aby nedošlo k chybě Mermaid parseru.
- Jakýkoliv textový popisek obsahující mezeru nebo speciální znak MUSÍ být uzavřen v uvozovkách (nebo příslušných závorkách), aby parser bral celý text jako jeden celek.
- Uvnitř textových řetězců NESMÍ zůstat neescapované uvozovky (`"` místo `&quot;`) ani středníky a dvojtečky pro Mermaid významné (použij HTML entity).
- Nepoužívej slovo `end` jako název nebo popisek beze změny – pokud je potřeba ho uvést, napiš velkým písmenem nebo uzavři do uvozovek, jinak to rozbije syntaxi.
- VŽDY ukonči blokové struktury (`subgraph`, `alt/opt/loop` v sekvenci, složené stavy, atd.) odpovídajícím `end` blokem. Nesmí chybět žádné ukončení bloku.
- Při pojmenování účastníků v sekvenčních diagramech s mezerou použij formát `participant ID as "Jméno s mezerou"`. Obdobně postupuj u tříd nebo stavů, pokud by jejich název obsahoval mezeru (tam raději mezeru vůbec nepoužívej).
- V diagramu Gantt nedávej do názvu úkolu znak `:` ani `,`. Veškeré parametry úkolu piš ve formátu `Název : datumStart, datumKonec` nebo `Název : datumStart, délka`.
- V ER diagramu používej jednoslovné názvy entit. Atributy definuj bez zvláštních znaků a komentáře atributů dávej do uvozovek bez vnitřních uvozovek.
- Diagram `mindmap` generuj s konzistentním odsazením 4 mezery na úroveň. Každý poduzel MUSÍ být odsazen více než jeho rodič.
- Diagram `journey` generuj ve formátu `Popis : Skóre : Aktér1, Aktér2`. Skóre 1–5. Aktéry odděluj čárkou.
- Nepoužívej experimentální nebo málo podporované syntaxe (paralelní bloky, timeline diagram apod.), pokud to není výslovně požadováno.
- Generuj raději jednodušší a jednoznačný zápis, i za cenu mírné redundance, aby bylo méně prostoru pro chybu.
