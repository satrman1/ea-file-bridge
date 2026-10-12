// AICodeBridge.FB_ClipboardContext(Repository)
// MENU "Kontext vyberu do schranky" (FB-UX-03; zadani cil zapisu v1.2 kap.
// 5.7, FB-CZ-20; rozhodnuti O6 = a; Z261004b-11). Schrankovy kanal (M365
// Copilot) nema jak precist vyber ve stromu EA - clovek klikne tuto polozku,
// vlozi obsah schranky do chatu spolu s promptem a agent dostane cil zapisu
// bez cteciho kola. Do schranky jde JEN IDENTITA vyberu: repozitar, typ,
// GUID, plna cesta, writeCheck (tataz kontrola cile zapisu jako pri zapisu,
// bez zamku EA - snimek v okamziku kopirovani, rozhoduje kontrola pri
// provedeni; davka nese GUID), pripadne GUIDy multi-vyberu a aktivni diagram.
// NIKDY obsah (poznamky, atributy, tagy, linked documents) - datova
// minimalizace jako u chat ACK (PROTOKOL par. 4.5).
// Bezi v EA runtime (menu) - COM jen pres FB_ComObj; zapis do schranky stejne
// jako FB_ClipboardImport (htmlfile setData + read-back, fallback clip.exe
// pres docasny UTF-16LE soubor v responses\ - zadny powershell).
// Vraci text pro dialog (co je ve schrance / proc nic).
var self = this;
function pad2(n) { return (n < 10 ? "0" : "") + n; }
var d = new Date();
var when = "" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
var ctx = null;
try { ctx = this.FB_OpSelectedContext(Repository, { op: "get_selected_context" }); }
catch (eC) { return "CHYBA: vyber ve stromu nelze precist (get_selected_context): " + eC.message; }
if (ctx == null || !ctx.selected || ctx.context == null) {
    return "V Project browseru neni nic vybrano (balicek, prvek nebo diagram) - nic jsem do schranky nedal. Oznac cil a klikni znovu.";
}
var c = ctx.context;
var payload = { kind: "eafb-context", protocol: "eafb/0.2", time: when,
    repository: "" + (ctx.repository || this.FB_RepoId(Repository)),
    type: "" + c.type, guid: "" + c.guid, id: c.id, name: "" + c.name, path: "" + c.path,
    branchGuid: "" + c.branchGuid,
    writeCheck: c.writeCheck || { ok: false, code: "?", note: "kontrola cile zapisu chybi" } };
if (ctx.selectedElements && ctx.selectedElements.length > 1) {
    payload.selectedElements = [];
    for (var i = 0; i < ctx.selectedElements.length; i++) {
        var se = ctx.selectedElements[i];
        payload.selectedElements.push({ guid: "" + se.guid, name: "" + se.name, type: "" + se.type });
    }
}
if (ctx.currentDiagram) { payload.currentDiagram = { guid: "" + ctx.currentDiagram.guid, name: "" + ctx.currentDiagram.name, type: "" + ctx.currentDiagram.type }; }
var wc = payload.writeCheck;
var human = "EA File Bridge - kontext vyberu (" + when + "): " + payload.type + " '" + payload.name + "' " + payload.guid
    + " | cesta: " + payload.path + " | repozitar: " + payload.repository
    + " | zapis sem: " + (wc.ok ? "ANO (projde kontrolou cile; zamky EA rozhodnou az pri zapisu)" : "NE - " + ((("" + wc.note).indexOf("" + wc.code) == 0) ? wc.note : (wc.code + ": " + wc.note)));
var text = human + "\n" + this.FB_JsonStringify(payload);
// --- zapis do schranky (lekce 2026-08-20: htmlfile.setData v EA runtime umi
// tise nic nezapsat -> read-back; fallback clip.exe) ---
function clipWrite(s) {
    s = "" + s;
    try {
        var html = self.FB_ComObj("htmlfile");
        html.parentWindow.clipboardData.setData("Text", s);
        var chk = "" + html.parentWindow.clipboardData.getData("Text");
        if (chk === s) { return "htmlfile"; }
    } catch (eCW) { }
    try {
        var fso = self.FB_ComObj("Scripting.FileSystemObject");
        var base = "" + self.FB_ResolveBaseDir(Repository);
        var dir = base + "\\responses";
        if (!fso.FolderExists(dir)) { fso.CreateFolder(dir); }
        var tmp = dir + "\\_clip-context.tmp";
        // UTF-16LE BEZ BOM (zive 12. 10.: BOM z ADODB "unicode" skoncil ve schrance
        // jako neviditelny prvni znak) - text se zapise, prepne na binarni a
        // ulozi od pozice 2 (za BOM)
        var st = self.FB_ComObj("ADODB.Stream");
        st.Type = 2; st.Charset = "unicode"; st.Open();
        st.WriteText(s);
        st.Position = 0; st.Type = 1; st.Position = 2;
        var bin = self.FB_ComObj("ADODB.Stream");
        bin.Type = 1; bin.Open();
        st.CopyTo(bin);
        bin.SaveToFile(tmp, 2);
        bin.Close(); st.Close();
        var sh = self.FB_ComObj("WScript.Shell");
        sh.Run('cmd /c clip < "' + tmp + '"', 0, true);
        if (fso.FileExists(tmp)) { fso.DeleteFile(tmp); }
        return "clip.exe";
    } catch (eClip) { return ""; }
}
var how = clipWrite(text);
if (how == "") {
    return "CHYBA: do schranky se nepodarilo zapsat (htmlfile ani clip.exe). Kontext (opis rucne):\n\n" + text;
}
try { this.Log(Repository, "FB kontext vyberu do schranky (" + how + "): " + human); } catch (eL) { }
return "Do schranky zkopirovano (vloz do chatu spolu s promptem):\n\n" + text;
