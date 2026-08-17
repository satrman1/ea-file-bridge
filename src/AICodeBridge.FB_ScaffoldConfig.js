// AICodeBridge.FB_ScaffoldConfig()
// Konfigurace SCAFFOLDU find_or_create_referencing_sr per repozitar
// (parovani pres FB_RepoId, case-insensitive podretezec - stejna mechanika
// jako FB_Config/FB_Whitelist):
//   repo:        podretezec identity repozitare dle FB_RepoId
//   unsortedPkg: "{GUID}" package, kde vznikaji nove service packages
//                (v bance #UNSORTED; operace umi cil prebit argumentem
//                targetPackage)
//   templates:   GUIDy sablon #Template structure - z nich se prebiraji
//                instrukcni Notes (par. 7e). Chybejici/nedohledatelna
//                sablona = warning, scaffold pokracuje bez Notes.
// Zmena tohoto souboru = zmena kodu v modelu = auditovatelna udalost.
//
// eaexample (dev stanice) - fixture sablony v #FB-TEST (davka 20260818-32):
return [
    { repo: "EAEXAMPLE.QEA",
      unsortedPkg: "{E8FA31AF-EE4F-454a-B393-6954634BFDA4}", // FBT #UNSORTED (pkg 1060)
      templates: {
          srPackage:           "{4F9925D4-958D-4427-A735-4767964AA69B}", // FBT Scaffold Templates (pkg 1059, Notes)
          sr:                  "{9D3D6D34-DDDB-4ac6-87D8-1B7938C65F8C}", // FBT SR Template (el. 11149)
          dto:                 "{73A46459-E3D6-4413-BEE8-557E45E17F1A}", // FBT DTO Template (el. 11150)
          req:                 "{800A1529-918A-4dd8-8CDA-E65504A3420C}", // FBT Req Template (el. 11151)
          res:                 "{ECFCBB28-C4EC-40f3-9CD7-2AF4F87244C0}", // FBT Res Template (el. 11152)
          srDiagram:           "{E57793A0-3846-4a23-921B-239A3627A2C6}", // FBT SR Diagram Template (dgm 1147)
          srImpactViewDiagram: "{FFDF5888-A86C-4f50-9152-8EA81C219199}", // FBT Impact View Template (dgm 1148)
          dtoDiagram:          "{1908E030-3D6E-40da-B6D5-CE8D2345BA33}", // FBT DTO Diagram Template (dgm 1149)
          versionDiagram:      "{1290D9BF-7E73-4215-9987-5546E17E70BE}"  // FBT Version Diagram Template (dgm 1150)
      } }
    // Banka (doplni Milos v bance; hodnoty = konstanty z produkce
    // Scripts/ITAN-Find or Create Referencing Service Realization.vbs,
    // do repa NIKDY neukladat - pravidlo ocisty):
    // { repo: "<TEST-DB>",
    //   unsortedPkg: "<EMR-GUID>",  // Logical Design.Logical Design Artefacts.#UNSORTED
    //   templates: {
    //       srPackage:           "<EMR-GUID>", // #Template structure...ServiceName
    //       sr:                  "<EMR-GUID>", // ...SR ServiceName
    //       dto:                 "<EMR-GUID>", // ...DTO ServiceName
    //       req:                 "<EMR-GUID>", // ...ServiceNameReq
    //       res:                 "<EMR-GUID>", // ...ServiceNameRes
    //       srDiagram:           "<EMR-GUID>", // ...SR ServiceName (diagram)
    //       srImpactViewDiagram: "<EMR-GUID>", // ...(SR ServiceName Impact View)
    //       dtoDiagram:          "<EMR-GUID>", // ...DTO ServiceName (diagram)
    //       versionDiagram:      "<EMR-GUID>"  // ...version_ServiceName
    //   } }
];
