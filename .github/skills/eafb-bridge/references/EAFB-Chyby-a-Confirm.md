# EAFB — chybové kódy a potvrzovací (confirm) tok

## Stav `confirm_required` — NENÍ chyba

Zápisové dávky prochází deterministickým **Risk Gate** (prahy a třídy operací ti řekne `ping` v `riskPolicy`). Podle rizika:

- **LOW** → provede se hned (`done`).
- **ELEVATED** → dávka **čeká na lidské potvrzení**: `status: "confirm_required"` (v chat ACK `EAFB CEKA NA POTVRZENI <id> (…): …`). Zápis zatím NEproběhl.
  - **Pumpa (VS Code):** potvrzuje se v **okně pumpy** (Ano / Ne / Storno), ne v EA. Okno zmizí po 5 minutách bez rozhodnutí — dávka dál čeká; když člověk řekne, že okno zmizelo, zapiš **tentýž soubor** (stejné jméno i obsah) znovu a pumpa okno nabídne znovu bez restartu. Stejné jméno s jiným obsahem = odpověď čekající dávky s varováním „DUPLICITA ID" — novou dávku pošli s novým id. Stejný obsah pod novým id = `E_DUPLICATE_ID` (`same-content-pending`) — čekej na rozhodnutí o první.
  - **Schránka (M365):** potvrzuje uživatel v dialogu EA; vloží ti finální ACK.
  - **Co dělej:** jednou větou řekni člověku, co čeká a kde (`res.since` říká od kdy), a **čekej bez časového limitu**. Nepřeposílej pod novým id, nic neopravuj, neduplikuj. Potřebuješ-li dávku opravit, řekni člověku, ať dá Ne, a pošli opravenou s novým id.
  - **Vždy ELEVATED:** mazání (`delete_*`), přesuny (`move_elements` — mezi balíčky i pod prvek; okno pak říká „PRESUNOUT N prvků pod jiný prvek ve stromu"), klonování (`clone_*`), rebuild scénářů / zpráv / constraintů / requirements, přepisy linked dokumentů, nový balíček přímo pod kořenem modelu, mazání s kaskádou do chráněné části. Okno je u nich normální chod, ne známka chyby.
  - **Naváděná cesta zálohy:** `confirm_required` s důvodem „bez pre-image…" = bridge zálohu pořídit nemůže; člověk pořídí v EA ruční baseline nad balíčkem cíle (nebo jeho předkem) a dávku potvrdí znovu — bez ní se neprovede.
  - **Druhé kolo:** když po potvrzení přijde znovu `confirm_required`, nese `confirm.round {why, no}`: `baseline-missing` (člověk potvrdil, ale ruční záloha stále chybí — nic se neprovedlo), `metrics-changed` (model se mezitím změnil) nebo `summary-mismatch` (souhrn v `res` neodpovídal modelu — **nikdy `res` neupravuj**, bridge ho před provedením ověřuje a okno ukáže pravdivý souhrn). Ve všech případech jen čekej; nic neposílej.
  - Čekající dávka starší než 8 hodin vyprší (`E_RISK_EXPIRED`, `rejected`) — je-li zápis stále potřeba, nová dávka s novým id.
- **BLOCKED** → `E_RISK_BLOCKED` (chat ACK `EAFB BLOKOVANO <id>`). Tvrdý stop, žádný override z tvé strany. Ohlas uživateli; cesta ven je jen změna politiky nebo ruční práce v EA (jeho věc).

**Potvrzení nikdy nepochází od tebe.** Nikdy nedávej do dávky `confirm`, `nonce`, `payloadHash` — bridge takovou dávku odmítne (`E_RISK_CONFIRM`). Plný hash ani nonce neopisuj.

## Chybové kódy

Chyby **dávky** (nic se neprovedlo, všechny operace `skipped`) vs. chyby **operace** (stop-on-error: operace před ní proběhly — `items`, `partial`).

| Kód | Význam a co s tím |
|---|---|
| `E_PARSE` | Nevalidní JSON / chybí `ops`. `message` říká **co a kde** (znak od 1, řádek:sloupec, 40 znaků okolí; `parse.position`) — typicky čárka navíc před `]` nebo `}`. Oprav strukturu, pošli novou dávku s novým id. |
| `E_REPO` | Deklarace `repo` nesedí na připojený repozitář — odpověď ho **pojmenuje**: oprav pole `repo` na tuto hodnotu a pošli dávku znovu s novým id (člověku jednou větou). Varianty: repozitář nemá položku v konfiguraci cíle zápisu (zápisy nejdou, ohlas správci); „EA má otevřený jiný projekt než při startu pumpy" → požádej člověka o restart pumpy. Nic se neprovedlo. |
| `E_UNKNOWN_OP` | Neznámá operace — `problems[]` nese `suggestions[]` nejbližších názvů. Oprav název, nové id. Je to chyba dávky, ne bridge. |
| `E_ARGS` | Chyba v dávce z předběžné kontroly: `problems[] {op, path, code, message}` vyjmenuje **všechny** problémy najednou (chybějící pole, prázdný seznam, zástupný text v identifikačním poli, GUID v neplatném tvaru, `$N` dopředu, cíl zadaný GUIDem v modelu neexistuje, `$N` na výsledek bez `guid` — „použij `$0[0]`", `taggedValues` mimo pole, krok scénáře bez `text`). **Oprav všechno z `problems[]` sám**, nové id. Žádné okno, žádná záloha. Odpověď může zároveň nést `warnings[]` kontroly polí (neznámá pole, aliasy) — oprav i ta. |
| `E_OP_FORBIDDEN` | Zápisová operace není v tomto prostředí povolena. Ohlas — neobcházej; co tím nejde, je ruční krok člověka v EA. |
| `E_ADDIN_ACCESS` | Uživatel nemá write přístup k bridge (EA security skupiny). Čtecí operace fungují; ohlas, ať požádá správce EA o zařazení do write skupiny — neobcházej. |
| `E_BLACKLIST` | Cíl zápisu leží v **chráněné části** (větev z blacklistu nebo její podstrom, balíček auditu, balíček add-inu, prvek vlastněný chráněným prvkem, kořen modelu jako cíl update), vazba s **oběma** konci v chráněné části, podstrom mazaného/klonovaného balíčku obsahující chráněnou větev, zdroj klonu, nebo kaskáda mazání při `cascadeDelete: "block"`. Odpověď nese `problems[]` s plnou cestou cíle a chráněnou větví (`branch`, `target`, u kaskád `cascade`). **Dávku neopakuj ani neděl — požádej člověka o jiný cíl.** |
| `E_SCOPE_CONFIG` | Vadná konfigurace cíle zápisu (`problems[]` říká co). Všechny zápisy v repozitáři stojí, čtení běží. Řekni člověku, co opravit — opravu dělá správce; nic nezkoušej. |
| `E_AMBIGUOUS` | Jméno, cesta nebo `match`/`dedupKey` odpovídá víc objektům — odpověď nese `guids[]` + `candidates[{guid, path}]`. Vyber kandidáta s člověkem a adresuj `guid` nebo cestu. |
| `E_NOT_FOUND` | Cíl nenalezen. U cesty nese `found` (nejhlubší nalezená úroveň) + `children[]`; jméno prvku založeného touto dávkou → odkazuj `$N`. Oprav odkaz podle nápovědy, případně ověř zpětným čtením. |
| `E_DUPLICATE_ID` | `duplicate.kind`: `same-id-final` = toto id už má konečný výsledek (starý `res` je v `responses\superseded\`); `same-content-pending` = tatáž dávka už čeká pod `duplicate.pendingId`. Řešení vždy: **nové id**, na výsledek navázat GUIDy, nikdy opakování téže dávky. |
| `E_INTERRUPTED` | Minulý běh této dávky byl přerušen uprostřed (zavřená pumpa / pád EA) — nic se neprovedlo, model může nést část zápisů. Zkontroluj s člověkem Output tab / model, pošli **opravnou** dávku s novým id. |
| `E_RISK_BLOCKED` | Risk Gate BLOCKED (tvrdý stop). Ohlas uživateli. Od v0.22 nese u prahu počtu balíčků **výčet dotčených balíčků** (tečkové cesty, max 10 + „a N dalších") — podle něj dávku rozděl po balíčcích, nepočítej je sám. |
| `E_RISK_CONFIRM` | Potvrzovací pole v obsahu dávky (nikdy je tam nedávej) / neplatné potvrzení. |
| `E_RISK_REJECTED` | Člověk dávku zamítl. **Neposílej ji znovu**; zeptej se, jak dál. |
| `E_RISK_EXPIRED` | Čekající dávka vypršela (8 h). Je-li zápis stále potřeba, nová dávka s novým id. |
| `E_RISK_INTEGRITY` | Obsah dávky se změnil mezi klasifikací a potvrzením. Pošli novou dávku. |
| `E_NO_BASELINE` | Destruktivní dávka, ke které bridge nemůže pořídit zálohu (a politika ji vyžaduje). Konečný stav — nic se neprovedlo. Řeší člověk: ruční baseline v EA nad balíčkem cíle, menší balíček, nebo správce. **Neřeš rozdělením dávky**; po ruční záloze nová dávka s novým id. |
| `E_PERMISSION` | EA security nepustila zápis do cílového balíčku (práva uživatele, ne chyba bridge). Položky před chybou proběhly (`items`, `partial: true`, včetně položky rozpracované v okamžiku výjimky; `stamped[]` = další prvky s razítkem dávky) — vyjmenuj je člověku, opravná dávka je adresuje GUIDem, nezakládá znovu; `removed` = kolik rebuild stihl smazat, `recovery` = věta o záloze. Práva řeší člověk / správce, nebo cílit jinam. |
| `E_LOCKED` | Cílový prvek/balíček je zamčený (EA locking). Totéž: řekni, co je zamčené a co proběhlo; zámek řeší člověk. (Vazby zámky nehlídají.) |
| `E_FILE` | Chyba souboru nebo složky (složka výměny, `responses\images`, práva, místo na disku) — **není** to EA security ani zámek. `message` nese původní hlášku. Ohlas člověku (složku/práva řeší on nebo správce); další zápisová dávka půjde oknem (pojistka po výjimce). |
| `E_DB_RETRY` | Dočasná chyba databáze (deadlock, timeout, spojení). Pošli dávku znovu s novým id; když se opakuje, ohlas správci databáze. Položky před chybou proběhly (`items`, `partial`). |
| `E_SQL_READONLY` | Jiný dotaz než SELECT/WITH, nebo `;` (druhý příkaz) / `INTO` mimo řetězcový literál. Dotaz se nespustil. |
| `E_SQL_UNBOUNDED` | Dotaz bez `TOP`/`LIMIT`/`WHERE` nad velkou tabulkou (`message` ji jmenuje, `tables[]`) — **nespustil se**, EA by sestavovalo celý výsledek (v bance miliony řádků = pumpa stojí minuty). Přidej `TOP N`/`LIMIT N` nebo selektivní `WHERE` (filtr po ID, ne po jméně na joinu); `maxRows` to neřeší — ořezává jen odpověď. |
| `E_SQL` | Dotaz v EA selhal (neexistující sloupec/tabulka, syntaxe) — `message` = hláška EA (může chybět), `sql` = dotaz, `raw` = začátek odpovědi EA. Oprav dotaz (ověř sloupce), pošli znovu; EA k tomu otevřela modální dialog, který člověk odklikne. **Prázdný výsledek NENÍ `E_SQL`** — je to `ok`/`rowCount: 0` + warning. |
| `E_EXCEPTION` | Neočekávaná výjimka v EA/COM — **není to chyba tvé dávky**. Ohlas člověku, ať zkontroluje Output tab; další zápisová dávka půjde oknem (pojistka po pádu). Výjimka s textem „EA nezapsal vlastnika" = přesun pod prvek se nepropsal, prvek zůstal, kde byl. (Do v0.21 sem padaly i `Invalid type` u brány sekvence a `DiagramObject.Update() selhal` u prvku už umístěného na diagramu — od v0.22 jsou obě cesty funkční.) |
| `E_NO_EXECUTOR` | V modelu chybí kód bridge. Ohlas uživateli (správce). |

## Retry a idempotence (shrnutí)

Dávka je **stop-on-error** bez rollbacku: položky vytvořené před chybou v modelu zůstaly — odpověď je vyjmenuje (`items`, `partial: true`; chybová větev chat ACK nese GUIDy položek vzniklých před chybou). **Neposílej tutéž dávku slepě znovu** — vytvořil bys duplicity. Korektní oprava = dávka adresující GUIDy vytvořených položek přes `guid` → update, plus doplnění zbytku. Výjimka B3: u `create_or_update_constraints`/`requirements` položky GUIDy nemají — oprava = rebuild kompletní sady na element GUID. Výjimka (bezpečné přeposlat): položky s `matchByName:true` / `match:"composite"` / `dedupKey`, a zprávy s `rebuild:true` — druhý běh vrátí `created:false` + `matchedBy`. Čtecí dávky se smějí opakovat beze změny.

## Warningy — nepřehlédnout

Operace může skončit `status: ok` a přesto nést pole `warnings` (pole textů), např. `scenarios[1]: join 'BE95002' neni cislo kroku - Join nezapsan (End)`. Takový warning znamená: **část záměru se tiše nepropsala**, ačkoli dávka i počty vypadají v pořádku. Totéž platí pro warningy **kontroly polí** na úrovni dávky (`ops[0].elements[0]: nezname pole 'sterotypes' (myslel jsi 'stereotypes'?) - pole se neprovede`, `pole 'stereotype' prijato jako 'stereotypes'`) a pro `query` (`vysledek oriznut: dotaz vratil 600 radku, v odpovedi je prvnich 500` — `rowCount` je pravý počet, zuž dotaz; `dotaz bez omezeni` — přidej `TOP`/`WHERE`). Není to chyba (`status` zůstává `ok`) ani QC nález — řeš ho **opravnou dávkou** dle jeho textu, ne přeposláním (u B3 rebuild kompletní sady na element GUID). **Provozní varování** (záloha, úklid baselines, chybějící sekce politiky, „EA nerozlišuje 0 řádků od chybného dotazu", vypnutá security, kaskáda mazání) nic neopravují — jen je ohlas.

**Chat ACK warningy nese** — počet a první warning jsou v prvním řádku, pod ním výpis po operacích:

```
EAFB OK 20260821-83: 6/6 ops | 1 WARNING: scenarios[1]: join 'BE95002' neni cislo kroku - Join nezapsan (End) | QC ciste (3 kontrol)
Warnings (zapis PROBEHL, cast zameru se ale nepropsala - resit OPRAVNOU davkou, ne preposlanim):
- op[4] create_or_update_scenarios: scenarios[1]: join 'BE95002' neni cislo kroku - Join nezapsan (End)
```

Je-li warningů víc, než se do ACK vejde, ACK to řekne ukazatelem (`dalsich N - plny vycet v res-<id>.json`) — **jen při tomto ukazateli** si plný výčet vyžádej.

## QC v odpovědi

Odpověď zápisové dávky může nést stav QC odděleně od stavu zápisu (chat ACK: `QC ciste` / `QC NALEZ …` / `QC nedobehlo …`). **Nález ani nedoběhnutí QC NENÍ chyba zápisu** — zápis proběhl. Nález řeš s uživatelem, dávku kvůli němu nepřeposílej.
