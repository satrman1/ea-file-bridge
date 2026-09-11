# Vendor korpus — mapa ověřených vzorů kódu

Kompletní dump vendor add-inů z eaexample.qea je v `IT-ANALYSIS/addin-bridge/dump/` (37 souborů, formát
`<Addin>.<Operace>.js` = tělo funkce). Odtud kopíruj working snippety. Dva zdrojové add-iny:

## TypeInfo (elementID 10295 v eaexample) — jednoduchý inspektor

Ukazuje minimalistický kontextový inspektor. Klíčové operace:

- `EA_Connect` — `return "";`
- `EA_GetMenuItems` — jednoduché menu se submenu `-Type Info`.
- `EA_GetMenuState` — přepínač (`IsChecked.val`).
- `EA_MenuClick` — toggle stavu + volání helperu.
- `EA_OnContextItemChanged` — `this.UpdateTypeInfo(Repository)` = živý překres panelu dle vybraného prvku.
- `ShowTypeInfo` / `UpdateTypeInfo` — práce s property tabem: `AddPropertiesTab`, `GetPropertiesTab`,
  `SetPropertiesXML`, `ShowAddinWindow`. Čte `e.TypeInfoProperties` + `e.CustomProperties`.

Dobrý vzor pro: **kontextový inspektor** (vyber element → panel ukáže jeho data).

## MyDemoAddin (elementID 10296 v eaexample) — bohatý showcase (~22 operací)

Vendor „feature demo". Nejlepší klon-báze pro nový add-in (má všechny důležité receptions vč.
`EA_OnAddinPropertiesTabChanging`, `EA_OnPreDeleteAttribute`). Klíčové operace:

- `EA_GetMenuItems` — víceúrovňové menu (submenu `-Property List`, `-Menu Behavior`, `-Misc`), podmíněné
  položky dle `this.debugStuff`.
- `EA_GetMenuState` / `EA_MenuClick` — enabled/checked, dispatcher vč. `Session.Prompt(...,4)` potvrzení.
- `ShowPropertyList` — **dokovatelné property okno se všemi typy polí** (text, combobox+valuelist, date,
  checkbox, spin+min/max, int, double, memo; groups). Nejlepší referenční XML.
- `HidePropertyList` / `RemoveAllPages` — zavření/čištění panelu.
- `ShowSelectionSummary` / `UpdateSelectionSummary` / `GetSelectionXML` / `GetContextXML` — panel reagující
  na `Repository.CurrentSelection`.
- `EA_OnAddinPropertiesTabChanging` — zachycení editace vlastnosti uživatelem (potvrzení/zamítnutí přes return).
- `CustomSearch` — vlastní vyhledávání → ReportView mřížka s `CLASSGUID`+`CLASSTYPE` (navigovatelné řádky).
- `ShowSearch` — přímé plnění Search Window (`Repository.SearchWindow`, AddColumn, AddRow, SetCellString).
- `MultiLineOutput` / `PrintAttributes` — víceřádkový výstup, čtení atributů kontextového elementu.

Dobrý vzor pro: **reporty, editovatelné panely, custom search, kontrolní akce** nad výběrem.

## Živý showcase

`GuiShowcase` (klon MyDemoAddin) = zapnutelná živá demonstrace všech položek [gui-catalog](gui-catalog.md). Klon nese kód
byte-přesně, takže stačí enable + restart.
