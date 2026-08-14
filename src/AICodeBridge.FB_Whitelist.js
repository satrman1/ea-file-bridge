// AICodeBridge.FB_Whitelist()
// JEDINE misto pravdy: kam smi bridge zapisovat. Polozka = OBJEKT:
//   repo: podretezec ConnectionString (case-insensitive) - identifikuje
//         INSTANCI repozitare (u MS SQL nazev databaze, u .qea nazev souboru).
//         Nutne, protoze testovaci repozitar vznika KLONEM produkcniho
//         a package GUIDy se v klonu shoduji - GUID sam instanci nerozlisi.
//   pkg:  GUID package "{...}" - identifikuje package v ramci instance.
// Zapis/baseline projde jen kdyz aktualni ConnectionString obsahuje repo
// A ZAROVEN package GUID sedi. V klonu (jiny connection string) kod odmitne
// zapisovat, dokud se whitelist vedome nepresmeruje = auditovatelny krok.
// Zmena whitelistu = zmena kodu v modelu = auditovatelna udalost (baseline).
// eaexample: #FB-TEST (packageID 1054).
return [
    { repo: "EAEXAMPLE.QEA", pkg: "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}" }
];
