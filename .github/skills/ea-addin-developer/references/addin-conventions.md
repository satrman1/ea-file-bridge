# Konvence psaní EA model add-inu (ověřeno vendor dumpem, eaexample.qea)

Zdroj pravdy: vendor add-iny `TypeInfo` a `MyDemoAddin` v `Example Model/Model Based Add-Ins`.

## Struktura add-inu

- Třída se stereotypem **`JavascriptAddin`** (`Model Add-Ins::JavascriptAddin`). Jméno = validní JS identifikátor.
- **Receptions** = vstupní body na Signály (EA_Connect, EA_GetMenuItems, EA_MenuClick, EA_GetMenuState,
  EA_OnContextItemChanged, EA_OnAddinPropertiesTabChanging…). Signály jsou v knihovně **Broadcast Types** —
  musí být v modelu. MCP receptions vytvořit neumí → **klonuj validní vzor**.
- **Operace (Methods)** = pomocné funkce, volané `this.Nazev(...)`.
- **Atributy** = perzistentní stav instance add-inu mezi voláními (ne mezi restarty): `this.bShowCustom` apod.
- Add-in smí používat další třídy z modelu (MyDemoAddin → `JSxml`, `JSONSchema` přes Dependency).

## Internal Code = TĚLO funkce

Do `t_operation.Code` (= `Method.Code`) se píše **jen tělo**, ne hlavička. Parametry reception/operace
jsou v kódu dostupné přímo jménem.

```javascript
// EA_Connect (parametr Repository je dostupný přímo):
return "";                          // "" = běžný add-in
```

Globálně dostupné: `Repository`, `Session` (`Session.Output(text)`, `Session.Prompt(msg, typ)`).
Některé funkce jsou dostupné i bez `Repository.` prefixu v kontextu add-inu (`WriteOutput`, `GetContextObject`).

## Menu

```javascript
// EA_GetMenuItems — root v else-větvi, bez testu MenuLocation, položky bez '&':
if (MenuName == "-Muj Addin")
    return ["Akce 1", "-Podmenu", "-", "About"];   // "-" oddělovač, "-X" vnořené submenu
else
    return "-Muj Addin";                            // root
```

```javascript
// EA_MenuClick — dispatcher:
if (ItemName == "Akce 1")   this.Akce1(Repository);
else                        Session.Output("Unhandled menu item: " + ItemName);
```

```javascript
// EA_GetMenuState — enabled/checked přes .val:
IsEnabled.val = true;
IsChecked.val = this.nejakyPrepinac;
```

## Dialogy

- `Session.Prompt("text", 0)` — informační OK.
- `Session.Prompt("dotaz?", 4)` — Ano/Ne, vrací `1` pro Ano.
- `Session.Output("radek")` — do System Output (Script) tabu.

## AKTIVACE — Reload Current Project (ne restart EA)

EA drží zkompilovaný JS add-inu z načtení. **Změny těl operací se za běhu nepřebírají** — po zápisu do
`Method.Code` je nutné add-in přenačíst. **Stačí `File → Reload Current Project`** (ověřeno 2026-07-19);
plný restart EA NENÍ nutný a je lepší se mu vyhnout (po restartu se špatně napojuje MCP most).

⚠ **Před reloadem ulož model (Ctrl+S).** Reload zahodí nezapsané změny — deploy (zápis do `Method.Code`)
nejdřív commitnout, jinak se nový kód po reloadu ztratí a přenačte se stará verze.

## Transport kódu přes MCP

Když kód putuje přes MCP (Notes elementu), **musí být base64**. Plain text rozbíjí JSON vrstvu MCP serveru:
tabulátory (0x09) a backslash-escape sekvence (`\"`) způsobí parse error. EA JS engine nemá `atob`/`btoa` —
bridge má vlastní base64 s UTF-8 podporou (viz [bridge-workflow](bridge-workflow.md)).

## Enablement

Specialize → Manage Add-Ins → zaškrtnout **Load on Startup** u add-inu → **restart EA**. Sloupec Status
(Enabled/Disabled) ukazuje stav běžící session — projeví se až po restartu. Při zapnuté security vyžaduje
změnu oprávnění „Configure Model Add-Ins". Model-based add-in se nenačte, pokud je nevalidní (např. SQL dotazy
v dialektu, který repo nepodporuje — MS SQL selecty v SQLite modelu).
