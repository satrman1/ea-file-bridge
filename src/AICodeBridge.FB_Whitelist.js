// AICodeBridge.FB_Whitelist()
// JEDINE misto pravdy: kam smi bridge zapisovat. Polozka = OBJEKT:
//   repo: podretezec IDENTITY repozitare dle FB_RepoId (case-insensitive):
//         u MS SQL nazev databaze (DB_NAME()), u lokalniho .qea/SQLite
//         fallback = ConnectionString (nazev/cesta souboru). POZOR: cesta
//         k .qea ZASTUPCI neni autoritativni (nalez 2.1) - proto se u MS SQL
//         porovnava nazev DB zjisteny dotazem, ne ConnectionString.
//         Nutne, protoze testovaci repozitar vznika KLONEM produkcniho
//         a package GUIDy se v klonu shoduji - GUID sam instanci nerozlisi.
//   pkg:  GUID package "{...}" - identifikuje package v ramci instance.
// Zapis/baseline projde jen kdyz identita dle FB_RepoId obsahuje repo
// A ZAROVEN package GUID sedi. V klonu (jina identita) kod odmitne
// zapisovat, dokud se whitelist vedome nepresmeruje = auditovatelny krok.
// Zmena whitelistu = zmena kodu v modelu = auditovatelna udalost (baseline).
// eaexample: #FB-TEST (packageID 1054).
// QEAX (K8-doma, security model; Z260904-6): #FB-TEST = packageID 685.
//   ZASTUPNE HODNOTY - doplni vyhodnocovaci vlakno Z260904-6b po kroku K3
//   (ping vraci `repository` = identita repa; query vraci ea_guid 685).
//   Dokud je repo "<QEAX-FILENAME>", zadny zapis do QEAX neprojde (E_REPO -
//   fail-secure, kryto harnessem); dokud je pkg "<GUID-685>", zapis konci
//   E_WHITELIST. Stejny placeholder "<QEAX-FILENAME>" je ve FB_Config,
//   FB_OpsAllowed, FB_RiskPolicy a FB_AccessGroups - nahradit VSUDE najednou.
return [
    { repo: "EAEXAMPLE.QEA", pkg: "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}" },
    { repo: "<QEAX-FILENAME>", pkg: "<GUID-685>" }
];
