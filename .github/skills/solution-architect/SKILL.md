---
name: solution-architect
description: >
  Expert na Solution architekturu podle metodiky IDesign (Juval Löwy) — dekompozici systému
  podle volatility, taxonomii komponent (Manager/Engine/ResourceAccess), pravidla interakce,
  validaci call chainy, design smells, kontrakty a messaging. Použij tento skill kdykoliv
  uživatel potřebuje navrhnout nebo zrevidovat dekompozici systému na komponenty, posoudit
  architekturu řešení, validovat call chainy, faktorovat kontrakty služeb, nebo zmíní
  "IDesign", "volatilita", "dekompozice", "Manager", "Engine", "ResourceAccess",
  "solution architektura", "SOA Service", "call chain", "design smell", "uzavřená architektura",
  "kontrakt", "faceta", "message bus". Spouštěj i při review návrhů Solution architektů
  a při otázce, zda je komponenta správně vymezená.
---

# Solution Architect (IDesign)

Expertní skill bez vazby na platformu (EMR/EA zápis řeší workflow skilly). Pokrývá metodiku
IDesign tak, jak je zachycena ve čtyřdílné publikaci `IT-ANALYSIS/IDesign/idesign-1..4`
(korpus IDesign Inc. 2008–2015). Znalost je destilována do `references/idesign/` — načítej
podle režimu níže, ne všechno najednou.

**Kontext banky:** IDesign je ~10 let adoptovaná norma, ale praxe se od doktríny odchýlila.
Než použiješ pravidla závazně, přečti [banka-kontext](references/idesign/banka-kontext.md) — destilát
**závazné delty** `IDesign/IDesign-v-Bance-Delta.md` (v0.3, D1–D11); při konfliktu platí
delta. Doktrína bez delty = Löwy 2012, ne banka.

## Jádro metodiky v pěti větách

Systém se rozkládá podle **oblastí budoucí změny (volatilit)**, ne podle funkcí ani domén —
funkcionální a doménová dekompozice jsou centrální anti-vzory. Každá volatilita se zapouzdří
do komponenty (Client / Manager / Engine / ResourceAccess / Utility) a **chování systému vzniká
interakcí komponent** („features are product of integration, not implementation"). Volá se jen
dolů do bezprostředně nižší vrstvy; výjimky jsou přesně čtyři. Návrh je validní, teprve když
minimální množina komponent unese všechny myslitelné use cases — dokazuje se call chainy nad
4–6 core use cases. Kreativní a riziková je jen identifikace volatilit; zbytek je „téměř
mechanický" — proto volatility rozhoduje vždy člověk a AI produkuje odvozené artefakty.

## Režimy práce

### Režim 1: Návrh dekompozice (z business zadání)

1. Přečti `dekompozice-volatilita.md` (osy, rozhodovací strom, pasti) a `vize-cile-mise.md`.
2. Transformuj zadání (nikdy nepoužívej požadavky přímo — swim lanes, konsolidace).
3. Najdi kandidáty podél obou os volatility; každého prožeň rozhodovacím stromem
   (variabilita? povaha businessu? gold plating? pravá volatilita?).
4. Navrhni dekompozici dle `taxonomie-komponent.md`; jména dle konvencí (Manager = podstatné
   jméno, Engine = sloveso/slovesné podst. jméno).
5. **Výstup vždy odděl: (a) seznam volatilit s odůvodněním (co/proč/pravděpodobnost×dopad)
   — to je rozhodnutí pro člověka; (b) z nich odvozenou dekompozici.** Nikdy nepředkládej
   dekompozici bez seznamu volatilit.

### Režim 2: Validace architektury call chainy

1. Přečti `validace-call-chains.md` a `pravidla-interakce.md`.
2. Vyžádej/urči 4–6 core use cases (lehké seznamy, ne heavy specs).
3. Superponuj každý use case na komponenty (plná šipka = synchronní, čárkovaná = queued).
4. Ověř 17 pravidel interakce a uzavřenou architekturu; chybějící komponenta v řetězu = díra
   v dekompozici.

### Režim 3: Review / smell-check návrhu

1. Přečti `design-smells.md` a `checklisty.md`.
2. Projdi počty, jména, tvary call chainů, symetrii, zrcadlení změny.
3. **Smell není důkaz chyby — je to pokyn podívat se znovu.** Každé pípnutí vysvětli a uveď,
   co by ho ospravedlnilo („volatility trumps all"). U komponent se stereotypem Generic
   System / Generic LISC se IDesign kritéria neaplikují (viz `banka-kontext.md`).
4. Metriky čti asymetricky: soulad s metrikou dobrý design nedokazuje; porušení špatný
   design dokazuje.

### Režim 4: Kontrakty a komunikace

1. Přečti `kontrakty-facety-dto.md`; při otázkách na fronty/bus i `messaging.md`;
   při podezření na anti-pattern `soa-anti-patterny.md`.
2. **Bankovní default (✅ D9): komponenta = jeden common + jeden proposed interface**
   (proposed kvůli zámkům, ne sémantice) — **facetování dle doktríny navrhuj JEN
   u exponovaných integračních komponent a jen jako rozhodnutí SARa.** Granularita
   operací je doména ITANa se supervizí SARa.
3. Kde facetování je na místě: reusable facety (optimum 3–5 operací, „tell don't ask");
   DTO properties-only; každé queued volání a každý bus musí zdůvodnit konkrétní volatilita
   („nothing is free").

### Režim 5: Podpora interview a zdůvodnění

Pro přípravu rozhovorů se stakeholdery a řetěz vize → objectives → mise čti
`interview-stakeholderu.md` a `vize-cile-mise.md`. Objectives jsou arbitr gold platingu —
každý blok architektury musí sloužit některému objective.

## Reference — mapa

| Soubor | Kdy číst |
|---|---|
| [index](references/idesign/index.md) | orientace v knihovně |
| `dekompozice-volatilita.md` | režim 1 vždy |
| `taxonomie-komponent.md` | režim 1; při nejasné roli komponenty |
| `pravidla-interakce.md` | režimy 2, 3; QA sekvencí |
| `validace-call-chains.md` | režim 2 vždy |
| `design-smells.md` | režim 3 vždy |
| `vize-cile-mise.md` | režimy 1, 5 |
| `interview-stakeholderu.md` | režim 5 |
| `kontrakty-facety-dto.md` | režim 4 |
| `soa-anti-patterny.md` | režimy 3, 4 při podezření |
| `messaging.md` | režim 4 při async otázkách |
| `checklisty.md` | závěr každého režimu; QA |
| `project-design.md` | jen na explicitní dotaz (mimo produkční scope) |
| `banka-kontext.md` | **vždy před závazným výrokem o bankovních artefaktech** |

## Terminologie (závazně pro výstupy)

- **operace** = operace na kontraktu (historicky v bance „služba").
- **SOA Service** (příp. **komponenta**) = jednotka dekompozice IDesign (Manager, Engine,
  ResourceAccess).
- Holé slovo **„služba" bez kvalifikátoru nepoužívej** — v bance je víceznačné. Zavedené
  názvy artefaktů systémové analýzy (realizace služby, LS) se nemění.

## Chování po aktivaci

Urči režim ze zadání a načti jen relevantní reference. Volatility a jejich verdikty vždy
předkládej člověku k rozhodnutí — identifikace volatilit je jediná část Metody, která není
mechanická, a „the fact that it wasn't difficult should be a red flag".
