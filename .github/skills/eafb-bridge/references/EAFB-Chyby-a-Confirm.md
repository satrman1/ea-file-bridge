# EAFB — chybové kódy a potvrzovací (confirm) tok

## Stav `confirm_required` — NENÍ chyba

Zápisové dávky prochází deterministickým **Risk Gate**. Podle rizika:

- **LOW** → provede se hned, dostaneš `EAFB OK …`.
- **ELEVATED** → dávka **čeká na lidské potvrzení**. Dostaneš `EAFB CEKA NA POTVRZENI <id> (…): …`. Znamená to: zápis zatím NEproběhl, dávka čeká, uživatel ji potvrdí (nebo zamítne) ve svém dialogu/okně.
  - **Co dělej:** počkej na finální ACK. **Nepřeposílej dávku, nic neopravuj, neduplikuj.** Když se ti chce něco udělat, zeptej se uživatele, ať dá vědět, až rozhodne.
  - **Vždy ELEVATED:** mazání (`delete_*`), klonování (`clone_*`), rebuild varianty, přepisy linked dokumentů. Potvrzovací dialog je u nich normální chod, ne známka chyby.
- **BLOCKED** → `EAFB BLOKOVANO <id>` / `E_RISK_BLOCKED`. Tvrdý stop, žádný override z tvé strany. Ohlas uživateli; cesta ven je jen změna politiky nebo ruční práce v EA (jeho věc).

**Potvrzení nikdy nepochází od tebe.** Nikdy nedávej do dávky `confirm`, `nonce`, `payloadHash` — EA takovou dávku odmítne (`E_RISK_CONFIRM`). V ACK vidíš jen `hash <prefix>…`; plný hash ani nonce neopisuj.

## Chybové kódy

| Kód | Význam a co s tím |
|---|---|
| `E_PARSE` | Nevalidní JSON / chybí `ops`. Oprav strukturu, pošli novou dávku s novým id. |
| `E_REPO` | Dávka pro jiný repozitář — nic se neprovedlo. Chat ACK **pojmenuje připojený repozitář** (basename) — oprav pole `repo` na tuto hodnotu a pošli dávku znovu (s novým id). |
| `E_OP_FORBIDDEN` | Operace není povolena whitelistem operací. Ohlas — neobcházej. |
| `E_WHITELIST` | Package mimo povolenou větev. Ohlas — neobcházej. |
| `E_RISK_BLOCKED` | Risk Gate BLOCKED (tvrdý stop). Ohlas uživateli. |
| `E_RISK_CONFIRM` | Potvrzovací pole v obsahu dávky (nikdy je tam nedávej) / neplatné potvrzení. |
| `E_RISK_REJECTED` | Uživatel dávku zamítl. Respektuj, zeptej se, jak dál. |
| `E_RISK_INTEGRITY` | Obsah dávky se změnil mezi klasifikací a potvrzením. Pošli novou dávku. |
| `E_AMBIGUOUS` | `match`/`dedupKey` našel víc kandidátů — ACK/response nese `guids`; adresuj konkrétní `guid`. |
| `E_ADDIN_ACCESS` | Uživatel nemá write přístup k bridge (EA security skupiny). Čtecí operace fungují; ohlas, ať požádá správce EA o zařazení do write skupiny — neobcházej. |
| `E_PERMISSION` | EA security nepustila zápis do cílového balíčku (balíčková práva uživatele, ne chyba bridge). Uživatel požádá správce o práva, nebo cílit jinam. |
| `E_LOCKED` | Cílový prvek/balíček je zamčený (EA locking) — počkat na uvolnění zámku. |
| `E_UNKNOWN_OP`, `E_ARGS` | Neznámá operace / chybí povinné argumenty. Oprav dávku. |
| `E_SQL_READONLY` | Jiný dotaz než SELECT/WITH. |
| `E_SQL` | Dotaz v EA selhal (neexistující sloupec/tabulka, syntaxe) — `message` = hláška EA (může chybět), `sql` = dotaz, `raw` = začátek odpovědi EA. Oprav dotaz (ověř sloupce), pošli znovu; EA k tomu otevřela modální dialog, který člověk odklikne. **Prázdný výsledek NENÍ `E_SQL`** — od v0.14 je to `ok`/`rowCount: 0` + warning. |
| `E_NOT_FOUND` | Cíl nenalezen — ověř GUID/jméno zpětným čtením. |
| `E_EXCEPTION`, `E_NO_EXECUTOR` | Neočekávaná chyba / bridge neběží. Ohlas uživateli. |

`E_QUOTA` se už nevydává (kvótu klonů kryje ELEVATED potvrzení).

## Retry a idempotence (shrnutí)

Dávka je **stop-on-error** bez rollbacku: položky vytvořené před chybou v modelu zůstaly. **Neposílej tutéž dávku slepě znovu** — vytvořil bys duplicity. Korektní oprava = dávka adresující GUIDy vytvořených položek přes `guid` → update, plus doplnění zbytku. **GUIDy máš přímo v chat ACK** — i chybová větev ACK nese GUIDy položek vzniklých před chybou; `res-*.json` je jen doložená výjimka (dump nad rozpočet, binární výstupy). Výjimka B3: u `create_or_update_constraints`/`requirements` položky GUIDy nemají — oprava = rebuild kompletní sady na element GUID. Výjimka (bezpečné přeposlat): položky s `matchByName:true` / `match:"composite"` / `dedupKey`, a zprávy s `rebuild:true` — druhý běh vrátí `created:false` + `matchedBy`.

## Op-level `warnings` — nepřehlédnout

Operace může skončit `status: ok` a přesto nést pole `warnings` (pole textů), např. `scenarios[1]: join 'BE95002' neni cislo kroku - Join nezapsan (End)`. Warning znamená: **část záměru se tiše nepropsala**, ačkoli dávka i počty vypadají v pořádku. Není to chyba (`status` zůstává `ok`) ani QC nález.

**Chat ACK warningy nese** (od protokolu v0.11) — počet a první warning jsou v prvním řádku, pod ním výpis po operacích:

```
EAFB OK 20260821-83: 6/6 ops | 1 WARNING: scenarios[1]: join 'BE95002' neni cislo kroku - Join nezapsan (End) | QC ciste (3 kontrol)
Warnings (zapis PROBEHL, cast zameru se ale nepropsala - resit OPRAVNOU davkou, ne preposlanim):
- op[4] create_or_update_scenarios: scenarios[1]: join 'BE95002' neni cislo kroku - Join nezapsan (End)
```

Je-li warningů víc, než se do ACK vejde, ACK to řekne ukazatelem (`dalsich N - plny vycet v res-<id>.json`) — **jen při tomto ukazateli** (doložená výjimka) si plný výčet vyžádej. Warning řeš **opravnou dávkou** dle jeho textu, ne přeposláním — GUIDy pro opravnou dávku jsou přímo v ACK (u B3 rebuild kompletní sady na element GUID).

## QC v ACK

ACK zápisové dávky může nést stav QC odděleně od stavu zápisu: `QC ciste` / `QC NALEZ …` / `QC nedobehlo …`. **Nález ani nedoběhnutí QC NENÍ chyba zápisu** — zápis proběhl. Nález řeš s uživatelem, dávku kvůli němu nepřeposílej.
