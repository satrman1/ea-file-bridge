# Ukázky pro all-mgmt díl 1 — 22. 9. 2026

Zadání, checklist zkoušky, prompty pro rozpracovaná vlákna a úklid: `C:\Users\milos\CLAUDE\IT-ANALYSIS\Zadani-Ukazky-2026-09-22.md` (vault, **v2 15./16. 9.** — S1/S2 na Use Case model).

**Změna 15. 9. (Z260915-2):** S1 a S2 přeloženy z LDM na **Use Case model** — zápis LDM ve velkém bankovním repu trvá desítky sekund (triggery na `t_object`/`t_attribute`), UC kostra je rychlá (scénáře = XML v `t_objectscenarios`); živá část musí být pod ~10 s. LDM dávky nemazány → `ready\_ldm-odlozeno\` (mohou se hodit po 22. 9.). S3 (SQL analýza schránkou) beze změny.

`ready\` = hotové dávky s placeholdery (`<TEST-DB>`, `<GUID-DEMO>`, `<GUID-STABLE-PKG>`, `<GUID-STABLE-UC>`, `<GUID-STABLE-AKTER>`, `<GUID-STABLE-BOUNDARY>`, `<GUID-STABLE-DIAGRAM>`, `<GUID-S1A-UC>`, `<GUID-S2-UC>`, `<ID-KOMPONENTA>`, `<NAZEV-KOMPONENTY>`) — dosazuje `tools\banka-dosad.py` z `config\banka-hodnoty.json` v korporátním repu, nebo ručně. Žádné `matchByName`, žádné hledání podle jména, každý `query` s `TOP N`, bez CTE, jedna cílová package na dávku.

| Soubor | Kanál | Ops | Zápis / Risk Gate (offline odhad*) | K čemu |
|---|---|---|---|---|
| `req-ukazka-R0-schranka-ping.json` | schránka, produkční VDE | 1 | čtení | kontrola č. 1: baseDir + práva účtu P |
| `req-ukazka-R1-recon.json` | pumpa, testovací prostředí | 8 | čtení | recon pro NAHRAĎ: op 1 existující UC (Object_Type, TOP 5), op 2 `MDGDgm=` UC diagramu (TOP 1), op 3 aktéři, op 4 Boundary, op 5–6 ArchiMate stereotypy (S3), op 7 `Object_ID` komponenty (S3, hledá jménem — jednorázově) |
| `req-ukazka-S1a-uc.json` | pumpa | 6 | **LOW** — writeOps 9, createOps 6, affectedPackages 1 | S1a živě: package pod `<GUID-DEMO>` + aktér Návštěvník + `Hodnoť knihu` + Boundary DBK + asociace + survey diagram `CSOB-ITAN::FA-Behavioral` + place + open |
| `req-ukazka-S1b-uc-scenare.json` | pumpa | 3 | **ELEVATED** (scenarios/constraints/requirements = ELEVATED vždy) — writeOps 11, updatedExisting 3 | S1b druhý beat (volitelný — rozhodne zkouška): BE91101 + AF + 2 EF, 4 constrainty PRE/PST, 3 lokální BRU na `<GUID-S1A-UC>` (GUID UC z ACK S1a, op 1 `items[1]`) → popup pumpy Ano = „člověk potvrzuje" |
| `req-ukazka-S1-uc-stabilni.json` | pumpa | 6 | **LOW** — writeOps 9 | jednou: stabilní UC model pro S2 (`Hodnoť knihu`); GUIDy z ACK → `banka-hodnoty.json` (`<GUID-STABLE-*>`: PKG = op 0, AKTER = op 1 `items[0]`, UC = `items[1]`, BOUNDARY = `items[2]`, DIAGRAM = op 3) |
| `req-ukazka-S2-uc-delta.json` | schránka, produkční VDE | 5 | **LOW** — writeOps 7, createOps 3, affectedPackages 1 | S2 živě: `Zruš hodnocení` + asociace na stabilního aktéra + **vlastní** survey diagram `… (delta M365)` s umístěním stabilního Boundary/UC/aktéra + nového UC + open |
| `req-ukazka-S2-alt-uc-delta-survey.json` | schránka, produkční VDE | 4 | **ELEVATED** — `foreignDiagrams 1 > 0` (umístění na existující stabilní diagram) | S2 alternativa: totéž, ale na existující survey diagram → EA dialog Ano/Ne/Storno. Jen jako záměrný beat; rozhodne zkouška |
| `req-ukazka-S2b-uc-scenare.json` | schránka, produkční VDE | 3 | **ELEVATED** — writeOps 5 | S2 volitelný 2. beat: scénáře + constrainty + BRU na `<GUID-S2-UC>` (GUID nového UC z ACK S2, op 0 `items[0]`) |
| `req-ukazka-S3-Q2-vazby.json` | schránka, produkční VDE | 2 | čtení | S3 kolo 1: vazby komponenty podle typu (odchozí/příchozí), TOP 15 |
| `req-ukazka-S3-Q3-procesy.json` | schránka, produkční VDE | 2 | čtení | S3 kolo 2: obsluhované procesy + realizované služby, TOP 8 |
| `_ldm-odlozeno\req-ukazka-S1-ldm.json`, `…S1-stabilni.json`, `…S2-delta-recenze.json` | — | 10 / 10 / 4 | odloženo 15. 9. | původní LDM varianta S1/S2 (placeholder `<GUID-STABLE-KNIHA>`); **pozor:** S2-delta-recenze umisťuje na existující diagram = podle gate ELEVATED, ne LOW, jak tvrdil README z 13. 9. |

\* Offline odhad = `FB_RiskGate` ze `src/` spuštěný nad dávkami v Node s mock repozitářem a politikou `EAEXAMPLE.QEA` (= DEV prahy, s nimiž má bankovní `FB_RiskPolicy` paritu — protokol banka část A blok 5). Není to živý běh: pumpa/EA doma nespuštěna (Z260915-2 běžel bez Miloše), ACK z eaexample chybí → **první živý běh S1a nad eaexample nebo `<TEST-DB>` = zkouška Čt 17. 9.** Kontrola: `node test\harness.js` 248/248 před i po (src/ nedotčeno).

Stav 16. 9. 2026: připraveno, nic neběželo. První běh = R0 a R1, pak S1a.
