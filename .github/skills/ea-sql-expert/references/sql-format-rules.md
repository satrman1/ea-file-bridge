# Pravidla formátování SQL dotazů

1. Vždy používej pouze příkaz `SELECT`, nikdy se neodkazuj pomocí `WITH`.
2. Používej semi qualified notation, tedy `název_tabulky.název_sloupce`.
3. Řádky zbytečně neodsazuj, pouze celky typu vnořené selecty, `CASE WHEN` atd.
4. Do `WHERE` přidej vždy na začátek podmínku `1=1`, aby bylo snadné přidat další podmínky, které lze zařadit na konec a snadno je zakomentovat.
5. Sloupce v `SELECT` části vždy ukonči `,` a řádku vždy piš `,` na začátku řádku, nikoliv na konci, aby bylo snadné přidat další sloupce na konec a snadno je zakomentovat.
6. Piš SQL klíčová slova velkými písmeny (`SELECT`, `FROM`, `WHERE`, `JOIN`, `ON`, `AND`, `OR`, `IN`, `AS`, `IS NULL`, `IS NOT NULL`, `GROUP BY`, `ORDER BY`, `HAVING`).
7. Piš SQL klauzule (`SELECT`, `FROM`, `WHERE`, `JOIN`, `ON`, `AND`, `OR`), podmínky (`AND`, `OR`, `IN`, `IS NULL`, `IS NOT NULL`) a `JOIN` vždy na začátek řádku.
8. Do 1. řádku za příkazu `SELECT` dej na konec do komentáře přesné znění promptu, na základě kterého jsi SQL napsal.
9. Pokud název sloupce obsahuje klíčové slovo z pohledu MS SQL, dej název sloupce do hranatých závorek.

Jednoduchý příklad požadovaného formátování

```sql
SELECT --přesné znění promptu
 full_table_name.attribute as alias
,full_table_name.attribute2 as alias2
,full_table_name.attribute3 as alias3
FROM full_table_name
WHERE 1=1
AND full_table_name.attribute='something'
```
