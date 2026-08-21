// AICodeBridge.FB_OpScenarios(Repository, op, reqId)
// create_or_update_scenarios (iterace 2b) - strukturovane UC scenare do
// Scenarios tab (revize U2, rozhodnuti 2026-08-17). Deterministicky rebuild
// (vzor V2d z messages): existujici scenare elementu se SMAZOU a zapisi znovu
// v poradi davky - zadne parcialni updaty, zadne sirotci kroky.
//
// MECHANIKA (spike davky 20260818-16...-28): Element.Scenarios.AddNew(name,
// type: "Basic Path"|"Alternate"|"Exception") + Scenario.Steps.AddNew(text,0).
// Uloziste: t_objectscenarios, strukturovane kroky = XML v XMLContent:
// <path><step name guid level uses result state trigger link/></path>;
// trigger="1" = Actor krok, "0" = System krok; vetev = child kroku
// <extension level="Na" guid="{ScenarioGUID vetve}" join="{GUID KROKU|End}"/>
// (overeno -26: ext guid == ScenarioGUID vetve).
// !! ITERACE 6 - OPRAVA join (reverse engineering davkami -91/-92, dukaz
// z EA UI): atribut join nese **GUID KROKU**, do ktereho se tok vraci,
// nebo doslovny retezec "End" (vetev konci). Drivejsi implementace tam
// psala ScenarioGUID ciloveho scenare - EA takovou hodnotu nerozpozna a
// v UI (Scenarios -> Entry Points -> sloupec Join) ji zobrazi jako "End".
// Zaver POC "EA neumi navrat na konkretni krok" je tim VYVRACEN: EA ho
// umi, bridge ho neumel zapsat. EA pri ulozeni pres UI XMLContent
// normalizuje: prazdny join -> "End", atributy extension prerovna na
// poradi level/guid/join, ke krokum doplni useslist="" a na konec <path>
// blok <context> (cache jmen z uses) - vse kosmetika, ktera se pri
// deterministickem rebuildu ztrati a EA si ji doplni znovu.
// !! ZASADNI LEKCE (davky -18/-20/-24/-26): JAKYKOLI Step API zapis mimo
// prosty AddNew(text,0) - AddNew s typem Actor, vlastnost StepType,
// Extensions.AddNew, i pozdejsi Step.Update() - krok PREMISTI (reinsert)
// a poradi scenare se rozpadne. Proto tri pruchody: (1) scenare + kroky
// VSECHNY jako System (poradi drzi), (2) jen sber vetvi (zadny zapis),
// (3) NAKONEC trigger atributy + <extension> elementy prepisem
// Scenario.XMLContent + Update() - po nem uz zadny Step zapis nesmi bezet.
// EA XMLContent persistuje 1:1 (davka -24 afterPatch) - toho se vyuziva.
//
// op.element   = cilovy element ("{GUID}" | elementID | jmeno | $ref), typicky UseCase
// op.scenarios = [ {
//   name      -> jmeno scenare (povinne)
//   type      -> "Basic Path" (default) | "Alternate" | "Exception"
//   notes     -> poznamka scenare
//   steps     -> [ { text, kind: "actor"|"system" (default system; nebo
//                    explicitni stepType cislem: 1=Actor, 0=System),
//                    uses, results, state } ]
//   attachTo  -> jen vetve: { scenario: <jmeno drive uvedeneho scenare>,
//                             step: <1-based index kroku> }
//   join      -> jen vetve: CISLO KROKU hostitelskeho scenare (toho z
//                attachTo.scenario), do ktereho se tok vraci - metodicky
//                "navrat do kroku M". Vynechano / prazdne / "End" = vetev
//                konci. Neresolvovatelna hodnota (jmeno scenare, cislo mimo
//                rozsah, join bez attachTo) = warning + End (viz par. 3a).
// } ]
// op.probe     = true -> rozsireny readback (raw t_objectscenarios + XML snapshoty)
// Vysledek: items = [{guid, name, type, steps}], readback (API + tableRowCount).
if (!op || !op.element) {
    return { op: "create_or_update_scenarios", status: "error", code: "E_ARGS", message: "Povinne: element." };
}
if (!op.scenarios || Object.prototype.toString.call(op.scenarios) != "[object Array]" || op.scenarios.length == 0) {
    return { op: "create_or_update_scenarios", status: "error", code: "E_ARGS", message: "Povinne: scenarios (neprazdne pole)." };
}
var el = this.FB_ResolveEl(Repository, op.element);
if (el == null) {
    return { op: "create_or_update_scenarios", status: "error", code: "E_NOT_FOUND", message: "Element nenalezen: " + op.element };
}
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
if (chk != null) { return { op: "create_or_update_scenarios", status: "error", code: chk.code, message: chk.message }; }
var items = [], warns = [];
// --- deterministicky rebuild: smazat vsechny existujici scenare ---
var removed = 0;
try {
    for (var di = el.Scenarios.Count - 1; di >= 0; di--) {
        el.Scenarios.DeleteAt(di, false);
        removed++;
    }
    el.Scenarios.Refresh();
} catch (eDel) {
    return { op: "create_or_update_scenarios", status: "error", code: "E_EXCEPTION", message: "Mazani existujicich scenaru selhalo: " + eDel.message };
}
// --- pruchod 1: zalozit scenare + kroky (VSECHNY kroky docasne System) ---
var made = []; // { sc, def, stepTypes[], stepCount, idx, diag }
for (var i = 0; i < op.scenarios.length; i++) {
    var def = op.scenarios[i];
    if (!def || !def.name) {
        return { op: "create_or_update_scenarios", status: "error", code: "E_ARGS", message: "scenarios[" + i + "]: chybi name.", items: items };
    }
    var typ = (typeof def.type != "undefined" && def.type !== null && ("" + def.type) != "") ? ("" + def.type) : "Basic Path";
    var sc;
    try {
        sc = el.Scenarios.AddNew("" + def.name, typ);
        if (!sc.Update()) {
            return { op: "create_or_update_scenarios", status: "error", code: "E_EXCEPTION", message: "scenarios[" + i + "]: Scenario.Update() selhal: " + sc.GetLastError(), items: items };
        }
    } catch (eSc) {
        return { op: "create_or_update_scenarios", status: "error", code: "E_EXCEPTION", message: "scenarios[" + i + "]: AddNew selhal: " + eSc.message, items: items };
    }
    if (typeof def.notes != "undefined") {
        try { sc.Notes = "" + def.notes; sc.Update(); } catch (eN) { warns.push("scenarios[" + i + "]: Notes nelze zapsat: " + eN.message); }
    }
    var stepTypes = [];
    var steps = def.steps || [];
    for (var j = 0; j < steps.length; j++) {
        var s = steps[j];
        var stype;
        if (typeof s.stepType != "undefined") { stype = parseInt(s.stepType, 10); }
        else { stype = (("" + s.kind).toLowerCase() == "actor") ? 1 : 0; }
        stepTypes.push(stype);
        var st;
        try {
            st = sc.Steps.AddNew("" + (s.text || ""), 0);
            if (typeof s.uses != "undefined") { st.Uses = "" + s.uses; }
            if (typeof s.results != "undefined") { st.Results = "" + s.results; }
            if (typeof s.state != "undefined") { st.State = "" + s.state; }
            if (!st.Update()) {
                return { op: "create_or_update_scenarios", status: "error", code: "E_EXCEPTION", message: "scenarios[" + i + "].steps[" + j + "]: Step.Update() selhal: " + st.GetLastError(), items: items };
            }
        } catch (eSt) {
            return { op: "create_or_update_scenarios", status: "error", code: "E_EXCEPTION", message: "scenarios[" + i + "].steps[" + j + "]: " + eSt.message, items: items };
        }
    }
    try { sc.Update(); sc.Steps.Refresh(); } catch (eU) { }
    var diag = null;
    if (op.probe) { diag = { name: "" + def.name, afterSteps: "" + sc.XMLContent }; }
    made.push({ sc: sc, def: def, stepTypes: stepTypes, stepCount: steps.length, idx: i, diag: diag });
}
try { el.Scenarios.Refresh(); } catch (eRf) { }
// --- pruchod 2: sesbirat vetve (attachTo) - zadne Step API zapisy!
//     Extension = <extension level="Na" guid="{ScenarioGUID vetve}"
//     join="{GUID KROKU|End}"/> jako child kroku v XMLContent (overeno
//     davkou -26: ext guid v XML == ScenarioGUID vetve; join = GUID kroku
//     overeno reverse engineeringem -91/-92) ---
function findMade(nm) {
    for (var k = 0; k < made.length; k++) { if (("" + made[k].def.name) == ("" + nm)) { return made[k]; } }
    return null;
}
// GUIDy kroku scenare v poradi 1..N. Ctou se z XMLContent - Step API GUID
// nenabizi a JAKYKOLI Step zapis by kroky premistil (lekce v hlavicce).
// Vysledek se cachuje na polozce made[].
function stepGuids(m) {
    if (m.stepGuids) { return m.stepGuids; }
    var out = [];
    try {
        var xs = "" + m.sc.XMLContent, pos = 0;
        while (true) {
            var s0 = xs.indexOf("<step ", pos);
            if (s0 < 0) { break; }
            var g0 = xs.indexOf(" guid=\"", s0);
            if (g0 < 0) { break; }
            var g1 = xs.indexOf("\"", g0 + 7);
            if (g1 < 0) { break; }
            out.push(xs.substring(g0 + 7, g1));
            pos = g1;
        }
    } catch (eSG) { }
    m.stepGuids = out;
    return out;
}
for (var x = 0; x < made.length; x++) {
    var mdef = made[x].def;
    if (!mdef.attachTo) {
        if (typeof mdef.join != "undefined" && mdef.join !== null && ("" + mdef.join) != "") {
            warns.push("scenarios[" + made[x].idx + "]: join bez attachTo - vetev neni pripnuta na zadny krok, Join nezapsan");
        }
        continue;
    }
    var host = findMade(mdef.attachTo.scenario);
    if (host == null) {
        warns.push("scenarios[" + made[x].idx + "]: attachTo.scenario '" + mdef.attachTo.scenario + "' neni v davce - vetev nepripnuta");
        continue;
    }
    var sIdx = parseInt(mdef.attachTo.step, 10) - 1;
    // isNaN guard: bez nej projde necislena hodnota ("krok 2") validaci
    // (NaN < 0 i NaN >= n je false), ulozi se stepIdx: NaN a v pruchodu 3
    // se nikdy netrefi - vetev by zmizela TISE, bez warningu
    if (isNaN(sIdx) || sIdx < 0 || sIdx >= host.stepCount) {
        warns.push("scenarios[" + made[x].idx + "]: attachTo.step " + mdef.attachTo.step + " mimo rozsah - vetev nepripnuta");
        continue;
    }
    // join = cislo kroku HOSTITELSKEHO scenare -> do XML jde GUID toho kroku;
    // prazdne / "End" / neresolvovatelne -> "End" (a warning)
    var joinVal = "End";
    if (typeof mdef.join != "undefined" && mdef.join !== null && ("" + mdef.join) != "") {
        var jraw = ("" + mdef.join).replace(/^\s+|\s+$/g, "");
        var hg = stepGuids(host);
        if (/^end$/i.test(jraw)) {
            joinVal = "End";
        } else if (/^[0-9]+$/.test(jraw)) {
            var jn = parseInt(jraw, 10);
            if (jn >= 1 && jn <= hg.length) {
                joinVal = hg[jn - 1];
            } else {
                warns.push("scenarios[" + made[x].idx + "]: join '" + jraw + "' je mimo rozsah kroku scenare '" + host.def.name + "' (1.." + hg.length + ") - Join nezapsan (End)");
            }
        } else {
            warns.push("scenarios[" + made[x].idx + "]: join '" + jraw + "' neni cislo kroku - join je CISLO KROKU hostitelskeho scenare '" + host.def.name + "' (1.." + hg.length + ") nebo 'End'; Join nezapsan (End)");
        }
    }
    if (!host.exts) { host.exts = []; }
    host.exts.push({ stepIdx: sIdx, guid: "" + made[x].sc.ScenarioGUID, join: joinVal });
}
// --- pruchod 3 (JEDINY dalsi zapis): typy kroku (trigger) + vetve
//     (<extension>) prepisem XMLContent + Update; po nem uz zadny
//     Step/Steps API zapis nesmi nasledovat ---
for (var p3 = 0; p3 < made.length; p3++) {
    var m3 = made[p3];
    var needPatch = (m3.exts && m3.exts.length > 0) ? true : false;
    for (var tj = 0; tj < m3.stepTypes.length; tj++) { if (m3.stepTypes[tj] != 0) { needPatch = true; break; } }
    if (!needPatch) { continue; }
    try {
        var xml = "" + m3.sc.XMLContent;
        var starts = [], ends = [];
        var pos = 0;
        for (var pj = 0; pj < m3.stepCount; pj++) {
            var sIdx2 = xml.indexOf("<step ", pos);
            if (sIdx2 < 0) { break; }
            var eIdx2 = xml.indexOf("/>", sIdx2);
            starts.push(sIdx2); ends.push(eIdx2);
            pos = eIdx2;
        }
        // zpetne poradi, aby drivejsi vlozeni neposunulo pozice
        for (var rj3 = starts.length - 1; rj3 >= 0; rj3--) {
            var frag = xml.substring(starts[rj3], ends[rj3]);
            if (rj3 < m3.stepTypes.length && m3.stepTypes[rj3] != 0) {
                frag = frag.replace(/trigger="[0-9]*"/, 'trigger="' + m3.stepTypes[rj3] + '"');
            }
            var tail = "/>";
            if (m3.exts) {
                var lvlM = /level="([0-9]+)"/.exec(frag);
                var lvl = lvlM ? lvlM[1] : ("" + (rj3 + 1));
                var sub = "", letters = "abcdefgh";
                var extXml = "";
                for (var ej = 0; ej < m3.exts.length; ej++) {
                    if (m3.exts[ej].stepIdx != rj3) { continue; }
                    // poradi atributu jako EA (level, guid, join) - viz hlavicka
                    extXml += '<extension level="' + lvl + letters.charAt(extXml.split("<extension").length - 1) + '" guid="' + m3.exts[ej].guid + '" join="' + m3.exts[ej].join + '"/>';
                }
                if (extXml != "") { tail = ">" + extXml + "</step>"; }
            }
            xml = xml.substring(0, starts[rj3]) + frag + tail + xml.substring(ends[rj3] + 2);
        }
        m3.sc.XMLContent = xml;
        if (!m3.sc.Update()) { warns.push("scenarios[" + m3.idx + "]: XMLContent Update selhal: " + m3.sc.GetLastError()); }
        if (m3.diag != null) { m3.diag.afterPatch = "" + m3.sc.XMLContent; }
    } catch (eXp) { warns.push("scenarios[" + m3.idx + "]: patch XMLContent selhal: " + eXp.message); }
}
this.SetTag(el, "ai.request", "" + reqId);
// --- readback (pozorovatelnost): API + t_objectscenarios ---
var api = [];
try {
    el.Scenarios.Refresh();
    for (var ri = 0; ri < el.Scenarios.Count; ri++) {
        var rs = el.Scenarios.GetAt(ri);
        var stepsDump = [];
        try {
            for (var rj = 0; rj < rs.Steps.Count; rj++) {
                var rstep = rs.Steps.GetAt(rj);
                var extDump = [];
                try {
                    for (var re = 0; re < rstep.Extensions.Count; re++) {
                        var rext = rstep.Extensions.GetAt(re);
                        extDump.push({ guid: "" + rext.ExtensionGUID, join: "" + rext.Join });
                    }
                } catch (eED) { }
                var sd = { name: "" + rstep.Name, stepType: rstep.StepType, uses: "" + rstep.Uses, results: "" + rstep.Results, state: "" + rstep.State };
                if (extDump.length > 0) { sd.extensions = extDump; }
                stepsDump.push(sd);
            }
        } catch (eSD) { }
        api.push({ guid: "" + rs.ScenarioGUID, name: "" + rs.Name, type: "" + rs.Type, steps: stepsDump, xmlLen: ("" + rs.XMLContent).length });
    }
} catch (eApi) { warns.push("API readback selhal: " + eApi.message); }
var tableRows = [];
try {
    tableRows = this.FB_XmlRows(Repository.SQLQuery(
        "SELECT * FROM t_objectscenarios WHERE Object_ID = " + el.ElementID));
} catch (eQ) { warns.push("t_objectscenarios readback selhal: " + eQ.message); }
for (var mi = 0; mi < made.length; mi++) {
    items.push({ guid: "" + made[mi].sc.ScenarioGUID, name: "" + made[mi].def.name, type: "" + made[mi].sc.Type, steps: made[mi].stepCount, created: true });
}
var res = { op: "create_or_update_scenarios", status: "ok", count: items.length, removed: removed, items: items,
    readback: { api: api, tableRowCount: tableRows.length } };
if (op.probe) {
    var diags = [];
    for (var dgi = 0; dgi < made.length; dgi++) {
        if (made[dgi].diag != null) { diags.push(made[dgi].diag); }
    }
    res.readback.diag = diags;
    var slim = [];
    for (var ti = 0; ti < tableRows.length; ti++) {
        var trow = tableRows[ti], srow = {};
        for (var key in trow) {
            if (typeof trow[key] == "function") { continue; }
            var v = "" + trow[key];
            srow[key] = (v.length > 1200) ? (v.substr(0, 1200) + "...[" + v.length + "]") : v;
        }
        slim.push(srow);
    }
    res.readback.tableRows = slim;
}
if (items.length > 0) { res.guid = items[0].guid; res.id = el.ElementID; }
if (warns.length > 0) { res.warnings = warns; }
return res;
