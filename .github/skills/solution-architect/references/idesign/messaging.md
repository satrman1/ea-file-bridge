# Fronty, message bus, The Message Is The Application

Zdroj: díl 3. Žebřík asynchronní komunikace: fronta → pub/sub → bus → The Message Is The
Application. **Každou příčku musí zdůvodnit konkrétní volatilita nebo objective** —
„Nothing is free, so you must justify every design decision you make." Nasazení bez krytí
= „design copycat", messagingová obdoba gold platingu.

## Queued volání — čtyři legitimní důvody

1. **Availability** — strany mohou být odpojeny, práce se přesto zadá.
2. **Disjoint work** — „must be done, but doesn't have to be done now or in order".
3. **Kompenzační práce** — úklid po neúspěšných scénářích.
4. **Load leveling** — fronta bufferuje špičky; systém se dimenzuje na průměr, ne špičku.

Pravidla a disciplína:

- Queued jen **Manager → Manager** (Law of 0,1: vždy týž jeden cíl); **nikdy na Engines
  ani ResourceAccess** (pravidla 6, 7).
- Všechny operace one-way; queued služba nevrací hodnoty ani chyby. Potřebuje-li klient
  výsledek → **response service** (adresa + ID v hlavičkách) — jen kde ji use case žádá,
  „be pragmatic".
- „**disconnected != lengthy**" — queued zpracování se drží krátké.
- Fronta ≠ async awaitka: mění transakční topologii (tři transakce: client → delivery →
  playback s auto-retry); oddělené commity mohou vyžadovat kompenzační logiku.
- **Deferred messaging / self-timing**: Manager smí postovat příkazy sám sobě s odloženým
  doručením (timeouty, připomínky) — lepší než timer v kódu, protože neví, kdo další má
  o stav zájem.

## Message bus

Demystifikace: „**merely a queued pub/sub**" — N:M, asynchronní, garantované doručení,
auto-retry; offline odběratelé mají privátní fronty.

**Operační kritéria pro nasazení busu** (musí platit několik, ne jedno):

| Kritérium | Otázka |
|---|---|
| timeline separation plošně | musí platit „nothing blocks anything else"? |
| multiplicita klientů | účastní se jednoho use case více souběžných klientů/systémů? |
| zdroj a konzument nikdy přímo | vyžaduje to deployment volatilita? |
| vysoká propustnost | publikuje se mnohem víc, než jeden odběratel čte (P >> q)? |
| The Message Is The Application | kryjí to objectives? |

Nesplňuje-li systém kritéria, stačí mu jednotlivé fronty + pub/sub utilita pro notifikace
(publikují jen Manageři — „there are no gremlins").

## The Message Is The Application

Krajní vzor: aplikace není nikde — služby jsou transformační funkce nad putující zprávou;
publikující služba neví, koho spustila. Nejčistší naplnění „features = produkt integrace":
při změně chování se nemění ani integrace. Cena: komplexita, deployment, security,
spletitá selhání. Verdikt doktríny: **ve většině případů je lepší jednodušší design**;
vzor jen „when you can invest in a platform", s podporou organizace a krytím objectives.

## Změna transportu nemění jádro

Jádro Manager/Engine/ResourceAccess je invariantní vůči generacím transportu a hostingu —
mění se volatilní obal. Návrh, kterému změna transportu rozbije dekompozici, byl špatně.
