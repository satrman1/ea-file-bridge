---
name: sar-validace-call-chains
description: >
  Validace Solution architektury call chainy a smell-check (SA disciplína, IDesign) —
  superpozice core use cases na komponenty, kontrola 17 pravidel interakce, katalog
  smells, test misí a QA checklist SA. Výstup pro bránu SA-G3. Použij po zápisu
  architektury do EMR, nebo pro review existujícího SA návrhu.
---

# sar-validace-call-chains

> SA disciplína. Pravidla: `sar-pravidla.md` (skill `emr-konvence`, references/sar-pravidla.md) (QA checklist §6). Znalosti:
> `../solution-architect/` (references: `validace-call-chains.md`, `pravidla-interakce.md`,
> `design-smells.md`, `checklisty.md` bloky A+B).

## Zařazení
- **Typ:** QA/validační (SA) · **Brána:** SA-G3

## Vstupy
SA balíček v EMR (po SA-G2) nebo MD návrh (režim review před zápisem); schválené
core use cases a objectives z SA-G0/G1.

## Kroky

1. **Call chain per core use case**: superponuj use case na komponenty Big Picture
   (číslované kroky; plná šipka = sync, čárkovaná = async/queued). Ověř: use case
   protéká EXISTUJÍCÍMI komponentami; chybí-li komponenta → díra v dekompozici
   (zpět na SA-G1); vznikla-li komponenta pojmenovaná po use case → funkcionální
   recidiva (nález B).
1b. **Kontrola core množiny (metodika + heuristika typového zástupce):** každý core UC
   musí mít **odlišný call chain** — dva core UC se shodným chainem = jeden je variace
   (nález W, zredukovat množinu); komponenta dekompozice, kterou nepoužívá žádný core
   chain a nekryje ji doložená budoucí potřeba = podezření z gold platingu (nález W);
   ověř i **aktéra ČAS** (existuje časem spouštěný impuls — EOD, dávka — a má svůj
   chain?). Detail definic: `references/idesign/validace-call-chains.md` (skill `solution-architect`).
2. **Pravidla interakce** (`pravidla-interakce.md`): pro každou vazbu směr jen dolů
   nebo povolená relaxace; M→M jen async; Engine nevolá Engine; RA nevolá RA; klient
   jeden Manager per use case; události jen z Managerů. **Generic System / Generic
   LISC lifeliny z kontroly vyňaty** (§4.7 sar-pravidel).
3. **Smell-check** (`design-smells.md` S1–S8): počty (kalibrace 3,4/3,8/4,0), jména,
   vertikální trojice, fat Manager, tvary (fork/staircase/glove), symetrie, reflecting
   change. Každé pípnutí: oprava, NEBO explicitní zdůvodnění volatilitou (zapsat).
4. **Test misí**: každý blok architektury slouží některému objective; blok bez krytí
   = gold plating (nález B). Variace: ověř 1–2 ne-core use cases jako jinou kompozici
   týchž komponent (ne jinou dekompozici).
5. **QA checklist SA** (§6 sar-pravidel, SA-1..SA-10) nad zpětně přečteným stavem EMR.
   SQL kontroly SARů spouští člověk v GUI (na SQLite NEČÍST ModelView přes AI kanál —
   blokující dialog); výsledky převezmi do reportu.
6. **Report** pro SA-G3: nálezy B/W/I s Path referencemi, call chain diagramy
   (Mermaid v MD reportu), smell zdůvodnění, handoff ručních kroků. + shrnutí
   producenta s confidence flags. Předlož **SA-G3**.

## Kontrola výstupu
Všechny core UC pokryty call chainy; každý smell vyřešen nebo zdůvodněn; žádný blok
bez objective; QA jen nad zpětně přečteným stavem; vrácení kategorizována (WP5).
