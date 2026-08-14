// AICodeBridge.FB_Main(Repository, requestText)
// Vstupni bod executoru (eafb/0.1): text requestu -> text response (JSON).
// Stop-on-error: prvni chyba v davce zastavi zbytek (oznaci se "skipped").
var resp = { protocol: "eafb/0.1", id: "", status: "error", results: [] };
var req = null;
try {
    req = this.FB_JsonParse(requestText);
} catch (e) {
    resp.code = "E_PARSE";
    resp.message = "Request neni validni JSON.";
    return this.FB_JsonStringify(resp);
}
var reqId = "" + ((req && req.id) || ("noid-" + (new Date()).getTime()));
resp.id = reqId;
// repository = identita dle FB_RepoId (MS SQL: nazev DB; lokalni fallback
// ConnectionString); connection = cesta pripojeni - v response je videt oboji.
resp.repository = "" + this.FB_RepoId(Repository);
resp.connection = "" + Repository.ConnectionString;
// Volitelna (v copilot-instructions povinna) deklarace ciloveho repozitare:
// request.repo = podretezec identity dle FB_RepoId (u MS SQL nazev databaze).
// Pri neshode se NIC neprovede (ani audit - do ciziho repozitare se
// nezapisuje ani carka). Kryje scenar "davka pro TEST zpracovana v PROD"
// (klon) - klon ma shodne GUIDy i whitelist kod, rozhodnout muze jen
// deklarace v samotne davce.
if (req.repo) {
    var cs = ("" + resp.repository).toUpperCase();
    if (cs.indexOf(("" + req.repo).toUpperCase()) < 0) {
        resp.code = "E_REPO";
        resp.message = "Davka je urcena pro repozitar '" + req.repo + "', pripojeny je jiny. Nic nebylo provedeno.";
        return this.FB_JsonStringify(resp);
    }
}
if (!req.ops || Object.prototype.toString.call(req.ops) != "[object Array]" || req.ops.length == 0) {
    resp.code = "E_PARSE";
    resp.message = "Request nema neprazdne pole ops.";
    return this.FB_JsonStringify(resp);
}
var okc = 0, errc = 0, failed = false;
for (var i = 0; i < req.ops.length; i++) {
    var op = req.ops[i];
    var name = "" + (op && op.op ? op.op : "?");
    if (failed) {
        resp.results.push({ op: name, status: "skipped" });
        continue;
    }
    var r;
    try {
        if (name == "ping") { r = this.FB_OpPing(Repository, op); }
        else if (name == "query") { r = this.FB_OpQuery(Repository, op); }
        else if (name == "create_element") { r = this.FB_OpCreateElement(Repository, op, reqId); }
        else { r = { op: name, status: "error", code: "E_UNKNOWN_OP", message: "Neznama operace: " + name }; }
    } catch (e2) {
        r = { op: name, status: "error", code: "E_EXCEPTION", message: "" + e2.message };
    }
    resp.results.push(r);
    if (r.status == "ok") { okc++; } else { errc++; failed = true; }
}
resp.status = failed ? "error" : "done";
var summary = resp.status + ": " + req.ops.length + " ops (" + okc + " ok, " + errc + " chyb)";
try {
    var ag = this.FB_Audit(Repository, reqId, summary, "" + requestText);
    resp.audit = { aiLogGuid: ag };
} catch (e3) {
    resp.audit = { aiLogGuid: "", warning: "Audit selhal: " + e3.message };
}
this.Log(Repository, "FB " + reqId + " -> " + summary);
return this.FB_JsonStringify(resp);
