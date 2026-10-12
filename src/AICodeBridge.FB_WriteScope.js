// AICodeBridge.FB_WriteScope()
// CIL ZAPISU - rezim BLACKLIST (zadani "Cil zapisu EA File Bridge" v1.2, kap.
// 5.2; Z261004b-10/-11). NAHRAZUJE FB_Whitelist (rezim whitelist se neponechava
// ani prechodne - rozhodnuti Milose 11. 10. 2026, O1 = b). Kam smi bridge
// zapisovat, rozhoduje EA security (zamky, skupiny - hlavni hranice, bridge ji
// nekontroluje, O2 = b) + TENTO blacklist + implicitni ochrana (kap. 5.4:
// balicek s elementem AICodeBridge, balicek auditu FB_Config.auditPkg - obe
// dedicne na podstrom; koreny modelu jen jako uzel).
// Polozka = OBJEKT per repozitar:
//   repo:       podretezec IDENTITY repozitare dle FB_RepoId (case-insensitive;
//               u MS SQL nazev DB, u lokalniho .qea/.qeax nazev souboru) -
//               STEJNA hodnota jako ve FB_Config, FB_OpsAllowed, FB_RiskPolicy
//               a FB_AccessGroups (harness hlida).
//   blacklist:  POVINNE pole (i prazdne: blacklist: []). Polozka
//               { pkg, name, note, allowIncomingRefs }:
//     pkg               GUID balicku "{...}" - chrani CELY jeho podstrom
//     name              jmeno balicku (druha polovina klice - preklep v GUIDu
//                       by jinak tise vypnul ochranu; kontrola konfigurace
//                       hlasi "GUID nenalezen / jmeno nesedi")
//     note              proc je chraneny (ukazuje se v chybe E_BLACKLIST a v pingu)
//     allowIncomingRefs volitelne, vychozi true (O3 = a): NOVA vazba z VOLNE
//                       casti DO chranene smi vzniknout; false = i to je
//                       E_BLACKLIST (volitelne zprisneni ZALOZENI vazby).
//   cascadeDelete: "allow" | "block" (volitelne; chybi = "block", fail-closed).
//               Co s mazanim VOLNEHO objektu, ktere by kaskadou EA sahlo do
//               chranene casti (rozhodnuti Milose 12. 10. 2026, varianta c):
//               (b) mazany objekt lezi na CHRANENEM diagramu (EA ho z nej
//               odstrani), (c) mazany prvek je klasifikatorem instanci v
//               chranene casti (EA jim nastavi Classifier = 0 - zive overeno
//               Z10-13). "allow" = povolit s DURAZNYM varovanim: vycet kaskad
//               se spocita uz v predbezne kontrole a je v textu potvrzovaciho
//               okna (clovek rozhoduje s informaci, zaloha chraneny balicek
//               nekryje); "block" = E_BLACKLIST v predbezne kontrole.
//               Bankovni sablona "block", doma "allow".
// PRAVIDLO VAZEB (rozhodnuti Milose 12. 10. 2026, nahrazuje "vazbu vlastni
// zdroj" z B2): vazba (i zprava sekvence) je chranena, JEN kdyz jsou OBA jeji
// konce v chranene casti - ma-li jeden konec venku, chranena neni, at vede
// kterymkoli smerem. Zmena/smazani vazby s jednim volnym koncem projde;
// presmerovani se posuzuje nad NOVYM parem koncu. Zamky EA (security) u vazeb
// most nehlida - zamek EA pres Automation vazby nehlida vubec (FB-CZ-22) a
// smer vazby je dan logikou reseni, ne vlastnictvim.
// Repozitar bez polozky = E_REPO (nic se neprovede, bez auditu - muze jit o
// cizi repozitar). Vadna polozka = E_SCOPE_CONFIG pro vsechny zapisy
// (FB_WriteScopeCfg): chybejici klic blacklist, GUID v modelu neni, jmeno
// nesedi, chybejici FB_Config.auditPkg, balicek add-inu s cizim obsahem,
// cascadeDelete mimo allow/block. Davka slozena jen z deploy_src vadnou
// konfiguraci neni blokovana (opravny kanal, CZ-02b).
// Zmena = zmena kodu v modelu = deploy_src doma / bootstrap v bance (B4 chrani
// element FB_WriteScope stejne jako ostatni konfiguraci).
//
// Bankovni sablona (hodnoty dosadi clovek v bance, do repa NIKDY):
//   { repo: "<TEST-DB>", cascadeDelete: "block",
//     blacklist: [ { pkg: "{<PROTECTED-PKG-1>}", name: "<jmeno balicku>", note: "<proc>" } ] }
//
// Domaci modely (Z261004b-10, zive 2026-10-11/12):
//   eaexample: testovaci chraneny balicek FBT-CHRANENE primo pod korenem
//              Example Model (krok 9e, 2026-10-12); FBT-VOLNE vedle nej je volny
//   QEAX (EA17_Yoga_QEA2.qeax, security zapnuta): FBT-CHRANENE pod Groups
//              (krok 9a); FBT-ZAMCENE (713, zamek skupiny) NENI na blacklistu -
//              hlida ho EA security (FB-CZ-21)
return [
    { repo: "EAEXAMPLE.QEA", cascadeDelete: "allow", blacklist: [
        { pkg: "{4B73153D-3736-4092-92A0-F3857B623954}", name: "FBT-CHRANENE", note: "test blacklistu (Z261004b-10, Example Model.FBT-CHRANENE)" } ] },
    { repo: "EA17_Yoga_QEA2.qeax", cascadeDelete: "allow", blacklist: [
        { pkg: "{54223CC8-A8DB-4a25-8488-171D3F546349}", name: "FBT-CHRANENE", note: "test blacklistu (Z261004b-10, Groups.FBT-CHRANENE)" } ] }
];
