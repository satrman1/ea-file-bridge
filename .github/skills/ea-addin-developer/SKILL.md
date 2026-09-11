---
name: ea-addin-developer
description: >
  Expert na vývoj in-model add-inů v Sparx Enterprise Architect (stereotyp JavascriptAddin)
  a na jejich programování přes MCP pomocí AI Code Bridge. Použij tento skill kdykoliv uživatel
  chce vytvořit, upravit nebo rozšířit EA model add-in, přidat položku do menu / vlastní panel /
  Output report / property okno v EA, vynutit konvenci u zdroje (event handler), nebo programovat
  add-in přes MCP. Spouštěj i při zmínce "model add-in", "JavascriptAddin", "EA_Connect",
  "EA_GetMenuItems", "EA_MenuClick", "reception", "Internal Code", "AI Code Bridge", "AICodeBridge",
  "Method.Code", "add-in do EA", "GUI v EA", "property okno", "custom search v EA".
---

# EA Add-in Developer

Skill pro vývoj in-model JavaScript add-inů v Enterprise Architectu a jejich programování odsud
přes MCP kanál **AI Code Bridge**. Pokrývá tři věci, které nejsou nikde pohromadě: vendor konvence
psaní add-inu, obcházení limitů MCP (neexponuje kód operací) a katalog GUI schopností.

## Klíčový kontext (proč to takhle je)

- **MCP neumí kód operací.** `get_elements_information` vrací jen signatury; `create_or_update_operations`
  nemá pole pro tělo. Internal Code je v `t_operation.Code` (automation `Method.Code`). MCP tedy postaví
  jen *strukturu* add-inu, ne jeho kód. Proto existuje **AI Code Bridge** — viz [bridge-workflow](references/bridge-workflow.md).
- **Add-in NIKDY nestav od nuly.** EA_ handlery (EA_Connect, EA_GetMenuItems, EA_MenuClick…) musí být
  **Receptions navázané na Signály** z knihovny Broadcast Types. MCP receptions vytvořit neumí. Řešení =
  **klonovat validní vzor** (vendor `MyDemoAddin` / `TypeInfo` v eaexample.qea) a přejmenovat. Klon receptions
  i kód zachová.
- **Kód se aktivuje až přenačtením add-inu.** Změny těl operací se za běhu nepřebírají — po deployi ulož
  (Ctrl+S) a `File → Reload Current Project` (plný restart EA není nutný a je lepší se mu vyhnout — po něm
  se špatně napojuje MCP most).

## Reference — kdy co číst

- [addin-conventions](references/addin-conventions.md) — **čti vždy** — jak EA add-in strukturálně vypadá: Code = tělo funkce,
  `this.Helper(Repository,...)`, formát menu, receptions, atributy = stav, aktivace přes restart, base64 transport.
- [bridge-workflow](references/bridge-workflow.md) — **čti při programování add-inu přes MCP** — jak AI Code Bridge funguje:
  inbox #AI-CODE, formát requestu, módy `deploy` / `export` / `query`, HITL smyčka, bezpečnostní zásada.
- [gui-catalog](references/gui-catalog.md) — **čti při návrhu GUI** — katalog 11 vizuálních schopností add-inu (menu, stavy,
  dialogy, Output s prokliky, dokovatelné property okno se všemi typy polí, kontextový inspektor, custom search)
  se snippety + hranice (co add-in NEumí).
- [vendor-samples](references/vendor-samples.md) — **čti pro konkrétní vzor kódu** — mapa ověřeného vendor korpusu
  (co demonstruje TypeInfo, co MyDemoAddin), odkud kopírovat working snippety.

## Workflow — nový add-in

1. **Návrh:** urči účel a GUI (menu položky, panely) podle [gui-catalog](references/gui-catalog.md).
2. **Struktura klonem:** přes MCP naklonuj validní vzor (`MyDemoAddin` kvůli bohatým receptions), přejmenuj,
   pročisti nepotřebné operace, přidej vlastní helper operace (`create_or_update_operations`). Receptions NEMAŽ.
3. **Kód přes bridge:** kanon zdrojáků drž v souborech (`<Addin>.<Operace>.js` = tělo funkce). Pro každou
   operaci založ `deploy` request do #AI-CODE (Notes = base64 kódu). Viz [bridge-workflow](references/bridge-workflow.md).
4. **Deploy:** uživatel klikne AI Bridge → Process requests. Po deployi ulož (Ctrl+S) + `Reload Current Project`.
5. **Aktivace add-inu poprvé:** Manage Add-Ins → enable + Load on startup (nový add-in v seznamu vyžaduje
   jednorázově plný restart, aby se vůbec načetl). Test menu.
6. **Iterace:** další deploy requesty; po každém ulož + Reload Current Project (bez restartu). Kanon src synchronizuj po každém deployi.

## Workflow — úprava existujícího add-inu

1. `export` request přes bridge → přečti aktuální kód (base64 v Notes) → uprav v kanonu src.
2. `deploy` request s novou verzí → Process requests → restart → test.

## Bezpečnostní zásada (bankovní prostředí)

Bridge ani add-in **není „spusť libovolný skript"** — to je RCE by design. Každá schopnost = pojmenovaná,
čitelná operace s kódem ve verzovaném kanonu, posuditelná zvlášť. MCP zůstává primární kanál; do add-inu/bridge
patří jen to, co MCP neumí. Nasazení do produkce = samostatné security posouzení (kód v modelu se vykonává
každému, kdo má model add-iny povolené).

## Chování po aktivaci

Začni návrhem struktury a GUI. Pokud chybí cílový model, jméno add-inu nebo účel, zeptej se konkrétně.
Nikdy nestav receptions od nuly — vždy klon validního vzoru.
