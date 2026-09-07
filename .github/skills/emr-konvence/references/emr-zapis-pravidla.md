# Pravidla zápisu do EMR (sdílená reference)

Nahrazuje bývalý „skill" `ea-repo-writer`. Skilly se nevolají jako funkce — každý produkční skill se těmito pravidly řídí **přímo**. Před zápisem si vždy načti i `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) (ověřené vzory z repozitáře). Aktualizováno 2026-07-04 dle `Metodika Systémové analýzy v2.md` (§9–§11 nové) — viz `Feedback-Metodika-v2-Integrace.md` (mimo workspace — vyžádej od uživatele). **Rev. 2026-08-16 (audit MCP→bridge):** kanál zápisu = AI kanál — doma EA MCP (test/vývoj), v bance výhradně **ea-file-bridge** (`Zadani-EA-File-Bridge.md` (mimo workspace — vyžádej od uživatele) v1.6); protokol bridge MCP tooly zrcadlí, názvy operací platí beze změny. Verzní poznámky „MCP 2.8.x" a startovací mechanika domácího MCP serveru (`-enable*` argumenty) platí jen doma.

## 1. Cílové větve

| Artefakt | Větev | Detail umístění |
|---|---|---|
| UC, scénář, BRU, LS, UCR | `/Business Applications/<BA>/(Module)/UC-##### …` | LS kvůli verzování v rootu UC package |
| SR, DTO, specifikace rozhraní | `/Logical Design/Logical Design Artefacts/<Platforma>/<Komponenta>/<Služba>` | package per služba; **cílovou složku odvoď z katalogu**: operace → interface → komponenta → package path v katalogu se zrcadlí v Logical Design (package pojmenovaná dle komponenty). Pozor, zrcadlení není vždy 1:1 — když cíl nenajdeš jednoznačně, založ do `#UNSORTED` a vykaž k ručnímu zatřídění (default ITAN skriptů) |
| LDM | `…/<DB Resource komponenta>/LDM of <Komponenta>` | |
| Komponenty, interfacy, operace | `/Catalogues/Přehled komponent/Solution Artefacts` (master) / `…Proposed` (návrhy) | nové návrhy VŽDY do Proposed |
| Požadavky, traceabilita, QA reporty, Gate Records | `/Projects/<Projekt>` | |

Artefakt na špatném místě = blokující nález (anti-pattern metodiky).

## 2. Idempotence

1. Před create vždy `find_packages_by_name` / `find_elements_by_name` v cílové větvi.
2. Existuje-li (match GUID, jinak název+typ+package), dělej **update**, ne duplikát.
3. GUID nově vzniklých elementů si poznamenej do výstupu skillu (traceabilita běhu).

## 3. Pojmenování

- **UC**: `UC-#####` — čísluje **EA Auto Name Counter** (prefix `UC-`, 5místné číslo; ✅ U1 2026-07-06). ✅ **U1b uzavřeno 2026-07-07: counter se při create přes AI kanál (ea-file-bridge → Automation API; doma MCP) NEAPLIKUJE** (ověřeno proti counteru funkčnímu v UI — element vznikne s přesně zaslaným jménem, i prázdným). Postup přes bridge: (1) dohledej nejvyšší obsazené `UC-#####` v cílové větvi (find_elements/SQL) a přiděl max+1; (2) ve výstupu skillu vykaž **„posunout Auto Name Counter na <N+1>"** jako HITL krok — jinak příští UI-založený UC dostane duplicitní číslo; (3) duplicitu čísel hlídá QA. `UCR-#####` sdílí číslo s UC.
- **LS** (✅ U3 2026-07-06, zdroj `ls-rules.png` (mimo workspace — vyžádej od uživatele)): **`SSS-LS<čísloUC>[-Y]_Název v češtině`** — SSS = zkratka systému, číslo UC který LS primárně realizuje — **celé, bez zkracování** (u 5místného counteru tedy `PAY-LS90002_…`; ✅ 2026-07-07, příklady v ls-rules jsou z kratší řady), při více UC libovolný z nich; Y = pořadové číslo když jeden UC realizuje více obrazovek. Doporučené názvy: „Přehled…", „Detail…". Příklady (formát): `PAY-LS002_Přehled pohybů na účtu`, `PAY-LS002-1_Detail pohybu na účtu`. (Dřívější demo vzor `LS-0000X` je překonaný.) **LS part**: název česky, v jednotném čísle (multiplicitu nese aggregate vazba). **LS operace**: CamelCase název podstaty uživatelské akce (`NewMessage`, `FilterMessageList`…), popis česky — ze scénáře UC musí být jasné, kterou operaci aktér použil.
- **BRU**: přepoužitelná pravidla `BRU-####` (vlastní řada, **samostatný element** typu `Behavioral Rule` v `RULES (REUSABLE)`, UC —Usage «use»→ BRU); lokální pravidla UC `BRU<čísloUC>-Y` bez pomlčky (např. `BRU91001-1`) — ✅ **U5 rev. 2026-08-21 (pokyn Miloše): lokální BRU NENÍ samostatný element, ale INTERNAL REQUIREMENT uvnitř UC** (záložka Responsibilities → Requirements, `t_objectrequires`; text pravidla v poli Requirement/Notes), přesně dle metamodelu scenario-rules „Behavioral Rule - local [Requirement internal]". Dřívější N-K3-2 (element pod UC + Usage konektor) je pro lokální BRU **překonané** — analogie s U2 (scénáře → Scenarios tab) a constrainty (→ Constraints tab). ✅ **Zápis jde dávkou přes bridge operací `create_or_update_requirements`** (iterace 6, 2026-08-21, docs bridge v0.12 §6i; §7) — dřívější interim ruční krok je ZRUŠEN.
- Ostatní: služby `SR <NázevSlužby>`, `DTO <NázevSlužby>`; verzovací diagram `version_<Název nadřízené package>`; požadavky `<JIRA-ID> Název`; release postfix package `ARELYYMM`; prefix `#` jen pro technické package (#ARCHIVE, #TODO-IN/OUT, #UNSORTED).

## 4. Typy (MDG — používat doslovně, včetně překlepu)

- Diagramy: `CSOB-ITAN::FA-Behavioral`, `CSOB-ITAN::FA-Structural Detail`, `CSOB-ITAN::FA-Sturctural Overview` (!), `CSOB-ITAN::LD-Behavioral`, `CSOB-ITAN::LD-Structural`, `CSOB-ITAN::Version Root Diagram`, `UML Behavioral::Sequence`, `UML Structural::Class`, `IDS-IDesign::Service Contract Detail`.
- Elementy/stereotypy: UseCase, Actor, `Use Case Realization`, `Logical Screen`, `Logical Screen Part`, `Behavioral Rule`, `Service Realization`, `Data Transfer Object`, `Entity`, Requirement, `IDS-Client/Manager/Engine/Resource Access/DB Resource/Subsystem`, DataType (`dt*`).
- Kafka (✅ KF1 2026-07-06): topic = **`KafkaDesign::Kafka_Topic`**; eventy = UML operace na topicu; message cally stereotypy **`CSOB-ITAN::LD-Publish`** (publikace/zápis) / **`CSOB-ITAN::LD-Read`** (konzumace/čtení), báze UML::Message. ⚠ V dávce ea-file-bridge (`create_or_update_elements`) zadávej type nekvalifikovaně `Kafka_Topic` (§10, lekce C1; chování FQ typů zjištěno na MCP — revalidovat v executoru).
- Kompozitní elementy (UC, UCR, LS, SR, DTO) mají linked diagram **pod elementem** (owning ElementID).
- **Priorita při konfliktu: vzor v modelu > pravidla/kompilát** — před zápisem nového typu artefaktu si reconem přečti typování existujícího vzoru v cílovém repozitáři a drž se ho. **Repozitář bez MDG CSOB-ITAN** (sandbox): fallback = základní UML typ + stereotyp (např. BRU = `Requirement` + stereotyp `Behavioral Rule`); v EMR s MDG vždy plný `type` (✅ N-3 POC 2026-08-21).

## 5. Konektory

| Vazba | Typ | Směr |
|---|---|---|
| Aktér – UC | Association | aktér → UC |
| UCR – UC | Realization | UCR → UC |
| LS – UC | Dependency | LS → UC |
| UC – BRU **(jen přepoužitelné `BRU-####`)** | **Usage («use»)** (✅ N-K3-1) | UC → BRU |
| UC – lokální BRU `BRU<čísloUC>-Y` | **žádný konektor** — je to internal requirement uvnitř UC (U5 rev. 2026-08-21) | — |
| UCR – služba/operace/DTO (impact) | Usage | UCR → cíl |
| Požadavek – UC (traceabilita) | Realization (✅ dle metamodelu 2026-07-02) | UC → požadavek |
| UC – Core UC (Dynamic View) | Trace | UC → `IDS-Core Use Case` |
| Dynamics – Core UC | Realization | `IDS-Core Use Case Dynamics` → Core UC |
| Entita – entita | Association s multiplicitami | dle modelu |

**Všechny vazby zapisuj s `direction: FromSourceToTarget`** (LS depends UC, UCR realize UC, UC realize požadavek, UC use BRU, UC trace Core UC) — enum hodnoty viz §7h; updaty direction jen po jednom (§7g). (✅ N-K3-1)

### 5b. Message cally v sekvencích (✅ L1+L2, rozhodnuto 2026-07-02)

- **Aktér → FE** (na UCR): vazba na operaci se **nedělá**.
- **Od FE dále** (FE → komponenta, komponenta → komponenta): vazba call → operace (operationID) **vždy povinná** — QA kontroluje (B).
- **Self cally**: vazba nepovinná, nekontroluje se; často jen slovní popis, co se děje „uvnitř".
- **CRUD zprávy na entity (DB hrana)**: vazba na entitní CRUD operaci (`C/R/U/D`) **povinná** (✅ rozhodnuto 2026-07-14 při QA re-runu kola 3 — dřívější text entity neřešil). Pozn.: u operací vlastněných přímo classifierem (entity) se GUI vazba chová korektně — nevybraná combo vazba (N-K3-6b) se týká operací přes realizované interfacy.
- **Sync/async**: vlastnost zprávy `isAsynchronous`; soulad s typy volání v Dynamic View (`IDS-Sync`/`IDS-Async`) kontroluje QA.

## 6. Stav artefaktu a Gate Records (✅ rozhodnuto 2026-07-02, P1–P3)

- **P1 — stav artefaktu:** tagged value `SA-Status` ∈ {proposed, approved, baseline} **na úrovni package** (UC package, service package, LDM package). Ne na jednotlivých elementech — jedno místo pravdy, dotazovatelné SQL.
- **P2 — Gate Records a QA reporty:** element typu **Artifact** per záznam v `/Projects/<Projekt>/#GATES` resp. `#QA`. Tagged values: `gate` (G0–G3 / sada QA), `datum`, `rozhodl`, `vysledek` (approved/rejected resp. pass/fail), detail v notes.
- **contractAuthority (✅ IF1+L3, 2026-07-07):** tagged value na package rozhraní / service package, hodnoty `model` | `physical`. `model` = DTO/class model je zdroj pravdy (rozhraní navrhujeme a vlastníme → DTO modeluj); `physical` = existující XSD/JSON kontrakt je zdroj pravdy (DTO nanejvýš dočasný komunikační artefakt → jen odkaz, nemodelovat kopii). Bez TV rozhodni dle metodiky v2 §5.4.5 a TV navrhni doplnit.
- **P3 — pracovní prostor:** skilly **nezapisují rovnou do ostrých větví**. Zápis jde do pracovního prostoru (obdoba `…Proposed` — pro katalog přímo `Solution Artefacts Proposed`, pro UC/LD pracovní package projektu), do ostré větve se artefakty přesouvají až po schválení příslušné HITL brány. Přesun provádí/potvrzuje člověk nebo skill na jeho explicitní pokyn.

## 7. Co přes AI kanál (ea-file-bridge) nejde (manuální kroky)

Pozn. rev. 2026-08-16: limity níže byly zjištěny na domácím MCP — per položka revalidovat proti executoru bridge (Automation API má jiné limity).

- **Scénáře UC**: ✅ **U2 rev. 2026-08-17** (revize původního U2 z 2026-07-02 „notes finální") — strukturované scénáře se zapisují do **Scenarios tab** operací bridge `create_or_update_scenarios` (PROTOKOL-EAFB v0.5 §6b): scénáře BE/AF/EF s `type` Basic Path/Alternate/Exception, kroky `steps[{text, kind: actor|system, uses, results, state}]`, větve AF/EF kotvené `attachTo{scenario, step}` + `join`. ✅ **`join` (návrat větve do toku) JDE dávkou od iterace 6 bridge (2026-08-21, docs v0.12 §6i)** — v dávce se zadává **číslo kroku hostitelského scénáře** (metodicky „návrat do kroku M"; executor ho přeloží na GUID kroku), `"End"` nebo vynechané pole = větev končí; jméno scénáře, číslo mimo rozsah i `join` bez `attachTo` = warning + End. **Návrat formuluj na úrovni KROKU** — EA to tak drží i v UI (Scenarios → Entry Points, sloupec `Join`). Dřívější interim ruční krok je ZRUŠEN. ⚠ Historie: nález N-1 z POC tvrdil „join = jméno scénáře, EA neumí návrat na krok" — **bylo to VYVRÁCENO** (EA to umí, neuměl to bridge; diagnóza stála na čtení zdrojáku a zeleném readbacku vlastního zápisu, ne na pohledu do EA UI). Update = deterministický rebuild V2d. Ověřeno dávkou 20260818-28, Scenarios tab vizuálně potvrzen v EA UI. **Notes UC se pro scénáře už NEpoužívá** (jen Scenarios tab — žádné zrcadlo). BRU: z kroků odkazem přes ID (pole `uses`); **lokální** `BRU<čísloUC>-Y` jsou od U5 rev. 2026-08-21 internal requirements uvnitř UC (§3), **ne** samostatné elementy pod UC — N-K3-2 je pro ně překonané.
- **PRE/PST/ASU constrainty UC**: cílové umístění = **internal constraints (záložka Constraints, t_objectconstraint)** — U2 rev. 2026-08-17. ✅ **Operace `create_or_update_constraints` hotová (2026-08-19, registr 39, docs bridge v0.6)** — zápis jde dávkou přes bridge; dřívější interim ruční krok je ZRUŠEN (úklid 2026-08-21).
- **Přesun elementu mezi packages** — ✅ **JDE od iterace 6 bridge (2026-08-21): operace `move_elements`** (`package` jako společný cíl a/nebo `elements` s položkami `{element, package}`; vlastnění potomci i diagramy jdou s ním; prvek už v cíli = nic se neděje). Přesun je v Risk Gate **vždy ELEVATED** — čeká na lidské potvrzení, což je v souladu s P3 (§6: přesun mezi pracovním prostorem a ostrou větví provádí/potvrzuje člověk). ⚠ Pole `package` v update větvi `create_or_update_elements` element **NEPŘESOUVÁ** — nově o tom vrací warning s odkazem na `move_elements` (dřívější falešné OK, N-2, skončilo). Dřívější interim ruční krok je ZRUŠEN.
- **Lokální BRU jako internal requirement** (U5, §3) — ✅ **JDE od iterace 6 bridge (2026-08-21): operace `create_or_update_requirements`** (`element` + `requirements[{name, notes, type?, status?, priority?}]`, `t_objectrequires`, záložka Responsibilities → Requirements; deterministický rebuild V2d jako u constraintů — dávka nese kompletní sadu; `type` = ReqType, default `Functional`, nevaliduje se). Dřívější interim ruční krok je ZRUŠEN. **Přepoužitelná** `BRU-####` sem NEPATŘÍ — zůstávají samostatným elementem v `RULES (REUSABLE)` + konektor Usage.
- **Tagged values na package** — ✅ FUNGUJE: operace `create_or_update_package` s top-level parametrem `taggedValues` (pole `[{name, value}]`) dávkou přes bridge, na create i update non-top-level package; TV se čte zpět přes `get_packages_information`. ⚠ **Root (top-level) packages TV mít nemohou** — limit EA, ne kanálu. (Historická pozn., jen domácí MCP: funguje od 2.8.5, ověřeno 2026-07-15 i 2026-07-21; na ≤2.8.4 zápis padal.) Tehdejší oklika přes duální t_object package je **ZRUŠENÁ a zakázaná** — element založený s type `Package` skutečnou package nevytvoří (chybí t_package) a vzniká neviditelný sirotek (náprava: Project Integrity Check). Package vždy zakládej výhradně přes `create_or_update_package`.
- **Změna typu elementu** — ✅ JDE updatem `create_or_update_elements` (Dokumentace bridge v0.9 §4.2; historicky kandidát K7 zadání v1.6 — naplněno). Smaž-a-založ (`delete_from_model` + nové založení) jen nouzově u elementů bez externích vazeb — ztrácí GUID, konektory i razítka.
- **GUID elementů** — překonáno bridgem: bridge response GUIDy vrací (`query` — akceptační kritérium iterace 1); omezení „výstupy GUIDy nevracejí" platilo jen pro domácí MCP. Pro RefGUID tagged values (505-1) GUID stejně není potřeba — `ids` struktura zůstává konvencí protokolu (§7h).
- **Mapovací Excel, baseline diff UI** — mimo AI kanál (bridge); skill je označí jako handoff člověku. Infoport žádný export/publikaci nepotřebuje (tenký klient nad EMR) — manuální je jen kontrola čitelnosti (checklist bod 15). (Session baseline dělá pumpa bridge automaticky; ✅ explicitní **pojmenovaná** `create_baseline` per package je implementovaná, k ní čtecí `get_baselines` + `baseline_diff` — Dokumentace v0.9 §4.1/§4.4, historicky K5 — naplněno; `apply_baseline` je pro AI trvale zakázán (§12a) — ekvivalent se nezavádí.) Sémantika mapovacího Excelu (sloupce, sheety, `CALL IF`/`CREATE FOR EACH`/překlady/vícevolací fasáda) je zdokumentovaná v `current-implementation.md` (mimo workspace — vyžádej od uživatele) — použij jako referenci pro tvar Excelu, který skill/analytik předává. Dlouhodobě se plánuje náhrada Excelu YAML notací + Mapping Studio mimo EA (`INTERFACES/`, `Feedback-Interfaces-Integrace.md` (mimo workspace — vyžádej od uživatele)) — je to organizačně závislý budoucí modul (Git repo, Actions), ne dnešní konvence.
- **External Reference (Boundary)** elementy negeneruj — vytváří je EMR addin; při čtení je ignoruj.

## 7c. Ověřeno pilotem 2026-07-02 (zápisové vzory, které fungují)

- **MDG typy zadávej jako `type`**, ne jako stereotyp: `CSOB-ITAN::Use Case Realization`, `CSOB-ITAN::Service Realization`, `IDS-IDesign::IDS-Engine`… Stereotyp přidaný k obecnému typu (UseCase, Class) se **tiše zahodí**. (Výjimka: `CSOB-ITAN::Data Transfer Object` jako stereotyp ke Class prošel — přesto preferuj type.)
- **MDG elementy si samy založí kompozitní diagram** (název „Collaboration" / „Component") — nevytvářej duplicitní, jen ho přejmenuj (`create_or_update_diagram` s existujícím diagramID).
- **Tagged values na elementech: pole `[{"name": …, "value": …}]`** — objektový zápis `{"name": "value"}` selže chybou. `505-1 Operation Link` s GUID v `{…}` funguje, ověřeno zpětným čtením (K3 ✅).
- Všechny MDG typy diagramů (`FA-Behavioral`, `Version Root Diagram`, `Sequence`, `Class`) i konektory (Association, Realization) a přesměrování konektoru na jiný element fungují.
- `create_or_update_operations` funguje (operace na komponentě/interfacu); response vrací GUID parametrů (ne operace).
- **Mazání:** `delete_from_model` maže Package, Diagram, Element, Connector, Attribute, Operation, Parameter i tagged values; k dispozici je i `remove_elements_from_diagram` (odebrání z diagramu bez smazání z modelu). V bance = dávka přes bridge — ✅ delete operace jsou **implementované** (`delete_from_model`, `delete_taggedvalue_from_model`; Dokumentace v0.9 §4.2; historicky K4 iterace 3 — naplněno). Povolení delete = konfigurace whitelistu operací executoru; dokud jsou v produkci v deny, platí handoff člověku (`delete-request` v bridge protokolu). (Mechanika domácího MCP: od serveru 2.8.0, ověřeno 2026-07-03; vyžaduje `-enableDelete` při startu MCP serveru, obdobně create/update `-enableEdit` — v bance tato mechanika neexistuje.) Mazání používej zdrženlivě: primárně na vlastní omyly v pracovním prostoru; existující artefakty nikdy nemaž bez HITL potvrzení.

## 7d. Sekvenční diagramy a zprávy (ověřeno E2E pilotem 2026-07-02)

✅ Rev. 2026-08-29 (framecheck): `create_or_update_messages` je v bridge **implementovaná** (Dokumentace v0.9 §4.3 — operace, argumenty, návraty, seqNo; opt-in `rebuild: true` = server-side deterministický rebuild; historicky K1 iterace 3 — naplněno). Ruční krok / handoff člověku platí už jen tehdy, když je operace v produkci držená v deny whitelistu executoru. Vzory níže platí pro celý AI kanál; verzní podmínky MCP = domácí historie.

- ~~Diagram pro zprávy zakládej s nekvalifikovaným typem `Sequence`~~ ✅ **OPRAVENO (domácí MCP 2.8.4, ověřeno 2026-07-12)**: message tool akceptuje i MDG typ `UML Behavioral::Sequence` — auto-kompozit UCR/SR se používá přímo, bez mazání a zakládání plain `Sequence`. Pravidlo „plain Sequence" platí už jen pro domácí MCP < 2.8.4 (viz §7h).
- **Diagram musí být při zápisu zpráv otevřený v EA** (`open_diagrams`), jinak „hidden diagrams" chyba. **`place_elements_on_diagram` od 2.8.7 VŽDY s `width` i `height`** — bez nich tiše neumístí nic (žádná chyba; x/y-only fungovalo jen do 2.8.5). Lifeliny umísti PŘED zápisem zpráv.
- **Zprávy patří interakci, ne diagramu** — zobrazí se na každém diagramu se stejnými lifelinami. Nezakládej „opravný" druhý diagram; oprav zprávy samotné.
- **Čtení zpráv:** `get_diagrams_information` u `Sequence` typu **VRACÍ blok `Sequence messages`** (connectorID, name, related operationID, return value) — ✅ ověřeno 2026-07-24 na 2.8.7; alternativa `get_connectors_information` po connectorID (typ `Message`). ⚠ **Podmínka: lifeliny musí být na diagramu umístěné s plnou geometrií** (§7d place) — pokud jen x/y bez width/height, na 2.8.7 se neumístí a get_diagrams_information pak logicky žádné zprávy neukáže (to byl původ mylného „regrese“ nálezu z draftu 5, 2026-07-21 — vyvráceno 07-24). ID nových zpráv = pokračování číselné řady konektorů.
- **Update zpráv funguje** (connectorID + sourceElementID/targetElementID povinné) — jméno lze doplnit bez ztráty vazby na operaci.
- **`operationID` vazba na zprávě funguje a ukládá tagged value `operation_guid`**. ~~GUID-harvest trik / placeholder `#FIX-GUID:`~~ ✅ **PŘEKONÁNO 2026-07-07: 505-1 a jiné RefGUID tagy zapisuj přímo `ids` strukturou (§7h)** — GUID ani FIX skript nejsou potřeba.
- **Žádné apostrofy v textech zpráv** — neescapované `'` shodí zápis SQL chybou; část dávky se předtím může stihnout zapsat.
- **Chybná dávka může částečně projít** — po chybě vždy zkontroluj konektory po ID a přebytky smaž `delete_from_model` (type Connector).
- **InteractionOccurrence**: element s `classifierID` = SR element; render „ref" fragmentu funguje.

## 7e. Detailní konvence artefaktů (z ITAN skriptů, 2026-07-03)

Zdroj: `Scripts/ITAN-*.vbs` — produkční EA skripty pro ITANy; **spustitelná specifikace cílového stavu**. AI zápis musí produkovat identické struktury.

- **Diagramy založené přes API nemají autora** — nastavovat `Author` (jméno analytika), `Version` = „1.0"; na version diagramu navíc `ShowDetails` = 1 (zobrazuje verzi). ✅ Zápis Author/Version jde přes bridge: `create_or_update_diagram` nastavuje na create vždy Author + Version a `update_diagram_properties` umí jméno/autora/verzi/showDetails/styleEx (Dokumentace v0.9 §4.3; historicky K6 — naplněno).
- **`IsComposite`** — přes MCP zapsat nešlo (parametr tiše ignorován, ověřeno 2026-07-03); ✅ v bridge jde — `create_or_update_elements` podporuje kompozitní elementy (Dokumentace v0.9 §4.2; historicky K8 — naplněno). Nouzový fallback pro starý obsah: EA skript `element.IsComposite = True` per element (viz Scripts/). Kontrola v QA: element s owned diagramem bez IsComposite = nález W. Pozn.: platí i pro MDG typy (UCR/SR), kde kompozit vzniká automaticky.
- **StyleEx s MDGView**: UC detail diagram `MDGDgm=CSOB-ITAN::FA-Behavioral;MDGView=CSOB-ITAN::Use Case Detail;` · SR impact view `MDGDgm=CSOB-ITAN::LD-Behavioral;MDGView=CSOB-ITAN::Realization Impact View;` — MDGView napojuje diagram na View Definition z metamodelu.
- **DTO vnitřní struktura**: `<Služba>Req` a `<Služba>Res` (Class) pod DTO, vazby **Composition** Req/Res → DTO (supplier end aggregation=2, client end non-navigable); DTO —Dependency **«refine»**→ SR. V bridge dávce (`create_or_update_connectors`): typ „Composition", **source=DTO, `sourceEnd.aggregation=2`, target=Req/Res** (diamant u DTO; ✅ N-K3-4 — dřívější targetEnd forma obrácená); stereotyp refine na Dependency funguje.
- **Katalog-first tok služby**: SR se zakládá **od operace v katalogu** (dohledej referencující SR přes SQL; když není, založ service package) — 505-1 je vyplněné konstrukčně. SQL vzor: `t_objectproperties WHERE Property='505-1 Operation Link' AND Value='<MethodGUID>'`.
- **SR base type = Collaboration** (stereotyp Service Realization) — relevantní pro SQL dotazy.
- **Šablonové notes**: nové artefakty přebírají instrukční (zelené) texty ze šablon `#Template structure` — GUIDy šablon viz `EA-Repozitar-Kontext.md` §13. Přes bridge: číst šablonu (`get_elements_information`), kopírovat description.
- **SR Impact View**: volitelný diagram pod SR elementem (`CSOB-ITAN::LD-Behavioral` + MDGView Realization Impact View).
- **UCR se zakládá i skriptem z UC** (Create UC package from UC): UC vznikne první, package se vytvoří kolem něj a UC se do ní přesune — ergonomie pro člověka; výsledná struktura identická se scaffold B.

## 7f. Nálezy z model review 2026-07-05 (závazné vzory)

- **UC detail diagram má System/Module Boundary** (typ `Boundary`, název dle BA/modulu). Uvnitř: UC, UCR, LS, BRU, Core UC; **aktér a požadavky vně**. Element patří na diagram, jen když je celým obrysem uvnitř boundary.
- **Vrstvení realizací**: UCR končí na **Manageru** (aktér → FE/Client → Manager + ref na SR služby Manageru). Každé překročení hranice komponenty = vlastní služba s vlastním SR: SR Manager služby (Manager+RA lifeliny, ref na další SR) → SR DB služby (RA + entity, CRUD). RA se NIKDY neobjevuje na UCR. Impact řetěz Usage kopíruje ref řetěz: UCR→SR(Manager)→SR(DB).
- **Lifeliny nesou stereotyp classifiera** (viz `Scripts/ITAN-Apply Classifier Stereotypes on SD.vbs`): komponenty `IDS-Client/IDS-Manager/IDS-Resource Access…`, entity `entity` (kruhový glyf). V bridge dávce: `stereotypes` **nekvalifikovaně** („IDS-Client", ne „IDS-IDesign::IDS-Client"; ignorace kvalifikovaných jmen v poli `stereotypes` byla chování MCP serveru — vendor 2026-07-21, historie — v executoru revalidovat). FQ název patří do pole **`type`** — ale to vytváří PLNÝ MDG element (auto-kompozit + default TVs), tedy **nikdy pro lifeliny** (§7g N-K4-5); FQ-via-type jen tam, kde plný MDG element skutečně chceš (katalog).
- **První/poslední volání sekvence přes Diagram Gate**, ne MessageEndpoint. ✅ **Od 2.8.5+ create s type `"DiagramGate"`** (vendor 2026-07-15; **UI potvrzeno 2026-07-17**: sedí na interaction frame, zprávy se připojují). Gate-clone workaround (šablona + `clone_elements`) je ZRUŠEN. Type `Gate` a `MessageEndpoint` na create nepoužívat (první padá, druhý vytvoří obyčejný endpoint).
- **LS agregace**: diamant u Logical Screen — v bridge dávce (`create_or_update_connectors`) **source=LS, `sourceEnd.aggregation=1`, target=part** (✅ N-K3-4; původní zápis „source=part, targetEnd.aggregation=1" vede k diamantu u partu). Stejná logika pro DTO kompozice: **source=DTO, `sourceEnd.aggregation=2`, target=Req/Res** (pozn.: EA vrací type „Aggregation" i pro Composition). `aggregation` je **write-once** — na update se ignoruje; platí na tom konci konektoru, kde je zapsána (write-once chování zjištěno na MCP — revalidovat v executoru).
- **Atributy dle katalogu konvencí** (`references/attribute-naming-conventions.md` (skill `structural-modeller`)): anglicky, PascalCase, kvalifikátor typu na konci (PeriodFromDate, ne DateFrom!), popis česky. Platí pro LS parts, DTO Req/Res i parametry operací.
- **Ref (InteractionOccurrence) není klikatelný** — classifierID nastaví jméno, ale ne odkaz na diagram; propojení ručně v EA. ⚠ Limit AI kanálu (převzato z MCP); executor může řešit `SetCompositeDiagram` (kandidát iterace 3, K8) — do té doby ručně v EA.

## 7g. Nálezy z E2E kola 2 — DBK (2026-07-06, závazné)

- **Lifeliny na SD = NEPOJMENOVANÉ INSTANCE, ne komponenty** (✅ N-K4-5, pokyn analytika G2 kola 4 — **escape kola 3**; dřívější pravidlo „zakládej rovnou s MDG typem" bylo ŠPATNĚ: vytváří plnohodnotné katalogové komponenty vč. auto-kompozitu Service Contract Detail a prošlo bez povšimnutí celým kolem 3). Správný vzor: `create_or_update_elements` s `type: "Object"`, **`name: ""` explicitně** (vynechané pole name shodí create „invalid values" — N-K4-6), `classifierID` = komponenta katalogu, `stereotypes` = **plain stereotyp classifiera** (`"IDS-Manager"`, nekvalifikovaně — MDG bound na create i update; FQ se tiše zahodí, §7h). Na diagramu se zobrazí `:NázevKomponenty`. Konverzi Type `Object`→`Component` (cílový stav dle `Scripts/ITAN-Apply Classifier Stereotypes on SD.vbs`) ✅ řeší operace bridge **`apply_classifier_stereotypes`** — idempotentní port ITAN skriptu, dorovná Type + stereotyp dle classifiera (Dokumentace v0.9 §4.4; historicky K7 — naplněno). Závěrečný FIX skript kola je jen nouzový fallback. **Entity lifeliny**: `Object` + classifier entita + stereotyp `entity`, bez konverze typu. QA hlídá kontrolou 9f.
- **Komponenta —Realization→ interface je povinná součást katalogového zápisu** — bez ní EA nenabízí operace interfacu k navázání na message cally. **Před přiřazováním `operationID` ověř Realization pro KAŽDOU cílovou lifeline** vč. RA pass-through — chybějící Realization byla kořenová příčina G2 diagnostiky kola 3 (✅ N-K3-6a).
- **`operationID` na zprávě** (ověřeno na domácím MCP; v bridge implementováno jako `create_or_update_messages` — viz hlavička §7d): **od MCP 2.8.7 se jméno/argumenty/návratová hodnota synchronizují z operace UŽ PŘI CREATE** (✅ 2026-07-21: response vrací name + arguments se JMÉNY parametrů + return value, diagram vykresluje plnou signaturu `DoBind(requestId, verbose): boolean` — chování ruční vazby; ověřeno pro operaci přes realizovaný interface i přímo na klasifikátoru). Name-only follow-up update pro nové zprávy odpadá. Historie: na ≤2.8.6 se zapisoval jen `operation_guid` tag a combo zůstávalo prázdné (N-K3-6b; vendor: limit EA, ne MCP — `ReorderMessages()` v `reload_diagrams` u nás nezabíral). **UI combo ✅ potvrzeno 2026-07-21 (operace v dialogu vybraná)** — ruční GUI-vazba kontrola v handoffu pro zprávy zakládané na 2.8.7+ ODPADÁ; u zpráv z ≤2.8.6 při revizi dál prověřit.
- ~~Create zpráv s `operationID` je nedeterministické~~ ✅ **OPRAVENO v 2.8.5 (duplicity) a 2.8.7 (auto-sync jména)** — 1 call = 1 konektor s connectorID v response. Kontrola číselné řady po dávce zůstává jako levná pojistka (✅ N-K3-6c). ⚠ **Zpráva jde vytvořit i na SD bez umístěných lifelinů** — vznikne neviditelný konektor (2026-07-21); závazné pořadí: place lifeliny (s width+height!, §7h) → messages.
- **Updaty konektorů VÝHRADNĚ po jednom** — dávka 14 direction-updatů zasekla EA (restart, nezapsalo se nic); create dávky fungují (✅ N-K3-5).
- **Ref (InteractionOccurrence) se umísťuje bezprostředně POD message call volané operace** (ne na spodek diagramu). Klikatelnost: `Element.SetCompositeDiagram(classifier.CompositeDiagram.DiagramGUID)` skriptem — funguje.
- ~~Parametr `direction` shodí celou dávku — směry doplňuje skript~~ ✅ **VYŘEŠENO 2026-07-13**: server má enum, jen ho náš klient ořezával ze schématu — posílej `"FromSourceToTarget"` / `"FromTargetToSource"` / `"BothDirection"` / `"Unspecified"` (§7h). FIX skript pro směry odpadá. POZOR `Connector.Update()` v API dál vrací false bez vyhození chyby — vždy kontrolovat návratovou hodnotu + zpětně přečíst.
- **Chybová dávka konektorů může celá projít** i když bridge response vrátí error — po chybě VŽDY zkontrolovat číselnou řadu (duplicity!). Pravidlo platí obecně pro AI kanál. Platí i pro „úspěšný" zápis: QA vykazuje jen zpětně přečtený stav.
- **MDG elementy (LS, DTO, UCR, SR) si auto-zakládají kompozitní diagram** (zakládá je EA/MDG, ne kanál) — u LS vzniká rovnou jako **`CSOB-ITAN::FA-Structural Detail`** (jen se jménem „Class"): **nemazat, jen přejmenovat a použít** (✅ N-K3-9; **u DTO auto-kompozit vzniká rovnou jako `UML Structural::Class` se jménem „Class": nemazat, jen přejmenovat**, ✅ kolo 4); u UCR/SR se auto-kompozit `UML Behavioral::Sequence` **používá přímo** (✅ 2026-07-12, §7d/§7h). Chování revalidovat přes bridge; verzní poznámky (MCP 2.8.4+/2.8.5, „smazat prázdný Class"/plain `Sequence` jen pro MCP < 2.8.4) platí jen doma.
- **VBS pro FIX skripty:** `on error resume next` je procedure-scope (do každé sub), `EnableUIUpdates=false` na dávky (jinak EA visí na překreslování; vypadá pak jako Not Responding — sledovat Output), `GetCurrentLoginUser` bez user security hází chybu, Realization komponenta→interface při hromadném Update umí viset (řešit jednotlivě/ručně). **Poslední řádek skriptu = holé volání `Main`** — jinak skript „doběhne a nic neudělá" (✅ N-K3-11, vzor FIX-DBK; FIX-RB v1/v2 suby definoval, ale nevolal).
- ~~Raw GUID operace od MCP 2.7.3 nelze získat → placeholder `#FIX-GUID:`~~ ✅ **PŘEKONÁNO 2026-07-07** — RefGUID tagy zapisuj `ids` strukturou (§7h). Bug report + odpověď vendora: `Bug-Report-EA-MCP.md` (mimo workspace — vyžádej od uživatele), `Sparx-MCP-Odpoved-Testy-2026-07-07.md` (mimo workspace — vyžádej od uživatele).

## 7h. Nálezy z odpovědi Sparx JP + testů 2026-07-07 (závazné)

Kontext a evidence: `Sparx-MCP-Odpoved-Testy-2026-07-07.md` (mimo workspace — vyžádej od uživatele). Testováno na MCP 2.8.x, `/Groups/#AI-SANDBOX`.

- **RefGUID tagged values (505-1 Operation Link aj.) zapisuj `ids` strukturou** — funguje na elementech i konektorech, GUID není potřeba, zpětné čtení vrací rozresolvovaný cíl `{name, type, ID}` (= QA kontrola bez SQL). Struktura je ve schématu serveru dokumentovaná (dřívější klientský ořez se od 2026-07-15 neprojevuje, viz níže):

  ```json
  "taggedValues": [{"name": "505-1 Operation Link", "ids": [{"type": "Operation", "id": 68}]}]
  ```

  `type` ∈ Package | Diagram | Element | Connector | Attribute | Operation | Parameter (dle schématu; prakticky ověřeny Element a Operation). Ověř v UI/QA, že hodnota je raw `{GUID}` — potvrzeno 2026-07-07.
- **Diagram Gate: `create_or_update_elements` s type `"DiagramGate"` dávkou přes bridge (ověřit v executoru)** — ✅ historie domácího MCP: vendor 2026-07-15, UI potvrzeno 2026-07-17 (skutečný gate: interaction frame, zprávy se připojují). Gate-clone workaround (šablona `/Groups/#AI-TEMPLATES/TEMPLATE Diagram Gate` + `clone_elements` + move/rename) ZRUŠEN. Type `Gate` na create dál padá.
- **Stereotypy: v poli `stereotypes` VŽDY nekvalifikovaně** (`"IDS-Manager"`) — plain jméno je MDG-bound (checkbox ✅) na create i update; FQ se v `stereotypes` **ZÁMĚRNĚ ignoruje** (vendor 2026-07-21: kombinace FQ typu + stereotypu korumpovala výstup — bod uzavřen). **FQ název = pole `type`** (`{"type": "IDS-IDesign::IDS-Manager"}` → plný MDG element s FQ stereotypem, auto-kompozitem a default TVs; ověřeno 2026-07-21) — jen pro katalogové MDG elementy, NIKDY pro lifeliny (§7g N-K4-5). Po zápisu stereotyp zpětně přečti.
- **`direction` na konektorech FUNGUJE** (✅ 2026-07-13, ověřeno create i update): hodnoty **`FromSourceToTarget` | `FromTargetToSource` | `BothDirection` | `Unspecified`** — NE EA API řetězce („Source -> Destination" padá). Enum je ve schématu serveru (od 2026-07-15 ho klient doručuje neořezaný).
- ~~Vendor slíbil fix MDG sequence~~ ✅ **DODÁNO v 2.8.4 a ověřeno 2026-07-12** — §7d bod 1 a §7g auto-kompozit zrevidovány.

### Retest 2.8.4 (2026-07-12) + raw schéma od vendora (2026-07-13) — stav bug reportu

- ✅ Opraveno/vyřešeno: messages na MDG sequence (fix 2.8.4); stereotypy ve výstupech (2.8.4); `direction` enum (naše strana); duplicity zpráv (2.8.5); package TV (2.8.5); DiagramGate create (2.8.5+, UI ✅); parametry operací `order:-1` i v create (naše chyba, vendor 2026-07-15); FQ stereotyp = záměr, řeší se přes `type` (2026-07-21); **sync zpráv s operacemi (2.8.7, ověřeno 2026-07-21)**.
- ✅ **Iterace 6 (2026-07-24): obě „regrese“ z draftu 5 byly NAŠE testovací chyba** — Takeshi vyvrátil, čistý izolovaný retest potvrdil jeho (pkg RETEST-287b, smazán): (a) `place_elements_on_diagram` NENÍ bug — 2.8.7 zavedla **částečný update**: `{elementID, x}` posune EXISTUJÍCÍ element po X bez změny velikosti; NOVÝ element (ještě není na diagramu) se umístí jen s **plnou geometrií (x,y,width,height)** — částečné volání u neumístěného elementu je no-op (na ≤2.8.5 stačilo x/y). Náš flow posílá plnou geometrii, takže v produkci nevadí. (b) `get_diagrams_information` **vrací `Sequence messages` normálně** — dřívější prázdný výsledek byl důsledek (a): lifeliny byly umístěné jen x/y → nebyly na diagramu → žádné zprávy. (c) `order: 1` — vendor v příštím release přestane vracet order při přidání zprávy. Won't fix (akceptováno): validace operace vůči lifeline (odpovědnost AI/QC); Code field pro `Method.Code` (AI Code Bridge zůstává); SQL tool a raw GUID (viz FAQ vendora). ⚠ **Poučení: experimentální sondy (bare `{elementID}`) neposílat vendorovi jako produkční chování; před hlášením „regrese“ izolovat proměnné.**
- ⚠ **Klient ořezával tool schémata** (2026-07-13, raw dump `tools-list-raw-2.8.4_2026-07-13.json` (mimo workspace — vyžádej od uživatele)): properties s nullable union typem `["string","null"]` dorazily jako `{}`. ✅ Od 2026-07-15 se ořez neprojevuje (schémata chodí s enumy i ids strukturou); GitHub issue #77194 uzavřen 2026-07-18 jako duplicate of **#56263**. Response formáty i parametry toolů se mění bez ohlášení a vendor to nepovažuje za breaking (`elementPlacements`, přejmenovaná pole message response 2.8.7, nulové datumy v package response) — tools/list číst při každém připojení, na tvar response se neupínat.
- ⚠ Breaking change 2.8.x: `place_elements_on_diagram` má povinný parametr **`elementPlacements`** (dřív `elementInfo`). Tool pro mazání TV z package/atributů/operací/konektorů se od **MCP 2.8.5 jmenuje `delete_taggedvalue_from_model`** (překlep `delete_taggevalue…` z 2.8.3–2.8.4 opraven — breaking, aktualizovat allowlisty; ✅ N-K3-10). Funguje i s type `ConnectorTaggedValue` (mazání `operation_guid`).
- **`create_or_update_package` umí intermitentně selhat** `Failed to update the specified element property` (✅ N-K4-1, kolo 4: 2× po sobě fail, 3. pokus OK) — retry pomáhá; nic se nezapíše (řada packageID souvislá, žádný orphan), přesto po chybě řadu zkontroluj. Kandidát do vendor reportu.
- **Create nepojmenovaného elementu vyžaduje `name: ""` explicitně** — vynechané pole name shodí dávku „Element information contains invalid or wrong value(s)" (✅ N-K4-6).
- **Pozorování ke GUI vazbě zpráv (N-K3-6b)**: po přepnutí zprávy s `operationID` na cílovou **instanci** (Object s classifierem) se do name zprávy automaticky dotáhl podpis operace `Op(paramTypy)` — chování odpovídající ruční GUI vazbě (✅ N-K4-7, kolo 4, zprávy 1334/1341). Hypotéza: bug GUI vazby souvisí se vzorem lifeline (komponenta vs. instance) — sandbox drill před další iterací vendor reportu.
- Od 2.8.3 umí server logovat create/update/delete operace (zapíná se argumentem — jméno argumentu zjišťujeme u vendora; po zjištění zapnout na produkci, doplňuje audit §12).

### Nálezy z tréninkového zápisu C1 (2026-07-12, demo, session RE-C1)

- **Dávka elementů s neznámým MDG typem spadne celá a nic nezapíše** (ověřeno kontinuitou číselné řady elementIDs) — chování opačné než u konektorů (§7g); řadu po chybě přesto vždy kontrolovat.
- **MDG typ zadaný FQ padá, když technologie v repu není** (`KafkaDesign::Kafka_Topic` v demo QEA). Nekvalifikovaný `type: "Kafka_Topic"` se naváže na dostupný profil (demo: **`ThubDesignProfile::Kafka_Topic`**) a MDG doplní výchozí TV topicu (`format=json`, `ordered`, `piloting`, `retentionTime`). Po create vždy zpětně přečíst, který profil se navázal (§10).
- **`create_baseline` neumí zadat název** — jen packageID → vrací GUID baseline. Konvence `AI-pre-<session>-<batch>` (§12c) se proto vede v restore manifestu a #AI-LOG Artifactu, ne v EA.
- **`delete_taggedvalue_from_model` s type `OperationTaggedValue` funguje** (T1 UNDO drill; na 2.8.3–2.8.4 pod starým názvem s překlepem, od 2.8.5 opravený název — ✅ N-K3-10) a update operace s `description: ""` notes skutečně vyprázdní — revert dávka z journalu je plně proveditelná přes AI kanál (bridge) — vyžaduje delete/update operace v executoru (operace iterace 3 bridge, parita s MCP, rozhodnutí 2026-08-16, K4; do jejich implementace ruční krok).

### Další limity AI kanálu (zjištěno na MCP — revalidovat proti executoru)
- **Update atributu bez `typeElementID` shodí classifier typu** (a `order`) — při updatu vždy posílat kompletní (name, type, typeElementID, order).
- ~~Parametry operací jsou write-once~~ ✅ **VYŘEŠENO (vendor 2026-07-15 — byla to naše chyba)**: `order` u parametru NENÍ pořadí, ale adresa — `order ≥ 0` **přepisuje parametr na dané pozici** (proto „mizel" první parametr), `order: -1` = append. **Pravidlo: KAŽDÝ přidávaný parametr vždy `order: -1`, i v create callu operace** — pak funguje vše v jednom callu (ověřeno 2026-07-15 i 2026-07-21, UI pořadí správně). Update existujícího parametru = `order ≥ 0`. Mazání: `delete_from_model` type Parameter (id=operationID, name). Zpětné přečtení po zápisu drž.
- **GUID tagged values se čtou rozpřaženě**: 505-1 vrací {name, type: Operation, ID} — QA kontrola 9 může validovat cíl bez SQL. Bridge čtení (`get_*`) musí vracet RefGUID TV rozpřaženě {name, type, ID} — implementovat v executoru shodně. (Domácí MCP: od 2.7.3.)

## 7b. Bankovní režim (VS Code, ea-file-bridge)

V bance agent MCP **nikdy** nemá — MCP je zakázané, bridge je cílový bankovní stav (rozhodnutí 2026-08-16). Zápis i čtení jde vždy JSON dávkou do `requests/` dle ea-file-bridge (`Zadani-EA-File-Bridge.md`); výsledek (GUIDy, výpisy, QA) agent převezme z `responses/`. Dávkové konvence viz [emr-bridge-protokol](emr-bridge-protokol.md). Pravidla §1–§7 platí beze změny — validuje je executor AICodeBridge před zápisem.

## 8. Po zápisu

Diagramy po úpravě `reload_diagrams`; rozmístění `place_elements_on_diagram` + `layout_connectors`; výstup skillu vždy shrnuje: co vzniklo (GUID), kam, jaký stav, co zbývá manuálně.

## 9. Katalog atributů — governance (metodika v2, kap. 6.2)

- Katalog atributů jsou **šablony**, ne katalog v pravém smyslu: oprava v katalogu se **nepropíše zpětně** do už použitých výskytů. Zakládej proto pečlivě napoprvé, ne „opravím to později".
- Běžné použití je **drag-and-drop** z katalogu na diagram (LS/DTO/entita) — nepiš atribut ručně od nuly, pokud ekvivalent v katalogu existuje.
- Nový atribut se zakládá v odemčené `Attributes Proposal`, ve složce **`design features`**, pod novou třídou pojmenovanou jménem autora (EMR eviduje jen autora třídy, ne atributu — jméno třídy je jediná stopa autorství). ✅ AT1 2026-07-06: složka v produkci existuje, ale je v **žalostném stavu** — čištění je mimo scope, čerpej z ní jen inspirativně; přesnou cestu/GUID doplň při prvním reálném použití přes bridge (query dávka).
- Drift šablona ↔ použité výskyty (✅ AT2): provozní riziko bez nástrojové opory ve skillu — hlídá ho interní SQL dotaz správce (počty výskytů vs. aktuální šablona; na vyžádání u Miloše).
- Datový typ atributu **nikdy ručně jako text** — vždy přes *Select Type* na doménový typ z katalogu doménových typů (jinak se nedotáhnou zděděné tagged values).
- Tři nepodkročitelná pravidla kvality atributu: (1) jméno dle jmenných konvencí, (2) správně přiřazený doménový typ, (3) univerzální popis bez vazby na konkrétní projekt/platformu. QA (`emr-qa`) tato tři pravidla kontroluje jako B (blokující) při zakládání nového atributu do katalogu.
- Vlastnictví pojmenování patří analytikovi, ne vývojáři. Výjimka: externí rozhraní s pevně daným pojmenováním se do katalogu nedávají ani nepřejmenovávají.
- Výběr doménového typu — tři plány (detail `EA-Repozitar-Kontext.md` §8): **A** sémanticky pasující typ + výchozí délka (✅ **DT1 uzavřeno 2026-07-05**: výchozí délky ověřeny proti produkci pkg 81 přes MCP a zapsány v `domain-types.yaml` (mimo workspace — vyžádej od uživatele) — kanonický zdroj pro dt* → technologický typ; názvy v produkci jsou `dt*` camelCase), **B** `DT varchar n` s ruční délkou — hlavně pro vstupy z externích systémů s jinými konvencemi, **C** `DT undefined` když typ (zatím) nelze určit — i tak DT přiřaď: přiřazením se na GUI EA zpřístupní zděděné tagged values z generalizací (✅ DT1 upřesněno 2026-07-06).

## 10. Kafka / událostní rozhraní (metodika v2, kap. 5.4.4 — ✅ KF1+KF2 rozhodnuto 2026-07-06)

- Kafka topic modeluj v katalogu komponent jako analogii interface: element **`KafkaDesign::Kafka_Topic`**; jednotlivé eventy jako **UML operace** na něm — z modelu je vidět, kdo publikuje a kdo konzumuje (✅ KF1). ⚠ C1 2026-07-12: FQ typ padá, pokud MDG KafkaDesign v repu není (demo QEA nese ekvivalent `ThubDesignProfile::Kafka_Topic`) — v bridge dávce zadávej **nekvalifikovaně `Kafka_Topic`** a zpětným čtením (`get_elements_information`) ověř navázaný profil; MDG přidá výchozí topic TV (format/ordered/piloting/retentionTime).
- Servisní realizaci zakládej **i tehdy, když sekvenční diagram pro event nedává smysl** — SR je navigační uzel z katalogu do logického designu, ne popis časového průběhu. Zakládá se **stejným scaffoldem/skriptem jako běžná SR** (✅ KF2 — `emr-scaffold` režim C beze změny; lidský ekvivalent `Scripts/ITAN-Find or Create Referencing Service Realization.vbs`).
- Nositelem skutečné hodnoty je **DTO** — u eventu právě DTO popisuje strukturu zprávy, ne specifikace rozhraní.
- Směr toku a čtení/zápis rozlišuje stereotyp na message callu: **`CSOB-ITAN::LD-Publish`** (publikace/zápis) / **`CSOB-ITAN::LD-Read`** (konzumace/čtení) — báze UML::Message (✅ KF1).
- Stará synchronní rozhraní zůstávají kvůli zpětné kompatibilitě beze změny; nový event přístup používej jen pro nově vznikající analýzy, staré se hromadně nepředělávají.

## 11. Audit, autorství a bezpečné mazání (metodika v2, kap. 7.3–7.4)

- **Audit log** (historie změn na elementu) se otevírá přes konkrétní element, ne spolehlivě z diagramu. V advanced módu **nikdy nespouštěj bez časového filtru** — bez něj načtení trvá řádově minuty a zatěžuje prostředí. Postup: omez na den/interval, pak filtruj po uživatelích.
- Pole `Author` je nespolehlivé (přepisuje se kopírováním/verzováním) — nápravu dělá skript **`Scripts/ITAN-Change Author in Branch Content.js`** (✅ AU1 2026-07-06 — nastaví autora obsahu větve) + doplňková DB vrstva: views `ut_history_log_detailed`, `v_packages` (`references/emr-specific-views-and-tables.md` (skill `ea-sql-expert`)).
- Bezpečné mazání: smazání z diagramu **≠** smazání z modelu (element zůstává v repozitáři, jen mizí z pohledu) — skutečné mazání z modelu je rozhodnutí s dopadem na celý repozitář. Před mazáním vždy zohledni neviditelné vazby (objekt navázaný jinde nelze smazat bez dopadu) a znalost autora. Přehled sirotků k bezpečnému smazání = interní SQL dotaz správce EMR (✅ AU2 2026-07-06 — nesdílí se, na vyžádání u Miloše).
- Toto doplňuje, nenahrazuje mazací pravidla AI kanálu v §7c výše (`delete_from_model` dávkou přes bridge, HITL potvrzení u existujících artefaktů) — bridge cesta je operační mechanika, tahle kapitola je governance nad tím, kdy a proč mazat.

## 12. Bezpečný AI zápis — ochranné vrstvy (zapracováno 2026-07-06 z `ai-zapis/Koncepce-bezpecny-AI-zapis-EMR.md`)

Závazné pro každý zápis do **produkční** EMR (1M+ elementů); v demo/sandbox repozitáři se vrstvy trénují naostro (fáze P0). Model hrozeb H1–H7, fáze zavádění P0–P3 a zdůvodnění: koncepce. Rozhodnutí banky **R1–R9 jsou uzavřená 2026-07-06** (odpovědi MLA v koncepci §8) a promítnutá níže jako ✅ R#. Recovery postupy pro správce: `Restore-Runbook-AI-Zapis.md` (mimo workspace — vyžádej od uživatele).

### 12a. Asymetrie operací (politika)

| Operace | Politika |
|---|---|
| Create ve whitelistované větvi (pracovní prostor §6/P3, `…Proposed`, projektové větve) | ✅ + razítko (12b) + vykázaný objem (12e) |
| Create mimo whitelist | ❌ zamítnout; deny-list větví je navíc zamčen (12g) |
| Update AI-created elementu (vlastní razítko) | ✅ + journal (12d) |
| Update cizího elementu / cizího diagramu / konektor existující↔existující | ⛔ default; jen dvoukolově: **dry-run diff → schválení per GUID → snapshot + mikro-baseline → zápis**. Diff schvaluje **autor sám, s auditní stopou** — rozhodnutí se zapisuje do journalu/#AI-LOG (✅ R3) |
| Zásah do existujících GLOBAL VIEWS / survey diagramů | povolen **jen přes dry-run + schválení** jako každý jiný update cizího obsahu (✅ R9) |
| Nový konektor AI element → existující (trasovatelnost, Usage, Realization) | ✅ — nemění cizí element, jen na něj ukazuje; razítko na konektor |
| Delete konektoru/zprávy | ⛔ v P1 (nástroj vypnut); P2+ jen AI-created v rámci schválené dávky |
| Delete existujícího elementu | **delete-request workflow**: žádost člověku (GUID + zdůvodnění + dopady — výskyt na diagramech čtecí dávkou `query` nad `t_diagramobjects` JOIN `t_diagram` (K11: bridge nemá operaci pro hledání elementu na diagramech) + konektory); AI-created vlastní omyly v pracovním prostoru ✅ (§7c) |
| `apply_baseline` | ⛔ trvale (jen admin ručně v EA) |
| `clone_package`/`clone_elements` | jen ve verzovacím cyklu, objem vykazovat (12e) |

### 12b. Razítkování (provenience)

Každý AI-created element/konektor/diagram dostává tagged values: `AI-Created=true`, `AI-Session=<id>`, `AI-Batch=<id>`, `AI-User=<člověk>`, `AI-Tool=<cowork|zoo>`, timestamp. Schválený update cizího elementu navíc `AI-Modified=<session>`. Razítka jsou **trvalá** (rozhodnuto). Jedno SQL nad `t_objectproperties` = kompletní inventura session — základ UNDO (12f) i auditu. Na package přes `taggedValues` v `create_or_update_package` (§7; root packages TV mít nemohou — duální t_object je zakázaný, viz §7).

### 12c. Mikro-baselines

*Žádný zápis do existující package bez čerstvé baseline nejmenšího dotčeného package*: `create_baseline(X, "AI-pre-<session>-<batch>")` před prvním zápisem dávky. Nikdy baseline nad velkými složkami — drž se pravidla max ~5 dotčených packages per dávka. Nové packages (scaffold) baseline nepotřebují — undo = smazání. Výstup dávky vždy obsahuje **restore manifest** (package GUID → baseline název). Executor bridge přes Automation API (`Project.CreateBaseline(GUID, verze, notes)`) název zadat **umí** → baseline označí `AI-pre-<session>-<batch>` přímo; restore manifest v journalu + #AI-LOG Artifact zůstává jako druhá evidence. ✅ `create_baseline` je v protokolu bridge implementovaná jako **pojmenovaná** baseline (Dokumentace v0.9 §4.4; historicky K5 — naplněno). (⚠ Limit bezejmenné baseline — C1 2026-07-12, `create_baseline` vrací jen GUID — platí jen pro domácí MCP.) Retence AI-pre baselines: **30 dnů po schválení brány** (✅ R6), úklid dle runbooku.

### 12d. Journal a před-update snapshoty

Před každým schváleným updatem přečti cílový element (`get_elements_information` vč. atributů, operací, TV, konektorů) a staré hodnoty ulož do **session journalu**: soubor v `emr-bridge/archive/` + Artifact per session v **`/Groups/#AI-LOG`** (✅ R5; sandbox pro P0 = `/Groups/#AI-SANDBOX`). Retence #AI-LOG: 12 měsíců (✅ R6). Revert dávka se sestavuje z journalu (UNDO tier 1).

**⚠ Journal je JEDINÝ zdroj starých hodnot** (✅ R1): DB trigger vrstva (view `ut_history_log_detailed` — viz `references/emr-specific-views-and-tables.md` (skill `ea-sql-expert`)) loguje jen kdo/kdy/co změnil (autor, modifier, mover + datumy) a v rámci dne drží nad objektem jen timestamp poslední změny. Hodí se pro detekci a audit, **ne pro obnovu polí** — snapshot před updatem proto nikdy nevynechávej.

### 12e. Kvóty a circuit breakers (✅ R2 — zatím se NEVYNUCUJÍ)

Kvóty se v této fázi **neaplikují jako tvrdý stop**. Orientační úrovně (nové elementy 50/150 · updaty 5/20 · packages 3/5 · diagramy 10/25 · klonování 100/300) slouží jako signál: skill/EMR agent **vždy vykazuje objem dávky v result** a při překročení soft úrovně si vyžádá potvrzení — potvrzuje **sám uživatel** v session. Hard stop „jen admin" se odkládá: uvnitř AI session nelze identitu admina technicky odlišit od uživatele — až bude potřeba, vynutí se mimo session (EA security: AI účet nedostane práva nad limit; procesně: pokračování = nová dávka spuštěná správcem EMR pod jeho účtem). Denní audit dashboard: SQL nad razítky + `ut_history_log_detailed` (AI aktivita per účet/session/větev, anomálie).

### 12f. UNDO (recovery matice)

**T1** pole změněná updatem — revert dávka z journalu (AI sestaví, člověk schválí) · **T2** vše ze session — SQL nad `AI-Session` → **JScript uvnitř EA (t_script)** mazající přes EA API, **nikdy přímý SQL DELETE** (✅ R8) · **T3** celý package — restore z `AI-pre-*` baseline dle restore manifestu (provádí správce EMR / pověření uživatelé) · **T4** katastrofa — dočasná DB + XMI (stávající postup). Postupy krok za krokem: `Restore-Runbook-AI-Zapis.md` (mimo workspace — vyžádej od uživatele). Pravidelný **UNDO drill** je exit kritérium P0.

### 12g. Tvrdé ploty mimo dosah skillu (konfigurace, ne prompt)

Skill s nimi počítá, ale nevynucuje je — jsou vynucené identitou a konfigurací: párové AI účty `<uzivatel>_AI` ve skupině `AI-Agents` (✅ R4 — schváleno, **max 5 pilotních uživatelů v P1**) → trigger log odliší AI zásahy zadarmo; defenzivní zámky na deny-list větvích — Catalogues master, `#Template structure`, šablony BA, root packages (✅ R7 — zámky přiděluje **správce EMR**, formální admin skupina neexistuje; citlivé sdílené části modelu se hlídají takto); selektivní povolení **operací v executoru bridge** — whitelist operací vedle whitelistu packages, konfigurace zadání bridge it. 3/K4 (`apply_baseline` neimplementován trvale, delete operace vypnuty v P1); doma ekvivalentně povolení MCP tools per klient.

## 13. Reference na kód (GitHub) — konvence `code-*` a `re-origin` (✅ rozhodnuto 2026-07-12, `RE/Koncepce-Reverse-Engineering-GitHub.md` §4+§11)

**TV sada (závazná konvence, styl P1–P3):**

| TV | Význam | Příklad |
|---|---|---|
| `code-repo` | URL GitHub repozitáře s kódem služby | `https://github.com/<org>/transaction-service` |
| `code-path` | cesta ke kontraktu nebo vstupnímu bodu (controller, consumer) | `src/main/kotlin/.../TransactionController.kt` |
| `code-ref` | commit SHA / tag, ke kterému reference platí | `a1b2c3d` |
| `code-verified` | datum posledního ověření shody reference | `2026-07-12` |
| `re-origin` | `code` = obsah artefaktu vygeneroval RE proces z kódu | jen na RE-generovaných |

**Pravidla:**

- **Umístění:** primárně **operace v katalogu komponent** (jeden zdroj pravdy pro reuse); service package v LD jen doplňkově. Zápis standardním polem `taggedValues`.
- **Master mapování je `RE/repo-map.yaml`** (složka `RE/` v IT-ANALYSIS; rozhodnutí O3, přesun z rootu 2026-07-13) — komponenta → repo/adresář. `code-*` TV na operacích jsou derivát mapy; při nesouladu platí mapa a TV se opraví.
- **Párování ≠ provenance (O2):** `code-*` může nést i ručně analyzovaný artefakt (jen napárovaný na kód). `re-origin=code` se dává **výhradně** na artefakty, jejichž obsah vygeneroval RE proces — nikdy ne při pouhém párování.
- **Vztah k AI razítkům (§12b):** `AI-Created` říká *kdo zapsal* (AI), `re-origin=code` říká *odkud obsah pochází* (z kódu, as-implemented). Jsou nezávislé: AI-created artefakt z business zadání `re-origin` nemá; RE-generovaný artefakt nese obojí.
- **Pravidlo čtení (závazné pro všechny skilly):** najdeš-li na operaci/packagi `code-repo`/`code-path`, čti kontrakt/kód jako **fyzickou pravdu** (chová se jako `contractAuthority=physical`, §6 metodiky/§7e) a obsah EMR jako logický komentář. Najdeš-li `re-origin=code`, jde o strojový as-implemented přepis — nezaměňovat s analytickým návrhem, konflikty hlásit člověku.
- **Chatrná dokumentace reusované operace →** skill `re-interface` (✅ fáze B 2026-07-12; postup RE-IF dle `RE/Koncepce-Reverse-Engineering-GitHub.md` §6, mezivrstva IR dle [ir-format](ir-format.md)): extrahuj jen kontrakt operace, zapiš odkaz + shrnutí do notes + `code-*` TV. I při zamítnutí reuse referenci zapiš.
- **MQ (✅ O1):** MQ nálezy v kódu = běžné operace MQ komponenty (vzor T-Hub), žádné queue elementy; detail topiců/eventů jen u Kafky (§10).
