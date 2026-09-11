# Katalog GUI schopností in-model add-inu (EA JavascriptAddin)

Přehled toho, **co všechno lze modelovým add-inem v Enterprise Architectu vizualizovat a nabídnout uživateli**.
Každá položka: co to je, jak se to volá (API), stav ověření (✅ ověřeno na vendor dumpu z eaexample.qea `Model Based Add-Ins`, 📖 dle dokumentace).
Live demonstrace: add-in **GuiShowcase** (klon MyDemoAddin) — viz konec dokumentu.

---

## 1. Menu (ribbon / hlavní menu)  ✅

Add-in si registruje vlastní menu strom přes reception **`EA_GetMenuItems`**.

- Root položka = návrat řetězce s prefixem `-` (submenu), např. `return "-AI Bridge";`
- Obsah submenu = pole položek; `"-"` = oddělovač; `"-Něco"` = vnořené submenu (víc úrovní).
- Volá se opakovaně: nejdřív s prázdným `MenuName` (root), pak pro každé otevřené submenu.

```javascript
if (MenuName == "-MyDemo Add-in")
    return ["-Property List", "-Menu Behavior", "Show Selection Summary", "-", "Help", "About"];
else if (MenuName == "-Property List")
    return ["Open", "Close"];               // vnořené submenu
else
    return "-MyDemo Add-in";                 // root
```

Umístění (`MenuLocation`): `MainMenu`, `TreeView` (kontext v Browseru), `Diagram`, `MDGMenu` — stejná reception, větví se dle parametru. 📖 pro TreeView/Diagram kontextová menu.

## 2. Stav položek — enabled / checked  ✅

Reception **`EA_GetMenuState`** umí položky zašedit nebo zobrazit „fajfku" (přepínače).

```javascript
IsEnabled.val = true;                         // povolit/zakázat
if (ItemName == "Include Custom Properties")
    IsChecked.val = this.bShowCustom;         // zaškrtnutí (toggle stav)
```

Stav se drží v atributech třídy (`this.bShowCustom`) — viz bod 9.

## 3. Reakce na klik  ✅

Reception **`EA_MenuClick`** — dispatcher, volá helper operace přes `this.Nazev(Repository)`.

```javascript
if (ItemName == "Show Type Info")   this.ShowTypeInfo(Repository);
else if (ItemName == "Toggle")      this.flag = !this.flag;
else                                Session.Output("Unhandled: " + ItemName);
```

## 4. Dialogy — `Session.Prompt`  ✅

Modální dialogy. Druhý parametr = typ:

- `Session.Prompt("...", 0)` — informační (OK). ✅
- `Session.Prompt("dotaz?", 4)` — Ano/Ne, vrací `1` pro Ano. ✅
- `Session.Output("...")` — řádek do System Output (Script) tabu. ✅

```javascript
if (Session.Prompt("Pokracovat?", 4) == 1) { /* Ano */ }
```

Další typy dialogů (OK/Cancel apod.) 📖 přes další konstanty; textový input řešit property oknem (bod 6).

## 5. System Output — vlastní tab + prokliky na elementy  ✅

Vlastní výstupní panel s řádky, které **navigují do modelu** po dvojkliku.

```javascript
Repository.CreateOutputTab("AI Bridge");
Repository.EnsureOutputVisible("AI Bridge");
Repository.WriteOutput("AI Bridge", "text radku", elementID);  // 3. param = ID pro proklik
```

`WriteOutput(tab, text, id)` — je-li `id` platné ElementID, dvojklik na řádek vyskočí/označí element.
Vhodné pro reporty, seznamy nálezů (framecheck!), navigovatelné výsledky.

## 6. Dokovatelné property okno (Add-In Window)  ✅

Plnohodnotný panel v EA s **editovatelnou tabulkou vlastností** (jako Properties). Definuje se XML.

```javascript
var xml = "<?xml version='1.0'?><properties>"
        + "<group name='Skupina 1'>"
        + "  <property id='1' type='text'     readonly='false'><name>Text</name><value>abc</value></property>"
        + "  <property id='2' type='combobox' readonly='false'><name>Výběr</name><value>Two</value>"
        + "     <valuelist><item>One</item><item>Two</item><item>Three</item></valuelist></property>"
        + "  <property id='3' type='checkbox' default='true'><name>Přepínač</name></property>"
        + "  <property id='4' type='spin' min='0' max='100'><name>Číselník</name><value>7</value></property>"
        + "  <property id='5' type='date'     default='currentdate'><name>Datum</name></property>"
        + "  <property id='6' type='memo'><name>Poznámka</name><value></value></property>"
        + "</group></properties>";
this.tab = Repository.AddPropertiesTab("Můj panel", xml);
Repository.ShowAddinWindow("Můj panel");
```

**Podporované typy polí** (✅ všechny z vendor dumpu): `text`, `memo`, `combobox` (+`valuelist`), `checkbox`,
`spin` (+`min`/`max`), `int`, `double`, `date` (+`currentdate`). Atributy: `readonly`, `default`, groups (`expanded='false'`).

- Aktualizace obsahu: `Repository.GetPropertiesTab(name).SetPropertiesXML(xml)`.
- Zavření: `tab.RemovePropertiesTab()`.
- **Zachytávání editace uživatelem**: reception **`EA_OnAddinPropertiesTabChanging`** — dostane `PropID`,
  `OriginalValue`, `ChangeValue`, `TabName`; vrácením `true`/`false` změnu potvrdíš/zamítneš (lze i validovat dialogem).

## 7. Reakce na výběr / kontext  ✅

Reception **`EA_OnContextItemChanged`** (a `Repository.CurrentSelection`, `GetContextObject()`,
`GetContextItemType()`) — panel se překresluje podle toho, co uživatel klikne v modelu.

```javascript
// automaticky se volá při změně vybraného prvku:
this.UpdateTypeInfo(Repository);   // překreslí property okno dle nového kontextu
```

Umožňuje „živý" inspektor: vybereš element → panel ukáže jeho data (TypeInfo add-in přesně tohle dělá).

## 8. Vlastní vyhledávání (Custom Search)  ✅

Add-in přidá položku do EA „Find in Project" a vrátí **výsledkovou mřížku** (ReportView).

```javascript
// operace CustomSearch(Repository, SearchText, XMLResults) -> vrací "T", plní XMLResults.val:
var xml = "<ReportViewData><Fields>"
        + "<Field name='CLASSGUID'/><Field name='CLASSTYPE'/><Field name='Name'/>"
        + "</Fields><Rows>";
// pro každý nalezený element řádek s CLASSGUID+CLASSTYPE (=navigovatelné!) + hodnotami
xml += "<Row><Field name='CLASSGUID' value='"+el.ElementGUID+"'/>"
     +  "<Field name='CLASSTYPE' value='"+el.Type+"'/>"
     +  "<Field name='Name' value='"+el.Name+"'/></Row>";
xml += "</Rows></ReportViewData>";
XMLResults.val = xml;  return "T";
```

`CLASSGUID`+`CLASSTYPE` sloupce = řádky jsou proklikávací do Browseru (povinné aliasy — shodné s ea-sql-expert konvencí).

## 9. Search Window API (programové plnění mřížky)  ✅

Přímé plnění vyhledávacího okna vlastními sloupci/řádky (bohatší než Custom Search).

```javascript
var S = Repository.SearchWindow;  S.EnsureVisible();
S.NewLayout("{...}");  S.AddColumn("Name", 80);  S.AddColumn("Author", 80);
S.AddRow(4 /*ikona*/, el.ElementGUID, el.ElementID, el.Type, values);
S.SetCellString(rowIdx, colIdx, "hodnota");
```

## 10. Stav / globální proměnné add-inu  ✅

Atributy třídy = perzistentní stav mezi voláními (ne mezi restarty): `this.bShowCustom`, `this.tabName`, `this.propList`.
Add-in může **využívat další třídy z modelu** (MyDemoAddin → pomocné třídy `JSxml`, `JSONSchema` přes Dependency).

## 11. Data z modelu → do vizualizace  ✅

Pod všemi panely je plné automation API + `Repository.SQLQuery(sql)` (viz bridge `mode=query`):
počty, agregace, seznamy, metadata — cokoli spočítaného ukázat v Output/property okně/mřížce.

---

## Co in-model JS add-in NEumí (hranice)  📖

- **Kreslení do diagramu** (custom shapes/overlay) — to jsou Shape Scripts / MDG technologie, ne add-in JS
  (částečně `EA_OnPostDrawImage` u kompilovaných add-inů, ne pohodlně v JS).
- **Vlastní plně HTML/WPF panel** — dokovatelné okno je property-grid, ne libovolný HTML (na to jsou kompilované add-iny / WebView).
- **Toolbary s ikonami** — menu ano, custom ikonové toolbary omezeně.

Pro naše účely (inspektory, reporty, navigovatelné nálezy, editovatelné panely, kontrolní akce) je JS add-in plně dostačující.

---

## Live demo: GuiShowcase

Add-in **GuiShowcase** (v eaexample.qea, klon MyDemoAddin) demonstruje body 1–11 na klik.
Menu „GuiShowcase" → jednotlivé položky spouští ukázky (dialogy, Output s prokliky, property okno se všemi typy polí,
kontextový inspektor, model-stats přes SQL). Slouží jako živá referenční mapa téhle tabulky.
