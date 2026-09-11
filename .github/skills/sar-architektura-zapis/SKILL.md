---
name: sar-architektura-zapis
description: >
  Zápis schválené Solution architektury do EMR (SA disciplína, IDesign) — scaffold SAR
  balíčku dle šablony, Area of Volatility, Core Use Cases s aktivitami, katalogové
  komponenty, Big Picture (instance) a Dynamic Architecture View (linky). Použij po
  schválené bráně SA-G1, když se má architektura propsat do Enterprise Architectu.
---

# sar-architektura-zapis

> SA disciplína. Pravidla: `sar-pravidla.md` (skill `emr-konvence`, references/sar-pravidla.md) (struktura §3, zápisová pravidla §4)
> + obecná `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md) (§7 vzory zápisu, **§12 bezpečný zápis: baseline,
> žurnál, razítka, dry-run diff**). Mapa platformy: `IDesign-MDG-Kontext.md` (mimo workspace — vyžádej od uživatele).

## Zařazení
- **Typ:** Produkční (SA) · **Brána:** SA-G2 (gate package dle WP1)

## Vstupy
Schválený `SA-G1-<Projekt>.md`; cílová větev (pilot: pracovní prostor P1–P3 / `#PILOT`
demo). ID šablon a katalogu dohledat čerstvě (`find_packages_by_name` — ID se mění!).

## Kroky

1. **Scaffold balíčku** dle stromu §3 sar-pravidel (kopie logiky šablony — packages,
   diagramy s MDG typy; typ diagramu po create zpětně přečti, §4.10). Baseline PŘED
   zápisem, razítka AI-Session/AI-Batch, žurnál.
2. **Area of Volatility**: schválené volatility jako **IDS-Volatility (Requirement)**
   elementy — name = volatilita, notes = destilát odůvodnění (co/proč/dopad + krycí
   objective; NE celý rozhovor — D10). Diagram Generic Oveview.
3. **Core Use Cases**: UC elementy (IDS-Core Use Case) + overview diagram; per UC
   kompozit Core UC Detail + **IDS-Core Use Case Activity** (Activity) s kompozitním
   activity diagramem (nesmí zůstat prázdný — naplň kroky ze swim lanes). Vazba
   UC ↔ Activity: právě jedna **IDS-Description**.
4. **Katalog komponent**: pro každou schválenou komponentu nejdřív hledej v masteru
   i Proposed (žádné duplicity); nové zakládej **do Proposed** se schváleným
   stereotypem (klasifikace z SA-G1), popisem a TV **`IDS01_Status=Proposed`**.
   **Interfacy HNED dle vzoru §4.8 sar-pravidel** (N-SH-2, vzor DEMO Manager):
   pro Manager/Engine/RA/Utility (Klienti a Resources NE) 2× plain `UML::Interface`
   **`common interface`** + **`common interface proposed`** owned POD elementem
   komponenty, Realization na oba, kompozit `IDS-IDesign::Service Contract Detail`
   s komponentou a oběma IF. Žádné facetování bez pokynu SARa (D9). Po createch
   retro-read + případný FQ update binding (§4.11).
5. **Big Picture**: diagram Generic Oveview, **POUZE pojmenované INSTANCE** komponent
   z katalogu (Object + classifierID + plain stereotyp — vzor §7g); vazby jen
   IDS-Sync/IDS-Async (M→M async); žádné duplicitní vazby.
6. **Dynamic Architecture View**: per core UC element **IDS-Core Use Case Dynamics**
   (Collaboration) v package „Dynamic Architecture View" + kompozit s **POUZE LINKY**
   na katalogové komponenty; vazba UC ↔ Dynamics: právě jedna **Realization**.
   Kompozit nesmí zůstat prázdný.
7. **Popisy vazeb**: linked Notes ke konektorům (nikdy labely). ⚠ NoteLink přes bridge
   neověřen (registr operaci pro NoteLink nemá, N-P9) — první výskyt = sandbox drill; do ověření vykazuj texty popisů
   v handoffu jako ruční krok.
8. **Závěr**: zpětné přečtení všeho zapsaného (QA vykazuje jen ověřený stav);
   gate package (WP1) + shrnutí producenta s confidence flags; handoff ručních kroků
   (Notes, IsComposite, autorství diagramů). Předlož **SA-G2**.

## Kontrola výstupu
Checklist SA-1..SA-6 + SA-10 (§6 sar-pravidel) čistý; žádný SAMPLE; žádný zápis mimo
pracovní prostor; žurnál + baseline + restore manifest existují. Pak `sar-validace-call-chains`.

## Operace ea-file-bridge
`find_packages_by_name, create_or_update_package, create_or_update_elements,
create_or_update_diagram, create_or_update_connectors, place_elements_on_diagram,
create_baseline, get_elements_information, get_diagrams_information, reload_diagrams`
