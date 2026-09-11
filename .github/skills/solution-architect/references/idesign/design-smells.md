# Katalog design smells

Zdroj: díl 2 (Method Details, 11 pachů — seskupeno). **Smell není důkaz chyby — je to pokyn
podívat se znovu.** Většina smells ukazuje na téhož viníka: funkcionální dekompozici.
Asymetrie metrik: soulad nedokazuje kvalitu, porušení dokazuje problém.

## S1 — Počty

Nevhodný počet Managerů (příliš vysoký i nízký); mnoho Engines („Engines are somewhat
rare"). Kalibrace TradeMe: zralé řešení ~3,4 M / 3,8 E / 4,0 RA. Detekce: spočítej role,
srovnej; každý přebytek musí ospravedlnit konkrétní volatilita.

## S2 — Jména

- Manager, ResourceAccess = **podstatná jména**; Engine = **sloveso / slovesné podst.
  jméno**. Opak = funkcionální smell.
- **Vertikální trojice** Manager–Engine–ResourceAccess se stejným jménem = funkční silo:
  „you most likely have not captured the right volatility." (Dvojice M–RA se stejným
  kmenem může být v pořádku — prošetřit, zda RA sdílejí i jiní Manageři.)
- Manager pojmenovaný po kroku zadání nebo obrazovce = funkcionální/UI-centric recidiva.

## S3 — Fat Manager

Jeden Manager s více core use cases, mícháním subsystémů či nesouvisejícími kontrakty.
Detekce: „jsou to related use cases nad touž volatilitou workflow?" Ne → oddělit facety /
samostatné subsystémy. Hraniční případ: poznamenat „hlídat bobtnání" + připravit facety
pro InProc Promotion (viz [kontrakty-facety-dto](kontrakty-facety-dto.md)).

## S4 — Tvary call chainů

- **Fork** (vidlice): jeden uzel volá 5+ malých komponent — příliš malé služby, orchestrace
  stažená do jednoho místa. Silný indikátor.
- **Staircase** (schodiště): řetězení velkých komponent za sebou (s1→s2→s3→s4). Silný
  indikátor (Chain of Shame jako call chain). „Good decomposition is neither."
- **Glove** (rukavice): Manager mluví k mnoha engines/RA. Slabší indikátor — „the glove
  may be benign after all"; rozhoduje, zda granularitu ospravedlňuje volatilita
  („volatility trumps all").
- **Double back**: návrat k témuž uzlu těsně před koncem řetězu — jen orientační (čtení
  na začátku, zápis na konci je v pořádku).
- Dále: back-and-forth, cykly, přesuny big data, „one operation to rule them all",
  a estetické kritérium „it's just plain ugly".

## S5 — Asymetrie

„**Good architecture is symmetric**": call patterny se opakují napříč use casy; správná
dekompozice vypadá jako „stick figure" (klient – Manager – končetiny k engines a RA).
Každý use case s úplně jiným tvarem řetězu = podívat se znovu.

## S6 — Reflecting change

Nová funkcionalita → nová komponenta (nový Engine nahrazuje starý při nových use cases)
= design **zrcadlí** změnu místo aby ji **zadržoval**. Engines jsou pak definovány
funkcionalitou, ne volatilitou. Alternativní diagnóza: engines příliš jemné → „beef up".

## S7 — Kód v klientovi

Business logika, orchestrace nebo detail volání vytlačený do klienta — univerzální
diagnostika (Big Client). Viz i object-centric anti-pattern ([soa-anti-patterny](soa-anti-patterny.md)).

## S8 — Prefix/suffix smell (kontrakty)

Operace lišící se jen předponou/příponou (`ValidateMemberEntry`, `ValidateStaffEntry`, …)
= super-service míchá kontexty; segregovat („seemingly similar workflows are not").

## Postup smell-checku (review)

1. Projdi S1–S8 nad návrhem; každé pípnutí zapiš.
2. Ke každému pípnutí: buď oprava, nebo **explicitní zdůvodnění volatilitou** (a zapsat).
3. Závěrem test misí: každý blok slouží některému objective ([vize-cile-mise](vize-cile-mise.md)) —
   blok bez krytí = gold plating.

**Bankovní výjimka:** komponenty se stereotypem Generic System / Generic LISC vědomě
nesplňují IDesign kritéria — smell-check se na ně neaplikuje (viz [banka-kontext](banka-kontext.md)).
