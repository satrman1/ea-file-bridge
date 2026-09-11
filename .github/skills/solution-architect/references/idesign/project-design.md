# Project design (Fáze 2 Metody) — kompaktní reference

Zdroj: díl 4. **Mimo produkční scope AI disciplíny** (výstupy nejdou do EA, konzumentem je
projektové řízení) — čti jen na explicitní dotaz. Zachováno pro úplnost znalostí, protože
Metoda trvá na kontinuitě: „Always follow with project design immediately after system
design" — architektura je baseline, komponenta je jednotka plánování.

## Role a principy

- Architekt projekt **navrhuje**; projektový manažer **trackuje**; smyčku uzavírají spolu.
- „Not having a skilled architect is the #1 risk"; 9/1 conundrum — víc lidí nezrychlí
  kontemplativní práci; jeden architekt drží integritu návrhu (jinak Chimera).
  U velkých projektů senior + junior (sounding board, výchova).
- „Currency of projects is time."

## Staffing

- **Komponenta : vývojář = 1:1**; „Assembly boundary is team boundary."
- Conwayovský izomorfismus **oběma směry**: interakce v týmu ≅ interakce komponent —
  jedna dekompozice řídí systém i organizaci.
- Pořadí: architekt → core team (bod Feed Me / Kill Me) → vývojáři phase-in/out.
- Pitfally: up-front staffing (architektura se ohne podle lidí); diktované kontrakty →
  mirror image effect (obrana: adaptery, façade, preemptive strike vlastním kontraktem).

## Integrační plán

- „Cut to plan, bang to fit" — integrace se navrhuje předem; vyhnout se big-bang syndromu.
- **Bottom-up z dependency grafu**: test harness → utility/iFX → Resources → ResourceAccess
  → Engines → Manageři → klienti → system testing. Infrastruktura předchází byznys
  komponentám.
- **Milníky = integrační body, ne features** (důsledek „features = produkt integrace").
- Na každém přírůstku otestovaný funkční systém; staged delivery; logická služba
  (Manager + Engines + RA) je přirozená etapa.

## Earned value

- Odhady a tracking **po komponentách**; váha = % projektu. Fázová procenta uvnitř
  komponenty: Requirements 15 / Design 20 / Test plan 10 / Construction 40 /
  Documentation 15 → komponenta je **ze 45 % hotová před prvním řádkem kódu**.
- **Nominální odhad**: „Both underestimation and overestimation are deadly" (padding se
  projí gold platingem, agresivní rozvrh garantuje řezání rohů). Odhadují členové týmu;
  itemizovat celý životní cyklus.
- Křivka správně obsazeného projektu = mělké S; postup se měří earned value, ne dojmem
  (90/90 conundrum). Symptomy z polohy křivek Plan/Progress/Effort: Life is good /
  Under Estimating / Over Estimating / Resource Leaks / Sandbagging.
- Smysl: „Take corrective actions when still have effect."

## Životní cyklus komponenty

Mini-vodopád per komponenta: SRS → review → detailní design → review → test plán →
konstrukce + test klient → integrační testy + code review + dokumentace. Každá komponenta
má vlastní testovací prostředí, **simulátor i emulátor**; „At any given time, a service
has zero bugs"; „ALL the core code is reviewed"; „Quality leads to productivity."

## Hand-off point (HOP)

Hranice architekt/vývojáři není pevná — klouže podle seniority týmu (optimum 2:1
senior:junior → HOP na top-level designu; juniorní tým → HOP až na service třídách =
„disproportional more work", řešení: juniorní architekt pod dohledem). Mix and match
per jednotlivec.
