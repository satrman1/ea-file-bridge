# EAFB — registr operací a řetězení `$N`

Operace = pole `ops` v dávce. **Čtecí** jsou povoleny vždy, **zápisové** podléhají whitelistu operací i packages.

## Čtecí operace

- `ping` (`echo`) — kontrola protokolu a repozitáře; **úvodní kotva session**. ACK vrací navíc `whitelist[]` — rozvinuté povolené větve připojeného repozitáře: `{guid, name, path}` (`path` plnou cestou; **prázdný whitelist = explicitní věta v ACK**, ne prázdné pole) — a `access{level, securityEnabled, reason}` (přístupová úroveň uživatele). S kotvou z pingu je první zápisová dávka samonosná bez recon kola.
- `query` (`sql` — jen SELECT/WITH, dialekt repozitáře) — vrací `rows[]` včetně GUIDů.
- `get_selected_context` (bez argumentů) — aktuální výběr uživatele v Project browseru + aktivní diagram: `selected`, `context{type, guid, id, name, path, branchGuid, branchId, inWhitelist, whitelistNote}`, `selectedElements[]` (multi-výběr), `currentDiagram`. Používej, když uživatel mluví kontextově — viz Pravidla agenta, sekce „Kontext = výběr".
- `find_elements_by_name` (`name`), `find_packages_by_name` (`name`) — vracejí GUIDy. Volitelně `scope` = GUID package: hledání jen ve VĚTVI (typicky `branchGuid` z `get_selected_context`); bez `scope` globálně.
- `get_elements_information` (`elements[]` = guid|id|jméno|`$ref`, `brief`) — dump vč. atributů, operací, TV (RefGUID rozpřaženě), konektorů, owned diagramů.
- `get_packages_information` (`packages[]`), `get_connectors_information` (`connectors[]`|`element`), `get_diagrams_information` (`diagrams[]` — vč. bloku `messages`).
- `get_baselines` (`package`), `baseline_diff` (`package`, `baseline`).
- `export_element_linked_documents` (`elements[]`, `inline`) — soubory jen do `responses/docs/`.
- `open_diagrams`, `reload_diagrams` (`diagrams[]`), `get_diagram_image` (`diagrams[]`|`diagram`, `inline`) — PNG do `responses/images/`; po čerstvém zápisu na diagram nejdřív `reload_diagrams`.

## Zápisové operace

- `create_or_update_elements` (`elements[{package|owningElement+type → create; guid|elementID → update; name, stereotypes, notes, alias, status, author/version; type na update = změna typu; isComposite+compositeDiagram; classifier; taggedValues; **matchByName:true** = find dle jména/aliasu v cílovém package/parentu → update; **dedupKey** = stabilní klíč, TV `ai.dedup`, přežije přejmenování}]`). ⚠ Update **nemění vlastnící package** — na přesun je samostatná operace `move_elements` (níže); pole `package` u updatu element nepřesune a nově vrátí **warning**.
- `move_elements` (`package` = společný cíl a/nebo `elements[ "{GUID}"|id|jméno | {element, package} ]`, `withChildren` default `true`) — **přesun existujícího elementu mezi packages** (iterace 6). Vlastnění potomci i diagramy jdou s ním; prvek už v cíli = nic se neděje (`moved: false`). Kontroluje whitelist **zdroje i cíle**; validace celé dávky proběhne před prvním zápisem. **Vždy ELEVATED** — dávka skončí `confirm_required` a čeká na potvrzení člověkem; to je normální chod, ne chyba. Odpověď nese `items[{moved, fromPackage, toPackage, children, childrenFixed}]`.
- `create_or_update_requirements` (`element`, `requirements[{name, notes, type?, status?, priority?}]`) — **internal requirements** elementu (záložka Responsibilities → Requirements) = metodický nosič **lokálních** pravidel `BRU<čísloUC>-Y` uvnitř UC (U5). Zápis NAHRADÍ všechny internal requirements elementu — posílej kompletní sadu. `type` = ReqType, default `Functional`. **Přepoužitelná** `BRU-####` sem NEPATŘÍ (zůstávají elementem v `RULES (REUSABLE)` + konektor Usage). ELEVATED.
- `create_or_update_package` (`parent`, `name`, `notes`, `taggedValues`, **`matchByName:true`**).
- `create_or_update_connectors` (`connectors[{source, target, type, stereotypes, direction, taggedValues (RefGUID `ids`), **match:"composite"** = lookup dle Start/End/Type/Stereotype → update, **dedupKey**}]`).
- `create_or_update_attributes` (`element`, `attributes[]`), `create_or_update_operations` (`element`, `operations[{…, parameters[]}]` — parameters = deterministický rebuild).
- `create_or_update_messages` (`diagram`, `messages[{source, target, name|operation, isReturn, isAsynchronous, arguments, returnValue, seqNo}]`, **`rebuild:true`** = smaže všechny zprávy diagramu a postaví znovu z dávky — vyžaduje `diagram`, explicitní `seqNo`, zprávy bez guid/connectorID).
- `create_or_update_scenarios` (`element`, `scenarios[{name, type "Basic Path"|"Alternate"|"Exception", steps[{text, kind "actor"|"system", uses, results, state}], attachTo{scenario, step}, join}]`) — zápis NAHRADÍ všechny scénáře elementu (posílej kompletní sadu). ⚠ `attachTo.scenario` = jméno scénáře. **`join` = ČÍSLO KROKU hostitelského scénáře** (toho z `attachTo.scenario`), do kterého se tok vrací; `"End"` nebo vynechané pole = větev končí. Jméno scénáře, číslo mimo rozsah i `join` bez `attachTo` = **warning + End** (zápis proběhne, návrat ne). ⛔ Dřívější pokyn „join executor neumí, vykaž ho jako ruční krok" **neplatí** (vyvrácený nález N-1 — iterace 6, 2026-08-21). Po každé zápisové dávce kontroluj op-level `warnings` v response.
- `create_or_update_constraints` (`element`, `constraints[{name, type "Pre-condition"|"Post-condition"|"Invariant", notes}]`) — PRE/PST/ASU na use case; zápis NAHRADÍ všechny constrainty elementu.
- `create_or_update_diagram` (**`diagrams[{…}]` — vždy neprázdné pole objektů**, i pro jediný diagram; v položce `package`|`owningElement`+`type` (i MDG "Tech::Typ") → create; `diagram` → update), `place_elements_on_diagram` (`diagram`, `elementPlacements[{elementID|element, x, y, width, height, style}]` — bez souřadnic auto-mřížka; konektory mezi umístěnými se vykreslí samy), `update_diagram_properties`, `set_diagram_object_style`, `layout_connectors` (styly direct/auto/custom/treeV/treeH/lateralV/lateralH/orthS/orthR), `change_connector_visibility`, `remove_elements_from_diagram`.
- `apply_classifier_stereotypes` (`diagram`, filtr `elementIDs`) — po zápisu lifelin na sekvenční diagram.
- `find_or_create_referencing_sr` (`operation`, `packageName` dle konvence `<Operace>_ARELYYMM`) — najde nebo založí Service Realizaci; `found:true` = existuje, nic se nezaložilo.
- `create_baseline` (`package`, `name`), `delete_from_model` (`targets[{type Package|Diagram|Element|Connector|Attribute|Operation|Parameter, id|guid}]`), `delete_taggedvalue_from_model`, `clone_package`, `clone_elements`, `import_element_linked_documents`.

**Nepoužívej:** `deploy_src` (vývojová operace, v bance zakázaná). Neexistuje `apply_baseline` (obnovu dělá člověk v EA) ani `find_element_in_diagrams` (použij `query`).

## Řetězení `$N` v dávce

Místo GUIDu odkážeš na výsledek dřívější operace téže dávky: `"$0"` = guid výsledku 0, `"$0.id"` = jeho id, `"$1[2]"` = guid položky `items[2]` výsledku 1, `"$1[2].id"` = její id. Funguje i uvnitř `targets`, `elements`, `taggedValues.ids`. Do SQL řetězce `$N` vložit nejde — tam patří skutečné hodnoty z předchozích odpovědí.
