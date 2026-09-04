// AICodeBridge.FB_AccessGroups()
// KONFIGURACE pristupu k WRITE ficuram add-inu pres EA security skupiny
// (iterace 5, feature A; vzor FB_OpsAllowed - konfiguracni sekce v modelu,
// zmena = zmena kodu = baselinovana udalost; chranena B4 jako ostatni
// konfiguracni elementy bridge).
//
// VRSTVY autorizace (nezamenovat):
//   1. KDO smi add-in vubec POUZIVAT (cteci ficury) = per-user AKTIVACE
//      add-inu v EA (Specialize > Manage Add-Ins) - EA nativni mechanika,
//      zadny kod bridge (rozhodnuti Milos 2026-08-20; audit aktivaci = SQL
//      dotaz spravce).
//   2. KDO smi WRITE ficury add-inu = clenstvi v EA security skupine dle
//      TETO konfigurace (vynucuje FB_UserAccess + FB_Main -> E_ADDIN_ACCESS).
//      Kdo ma write, ma i read.
//   3. KAM smi zapisovat = EA security balickove skupiny / @F002_Write
//      (plati i pres API; bridge jen preklada chybu - FB_InterpretError,
//      E_PERMISSION/E_LOCKED). Bridge tuto vrstvu ZAMERNE nedrzi.
//   4. Co smi AI KANAL = FB_Whitelist (AI-sandbox) + FB_OpsAllowed
//      (whitelist operaci) - per kanal, ne per user.
//
// Polozka: { repo, writeGroups: ["nazev skupiny", ...] }
//   repo:        podretezec identity dle FB_RepoId (jako FB_Whitelist)
//   writeGroups: nazvy EA security skupin (t_secgroup.GroupName,
//                case-insensitive); clen ASPON JEDNE = smi write ficury.
//
// Chovani (rozhodnuti Milos 2026-08-20):
//   - EA security VYPNUTA -> VSE POVOLENO (vynucovani bez security nedava
//     smysl; kdo ma soubor/DB bez security, obejde cokoli). Dev .qea bezi
//     bez konfigurace.
//   - Security ZAPNUTA + repo BEZ polozky zde -> fail-closed: zadne write
//     ficury (konzistentni s FB_OpsAllowed).
//   - Security ZAPNUTA + polozka -> vynucuje se clenstvi.
//
// Sablona pro banku (nazvy skupin doplni clovek v bance - v repu NIKDY
// skutecne bankovni nazvy, pravidlo ocisty):
//   { repo: "<TEST-DB>", writeGroups: ["<@FXXX_AI_Write>"] }
//
// eaexample (dev stanice): security vypnuta -> polozka neni potreba;
// necha se tu priklad pro harness/testy se zapnutou security.
// QEAX (K8-doma, security ZAPNUTA; Z260904-6): skupinu "EAFB Write" zaklada
//   Milos rucne v EA (Configure > Security > Users/Groups) v kroku K5 a
//   prirazuje si sebe; A2 = vyrazeni ze skupiny + PLNY restart EA (cache
//   FB_UserAccess per session). Placeholder "<QEAX-FILENAME>" nahradi
//   Z260904-6b (viz FB_Whitelist). Bez teto polozky = fail-closed read.
return [
    { repo: "EAEXAMPLE.QEA", writeGroups: ["EAFB Write"] },
    { repo: "<QEAX-FILENAME>", writeGroups: ["EAFB Write"] }
];
