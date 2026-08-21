// AICodeBridge.FB_ConfirmSummary(resp)
// LIDSKY souhrn confirm_required davky pro potvrzovaci dialog (pumpa / GUI
// fallback / stavove okno vratneho). Cil (Milosova UX zpetna vazba 2026-08-20):
// nejdriv CO SE STANE a KDE, plainu; technicka metrika + hashPrefix az dole
// jako mala paticka. NIKDY plny hash/nonce (par. 6.3) - jen prefix.
// Vstup: parsovany response objekt (status confirm_required).
if (resp === null || typeof resp == "undefined") { return "(zadna response)"; }
var risk = resp.risk || {};
var m = risk.metrics || {};
var sm = risk.summary || {};
var L = [];
// --- headline: co se chysta ---
var del = (typeof m.deleteTargets == "number") ? m.deleteTargets : 0;
var creat = (typeof m.createOps == "number") ? m.createOps : 0;
var upd = (typeof m.updatedExisting == "number") ? m.updatedExisting : 0;
var pkgs = (sm.packages && sm.packages.length) ? sm.packages : [];
var mov = (typeof m.moveOps == "number") ? m.moveOps : 0;
var head;
if (del > 0) {
    head = "Chysta se SMAZAT " + del + " " + (del == 1 ? "prvek" : (del < 5 ? "prvky" : "prvku")) + " z modelu.";
} else if (mov > 0) {
    // iterace 6: presun je zasah do STRUKTURY - dialog to musi rict rovnou,
    // jinak je k nerozeznani od prejmenovani (a cele zduvodneni ELEVATED
    // u move_elements stoji na tom, ze presun meni, kam prvek patri)
    head = "Chysta se PRESUNOUT " + mov + " " + (mov == 1 ? "prvek" : (mov < 5 ? "prvky" : "prvku")) + " mezi balicky"
        + (pkgs.length > 0 ? " (" + pkgs.join(" / ") + ")" : "") + ".";
} else {
    var partsH = [];
    if (creat > 0) { partsH.push("vytvorit " + creat); }
    if (upd > 0) { partsH.push("upravit " + upd); }
    if (partsH.length == 0) { partsH.push("zapsat"); }
    head = "Chysta se " + partsH.join(" a ") + " "
        + ((creat + upd) == 1 ? "prvek" : "prvku")
        + (pkgs.length > 0 ? " v " + pkgs.length + " " + (pkgs.length == 1 ? "balicku" : "balicich") : "") + ".";
}
L.push(head);
L.push("");
// --- kde + ktere ---
if (sm.targets && sm.targets.length > 0) {
    L.push((del > 0 ? "Ke smazani: " : "Prvky: ") + sm.targets.join(", "));
}
if (pkgs.length > 0) { L.push("Balicky: " + pkgs.join(", ")); }
if (sm.diagrams && sm.diagrams.length > 0) { L.push("Diagramy: " + sm.diagrams.join(", ")); }
// --- proc se ptam (plainu, prvni konkretni duvod) ---
if (risk.riskReasons && risk.riskReasons.length > 0) {
    L.push("");
    L.push("Proc potvrzeni: " + risk.riskReasons[0]);
    if (risk.riskReasons.length > 1) {
        L.push("  (+ " + (risk.riskReasons.length - 1) + " dalsi duvod/y - viz res soubor)");
    }
}
// --- akce ---
L.push("");
L.push("Ano = provest  |  Ne = zahodit  |  Storno = rozhodnout pozdeji");
// --- mala technicka paticka (kontrola integrity; NE plny hash) ---
var foot = "id " + (resp.id || "?");
if (resp.confirm && resp.confirm.hashPrefix) { foot += " | otisk " + resp.confirm.hashPrefix + "…"; }
if (typeof m.writeOps == "number") { foot += " | zapisu " + m.writeOps; }
L.push("(" + foot + ")");
return L.join("\n");
