// AICodeBridge.FB_Audit(Repository, reqId, summary, requestText)
// Audit element za kazdou davku do package #AI-LOG. Vraci GUID auditu,
// nebo "" kdyz cilova package neexistuje (bridge kvuli tomu nesmi spadnout).
// CIL AUDITU (od 2026-09-09, nalez N-K8-3 ziveho K8 QEAX):
//   1) FB_Config polozka repozitare ma `auditPkg` = GUID package -> audit jde
//      VYHRADNE tam (jmeno se nekontroluje). Kdyz GUID v modelu neni ->
//      WARN + "" (zadny fallback jmenem - konfigurace je pravda).
//   2) bez `auditPkg`: fallback podle JMENA '#AI-LOG' s ORDER BY Package_ID;
//      pri VICE nalezech WARN do Output (audit jde do prvni = nejnizsi ID) -
//      v QEAX (3x #AI-LOG) tak 9. 9. skoncilo 18 artefaktu v /Groups/#AI-LOG
//      misto v zamyslene 686. V bance auditPkg nastavit VZDY (jmeno #AI-LOG
//      je tam bezne, viz NAVOD-NASAZENI-KLIKACI blok 5).
// Audit je zapis do modelu mimo whitelist a mimo vrstvu 2 (zapisuje se i u
// davky odmitnute E_ADDIN_ACCESS - zaznam odmitnuti je zamer); u uzivatele
// bez prav k cilove package spadne na EA security -> volajici to chyta
// (try/catch ve FB_Main) a res nese audit.warning.
var pkg = null;
var cfgGuid = "";
try {
    var cfgs = this.FB_Config();
    var ridU = ("" + this.FB_RepoId(Repository)).toUpperCase();
    for (var ci = 0; ci < cfgs.length; ci++) {
        if (ridU.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0 && cfgs[ci].auditPkg) {
            cfgGuid = "" + cfgs[ci].auditPkg; break;
        }
    }
} catch (eC) { cfgGuid = ""; }
if (cfgGuid != "") {
    try { pkg = Repository.GetPackageByGuid(cfgGuid); } catch (eG) { pkg = null; }
    if (!pkg) {
        this.Log(Repository, "WARN: auditni package z FB_Config.auditPkg " + cfgGuid + " v modelu neni - audit davky se neulozi.");
        return "";
    }
} else {
    var xml = "" + Repository.SQLQuery("SELECT Package_ID, ea_guid FROM t_package WHERE Name = '#AI-LOG' ORDER BY Package_ID");
    var guids = [], re = /<ea_guid>([^<]+)<\/ea_guid>/gi, mm;
    while ((mm = re.exec(xml)) !== null) { guids.push(mm[1]); }
    if (guids.length == 0) {
        this.Log(Repository, "WARN: package #AI-LOG nenalezen - audit davky se neulozi.");
        return "";
    }
    if (guids.length > 1) {
        this.Log(Repository, "WARN: v modelu je " + guids.length + "x package #AI-LOG - audit jde do prvni (" + guids[0] + "); nastav FB_Config.auditPkg na GUID zamyslene package.");
    }
    pkg = Repository.GetPackageByGuid(guids[0]);
}
var el = pkg.Elements.AddNew("FB " + reqId, "Artifact");
el.Notes = summary + "\n\n--- request ---\n" + requestText;
el.Update();
this.SetTag(el, "ai.channel", "eafb");
this.SetTag(el, "ai.request", "" + reqId);
this.SetTag(el, "result", ("" + summary).substring(0, 250));
pkg.Elements.Refresh();
return "" + el.ElementGUID;
