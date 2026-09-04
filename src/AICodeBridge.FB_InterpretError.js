// AICodeBridge.FB_InterpretError(rawMsg)
// Prevede SYROVOU EA/COM chybu z pokusu o zapis na CITELNY kod + hlasku.
// Hlavni pripad (Milos 2026-08-20): zapis do package, kam uzivatel nema prava.
// EA security ridi, KAM smi clovek zapisovat - a plati i pres Automation API
// (balickova skupina / @F002_Write). Bridge proto ZAMERNE NEDRZI per-user
// whitelist (duplicita s EA); misto toho se chyba z odepreneho zapisu
// interpretuje na jasnou hlasku (tim se odlisi i read-only uzivatel u
// zapisove davky - dostane E_PERMISSION misto kryptickeho selhani).
// Vraci { code, message } kdyz chybu pozna, jinak null (-> zustane E_EXCEPTION).
// !! PRESNY text EA hlasky pri odepreni zapisu je nutne OVERIT NAZIVO v bance
// s OMEZENYM uzivatelem - do te doby keyword match; puvodni hlaska se VZDY
// zachova (za ": Puvodni hlaska EA: ...") - nic se neztrati, jen se doplni
// citelny nadpis. Pri prvni realne hlasce z banky sem doplnit presny vzor.
var m = ("" + (rawMsg || "")).toLowerCase();
if (m == "") { return null; }
// --- BALICKOVA PRAVA EA security (K8 A3, Z260904-6): package/prvek zamceny
// NA SKUPINU (Group Lock) nebo rezim "Require User Lock to Edit" bez drzeneho
// zamku. Semanticky je to PRAVO (E_PERMISSION), ne prechodny zamek jineho
// uzivatele (E_LOCKED) - proto tato vetev bezi PRED vetvi zamku, ktera by
// slovo "locked" chytla driv.
// !! ZASTUPNY VZOR: klicova slova odhadnuta z terminologie EA UI (Group Lock,
// User Lock, Require User Lock to Edit). PRESNOU syrovou hlasku z Automation
// API doda zivy krok A3 (docs/e2e-k8-qeax/PROTOKOL-K8.md) a vyhodnocovaci
// vlakno Z260904-6b ji sem doplni jako prvni alternativu regexu + test.
if (/locked (by|to|for) (the |a )?group|group[ -]?lock|(apply|obtain|require[sd]?|need[s]?|must have|without) (a |an |the )?(user |group )?lock|user lock (is )?required|not locked (by|for) (you|editing)|lock (it|the (element|package)) (first|before)/.test(m)) {
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
