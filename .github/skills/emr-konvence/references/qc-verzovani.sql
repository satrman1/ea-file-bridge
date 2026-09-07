/* ============================================================================
   qc-verzovani.sql — QC kontroly verzovacího mechanismu EMR (MS SQL repository)
   ----------------------------------------------------------------------------
   Datum:  2026-08-16
   Účel:   dvě QC kontroly dle kritiky Verzovani-Kritika-a-Redesign.md (mimo workspace)
           (v1.3, § 6.1 krok 1 — „hned, bez rozhodnutí"):
           (A) „vazby do archivu"  — kritika 2.3 (GUID kontinuita je asymetrická;
               externí vazby po úklidu tiše ukazují do archivu)
           (B) „HOTFIX guard"      — kritika 2.6 (oprava do obou stavů není hlídána)
   Vazba:  Skilly/verzovani-release/SKILL.md krok 9 (úklid po release / podklad G3)

   ⚠ PRVNÍ BĚH NAD STARÝM OBSAHEM = HISTORICKÝ DLUH JAKO REPORT.
     Neopravovat plošně — řeší se dle kap. 5 kritiky (convert-on-touch):
     jednorázově rozhodnout, co se přepojí (jen aktivně používané artefakty)
     a co se jen označí „known". Trace u starých release se zpětně nedoplňují.

   Konvence: každý SELECT je samostatně spustitelný (lze vložit i do EA Search —
   povinné aliasy CLASSGUID/CLASSTYPE/CLASSTABLE jsou přítomny). Formát dle
   Skilly/ea-sql-expert (sql-format-rules.md, ea-sql-rules.md); názvy sloupců
   ověřeny proti references/EASchema_1558_SQLServer.sql.
   Archivní vzory: #ARCHIVE, #ARCHIV*, _hist*, BEFORE_ARELYYMM* (+ #BEFORE_ARELYYMM*
   dle rozhodnutí § 6.2c — # prefix disciplína). Hloubka zanoření archivu je
   kryta do 4 úrovní předků (bez WITH/rekurze dle formátovacích pravidel).
   ============================================================================ */


/* ----------------------------------------------------------------------------
   KONTROLA A1 — „vazby do archivu": Usage/Dependency konektory
   ----------------------------------------------------------------------------
   Co nález znamená: živý element (mimo archiv) má Usage/Dependency vazbu na
   element, který leží v archivní package (vzory výše, i zanořeně), nebo
   v package, vedle níž už existuje živý _AREL sourozenec (= vzniká/vznikla
   novější verze a vazba zůstala na staré). Konzument si přes dopadovku dohledá
   starou verzi přesně té služby, která se změnila (kritika 2.3).
   Co s ním: kandidát na řízené přepojení na platnou verzi (dohledat přes trace,
   je-li založen); u historického dluhu rozhodnout přepojit vs. označit „known"
   (kap. 5). Nález NEmazat bez analýzy — vazba je nositelem dopadu.

   Mermaid (použité tabulky a joiny):
   classDiagram
     class t_connector { ea_guid; Connector_Type; Start_Object_ID; End_Object_ID }
     class t_object_src { Object_ID; Name; Package_ID }
     class t_object_tgt { Object_ID; Name; Package_ID }
     class t_package { Package_ID; Parent_ID; Name }
     t_connector --> t_object_src : Start_Object_ID
     t_connector --> t_object_tgt : End_Object_ID
     t_object_src --> t_package : Package_ID (ArchivZdroj — vyloučení)
     t_object_tgt --> t_package : Package_ID (ArchivCil / StaraVerze)
     t_package --> t_package : Parent_ID (předci do 4 úrovní; sourozenec _AREL)
   ---------------------------------------------------------------------------- */
SELECT --„vazby do archivu" — 505-1 Operation Link a Usage vazby ukazující na elementy v archivních packages (vzory #ARCHIVE, #ARCHIV*, _hist*, BEFORE_ARELYYMM*) nebo do package, která má živého _AREL sourozence — část konektory
 t_connector.ea_guid AS CLASSGUID
,t_connector.Connector_Type AS CLASSTYPE
,'t_connector' AS CLASSTABLE
,t_connector.Name AS VazbaNazev
,src.Name AS ZdrojElement
,sp0.Name AS ZdrojPackage
,tgt.Name AS CilElement
,tp0.Name AS CilPackage
,CASE WHEN ArchivCil.Package_ID IS NOT NULL THEN 'cíl v archivní package' ELSE 'cíl v package se živým _AREL sourozencem' END AS Duvod
FROM t_connector
JOIN t_object src ON t_connector.Start_Object_ID = src.Object_ID
JOIN t_package sp0 ON src.Package_ID = sp0.Package_ID
JOIN t_object tgt ON t_connector.End_Object_ID = tgt.Object_ID
JOIN t_package tp0 ON tgt.Package_ID = tp0.Package_ID
LEFT JOIN
(
SELECT ap0.Package_ID
FROM t_package ap0
LEFT JOIN t_package ap1 ON ap0.Parent_ID = ap1.Package_ID
LEFT JOIN t_package ap2 ON ap1.Parent_ID = ap2.Package_ID
LEFT JOIN t_package ap3 ON ap2.Parent_ID = ap3.Package_ID
LEFT JOIN t_package ap4 ON ap3.Parent_ID = ap4.Package_ID
WHERE 1=1
AND (ap0.Name LIKE '#ARCHIV%' OR ap0.Name LIKE '[_]hist%' OR ap0.Name LIKE 'BEFORE[_]AREL%' OR ap0.Name LIKE '#BEFORE[_]AREL%'
OR ap1.Name LIKE '#ARCHIV%' OR ap1.Name LIKE '[_]hist%' OR ap1.Name LIKE 'BEFORE[_]AREL%' OR ap1.Name LIKE '#BEFORE[_]AREL%'
OR ap2.Name LIKE '#ARCHIV%' OR ap2.Name LIKE '[_]hist%' OR ap2.Name LIKE 'BEFORE[_]AREL%' OR ap2.Name LIKE '#BEFORE[_]AREL%'
OR ap3.Name LIKE '#ARCHIV%' OR ap3.Name LIKE '[_]hist%' OR ap3.Name LIKE 'BEFORE[_]AREL%' OR ap3.Name LIKE '#BEFORE[_]AREL%'
OR ap4.Name LIKE '#ARCHIV%' OR ap4.Name LIKE '[_]hist%' OR ap4.Name LIKE 'BEFORE[_]AREL%' OR ap4.Name LIKE '#BEFORE[_]AREL%')
) ArchivCil ON tgt.Package_ID = ArchivCil.Package_ID
LEFT JOIN
(
SELECT DISTINCT bp.Package_ID
FROM t_package bp
JOIN t_package sib ON sib.Parent_ID = bp.Parent_ID
AND sib.Package_ID <> bp.Package_ID
AND sib.Name LIKE bp.Name + '%AREL%' --formát postfixu ARELYYMM zatím nepotvrzen doslovně (SKILL.md krok 3) → záměrně volný vzor
WHERE 1=1
AND bp.Name NOT LIKE '%AREL%'
AND sib.Name NOT LIKE '#%' --sourozenec musí být živý, ne archivní
) StaraVerze ON tgt.Package_ID = StaraVerze.Package_ID
LEFT JOIN
(
SELECT zp0.Package_ID
FROM t_package zp0
LEFT JOIN t_package zp1 ON zp0.Parent_ID = zp1.Package_ID
LEFT JOIN t_package zp2 ON zp1.Parent_ID = zp2.Package_ID
LEFT JOIN t_package zp3 ON zp2.Parent_ID = zp3.Package_ID
LEFT JOIN t_package zp4 ON zp3.Parent_ID = zp4.Package_ID
WHERE 1=1
AND (zp0.Name LIKE '#ARCHIV%' OR zp0.Name LIKE '[_]hist%' OR zp0.Name LIKE 'BEFORE[_]AREL%' OR zp0.Name LIKE '#BEFORE[_]AREL%'
OR zp1.Name LIKE '#ARCHIV%' OR zp1.Name LIKE '[_]hist%' OR zp1.Name LIKE 'BEFORE[_]AREL%' OR zp1.Name LIKE '#BEFORE[_]AREL%'
OR zp2.Name LIKE '#ARCHIV%' OR zp2.Name LIKE '[_]hist%' OR zp2.Name LIKE 'BEFORE[_]AREL%' OR zp2.Name LIKE '#BEFORE[_]AREL%'
OR zp3.Name LIKE '#ARCHIV%' OR zp3.Name LIKE '[_]hist%' OR zp3.Name LIKE 'BEFORE[_]AREL%' OR zp3.Name LIKE '#BEFORE[_]AREL%'
OR zp4.Name LIKE '#ARCHIV%' OR zp4.Name LIKE '[_]hist%' OR zp4.Name LIKE 'BEFORE[_]AREL%' OR zp4.Name LIKE '#BEFORE[_]AREL%')
) ArchivZdroj ON src.Package_ID = ArchivZdroj.Package_ID
WHERE 1=1
AND t_connector.Connector_Type IN ('Usage','Dependency') --dle potřeby rozšířit (např. 'Realisation')
AND (ArchivCil.Package_ID IS NOT NULL OR StaraVerze.Package_ID IS NOT NULL)
AND ArchivZdroj.Package_ID IS NULL --vazby archiv→archiv jsou v pořádku, nereportovat
--AND t_connector.Start_Object_ID IN (SELECT t_object.Object_ID FROM t_object WHERE t_object.Package_ID IN (#Branch#)) --volitelné zúžení na větev v EA browseru


/* ----------------------------------------------------------------------------
   KONTROLA A2 — „vazby do archivu": tagged value 505-1 Operation Link
   ----------------------------------------------------------------------------
   Co nález znamená: SR má vyplněnou TV „505-1 Operation Link" (odkaz na operaci
   v Catalogues.Přehled komponent — EA-Repozitar-Kontext.md), ale odkazovaná
   operace (resp. její vlastnická komponenta) leží v archivní package, nebo
   v package s živým _AREL sourozencem. SR tedy realizuje operaci staré verze
   katalogu — přesně díra z kritiky 2.3 („konzument dostane starou verzi právě
   té služby, která se změnila").
   Co s ním: přepojit TV na platnou verzi operace (řízený krok s reportem);
   u historického dluhu dle kap. 5 — přepojit jen aktivně používané, zbytek
   označit „known". Nerozpadlé odkazy (GUID bez protějšku) tato kontrola
   neřeší — to je orphan QC v emr-qa.

   Mermaid (použité tabulky a joiny):
   classDiagram
     class t_objectproperties { Object_ID; Property; Value }
     class t_object_SR { Object_ID; ea_guid; Name; Package_ID }
     class t_operation { OperationID; ea_guid; Object_ID; Name }
     class t_object_vlastnik { Object_ID; Name; Package_ID }
     class t_package { Package_ID; Parent_ID; Name }
     t_objectproperties --> t_object_SR : Object_ID
     t_objectproperties --> t_operation : Value = ea_guid
     t_operation --> t_object_vlastnik : Object_ID
     t_object_vlastnik --> t_package : Package_ID (ArchivCil / StaraVerze)
     t_package --> t_package : Parent_ID (předci do 4 úrovní; sourozenec _AREL)
   ---------------------------------------------------------------------------- */
SELECT --„vazby do archivu" — 505-1 Operation Link a Usage vazby ukazující na elementy v archivních packages (vzory #ARCHIVE, #ARCHIV*, _hist*, BEFORE_ARELYYMM*) nebo do package, která má živého _AREL sourozence — část tagged value 505-1
 t_object.ea_guid AS CLASSGUID
,t_object.Object_Type AS CLASSTYPE
,t_object.Name AS ZdrojSR
,sp0.Name AS ZdrojPackage
,t_objectproperties.Value AS OdkazGuid
,isnull(t_operation.Name, cilel.Name) AS CilOperaceNazev
,vlastnik.Name AS CilKomponenta
,cp0.Name AS CilPackage
,CASE WHEN ArchivCil.Package_ID IS NOT NULL THEN 'cíl v archivní package' ELSE 'cíl v package se živým _AREL sourozencem' END AS Duvod
FROM t_objectproperties
JOIN t_object ON t_objectproperties.Object_ID = t_object.Object_ID
JOIN t_package sp0 ON t_object.Package_ID = sp0.Package_ID
LEFT JOIN t_operation ON t_objectproperties.Value = t_operation.ea_guid
LEFT JOIN t_object vlastnik ON t_operation.Object_ID = vlastnik.Object_ID
LEFT JOIN t_object cilel ON t_objectproperties.Value = cilel.ea_guid --fallback: TV výjimečně odkazuje element, ne operaci
LEFT JOIN t_package cp0 ON isnull(vlastnik.Package_ID, cilel.Package_ID) = cp0.Package_ID
LEFT JOIN
(
SELECT ap0.Package_ID
FROM t_package ap0
LEFT JOIN t_package ap1 ON ap0.Parent_ID = ap1.Package_ID
LEFT JOIN t_package ap2 ON ap1.Parent_ID = ap2.Package_ID
LEFT JOIN t_package ap3 ON ap2.Parent_ID = ap3.Package_ID
LEFT JOIN t_package ap4 ON ap3.Parent_ID = ap4.Package_ID
WHERE 1=1
AND (ap0.Name LIKE '#ARCHIV%' OR ap0.Name LIKE '[_]hist%' OR ap0.Name LIKE 'BEFORE[_]AREL%' OR ap0.Name LIKE '#BEFORE[_]AREL%'
OR ap1.Name LIKE '#ARCHIV%' OR ap1.Name LIKE '[_]hist%' OR ap1.Name LIKE 'BEFORE[_]AREL%' OR ap1.Name LIKE '#BEFORE[_]AREL%'
OR ap2.Name LIKE '#ARCHIV%' OR ap2.Name LIKE '[_]hist%' OR ap2.Name LIKE 'BEFORE[_]AREL%' OR ap2.Name LIKE '#BEFORE[_]AREL%'
OR ap3.Name LIKE '#ARCHIV%' OR ap3.Name LIKE '[_]hist%' OR ap3.Name LIKE 'BEFORE[_]AREL%' OR ap3.Name LIKE '#BEFORE[_]AREL%'
OR ap4.Name LIKE '#ARCHIV%' OR ap4.Name LIKE '[_]hist%' OR ap4.Name LIKE 'BEFORE[_]AREL%' OR ap4.Name LIKE '#BEFORE[_]AREL%')
) ArchivCil ON cp0.Package_ID = ArchivCil.Package_ID
LEFT JOIN
(
SELECT DISTINCT bp.Package_ID
FROM t_package bp
JOIN t_package sib ON sib.Parent_ID = bp.Parent_ID
AND sib.Package_ID <> bp.Package_ID
AND sib.Name LIKE bp.Name + '%AREL%' --formát postfixu ARELYYMM zatím nepotvrzen doslovně (SKILL.md krok 3) → záměrně volný vzor
WHERE 1=1
AND bp.Name NOT LIKE '%AREL%'
AND sib.Name NOT LIKE '#%' --sourozenec musí být živý, ne archivní
) StaraVerze ON cp0.Package_ID = StaraVerze.Package_ID
LEFT JOIN
(
SELECT zp0.Package_ID
FROM t_package zp0
LEFT JOIN t_package zp1 ON zp0.Parent_ID = zp1.Package_ID
LEFT JOIN t_package zp2 ON zp1.Parent_ID = zp2.Package_ID
LEFT JOIN t_package zp3 ON zp2.Parent_ID = zp3.Package_ID
LEFT JOIN t_package zp4 ON zp3.Parent_ID = zp4.Package_ID
WHERE 1=1
AND (zp0.Name LIKE '#ARCHIV%' OR zp0.Name LIKE '[_]hist%' OR zp0.Name LIKE 'BEFORE[_]AREL%' OR zp0.Name LIKE '#BEFORE[_]AREL%'
OR zp1.Name LIKE '#ARCHIV%' OR zp1.Name LIKE '[_]hist%' OR zp1.Name LIKE 'BEFORE[_]AREL%' OR zp1.Name LIKE '#BEFORE[_]AREL%'
OR zp2.Name LIKE '#ARCHIV%' OR zp2.Name LIKE '[_]hist%' OR zp2.Name LIKE 'BEFORE[_]AREL%' OR zp2.Name LIKE '#BEFORE[_]AREL%'
OR zp3.Name LIKE '#ARCHIV%' OR zp3.Name LIKE '[_]hist%' OR zp3.Name LIKE 'BEFORE[_]AREL%' OR zp3.Name LIKE '#BEFORE[_]AREL%'
OR zp4.Name LIKE '#ARCHIV%' OR zp4.Name LIKE '[_]hist%' OR zp4.Name LIKE 'BEFORE[_]AREL%' OR zp4.Name LIKE '#BEFORE[_]AREL%')
) ArchivZdroj ON t_object.Package_ID = ArchivZdroj.Package_ID
WHERE 1=1
AND t_objectproperties.Property = '505-1 Operation Link'
AND t_objectproperties.Value IS NOT NULL
AND (ArchivCil.Package_ID IS NOT NULL OR StaraVerze.Package_ID IS NOT NULL)
AND ArchivZdroj.Package_ID IS NULL --SR ležící samo v archivu nereportovat
--AND t_object.Package_ID IN (#Branch#) --volitelné zúžení na větev v EA browseru


/* ----------------------------------------------------------------------------
   KONTROLA B — „HOTFIX guard": změna v produkci bez páru v _AREL
   ----------------------------------------------------------------------------
   Co nález znamená: v produkční package, která má živý _AREL sourozenec
   (= běží rozpracovaný release), byl element modifikován PO datu založení
   klonu (t_package.CreatedDate _AREL package), ale v _AREL package neexistuje
   stejně pojmenovaný element se změnou stejně čerstvou nebo novější. Podezření
   na HOTFIX zapsaný jen do as-is — po release by se oprava tiše ztratila
   (kritika 2.6; SKILL.md: „zapsat ručně do obou").
   Co s ním: ověřit u autora změny; buď doplnit párovou změnu do _AREL
   (+0.1 na atributu Version dle konvence), nebo potvrdit, že změna do to-be
   nepatří → označit „known". Falešné poplachy: element v _AREL přejmenován
   (párování je per Name+Object_Type), nebo ModifiedDate posunutý nesouvisejícím
   dotykem (EA ho aktualizuje i při drobných editacích).
   První běh nad starým obsahem: historický dluh, řešit dle kap. 5 kritiky.

   Mermaid (použité tabulky a joiny):
   classDiagram
     class t_object { ea_guid; Name; Object_Type; Package_ID; ModifiedDate }
     class t_package_prod { Package_ID; Parent_ID; Name }
     class t_package_arel { Package_ID; Parent_ID; Name; CreatedDate }
     class t_object_par { Name; Object_Type; Package_ID; ModifiedDate }
     t_object --> t_package_prod : Package_ID (přímo či do 2 úrovní)
     t_package_prod --> t_package_arel : sourozenec (Parent_ID, Name+AREL)
     t_object_par --> t_package_arel : Package_ID (NOT EXISTS pár)
   ---------------------------------------------------------------------------- */
SELECT --„HOTFIX guard" — elementy modifikované v produkční package po datu klonu bez párové změny v odpovídající _AREL package
 t_object.ea_guid AS CLASSGUID
,t_object.Object_Type AS CLASSTYPE
,t_object.Name AS Element
,ep0.Name AS ElementPackage
,prod.Name AS ProdPackage
,arel.Name AS ArelPackage
,arel.CreatedDate AS DatumKlonu
,t_object.ModifiedDate AS ZmenaVProdukci
,t_object.Author AS Autor --pole Author je nespolehlivé (EA-Repozitar-Kontext.md) — jen orientačně, ověřit v ut_history_log_detailed
FROM t_object
JOIN t_package ep0 ON t_object.Package_ID = ep0.Package_ID
LEFT JOIN t_package ep1 ON ep0.Parent_ID = ep1.Package_ID
LEFT JOIN t_package ep2 ON ep1.Parent_ID = ep2.Package_ID
JOIN t_package prod ON prod.Package_ID IN (ep0.Package_ID, ep1.Package_ID, ep2.Package_ID) --element přímo v produkční package nebo do 2 úrovní pod ní
JOIN t_package arel ON arel.Parent_ID = prod.Parent_ID
AND arel.Package_ID <> prod.Package_ID
AND arel.Name LIKE prod.Name + '%AREL%' --formát postfixu ARELYYMM zatím nepotvrzen doslovně (SKILL.md krok 3) → záměrně volný vzor
WHERE 1=1
AND prod.Name NOT LIKE '%AREL%'
AND prod.Name NOT LIKE '#%' --produkční strana nesmí být archiv/technická package
AND prod.Name NOT LIKE '[_]hist%'
AND prod.Name NOT LIKE 'BEFORE[_]AREL%'
AND arel.Name NOT LIKE '#%' --_AREL sourozenec musí být živý (rozpracovaný release), ne archiv
AND t_object.Object_Type NOT IN ('Package','Text','Note','Boundary') --čistě vizuální/strukturní objekty neplavat do reportu
AND t_object.ModifiedDate > arel.CreatedDate --změna v produkci až po založení klonu
AND NOT EXISTS
(
SELECT 1
FROM t_object par
JOIN t_package pp0 ON par.Package_ID = pp0.Package_ID
LEFT JOIN t_package pp1 ON pp0.Parent_ID = pp1.Package_ID
LEFT JOIN t_package pp2 ON pp1.Parent_ID = pp2.Package_ID
WHERE 1=1
AND par.Name = t_object.Name
AND par.Object_Type = t_object.Object_Type
AND arel.Package_ID IN (pp0.Package_ID, pp1.Package_ID, pp2.Package_ID) --pár leží v _AREL package nebo do 2 úrovní pod ní
AND par.ModifiedDate >= t_object.ModifiedDate --párová změna je stejně čerstvá nebo novější
)
--AND prod.Package_ID IN (#Branch#) --volitelné zúžení na větev v EA browseru
