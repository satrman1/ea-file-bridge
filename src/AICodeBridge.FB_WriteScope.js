// AICodeBridge.FB_WriteScope()
// CIL ZAPISU - rezim BLACKLIST (zadani "Cil zapisu EA File Bridge" v1.1, kap.
// 5.2; Z261004b-10). NAHRAZUJE FB_Whitelist (rezim whitelist se neponechava
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
//     allowIncomingRefs volitelne, vychozi true (O3 = a): vazby z VOLNE casti
//                       DO chranene smi vzniknout; false = i to je E_BLACKLIST.
//                       Vazba z chraneneho zdroje do volneho cile je povolena
//                       vzdy (O11 = c); zmena/mazani vazby chraneneho zdroje
//                       je vzdy E_BLACKLIST.
// Repozitar bez polozky = E_REPO (nic se neprovede, bez auditu - muze jit o
// cizi repozitar). Vadna polozka = E_SCOPE_CONFIG pro vsechny zapisy
// (FB_WriteScopeCfg): chybejici klic blacklist, GUID v modelu neni, jmeno
// nesedi, chybejici FB_Config.auditPkg, balicek add-inu s cizim obsahem.
// Zmena = zmena kodu v modelu = deploy_src doma / bootstrap v bance (B4 chrani
// element FB_WriteScope stejne jako ostatni konfiguraci).
//
// Bankovni sablona (hodnoty dosadi clovek v bance, do repa NIKDY):
//   { repo: "<TEST-DB>",
//     blacklist: [ { pkg: "{<PROTECTED-PKG-1>}", name: "<jmeno balicku>", note: "<proc>" } ] }
//
// Domaci modely (Z261004b-10, zive 2026-10-11/12):
//   eaexample: testovaci chraneny balicek FBT-CHRANENE primo pod korenem
//              Example Model (krok 9e, 2026-10-12); FBT-VOLNE vedle nej je volny
//   QEAX (EA17_Yoga_QEA2.qeax, security zapnuta): FBT-CHRANENE pod Groups
//              (krok 9a); FBT-ZAMCENE (713, zamek skupiny) NENI na blacklistu -
//              hlida ho EA security (FB-CZ-21)
return [
    { repo: "EAEXAMPLE.QEA", blacklist: [
        { pkg: "{4B73153D-3736-4092-92A0-F3857B623954}", name: "FBT-CHRANENE", note: "test blacklistu (Z261004b-10, Example Model.FBT-CHRANENE)" } ] },
    { repo: "EA17_Yoga_QEA2.qeax", blacklist: [
        { pkg: "{54223CC8-A8DB-4a25-8488-171D3F546349}", name: "FBT-CHRANENE", note: "test blacklistu (Z261004b-10, Groups.FBT-CHRANENE)" } ] }
];
