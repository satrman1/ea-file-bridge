// AICodeBridge.FB_InterpretError(rawMsg)
// Prevede SYROVOU EA/COM chybu z pokusu o zapis na CITELNY kod + hlasku.
// Hlavni pripad (Milos 2026-08-20): zapis do package, kam uzivatel nema prava.
// EA security ridi, KAM smi clovek zapisovat - a plati i pres Automation API
// (balickova skupina / @F002_Write). Bridge proto ZAMERNE NEDRZI per-user
// whitelist (duplicita s EA); misto toho se chyba z odepreneho zapisu
// interpretuje na jasnou hlasku (tim se odlisi i read-only uzivatel u
// zapisove davky - dostane E_PERMISSION misto kryptickeho selhani).
// Vraci { code, message } kdyz chybu pozna, jinak null (-> zustane E_EXCEPTION).
// Presny text EA hlasky pri Group Lock OVEREN ZIVE 2026-09-09 (K8 QEAX, vetev
// nize). Hlaska pri chybejicich @F002_Write package permissions v bance zatim
// NE (doma neni MS SQL) - do te doby keyword match; puvodni hlaska se VZDY
// zachova (za ": Puvodni hlaska EA: ...") - nic se neztrati, jen se doplni
// citelny nadpis. Pri prvni realne hlasce z banky sem doplnit presny vzor.
// FB-PU-29 (Z261004b-6): interpretace na E_PERMISSION / E_LOCKED patri JEN
// vyjimkam ze zapisu do MODELU. Souborove chyby (FSO/ADODB: "Permission
// denied" ze slozky responses\images, "Path not found", read-only disk...)
// a databazove chyby (deadlock, timeout, ztracene spojeni) se driv tvarily
// jako "nemas prava" / "zamceno" a clovek sel za spravcem EA kvuli slozce.
// Ted: souborova chyba = E_FILE s vlastnim textem (a priznak fileError pro
// W8 - FB_Main ji bere jako skutecnou vyjimku), deadlock/timeout = E_DB_RETRY
// "docasna chyba databaze - zkus znovu". Tyto dve vetve bezi PRVNI.
var m = ("" + (rawMsg || "")).toLowerCase();
if (m == "") { return null; }
var mt = m.replace(/^\s+|\s+$/g, "").replace(/[.!]+$/, "");
// --- SOUBOR / SLOZKA (FSO, ADODB.Stream, WSH): hlasky bez kontextu modelu ---
// presne hlasky FSO/WSH (bez dalsiho textu) + cesta nebo pripona souboru v textu
var FILE_EXACT = { "permission denied": 1, "path not found": 1, "file not found": 1, "file already exists": 1,
    "disk full": 1, "write protected": 1, "bad file name or number": 1, "device unavailable": 1,
    "file not open": 1, "invalid file name": 1, "the file is locked": 1, "input past end of file": 1 };
var fileLike = (FILE_EXACT[mt] == 1)
    || /[a-z]:\\|\\\\[a-z0-9_.$-]+\\|\.(json|txt|png|jpg|bmp|xml|rtf|docx?|js|wsf|log|csv)\b|\b(file|folder|directory|disk|path)\b|adodb|filesystemobject|\bstream\b|\bsoubor|\bslozk/i.test(m);
var modelLike = /\b(element|package|diagram|connector|attribute|operation|method|model|project security|repository|baseline|t_object|t_package|t_connector|t_diagram)\b/i.test(m);
if (fileLike && !modelLike) {
    return { code: "E_FILE", fileError: true,
        message: "Chyba souboru nebo slozky (NENI to EA security ani zamek v modelu): " + rawMsg
            + ". Zkontroluj slozku vymeny (baseDir, responses\\, prava slozky, volne misto) - viz FB_Config.baseDir." };
}
// --- DATABAZE: deadlock / timeout / ztracene spojeni = docasne, opakovat ---
if (/deadlock|deadlocked|lock request time ?out|timeout expired|query timeout|connection (was )?(reset|broken|lost|closed)|transport-level error|network-related|communication link failure|server was not found|general network error|the connection is broken/i.test(m)) {
    return { code: "E_DB_RETRY",
        message: "Docasna chyba databaze (deadlock / timeout / spojeni) - zkus davku znovu s novym id. Kdyz se opakuje, obrat se na spravce databaze. Puvodni hlaska: " + rawMsg };
}
// --- BALICKOVA PRAVA EA security (K8 A3, Z260904-6): package/prvek zamceny
// NA SKUPINU (Group Lock) nebo rezim "Require User Lock to Edit" bez drzeneho
// zamku. Semanticky je to PRAVO (E_PERMISSION), ne prechodny zamek jineho
// uzivatele (E_LOCKED) - proto tato vetev bezi PRED vetvi zamku, ktera by
// slovo "locked" chytla driv.
// PRESNY VZOR (zive A3, 2026-09-09, QEAX EA 17.1.5 .qeax, package s Group
// Lock na skupinu, jejimz clenem uzivatel neni; Element.Update() v
// create_or_update_elements; docs/e2e-k8-qeax/VYSLEDKY-2026-09-09.md):
//   "Cannot create new UseCase.  The parent package is locked by Project Security."
// (dve mezery za teckou; "UseCase" = typ prvku). Prvni alternativa regexu =
// "locked by project security". Ostatni alternativy zustavaji jako zastupne
// (Require User Lock to Edit doma neovereno - rezim QEAX je standardni;
// slovnik EA UI: Group Lock, User Lock, Require User Lock to Edit).
if (/locked by project security|locked (by|to|for) (the |a )?group|group[ -]?lock|(apply|obtain|require[sd]?|need[s]?|must have|without) (a |an |the )?(user |group )?lock|user lock (is )?required|not locked (by|for) (you|editing)|lock (it|the (element|package)) (first|before)/.test(m)) {
    return { code: "E_PERMISSION",
        message: "Nemas balickova prava k cili zapisu - EA security (package zamcena na skupinu / rezim Require User Lock to Edit), plati i pres API. "
            + "Toto NENI chyba bridge: poproste spravce EA o clenstvi ve skupine s pravem k danemu balicku (nebo si prvek zamkni, pokud rezim vyzaduje uzivatelsky zamek), "
            + "nebo zapisuj do balicku, kam pravo mas. Puvodni hlaska EA: " + rawMsg };
}
// --- pravo k zapisu / EA security ---
if (/permission|do not have|does not have|not have (the )?(write )?right|access denied|denied|security|not authori|insufficient|read[ -]?only|write access/.test(m)) {
    return { code: "E_PERMISSION",
        message: "Nemas pravo zapisu do ciloveho balicku - rizeno EA security (balickova skupina / @F002_Write), plati i pres API. "
            + "Toto NENI chyba bridge: bud poprosis spravce EA o pridani prava k danemu balicku, nebo zapisuj do balicku, kam pravo mas. "
            + "Puvodni hlaska EA: " + rawMsg };
}
// --- zamceni (EA locking / user lock / check-out / baseline reserve) ---
if (/\block|locked|zamk|reserved|checked out|check-?out|in use by|user lock/.test(m)) {
    return { code: "E_LOCKED",
        message: "Cilovy prvek/balicek je zamceny (EA locking) - zapis nelze provest, dokud se zamek neuvolni. "
            + "Puvodni hlaska EA: " + rawMsg };
}
return null;
