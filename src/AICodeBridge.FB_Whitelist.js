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
return [
    { repo: "EAEXAMPLE.QEA", pkg: "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}" }
];
