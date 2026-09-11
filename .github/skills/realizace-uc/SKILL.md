---
name: realizace-uc
description: Most z funkční analýzy do logického designu + realizace UC. Per UC rozhodne, co zůstane na hranici aktér–FE a co se rozpadne do služeb (řízeno Dynamic View s povolenými komponentami a typy volání), vymodeluje UCR sekvenci s instancemi komponent a vazbami na operace, založí impact vazby a volitelný impact view. Sloučeno z prechod-do-logickeho-designu + realizace-uc + impact-view.
license: Complete terms in LICENSE.txt
---

# realizace-uc

> ✅ Kroky dle EMR vzorů (UCR 464, Usage impact vazby, LD-Behavioral impact diagram — viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §3–4, §6). Dynamic View mechanismus ✅ zmapován 2026-07-02 (viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §12). Konvence: `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md).

## Zařazení
- **Typ:** Produkční · **Role:** Systémový analytik · **Fáze:** F2+F3 (chování) · **Brána:** G2

## Vstupy
- Schválená G1: UC se scénářem, BRU, LS.
- Katalog komponent (`/Catalogues/Přehled komponent/Solution Artefacts`) a existující SR.
- **Dynamic View**: UC má konektor —Trace→ `IDS-Core Use Case` (SAR, `…/High Level Analysis/Core Use Cases`). Na Core UC je —Realization→ navázán element `IDS-Core Use Case Dynamics` (`…/High Level Design of Recommended Variant/Dynamic Achitecture View`), jehož kompozitní diagram definuje **závaznou množinu komponent a typů volání** (`IDS-Sync`/`IDS-Async` konektory, Usage → `IDS-Architecture Pattern`). Detail §12 EA-Repozitar-Kontext.md.

## Kroky

**Most (per UC):**
1. Ze scénáře urči, které kroky zůstanou interakcí aktér–frontend a které vyžadují backendové služby/data.
2. Dohledej Dynamic View: z UC jdi po Trace konektoru na `IDS-Core Use Case`, z něj po příchozí Realization na `IDS-Core Use Case Dynamics` a přečti jeho kompozitní diagram (`get_diagrams_information`) → závazná množina komponent a povolených typů volání. Lifeliny mimo tuto množinu jsou blokující nález. Pokud UC Trace na Core UC nemá, navrhni přiřazení dle SAR a nech potvrdit člověkem (HITL).
3. Sestav seznam potřebných služeb: existující (katalog → operation z interface) vs nové (→ návrh přes `katalog-komponent` do Proposed).

**UCR sekvence (vrstvení dle §7f pravidel — UCR končí na Manageru!):**
4. Na kompozitním Sequence diagramu UCR (auto-kompozit `UML Behavioral::Sequence` se používá přímo, nemazat — §7d/§7g/§7h): vlevo aktér, pak FE/Client, pak Manager. **Lifeliny zakládej jako NEPOJMENOVANÉ INSTANCE** (✅ N-K4-5, escape K3 — dřívější „rovnou s MDG typem" vytvářelo katalogové komponenty a je PŘEKONANÉ): `type: "Object"`, `name: ""` explicitně, `classifierID` komponenty, `stereotypes` = plain stereotyp classifiera (nekvalifikovaně — FQ se tiše zahodí; §7g/§7h). Na diagramu `:NázevKomponenty`. Type konverzi Object→Component ✅ dělá operace bridge `apply_classifier_stereotypes` (idempotentní port `ITAN-Apply Classifier Stereotypes on SD.vbs`, Dokumentace v0.9 §4.4); FIX skript kola je jen fallback. Lifeliny/EP/ref elementy vlastní UCR element (owningElementID), ne root package. RA a nižší vrstvy na UCR NEpatří.
5. Message cally dle kroků scénáře; aktér→FE bez vazby, FE→Manager navázat na operaci (operationID; L1). **PŘED přiřazováním operationID ověř Realization komponenta→interface pro KAŽDOU cílovou lifeline** vč. RA pass-through — bez ní se operace nenabízí a vazba nevznikne (✅ N-K3-6a, `katalog-komponent`). Lifeliny na diagram VŽDY `place_elements_on_diagram` s **width i height** (jinak hrozí tichý no-op, §7d) a až pak zprávy. **Zpráva s polem `operation` (`create_or_update_messages`, K1) nese jméno/argumenty/return z operace už při create** (✅ 2026-07-21; name-only follow-up update odpadá — N-K3-6b). GUI vazba vč. comba je plná (UI ✅ 2026-07-21) — položka handoffu odpadá; u starších zpráv založených před 2026-07-21 při revizi prověřit. Po create levná kontrola číselné řady `seqNo` (✅ N-K3-6c). Self cally = slovní popis. Sync/async dle Dynamic View (isAsynchronous, L2).
6. Volání služby Manageru nerozkresluj — **InteractionOccurrence** odkazem na její SR, umístěný **bezprostředně POD message call volané operace** (§7g). Klikatelnost refu: FIX skript přes `SetCompositeDiagram` z kompozitu classifiera (§7g) — už ne ruční krok. Vnitřek služby a delegace na nižší vrstvy řeší `realizace-sluzby`.
7. Impact vazby kopírují ref řetěz: UCR —Usage→ SR+DTO volané služby Manageru; SR Manageru —Usage→ SR nižší služby (zakládá `realizace-sluzby`).

**Impact view (volitelně, dlouhé call chainy):**
8. V `GLOBAL VIEWS` diagram `Use Case Realization Impact of <oblast>` (`CSOB-ITAN::LD-Behavioral`) z Usage vazeb — přehled, ne primární artefakt.

## Kontrola výstupu
Každý systémový krok scénáře má protějšek v UCR; lifeliny jen z Dynamic View; cally navázané na operace; reference na SR fungují. K dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4, ✅ 2026-07-17). Pak `emr-qa` (sada F3).

## Operace ea-file-bridge
`get_elements_information, create_or_update_diagram, create_or_update_messages, place_elements_on_diagram, create_or_update_connectors, find_elements_by_name`
