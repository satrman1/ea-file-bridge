# Kontrakty, facety, DTO, security

Zdroj: díl 3. Řídicí krédo: „Coupling is bad. Coupling is unavoidable. The real question
is how to wisely choose what to be coupled to."

## Contract factoring

- Cíl: každý kontrakt (rozhraní komponenty) = **znovupoužitelná, logicky kohezní faceta**.
  „When factoring contracts, think always in terms of reusable elements."
- „**Too small or too large is too specialized**" — U-křivka potřetí (na úrovni kontraktů).
- Špatně faktorovaný kontrakt poznáš podle operací, které jsou si navzájem cizí
  (IDog {Fetch, Bark, GetVetClinicNumber, Vaccinate} → vytkni IPet). Komponenta pak
  implementuje **více kontraktů** — „sum of work remains the same", ale facety jsou
  reusable.

### Metriky (asymetrické!)

- Optimum **3–5 operací** na kontrakt; strop 12 (starší materiály 20).
- Jednooperační kontrakt: možný, ale vyhýbat se (dull facet / příliš mnoho parametrů /
  příliš hrubá operace).
- Žádné operace připomínající properties — „**Tell don't ask**": jen `DoSomething()`.
- „Complying with metric does not mean good design. Violating them does."

### InProc Promotion (pojistka proti bobtnání)

Schopnost vytknout interní část na samostatnou hranici **beze změny záměru**: dnes jeden
Manager implementuje víc dobře faktorovaných kontraktů (collapsed), zítra každý kontrakt
žije jako samostatný Manager (expanded) — bez redesignu. Podmínka: kontrakty musely být
dobře faktorované od začátku. U každého Manageru s poznámkou „hlídat bobtnání" navrhni
facety a pojmenuj budoucí dělicí čáru.

## Datové kontrakty (DTO)

- Data mezi vrstvami **hodnotou**, nikdy referencí. Jen primitiva, pole primitiv, data
  contracts, pole data contracts (pravidlo 15).
- „Treat data contracts as DTOs… **Properties only!**" Žádné chování — „'Business Objects'
  break encapsulation". Fundament: „**Use cases 'own' the data**", ne objekty.
- Faktorizace DTO: kvalita je odvozená od kontraktů služeb. Ideál (unikátní DTO per operace)
  vs. pragmatika: **počet odlišných DTO řiď volatilitou use casu** — nízká volatilita →
  sdílení DTO je malé riziko; vysoká volatilita → unikátní DTO se mandatují.
- „**Never share with presentation layer**" — interní DTO nižších vrstev nikdy do
  prezentační vrstvy u volatilních use casů.
- Verzování: tolerantní deserializace; pro round-trip `IExtensibleDataObject` (obecně:
  neznámá data zachovat a vrátit).

## Trusted subsystem (security vzor)

- **Každá vrstva autentizuje svého bezprostředního volajícího** a věří, že on autentizoval
  své; autorizace rolemi. Identita koncového klienta se nepropaguje dolů:
  „The further from the client, the less relevant its identity."
- **Impersonace je relikt 90. let** — delegace otevírá „Pandora box of identities",
  brzdí škálování.
- Vyhrazené (designated) identity; minimalizace počtu identit.
- Auditní stopa = složení **lokálních auditů** vrstev, ne propagace identity.
- „**Performance is not a consideration — it costs to live.**" Výkon není argument proti
  zabezpečení.
- Transport security pro intranet, message security pro internet.
