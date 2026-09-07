## Actors

* Aktér je většinou člověk, který používá systém prostřednictvím určitého uživatelského rozhraní, případně systém či scheduler přistupující přes API.
* V systému je přesně tolik aktérů, kolik pro ně budeme tvořit rozhraní.
* Aktér tedy NENÍ název rozhraní, ale uživatel, který skrze dané rozhraní interaguje se systémem.
* Aktér tedy NENÍ uživatelská role.

## Use Cases

* Snaž se vyhnout funkční dekompozici a agreguj spolu související kratší scénáře do jednoho (typ "Spravuj XYZ").
* Use Case má právo na existenci pouze v případě, že je samostatně spustitelný aktérem.
* Pokud se dá čekat, že by byl scénář Use Case dlouhý a nepřehledný, poruš předchozí pravidla a rozpadni jej na jemnější granularitu.

## Naming

* Slovesa v názvech Use Casů piš v rozkazovacím způsobu.
* Název Use Case piš z pohledu činnosti uživatele - např. "Prohlížej něco" NIKOLIV "Zobraz něco".
* Pro přehlednost opatři název UC postfixem "(CRUDL)", který na první pohled informuje o tom, jaké scénáře jsi sloučil (create, read, update, delete a list). Pozn. L=List – speciální varianta Read, kdy se pracuje se seznamem.
* U postfixů CRUDL nepoužívej formát R/L, L/R, ale pouze vyjmenuj písmena bez oddělovačů (např. RL nebo CRUDL).

## Traceabilita na požadavky

* Každý UC pokrývá ≥ 1 funkční požadavek (vazba požadavek ↔ UC je povinná).
* Není-li v cílovém prostředí registr požadavků dostupný (sandbox, POC): požadavky NIKDY nevymýšlej — nepokrytí vykaž ve shrnutí návrhu jako confidence flag / nález pro člověka (✅ N-6 POC 2026-08-21).

