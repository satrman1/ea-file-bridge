# Pravidla zápisu do EMR (sdílená reference)

Skilly se nevolají jako funkce — každý produkční skill se těmito pravidly řídí **přímo**. Před zápisem si vždy načti i `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) (ověřené vzory z repozitáře). Metodický zdroj: `Metodika Systémové analýzy v2.md` (mimo workspace — vyžádej od uživatele).

**Kanál zápisu = AI kanál:** doma EA MCP (test/vývoj), v bance výhradně **ea-file-bridge** (`Zadani-EA-File-Bridge.md` (mimo workspace — vyžádej od uživatele), `Dokumentace-EA-File-Bridge.md` (mimo workspace — vyžádej od uživatele)). Protokol bridge zrcadlí MCP tooly, názvy operací platí beze změny. Verzní specifika a startovací mechanika domácího MCP serveru platí jen doma (§14).

Provenance pravidel (kdy, z čeho a místo čeho pravidlo vzniklo) je v `emr-zapis-changelog.md` — není součástí instrukcí, při práci se nečte a do kitů se nekompiluje.

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

- **UC**: `UC-#####` — prefix `UC-`, 5místné číslo. `UCR-#####` sdílí číslo s UC. Přidělení čísla se liší podle repozitáře:
  - **Banka:** číslo UC přiděluje repozitář sám při create elementu (mechanismus nad `t_object`). Přes AI kanál posílej UC **bez prefixu** (jen věcný název), číslo přečti z ACK a teprve pak zakládej odvozeniny (UCR/BRU/LS).
  - **Doma (`eaexample`):** čísluje EA Auto Name Counter, ale při create přes AI kanál se **neaplikuje** — element vznikne s přesně zaslaným jménem (i prázdným). Postup: (1) dohledej nejvyšší obsazené `UC-#####` v cílové větvi (find_elements/SQL) a přiděl max+1; (2) ve výstupu skillu vykaž **„posunout Auto Name Counter na <N+1>"** jako HITL krok — jinak příští UI-založený UC dostane duplicitní číslo; (3) duplicitu čísel hlídá QA.
- **LS** (zdroj `ls-rules.png` (mimo workspace — vyžádej od uživatele)): **`SSS-LS<čísloUC>[-Y]_Název v češtině`** — SSS = zkratka systému; číslo UC, který LS primárně realizuje — **celé, bez zkracování** (u 5místného counteru tedy `PAY-LS90002_…`; příklady v ls-rules jsou z kratší řady), při více UC libovolný z nich; Y = pořadové číslo, když jeden UC realizuje více obrazovek. Doporučené názvy: „Přehled…", „Detail…". Příklady (formát): `PAY-LS002_Přehled pohybů na účtu`, `PAY-LS002-1_Detail pohybu na účtu`. **LS part**: název česky, v jednotném čísle (multiplicitu nese aggregate vazba). **LS operace**: CamelCase název podstaty uživatelské akce (`NewMessage`, `FilterMessageList`…), popis česky — ze scénáře UC musí být jasné, kterou operaci aktér použil.
- **BRU**:
  - **Přepoužitelná** pravidla `BRU-####` (vlastní řada): **samostatný element** typu `Behavioral Rule` v `RULES (REUSABLE)`, UC —Usage «use»→ BRU.
  - **Lokální** pravidla UC `BRU<čísloUC>-Y` bez pomlčky (např. `BRU91001-1`): **internal requirement uvnitř UC** (záložka Responsibilities → Requirements, `t_objectrequires`; text pravidla v poli Requirement/Notes), přesně dle metamodelu scenario-rules „Behavioral Rule - local [Requirement internal]" — ne samostatný element, bez konektoru. Stejná logika jako scénáře (→ Scenarios tab) a constrainty (→ Constraints tab). Zápis dávkou přes bridge operací `create_or_update_requirements` (§7).
- Ostatní: služby `SR <NázevSlužby>`, `DTO <NázevSlužby>`; verzovací diagram `version_<Název nadřízené package>`; požadavky `<JIRA-ID> Název`; release postfix package `ARELYYMM`; prefix `#` jen pro technické package (#ARCHIVE, #TODO-IN/OUT, #UNSORTED).

## 4. Typy (MDG — používat doslovně, včetně překlepu)

- Diagramy: `CSOB-ITAN::FA-Behavioral`, `CSOB-ITAN::FA-Structural Detail`, `CSOB-ITAN::FA-Sturctural Overview` (!), `CSOB-ITAN::LD-Behavioral`, `CSOB-ITAN::LD-Structural`, `CSOB-ITAN::Version Root Diagram`, `UML Behavioral::Sequence`, `UML Structural::Class`, `IDS-IDesign::Service Contract Detail`.
- Elementy/stereotypy: UseCase, Actor, `Use Case Realization`, `Logical Screen`, `Logical Screen Part`, `Behavioral Rule`, `Service Realization`, `Data Transfer Object`, `Entity`, Requirement, `IDS-Client/Manager/Engine/Resource Access/DB Resource/Subsystem`, DataType (`dt*`).
- Kafka: topic = **`KafkaDesign::Kafka_Topic`**; eventy = UML operace na topicu; message cally stereotypy **`CSOB-ITAN::LD-Publish`** (publikace/zápis) / **`CSOB-ITAN::LD-Read`** (konzumace/čtení), báze UML::Message. ⚠ V dávce ea-file-bridge (`create_or_update_elements`) zadávej type nekvalifikovaně `Kafka_Topic` (§10, §7h; chování FQ typů zjištěno na MCP — revalidovat v executoru).
- Kompozitní elementy (UC, UCR, LS, SR, DTO) mají linked diagram **pod elementem** (owning ElementID).
- **Priorita při konfliktu: vzor v modelu > pravidla/kompilát** — před zápisem nového typu artefaktu si reconem přečti typování existujícího vzoru v cílovém repozitáři a drž se ho. **Repozitář bez MDG CSOB-ITAN** (sandbox): fallback = základní UML typ + stereotyp (např. BRU = `Requirement` + stereotyp `Behavioral Rule`); v EMR s MDG vždy plný `type`.

## 5. Konektory

| Vazba | Typ | Směr |
|---|---|---|
| Aktér – UC | Association | aktér → UC |
| UCR – UC | Realization | UCR → UC |
| LS – UC | Dependency | LS → UC |
| UC – BRU **(jen přepoužitelné `BRU-####`)** | **Usage («use»)** | UC → BRU |
| UC – lokální BRU `BRU<čísloUC>-Y` | **žádný konektor** — je to internal requirement uvnitř UC (§3) | — |
| UCR – služba/operace/DTO (impact) | Usage | UCR → cíl |
| Požadavek – UC (traceabilita) | Realization (dle metamodelu) | UC → požadavek |
| UC – Core UC (Dynamic View) | Trace | UC → `IDS-Core Use Case` |
| Dynamics – Core UC | Realization | `IDS-Core Use Case Dynamics` → Core UC |
| Entita – entita | Association s multiplicitami | dle modelu |

**Všechny vazby zapisuj s `direction: FromSourceToTarget`** (LS depends UC, UCR realize UC, UC realize požadavek, UC use BRU, UC trace Core UC) — enum hodnoty viz §7h; updaty direction jen po jednom (§7g).

### 5b. Message cally v sekvencích

- **Aktér → FE** (na UCR): vazba na operaci se **nedělá**.
- **Od FE dále** (FE → komponenta, komponenta → komponenta): vazba call → operace (operationID) **vždy povinná** — QA kontroluje (B).
- **Self cally**: vazba nepovinná, nekontroluje se; často jen slovní popis, co se děje „uvnitř".
- **CRUD zprávy na entity (DB hrana)**: vazba na entitní CRUD operaci (`C/R/U/D`) **povinná**.
- **Sync/async**: vlastnost zprávy `isAsynchronous`; soulad s typy volání v Dynamic View (`IDS-Sync`/`IDS-Async`) kontroluje QA.

## 6. Stav artefaktu a Gate Records (P1–P3)

- **P1 — stav artefaktu:** tagged value `SA-Status` ∈ {proposed, approved, baseline} **na úrovni package** (UC package, service package, LDM package). Ne na jednotlivých elementech — jedno místo pravdy, dotazovatelné SQL.
- **P2 — Gate Records a QA reporty:** element typu **Artifact** per záznam v `/Projects/<Projekt>/#GATES` resp. `#QA`. Tagged values: `gate` (G0–G3 / sada QA), `datum`, `rozhodl`, `vysledek` (approved/rejected resp. pass/fail), detail v notes.
- **contractAuthority:** tagged value na package rozhraní / service package, hodnoty `model` | `physical`. `model` = DTO/class model je zdroj pravdy (rozhraní navrhujeme a vlastníme → DTO modeluj); `physical` = existující XSD/JSON kontrakt je zdroj pravdy (DTO nanejvýš dočasný komunikační artefakt → jen odkaz, nemodelovat kopii). Bez TV rozhodni dle metodiky v2 §5.4.5 a TV navrhni doplnit.
- **P3 — pracovní prostor:** skilly **nezapisují rovnou do ostrých větví**. Zápis jde do pracovního prostoru (obdoba `…Proposed` — pro katalog přímo `Solution Artefacts Proposed`, pro UC/LD pracovní package projektu), do ostré větve se artefakty přesouvají až po schválení příslušné HITL brány. Přesun provádí/potvrzuje člověk nebo skill na jeho explicitní pokyn. Pracovní prostor vynucuje kit (věta „Zapíšu do: <plná cesta>" před prvním zápisem úlohy) a zámky správce EMR, ne kód bridge — bridge pustí zápis kamkoli, kam uživatele pustí EA security, kromě chráněných větví (blacklist, 12a).

## 7. Operace AI kanálu (ea-file-bridge) a manuální kroky

Limity zjištěné na domácím MCP je třeba per položka revalidovat proti executoru bridge (Automation API má jiné limity).

- **Scénáře UC** se zapisují strukturovaně do **Scenarios tab** operací bridge `create_or_update_scenarios` (PROTOKOL-EAFB §6b): scénáře BE/AF/EF s `type` Basic Path/Alternate/Exception, kroky `steps[{text, kind: actor|system, uses, results, state}]`, větve AF/EF kotvené `attachTo{scenario, step}` + `join`. **`join` (návrat větve do toku)** se v dávce zadává jako **číslo kroku hostitelského scénáře** (metodicky „návrat do kroku M"; executor ho přeloží na GUID kroku); `"End"` nebo vynechané pole = větev končí; jméno scénáře, číslo mimo rozsah i `join` bez `attachTo` = warning + End. **Návrat formuluj na úrovni KROKU** — EA to tak drží i v UI (Scenarios → Entry Points, sloupec `Join`). Update = deterministický rebuild V2d. **Notes UC se pro scénáře nepoužívá** (jen Scenarios tab — žádné zrcadlo). BRU: z kroků odkazem přes ID (pole `uses`); lokální `BRU<čísloUC>-Y` jsou internal requirements uvnitř UC (§3), ne samostatné elementy pod UC.
- **PRE/PST/ASU constrainty UC**: umístění = **internal constraints** (záložka Constraints, `t_objectconstraint`); zápis dávkou přes bridge operací `create_or_update_constraints`.
- **Přesun elementu mezi packages**: operace **`move_elements`** (`package` jako společný cíl a/nebo `elements` s položkami `{element, package}`; vlastnění potomci i diagramy jdou s ním; prvek už v cíli = nic se neděje). Přesun je v Risk Gate **vždy ELEVATED** — čeká na lidské potvrzení, v souladu s P3 (§6: přesun mezi pracovním prostorem a ostrou větví provádí/potvrzuje člověk). ⚠ Pole `package` v update větvi `create_or_update_elements` element **nepřesouvá** — vrací o tom warning s odkazem na `move_elements`.
- **Lokální BRU jako internal requirement** (§3): operace **`create_or_update_requirements`** (`element` + `requirements[{name, notes, type?, status?, priority?}]`, `t_objectrequires`, záložka Responsibilities → Requirements; deterministický rebuild V2d jako u constraintů — dávka nese kompletní sadu; `type` = ReqType, default `Functional`, nevaliduje se). **Přepoužitelná** `BRU-####` sem nepatří — jsou samostatným elementem v `RULES (REUSABLE)` + konektor Usage.
- **Tagged values na package**: operace `create_or_update_package` s top-level parametrem `taggedValues` (pole `[{name, value}]`) dávkou přes bridge, na create i update non-top-level package; TV se čte zpět přes `get_packages_information`. ⚠ **Root (top-level) packages TV mít nemohou** — limit EA, ne kanálu. Package vždy zakládej výhradně přes `create_or_update_package`: element založený s type `Package` skutečnou package nevytvoří (chybí `t_package`) a vzniká neviditelný sirotek (náprava: Project Integrity Check) — oklika přes duální `t_object` package je zakázaná.
- **Změna typu elementu**: updatem `create_or_update_elements` (Dokumentace bridge §4.2). Smaž-a-založ (`delete_from_model` + nové založení) jen nouzově u elementů bez externích vazeb — ztrácí GUID, konektory i razítka.
- **GUID elementů**: bridge response GUIDy vrací (`query`). Pro RefGUID tagged values (505-1) GUID není potřeba — zapisují se `ids` strukturou (§7h).
- **Mapovací Excel, baseline diff UI** — mimo AI kanál; skill je označí jako handoff člověku. Infoport žádný export/publikaci nepotřebuje (tenký klient nad EMR) — manuální je jen kontrola čitelnosti (checklist bod 15). Session baseline dělá pumpa bridge automaticky; explicitní **pojmenovaná** `create_baseline` per package je v bridge k dispozici, k ní čtecí `get_baselines` + `baseline_diff` (Dokumentace bridge §4.1/§4.4); `apply_baseline` je pro AI trvale zakázán (§12a) — ekvivalent se nezavádí. Sémantika mapovacího Excelu (sloupce, sheety, `CALL IF`/`CREATE FOR EACH`/překlady/vícevolací fasáda) je zdokumentovaná v `current-implementation.md` (mimo workspace — vyžádej od uživatele) — použij jako referenci pro tvar Excelu, který skill/analytik předává. Dlouhodobě se plánuje náhrada Excelu YAML notací + Mapping Studio mimo EA (`INTERFACES/`, `Feedback-Interfaces-Integrace.md` (mimo workspace — vyžádej od uživatele)) — je to organizačně závislý budoucí modul (Git repo, Actions), ne dnešní konvence.
- **External Reference (Boundary)** elementy negeneruj — vytváří je EMR addin; při čtení je ignoruj.

## 7b. Bankovní režim (VS Code, ea-file-bridge)

V bance agent MCP **nikdy** nemá — MCP je zakázané, bridge je cílový bankovní stav. Zápis i čtení jde vždy JSON dávkou do `requests/` dle ea-file-bridge (`Zadani-EA-File-Bridge.md`); výsledek (GUIDy, výpisy, QA) agent převezme z `responses/`. Dávkové konvence viz [emr-bridge-protokol](emr-bridge-protokol.md). Pravidla §1–§7 platí beze změny — validuje je executor AICodeBridge před zápisem.

## 7c. Zápisové vzory: typy, tagged values, mazání

- **MDG typy zadávej jako `type`**, ne jako stereotyp: `CSOB-ITAN::Use Case Realization`, `CSOB-ITAN::Service Realization`, `IDS-IDesign::IDS-Engine`… Stereotyp přidaný k obecnému typu (UseCase, Class) se **tiše zahodí**. (Výjimka: `CSOB-ITAN::Data Transfer Object` jako stereotyp ke Class projde — přesto preferuj type.)
- **MDG elementy si samy založí kompozitní diagram** (název „Collaboration" / „Component") — nevytvářej duplicitní, jen ho přejmenuj (`create_or_update_diagram` s existujícím diagramID). Detail per typ elementu §7g.
- **Tagged values na elementech: pole `[{"name": …, "value": …}]`** — objektový zápis `{"name": "value"}` selže chybou. `505-1 Operation Link` a další RefGUID tagy zapisuj `ids` strukturou (§7h).
- Všechny MDG typy diagramů (`FA-Behavioral`, `Version Root Diagram`, `Sequence`, `Class`) i konektory (Association, Realization) a přesměrování konektoru na jiný element fungují.
- `create_or_update_operations` funguje (operace na komponentě/interfacu); response vrací GUID parametrů (ne operace).
- **Mazání:** `delete_from_model` maže Package, Diagram, Element, Connector, Attribute, Operation, Parameter i tagged values; `remove_elements_from_diagram` odebere element z diagramu bez smazání z modelu. Tagged values z package/atributů/operací/konektorů maže **`delete_taggedvalue_from_model`** (funguje i s type `ConnectorTaggedValue` — mazání `operation_guid` — a `OperationTaggedValue`). V bance = dávka přes bridge (Dokumentace bridge §4.2); povolení delete = konfigurace whitelistu operací executoru — dokud jsou delete operace v produkci v deny, platí handoff člověku (`delete-request` v bridge protokolu). Mazání používej zdrženlivě: primárně na vlastní omyly v pracovním prostoru; existující artefakty nikdy nemaž bez HITL potvrzení.
- **Revert dávka z journalu** (UNDO T1, §12f) je plně proveditelná přes AI kanál: update operace s `description: ""` notes skutečně vyprázdní, TV maže `delete_taggedvalue_from_model`; podmínkou je povolení delete/update operací ve whitelistu executoru.

## 7d. Sekvenční diagramy a zprávy

Zprávy zapisuje operace bridge `create_or_update_messages` (Dokumentace bridge §4.3 — operace, argumenty, návraty, seqNo; opt-in `rebuild: true` = server-side deterministický rebuild). Ruční krok / handoff člověku platí jen tehdy, když je operace v produkci držená v deny whitelistu executoru. Vzory níže platí pro celý AI kanál.

- **Typ diagramu:** message operace akceptuje MDG typ `UML Behavioral::Sequence` — auto-kompozit UCR/SR se používá **přímo**, bez mazání a zakládání plain `Sequence` (výjimka pro starý domácí MCP: §14).
- **Diagram musí být při zápisu zpráv otevřený v EA** (`open_diagrams`), jinak „hidden diagrams" chyba.
- **`place_elements_on_diagram` VŽDY s `width` i `height`** — bez nich se nový element tiše neumístí (žádná chyba; sémantika částečného updatu §7h). Lifeliny umísti PŘED zápisem zpráv — závazné pořadí: place lifeliny → messages. Zpráva jde vytvořit i na SD bez umístěných lifelinů — vznikne neviditelný konektor.
- **Zprávy patří interakci, ne diagramu** — zobrazí se na každém diagramu se stejnými lifelinami. Nezakládej „opravný" druhý diagram; oprav zprávy samotné.
- **Čtení zpráv:** `get_diagrams_information` u `Sequence` typu vrací blok `Sequence messages` (connectorID, name, related operationID, return value); alternativa `get_connectors_information` po connectorID (typ `Message`). ⚠ Podmínka: lifeliny musí být na diagramu umístěné s plnou geometrií — neumístěné lifeliny = žádné zprávy ve výpisu. ID nových zpráv = pokračování číselné řady konektorů.
- **Update zpráv funguje** (connectorID + sourceElementID/targetElementID povinné) — jméno lze doplnit bez ztráty vazby na operaci.
- **`operationID` vazba na zprávě** ukládá tagged value `operation_guid` a **jméno/argumenty/návratová hodnota se synchronizují z operace už při create** (response vrací name + arguments se jmény parametrů + return value; diagram vykresluje plnou signaturu `DoBind(requestId, verbose): boolean` — chování ruční vazby; platí pro operaci přes realizovaný interface i přímo na klasifikátoru). Name-only follow-up update se pro nové zprávy nedělá; operace je v GUI dialogu zprávy vybraná, ruční kontrola GUI vazby v handoffu odpadá (výjimka pro zprávy ze starého domácího MCP: §14).
- **1 call = 1 konektor** s connectorID v response. Kontrola číselné řady po dávce zůstává jako levná pojistka.
- **Kanál nevaliduje, že operace patří lifeline** — shoda operace s classifierem cílové lifeline je odpovědnost AI a QA.
- **Žádné apostrofy v textech zpráv** — neescapované `'` shodí zápis SQL chybou; část dávky se předtím může stihnout zapsat.
- **Chybná dávka může částečně projít** — po chybě vždy zkontroluj konektory po ID a přebytky smaž `delete_from_model` (type Connector).
- **InteractionOccurrence**: element s `classifierID` = SR element; render „ref" fragmentu funguje (umístění a klikatelnost §7g).

## 7e. Konvence artefaktů (shoda s ITAN skripty)

Zdroj: `Scripts/ITAN-*.vbs` — produkční EA skripty pro ITANy; **spustitelná specifikace cílového stavu**. AI zápis musí produkovat identické struktury.

- **Diagramy založené přes API nemají autora** — nastavuj `Author` (jméno analytika), `Version` = „1.0"; na version diagramu navíc `ShowDetails` = 1 (zobrazuje verzi). Přes bridge: `create_or_update_diagram` nastavuje na create vždy Author + Version a `update_diagram_properties` umí jméno/autora/verzi/showDetails/styleEx (Dokumentace bridge §4.3).
- **`IsComposite`**: v bridge `create_or_update_elements` podporuje kompozitní elementy (Dokumentace bridge §4.2); domácí MCP parametr tiše ignoruje. Nouzový fallback pro starý obsah: EA skript `element.IsComposite = True` per element (viz Scripts/). Kontrola v QA: element s owned diagramem bez IsComposite = nález W. Platí i pro MDG typy (UCR/SR), kde kompozit vzniká automaticky.
- **StyleEx s MDGView**: UC detail diagram `MDGDgm=CSOB-ITAN::FA-Behavioral;MDGView=CSOB-ITAN::Use Case Detail;` · SR impact view `MDGDgm=CSOB-ITAN::LD-Behavioral;MDGView=CSOB-ITAN::Realization Impact View;` — MDGView napojuje diagram na View Definition z metamodelu.
- **DTO vnitřní struktura**: `<Služba>Req` a `<Služba>Res` (Class) pod DTO, vazby **Composition** Req/Res → DTO (supplier end aggregation=2, client end non-navigable); DTO —Dependency **«refine»**→ SR. V bridge dávce (`create_or_update_connectors`): typ „Composition", **source=DTO, `sourceEnd.aggregation=2`, target=Req/Res** (diamant u DTO; vlastnosti pole `aggregation` viz §7f); stereotyp refine na Dependency funguje.
- **Katalog-first tok služby**: SR se zakládá **od operace v katalogu** (dohledej referencující SR přes SQL; když není, založ service package) — 505-1 je vyplněné konstrukčně. SQL vzor: `t_objectproperties WHERE Property='505-1 Operation Link' AND Value='<MethodGUID>'`.
- **SR base type = Collaboration** (stereotyp Service Realization) — relevantní pro SQL dotazy.
- **Šablonové notes**: nové artefakty přebírají instrukční (zelené) texty ze šablon `#Template structure` — GUIDy šablon viz `EA-Repozitar-Kontext.md` §13. Přes bridge: číst šablonu (`get_elements_information`), kopírovat description.
- **SR Impact View**: volitelný diagram pod SR elementem (`CSOB-ITAN::LD-Behavioral` + MDGView Realization Impact View).
- **UCR se zakládá i skriptem z UC** (Create UC package from UC): UC vznikne první, package se vytvoří kolem něj a UC se do ní přesune — ergonomie pro člověka; výsledná struktura identická se scaffold B.

## 7f. Vzory modelu: UC detail, vrstvení realizací, agregace, atributy

- **UC detail diagram má System/Module Boundary** (typ `Boundary`, název dle BA/modulu). Uvnitř: UC, UCR, LS, BRU, Core UC; **aktér a požadavky vně**. Element patří na diagram, jen když je celým obrysem uvnitř boundary.
- **Vrstvení realizací**: UCR končí na **Manageru** (aktér → FE/Client → Manager + ref na SR služby Manageru). Každé překročení hranice komponenty = vlastní služba s vlastním SR: SR Manager služby (Manager+RA lifeliny, ref na další SR) → SR DB služby (RA + entity, CRUD). RA se NIKDY neobjevuje na UCR. Impact řetěz Usage kopíruje ref řetěz: UCR→SR(Manager)→SR(DB).
- **Lifeliny nesou stereotyp classifiera** (viz `Scripts/ITAN-Apply Classifier Stereotypes on SD.vbs`): komponenty `IDS-Client/IDS-Manager/IDS-Resource Access…`, entity `entity` (kruhový glyf). Zápisový vzor lifeline §7g, pravidla pole `stereotypes` §7h.
- **První/poslední volání sekvence přes Diagram Gate**, ne MessageEndpoint (create gatu §7h).
- **LS agregace**: diamant u Logical Screen — v bridge dávce (`create_or_update_connectors`) **source=LS, `sourceEnd.aggregation=1`, target=part**. Stejná logika pro DTO kompozice (§7e): source=DTO, `sourceEnd.aggregation=2`, target=Req/Res (EA vrací type „Aggregation" i pro Composition). `aggregation` je **write-once** — na update se ignoruje; platí na tom konci konektoru, kde je zapsána (chování zjištěno na MCP — revalidovat v executoru).
- **Atributy dle katalogu konvencí** (`references/attribute-naming-conventions.md` (skill `structural-modeller`)): anglicky, PascalCase, kvalifikátor typu na konci (PeriodFromDate, ne DateFrom!), popis česky. Platí pro LS parts, DTO Req/Res i parametry operací.
- **Update atributu bez `typeElementID` shodí classifier typu** (a `order`) — při updatu vždy posílej kompletní údaje (name, type, typeElementID, order). Limit zjištěný na MCP — revalidovat proti executoru.

## 7g. Lifeliny, konektory, dávky a FIX skripty

- **Lifeliny na SD = NEPOJMENOVANÉ INSTANCE, ne komponenty.** Vzor: `create_or_update_elements` s `type: "Object"`, **`name: ""` explicitně** (§7h), `classifierID` = komponenta katalogu, `stereotypes` = **plain stereotyp classifiera** (`"IDS-Manager"`, nekvalifikovaně — §7h). Na diagramu se zobrazí `:NázevKomponenty`. Lifeline nikdy nezakládej s MDG typem v poli `type` — vznikla by plnohodnotná katalogová komponenta vč. auto-kompozitu Service Contract Detail. Konverzi Type `Object`→`Component` (cílový stav dle `Scripts/ITAN-Apply Classifier Stereotypes on SD.vbs`) řeší operace bridge **`apply_classifier_stereotypes`** — idempotentní port ITAN skriptu, dorovná Type + stereotyp dle classifiera (Dokumentace bridge §4.4); závěrečný FIX skript kola je jen nouzový fallback. **Entity lifeliny**: `Object` + classifier entita + stereotyp `entity`, bez konverze typu. QA hlídá kontrolou 9f.
- **Komponenta —Realization→ interface je povinná součást katalogového zápisu** — bez ní EA nenabízí operace interfacu k navázání na message cally. **Před přiřazováním `operationID` ověř Realization pro KAŽDOU cílovou lifeline** vč. RA pass-through.
- **Updaty konektorů VÝHRADNĚ po jednom** — dávka direction-updatů umí zaseknout EA (restart, nezapíše se nic); create dávky fungují.
- **Ref (InteractionOccurrence) se umísťuje bezprostředně POD message call volané operace** (ne na spodek diagramu). Přes AI kanál `classifierID` nastaví jméno refu, ale ne odkaz na diagram; klikatelnost doplňuje skript `Element.SetCompositeDiagram(classifier.CompositeDiagram.DiagramGUID)`.
- **Chybová dávka konektorů může celá projít**, i když bridge response vrátí error — po chybě VŽDY zkontroluj číselnou řadu (duplicity!). Pravidlo platí obecně pro AI kanál. Platí i pro „úspěšný" zápis: QA vykazuje jen zpětně přečtený stav.
- **Dávka elementů s neznámým MDG typem spadne celá a nic nezapíše** (chování opačné než u konektorů) — číselnou řadu elementID po chybě přesto vždy zkontroluj.
- **`create_or_update_package` umí intermitentně selhat** `Failed to update the specified element property` — retry pomáhá; při selhání se nic nezapíše (řada packageID souvislá, žádný orphan), přesto po chybě řadu zkontroluj.
- **MDG elementy (LS, DTO, UCR, SR) si auto-zakládají kompozitní diagram** (zakládá je EA/MDG, ne kanál): u **LS** vzniká rovnou jako **`CSOB-ITAN::FA-Structural Detail`** (jen se jménem „Class"), u **DTO** rovnou jako `UML Structural::Class` se jménem „Class" — **nemazat, jen přejmenovat a použít**; u **UCR/SR** se auto-kompozit `UML Behavioral::Sequence` **používá přímo** (§7d). Chování revalidovat přes bridge.
- **VBS pro FIX skripty:** `on error resume next` je procedure-scope (do každé sub); `EnableUIUpdates=false` na dávky (jinak EA visí na překreslování; vypadá pak jako Not Responding — sledovat Output); `GetCurrentLoginUser` bez user security hází chybu; Realization komponenta→interface při hromadném Update umí viset (řešit jednotlivě/ručně); `Connector.Update()` v API vrací false bez vyhození chyby — vždy kontroluj návratovou hodnotu + zpětně přečti. **Poslední řádek skriptu = holé volání `Main`** — jinak skript „doběhne a nic neudělá".

## 7h. Parametry operací AI kanálu: ids, DiagramGate, stereotypy, direction, typy, parametry

Evidence k chování domácího MCP: `mcp-vendor (mimo workspace)` (bug report, odpovědi vendora, raw schéma).

- **RefGUID tagged values (505-1 Operation Link aj.) zapisuj `ids` strukturou** — funguje na elementech i konektorech, GUID není potřeba:

  ```json
  "taggedValues": [{"name": "505-1 Operation Link", "ids": [{"type": "Operation", "id": 68}]}]
  ```

  `type` ∈ Package | Diagram | Element | Connector | Attribute | Operation | Parameter (dle schématu; prakticky ověřeny Element a Operation). V modelu je uložená hodnota raw `{GUID}`. **Čtení vrací RefGUID TV rozresolvovaně** `{name, type, ID}` — QA kontrola cíle bez SQL; bridge čtení (`get_*`) vrací RefGUID TV ve stejném tvaru.
- **Diagram Gate: `create_or_update_elements` s type `"DiagramGate"`** dávkou přes bridge (ověřit v executoru) — vznikne skutečný gate: sedí na interaction frame, zprávy se připojují. Type `Gate` a `MessageEndpoint` na create nepoužívej (první padá, druhý vytvoří obyčejný endpoint).
- **Stereotypy: v poli `stereotypes` VŽDY nekvalifikovaně** (`"IDS-Manager"`) — plain jméno je MDG-bound na create i update; FQ jméno se v `stereotypes` záměrně ignoruje (tiše zahodí; chování MCP serveru — v executoru revalidovat). **FQ název = pole `type`** (`{"type": "IDS-IDesign::IDS-Manager"}` → plný MDG element s FQ stereotypem, auto-kompozitem a default TVs) — jen pro katalogové MDG elementy, NIKDY pro lifeliny (§7g). Po zápisu stereotyp zpětně přečti (read vrací stereotyp vždy plain).
- **`direction` na konektorech** (create i update): hodnoty **`FromSourceToTarget` | `FromTargetToSource` | `BothDirection` | `Unspecified`** — NE EA API řetězce („Source -> Destination" padá).
- **MDG typ zadaný FQ padá, když technologie v repu není** (`KafkaDesign::Kafka_Topic` v demo QEA). Nekvalifikovaný `type: "Kafka_Topic"` se naváže na dostupný profil (demo: **`ThubDesignProfile::Kafka_Topic`**) a MDG doplní výchozí TV topicu (`format=json`, `ordered`, `piloting`, `retentionTime`). Po create vždy zpětně přečti, který profil se navázal (§10).
- **Create nepojmenovaného elementu vyžaduje `name: ""` explicitně** — vynechané pole name shodí dávku „Element information contains invalid or wrong value(s)".
- **`place_elements_on_diagram`**: povinný parametr **`elementPlacements`**. Částečný update — `{elementID, x}` posune EXISTUJÍCÍ element po X bez změny velikosti; NOVÝ element (ještě není na diagramu) se umístí jen s **plnou geometrií (x, y, width, height)** — částečné volání u neumístěného elementu je no-op. Proto vždy plná geometrie (§7d).
- **Parametry operací:** `order` u parametru není pořadí, ale adresa — `order ≥ 0` **přepisuje parametr na dané pozici**, `order: -1` = append. **KAŽDÝ přidávaný parametr vždy `order: -1`, i v create callu operace** — pak funguje vše v jednom callu. Update existujícího parametru = `order ≥ 0`. Mazání: `delete_from_model` type Parameter (id=operationID, name). Po zápisu zpětně přečti.

## 8. Po zápisu

Diagramy po úpravě `reload_diagrams`; rozmístění `place_elements_on_diagram` + `layout_connectors`; výstup skillu vždy shrnuje: co vzniklo (GUID), kam, jaký stav, co zbývá manuálně.

## 9. Katalog atributů — governance (metodika v2, kap. 6.2)

- Katalog atributů jsou **šablony**, ne katalog v pravém smyslu: oprava v katalogu se **nepropíše zpětně** do už použitých výskytů. Zakládej proto pečlivě napoprvé, ne „opravím to později".
- Běžné použití je **drag-and-drop** z katalogu na diagram (LS/DTO/entita) — nepiš atribut ručně od nuly, pokud ekvivalent v katalogu existuje.
- Nový atribut se zakládá v odemčené `Attributes Proposal`, ve složce **`design features`**, pod novou třídou pojmenovanou jménem autora (EMR eviduje jen autora třídy, ne atributu — jméno třídy je jediná stopa autorství). Složka v produkci existuje, ale je v žalostném stavu — čištění je mimo scope, čerpej z ní jen inspirativně; přesnou cestu/GUID doplň při prvním reálném použití přes bridge (query dávka).
- Drift šablona ↔ použité výskyty: provozní riziko bez nástrojové opory ve skillu — hlídá ho interní SQL dotaz správce (počty výskytů vs. aktuální šablona; na vyžádání u Miloše).
- Datový typ atributu **nikdy ručně jako text** — vždy přes *Select Type* na doménový typ z katalogu doménových typů (jinak se nedotáhnou zděděné tagged values).
- Tři nepodkročitelná pravidla kvality atributu: (1) jméno dle jmenných konvencí, (2) správně přiřazený doménový typ, (3) univerzální popis bez vazby na konkrétní projekt/platformu. QA (`emr-qa`) tato tři pravidla kontroluje jako B (blokující) při zakládání nového atributu do katalogu.
- Vlastnictví pojmenování patří analytikovi, ne vývojáři. Výjimka: externí rozhraní s pevně daným pojmenováním se do katalogu nedávají ani nepřejmenovávají.
- Výběr doménového typu — tři plány (detail `EA-Repozitar-Kontext.md` §8): **A** sémanticky pasující typ + výchozí délka (výchozí délky jsou v `domain-types.yaml` (mimo workspace — vyžádej od uživatele) — kanonický zdroj pro dt* → technologický typ; názvy v produkci jsou `dt*` camelCase), **B** `DT varchar n` s ruční délkou — hlavně pro vstupy z externích systémů s jinými konvencemi, **C** `DT undefined`, když typ (zatím) nelze určit — i tak DT přiřaď: přiřazením se na GUI EA zpřístupní zděděné tagged values z generalizací.

## 10. Kafka / událostní rozhraní (metodika v2, kap. 5.4.4)

- Kafka topic modeluj v katalogu komponent jako analogii interface: element **`KafkaDesign::Kafka_Topic`**; jednotlivé eventy jako **UML operace** na něm — z modelu je vidět, kdo publikuje a kdo konzumuje. ⚠ FQ typ padá, pokud MDG KafkaDesign v repu není (demo QEA nese ekvivalent `ThubDesignProfile::Kafka_Topic`) — v bridge dávce zadávej **nekvalifikovaně `Kafka_Topic`** a zpětným čtením (`get_elements_information`) ověř navázaný profil; MDG přidá výchozí topic TV (format/ordered/piloting/retentionTime).
- Servisní realizaci zakládej **i tehdy, když sekvenční diagram pro event nedává smysl** — SR je navigační uzel z katalogu do logického designu, ne popis časového průběhu. Zakládá se **stejným scaffoldem/skriptem jako běžná SR** (`emr-scaffold` režim C beze změny; lidský ekvivalent `Scripts/ITAN-Find or Create Referencing Service Realization.vbs`).
- Nositelem skutečné hodnoty je **DTO** — u eventu právě DTO popisuje strukturu zprávy, ne specifikace rozhraní.
- Směr toku a čtení/zápis rozlišuje stereotyp na message callu: **`CSOB-ITAN::LD-Publish`** (publikace/zápis) / **`CSOB-ITAN::LD-Read`** (konzumace/čtení) — báze UML::Message.
- Stará synchronní rozhraní zůstávají kvůli zpětné kompatibilitě beze změny; nový event přístup používej jen pro nově vznikající analýzy, staré se hromadně nepředělávají.

## 11. Audit, autorství a bezpečné mazání (metodika v2, kap. 7.3–7.4)

- **Audit log** (historie změn na elementu) se otevírá přes konkrétní element, ne spolehlivě z diagramu. V advanced módu **nikdy nespouštěj bez časového filtru** — bez něj načtení trvá řádově minuty a zatěžuje prostředí. Postup: omez na den/interval, pak filtruj po uživatelích.
- Pole `Author` je nespolehlivé (přepisuje se kopírováním/verzováním) — nápravu dělá skript **`Scripts/ITAN-Change Author in Branch Content.js`** (nastaví autora obsahu větve) + doplňková DB vrstva: views `ut_history_log_detailed`, `v_packages` (`references/emr-specific-views-and-tables.md` (skill `ea-sql-expert`)).
- Bezpečné mazání: smazání z diagramu **≠** smazání z modelu (element zůstává v repozitáři, jen mizí z pohledu) — skutečné mazání z modelu je rozhodnutí s dopadem na celý repozitář. Před mazáním vždy zohledni neviditelné vazby (objekt navázaný jinde nelze smazat bez dopadu) a znalost autora. Přehled sirotků k bezpečnému smazání = interní SQL dotaz správce EMR (nesdílí se, na vyžádání u Miloše).
- Toto doplňuje, nenahrazuje mazací pravidla AI kanálu v §7c výše (`delete_from_model` dávkou přes bridge, HITL potvrzení u existujících artefaktů) — bridge cesta je operační mechanika, tahle kapitola je governance nad tím, kdy a proč mazat.

## 12. Bezpečný AI zápis — ochranné vrstvy

Závazné pro každý zápis do **produkční** EMR (1M+ elementů); v demo/sandbox repozitáři se vrstvy trénují naostro (fáze P0). Model hrozeb H1–H7, fáze zavádění P0–P3, rozhodnutí banky a zdůvodnění: `Koncepce-bezpecny-AI-zapis-EMR.md` (mimo workspace — vyžádej od uživatele). Recovery postupy pro správce: `Restore-Runbook-AI-Zapis.md` (mimo workspace — vyžádej od uživatele).

### 12a. Asymetrie operací (politika)

| Operace | Politika |
|---|---|
| Create mimo chráněné větve (pracovní prostor §6/P3, `…Proposed`, projektové větve) | povoleno + razítko (12b) + vykázaný objem (12e) |
| Create do chráněné větve (blacklist bridge: `FB_WriteScope` — dědičně na podstrom, k tomu balíček auditu a balíček add-inu; seed = deny-list z 12g) | bridge zamítne (`E_BLACKLIST`) už v předběžné kontrole; chráněné větve jsou navíc zamčené (12g) |
| Update AI-created elementu (vlastní razítko) | povoleno + journal (12d) |
| Update cizího elementu / cizího diagramu / konektor existující↔existující | zakázáno jako default; jen dvoukolově: **dry-run diff → schválení per GUID → snapshot + mikro-baseline → zápis**. Diff schvaluje **autor sám, s auditní stopou** — rozhodnutí se zapisuje do journalu/#AI-LOG |
| Zásah do existujících GLOBAL VIEWS / survey diagramů | povolen **jen přes dry-run + schválení** jako každý jiný update cizího obsahu |
| Nový konektor AI element → existující (trasovatelnost, Usage, Realization) | povoleno — nemění cizí element, jen na něj ukazuje; razítko na konektor |
| Delete konektoru/zprávy | zakázáno v P1 (nástroj vypnut); P2+ jen AI-created v rámci schválené dávky |
| Delete existujícího elementu | **delete-request workflow**: žádost člověku (GUID + zdůvodnění + dopady — výskyt na diagramech čtecí dávkou `query` nad `t_diagramobjects` JOIN `t_diagram` (bridge nemá operaci pro hledání elementu na diagramech) + konektory); AI-created vlastní omyly v pracovním prostoru povoleno (§7c) |
| `apply_baseline` | zakázáno trvale (jen admin ručně v EA) |
| `clone_package`/`clone_elements` | jen ve verzovacím cyklu, objem vykazovat (12e) |

### 12b. Razítkování (provenience)

Každý AI-created element/konektor/diagram dostává tagged values: `AI-Created=true`, `AI-Session=<id>`, `AI-Batch=<id>`, `AI-User=<člověk>`, `AI-Tool=<cowork|zoo>`, timestamp. Schválený update cizího elementu navíc `AI-Modified=<session>`. Razítka jsou **trvalá**. Jedno SQL nad `t_objectproperties` = kompletní inventura session — základ UNDO (12f) i auditu. Na package přes `taggedValues` v `create_or_update_package` (§7; root packages TV mít nemohou — duální t_object je zakázaný, viz §7).

### 12c. Mikro-baselines

*Žádný zápis do existující package bez čerstvé baseline nejmenšího dotčeného package*: `create_baseline(X, "AI-pre-<session>-<batch>")` před prvním zápisem dávky. Nikdy baseline nad velkými složkami — drž se pravidla max ~5 dotčených packages per dávka. Nové packages (scaffold) baseline nepotřebují — undo = smazání. Výstup dávky vždy obsahuje **restore manifest** (package GUID → baseline název). Executor bridge přes Automation API (`Project.CreateBaseline(GUID, verze, notes)`) název zadat **umí** → baseline označí `AI-pre-<session>-<batch>` přímo (pojmenovaná `create_baseline`, Dokumentace bridge §4.4); restore manifest v journalu + #AI-LOG Artifact zůstává jako druhá evidence. (Domácí MCP název zadat neumí — §14.) Retence AI-pre baselines: **30 dnů po schválení brány**, úklid dle runbooku.

### 12d. Journal a před-update snapshoty

Před každým schváleným updatem přečti cílový element (`get_elements_information` vč. atributů, operací, TV, konektorů) a staré hodnoty ulož do **session journalu**: soubor v `emr-bridge/archive/` + Artifact per session v **`/Groups/#AI-LOG`** (sandbox pro P0 = `/Groups/#AI-SANDBOX`). Retence #AI-LOG: 12 měsíců. Revert dávka se sestavuje z journalu (UNDO tier 1).

**⚠ Journal je JEDINÝ zdroj starých hodnot**: DB trigger vrstva (view `ut_history_log_detailed` — viz `references/emr-specific-views-and-tables.md` (skill `ea-sql-expert`)) loguje jen kdo/kdy/co změnil (autor, modifier, mover + datumy) a v rámci dne drží nad objektem jen timestamp poslední změny. Hodí se pro detekci a audit, **ne pro obnovu polí** — snapshot před updatem proto nikdy nevynechávej.

### 12e. Kvóty a circuit breakers (zatím se NEVYNUCUJÍ)

Kvóty se v této fázi **neaplikují jako tvrdý stop**. Orientační úrovně (nové elementy 50/150 · updaty 5/20 · packages 3/5 · diagramy 10/25 · klonování 100/300) slouží jako signál: skill/EMR agent **vždy vykazuje objem dávky v result** a při překročení soft úrovně si vyžádá potvrzení — potvrzuje **sám uživatel** v session. Hard stop „jen admin" se odkládá: uvnitř AI session nelze identitu admina technicky odlišit od uživatele — až bude potřeba, vynutí se mimo session (EA security: AI účet nedostane práva nad limit; procesně: pokračování = nová dávka spuštěná správcem EMR pod jeho účtem). Denní audit dashboard: SQL nad razítky + `ut_history_log_detailed` (AI aktivita per účet/session/větev, anomálie).

### 12f. UNDO (recovery matice)

**T1** pole změněná updatem — revert dávka z journalu (AI sestaví, člověk schválí) · **T2** vše ze session — SQL nad `AI-Session` → **JScript uvnitř EA (t_script)** mazající přes EA API, **nikdy přímý SQL DELETE** · **T3** celý package — restore z `AI-pre-*` baseline dle restore manifestu (provádí správce EMR / pověření uživatelé) · **T4** katastrofa — dočasná DB + XMI (stávající postup). Postupy krok za krokem: `Restore-Runbook-AI-Zapis.md` (mimo workspace — vyžádej od uživatele). Pravidelný **UNDO drill** je exit kritérium P0.

### 12g. Tvrdé ploty mimo dosah skillu (konfigurace, ne prompt)

Skill s nimi počítá, ale nevynucuje je — jsou vynucené identitou a konfigurací: párové AI účty `<uzivatel>_AI` ve skupině `AI-Agents` (**max 5 pilotních uživatelů v P1**) → trigger log odliší AI zásahy zadarmo; defenzivní zámky na deny-list větvích — Catalogues master, `#Template structure`, šablony BA, root packages (zámky přiděluje **správce EMR**, formální admin skupina neexistuje; citlivé sdílené části modelu se hlídají takto) — tentýž deny-list je **seed blacklistu bridge** (`FB_WriteScope`, 12a: balíčky podle GUID, ochrana dědičně na podstrom); selektivní povolení **operací v executoru bridge** — seznam povolených operací vedle blacklistu balíčků (`apply_baseline` neimplementován trvale, delete operace vypnuty v P1); doma ekvivalentně povolení MCP tools per klient.

## 13. Reference na kód (GitHub) — konvence `code-*` a `re-origin`

Zdroj konvence: `RE/Koncepce-Reverse-Engineering-GitHub.md` §4+§11.

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
- **Master mapování je `RE/repo-map.yaml`** (složka `RE/` v IT-ANALYSIS) — komponenta → repo/adresář. `code-*` TV na operacích jsou derivát mapy; při nesouladu platí mapa a TV se opraví.
- **Párování ≠ provenance:** `code-*` může nést i ručně analyzovaný artefakt (jen napárovaný na kód). `re-origin=code` se dává **výhradně** na artefakty, jejichž obsah vygeneroval RE proces — nikdy ne při pouhém párování.
- **Vztah k AI razítkům (§12b):** `AI-Created` říká *kdo zapsal* (AI), `re-origin=code` říká *odkud obsah pochází* (z kódu, as-implemented). Jsou nezávislé: AI-created artefakt z business zadání `re-origin` nemá; RE-generovaný artefakt nese obojí.
- **Pravidlo čtení (závazné pro všechny skilly):** najdeš-li na operaci/packagi `code-repo`/`code-path`, čti kontrakt/kód jako **fyzickou pravdu** (chová se jako `contractAuthority=physical`, §6 metodiky/§7e) a obsah EMR jako logický komentář. Najdeš-li `re-origin=code`, jde o strojový as-implemented přepis — nezaměňovat s analytickým návrhem, konflikty hlásit člověku.
- **Chatrná dokumentace reusované operace →** skill `re-interface` (postup RE-IF dle `RE/Koncepce-Reverse-Engineering-GitHub.md` §6, mezivrstva IR dle [ir-format](ir-format.md)): extrahuj jen kontrakt operace, zapiš odkaz + shrnutí do notes + `code-*` TV. I při zamítnutí reuse referenci zapiš.
- **MQ:** MQ nálezy v kódu = běžné operace MQ komponenty (vzor T-Hub), žádné queue elementy; detail topiců/eventů jen u Kafky (§10).

## 14. Domácí MCP — verzní specifika (platí jen doma, v bance neexistují)

- **Start serveru:** mazání (od serveru 2.8.0) vyžaduje argument `-enableDelete`, create/update `-enableEdit`. Server umí logovat create/update/delete operace (zapíná se argumentem — jméno argumentu je k dohledání u vendora; po zjištění zapnout, doplňuje audit §12).
- **Schémata a response:** tools/list čti při každém připojení a na tvar response se neupínej — response formáty i parametry toolů se mění bez ohlášení a vendor to nepovažuje za breaking (`elementPlacements`, přejmenovaná pole message response, nulové datumy v package response).
- **Verzní podmínky:** tagged values na package fungují od 2.8.5 (na ≤2.8.4 zápis padá); `DiagramGate` create od 2.8.5; message tool akceptuje MDG typ `UML Behavioral::Sequence` od 2.8.4 — na MCP < 2.8.4 zakládej diagram pro zprávy jako plain `Sequence` (a prázdný auto-kompozit „Class" smaž); `place_elements_on_diagram` vyžaduje plnou geometrii od 2.8.7 (x/y-only fungovalo do 2.8.5); synchronizace jména/argumentů zprávy z operace při create od 2.8.7 — zprávy založené na ≤2.8.6 mají jen tag `operation_guid` a prázdné combo operace, při revizi je prověř; nástroj pro mazání TV se od 2.8.5 jmenuje `delete_taggedvalue_from_model` (2.8.3–2.8.4: `delete_taggevalue…` s překlepem — hlídat v allowlistech); čtení RefGUID TV rozresolvovaně od 2.7.3.
- **Co domácí MCP neumí:** výstupy nevracejí GUIDy elementů ani raw GUID operace; `create_baseline` neumí zadat název (jen packageID → vrací GUID baseline) — konvence `AI-pre-<session>-<batch>` se proto doma vede v restore manifestu a #AI-LOG Artifactu, ne v EA; chybí SQL tool a Code field pro `Method.Code` (AI Code Bridge zůstává); `IsComposite` se tiše ignoruje (§7e).
- **Hlášení vendorovi:** před hlášením „regrese" izoluj proměnné čistým retestem; experimentální sondy (bare `{elementID}`) neposílej vendorovi jako produkční chování.
