# -*- coding: utf-8 -*-
"""Z261017-2 (17. 10. 2026): extraktor volani pro servisni realizace (SR) reverse add-inu EA File Bridge.

Pro kazdou operaci katalogu (ir_sr.OPS) projde jeji code-path (src/AICodeBridge.<fn>.js) a vypise:
 - volani funkci bridge `this.X(` / `self.X(` (X = jmeno souboru v src/; zadani rika `this.FB_*(` - rozsireno o
   `self.` (kod pouziva `var self = this`) a o funkce bez prefixu FB_ (Log, SetTag, GetTag)),
 - prevod volane funkce na komponentu IDesign (FUNC2COMP: code-path operaci > vyjmenovane soubory v poli
   code komponenty > zastupne vzory FB_Op* apod. > MANUAL s duvodem),
 - dotcene tabulky EA a typ pristupu C/R/U/D (SQL retezce = R, protoze Repository.SQLQuery je jen cteni;
   Automation: *.AddNew = C, Update = U nad entitou ziskanou Get*By*, DeleteAt/Delete* = D),
 - IR sekvence: lifeliny (vstupni komponenta + volane komponenty + entity), zpravy v poradi vyskytu v kodu
   jen na hranicich komponent a DB hrane; volani v ramci tehoz komponentu se nekresli, ale pomocne funkce
   tehoz komponentu se "rozbali" (jejich volani a DB pristupy patri k operaci); volani jine operace katalogu
   tehoz komponentu = ref (bez rozbaleni); volani operace jine komponenty = zprava + ref na jeji SR.
Utility (IDesign Utility, pruzezova) a Log/FB_OutputFlush (pruzezovy vypis do Output) se nekresli - pocet
v `skipped`. Dynamicke volani z registru (`this[reg.fn]`) extraktor nevidi - hlasi `dynamic`.
Spousteni: python3 extract_calls.py [--selfcheck] [--json out.json] [op ...]
"""
import re, os, io, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ir_addin as I
import ir_sr as S
SRC = os.path.join(HERE, "..", "..", "src")

def load_src():
    F = {}
    for f in os.listdir(SRC):
        m = re.match(r"AICodeBridge\.(.+)\.js$", f)
        if m: F[m.group(1)] = io.open(os.path.join(SRC, f), encoding="utf-8", errors="replace").read()
    return F
FUNCS = load_src()

# --- funkce -> komponenta -------------------------------------------------------------------------
MANUAL = {
 "FB_BaselineCleanupHook": ("bpol", "spoustec uklidu baseline politiky (vola FB_Main po zapisove davce)"),
 "FB_SessionToken": ("bpol", "session token executoru = pojem baseline politiky (zadani Baseline politika par. 4.5)"),
 "FB_ChatRender": ("ui", "text odpovedi pro schranku / Copilot = vystup schrankoveho kanalu"),
 "FB_ClipboardSearch": ("ui", "vstup schrankoveho kanalu z vyhledavaciho pole EA"),
 "FB_Gatekeeper": ("ui", "vratny (AI import rezim) spousteny z menu"),
 "FB_GatekeeperLaunch": ("ui", "spousteni vratneho z menu"),
 "FB_NavProbe": ("ui", "sonda navigace v EA runtime (menu)"),
 "FB_ShowInBrowser": ("ui", "navigace v Project browseru po interaktivni davce"),
 "FB_Process": ("ui", "vstupni bod Add-in Search (vratny)"),
 "FB_InBranch": ("mea", "pruchod stromem balicku pres Automation (vola FB_OpFindElements/FindPackages)"),
 "FB_ResolveFail": ("mea", "chybovy vysledek resolveru prvku/balicku"),
 "GetTag": ("mea", "cteni tagged value prvku (jako FB_TagRead)"),
 "SetTag": ("mea", "zapis tagged value prvku (jako FB_TagWrite)"),
 "FB_Config": ("util", "konfigurace prostredi per repozitar - cte ji kazda vrstva (pruzezova)"),
 "FB_RepoId": ("util", "identita repozitare - cte ji kazda vrstva (pruzezova; notes SR Ping)"),
 "FB_XmlUnescape": ("util", "prevod XML entit (pruzezova pomucka)"),
 "FindTargetMethod": ("code", "legacy kanal #AI-CODE (DeployRequest/ExportRequest) - kod add-inu v modelu"),
 "ProcessRequests": ("code", "legacy kanal #AI-CODE - zpracovani deploy/export/query requestu"),
 "RunQuery": ("code", "legacy kanal #AI-CODE - mode query"),
}
def func2comp():
    m, why, wild = {}, {}, []
    for c in I.COMPONENTS:
        for o in c["ops"]:
            fn = o[4].split("AICodeBridge.")[1][:-3]
            m[fn] = c["key"]; why[fn] = "code-path operace %s" % o[0]
    for c in I.COMPONENTS:
        for part in c["code"].split(";"):
            part = part.strip()
            mm = re.match(r"(?:src/)?(?:AICodeBridge\.)?([A-Za-z0-9_]+\*?)(?:\(([A-Za-z]+)\))?", part)
            if not mm or part.startswith("..."): continue
            nm, suf = mm.group(1), mm.group(2)
            if nm.endswith("*"): wild.append((nm[:-1], c["key"])); continue
            for n in ([nm] + ([nm + suf] if suf else [])):
                if n in FUNCS and n not in m: m[n] = c["key"]; why[n] = "pole code komponenty %s" % c["name"]
    wild.sort(key=lambda w: -len(w[0]))
    for f in FUNCS:
        if f in m: continue
        for pre, k in wild:
            if f.startswith(pre): m[f] = k; why[f] = "vzor %s* v poli code" % pre; break
    unassigned = []
    for f in sorted(FUNCS):
        if f in m: continue
        if f in MANUAL: m[f] = MANUAL[f][0]; why[f] = "rucne: " + MANUAL[f][1]
        else: unassigned.append(f)
    return m, why, unassigned
F2C, F2C_WHY, UNASSIGNED = func2comp()
OPFN = {o[3]: o for o in S.OPS}          # funkce code-path -> operace katalogu
CNAME = {c["key"]: c["name"] for c in I.COMPONENTS}
NOSHOW = {"Log", "FB_OutputFlush"}       # pruzezovy vypis do Output

# --- entity LDM ---------------------------------------------------------------------------------
TABLE2ENT = {"t_package": "Package", "t_object": "Element", "t_objectproperties": "TaggedValue", "t_attribute": "Attribute",
             "t_operation": "Operation", "t_connector": "Connector", "t_diagram": "Diagram", "t_diagramobjects": "Diagram",
             "t_diagramlinks": "Diagram", "t_document": "Baseline",
             # 17. 10. 2026 (balik N-RE-26): dalsich 8 entit LDM (extract_ldm.build_new)
             "t_objectscenarios": "ObjectScenario", "t_objectconstraint": "ObjectConstraint", "t_objectrequires": "ObjectRequirement",
             "t_operationparams": "OperationParameter", "t_connectortag": "ConnectorTag", "t_secuser": "SecurityUser",
             "t_secgroup": "SecurityGroup", "t_secusergroup": "SecurityUserGroup"}
AUTOMATION = [  # (regex, entita nebo tabulka kandidata, CRUD)
 (r"\.Packages\.AddNew\(", "Package", "C"), (r"\.Elements\.AddNew\(", "Element", "C"), (r"\.Diagrams\.AddNew\(", "Diagram", "C"),
 (r"\.Connectors\.AddNew\(", "Connector", "C"), (r"\.TaggedValues\.AddNew\(", "TaggedValue", "C"), (r"\.Attributes\.AddNew\(", "Attribute", "C"),
 (r"\.Methods\.AddNew\(", "Operation", "C"), (r"\.DiagramObjects\.AddNew\(", "Diagram", "U"), (r"\.DiagramLinks\b", "Diagram", "U"),
 (r"\.Parameters\.AddNew\(", "t_operationparams", "C"), (r"\.Scenarios\.", "t_objectscenarios", "U"), (r"\.Constraints\.", "t_objectconstraint", "U"),
 (r"\.Requirements\.", "t_objectrequires", "U"),
 (r"\.Packages\.DeleteAt\(", "Package", "D"), (r"\.Elements\.DeleteAt\(", "Element", "D"), (r"\.Diagrams\.DeleteAt\(", "Diagram", "D"),
 (r"\.Connectors\.DeleteAt\(", "Connector", "D"), (r"\.TaggedValues\.DeleteAt\(", "TaggedValue", "D"), (r"\.Attributes\.DeleteAt\(", "Attribute", "D"),
 (r"\.Methods\.DeleteAt\(", "Operation", "D"), (r"\.DiagramObjects\.DeleteAt\(", "Diagram", "U"),
 (r"CreateBaseline\(", "Baseline", "C"), (r"DeleteBaseline\(", "Baseline", "D"), (r"GetBaselines\(", "Baseline", "R"), (r"DoBaselineCompare\(", "Baseline", "R"),
 (r"GetElementBy(?:ID|Guid)\(", "Element", "R"), (r"GetPackageBy(?:ID|Guid)\(", "Package", "R"), (r"GetDiagramBy(?:ID|Guid)\(", "Diagram", "R"),
 (r"GetConnectorBy(?:ID|Guid)\(", "Connector", "R"), (r"GetAttributeBy(?:ID|Guid)\(", "Attribute", "R"), (r"GetMethodBy(?:ID|Guid)\(", "Operation", "R"),
 (r"\.TaggedValues\.(?:GetAt|GetByName|Count)\b", "TaggedValue", "R"), (r"SetCompositeDiagram\(", "Element", "U"),
 (r"\.Code\s*=[^=]", "Operation", "U"), (r"\.Behavior\s*=[^=]", "Operation", "U"),
]
FILEPAT = [  # souborovy zdroj (IDS-File Resource "EAFB Exchange Folder"): R = cteni, W = zapis
 (r"OpenTextFile\([^,)]*,\s*1\b", "R"), (r"OpenTextFile\([^,)]*,\s*[28]\b", "W"), (r"OpenTextFile\([^,)]*\)", "R"), (r"CreateTextFile\(", "W"),
 (r"\.ReadAll\(|\.ReadLine\(|LoadFromFile\(|\.FileExists\(|\.GetFolder\(|\.GetFile\(", "R"),
 (r"SaveToFile\(|\.MoveFile\(|\.CopyFile\(|\.DeleteFile\(|\.CreateFolder\(", "W"),
]
FILE_EXCLUDE = {"code"}   # DeploySrc cte slozku src\ - neni vymenna slozka (veta v notes SR)
CALL = re.compile(r"\b(?:this|self)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(")
DYN = re.compile(r"\b(?:this|self)\[")
STR = re.compile(r"\"(?:[^\"\\\n]|\\.)*\"|'(?:[^'\\\n]|\\.)*'")
TBL = re.compile(r"\b(t_[a-z_]+)\b", re.I)

def strip_comments(t):
    out = []
    for line in t.split("\n"):
        s = line.lstrip()
        if s.startswith("//"): out.append(" " * len(line)); continue
        # konec radku za kodem: // jen kdyz pred nim neni otevreny retezec (sudy pocet uvozovek)
        i = line.find("//")
        while i >= 0:
            pre = line[:i]
            if pre.count('"') % 2 == 0 and pre.count("'") % 2 == 0 and not pre.rstrip().endswith(":"):
                line = pre + " " * (len(line) - i); break
            i = line.find("//", i + 2)
        out.append(line)
    return "\n".join(out)
CODE = {f: strip_comments(t) for f, t in FUNCS.items()}

def raw_events(fn):
    """[(pos, kind, payload)] v poradi vyskytu."""
    t = CODE.get(fn, ""); ev = []
    for m in CALL.finditer(t):
        if m.group(1) in FUNCS and m.group(1) != fn: ev.append((m.start(), "call", m.group(1)))
    for m in DYN.finditer(t): ev.append((m.start(), "dynamic", None))
    for m in STR.finditer(t):
        s = m.group(0)
        if re.search(r"\b(SELECT|FROM|JOIN)\b", s, re.I):
            for tm in TBL.finditer(s): ev.append((m.start() + tm.start(), "db", (tm.group(1).lower(), "R")))
    for rx, rw in FILEPAT:
        for m in re.finditer(rx, t): ev.append((m.start(), "file", rw))
    for rx, ent, crud in AUTOMATION:
        for m in re.finditer(rx, t): ev.append((m.start(), "db", (ent, crud)))
    # U: Update() nad entitou ziskanou Get*By* / zalozenou AddNew v teze funkci (heuristika, viz extract_ldm)
    if re.search(r"\.Update\(\)", t):
        got = []
        for rx, ent, crud in AUTOMATION:
            if crud in ("R", "C") and ent in ("Element", "Package", "Diagram", "Connector", "Attribute", "Operation", "TaggedValue") and re.search(rx, t):
                if ent not in got: got.append(ent)
        p = re.search(r"\.Update\(\)", t).start()
        for ent in got: ev.append((p, "db", (ent, "U")))
    ev.sort(key=lambda e: e[0])
    return ev

def norm_ent(x):
    return TABLE2ENT.get(x, x)

def events(fn, owner, entry_op, seen):
    """Rozbali pomocne funkce teze komponenty; vraci [(kind, payload)]."""
    out = []
    for pos, kind, p in raw_events(fn):
        if kind == "db": out.append(("db", (norm_ent(p[0]), p[1])))
        elif kind == "dynamic": out.append(("dynamic", fn))
        elif kind == "file":
            if owner not in FILE_EXCLUDE: out.append(("file", p))
        else:
            comp = F2C.get(p)
            if p in NOSHOW or comp == "util": out.append(("skip", p)); continue
            callee_op = OPFN.get(p)
            if comp == owner:
                if callee_op and callee_op[0] != entry_op: out.append(("ref", callee_op[0])); continue
                if p in seen: continue
                seen.add(p); out += events(p, owner, entry_op, seen)
            else:
                out.append(("call", (comp, p, callee_op[0] if callee_op else None)))
    return out

def ir(opname):
    o = [x for x in S.OPS if x[0] == opname][0]
    owner, fn = o[1], o[3]
    ev = events(fn, owner, opname, {fn})
    life = [owner]; msgs = []; refs = []; skipped = {}; dyn = 0; cand = []; seenm = set()
    for kind, p in ev:
        if kind == "skip": skipped[p] = skipped.get(p, 0) + 1
        elif kind == "dynamic": dyn += 1
        elif kind == "ref":
            if p not in refs: refs.append(p)
        elif kind == "call":
            comp, f, op = p
            key = ("call", comp, op or f)
            if key in seenm: continue
            seenm.add(key)
            if comp not in life: life.append(comp)
            msgs.append({"to": comp, "fn": f, "op": op})
            if op and op not in refs and (op in S.EXISTING_SR or comp not in S.NO_SR_COMPONENTS): refs.append(op)
        elif kind == "file":
            key = ("file", p)
            if key in seenm: continue
            seenm.add(key)
            if "xf" not in life: life.append("xf")
            msgs.append({"to": "xf", "file": p})
        elif kind == "db":
            ent, crud = p
            if ent.startswith("t_"):
                if ent not in cand: cand.append(ent)
                continue
            key = ("db", ent, crud)
            if key in seenm: continue
            seenm.add(key)
            if "E:" + ent not in life: life.append("E:" + ent)
            msgs.append({"to": "E:" + ent, "crud": crud})
    # entity za komponentami (citelnost: komponenty vlevo, DB vpravo), poradi zprav zustava
    life = [l for l in life if not l.startswith("E:") and l != "xf"] + [l for l in life if l == "xf"] + [l for l in life if l.startswith("E:")]
    return {"op": opname, "comp": owner, "fn": fn, "lifelines": life, "msgs": msgs, "refs": refs,
            "skipped": skipped, "dynamic": dyn, "candidates": cand}

# --- Request / Response pole --------------------------------------------------------------------
def pascal(n):
    n = re.sub(r"[^A-Za-z0-9_]", "", n)
    return n[:1].upper() + n[1:]
def header(fn):
    h = []
    for line in FUNCS.get(fn, "").split("\n"):
        if line.startswith("//"): h.append(line[2:].strip())
        elif line.strip() == "": continue
        else: break
    return h
STD = {"op": "jméno operace protokolu (opakuje požadavek)", "status": "ok | error - výsledek operace",
       "code": "kód chyby E_* (jen při chybě)", "message": "hláška pro člověka i agenta",
       "warnings": "varování, která operaci nezastavila", "items": "zapsané nebo nalezené položky (index, id, guid, name)",
       "guid": "GUID hlavního výsledku", "id": "ID hlavního výsledku", "count": "počet položek",
       "partial": "true = operace skončila výjimkou EA uprostřed, items nesou provedenou část",
       "stamped": "razítka ai.request mimo items po výjimce", "recovery": "návod obnovy z baseline po výjimce"}
def field_note(fn, f, res=False):
    if res and f in STD: return STD[f]
    if f in ("op", "id", "guid", "name", "status", "code"): return STD.get(f, "")
    for line in header(fn):
        if re.search(r"(?<![A-Za-z0-9_])(?:op\.)?%s(?![A-Za-z0-9_])" % re.escape(f), line):
            return re.sub(r"\s+", " ", line)[:250]
    return ""
NUM = {"x", "y", "width", "height", "maxRows", "seqNo", "position", "index", "count", "rowCount", "id", "lowerBound", "upperBound"}
BOOL_PREF = ("is", "has", "with", "match", "exact", "show", "found", "partial", "truncated", "moved", "rebuild", "brief", "reset", "probe", "approve", "force")
ARR = {"items", "warnings", "problems", "results", "stamped", "removed", "cascades", "rows", "elements", "targets", "packages", "diagrams",
       "connectors", "attributes", "operations", "messages", "scenarios", "constraints", "requirements", "elementPlacements", "objects",
       "elementIDs", "ids", "guids", "candidates", "resolved", "skipped", "images", "files", "baselines", "changes", "reasonItems", "riskReasons"}
OBJ = {"risk", "qc", "created", "counts", "summary", "baseline", "confirm", "codeInfo", "writeScope", "riskPolicy", "userAccess", "parse",
       "metrics", "context", "writeCheck", "plan", "decision", "posture", "scope", "result"}
def ftype(f):
    if f in ("ok", "valid", "done", "allowed"): return "boolean"
    if f in ARR: return "array"
    if f in OBJ: return "object"
    if f in NUM or re.search(r"(ID|Id|Ms|Count|Rows|Min|Days|Hours)$", f): return "number"
    for p in BOOL_PREF:
        if f.startswith(p) and (len(f) == len(p) or f[len(p)].isupper()): return "boolean"
    return "string"

def protocol_name(o):
    # protokolova operace: parametr "Operation" (ir_addin.proto_ops) -> jmeno op z poznamky
    c = [x for x in I.COMPONENTS if x["key"] == o[1]][0]
    for op in c["ops"]:
        if op[0] == o[0]:
            for p in op[1]:
                m = re.search(r"op = ([a-z_]+)", p["notes"] or "")
                if m: return m.group(1)
            m = re.search(r"Protokolová operace ([a-z_]+)", op[3])
            if m: return m.group(1)
    return None

def spec_fields():
    t = FUNCS["FB_FieldCheck"]
    m = re.search(r"var SPEC = \{(.*?)\n\};", t, re.S)
    body = m.group(1); out = {}
    for mm in re.finditer(r'"([a-z_]+)":\s*\{\s*top:\s*\[([^\]]*)\]', body):
        name = mm.group(1); top = re.findall(r'"([A-Za-z_]+)"', mm.group(2))
        # polozky prvniho seznamu
        rest = body[mm.end(): mm.end() + 1500]
        it = re.search(r"item:\s*\[([^\]]*)\]", rest)
        nxt = re.search(r'\n\s{4}"[a-z_]+":\s*\{', rest)
        items = re.findall(r'"([A-Za-z_0-9]+)"', it.group(1)) if it and (not nxt or it.start() < nxt.start()) else []
        out[name] = (top, items)
    return out
SPEC = spec_fields()

def op_fields_from_code(fn):
    t = CODE.get(fn, ""); seen = []
    for m in re.finditer(r"\bop\.([A-Za-z_][A-Za-z0-9_]*)", t):
        f = m.group(1)
        if f not in seen and f not in ("op",): seen.append(f)
    return seen

def header_keys(fn):
    """Klice z vety hlavicky 'Vraci { a, b: ..., c{...} }' (autorsky popis tvaru odpovedi ma prednost)."""
    h = " ".join(header(fn))
    m = re.search(r"(?:Vraci|Vrací|Vysledek|Výsledek)\s*:?\s*\{", h)
    if not m: return []
    i = m.end(); depth = 1; buf = ""
    while i < len(h) and depth:
        ch = h[i]
        if ch == "{": depth += 1
        elif ch == "}": depth -= 1
        if depth == 1 and ch not in "{}": buf += ch
        i += 1
    keys = []
    for k in re.findall(r"(?:^|,)\s*([A-Za-z_][A-Za-z0-9_]*)", buf):
        if k not in keys and k not in ("true", "false", "null"): keys.append(k)
    return keys if len(keys) >= 2 else []

def return_keys(fn, proto=False):
    hk = header_keys(fn)
    if hk and not proto: return hk
    t = CODE.get(fn, ""); keys = []
    for m in re.finditer(r"\breturn\s*\{", t):
        i = m.end(); depth = 1; buf = ""
        while i < len(t) and depth:
            ch = t[i]
            if ch in "{[(": depth += 1
            elif ch in "}])": depth -= 1
            if depth == 1: buf += ch
            elif depth == 2 and ch in "{[(": buf += " "
            i += 1
        ks = re.findall(r"(?:^|,|\{)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:", "," + buf)
        if proto and "op" not in ks: continue      # jen literaly odpovedi operace (ne vnitrni pomocne objekty)
        for k in ks:
            if k not in keys: keys.append(k)
    for m in re.finditer(r"\b(?:res|resp|result)\.([A-Za-z_][A-Za-z0-9_]*)\s*=[^=]", t):
        if m.group(1) not in keys: keys.append(m.group(1))
    return keys

def req_res(opname):
    o = [x for x in S.OPS if x[0] == opname][0]
    fn = o[3]; proto = protocol_name(o)
    c = [x for x in I.COMPONENTS if x["key"] == o[1]][0]
    cop = [x for x in c["ops"] if x[0] == opname][0]
    req = []
    if proto:
        req.append({"name": "Op", "type": "string", "notes": "jméno operace protokolu: %s" % proto})
        if proto in SPEC:
            top, items = SPEC[proto]; src = "FB_FieldCheck SPEC"
            fields = top
        else:
            fields = op_fields_from_code(fn); items = []; src = "kód (op.<pole>)"
        for f in fields:
            n = field_note(fn, f) or ("pole %s (%s)" % (f, src))
            if items and f in ARR: n += " | položka: " + ", ".join(items)
            req.append({"name": pascal(f), "type": ftype(f), "notes": n})
    else:
        for p in cop[1]: req.append({"name": pascal(p["name"]), "type": p["type"], "notes": p["notes"] or ("parametr %s operace katalogu" % p["name"])})
    keys = return_keys(fn, bool(proto))
    res = []
    if keys and (proto or cop[2] not in ("string", "boolean", "void", "array")):
        for k in keys:
            ty = "array" if re.search(r"\b%s\[\]" % re.escape(k), " ".join(header(fn))) else ftype(k)
            res.append({"name": pascal(k), "type": ty, "notes": field_note(fn, k, bool(proto)) or ("pole odpovědi %s (tvar odpovědi v kódu)" % k)})
    else:
        res.append({"name": "Result", "type": cop[2], "notes": "návratová hodnota (%s): %s" % (cop[2], cop[3][:200])})
    return req, res, ("SPEC" if proto in SPEC else ("code" if proto else "params"))

# --- self-check ---------------------------------------------------------------------------------
def selfcheck(prescan_rows):
    """Lifeliny 4 hotovych SR v modelu (res-re17-2-00-prescan ops[6]) vs. extraktor."""
    comp_by_id = {}
    d = json.load(io.open(os.path.join(HERE, "..", "..", "responses", "res-re-10-katalog-kostra.json"), encoding="utf-8-sig"))
    for i, it in enumerate(d["results"][5]["items"]): comp_by_id[int(it["id"])] = I.COMPONENTS[i]["key"]
    ents = {11977 + k: e[0] for k, e in enumerate(I.ENTITIES)}
    model = {}
    for r in prescan_rows:
        if r["Object_Type"] not in ("Object", "Component"): continue
        cid = int(r["Classifier"]); sr = int(r["ParentID"])
        model.setdefault(sr, []).append(comp_by_id.get(cid) or ("E:" + ents.get(cid, str(cid))))
    out = []
    for name, sr in S.EXISTING_SR.items():
        x = ir(name)
        m = set(model.get(sr, [])); e = set(x["lifelines"])
        out.append({"sr": name, "model": sorted(m), "extraktor": sorted(e), "jen_model": sorted(m - e), "jen_extraktor": sorted(e - m),
                    "refs": x["refs"], "dynamic": x["dynamic"]})
    return out

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--map" in sys.argv:
        for f in sorted(F2C): print("%-34s %-6s %s" % (f, F2C[f], F2C_WHY[f]))
        print("nezarazene:", UNASSIGNED); sys.exit()
    if "--selfcheck" in sys.argv:
        d = json.load(io.open(os.path.join(HERE, "..", "..", "responses", "res-re17-2-00-prescan.json"), encoding="utf-8-sig"))
        for r in selfcheck(d["results"][6]["rows"]): print(json.dumps(r, ensure_ascii=False))
        sys.exit()
    ops = args or [o[0] for o in S.TODO]
    allir = {}
    for n in ops:
        x = ir(n); rq, rs, src = req_res(n); x["req"] = rq; x["res"] = rs; x["fieldsFrom"] = src; allir[n] = x
        print("%-28s %-5s life=%d msgs=%d refs=%d cand=%s dyn=%d | %s" % (n, x["comp"], len(x["lifelines"]), len(x["msgs"]), len(x["refs"]), x["candidates"], x["dynamic"], " ".join(x["lifelines"])))
    if "--json" in sys.argv:
        io.open(os.path.join(HERE, "ir_sr_calls.json"), "w", encoding="utf-8").write(json.dumps(allir, ensure_ascii=False, indent=1))
