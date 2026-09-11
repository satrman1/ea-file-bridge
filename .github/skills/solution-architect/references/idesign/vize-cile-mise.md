# Vize → objectives → mise

Zdroj: díl 2. Zdůvodňovací páteř architektury: vize říká *proč*, objectives *co byznys
získá*, mise *jak* — architektura pak misi jen naplňuje. Efekt: „you just made the business
guys **instruct you** to design the right architecture."

## Vize

- První krok: **všichni stakeholdeři se shodnou na společné vizi** (jedna věta).
- „The vision must drive everything, from architecture to commitments." Co vizi neslouží,
  lze od té chvíle odmítat: „But we all agreed on the vision!"
- Vzor (TradeMe): „A platform for building application to support the TradeMe marketplace."

## Objectives

- Itemizují se až po shodě na vizi. Perspektiva **výhradně byznysová** — žádné technologie,
  žádné konkrétní požadavky. „Avoid the geeks or Marketing owning the conversation."
- Typický počet: 5–7. Vzorové kategorie (TradeMe): rozbití sil, rychlý obrat features,
  customizace napříč trhy, byznysová viditelnost a audit, forward-looking postoj,
  integrace externích systémů, bezpečnost.
- Cena/ROI/TCO mezi objectives být nemusí — a správná architektura přesto bývá nejlevnější
  (U-křivka).

## Mise (mission statement)

- Jedna věta o **stavění bloků, ne features**: „Design and build a collection of software
  blocks Engineering can assemble into applications and features."
- Je to obrana architektury proti tlaku na user stories a funkcionální dekompozici —
  manažerský protějšek maximy „features = produkt integrace".

## Dvojí kontrolní funkce (používej aktivně)

1. **Směrem k dekompozici:** každá zapouzdřená volatilita má krýt některý objective —
   dekompozice slouží misi, a proto je obhajitelná.
2. **Směrem ke gold platingu:** blok architektury, který neslouží žádnému objective,
   letí ven. **Objectives jsou arbitr doložené potřeby** — rozhodčí ve sporu
   „designuj pro budoucnost" vs. „nepozlacuj".

Stejný test aplikuj na operační koncepty: workflow manager, message bus i každé queued
volání se zdůvodňují objectives, ne technickým vkusem („nothing is free").

## Postup pro AI

Při návrhu vždy zkonstruuj řetěz explicitně (vize 1 věta → objectives 5–7 byznysových →
mise 1 věta o blocích) a předlož ho člověku ke schválení **před** dekompozicí. Při review
hotového návrhu si řetěz vyžádej; chybí-li, je to nález — architektura bez zdůvodnění
je neobhajitelná, i kdyby byla technicky správně.
