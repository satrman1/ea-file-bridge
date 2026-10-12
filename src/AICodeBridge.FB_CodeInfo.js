// AICodeBridge.FB_CodeInfo(Repository)
// OTISK NASAZENEHO KODU - cteni (FB-PU-02, Z261004b-5). Precte tagged values
// fb.code.* z prvku AICodeBridge (zapisuje bootstrap a deploy_src pres
// FB_CodeFingerprint) a vrati je pro ping, About AI Bridge a hlaseni startu
// session. Jen SQL nad t_objectproperties (zadny COM, zadny zapis).
// Vraci { found, fingerprint, short, files, deployedAt, deployedBy, text }:
//   found false = otisk v modelu neni (kod nasazeny starsim bootstrapem /
//   deploy_src) - text to rekne a radi spustit bootstrap nebo deploy_src.
var self = this;
var out = { found: false, fingerprint: "", short: "", files: 0, deployedAt: "", deployedBy: "", text: "" };
try {
    var xmlA = "" + Repository.SQLQuery("SELECT Object_ID FROM t_object WHERE Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'");
    var mA = /<Object_ID>(\d+)<\/Object_ID>/.exec(xmlA);
    if (!mA) { out.text = "Otisk kodu: prvek AICodeBridge nenalezen"; return out; }
    var rows = this.FB_XmlRows(Repository.SQLQuery("SELECT Property, Value FROM t_objectproperties WHERE Object_ID = " + parseInt(mA[1], 10) + " AND Property LIKE 'fb.code.%'"));
    for (var i = 0; i < rows.length; i++) {
        var p = "" + rows[i].Property, v = "" + (rows[i].Value == null ? "" : rows[i].Value);
        if (p == "fb.code.fingerprint") { out.fingerprint = v; }
        else if (p == "fb.code.files") { out.files = parseInt(v, 10) || 0; }
        else if (p == "fb.code.deployedAt") { out.deployedAt = v; }
        else if (p == "fb.code.deployedBy") { out.deployedBy = v; }
    }
} catch (eQ) { out.text = "Otisk kodu: nelze precist (" + eQ.message + ")"; return out; }
if (out.fingerprint == "") {
    out.text = "Otisk kodu v modelu: neni (kod nasazen starsi verzi bootstrapu/deploy_src - otisk zapise az dalsi bootstrap nebo deploy_src)";
    return out;
}
out.found = true;
out.short = out.fingerprint.substring(0, 12);
out.text = "Otisk kodu v modelu: " + out.short + " (" + out.files + " souboru bez konfigurace, nasazeno " + (out.deployedAt || "?") + " " + (out.deployedBy || "?") + ")";
return out;
