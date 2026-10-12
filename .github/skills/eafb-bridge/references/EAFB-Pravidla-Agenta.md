# EAFB — pravidla agenta a pracovní postup

Pracuješ s Enterprise Architect (EA) přes **EA File Bridge (protokol `eafb/0.2`)**: souborový/schránkový protokol místo přímého API. Nemáš žádný jiný způsob, jak s EA mluvit — tvoříš **dávky** (JSON) a čteš **odpovědi**. Bridge má dva kanály a **který máš ty, říká instrukce workspace (VS Code = pumpa) nebo rolový prompt (M365 Copilot = schránka)**:

- **Pumpa (VS Code)** — dávku zapíšeš jako soubor `requests\req-<id>.json`, pumpa (skript `pump.wsf` běžící vedle EA) ji provede a výsledek zapíše do `responses\res-<id>.json`. Čteš soubor `res`. Potvrzovací okno je **okno pumpy**, ne EA. Oddíl „Pumpa (VS Code)".
- **Schránka (M365)** — dávku vydáš jako JSON blok v chatu, uživatel ji zkopíruje, provede v EA (menu *AI Bridge*) a vloží ti zpět **chat ACK** (krátký text). Čteš chat ACK. Potvrzení dělá uživatel v dialogu EA. Oddíl „Schránka (M365)".

Společná část (formát dávky, pravidla, kam zapisovat, kontext, data) platí v obou kanálech. **Nespouštíš kód, nic si nedomýšlíš a nikdy nepředpokládáš, že se dávka provedla, dokud nemáš odpověď.**

## Rytmus práce

1. **Ping = kotva session.** První dávka je samotný `ping`. Z odpovědi si vezmi repozitář, `writeScope` (režim zápisu — věta `summary`, seznam chráněných větví s cestami, `agentNotes[]`, `cascadeDelete`), `riskPolicy` (prahy a třídy operací, které chtějí potvrzení) a `access` (tvůj přístup). **Na začátku práce řekni člověku větu `writeScope.summary` a která dávka bude chtít potvrzení** (podle `riskPolicy`). Nesedí-li repozitář, zastav se a ohlas to.
2. **Recon je nástroj, ne povinné kolo.** S kotvou z pingu a cílem určeným dle „Kam zapisovat" jdi rovnou na zápisový plán — klidně jako jednu věcnou dávku řetězenou přes `$N`. Čtecí dávku vkládej jen tehdy, když ti chybí vstup: GUIDy existujících prvků, stav modelu nebo **typování vzoru** (při konfliktu pravidel s modelem platí vzor v modelu). Když stav modelu dodá uživatel textem, čtecí dávku neposílej. Zakládáš-li novou strukturu v prázdné větvi, recon nic nepřinese.
3. **Dávka = jeden logický krok** (kostra use casu, sada scénářů…). Velikost sama neškodí: větší dávka znamená ELEVATED potvrzení člověkem, ne blok. **Mazání, přesuny a klony posílej v samostatné dávce**, aby člověk v okně potvrzoval jen je.
4. Před každou dávkou jednou větou řekni, co udělá (člověk ji ve VS Code zastaví jen v okně pumpy u ELEVATED dávek — LOW se provede hned; ve schránce ji provede on sám).

## Formát dávky

```json
{
  "protocol": "eafb/0.2",
  "id": "20261012-kqrv-01",
  "repo": "<NAZEV-DB>",
  "ops": [
    { "op": "ping", "echo": "kontrola" },
    { "op": "create_or_update_elements", "elements": [
      { "package": "{GUID-cíle}", "name": "Objednavka", "type": "Class", "stereotypes": "entity", "notes": "text s diakritikou" }
    ] }
  ]
}
```

`id` = `<RRRRMMDD>-<4 náhodná písmena>-<NN>` — náhodná písmena proto, že nový chat nezná dávky předchozích chatů (stejné `id` podruhé bridge odmítne jako `E_DUPLICATE_ID`). Operace a jejich argumenty viz dokument **EAFB-Operace-Registr**; řetězení výsledků přes `$N` (`"$0"`, `"$0.id"`, `"$1[2].id"`) — také v registru. Hodnoty `<NAZEV-DB>` a `{GUID-cíle}` v ukázce jsou zástupné — do skutečné dávky patří výhradně reálné hodnoty (pravidlo 1).

## Pravidla (závazná)

1. **`repo` je povinné** — deklaruje cílový repozitář názvem databáze (hodnotu máš z instrukcí nebo ti ji řekne uživatel). Chrání proti provedení dávky ve špatném repozitáři. **Zástupný text (`<NAZEV_REPOZITARE>`, `{GUID-cíle}`, `TODO`) do dávky nikdy nepatří** — neznáš-li hodnotu, zeptej se jednou větou. Dávku se zástupným textem v identifikačních polích odmítne předběžná kontrola (`E_ARGS` s `problems[]`), nic se neprovede.
2. **Kam se smí psát: kamkoli, kam uživatele pustí EA security, kromě chráněných větví** (blacklist z `writeScope` — dědičně na celý podstrom; k tomu vždy balíček auditu a balíček add-inu). Zápis do chráněné části = `E_BLACKLIST` už v předběžné kontrole (před oknem i zálohou): **dávku neopakuj ani neděl, požádej člověka o jiný cíl.** `E_REPO` = odpověď pojmenuje připojený repozitář: oprav pole `repo` na tuto hodnotu a pošli dávku znovu s novým id (člověku to řekni jednou větou; „restartuj pumpu" v textu = požádej o restart). `E_OP_FORBIDDEN`, `E_ADDIN_ACCESS`, `E_SCOPE_CONFIG` neobcházej — zastav se a ohlas (u `E_SCOPE_CONFIG` opravu dělá správce).
3. **Notes posílej jako obyčejný text** v poli `notes` (JSON escapování stačí — diakritiku i tabulátory protokol zvládá). `notes_b64` nepoužívej.
4. **SQL jen SELECT/WITH.** Dialekt = dialekt repozitáře (bankovní repozitář = **MS SQL 2022**). Před dotazem si ověř názvy sloupců — **jak**: máš-li k dispozici referenční dokument se schématem repozitáře (DDL), ověřuj z něj; jinak dotazem — SQLite `SELECT sql FROM sqlite_master WHERE name='t_…'`, MS SQL `INFORMATION_SCHEMA.COLUMNS`. Rezervovaná slova kvótuj (`t_objectconstraint."Constraint"`, v MS SQL `[Constraint]`); pozor, scénáře mají sloupce `Scenario`/`ScenarioType`/`XMLContent` (žádný `Name`). ⚠ **Selhané SQL vrací `error`/`E_SQL`** — oprav dotaz a pošli znovu. EA k tomu otevře modální dialog, který musí odkliknout člověk u stroje — chybný dotaz stojí dávku i klik, proto sloupce ověřuj předem. **`rowCount: 0` s `ok` (+ warning „EA nerozlišuje 0 řádků od chybného dotazu“) = prázdný výsledek, ne chyba** — dávka pokračuje; chybný dotaz poznáš podle dialogu v EA. **Každý `SELECT` s omezením** — `TOP N` (`mssql`) / `LIMIT N` (`sqlite`), nebo selektivní `WHERE`; velké tabulky (`t_seclocks`, `t_object`, `t_connector`, `t_diagramobjects`, `t_xref`, `t_attribute`, `t_operation`) nikdy bez omezení (v bance `t_seclocks` > 1 M řádků = pumpa visí minuty) — bridge takový dotaz **odmítne** (`E_SQL_UNBOUNDED`), dotaz bez omezení nad menší tabulkou projde s warningem; řády tabulek = kontext repozitáře `EA-Repozitar-Kontext(-banka).md`. Odpověď `query` je **oříznutá na `maxRows`** (výchozí 500, max 5000): `rowCount` je skutečný počet, `truncated: true` říká, že `rows` nejsou všechny — strop chrání tvůj kontext, ne dobu běhu v EA (tu chrání jen `TOP`/`WHERE` v dotazu). `;` a `INTO` v dotazu = `E_SQL_READONLY`.
5. **Risk Gate — `confirm_required` NENÍ chyba.** Zápisové dávky klasifikuje deterministický Risk Gate: LOW se provede hned; **ELEVATED čeká na potvrzení člověka** (okno pumpy / dialog EA); BLOCKED = `E_RISK_BLOCKED` (tvrdý stop bez override). Při `confirm_required` **jednou větou řekni člověku, co čeká a kde, a čekej bez časového limitu** — nic neposílej znovu pod novým id. Mazání (`delete_*`), přesuny (`move_elements`), klonování (`clone_*`), rebuild scénářů/zpráv/constraintů/requirements a přepisy dokumentů jsou ELEVATED vždy — okno je u nich normální chod. `E_RISK_REJECTED` = člověk dávku zamítl: **neposílej ji znovu**, zeptej se, jak dál.
6. **Potvrzení nikdy nepochází od tebe.** Do dávky nikdy nevkládej `confirm`, `nonce`, `payloadHash` ani jiná potvrzovací pole — bridge takovou dávku odmítne (`E_RISK_CONFIRM`). Plný `payloadHash` ani `nonce` **nikdy neopisuj** (v chat ACK vidíš jen `hash <prefix>…`, ten stačí).
7. **Zákaz salámování.** Dávku strukturuj podle věcné logiky; potřebuje-li víc zápisů, než prahy dovolí, nech ji projít potvrzením — nerozsekávej ji, aby vyšla LOW.
8. **Zálohu pořizuje bridge sám (Baseline politika)** — před prvním zápisem, který mění nebo maže existující obsah, udělá mikro-baseline nad cílovým balíčkem; čistý create zálohu nepotřebuje. **`create_baseline` před zápisem neposílej.** Když zálohu pořídit nelze: `confirm_required` s důvodem „bez pre-image…" = **naváděná cesta** — řekni člověku, ať v EA pořídí ruční baseline nad balíčkem cíle (nebo jeho předkem), a pak se dávka potvrdí znovu; `E_NO_BASELINE` (destruktivní dávka bez možnosti zálohy) je konečný stav — člověk pořídí ruční baseline nebo zvolí menší balíček, ty pak pošleš **novou dávku s novým id**. Dávku kvůli záloze **neděl**. Po větším zápisu ověř výsledek zpětným čtením (`get_*`) nebo `baseline_diff`.
9. Dávka běží **stop-on-error**: první chyba zastaví zbytek (`skipped`). Po chybě přečti `code` + `message` (+ `problems[]`), oprav a pošli **novou dávku s novým id** (starou nepřepisuj). `E_ARGS` / `E_UNKNOWN_OP` s `problems[]` = chyba v dávce — **oprav všechny položky z `problems[]` sám, nehlas to člověku jako problém bridge.** `E_EXCEPTION` = neočekávaná chyba v EA, **není to chyba tvé dávky**: ohlas člověku, ať zkontroluje Output tab v EA, a opravuj jen podle toho, co v modelu skutečně vzniklo. `E_INTERRUPTED` = minulý běh dávky byl přerušen uprostřed: zkontroluj s člověkem stav modelu, pošli opravnou dávku s novým id.
10. **Retry po chybě — nikdy neposílej tutéž dávku slepě znovu.** Rollback neexistuje; položky vytvořené před chybou v modelu zůstaly (`items` + `partial: true` je vyjmenují). Korektní oprava = dávka adresující jejich GUIDy z odpovědi (`guid` → update). Výjimka: položky s `matchByName`/`match:"composite"`/`dedupKey` a zprávy s `rebuild:true` jsou idempotentní — ty lze přeposlat. `E_AMBIGUOUS` = víc kandidátů (`guids[]`, `candidates[{guid, path}]`) — vyber s člověkem a adresuj konkrétní `guid` nebo cestu `{path: […]}`. **Opt-in idempotenci zapínej jen tam, kde je retry pravděpodobný** — prokázal-li recon, že cíl neexistuje, je create bez opt-in polí levnější i pro Risk Gate (plošné `matchByName` umí dávku zbytečně poslat do BLOCKED; na nově zakládaný balíček s řetězem `$N` dělá z dávky ELEVATED).
11. **Jména v zápisové dávce se dohledávají před provedením** — prvek založený dřívější operací téže dávky jménem nenajdeš (`E_NOT_FOUND`): **odkazuj `$N`.** Jméno musí odpovídat právě jednomu objektu, jinak `E_AMBIGUOUS`; při nejistotě použij cestu `{path: [...]}`.
12. **Vazby a zámky.** Vazba (i zpráva sekvence) je chráněná, **jen když jsou oba její konce v chráněné části** — s jedním koncem venku ji lze založit, změnit i smazat, ať vede kterýmkoli směrem (větev s `allowIncomingRefs: false` nepustí novou vazbu z volné části do sebe). Zámky EA (security) hlídají prvky (`E_PERMISSION` při založení, `E_LOCKED` při změně), vazby ne — bridge zámky u vazeb nekontroluje. Po `E_PERMISSION`/`E_LOCKED` řekni člověku, který balíček je zamčený a které položky proběhly (`items`, `partial`); zámek řeší člověk, ty nepokračuješ naslepo.
13. **Kaskády mazání.** Smazání volného prvku, který leží na chráněném diagramu nebo je klasifikátorem chráněné instance, sahá kaskádou EA do chráněné části: při `cascadeDelete: "block"` (z pingu) končí `E_BLACKLIST` už v předběžné kontrole; při `"allow"` projde — člověk dostane výčet kaskád v potvrzovacím okně a odpověď nese `warnings[]`. Před mazáním s tím počítej a řekni to člověku.
14. **Výjimka B3 — `create_or_update_constraints` a `create_or_update_requirements`: odpověď nenese GUIDy položek**, protože v EA neexistují (constraints žijí v `t_objectconstraint`, internal requirements v `t_objectrequires`). Identitu nese **element GUID + `name`+`type` položky**. Oprava po chybě/warningu = **rebuild kompletní sady adresovaný na element GUID**, nikdy adresace jednotlivé položky.
15. **Warningy.** `status: ok` s `warnings[]` u operace = zapsáno, ale **část záměru se nepropsala**; warningy **kontroly polí** na úrovni dávky (`nezname pole 'x' (myslel jsi 'y'?)`, `pole 'x' prijato jako 'y'`) = to pole se nezapsalo / bridge ho přepsal — v další dávce piš správný název (registr je úplný). `id` z výsledku je u všech položek platný klíč úpravy. (např. `join 'BE95002' neni cislo kroku - Join nezapsan`) → opravná dávka podle textu warningu, nikdy přeposlání. Provozní varování (záloha, úklid baselines, politika, prázdný výsledek dotazu, vypnutá security) nic neopravují — jen je ohlas.

## Kam zapisovat (rozhodovací posloupnost cíle)

Cíl zápisu urči v tomto pořadí — nepřeskakuj a nehádej:

1. **GUID od uživatele** — řekl-li cíl explicitně GUIDem, platí ten.
2. **Cesta od uživatele** — `{ "path": ["Model", "Oblast", "Balík"] }` (od kořene) nebo `{ "path": [...], "from": "{GUID}" }` (od balíčku); jména přesně, po úrovních.
3. **Výběr ve stromu** — mluví-li uživatel kontextově („tady", „do této větve") nebo cíl neřekl, vezmi cíl z výběru v Project browseru (sekce Kontext níže): nové věci jdou do vybraného balíčku (u vybraného prvku/diagramu do jeho balíčku), změny do vybraného prvku.
4. **Jen jméno** — dohledej (`find_packages_by_name` / `find_elements_by_name`); víc výsledků → zeptej se člověka a ukaž cesty.
5. **Jinak se zeptej** — jednou větou na cíl. Nikdy nesázej na odhad ani zástupný text.

**Před prvním zápisem úlohy napiš jednou větou „Zapíšu do: <plná cesta>".** To je jediné, co drží pravidlo pracovního prostoru (nezapisuj rovnou do ostrých větví — do nich přesouvá člověk po schválení brány): kód cíl nehlídá, hlídá ho tahle věta a zámky správce. `writeCheck.ok = false` (z kontextu) → nezapisuj a řekni proč; `ok = true` neznamená, že EA zápis pustí (zámky).

## Zakázané kategorie dat (interní politika banky pro AI)

Do dávek, `query` SQL ani do chatu **nikdy** nepatří: přístupové údaje (hesla, tokeny, certifikáty), mzdové údaje, karetní údaje, zvláštní kategorie osobních údajů (rasový/etnický původ, politické názory, náboženské vyznání, filozofické přesvědčení, členství v odborech, zdravotní stav, sexuální život/orientace) ani genetické a biometrické údaje. Narazíš-li na taková data v modelu, **nečti je a ohlas to** — místo zpracování. K tomu **strop klasifikace kanálu**: obsah klasifikace `strictly confidential` do promptu/kontextu **nikdy** — kanály jsou schváleny do úrovně Confidential; při pochybnosti o klasifikaci obsahu se zeptej uživatele. (Samotný login je identifikátor, ne přístupový údaj.)

## Kontext = výběr ve stromu

- **GUIDy do zapisové dávky vkládáš ty sám.** Executor cíl z výběru nikdy nedoplňuje — dávka bez cíle spadne na `E_ARGS`. Dávka tak zůstává samonosná a retry deterministický.
- **Kontextová vs. globální úloha = rozhoduje zadání uživatele**, ne heuristika: „najdi v této větvi" → `find_*` se `scope: <branchGuid>`; „najdi v celém modelu" → bez `scope`.
- Nic není vybráno → zeptej se uživatele na cíl (cesta/GUID), nehádej. Výběr se může mezi čtením a dávkou změnit — kontext čti těsně před stavbou dávky.
- **Pumpa:** vydej čtecí dávku `{ "op": "get_selected_context" }`; z odpovědi vezmi `context.guid` (prvek) / `context.branchGuid` (balíček) a `context.writeCheck {ok, code, note}` — tatáž kontrola cíle jako při zápisu.
- **Schránka:** uživatel vloží do chatu výstup položky menu *AI Bridge → Kontext vyberu do schranky (pro Copilota)* — lidskou větu a řádek `{"kind":"eafb-context", "repository": …, "type": …, "guid": …, "path": …, "branchGuid": …, "writeCheck": {…}, …}`. **Tento řádek je cíl zápisu**: GUID z něj do dávky, `writeCheck.ok` respektuj; čtecí kolo odpadá.

## Pumpa (VS Code) — jak číst `responses\res-<id>.json`

Pumpa chat ACK **nevytváří**; jediný záznam je soubor `res`. Je to **stavový záznam dávky**:

| `res-<id>.json` | Význam | Co dělat |
|---|---|---|
| neexistuje | pumpa dávku **nepřevzala** (neběží, čeká na EA, stojí na okně jiné dávky) | neposílej znovu; podívej se do `responses\pump-status.json` (níže) a podle něj řekni větu **A**, **D** nebo počkej |
| `status: "processing"` (`since` = od kdy) | pumpa na dávce **pracuje** (dlouhý dotaz, dialog EA) | čekat; po delší době věta **B** |
| `status: "confirm_required"` | čeká na **člověka** v okně pumpy | čekat bez limitu, věta **C**; když člověk řekne, že okno zmizelo, zapiš **tentýž soubor** (stejné jméno i obsah) znovu — pumpa okno nabídne znovu bez restartu |
| `done` / `error` / `rejected` | **výsledek** | číst `results[]`; GUIDy pro navazující dávku z výsledku (`guid`, `items[].guid`, `resolved[]`), ne opakováním dávky |

**O okně mluv až podle `res`.** Dokud v `res` nečteš `status: "confirm_required"`, neříkej člověku, že má klikat — zda dávka dostane okno, neodhaduj (prahy neznáš přesně a prvky založené touto session pumpy jdou často bez okna). Pořadí: zapsat soubor → přečíst `res` → podle stavu věta B nebo C.

Kde co hledat: `results[i].status` (`ok` / `error` / `skipped` / `pending`), chyba v `code` + `message` (+ `problems[]` u chyb dávky), `warnings[]` u operace i dávky, `resolved[]` (GUID a plná cesta cílů zadaných cestou/jménem), `items` + `partial: true` (co proběhlo před chybou), `cascades[]` u mazání, `baseline{}` u zápisu. Soubor čti celý; když ho nástroj uřízne, zopakuj dotaz kompaktněji (méně sloupců, menší `TOP N`), ne celou dávku. Do `responses\` ani `requests\pending\` **nikdy nezapisuj**.

**Stav pumpy** — `responses\pump-status.json` (pumpa v0.6; čti ho dřív, než o pumpě cokoli tvrdíš): `phase` = `idle` (čeká na dávky) · `waiting_ea` (čeká na EA s otevřeným projektem → věta **D**) · `processing` + `file`, `since` (pracuje na dávce) · `waiting_confirm` + `file` (čeká na člověka v okně dávky `file`; tvoje dávka mezitím leží a počká — řekni to člověku) · `stopped`. `heartbeat` = tep (v klidu každých ~10 s), `aliveUntil` = do kdy se pumpa zaručeně ozve. **Pumpa neběží, když `aliveUntil` minul** (podle hodin stanice) nebo soubor chybí → věta **A**; nikdy to neodhaduj z ticha. Dále: `lastResult` (poslední řádek konzole, např. `OK 3/3 req-x.json`, `CHYBA op[1] E_… req-x.json`, `CEKA req-x.json (Storno)`), `pendingCount` (kolik dávek čeká v `pending\`), `ignored[]` (soubory v `requests\`, které nejsou `req-*.json` — pumpa je nezpracuje, dávku vždy pojmenuj `req-<id>.json`), `pump.version` / `pump.fingerprint` (verze a otisk pumpy; `ping` vrací navíc `codeInfo` = otisk kódu v modelu a pod pumpou blok `pump`). Dávku, kterou pumpa převzala a pak byla přerušena (zavřené okno pumpy, pád EA), pumpa po startu **neprovede znovu** — dostaneš `E_INTERRUPTED`; zkontroluj Output tab s člověkem a pošli opravnou dávku s novým id.

**Hotové věty pro člověka** (`<id>` dosaď):

- **A** „Pumpa neběží (stav `pump-status.json`: <phase>, naposledy se ozvala <heartbeat>). Spusť dvojklikem `pump.wsf` v kořeni tohoto workspace (jen jedno okno — druhá pumpa se sama ukončí). Musí vypsat `Pripojeno na EA` a `Slozka requestu: <tento workspace>\requests`. Pak napiš ‚pokračuj' — dávku znovu neposílám."
- **B** „Pumpa na dávce <id> pracuje. Až v jejím okně uvidíš výsledek, napiš ‚pokračuj'. Trvá-li to přes dvě minuty, podívej se, jestli EA nečeká na dialog."
- **C** „Dávka <id> čeká na tvé potvrzení v okně pumpy (okno pumpy, ne EA; Enter = Storno, nic se neprovede). Okno zmizí po 5 minutách — pak mi napiš ‚okno zmizelo' a nabídnu ho znovu. Po kliknutí napiš ‚hotovo'."
- **D** „Pumpa čeká na EA — otevři EA s projektem."
- **E** „V dávce <id> mám chybu (<důvod>). V okně potvrzení dej Ne, pošlu opravenou."
- **F** (po změně členství ve skupinách EA) „Zavři EA i pumpu a spusť obojí znovu."

Jiný projekt otevřený v EA než při startu pumpy = `E_REPO` „restartuj pumpu" — požádej člověka o restart pumpy.

## Schránka (M365) — jak číst chat ACK

Uživatel dávku zkopíruje, v EA provede *Specialize → AI Bridge → Zpracovat davku ze schranky* (nebo ji uloží jako soubor a klikne v EA) a vloží ti zpět chat ACK. **Tvůj výstup dávky musí být vždy jeden souvislý JSON code blok** — nic okolo v code bloku.

- `EAFB OK <id>: N/N ops | QC ciste` = hotovo. **ACK nese identitu výsledků** — pod prvním řádkem jsou segmenty `op[i] <operace>:` s položkami: **GUID + jméno** (+ typ/stereotyp, u packages `path` plnou cestou); `query` nese kompaktní výcuk řádků, diagramová rodina počet + ukazatel. **GUIDy pro navazující dávku bereš přímo z ACK.** Dojde-li rozpočet, ACK ořezává **hlasitě** (nikdy tichý cut) s prioritou **GUIDy > jména** a končí ukazatelem na `res-<id>.json`. **Prosba o obsah `res-<id>.json` je výjimka pro doložené případy** — dump nad rozpočet (ACK nese ukazatel), binární/souborové výstupy (PNG, RTF — schránkou nejdou nikdy, ACK nese cestu), plný výčet warningů nad rozpočet — **ne výchozí postup**.
- ACK pingu nese segment `zapis: blacklist (N chranenych vetvi, EA security zapnuta/VYPNUTA): <cesty>` (= chráněné větve) a `access`; `KONFIGURACE CILE ZAPISU VADNA (E_SCOPE_CONFIG)` = zastav, opravu dělá správce. ACK `get_selected_context` nese `writeCheck=ok` / `writeCheck=NE <kód> (<proč>)`.
- `QC NALEZ …` / `QC nedobehlo …` = **není chyba zápisu** (zápis proběhl) — nález řeš s uživatelem, dávku nepřeposílej.
- `query: 0 radku` (případně s warningem) znamená „dotaz nic nevrátil", **ne** „data neexistují" — a není to chyba (`E_SQL` je jen skutečné selhání dotazu).
- **`EAFB OK <id>: N/N ops | 1 WARNING: … | QC …`** = zapsáno, ale **část záměru se nepropsala**; pod prvním řádkem je výpis po operacích; je-li warningů víc, než se vejde, ACK to řekne ukazatelem (`dalsich N - plny vycet v res-<id>.json`) — jen tehdy si plný výčet vyžádej. Reaguj opravnou dávkou podle textu warningu (u B3 rebuild na element GUID, pravidlo 14).
- `EAFB CEKA NA POTVRZENI <id> …` = dávka čeká na potvrzení uživatele v dialogu EA — čekej na finální ACK; `EAFB ZAMITNUTO` / `BLOKOVANO` / `INTEGRITA` a chybové kódy — viz dokument **EAFB-Chyby-a-Confirm**.
