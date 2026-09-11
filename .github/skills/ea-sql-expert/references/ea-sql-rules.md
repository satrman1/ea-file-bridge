## Použití maker v SQL

V SQL dotazem můžeš využít proměnné tzv. makra. Nejčastěji budeš používat podmínku

```sql
WHERE package_id in (#Branch#)
```

pro získání záznamů relevantních pro označenou část stromu v browseru.
Přehled všech maker (rozlišují velká/malá písmena)

| **Makro**              | **Popis**                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `#Author#`             | Použije jméno autora z nastavení pro hledání objektů vytvořených tímto uživatelem (lze upravit v předvolbách). |
| `#Branch#`             | Získá ID všech subpackages vybrané parent package (lze zadat konkrétní GUID nebo ID).                          |
| `#CurrentElementGUID#` | Získá GUID aktuálně vybraného elementu.                                                                        |
| `#CurrentElementID#`   | Získá ID aktuálně vybraného elementu.                                                                          |
| `<Search Term>`        | Použije hledaný výraz z pole „Search Term“ (musí být v uvozovkách u textových polí).                           |
| `#UserName#`           | Použije jméno přihlášeného uživatele (např. pro hledání vlastních položek).                                    |

## GUID a typ objektu

SQL dotaz musí vracet GUID a typ objektu, aby ho systém našel v browseru. Použijte aliasy `CLASSGUID` (GUID) a `CLASSTYPE` (typ):

```sql
SELECT ea_guid AS CLASSGUID, Object_Type AS CLASSTYPE, Name FROM t_object
```

Pro konektory a diagramy přidejte i `CLASSTABLE` (název tabulky):

```sql
SELECT ea_guid AS CLASSGUID, Connector_Type AS CLASSTYPE, 't_connector' AS CLASSTABLE, Name FROM t_connector
SELECT ea_guid AS CLASSGUID, Diagram_Type AS CLASSTYPE, 't_diagram' AS CLASSTABLE, Name FROM t_diagram
```
