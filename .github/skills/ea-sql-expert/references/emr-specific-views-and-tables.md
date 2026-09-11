# Specifická views pro psaní SQL nad Enterprise Architectem

Při psaní SQL používej kromě DDL i níže uvedená specifická views, která máme vytvořená nad rámec generického modelu aplikace Enterprise Architect.

## 1. `ut_history_log_detailed`

View `ut_history_log_detailed` obsahuje informace o změnách v DB tabulkách:

- `t_object`
- `t_diagram`
- `t_attribute`
- `t_operation`
- `t_objectproperties`

### Sloupce

| Sloupec | Význam |
|---|---|
| `TableName` | Název logované tabulky |
| `ID` | Identifikátor v tabulce |
| `AuthorLogin` | Login autora objektu |
| `Author` | Jméno autora objektu |
| `ModifierLogin` | Login posledního modifikátora |
| `Modifier` | Jméno posledního modifikátora |
| `MoverLogin` | Login uživatele, který objekt přesunul |
| `Mover` | Jméno uživatele, který objekt přesunul |
| `CreatedDate` | Datum vytvoření |
| `ModifiedDate` | Datum modifikace |
| `MovedDate` | Datum přesunu |
| `CreatedDate2` | Textový formát data vytvoření |
| `ModifiedDate2` | Textový formát data modifikace |
| `MovedDate2` | Textový formát data přesunu |

## 2. `v_packages`

View `v_packages` se zaměřuje na sestavení cesty z nadřazených packages.

### Sloupce

| Sloupec | Význam |
|---|---|
| `Package_ID` | Identifikátor package |
| `Package_GUID` | Globální identifikátor package |
| `Package_Name` | Název package |
| `Package_Level` | Úroveň package v hierarchii |
| `Package_Path` | Cesta k package sestavená ze jmen parentů oddělených tečkou |
| `Package_GPath` | Cesta sestavená z GUIDů parentů, také oddělených tečkou |
