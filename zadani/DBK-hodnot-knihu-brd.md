# Mini-BRD — Hodnocení knihy návštěvníkem (Databáze knih, DBK)

| Pole | Hodnota |
|---|---|
| Projekt | Databáze knih (DBK) — cvičná doména; v EMR existuje pilot `/Business Applications/#PILOT DBK` (UC-91001…91005) **jen pro čtení** — tento tenký řez se modeluje **nově pod `#FB-TEST`** (jediná povolená větev zápisu), do pilotní větve se nezapisuje |
| Zadavatel / Owner | Provozovatel webu DBK (business vlastník) |
| Origin | dokument „Databáze knih" (`IT-ANALYSIS/podklady/business-sample-book-db.png`), odstavce Základní informace + Doplňující informace 1 |
| Verze | 1.0 — 2026-09-07 (Z260907b-4, scénář PV-R2 revidován: DBK místo SportHub) |
| Cílový UC | jeden nový UC pro hodnocení knihy návštěvníkem; **číslo přidělí analytik podle pravidla „nejvyšší obsazené `UC-#####` v cílové větvi + 1"** (nepřebírat čísla z pilotu 91xxx) |
| SOS / Core UC | pro tenký řez **neexistuje** — mantinely neřeš, uveď jako známé omezení v návrhu hranice |

Kontext (ze zadání): Běžný návštěvník webu Databáze knih (www.DBK.cz) se bez jakéhokoli přihlašování dostane do webové aplikace. Na detailu knihy vidí kromě názvu rok vydání, vydavatelství, žánr, jazyk, anotaci, autora (autory) a **celkové hodnocení knihy v procentech** (100 % nejlepší, 0 % nejhorší). Návštěvník má možnost zadat knize **vlastní hodnocení 1 až 5 hvězdiček** (5 nejlepší, 1 nejhorší). Hodnocení z jedné IP adresy je možné jen jednou.

Glosář: **návštěvník** = nepřihlášený uživatel webu (identifikován jen IP adresou); **kniha** = záznam v databázi s parametry (název, rok vydání, vydavatelství, žánr, jazyk, anotace, autoři); **hodnocení** = jeden hlas návštěvníka 1–5 hvězdiček k jedné knize; **celkové hodnocení** = agregát všech hlasů knihy vyjádřený v procentech.

## Požadavky

### DEMO-91051 Zadání hodnocení knihy návštěvníkem

- **Requirement Types BABOKv3:** FR · **ICT impact:** Yes · **Weight:** Must
- **Description:** Návštěvník na detailu knihy zadá vlastní hodnocení 1 až 5 hvězdiček (5 nejlepší, 1 nejhorší) bez přihlášení. Systém hodnocení uloží k dané knize spolu s IP adresou návštěvníka a časem zadání a potvrdí přijetí.
- **Acceptance criteria:**
  1. Hodnocení lze zadat pouze z detailu knihy a pouze v hodnotách 1, 2, 3, 4 nebo 5.
  2. Po uložení existuje záznam hodnocení: kniha, hodnota, IP adresa, čas.
  3. Návštěvník dostane potvrzení, že hodnocení bylo přijato; při odmítnutí vidí důvod.

### DEMO-91052 Celkové hodnocení knihy v procentech

- **Requirement Types BABOKv3:** FR · **ICT impact:** Yes · **Weight:** Must
- **Description:** Na detailu knihy se zobrazuje celkové hodnocení knihy v procentech (100 % nejlepší, 0 % nejhorší) vypočtené ze všech uložených hodnocení dané knihy. Po přijetí nového hodnocení se celkové hodnocení přepočítá.
- **Acceptance criteria:**
  1. Kniha bez hodnocení nezobrazuje procenta (zobrazí „bez hodnocení"), nikoli 0 %.
  2. Kniha se samými 5★ má 100 %, se samými 1★ má 0 %; průměr 3★ odpovídá 50 %.
  3. Po přijetí nového hodnocení odpovídá zobrazené procento všem uloženým hodnocením včetně nového.

### DEMO-91053 Jedno hodnocení z jedné IP adresy

- **Requirement Types BABOKv3:** FR · **ICT impact:** Yes · **Weight:** Must
- **Description:** Hodnocení téže knihy z jedné IP adresy je možné jen jednou. Pokus o druhé hodnocení téže knihy ze stejné IP adresy systém odmítne a návštěvníkovi sdělí důvod; původní hodnocení zůstává beze změny.
- **Acceptance criteria:**
  1. Druhé hodnocení téže knihy ze stejné IP adresy se neuloží a celkové hodnocení se nezmění.
  2. Hodnocení jiné knihy ze stejné IP adresy je možné.
  3. Návštěvník vidí důvod odmítnutí.

## Mimo hranici (neregistrovat jako FR)

- Vyhledávání knih pomocí filtrů, seznam nejlépe hodnocených knih (50), detail autora a seznam autorů — jiné případy užití (v pilotu DBK: UC-91001, UC-91003).
- Administrace knih a autorů — jiné případy užití (UC-91004, UC-91005).
- Způsob zjištění IP adresy a ochrana proti obcházení (proxy, VPN) — technické řešení, ne požadavek business zadání.
