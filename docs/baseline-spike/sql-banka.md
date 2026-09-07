# SQL varianty pro banku (MS SQL 2022) — T6-W4 a T6-C

**Pouští se až v bance**, čtecí dávkou `query` (nebo v SSMS, je-li k dispozici). Doma (SQLite, `EAExample.qea`) běží varianty v `req-20260907-S01/S02/S11/S17.json`. Pravidlo PROTOKOL §10: **nejdřív schéma, teprve pak dotaz** — neznámý sloupec v EA nevyhodí chybu, ale otevře modál a pak hrozí falešná nula.

## B1 — schéma `t_document` (nikdy hádaný sloupec) — odpovídá S01

```sql
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 't_document'
ORDER BY ORDINAL_POSITION;
```

**Co odečíst:** `CHARACTER_MAXIMUM_LENGTH` u sloupců `DocName` a `Version` = **skutečný délkový limit pole `version` baseline v bance** (T6-S). Doma to SQLite nevynucuje (DDL v `sqlite_master` limit jen deklaruje), takže domácí test 255/300 znaků říká jen, zda ořezává samo EA API; bankovní limit je tenhle sloupec. Formát jména `FB-AUTO <login> <session> <RRRR-MM-DD hh:mm:ss>` (~46 znaků) musí být pod ním s rezervou.

## B2 — enumerace baselines jedním SELECT — odpovídá S02

Nejdřív rozložení hodnot `DocType` (literál `'Baseline'` je předpoklad, ověřit):

```sql
SELECT DocType, COUNT(*) AS n FROM t_document GROUP BY DocType ORDER BY n DESC;
```

Pak dvojice (package GUID, version) — bez blobů (`BinContent`, `StrContent` nikdy nevybírat, jsou to zazipované XMI baseline):

```sql
SELECT p.Package_ID, p.Name AS PackageName, p.ea_guid AS PackageGUID,
       d.DocID AS BaselineGUID, d.DocName, d.Version, d.DocDate,
       LEN(d.DocName) AS lenDocName, LEN(d.Version) AS lenVersion
FROM t_document d
JOIN t_package p ON p.ea_guid = d.ElementID
WHERE d.DocType = 'Baseline'
ORDER BY p.Name, d.DocDate;
```

Osiřelé baselines (package už neexistuje) — kandidát na nález pro §6.3 úklidu:

```sql
SELECT d.DocID, d.ElementID, d.DocName, d.Version, d.DocDate
FROM t_document d
WHERE d.DocType = 'Baseline'
  AND d.ElementID NOT IN (SELECT ea_guid FROM t_package);
```

Počet baselines per package (kde roste řada — §1 zadání):

```sql
SELECT d.ElementID, COUNT(*) AS n
FROM t_document d WHERE d.DocType = 'Baseline'
GROUP BY d.ElementID ORDER BY n DESC;
```

## B3 — velikost baselines v DB (T6-C, přírůstek) — odpovídá S17

```sql
SELECT d.DocID, p.Name AS PackageName, d.Version, d.DocDate,
       DATALENGTH(d.BinContent) / 1048576.0 AS mb
FROM t_document d
JOIN t_package p ON p.ea_guid = d.ElementID
WHERE d.DocType = 'Baseline'
ORDER BY d.DocDate DESC;

SELECT COUNT(*) AS n, SUM(CAST(DATALENGTH(BinContent) AS bigint)) / 1048576.0 AS mb_total
FROM t_document WHERE DocType = 'Baseline';
```

Doma je ekvivalent `LENGTH(BinContent)` (SQLite vrací u blobu bajty). Tohle je přesnější než velikost souboru `.qea` — soubor SQLite se po mazání nezmenšuje a znovu využívá volné stránky.

## B4 — velikost podstromu package (T6-C kandidáti) — odpovídá S11

**Rekurzivní CTE je v bance NEOVĚŘENÉ** (§4.3 zadání: žádný `WITH` se dnes v executoru nepoužívá). Pouštět jako jednorázové čtení v SSMS, nebo čtecí dávkou s vědomím, že selhání může skončit modálem. Dialekt: MS SQL `WITH` (bez `RECURSIVE`), `TOP` místo `LIMIT`:

```sql
WITH sub(root_id, pkg_id) AS (
    SELECT Package_ID, Package_ID FROM t_package
    UNION ALL
    SELECT s.root_id, p.Package_ID FROM t_package p JOIN sub s ON p.Parent_ID = s.pkg_id
)
SELECT TOP 40 r.Package_ID, r.Name, r.ea_guid,
       COUNT(DISTINCT s.pkg_id) AS packages, COUNT(o.Object_ID) AS elements
FROM t_package r
JOIN sub s ON s.root_id = r.Package_ID
LEFT JOIN t_object o ON o.Package_ID = s.pkg_id AND o.Object_Type <> 'Package'
GROUP BY r.Package_ID, r.Name, r.ea_guid
ORDER BY elements DESC
OPTION (MAXRECURSION 100);
```

Bez CTE (primár dle §4.3 — iterativní expanze po úrovních, tvary odzkoušené ve `FB_OpClonePackage`): pro jeden kořen `<ID>` opakovat `SELECT Package_ID FROM t_package WHERE Parent_ID IN (<ids úrovně>)`, dokud přibývají řádky, a pak `SELECT COUNT(*) FROM t_object WHERE Package_ID IN (<všechny ids>) AND Object_Type <> 'Package'`.

V bance se kalibrace T6-C dělá **nad existujícími packages** (žádné `FBT-CAL` klonování — `create_baseline` i `clone_package` by mimo whitelistovanou větev skončily `E_WHITELIST`), takže B4 slouží k výběru kandidátů ~100 / ~1 000 / ~5 000 / ~20 000 prvků a baseline se nad nimi dělá ručně v Baseline manageru se stopkami.
