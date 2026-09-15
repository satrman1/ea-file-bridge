# Ukázky pro all-mgmt díl 1 — 22. 9. 2026

Zadání, checklist zkoušky, prompty pro rozpracovaná vlákna a úklid: `C:\Users\milos\CLAUDE\IT-ANALYSIS\Zadani-Ukazky-2026-09-22.md` (vault).

`ready\` = hotové dávky s placeholdery (`<TEST-DB>`, `<GUID-DEMO>`, `<GUID-STABLE-PKG>`, `<GUID-STABLE-KNIHA>`, `<GUID-STABLE-DIAGRAM>`, `<ID-KOMPONENTA>`, `<NAZEV-KOMPONENTY>`) — dosazuje `tools\banka-dosad.py` z `config\banka-hodnoty.json` v korporátním repu, nebo ručně.

| Soubor | Kanál | Zápis | K čemu |
|---|---|---|---|
| `req-ukazka-R0-schranka-ping.json` | schránka, produkční VDE | ne | kontrola č. 1: baseDir + práva účtu P |
| `req-ukazka-R1-recon.json` | pumpa, testovací prostředí | ne | recon pro NAHRAĎ (typ entit, typ diagramu, dt typy, ArchiMate stereotypy, ID komponenty) — jen při zkoušce |
| `req-ukazka-S1-ldm.json` | pumpa | 10 ops, LOW | S1 živě: LDM Hodnocení knihy (package + 5 entit + atributy + 4 asociace + diagram + place + open) |
| `req-ukazka-S1-stabilni.json` | pumpa | 10 ops, LOW | jednou: stabilní model pro S2 (GUIDy z ACK → banka-hodnoty.json) |
| `req-ukazka-S2-delta-recenze.json` | schránka, produkční VDE | 4 ops, LOW | S2 živě: entita Recenze + asociace na Kniha + place + open nad stabilním modelem |
| `req-ukazka-S3-Q2-vazby.json` | schránka, produkční VDE | ne | S3 kolo 1: vazby komponenty podle typu (odchozí/příchozí), TOP 15 |
| `req-ukazka-S3-Q3-procesy.json` | schránka, produkční VDE | ne | S3 kolo 2: obsluhované procesy + realizované služby, TOP 8 |

Stav 13. 9. 2026: připraveno, nic neběželo. První běh = R0 a R1.
