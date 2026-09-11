---
name: sar-prevzeti-zadani
description: >
  Převzetí zadání pro Solution architekturu (SA disciplína, IDesign) — výtěžek interview,
  glosář, řetěz vize → objectives → mise, transformace požadavků (swim lanes) a core use
  case kandidáti. Výstup = MD podklad brány SA-G0, bez zápisu do EMR. Použij při startu
  SA zakázky, přípravě podkladů pro Solution architekta, nebo na pokyn sepsat vizi,
  objectives či core use cases nového řešení.
---

# sar-prevzeti-zadani

> SA disciplína. Pravidla: `sar-pravidla.md` (skill `emr-konvence`, references/sar-pravidla.md). Znalosti: `../solution-architect/`
> (references: `interview-stakeholderu.md`, `vize-cile-mise.md`, `dekompozice-volatilita.md`
> — sekce swim lanes). **Žádný zápis do EMR** (✅ D10 delty: papírová část = MD dokumenty).

## Zařazení
- **Typ:** Produkční (SA) · **Role:** Solution architekt (AI produkce, člověk rozhoduje) · **Brána:** SA-G0

## Vstupy
Business zadání (text/obrázky/přepisy jednání); existující glosář, pokud je; přístup
ke stakeholder odpovědím (nebo seznam otázek k položení).

## Kroky

1. **Interview výtěžek** (`interview-stakeholderu.md`): z dodaných podkladů extrahuj
   pain points, výroky o povaze businessu, kandidáty změn per osa (čas × napříč
   zákazníky/pobočkami). Chybí-li odpovědi, vygeneruj otázky dle checklistu (vč.
   „areas that might change" a prioritizační „kdyby jen jedna věc") a předej člověku —
   nevymýšlej odpovědi.
2. **Glosář**: nové pojmy + rozpory s existující terminologií (pozor „služba" —
   terminologické pravidlo §1 sar-pravidel).
3. **Vize → objectives → mise** (`vize-cile-mise.md`): vize 1 věta, 5–7 čistě
   byznysových objectives, mise o blocích. Označ, co je z podkladů a co je tvůj návrh.
4. **Transformace zadání**: „you should never directly use the requirements" — swim
   lanes hlavních use cases podle oblastí odpovědnosti; konsolidace duplicit; oddělení
   řešení maskovaných jako požadavky („Was cooking ever a requirement?").
5. **Core use case kandidáti**: 4–6 vzájemně odlišných, v jednoduché seznamové formě
   (name + 1 věta — „not heavy specs"; detailní specifikace je disciplína analýzy).
   **Definice (metodika, závazné):** UC = **jedna interakce/impuls aktéra** (člověk,
   externí systém, nebo ČAS), nikdy uživatelem řízený sled kroků či workflow. Core UC =
   nejlépe vystihuje nejdůležitější business přínos; **v zadání obvykle přímo není** —
   vzniká abstrakcí; ostatní UC jsou varianty/podpůrné. **Výběrové kritérium:** každý
   core UC = typový zástupce s **odlišným call chainem** realizace — kandidáty vybírej
   tak, aby jejich množina organicky pokryla všechny komponenty existujících
   i očekávaných UC (heuristika, detail `references/idesign/validace-call-chains.md` (skill `solution-architect`)).
   Nezapomeň na aktéra ČAS (dávkové/EOD impulsy — v zadáních často chybí).
6. **Kandidáti volatilit**: jen SBĚR podél os s odkazem na zdroj v podkladech —
   **žádné verdikty** (ty patří `sar-volatilita-dekompozice` a bráně SA-G1).

## Výstup

MD dokument `SA-G0-<Projekt>.md` (do složky projektu vedle IT-ANALYSIS artefaktů) se
sekcemi: Interview výtěžek · Glosář · Vize/Objectives/Mise · Swim lanes · Core UC
kandidáti · Kandidáti volatilit (bez verdiktů) · Otevřené otázky. + shrnutí producenta
s confidence flags (WP4). Předlož **SA-G0** (HUMAN_DECISION).

## Kontrola výstupu
Objectives bez technologií; mise mluví o blocích, ne features; každý core UC kandidát
má byznysovou hodnotu; kandidáti volatilit mají zdroj (ne spekulace); nic nezapsáno do EMR.
