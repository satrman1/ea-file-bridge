# -*- coding: utf-8 -*-
import json, io, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ir_addin as I
ROOT = "{DDA8A0F3-5920-4046-8F97-764CF89B9D8F}"   # /AI Test/Reverse Addinu (EAExample)
def tv(code):
    t = [{"name":"code-repo","value":I.REPO},{"name":"code-ref","value":I.REF},
         {"name":"code-verified","value":I.VERIFIED},{"name":"re-origin","value":"code"}]
    if code: t.insert(1, {"name":"code-path","value":code[:250]})
    return t
def batch(id_, ops):
    return {"protocol":"eafb/0.2","id":id_,"repo":"EAEXAMPLE","ops":ops}
def write(b, ready=True):
    s = json.dumps(b, ensure_ascii=False, indent=1)
    io.open("ready/req-%s.json" % b["id"], "w", encoding="utf-8").write(s)
    return s
os.makedirs("ready", exist_ok=True)

def r1():
    ops = [
     {"op":"create_or_update_package","parent":ROOT,"name":"Catalogues","notes":"Zrcadlo větve Catalogues EMR - reverse add-inu EA File Bridge (RE-FULL, 2026-10-14)."},
     {"op":"create_or_update_package","parent":"$0","name":"Solution Artefacts"},
     {"op":"create_or_update_package","parent":"$1","name":"EA File Bridge","notes":"Platforma EA File Bridge - katalog komponent odvozený z kódu (src @ %s)." % I.REF},
     {"op":"create_or_update_package","parent":ROOT,"name":"Logical Design","notes":"Zrcadlo větve Logical Design EMR - reverse add-inu EA File Bridge."},
     {"op":"create_or_update_package","parent":"$3","name":"EA File Bridge"},
    ]
    comps = [{"package":"$2","type":c["type"],"name":c["name"],"notes":c["notes"],"taggedValues":tv(c["code"])} for c in I.COMPONENTS]
    ops.append({"op":"create_or_update_elements","elements":comps})
    withif = [i for i,c in enumerate(I.COMPONENTS) if c["ops"]]
    ifs = [{"package":"$2","type":"Interface","name":I.COMPONENTS[i]["name"]+" Interface",
            "notes":"Rozhraní komponenty %s (reverse z kódu)." % I.COMPONENTS[i]["name"],
            "taggedValues":[{"name":"re-origin","value":"code"}]} for i in withif]
    ops.append({"op":"create_or_update_elements","elements":ifs})
    ops.append({"op":"create_or_update_connectors","connectors":[
        {"source":"$5[%d]"%ci,"target":"$6[%d]"%k,"type":"Realisation"} for k,ci in enumerate(withif)]})
    return batch("re-10-katalog-kostra", ops)

def load_ids():
    d = json.load(io.open("../../responses/res-re-10-katalog-kostra.json", encoding="utf-8-sig"))
    R = d["results"]
    comp = {I.COMPONENTS[i]["key"]: it for i, it in enumerate(R[5]["items"])}
    withif = [c["key"] for c in I.COMPONENTS if c["ops"]]
    iface = {k: R[6]["items"][j] for j, k in enumerate(withif)}
    pk = {"cat": R[2]["items"][0], "ld": R[4]["items"][0]}
    return comp, iface, pk

def r2():
    comp, iface, pk = load_ids()
    ops = []
    for c in I.COMPONENTS:
        if not c["ops"]: continue
        ol = []
        for (n, params, ret, notes, cp) in c["ops"]:
            ol.append({"name": n, "returnType": ret, "notes": notes,
                       "parameters": [{"name": p["name"], "type": p["type"], "notes": p["notes"]} for p in params],
                       "taggedValues": tv(cp)})
        ops.append({"op": "create_or_update_operations", "element": iface[c["key"]]["guid"], "operations": ol})
    n_ops = len(ops)
    ops.append({"op": "create_or_update_connectors", "connectors": [
        {"source": comp[s]["guid"], "target": comp[t]["guid"], "type": "Usage",
         "notes": note, "direction": "FromSourceToTarget"} for s, t, note in I.USAGES]})
    ops.append({"op": "create_or_update_diagram", "diagrams": [
        {"package": pk["cat"]["guid"], "type": "Component", "name": "EA File Bridge - Component Overview",
         "notes": "Přehled komponent add-inu EA File Bridge dle IDesign (reverse z kódu src @ %s). Vazby Usage = skutečná volání v kódu; poznámka as-implemented označuje odchylky od směru volání IDesign." % I.REF}]})
    rows = {"IDS-IDesign::IDS-Client": 40, "IDS-IDesign::IDS-Manager": 190, "IDS-IDesign::IDS-Engine": 340,
            "IDS-IDesign::IDS-Resource Access": 520, "IDS-IDesign::IDS-DB Resource": 700, "IDS-IDesign::IDS-File Resource": 700}
    cnt = {}
    pl = []
    W, H, GAP = 170, 80, 25
    for c in I.COMPONENTS:
        if c["type"] == "IDS-IDesign::IDS-Utility":
            pl.append({"element": comp[c["key"]]["guid"], "x": 1250, "y": 40, "width": W, "height": H}); continue
        y = rows[c["type"]]; key = y
        k = cnt.get(key, 0); cnt[key] = k + 1
        n = sum(1 for z in I.COMPONENTS if rows.get(z["type"]) == y)
        x0 = 40 + (6 - n) * (W + GAP) // 2
        if c["key"] == "xf": x0 = 40 + (6 - 2) * (W + GAP) // 2
        pl.append({"element": comp[c["key"]]["guid"], "x": x0 + k * (W + GAP), "y": y, "width": W, "height": H})
    ops.append({"op": "place_elements_on_diagram", "diagram": "$%d[0]" % (n_ops + 1), "elementPlacements": pl})
    return batch("re-11-katalog-operace", ops)


def load_r2():
    d = json.load(io.open("../../responses/res-re-11-katalog-operace.json", encoding="utf-8-sig"))
    opid = {}
    j = 0
    for c in I.COMPONENTS:
        if not c["ops"]: continue
        for k, o in enumerate(c["ops"]):
            opid[(c["key"], o[0])] = d["results"][j]["items"][k]["id"]
        j += 1
    return opid

def r3():
    comp, iface, pk = load_ids(); opid = load_r2()
    ops = []
    def pkg(parent, name, notes=""):
        ops.append({"op":"create_or_update_package","parent":parent,"name":name,"notes":notes}); return "$%d" % (len(ops)-1)
    ld = pk["ld"]["guid"]
    cpk = {"rm": pkg(ld, "EAFB Request Manager"), "mea": pkg(ld, "EAFB Model Element Access")}
    spk = {}
    for s in I.SERVICES:
        spk[s["name"]] = pkg(cpk[s["comp"]], s["name"], "Service package služby %s (reverse z kódu)." % s["name"])
    ldmp = pkg(pkg(ld, "EA Repository"), "LDM of EA Repository", "Logický datový model repozitáře EA tak, jak ho bridge používá (reverse z SQL a Automation volání v src).")
    # SR + DTO + Req/Res per sluzba
    svc_idx = {}
    for s in I.SERVICES:
        c = [x for x in I.COMPONENTS if x["key"] == s["comp"]][0]
        cp = [o[4] for o in c["ops"] if o[0] == s["op"]][0]
        els = [
         {"package": spk[s["name"]], "type":"CSOB-ITAN::Service Realization", "name":"SR "+s["name"],
          "notes":"Servisní realizace operace %s.%s - průběh odvozený z kódu (as-implemented)." % (c["name"]+" Interface", s["op"]),
          "taggedValues":[{"name":"505-1 Operation Link","ids":[{"type":"Operation","id":opid[(s["comp"], s["op"])]}]}] + tv(cp)},
         {"package": spk[s["name"]], "type":"CSOB-ITAN::Data Transfer Object", "name":"DTO "+s["name"],
          "notes":"DTO služby %s. Kontrakt žije v kódu (contractAuthority physical): %s; DTO je logický komentář, ne kopie." % (s["name"], cp),
          "taggedValues": tv(cp)},
         {"package": spk[s["name"]], "type":"Class", "name":s["name"]+" Request", "notes":"Request služby %s." % s["name"]},
         {"package": spk[s["name"]], "type":"Class", "name":s["name"]+" Response", "notes":"Response služby %s." % s["name"]},
        ]
        ops.append({"op":"create_or_update_elements","elements":els}); svc_idx[s["name"]] = len(ops)-1
    for s in I.SERVICES:
        i = svc_idx[s["name"]]
        ops.append({"op":"create_or_update_attributes","element":"$%d[2]"%i,"attributes":s["req"]})
        ops.append({"op":"create_or_update_attributes","element":"$%d[3]"%i,"attributes":s["res"]})
    conns = []
    for s in I.SERVICES:
        i = svc_idx[s["name"]]
        for k in (2,3):
            conns.append({"source":"$%d[1]"%i,"target":"$%d[%d]"%(i,k),"type":"Aggregation","sourceEnd":{"aggregation":2},"targetEnd":{"multiplicity":"1"}})
    ops.append({"op":"create_or_update_connectors","connectors":conns})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"package":spk[s["name"]],"type":"CSOB-ITAN::Version Root Diagram","name":"version_"+s["name"]} for s in I.SERVICES]})
    # LDM
    ents = [{"package":ldmp,"type":"Class","stereotypes":"entity","name":n,"alias":t,"notes":nt+" Fyzická tabulka: %s." % t,
             "taggedValues":[{"name":"re-origin","value":"code"}]} for n,t,nt in I.ENTITIES]
    ops.append({"op":"create_or_update_elements","elements":ents}); ei = len(ops)-1
    names = [e[0] for e in I.ENTITIES]
    for k in range(len(names)):
        ops.append({"op":"create_or_update_operations","element":"$%d[%d]"%(ei,k),
                    "operations":[{"name":x,"returnType":"void"} for x in ("C","R","U","D")]})
    ops.append({"op":"create_or_update_connectors","connectors":[
        {"source":"$%d[%d]"%(ei,names.index(a)),"target":"$%d[%d]"%(ei,names.index(b)),"type":"Association","name":nm,
         "sourceEnd":{"multiplicity":ma},"targetEnd":{"multiplicity":mb}} for a,b,ma,mb,nm in I.ASSOCS]})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"package":ldmp,"type":"CSOB-ITAN::LD-Structural","name":"LDM of EA Repository"}]})
    pos = {"Package":(300,40),"Baseline":(40,40),"Diagram":(560,40),"Element":(300,260),"TaggedValue":(40,460),"Attribute":(230,460),"Operation":(420,460),"Connector":(610,300)}
    ops.append({"op":"place_elements_on_diagram","diagram":"$%d[0]"%(len(ops)-1),"elementPlacements":[
        {"element":"$%d[%d]"%(ei,k),"x":pos[n][0],"y":pos[n][1],"width":160,"height":110} for k,n in enumerate(names)]})
    return batch("re-12-logical-design", ops)


def load_r3():
    d = json.load(io.open("../../responses/res-re-12-logical-design.json", encoding="utf-8-sig"))
    R = d["results"]
    svc = {s["name"]: R[8+i]["items"] for i, s in enumerate(I.SERVICES)}   # SR, DTO, Req, Res
    spk = {s["name"]: R[2+i]["items"][0] for i, s in enumerate(I.SERVICES)}
    ent = {I.ENTITIES[k][0]: it for k, it in enumerate(R[22]["items"])}
    crud = {}
    for k, e in enumerate(I.ENTITIES):
        for it in R[23+k]["items"]: crud[(e[0], it["name"])] = it["id"]
    return svc, spk, ent, crud

SRDG = {"ProcessRequest":1196,"Ping":1198,"CreateOrUpdateElements":1200,"DeleteFromModel":1202}
DTODG = {"ProcessRequest":1197,"Ping":1199,"CreateOrUpdateElements":1201,"DeleteFromModel":1203}
SCD = dict(zip(["pump","ui","rm","val","scope","risk","bpol","qc","itan","mea","dga","bla","aud","code","xfa"], range(1178,1193)))
SCD["util"] = 1194
STEREO = {"IDS-IDesign::IDS-Manager":"IDS-Manager","IDS-IDesign::IDS-Engine":"IDS-Engine","IDS-IDesign::IDS-Resource Access":"IDS-Resource Access"}

def r4():
    comp, iface, pk = load_ids(); opid = load_r2(); svc, spk, ent, crud = load_r3()
    ops = []
    # DTO diagramy
    for s in I.SERVICES:
        it = svc[s["name"]]
        ops.append({"op":"place_elements_on_diagram","diagram":DTODG[s["name"]],"elementPlacements":[
            {"elementID":it[1]["id"],"x":260,"y":30,"width":200,"height":70},
            {"elementID":it[2]["id"],"x":40,"y":180,"width":260,"height":40+22*len(s["req"])},
            {"elementID":it[3]["id"],"x":380,"y":180,"width":300,"height":40+22*len(s["res"])}]})
    # Service Contract Detail: komponenta + rozhrani
    for c in I.COMPONENTS:
        if c["key"] not in SCD: continue
        pl = [{"elementID":comp[c["key"]]["id"],"x":60,"y":60,"width":200,"height":90}]
        if c["key"] in iface: pl.append({"elementID":iface[c["key"]]["id"],"x":360,"y":40,"width":360,"height":40+16*len(c["ops"])})
        ops.append({"op":"place_elements_on_diagram","diagram":SCD[c["key"]],"elementPlacements":pl})
    # SR sekvence
    ctype = {c["key"]: c["type"] for c in I.COMPONENTS}
    for s in I.SERVICES:
        q = I.SEQ[s["name"]]; pkgg = spk[s["name"]]["guid"]
        els = [{"package":pkgg,"type":"DiagramGate","name":""}]
        for l in q["lifelines"]:
            if l.startswith("E:"):
                els.append({"package":pkgg,"type":"Object","name":"","classifierID":ent[l[2:]]["id"],"stereotypes":"entity"})
            else:
                els.append({"package":pkgg,"type":"Object","name":"","classifierID":comp[l]["id"],"stereotypes":STEREO[ctype[l]]})
        for r in q["refs"]:
            els.append({"package":pkgg,"type":"InteractionOccurrence","name":"","classifierID":svc[r][0]["id"]})
        ops.append({"op":"create_or_update_elements","elements":els}); ei = len(ops)-1
        pl = [{"element":"$%d[0]"%ei,"x":0,"y":110,"width":10,"height":10}]
        for k, l in enumerate(q["lifelines"]):
            pl.append({"element":"$%d[%d]"%(ei,k+1),"x":90+k*170,"y":40,"width":130,"height":60})
        n = len(q["lifelines"])
        for k, r in enumerate(q["refs"]):
            pl.append({"element":"$%d[%d]"%(ei,n+1+k),"x":90+170*(q["lifelines"].index("mea"))-40,"y":540+k*70,"width":260,"height":50})
        ops.append({"op":"place_elements_on_diagram","diagram":SRDG[s["name"]],"elementPlacements":pl})
        idx = {"G":0}; idx.update({l:k+1 for k,l in enumerate(q["lifelines"])})
        msgs = []
        for seq, (a, b, o, nm, args) in enumerate(q["msgs"], 1):
            m = {"source":"$%d[%d]"%(ei,idx[a]),"target":"$%d[%d]"%(ei,idx[b]),"seqNo":seq}
            if o == "RETURN": m.update({"isReturn":True,"name":nm})
            elif o is None: m.update({"name":nm,"arguments":args})
            elif o[0] == "E": m.update({"operation":crud[(o[1],o[2])],"notes":args})
            else:
                m.update({"operation":opid[o]})
                if args: m["arguments"] = args
            msgs.append(m)
        ops.append({"op":"create_or_update_messages","diagram":SRDG[s["name"]],"messages":msgs})
        ops.append({"op":"apply_classifier_stereotypes","diagram":SRDG[s["name"]]})
    # poznamky na SR prvky (vetve a nalezy)
    ops.append({"op":"create_or_update_elements","elements":[
        {"elementID":svc[s["name"]][0]["id"],"notes":"Servisní realizace operace %s - průběh odvozený z kódu (as-implemented, src @ %s).\n%s" % (s["op"], I.REF, I.SEQ[s["name"]]["note"])} for s in I.SERVICES]})
    return batch("re-14-realizace", ops)


def r4b():
    """Bez Diagram Gate (bridge je neumi - zaprah). Vstup = self-message na prvni lifeline s operaci, bez return."""
    comp, iface, pk = load_ids(); opid = load_r2(); svc, spk, ent, crud = load_r3()
    ops = []
    ctype = {c["key"]: c["type"] for c in I.COMPONENTS}
    for s in I.SERVICES:
        q = I.SEQ[s["name"]]; pkgg = spk[s["name"]]["guid"]
        els = []
        for l in q["lifelines"]:
            if l.startswith("E:"):
                els.append({"package":pkgg,"type":"Object","name":"","classifierID":ent[l[2:]]["id"],"stereotypes":"entity"})
            else:
                els.append({"package":pkgg,"type":"Object","name":"","classifierID":comp[l]["id"],"stereotypes":STEREO[ctype[l]]})
        for r in q["refs"]:
            els.append({"package":pkgg,"type":"InteractionOccurrence","name":"","classifierID":svc[r][0]["id"]})
        ops.append({"op":"create_or_update_elements","elements":els}); ei = len(ops)-1
        pl = []
        for k, l in enumerate(q["lifelines"]):
            pl.append({"element":"$%d[%d]"%(ei,k),"x":40+k*170,"y":40,"width":130,"height":60})
        n = len(q["lifelines"])
        for k, r in enumerate(q["refs"]):
            pl.append({"element":"$%d[%d]"%(ei,n+k),"x":40+170*(q["lifelines"].index("mea"))-40,"y":540+k*70,"width":260,"height":50})
        ops.append({"op":"place_elements_on_diagram","diagram":SRDG[s["name"]],"elementPlacements":pl})
        idx = {l:k for k,l in enumerate(q["lifelines"])}
        msgs = []; seq = 0
        for (a, b, o, nm, args) in q["msgs"]:
            if o == "RETURN": continue
            if a == "G": a = b
            seq += 1
            m = {"source":"$%d[%d]"%(ei,idx[a]),"target":"$%d[%d]"%(ei,idx[b]),"seqNo":seq}
            if o is None: m.update({"name":nm,"arguments":args})
            elif o[0] == "E": m.update({"operation":crud[(o[1],o[2])],"notes":args})
            else:
                m.update({"operation":opid[o]})
                if args: m["arguments"] = args
            msgs.append(m)
        ops.append({"op":"create_or_update_messages","diagram":SRDG[s["name"]],"messages":msgs})
        ops.append({"op":"apply_classifier_stereotypes","diagram":SRDG[s["name"]]})
    ops.append({"op":"create_or_update_elements","elements":[
        {"elementID":svc[s["name"]][0]["id"],"notes":"Servisní realizace operace %s - průběh odvozený z kódu (as-implemented, src @ %s).\n%s\nBez Diagram Gate (vstup a výstup): bridge v0.21 gate neumí založit (E_EXCEPTION Invalid type) - oprava v zápřahu; vstupní volání je zatím zpráva lifeline sama na sebe, návratová zpráva chybí." % (s["op"], I.REF, I.SEQ[s["name"]]["note"])} for s in I.SERVICES]})
    return batch("re-14b-realizace-bez-gatu", ops)


import ir_fa as F
def r5():
    """FA kostra: balicky, akteri, prepouzitelna pravidla, UC, UCR, LS, verzni diagramy."""
    ops = []
    def pkg(parent, name, notes=""):
        ops.append({"op":"create_or_update_package","parent":parent,"name":name,"notes":notes}); return "$%d" % (len(ops)-1)
    ba_root = pkg(ROOT, "Business Applications", "Zrcadlo větve Business Applications EMR - funkční analýza add-inu EA File Bridge (reverse z kódu, as-implemented).")
    ba = pkg(ba_root, "EA File Bridge", "Business aplikace EA File Bridge = add-in EA + pumpa + schránkový kanál. FA odvozená z kódu src @ %s a pump.wsf v0.6 - popisuje, co nástroj dělá, ne co měl dělat. Logické obrazovky = menu, okna a Output tab add-inu." % I.REF)
    actors_p = pkg(ba, "ACTORS"); gv = pkg(ba, "GLOBAL VIEWS"); oth = pkg(ba, "OTHER ELEMENTS"); rules = pkg(ba, "RULES (REUSABLE)")
    ucp = {u["code"]: pkg(ba, u["code"]+" "+u["name"]) for u in F.UC}
    ops.append({"op":"create_or_update_elements","elements":[{"package":actors_p,"type":"Actor","name":n,"notes":d} for n,d in F.ACTORS]}); ai = len(ops)-1
    ops.append({"op":"create_or_update_elements","elements":[{"package":ucp[u["code"]],"type":"UseCase","name":u["code"]+" "+u["name"],"notes":u["notes"],"taggedValues":tv("")} for u in F.UC]}); ui_ = len(ops)-1
    ops.append({"op":"create_or_update_diagram","diagrams":[{"package":ucp[u["code"]],"type":"CSOB-ITAN::Version Root Diagram","name":"version_"+u["code"]+" "+u["name"]} for u in F.UC]})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"owningElement":"$%d[%d]"%(ui_,k),"type":"CSOB-ITAN::FA-Behavioral","name":u["code"]+" "+u["name"],"styleEx":"MDGDgm=CSOB-ITAN::FA-Behavioral;MDGView=CSOB-ITAN::Use Case Detail;"} for k,u in enumerate(F.UC)]}); di = len(ops)-1
    ops.append({"op":"create_or_update_elements","elements":[{"elementID":"$%d[%d]"%(ui_,k),"isComposite":True,"compositeDiagram":"$%d[%d]"%(di,k)} for k,u in enumerate(F.UC)]})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"package":gv,"type":"CSOB-ITAN::FA-Behavioral","name":"Use Case Survey of EA File Bridge","notes":"Přehled use casů add-inu EA File Bridge (bez pravidel a požadavků - ta patří jen na detail)."}]})
    # MDG typy na konci - kazdy vlastni op (pri padu zbytek skipped, predchozi zustava)
    ops.append({"op":"create_or_update_elements","elements":[{"package":rules,"type":"CSOB-ITAN::Behavioral Rule","name":c+" "+n,"notes":t,"taggedValues":tv(cp)} for c,n,cp,t in F.BRU]})
    ops.append({"op":"create_or_update_elements","elements":[{"package":ucp[u["code"]],"type":"CSOB-ITAN::Use Case Realization","name":"UCR-"+u["code"][3:]+" "+u["name"],"notes":"Realizace %s: aktér → %s → EAFB Request Manager%s (as-implemented z kódu)." % (u["code"], "EAFB Pump" if u["client"]=="pump" else "EAFB Add-in UI", (" + ref SR "+u["sr"]) if u["sr"] else "")} for u in F.UC]})
    ls_el = []
    for name, owner, notes, attrs, opsl in F.LS:
        ls_el.append({"package": oth if owner=="OTHER" else ucp[owner], "type":"CSOB-ITAN::Logical Screen","name":name,"notes":notes})
    ops.append({"op":"create_or_update_elements","elements":ls_el}); li = len(ops)-1
    for k,(name, owner, notes, attrs, opsl) in enumerate(F.LS):
        ops.append({"op":"create_or_update_attributes","element":"$%d[%d]"%(li,k),"attributes":[{"name":a,"type":t,"notes":d} for a,t,d in attrs]})
        if opsl: ops.append({"op":"create_or_update_operations","element":"$%d[%d]"%(li,k),"operations":[{"name":o,"returnType":"void","notes":d} for o,d in opsl]})
    return batch("re-30-fa-kostra", ops)


def load_r5():
    d = json.load(io.open("../../responses/res-re-30-fa-kostra.json", encoding="utf-8-sig"))
    R = d["results"]
    P = {"ba_root": R[0]["items"][0], "ba": R[1]["items"][0], "actors": R[2]["items"][0], "gv": R[3]["items"][0], "oth": R[4]["items"][0], "rules": R[5]["items"][0]}
    ucp = {u["code"]: R[6+k]["items"][0] for k, u in enumerate(F.UC)}
    actors = {n: it for (n, _), it in zip(F.ACTORS, R[15]["items"])}
    uc = {u["code"]: it for u, it in zip(F.UC, R[16]["items"])}
    ucd = {u["code"]: it for u, it in zip(F.UC, R[18]["items"])}   # UC detail diagramy
    survey = R[20]["items"][0]
    bru = {c: it for (c, n, cp, t), it in zip(F.BRU, R[21]["items"])}
    ucr = {u["code"]: it for u, it in zip(F.UC, R[22]["items"])}
    ls = {name: it for (name, o, n, a, op), it in zip(F.LS, R[23]["items"])}
    return P, ucp, actors, uc, ucd, survey, bru, ucr, ls

def r6():
    """Podminky, lokalni pravidla, scenare (rebuild operace = ELEVATED)."""
    P, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    ops = []
    for u in F.UC:
        g = uc[u["code"]]["guid"]
        ops.append({"op":"create_or_update_constraints","element":g,"constraints":[{"name":n,"type":t,"notes":x} for n,t,x in u["pre"]+u["pst"]]})
        ops.append({"op":"create_or_update_requirements","element":g,"requirements":[{"name":n,"notes":x,"type":"Functional","status":"Approved"} for n,x in u["req"]]})
        ops.append({"op":"create_or_update_scenarios","element":g,"scenarios":u["scen"]})
    return batch("re-31-fa-scenare", ops)


def r6a(): return _r6part("re-31a-fa-scenare", F.UC[:5])
def r6b(): return _r6part("re-31b-fa-scenare", F.UC[5:])
def _r6part(id_, ucs):
    P, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    ops = []
    for u in ucs:
        g = uc[u["code"]]["guid"]
        ops.append({"op":"create_or_update_constraints","element":g,"constraints":[{"name":n,"type":t,"notes":x} for n,t,x in u["pre"]+u["pst"]]})
        ops.append({"op":"create_or_update_requirements","element":g,"requirements":[{"name":n,"notes":x,"type":"Functional","status":"Approved"} for n,x in u["req"]]})
        ops.append({"op":"create_or_update_scenarios","element":g,"scenarios":u["scen"]})
    return batch(id_, ops)


UCRDG = {'UC-9510%d'%(k+1): 1228+k for k in range(9)}
LSDG = {}
def r7(sel=None, survey_only=False):
    P, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    UCS = [u for u in F.UC if (sel is None or u['code'] in sel)]
    comp, iface, pk = load_ids(); opid = load_r2(); svc, spk, ent, crud = load_r3()
    ops = []
    # --- vazby UC detailu ---
    conns = []
    for u in ([] if survey_only else UCS):
        ug = uc[u["code"]]["guid"]
        for a in u["actors"]:
            conns.append({"source":actors[a]["guid"],"target":ug,"type":"Association","direction":"FromSourceToTarget"})
        conns.append({"source":ucr[u["code"]]["guid"],"target":ug,"type":"Realisation","direction":"FromSourceToTarget"})
        for l in u["ls"]:
            conns.append({"source":ls[l]["guid"],"target":ug,"type":"Dependency","direction":"FromSourceToTarget"})
        for b in u["bru"]:
            conns.append({"source":ug,"target":bru[b]["guid"],"type":"Usage","direction":"FromSourceToTarget"})
    if conns: ops.append({"op":"create_or_update_connectors","connectors":conns})
    # --- hranice systemu per UC + UC detail diagramy ---
    bnd = [{"package":ucp[u["code"]]["guid"],"type":"Boundary","name":"EA File Bridge"} for u in ([] if survey_only else UCS)]
    if bnd: ops.append({"op":"create_or_update_elements","elements":bnd}); bi = len(ops)-1
    for k, u in enumerate([] if survey_only else UCS):
        nls = len(u["ls"]); bh = 330 + 80*nls
        pl = [{"element":"$%d[%d]"%(bi,k),"x":220,"y":20,"width":540,"height":bh},
              {"elementID":uc[u["code"]]["id"],"x":330,"y":60,"width":320,"height":100},
              {"elementID":ucr[u["code"]]["id"],"x":330,"y":200,"width":320,"height":70}]
        for j, l in enumerate(u["ls"]):
            pl.append({"elementID":ls[l]["id"],"x":330,"y":300+80*j,"width":320,"height":60})
        for j, a in enumerate(u["actors"]):
            pl.append({"elementID":actors[a]["id"],"x":40,"y":60+140*j,"width":90,"height":100})
        for j, b in enumerate(u["bru"]):
            pl.append({"elementID":bru[b]["id"],"x":820,"y":20+75*j,"width":300,"height":60})
        ops.append({"op":"place_elements_on_diagram","diagram":ucd[u["code"]]["id"],"elementPlacements":pl})
    # --- survey ---
    if survey_only:
      pl = [{"elementID":actors[n]["id"],"x":40,"y":60+200*j,"width":90,"height":100} for j,(n,_) in enumerate(F.ACTORS)]
      for k, u in enumerate(F.UC):
        pl.append({"elementID":uc[u["code"]]["id"],"x":300+(k%3)*340,"y":40+(k//3)*140,"width":300,"height":100})
      ops.append({"op":"place_elements_on_diagram","diagram":survey["id"],"elementPlacements":pl})
    # --- LS kompozitni diagramy: umistit LS element ---
    lsdg = dict(zip([n for n,_,_,_,_ in F.LS], range(1237,1242)))
    for name,_,_,attrs,opsl in (F.LS if survey_only else []):
        ops.append({"op":"place_elements_on_diagram","diagram":lsdg[name],"elementPlacements":[{"elementID":ls[name]["id"],"x":40,"y":40,"width":420,"height":80+20*(len(attrs)+len(opsl))}]})
    # --- UCR sekvence ---
    MGR = {"ProcessRequest":("rm","ProcessRequest"),"ConfirmPending":("rm","ConfirmPending"),"GetStatus":("rm","GetStatus")}
    ucr_seq = {
     "UC-95101": [("A","C","uloží req-<id>.json do requests\\"),("C","M",("rm","ProcessRequest")),("ref","ProcessRequest"),("C","A","res-<id>.json (done | error | confirm_required)")],
     "UC-95102": [("A","C","Ano / Ne / Storno v okně pumpy"),("C","M",("rm","ConfirmPending")),("ref","ProcessRequest"),("C","A","výsledek na konzoli a v Output tabu")],
     "UC-95103": [("A","C","menu AI Bridge → Zpracovat dávku ze schránky"),("C","M",("rm","ProcessRequest")),("ref","ProcessRequest"),("C","A","dialog + chat ACK ve schránce")],
     "UC-95104": [("A","C","menu AI Bridge → Zpracovat dávky ze složky"),("C","M",("rm","ProcessRequest")),("ref","ProcessRequest"),("C","A","souhrn počtů v dialogu")],
     "UC-95105": [("A","C","menu AI Bridge → Kontext výběru do schránky"),("C","X","mea",("mea","GetSelectedContext")),("C","A","věta + JSON eafb-context ve schránce")],
     "UC-95106": [("A","C","menu AI Bridge → Stav bridge"),("C","M",("rm","GetStatus")),("C","A","dialog Stav bridge")],
     "UC-95107": [("A","C","dvojklik na řádek Output tabu AI Bridge"),("C","C","vybere prvek podle markeru (el:|pkg:|dgm:ID) v Project browseru")],
     "UC-95108": [("A","C","dávka deploy_src do requests\\ (nebo bootstrap skript v EA)"),("C","M",("rm","ProcessRequest")),("C","X","code",("code","DeploySrc")),("C","A","res + reloadCode → pumpa přenačte kód")],
     "UC-95109": [("A","C","menu AI Bridge → Úklid automatických baselines"),("C","X","bpol",("bpol","CleanupBaselines")),("C","A","výčet smazaných záloh v Output tabu")],
    }
    STEREO2 = dict(STEREO); STEREO2["IDS-IDesign::IDS-Client"] = "IDS-Client"
    ctype = {c["key"]: c["type"] for c in I.COMPONENTS}
    for u in ([] if survey_only else UCS):
        q = ucr_seq[u["code"]]; pkgg = ucp[u["code"]]["guid"]; dg = None
        clientk = u["client"]
        lifel = [("A", actors[u["primary"]]["id"], None), ("C", comp[clientk]["id"], STEREO2[ctype[clientk]])]
        if any(m[1]=="M" for m in q): lifel.append(("M", comp["rm"]["id"], "IDS-Manager"))
        for m in q:
            if m[1]=="X": lifel.append(("X", comp[m[2]]["id"], STEREO2[ctype[m[2]]]))
        els = []
        for key, cid, st in lifel:
            e = {"package":pkgg,"type":"Object","name":"","classifierID":cid}
            if st: e["stereotypes"] = st
            els.append(e)
        refs = [m[1] for m in q if m[0]=="ref"]
        for r in refs: els.append({"package":pkgg,"type":"InteractionOccurrence","name":"ref SR "+r,"classifierID":svc[r][0]["id"]})
        ops.append({"op":"create_or_update_elements","elements":els}); ei = len(ops)-1
        idx = {key:k for k,(key,_,_) in enumerate(lifel)}
        ops.append({"op":"create_or_update_elements","elements":[{"elementID":"$%d[%d]"%(ei,k),"name":""} for k in range(len(lifel))]})
        pl = [{"element":"$%d[%d]"%(ei,k),"x":40+k*230,"y":40,"width":150,"height":60} for k in range(len(lifel))]
        for j, r in enumerate(refs): pl.append({"element":"$%d[%d]"%(ei,len(lifel)+j),"x":40+230*idx.get("M",1)-20,"y":330+70*j,"width":260,"height":50})
        # kompozitni diagram UCR (auto-kompozit MDG) - dohledat
        dgid = UCRDG[u["code"]]
        ops.append({"op":"place_elements_on_diagram","diagram":dgid,"elementPlacements":pl})
        msgs = []; seq = 0
        for m in q:
            if m[0]=="ref": continue
            seq += 1
            mm = {"source":"$%d[%d]"%(ei,idx[m[0]]),"target":"$%d[%d]"%(ei,idx[m[1]]),"seqNo":seq}
            if isinstance(m[2], tuple): mm["operation"] = opid[m[2]]
            elif m[1]=="X": mm["operation"] = opid[m[3]]
            else: mm["name"] = m[2]
            msgs.append(mm)
        ops.append({"op":"create_or_update_messages","diagram":dgid,"messages":msgs})
        ops.append({"op":"apply_classifier_stereotypes","diagram":dgid})
    return batch("re-32s-fa-survey" if survey_only else "re-32-%s" % "-".join(x[3:] for x in sel), ops)


def r7s(): return r7(survey_only=True)
def r7_1(): return r7(sel=['UC-95101'])
def r7_2(): return r7(sel=['UC-95102'])
def r7_3(): return r7(sel=['UC-95103'])
def r7_4(): return r7(sel=['UC-95104'])
def r7_5(): return r7(sel=['UC-95105'])
def r7_6(): return r7(sel=['UC-95106'])
def r7_7(): return r7(sel=['UC-95107'])
def r7_8(): return r7(sel=['UC-95108'])
def r7_9(): return r7(sel=['UC-95109'])


def _r8(id_, ucs):
    P, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    ops = []
    for u in ucs:
        nls = len(u["ls"]); bh = 330 + 230*nls
        pl = [{"elementID":uc[u["code"]]["id"],"x":330,"y":60,"width":320,"height":100},
              {"elementID":ucr[u["code"]]["id"],"x":330,"y":200,"width":320,"height":70}]
        for j, l in enumerate(u["ls"]):
            pl.append({"elementID":ls[l]["id"],"x":300,"y":310+230*j,"width":400,"height":200})
        ops.append({"op":"place_elements_on_diagram","diagram":ucd[u["code"]]["id"],"elementPlacements":pl})
    # hranice: dohledat podle jmena v balicku - zapise se zvlast (ids z res re-32-*)
    for u in ucs:
        d = json.load(io.open("../../responses/res-re-32-%s.json" % u["code"][3:], encoding="utf-8-sig"))
        bid = d["results"][1]["items"][0]["id"]
        nls = len(u["ls"])
        if nls: ops.append({"op":"place_elements_on_diagram","diagram":ucd[u["code"]]["id"],"elementPlacements":[{"elementID":bid,"x":220,"y":20,"width":540,"height":330+230*nls}]})
    return batch(id_, ops)
def r8a(): return _r8("re-34a-ls-rozestupy", [u for u in F.UC if u["ls"]][:3])
def r8b(): return _r8("re-34b-ls-rozestupy", [u for u in F.UC if u["ls"]][3:])


# =====================================================================
# Z261017-1 reverse dorovnani modelu (2026-10-17) - davky do ready-17/
# =====================================================================
def write17(b):
    s = json.dumps(b, ensure_ascii=False, indent=1)
    io.open("ready-17/req-%s.json" % b["id"], "w", encoding="utf-8").write(s)
    return s

def svc_ops(s, pkg_ref, op_id, codepath, first_index):
    """Pravidlo metodiky (EA-Repozitar-Kontext §6, vzor DoBind; Milos 17. 10. 2026):
    <Sluzba> Request / Response jsou CASTI DTO -> ve stromu lezi POD DTO (owningElement = DTO),
    ne vedle nej v service package. Kompozice DTO -> Req/Res zustava.
    Vraci 3 operace: [SR + DTO] (package), [Request + Response] (owningElement = DTO z predchozi op),
    [kompozice]. first_index = index prvni z nich v ops[] davky (pro $N). Pouziva Z261017-2 pro dalsi sluzby;
    r3() vyse je historicka davka re-12 (14. 10.) a zustava, jak byla provedena."""
    i0 = first_index
    els = [
     {"package": pkg_ref, "type":"CSOB-ITAN::Service Realization", "name":"SR "+s["name"],
      "taggedValues":[{"name":"505-1 Operation Link","ids":[{"type":"Operation","id":op_id}]}] + tv(codepath)},
     {"package": pkg_ref, "type":"CSOB-ITAN::Data Transfer Object", "name":"DTO "+s["name"],
      "notes":"DTO služby %s. Kontrakt žije v kódu (contractAuthority physical): %s; DTO je logický komentář, ne kopie." % (s["name"], codepath),
      "taggedValues": tv(codepath)}]
    # kanon emr-zapis-pravidla par. 7e + EA-Repozitar-Kontext par. 13: jmena <Sluzba>Req / <Sluzba>Res; DTO -<<refine>>-> SR
    parts = [{"owningElement":"$%d[1]" % i0, "type":"Class", "name":s["name"]+"Req", "notes":"Request služby %s." % s["name"]},
             {"owningElement":"$%d[1]" % i0, "type":"Class", "name":s["name"]+"Res", "notes":"Response služby %s." % s["name"]}]
    comp = [{"source":"$%d[1]" % i0, "target":"$%d[%d]" % (i0+1, k), "type":"Aggregation",
             "sourceEnd":{"aggregation":2}, "targetEnd":{"multiplicity":"1"}} for k in (0, 1)]
    comp.append({"source":"$%d[1]" % i0, "target":"$%d[0]" % i0, "type":"Dependency", "stereotypes":"refine", "direction":"FromSourceToTarget"})
    return [{"op":"create_or_update_elements","elements":els},
            {"op":"create_or_update_elements","elements":parts},
            {"op":"create_or_update_connectors","connectors":comp}]

DTO_PARTS = {11962:(11963,11964), 11966:(11967,11968), 11970:(11971,11972), 11974:(11975,11976)}
def r17_1():
    """Krok 1: Request/Response pod DTO (move_elements, cil owningElement)."""
    mv = [{"element": p, "owningElement": str(dto)} for dto, ps in DTO_PARTS.items() for p in ps]
    ids = ",".join(str(p) for ps in DTO_PARTS.values() for p in ps)
    return batch("re17-1-01-reqres-pod-dto", [
        {"op":"move_elements","elements":mv},
        {"op":"query","sql":"SELECT Object_ID, Name, ParentID, Package_ID FROM t_object WHERE Object_ID IN (%s)" % ids},
        {"op":"query","sql":"SELECT c.Connector_ID, c.Connector_Type, c.Start_Object_ID, c.End_Object_ID, c.SourceIsAggregate, c.DestIsAggregate FROM t_connector c WHERE c.End_Object_ID IN (%s) AND c.Connector_Type = 'Aggregation'" % ids},
        {"op":"query","sql":"SELECT Diagram_ID, Object_ID FROM t_diagramobjects WHERE Diagram_ID IN (1197,1199,1201,1203)"}])

def tvp():
    return [{"name":"code-ref","value":I.REF},{"name":"code-verified","value":I.VERIFIED}]

def _r17_2_data():
    st = json.load(io.open("stav-2026-10-17.json", encoding="utf-8"))
    d = json.load(io.open("../../responses/res-re17-1-02-notes-operaci.json", encoding="utf-8-sig"))
    notes = {r["Name"]: (r["OperationID"], r.get("Notes", "")) for r in d["results"][0]["rows"]}
    ops_by_if = {}
    for r in d["results"][1]["rows"]:
        ops_by_if.setdefault(int(r["Object_ID"]), []).append((int(r["OperationID"]), r["Name"]))
    elref = sorted({int(r["Object_ID"]) for r in st["tvElements"] if r["Property"] == "code-ref"})
    pkg = {int(r["Object_ID"]): int(r["Package_ID"]) for r in st["elements"]}
    return notes, ops_by_if, elref, pkg

def _ops_upd(iface_ids, ops_by_if, notes):
    out = []
    for ifc in iface_ids:
        lst = []
        for oid, nm in ops_by_if.get(ifc, []):
            o = {"operationID": oid, "name": nm, "taggedValues": tvp()}   # name povinne v P2 (E_ARGS bez nej, re17-1-03)
            if nm in I.V022_NOTES:
                old = notes[nm][1]
                o["notes"] = (old + "\n" if old else "") + I.V022_NOTES[nm]
            lst.append(o)
        if lst: out.append({"op":"create_or_update_operations","element":ifc,"operations":lst})
    return out

def r17_2a():
    """Krok 2a: provenance v0.22 - 18 komponent + operace rozhrani 11937-11943 (balicek katalogu 1127)."""
    notes, obi, elref, pkg = _r17_2_data()
    comps = [e for e in elref if pkg[e] == 1127]
    ops = [{"op":"create_or_update_elements","elements":[{"elementID":e,"taggedValues":tvp()} for e in comps]}]
    ops += _ops_upd(range(11937, 11944), obi, notes)
    return batch("re17-1-03b-provenance-katalog-a", ops)

def r17_2b():
    notes, obi, elref, pkg = _r17_2_data()
    return batch("re17-1-04-provenance-katalog-b", _ops_upd(range(11944, 11951), obi, notes))

def r17_2c():
    """SR + DTO ve 4 service packages."""
    notes, obi, elref, pkg = _r17_2_data()
    els = [e for e in elref if pkg[e] in (1132, 1133, 1134, 1135)]
    return batch("re17-1-05-provenance-sr-dto", [{"op":"create_or_update_elements","elements":[{"elementID":e,"taggedValues":tvp()} for e in els]}])

def r17_3():
    """Krok 3: BRU-9501 -> 9501 Tridy operaci (prejmenovani 12051) + 9510 Prahy metrik + 9511 Eskalace podle obsahu;
    Usage UC -> 9510/9511 u kazdeho UC s Usage na 9501; umisteni na UC detail (vpravo, 75 px); rebuild scenaru UC s uses 9501;
    provenance v0.22 vsech BRU a dotcenych UC. Balicky: RULES + 4 UC = 5 (BLOCKED az > 5)."""
    P_, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    pos = json.load(io.open("../../responses/res-re17-1-06-bru-pozice.json", encoding="utf-8-sig"))["results"][0]["rows"]
    rules = P_["rules"]["guid"]
    B = {b[0]: b for b in F.BRU}
    def bru_el(code, **kw):
        c, n, cp, t = B[code]
        e = {"name": c+" "+n, "notes": t, "taggedValues": tv(cp)}; e.update(kw); return e
    ops = [{"op":"create_or_update_elements","elements":[bru_el("BRU-9501", elementID=bru["BRU-9501"]["id"])]},
           {"op":"create_or_update_elements","elements":[bru_el(c, package=rules, type="CSOB-ITAN::Behavioral Rule") for c in ("BRU-9510","BRU-9511")]}]
    newi = 1
    touched = [u for u in F.UC if "BRU-9510" in u["bru"]]
    ops.append({"op":"create_or_update_connectors","connectors":[
        {"source":uc[u["code"]]["guid"],"target":"$%d[%d]" % (newi, k),"type":"Usage","direction":"FromSourceToTarget"}
        for u in touched for k in (0, 1)]})
    for u in touched:
        dg = ucd[u["code"]]["id"]
        y0 = max(-int(r["RectBottom"]) for r in pos if int(r["Diagram_ID"]) == dg) + 15
        ops.append({"op":"place_elements_on_diagram","diagram":dg,"elementPlacements":[
            {"element":"$%d[%d]" % (newi, k),"x":820,"y":y0 + 75*k,"width":300,"height":60} for k in (0, 1)]})
    for u in touched:
        if any("BRU-9501" in st.get("uses","") for sc in u["scen"] for st in sc["steps"]):
            ops.append({"op":"create_or_update_scenarios","element":uc[u["code"]]["guid"],"scenarios":u["scen"]})
    ops.append({"op":"create_or_update_elements","elements":
        [{"elementID":bru[c]["id"],"taggedValues":tvp()} for c in bru if c != "BRU-9501"] +
        [{"elementID":uc[u["code"]]["id"],"taggedValues":tvp()} for u in touched]})
    return batch("re17-1-07-bru-split", ops)

def r17_3b():
    """Provenance v0.22 zbylych 5 UC (balicky 1147-1150, 1152)."""
    P_, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    rest = [u for u in F.UC if "BRU-9510" not in u["bru"]]
    return batch("re17-1-08-provenance-uc", [{"op":"create_or_update_elements","elements":[{"elementID":uc[u["code"]]["id"],"taggedValues":tvp()} for u in rest]}])

def r17_4():
    """Krok 4: atributy 8 entit LDM of EA Repository = sloupce, ktere bridge cte/pise (extract_ldm.py nad src/ @ v0.22)."""
    import extract_ldm
    A = extract_ldm.build()
    ids = dict(zip([e[0] for e in I.ENTITIES], range(11977, 11985)))
    ops = []
    for n, t, nt in I.ENTITIES:
        ops.append({"op":"create_or_update_attributes","element":ids[n],"attributes":A[n]})
    ops.append({"op":"create_or_update_elements","elements":[
        {"elementID":ids[n],"notes":nt+" Fyzická tabulka: %s.\nAtributy = sloupce, které bridge skutečně čte nebo píše (SQL i Automation API; docs/re-addin/extract_ldm.py nad src @ %s), typ prostým textem.\nTypování doménovými typy při přenosu do EMR (plán A/B/C, metodika §6.3)." % (t, I.REF)}
        for n, t, nt in I.ENTITIES]})
    return batch("re17-1-09-ldm-atributy", ops)

IMPACT_A = [(12060, 11961), (12061, 11961), (12062, 11961), (12063, 11961)]           # UCR-95101..95104 -> SR ProcessRequest
IMPACT_B = [(12065, 11965), (11961, 11969), (11961, 11973)]                        # UCR-95106 -> SR Ping; SR ProcessRequest -> SR CUE / SR DFM
def _imp(id_, pairs):
    """Krok 5: impact vazby (EA-Repozitar-Kontext par. 3, emr-zapis-pravidla par. 7f: Usage kopiruje ref retez), bez umisteni na diagramy."""
    return batch(id_, [{"op":"create_or_update_connectors","connectors":[
        {"source":s,"target":t,"type":"Usage","direction":"FromSourceToTarget","notes":"Impact: Usage kopíruje ref řetěz (ref v kompozitní sekvenci zdroje vede na cíl)."} for s, t in pairs]},
        {"op":"query","sql":"SELECT Connector_ID, Connector_Type, Direction, Start_Object_ID, End_Object_ID FROM t_connector WHERE Connector_Type = 'Usage' AND Start_Object_ID IN (12060,12061,12062,12063,12065,11961)"}])
def r17_5a(): return _imp("re17-1-10-impact-ucr", IMPACT_A)
def r17_5b(): return _imp("re17-1-11-impact-sr", IMPACT_B)

KONTROLY = [
 ("rozhrani ParentID=0 v 1127", 0, "SELECT COUNT(*) AS N FROM t_object WHERE Object_Type = 'Interface' AND Package_ID = 1127 AND ParentID = 0"),
 ("instance s classifierem ParentID=0 (sluzby + UC)", 0, "SELECT COUNT(*) AS N FROM t_object WHERE Object_Type IN ('Object','Component','Actor','InteractionOccurrence','MessageEndpoint') AND Classifier > 0 AND ParentID = 0 AND (Package_ID BETWEEN 1132 AND 1135 OR Package_ID BETWEEN 1144 AND 1152)"),
 ("gaty bez vlastnika (sluzby + UC)", 0, "SELECT COUNT(*) AS N FROM t_object WHERE Object_Type = 'MessageEndpoint' AND ParentID = 0 AND (Package_ID BETWEEN 1132 AND 1135 OR Package_ID BETWEEN 1144 AND 1152)"),
 ("prvky se jmenem Object", 0, "SELECT COUNT(*) AS N FROM t_object WHERE Name = 'Object' AND Package_ID BETWEEN 1124 AND 1152"),
 ("Request/Response pod DTO", 8, "SELECT COUNT(*) AS N FROM t_object c INNER JOIN t_object p ON c.ParentID = p.Object_ID WHERE p.Stereotype = 'Data Transfer Object' AND p.Package_ID BETWEEN 1132 AND 1135 AND (c.Name LIKE '%Req' OR c.Name LIKE '%Res')"),
 ("DTO -refine-> SR", 4, "SELECT COUNT(*) AS N FROM t_connector WHERE Connector_Type = 'Dependency' AND Stereotype = 'refine' AND Start_Object_ID IN (11962,11966,11970,11974) AND End_Object_ID IN (11961,11965,11969,11973)"),
 ("SR s TV 505-1", 4, "SELECT COUNT(DISTINCT o.Object_ID) AS N FROM t_object o INNER JOIN t_objectproperties t ON t.Object_ID = o.Object_ID WHERE o.Stereotype = 'Service Realization' AND o.Package_ID BETWEEN 1132 AND 1135 AND t.Property = '505-1 Operation Link' AND t.Value LIKE '{%'"),
 ("SR s kompozitnim diagramem", 4, "SELECT COUNT(DISTINCT o.Object_ID) AS N FROM t_object o INNER JOIN t_diagram d ON d.ParentID = o.Object_ID WHERE o.Stereotype = 'Service Realization' AND o.Package_ID BETWEEN 1132 AND 1135"),
 ("UC s Basic Path", 9, "SELECT COUNT(DISTINCT o.Object_ID) AS N FROM t_object o INNER JOIN t_objectscenarios s ON s.Object_ID = o.Object_ID WHERE o.Object_Type = 'UseCase' AND o.Package_ID BETWEEN 1144 AND 1152 AND s.ScenarioType = 'Basic Path'"),
 ("UC s podminkou", 9, "SELECT COUNT(DISTINCT o.Object_ID) AS N FROM t_object o INNER JOIN t_objectconstraint c ON c.Object_ID = o.Object_ID WHERE o.Object_Type = 'UseCase' AND o.Package_ID BETWEEN 1144 AND 1152"),
 ("Usage UC -> BRU-9501/9510/9511", 12, "SELECT COUNT(*) AS N FROM t_connector WHERE Connector_Type = 'Usage' AND End_Object_ID IN (12051,12207,12208)"),
 ("BRU-9510/9511 na UC detailech", 8, "SELECT COUNT(*) AS N FROM t_diagramobjects WHERE Object_ID IN (12207,12208) AND Diagram_ID BETWEEN 1218 AND 1226"),
 ("impact Usage UCR/SR -> SR", 7, "SELECT COUNT(*) AS N FROM t_connector c INNER JOIN t_object e ON c.End_Object_ID = e.Object_ID WHERE c.Connector_Type = 'Usage' AND e.Stereotype = 'Service Realization' AND c.Start_Object_ID IN (12060,12061,12062,12063,12065,11961)"),
 ("TV code-ref v0.21 (zbytek)", 0, "SELECT COUNT(*) AS N FROM t_objectproperties t INNER JOIN t_object o ON t.Object_ID = o.Object_ID WHERE o.Package_ID BETWEEN 1124 AND 1152 AND t.Property = 'code-ref' AND t.Value LIKE 'v0.21%'"),
 ("TV code-ref v0.22 prvky", 46, "SELECT COUNT(*) AS N FROM t_objectproperties t INNER JOIN t_object o ON t.Object_ID = o.Object_ID WHERE o.Package_ID BETWEEN 1124 AND 1152 AND t.Property = 'code-ref' AND t.Value = 'v0.22 (0c3e207)'"),
 ("TV code-ref operaci v0.21 (zbytek)", 0, "SELECT COUNT(*) AS N FROM t_operationtag x INNER JOIN t_operation p ON x.ElementID = p.OperationID WHERE p.Object_ID BETWEEN 11937 AND 11950 AND x.Property = 'code-ref' AND x.VALUE LIKE 'v0.21%'"),
 ("TV code-ref operaci v0.22", 85, "SELECT COUNT(*) AS N FROM t_operationtag x INNER JOIN t_operation p ON x.ElementID = p.OperationID WHERE p.Object_ID BETWEEN 11937 AND 11950 AND x.Property = 'code-ref' AND x.VALUE = 'v0.22 (0c3e207)'"),
 ("atributy entit LDM", 73, "SELECT COUNT(*) AS N FROM t_attribute WHERE Object_ID BETWEEN 11977 AND 11984"),
 ("prazdne diagramy v katalogu 1127", None, "SELECT d.Diagram_ID, d.Name FROM t_diagram d WHERE d.Package_ID = 1127 AND d.Diagram_ID NOT IN (SELECT Diagram_ID FROM t_diagramobjects WHERE Diagram_ID BETWEEN 1170 AND 1250)"),
]
def r17_7(id_="re17-1-13-kontrola"):
    return batch(id_, [{"op":"query","sql":q} for _, _, q in KONTROLY])

def r17_7fix():
    """Nalez kroku 7: kompozit 1193 'EA Repository' (IDS-DB Resource) je prazdny - doplnit komponentu (jako 1178/1179 u klientu bez rozhrani)."""
    return batch("re17-1-14-kompozit-1193", [
        {"op":"place_elements_on_diagram","diagram":1193,"elementPlacements":[{"elementID":11934,"x":60,"y":60,"width":200,"height":90}]},
        {"op":"query","sql":"SELECT Diagram_ID, Object_ID FROM t_diagramobjects WHERE Diagram_ID = 1193"}])
def r17_8(id_="re17-1-15-obrazky"):
    """Krok 8: obrazky ke kontrole okem (img-17/)."""
    return batch(id_, [{"op":"reload_diagrams","diagrams":[1197,1218,1180,1193]},{"op":"get_diagram_image","diagrams":[1197,1218,1180,1193]}])

SR_DTO = {11961: 11962, 11965: 11966, 11969: 11970, 11973: 11974}
def r17_7kanon():
    """Nalezy kroku 7 proti kanonu (emr-zapis-pravidla par. 7e): Req/Res se jmenuji <Sluzba>Req / <Sluzba>Res
    (model mel '<Sluzba> Request/Response') a DTO ma Dependency <<refine>> na SR (v modelu chybela)."""
    S = {11962:"ProcessRequest", 11966:"Ping", 11970:"CreateOrUpdateElements", 11974:"DeleteFromModel"}
    ren = []
    for dto, (rq, rs) in DTO_PARTS.items():
        ren += [{"elementID":rq,"name":S[dto]+"Req"},{"elementID":rs,"name":S[dto]+"Res"}]
    return batch("re17-1-16-dto-kanon", [
        {"op":"create_or_update_elements","elements":ren},
        {"op":"create_or_update_connectors","connectors":[{"source":dto,"target":sr,"type":"Dependency","stereotypes":"refine","direction":"FromSourceToTarget"} for sr, dto in SR_DTO.items()]},
        {"op":"query","sql":"SELECT Object_ID, Name, ParentID FROM t_object WHERE Object_ID IN (11963,11964,11967,11968,11971,11972,11975,11976)"},
        {"op":"query","sql":"SELECT Connector_ID, Connector_Type, Stereotype, Start_Object_ID, End_Object_ID FROM t_connector WHERE Connector_Type = 'Dependency' AND Start_Object_ID IN (11962,11966,11970,11974)"}])


# =====================================================================
# Z261017-2 reverse SR vsech operaci (2026-10-17) - davky do ready-17/ (id re17-2-*)
# =====================================================================
def z2_00():
    """Prescan: ping, katalog operaci (85 / 14 rozhrani), SR s TV 505-1, balicky Logical Design, sablony scaffoldu, lifeliny 4 SR."""
    return batch("re17-2-00-prescan", [
     {"op":"ping"},
     {"op":"query","sql":"SELECT o.Object_ID, o.Name AS Iface, p.OperationID, p.Name, p.ea_guid FROM t_operation p INNER JOIN t_object o ON p.Object_ID = o.Object_ID WHERE o.Package_ID = 1127 AND o.Object_Type = 'Interface' ORDER BY o.Object_ID, p.Pos, p.OperationID","maxRows":200},
     {"op":"query","sql":"SELECT o.Object_ID, o.Name, o.Package_ID, t.Value FROM t_object o INNER JOIN t_objectproperties t ON t.Object_ID = o.Object_ID WHERE t.Property = '505-1 Operation Link' AND o.Package_ID >= 1124","maxRows":200},
     {"op":"query","sql":"SELECT Package_ID, Name, Parent_ID, ea_guid FROM t_package WHERE Parent_ID IN (1128, 1129, 1130, 1131, 1136) OR Package_ID >= 1153","maxRows":200},
     {"op":"query","sql":"SELECT Package_ID, Name, ea_guid FROM t_package WHERE Package_ID IN (1059, 1060)"},
     {"op":"query","sql":"SELECT Object_ID, Name, Object_Type, Package_ID FROM t_object WHERE ea_guid IN ('{9D3D6D34-DDDB-4ac6-87D8-1B7938C65F8C}','{73A46459-E3D6-4413-BEE8-557E45E17F1A}','{800A1529-918A-4dd8-8CDA-E65504A3420C}','{ECFCBB28-C4EC-40f3-9CD7-2AF4F87244C0}')"},
     {"op":"query","sql":"SELECT o.Object_ID, o.Object_Type, o.Classifier, c.Name AS ClassifierName, o.ParentID, o.Package_ID FROM t_object o LEFT JOIN t_object c ON c.Object_ID = o.Classifier WHERE o.Package_ID BETWEEN 1132 AND 1135 AND o.Object_Type IN ('Object','Component','InteractionOccurrence','MessageEndpoint')","maxRows":200},
     {"op":"query","sql":"SELECT Object_ID, Name, Notes FROM t_object WHERE Object_ID = 11950"},
     {"op":"query","sql":"SELECT COUNT(*) AS N FROM t_object WHERE Package_ID >= 1124 AND Package_ID <= 1160"}])

import ir_sr as SR
LD_EAFB = "{ED168EFF-CD5F-4df8-98B3-27076C7DB175}"   # Logical Design/EA File Bridge (1129)
NEW_COMP_PKGS = ["val","scope","risk","bpol","qc","itan","dga","bla","aud","code","xfa"]
UTIL_IFACE = 11950
UTIL_NOTE = ("Rozhraní komponenty EAFB Utilities (reverse z kódu).\n"
             "Servisní realizace se pro operace Utility nezakládají (Z261017-2): IDesign Utility je průřezová pomůcka volaná ze všech vrstev, ne služba; "
             "v sekvencích ostatních SR se volání Utility nekreslí.")
def z2_01():
    """Balicky komponent v Logical Design (chybi 11) + veta o Utility do notes rozhrani 11950."""
    C = {c["key"]: c for c in I.COMPONENTS}
    return batch("re17-2-01-balicky-komponent", [
     {"op":"query","sql":"SELECT Object_ID, Name, Note FROM t_object WHERE Object_ID = %d" % UTIL_IFACE},
     {"op":"create_or_update_package","packages":[{"parent":LD_EAFB,"name":C[k]["name"],
        "notes":"Service packages operací komponenty %s (reverse z kódu, as-implemented; zrcadlo Logical Design EMR)." % C[k]["name"]} for k in NEW_COMP_PKGS]},
     {"op":"create_or_update_elements","elements":[{"elementID":UTIL_IFACE,"name":"EAFB Utilities Interface","notes":UTIL_NOTE}]},
     {"op":"query","sql":"SELECT Package_ID, Name, ea_guid FROM t_package WHERE Parent_ID = 1129 ORDER BY Package_ID"}])

def _scaf(o):
    pid, pg = SR.LD_PKG[o[1]]
    return {"op":"find_or_create_referencing_sr","operation":o[4],"packageName":o[0],"targetPackage":pg}
def _readback(parent_ids):
    sub = "SELECT Package_ID FROM t_package WHERE Parent_ID IN (%s)" % ",".join(str(p) for p in parent_ids)
    obj = "SELECT Object_ID FROM t_object WHERE Package_ID IN (%s)" % sub
    return [
     {"op":"query","sql":"SELECT Package_ID, Name, Parent_ID FROM t_package WHERE Parent_ID IN (%s)" % ",".join(str(p) for p in parent_ids),"maxRows":200},
     {"op":"query","sql":"SELECT Object_ID, Name, Object_Type, Stereotype, ParentID, Package_ID, Note FROM t_object WHERE Package_ID IN (%s)" % sub,"maxRows":500},
     {"op":"query","sql":"SELECT t.Object_ID, t.Property, t.Value FROM t_objectproperties t WHERE t.Property = '505-1 Operation Link' AND t.Object_ID IN (%s)" % obj,"maxRows":200},
     {"op":"query","sql":"SELECT Diagram_ID, Name, Diagram_Type, ParentID, Package_ID, StyleEx FROM t_diagram WHERE Package_ID IN (%s)" % sub,"maxRows":500},
     {"op":"query","sql":"SELECT Connector_ID, Connector_Type, SubType, Stereotype, Start_Object_ID, End_Object_ID, SourceIsAggregate, DestIsAggregate FROM t_connector WHERE Start_Object_ID IN (%s)" % obj,"maxRows":500},
     {"op":"query","sql":"SELECT Diagram_ID, Object_ID, RectLeft, RectTop, RectRight, RectBottom FROM t_diagramobjects WHERE Diagram_ID IN (SELECT Diagram_ID FROM t_diagram WHERE Package_ID IN (%s))" % sub,"maxRows":500}]
def z2_02():
    """Sonda: scaffold jedne operace (Batch Validation.PrecheckBatch) + readback struktury."""
    o = [x for x in SR.TODO if x[0] == "PrecheckBatch"][0]
    return batch("re17-2-02-sonda-scaffold", [_scaf(o)] + _readback([SR.LD_PKG["val"][0]]))

def z2_scaffold_batches(maxops=12, maxpkg=5):
    """Strukturni davky: find_or_create_referencing_sr po komponentach (<= maxops operaci, <= maxpkg cilovych balicku)."""
    todo = [o for o in SR.TODO if o[0] != "PrecheckBatch"]
    out, cur, pk = [], [], set()
    for o in todo:
        if cur and (len(cur) >= maxops or (o[1] not in pk and len(pk) >= maxpkg)):
            out.append(cur); cur, pk = [], set()
        cur.append(o); pk.add(o[1])
    if cur: out.append(cur)
    bs = []
    for k, grp in enumerate(out):
        pids = sorted({SR.LD_PKG[o[1]][0] for o in grp})
        bs.append(batch("re17-2-%02d-scaffold" % (3 + k), [_scaf(o) for o in grp] +
            [{"op":"query","sql":"SELECT Package_ID, Name, Parent_ID FROM t_package WHERE Parent_ID IN (%s)" % ",".join(map(str, pids)),"maxRows":200}]))
    return bs

# ---- obsah SR (krok 4): atributy Req/Res, notes, DTO diagram, sekvence z extract_calls ----
import extract_calls as X
SCAF_RES = ["re17-2-02-sonda-scaffold"] + ["re17-2-%02d-scaffold" % k for k in range(3, 9)]
def load_scaffold():
    """op -> {pkg, pkgGuid, sr, srGuid, dto, req, res, srDg, dtoDg, verDg} z odpovedi scaffoldu."""
    byguid = {o[5]: o[0] for o in SR.OPS}
    out = {}
    for rid in SCAF_RES:
        p = "../../responses/res-%s.json" % rid
        if not os.path.exists(p): continue
        d = json.load(io.open(p, encoding="utf-8-sig"))
        for r in d.get("results", []):
            if r.get("op") != "find_or_create_referencing_sr" or r.get("status") != "ok" or r.get("found"): continue
            c = r["created"]; el = {e["role"]: e for e in c["elements"]}; dg = {x["role"]: x for x in c["diagrams"]}
            out[byguid[r["operation"]]] = {"pkg": c["servicePackage"]["id"], "pkgGuid": c["servicePackage"]["guid"],
                "sr": el["sr"]["id"], "srGuid": el["sr"]["guid"], "dto": el["dto"]["id"], "req": el["req"]["id"], "res": el["res"]["id"],
                "srDg": dg["sr"]["id"], "dtoDg": dg["dto"]["id"], "verDg": dg["version"]["id"]}
    return out
def sr_id_map(scaf):
    m = dict(SR.EXISTING_SR)
    for k, v in scaf.items(): m[k] = v["sr"]
    return m
LIFE_STEREO = {"IDS-IDesign::IDS-Manager":"IDS-Manager","IDS-IDesign::IDS-Engine":"IDS-Engine","IDS-IDesign::IDS-Resource Access":"IDS-Resource Access",
               "IDS-IDesign::IDS-File Resource":"IDS-File Resource","IDS-IDesign::IDS-Client":"IDS-Client"}
RA = ("mea","dga","bla","aud","code","xfa")
ENG = ("val","scope","risk","bpol","qc","itan")
def sr_note(o, x):
    c = [k for k in I.COMPONENTS if k["key"] == o[1]][0]
    cop = [k for k in c["ops"] if k[0] == o[0]][0]
    s = ["Servisní realizace operace %s.%s - průběh odvozený z kódu %s (as-implemented, src @ %s; docs/re-addin/extract_calls.py)." % (c["name"] + " Interface", o[0], "src/AICodeBridge.%s.js" % o[3], I.REF),
         cop[3]]
    dev = []
    if o[1] in RA and "scope" in x["lifelines"]: dev.append("Resource Access sám volá Write Scope Engine (nález A1)")
    if o[1] in ENG and any(l.startswith("E:") for l in x["lifelines"]): dev.append("Engine čte repozitář přímo přes Repository.SQLQuery / Automation, ne přes Resource Access (nález A4)")
    if o[0] == "Query": dev.append("SQL přichází z dávky, tabulky se v kódu nedají určit - jen čtení (SELECT/WITH)")
    if o[1] == "code": dev.append("složku src\\ čte přímo souborovým systémem (není výměnná složka, v sekvenci nekresleno)")
    if x["candidates"]: dev.append("sahá i na tabulky bez entity v LDM: %s (kandidát entity, VYSLEDKY-2026-10-17 kap. 2)" % ", ".join(x["candidates"]))
    if dev: s.append("As-implemented: " + "; ".join(dev) + ".")
    return "\n".join(s)

def sr_content_ops(o, sc, srid, comp, ent, crud, ops, xir):
    x = xir[o[0]]
    i0 = len(ops)
    cp = "src/AICodeBridge.%s.js" % o[3]
    if x["req"]: ops.append({"op":"create_or_update_attributes","element":sc["req"],"attributes":x["req"]})   # bez parametru = Req bez atributu (P2 odmita prazdny seznam)
    if x["res"]: ops.append({"op":"create_or_update_attributes","element":sc["res"],"attributes":x["res"]})
    src = {"SPEC":"pole z FB_FieldCheck SPEC, význam z hlavičky %s" % cp, "code":"pole op.<x> z kódu %s (operace nemá záznam v FB_FieldCheck SPEC)" % cp,
           "params":"parametry operace katalogu"}[x["fieldsFrom"]]
    ops.append({"op":"create_or_update_elements","elements":[
        {"elementID":sc["sr"],"notes":sr_note(o, x),"taggedValues":tv(cp)},
        {"elementID":sc["dto"],"notes":"DTO služby %s. Kontrakt žije v kódu (contractAuthority physical): %s; DTO je logický komentář, ne kopie." % (o[0], cp),"taggedValues":tv(cp)},
        {"elementID":sc["req"],"notes":("Request služby %s (%s)." % (o[0], src)) if x["req"] else "Request služby %s - operace nemá vstupní parametry." % o[0]},
        {"elementID":sc["res"],"notes":"Response služby %s (tvar odpovědi v kódu %s)." % (o[0], cp)}]})
    ops.append({"op":"place_elements_on_diagram","diagram":sc["dtoDg"],"elementPlacements":[
        {"elementID":sc["dto"],"x":260,"y":30,"width":220,"height":70},
        {"elementID":sc["req"],"x":40,"y":180,"width":300,"height":40+20*len(x["req"])},
        {"elementID":sc["res"],"x":380,"y":180,"width":320,"height":40+20*len(x["res"])}]})
    # sekvence
    ctype = {c["key"]: c["type"] for c in I.COMPONENTS}
    els = [{"owningElement":sc["srGuid"],"type":"DiagramGate","name":""},{"owningElement":sc["srGuid"],"type":"DiagramGate","name":""}]
    for l in x["lifelines"]:
        if l.startswith("E:"): els.append({"owningElement":sc["srGuid"],"type":"Object","name":"","classifierID":ent[l[2:]]["id"],"stereotypes":"entity"})
        else: els.append({"owningElement":sc["srGuid"],"type":"Object","name":"","classifierID":comp[l]["id"],"stereotypes":LIFE_STEREO[ctype[l]]})
    refs = [r for r in x["refs"] if r in srid]
    for r in refs: els.append({"owningElement":sc["srGuid"],"type":"InteractionOccurrence","name":"","classifierID":srid[r]})
    ops.append({"op":"create_or_update_elements","elements":els}); ei = len(ops) - 1
    nl = len(x["lifelines"]); nm = len(x["msgs"])
    ybot = 160 + 34 * (nm + 2)
    pl = [{"element":"$%d[0]" % ei,"x":0,"y":110,"width":10,"height":10},{"element":"$%d[1]" % ei,"x":0,"y":ybot - 40,"width":10,"height":10}]
    for k in range(nl): pl.append({"element":"$%d[%d]" % (ei, 2 + k),"x":90 + k*170,"y":40,"width":130,"height":60})
    for j in range(len(refs)): pl.append({"element":"$%d[%d]" % (ei, 2 + nl + j),"x":90 + (j % 3)*280,"y":ybot + (j // 3)*70,"width":260,"height":50})
    ops.append({"op":"place_elements_on_diagram","diagram":sc["srDg"],"elementPlacements":pl})
    idx = {l: 2 + k for k, l in enumerate(x["lifelines"])}
    me = "$%d[%d]" % (ei, idx[o[1]])
    rqn = ", ".join(a["name"] for a in x["req"] if a["name"] != "Op")
    msgs = [{"source":"$%d[0]" % ei,"target":me,"seqNo":1,"operation":o[4],"arguments":rqn[:250]}]
    for m in x["msgs"]:
        mm = {"source":me,"target":"$%d[%d]" % (ei, idx[m["to"]]),"seqNo":len(msgs) + 1}
        if "crud" in m: mm["operation"] = crud[(m["to"][2:], m["crud"])]
        elif "file" in m: mm["name"] = "čtení souboru" if m["file"] == "R" else "zápis souboru"
        elif m["op"]: mm["operation"] = [k for k in SR.OPS if k[0] == m["op"] and k[1] == m["to"]][0][4]
        else: mm["name"] = m["fn"]
        msgs.append(mm)
    resn = ", ".join(a["name"] for a in x["res"])[:200]
    msgs.append({"source":me,"target":"$%d[1]" % ei,"seqNo":len(msgs) + 1,"isReturn":True,"name":"%sRes" % o[0],"notes":resn})
    ops.append({"op":"create_or_update_messages","diagram":sc["srDg"],"messages":msgs})
    ops.append({"op":"apply_classifier_stereotypes","diagram":sc["srDg"]})

def z2_content_batches(per=5, only=None):
    comp, iface, pk = load_ids(); svc, spk, ent, crud = load_r3()
    scaf = load_scaffold(); srid = sr_id_map(scaf)
    xir = json.load(io.open("ir_sr_calls.json", encoding="utf-8"))
    todo = [o for o in SR.TODO if o[0] in scaf and (only is None or o[0] in only)]
    bs = []
    for k in range(0, len(todo), per):
        grp = todo[k:k+per]; ops = []
        for o in grp: sr_content_ops(o, scaf[o[0]], srid, comp, ent, crud, ops, xir)
        bs.append(batch("re17-2-%02d-obsah" % (40 + k // per), ops))
    return bs

# ---- krok 5: ref retez -> Usage SR -> SR; notes SR ProcessRequest (vycet registru) + stare SR bez zastarale vety o gatech ----
import re as _re
def registry():
    t = io.open("../../src/AICodeBridge.FB_Main.js", encoding="utf-8").read()
    return _re.findall(r'"([a-z_]+)":\s*\{\s*fn:\s*"([A-Za-z_]+)"', t)
def z2_usage():
    scaf = load_scaffold(); srid = sr_id_map(scaf)
    xir = json.load(io.open("ir_sr_calls.json", encoding="utf-8"))
    have = {(11961, 11969), (11961, 11973)}
    pairs = []
    def add(a, b, why):
        if a != b and (a, b) not in have: have.add((a, b)); pairs.append((a, b, why))
    for o in SR.OPS:
        if o[0] not in srid or o[0] == "ProcessRequest": continue
        x = xir.get(o[0]) or X.ir(o[0])
        for r in x["refs"]:
            if r in srid: add(srid[o[0]], srid[r], "Impact: Usage kopíruje ref řetěz (ref v sekvenci SR %s)." % o[0])
    pr = X.ir("ProcessRequest")
    for r in pr["refs"]:
        if r in srid: add(11961, srid[r], "Impact: FB_Main volá operaci přímo (zpráva v sekvenci SR ProcessRequest).")
    reg = registry(); regops = []
    for p, f in reg:
        op = X.OPFN[f][0]; regops.append((p, op))
        if op in srid: add(11961, srid[op], "Impact: exekuce operace %s z registru FB_Main (ref „exekuce operací dávky z registru“)." % p)
    conns = [{"source": a, "target": b, "type": "Usage", "direction": "FromSourceToTarget", "notes": w} for a, b, w in pairs]
    S0 = {s["name"]: s for s in I.SERVICES}
    def oldnote(n, extra=""):
        s = S0[n]
        return ("Servisní realizace operace %s - průběh odvozený z kódu (as-implemented, src @ %s).\n%s%s" % (s["op"], I.REF, I.SEQ[n]["note"], extra))
    reglist = ", ".join("%s → SR %s" % (p, op) for p, op in regops)
    prn = oldnote("ProcessRequest", "\nExekuce z registru: FB_Main volá %d protokolových operací přes this[reg.fn] (dynamicky - extraktor ji nevidí). Na diagramu ji zastupuje jedna zpráva „exekuce operací dávky z registru“ a refy na SR CreateOrUpdateElements a DeleteFromModel; vazby na SR všech operací registru jsou Usage (impact): %s." % (len(regops), reglist))
    els = [{"elementID": 11961, "notes": prn}] + [{"elementID": SR.EXISTING_SR[n], "notes": oldnote(n)} for n in ("Ping", "CreateOrUpdateElements", "DeleteFromModel")]
    return batch("re17-2-61-usage-sr", [{"op":"create_or_update_connectors","connectors":conns},{"op":"create_or_update_elements","elements":els}]), pairs

# ---- krok 6: overeni ----
SVCPK = "SELECT Package_ID FROM t_package WHERE Parent_ID IN (1130,1131,1155,1156,1157,1158,1159,1160,1161,1162,1163,1164,1165)"
SRQ = "SELECT Object_ID FROM t_object WHERE Stereotype = 'Service Realization' AND Package_ID IN (%s)" % SVCPK
KONTROLY2 = [
 ("SR v Logical Design", 76, "SELECT COUNT(*) AS N FROM t_object WHERE Stereotype = 'Service Realization' AND Package_ID IN (%s)" % SVCPK),
 ("SR s TV 505-1 na operaci komponenty sveho balicku", 76, "SELECT COUNT(*) AS N FROM t_object s INNER JOIN t_objectproperties t ON t.Object_ID = s.Object_ID AND t.Property = '505-1 Operation Link' INNER JOIN t_operation p ON p.ea_guid = t.Value INNER JOIN t_object i ON i.Object_ID = p.Object_ID INNER JOIN t_package sp ON sp.Package_ID = s.Package_ID INNER JOIN t_package cp ON cp.Package_ID = sp.Parent_ID WHERE s.Stereotype = 'Service Realization' AND i.Name = cp.Name || ' Interface' AND s.Package_ID IN (%s)" % SVCPK),
 ("operace mimo Utility bez SR", 0, "SELECT COUNT(*) AS N FROM t_operation p INNER JOIN t_object i ON i.Object_ID = p.Object_ID WHERE i.Package_ID = 1127 AND i.Object_Type = 'Interface' AND i.Object_ID <> 11950 AND p.ea_guid NOT IN (SELECT Value FROM t_objectproperties WHERE Property = '505-1 Operation Link')"),
 ("DTO", 76, "SELECT COUNT(*) AS N FROM t_object WHERE Stereotype = 'Data Transfer Object' AND Package_ID IN (%s)" % SVCPK),
 ("DTO s Req i Res pod sebou", 76, "SELECT COUNT(*) AS N FROM t_object d WHERE d.Stereotype = 'Data Transfer Object' AND d.Package_ID IN (%s) AND EXISTS (SELECT 1 FROM t_object q WHERE q.ParentID = d.Object_ID AND q.Name LIKE '%%Req') AND EXISTS (SELECT 1 FROM t_object r WHERE r.ParentID = d.Object_ID AND r.Name LIKE '%%Res')" % SVCPK),
 ("lifeliny/refy/gaty s ParentID 0", 0, "SELECT COUNT(*) AS N FROM t_object WHERE Object_Type IN ('Object','Component','InteractionOccurrence','MessageEndpoint') AND ParentID = 0 AND Package_ID IN (%s)" % SVCPK),
 ("prvky se jmenem Object", 0, "SELECT COUNT(*) AS N FROM t_object WHERE Name = 'Object' AND Package_ID IN (%s)" % SVCPK),
 ("SR s DiagramGate", 76, "SELECT COUNT(DISTINCT ParentID) AS N FROM t_object WHERE Object_Type = 'MessageEndpoint' AND ParentID IN (%s)" % SRQ),
 ("refy bez classifieru", 0, "SELECT COUNT(*) AS N FROM t_object WHERE Object_Type = 'InteractionOccurrence' AND Classifier = 0 AND Package_ID IN (%s)" % SVCPK),
 ("Usage SR -> SR", None, "SELECT COUNT(*) AS N FROM t_connector WHERE Connector_Type = 'Usage' AND Start_Object_ID IN (%s) AND End_Object_ID IN (%s)" % (SRQ, SRQ)),
]
def z2_kontrola(id_="re17-2-62-kontrola"):
    ops = [{"op":"query","sql":q} for _, _, q in KONTROLY2]
    ops.append({"op":"query","sql":"SELECT s.Object_ID, s.Name, (SELECT COUNT(*) FROM t_object l WHERE l.ParentID = s.Object_ID AND l.Object_Type IN ('Object','Component')) AS L, (SELECT COUNT(*) FROM t_object r WHERE r.ParentID = s.Object_ID AND r.Object_Type = 'InteractionOccurrence') AS R, (SELECT COUNT(*) FROM t_connector c INNER JOIN t_diagram d ON c.DiagramID = d.Diagram_ID WHERE d.ParentID = s.Object_ID AND c.Connector_Type = 'Sequence') AS M FROM t_object s WHERE s.Stereotype = 'Service Realization' AND s.Package_ID IN (%s)" % SVCPK, "maxRows":200})
    return batch(id_, ops)

# ---- balik po Z261017-2 (Milos 17. 10. 21:27 „ano“ na kartu navrhy-po-sr-vsech-operaci): a) 4 stare SR na tvar scaffoldu, b) 8 entit LDM ----
OLD_AGG = [4970, 4971, 4972, 4973, 4974, 4975, 4976, 4977]
OLD_PARTS = {11962: (11963, 11964), 11966: (11967, 11968), 11970: (11971, 11972), 11974: (11975, 11976)}
OLD_SR_DTO = {11961: ("ProcessRequest", 11962), 11965: ("Ping", 11966), 11969: ("CreateOrUpdateElements", 11970), 11973: ("DeleteFromModel", 11974)}
IV_NOTES = "SABLONA Impact View: dopadovy pohled realizace. (fixture instrukcni text)"   # = FBT Impact View Template (dgm 1148), jako scaffold
LDM_PKG = "{61C3C5BD-A918-4c6c-8485-93D63B556189}"   # LDM of EA Repository (1137)
ENT_ID = {e[0]: 11977 + k for k, e in enumerate(I.ENTITIES)}
NEW_ENT_POS = {"ObjectScenario": (40, 640), "ObjectConstraint": (230, 640), "ObjectRequirement": (420, 640), "OperationParameter": (610, 640),
               "ConnectorTag": (800, 300), "SecurityUser": (800, 40), "SecurityGroup": (990, 40), "SecurityUserGroup": (895, 170)}
NEW_ASSOCS = [("Element", "ObjectScenario", "1", "0..*", "nese"), ("Element", "ObjectConstraint", "1", "0..*", "nese"),
              ("Element", "ObjectRequirement", "1", "0..*", "nese"), ("Operation", "OperationParameter", "1", "0..*", "nese"),
              ("Connector", "ConnectorTag", "1", "0..*", "nese"), ("SecurityUser", "SecurityUserGroup", "1", "0..*", "je členem"),
              ("SecurityGroup", "SecurityUserGroup", "1", "0..*", "má členy")]
def z2_balik_a():
    import extract_ldm as L
    A = L.build_new(); names = list(L.ENT2)
    ops = [{"op":"delete_from_model","targets":[{"type":"Connector","id":c} for c in OLD_AGG]}]
    conns = []
    for dto, parts in OLD_PARTS.items():
        for p in parts: conns.append({"source":p,"target":dto,"type":"Aggregation","targetEnd":{"aggregation":2},"notes":"Kompozice část → DTO (tvar scaffoldu find_or_create_referencing_sr, N-RE-23)."})
    ops.append({"op":"create_or_update_connectors","connectors":conns})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"owningElement":sr,"type":"CSOB-ITAN::LD-Behavioral","name":"%s Impact View" % n,
        "styleEx":"MDGDgm=CSOB-ITAN::LD-Behavioral;MDGView=CSOB-ITAN::Realization Impact View;","notes":IV_NOTES,"author":"Claude via eafb","version":"1.0"}
        for sr, (n, dto) in OLD_SR_DTO.items()]})
    ops.append({"op":"create_or_update_elements","elements":[{"package":LDM_PKG,"type":"Class","stereotypes":"entity","name":e,"alias":L.ENT2[e],
        "notes":"%s Fyzická tabulka: %s.\nAtributy = sloupce, které bridge skutečně čte nebo píše (docs/re-addin/extract_ldm.py build_new nad src @ %s), typ prostým textem.\nDoplněno 17. 10. 2026 (Z261017-2, balík N-RE-26)." % (L.NOTES2[e], L.ENT2[e], I.REF),
        "taggedValues":[{"name":"re-origin","value":"code"}]} for e in names]}); ei = len(ops) - 1
    for k, e in enumerate(names):
        ops.append({"op":"create_or_update_operations","element":"$%d[%d]" % (ei, k),"operations":[{"name":x,"returnType":"void"} for x in ("C","R","U","D")]})
        if A[e]: ops.append({"op":"create_or_update_attributes","element":"$%d[%d]" % (ei, k),"attributes":A[e]})
    def ref(n): return ENT_ID[n] if n in ENT_ID else "$%d[%d]" % (ei, names.index(n))
    ops.append({"op":"create_or_update_connectors","connectors":[{"source":ref(a),"target":ref(b),"type":"Association","name":nm,
        "sourceEnd":{"multiplicity":ma},"targetEnd":{"multiplicity":mb}} for a, b, ma, mb, nm in NEW_ASSOCS]})
    ops.append({"op":"place_elements_on_diagram","diagram":1208,"elementPlacements":[{"element":"$%d[%d]" % (ei, k),"x":NEW_ENT_POS[e][0],"y":NEW_ENT_POS[e][1],"width":160,"height":110} for k, e in enumerate(names)]})
    return batch("re17-2-71-balik-stare-sr-a-ldm", ops)

NEW_ENT = ["ObjectScenario","ObjectConstraint","ObjectRequirement","OperationParameter","ConnectorTag","SecurityUser","SecurityGroup","SecurityUserGroup"]
BALIK_OPS = ['PrecheckTargets','PlanBaseline','CreateOrUpdateConnectors','CreateOrUpdateOperations','DeploySrc','CreateOrUpdateScenarios','CreateOrUpdateConstraints','CreateOrUpdateRequirements','CheckUserAccess']
def z2_balik_b():
    """Dopsat nove entity LDM do sekvenci 9 SR (lifeline + zpravy na konec pred navratovou zpravu, posun refu dolu)."""
    r71 = json.load(io.open("../../responses/res-re17-2-71-balik-stare-sr-a-ldm.json", encoding="utf-8-sig"))["results"]
    eid = {it["name"]: it["id"] for it in r71[3]["items"]}
    crud = {}
    k = 4
    for e in NEW_ENT:
        for it in r71[k]["items"]: crud[(e, it["name"])] = it["id"]
        k += 2 if e not in ("SecurityUserGroup",) or True else 1
    r70 = json.load(io.open("../../responses/res-re17-2-70-cteni-balik.json", encoding="utf-8-sig"))["results"]
    objs = r70[3]["rows"]; msgs = r70[4]["rows"]; dobs = r70[5]["rows"]
    scaf = load_scaffold(); comp, iface, pk = load_ids()
    ctype = {c["key"]: c["type"] for c in I.COMPONENTS}
    out = []
    for grp in (BALIK_OPS[:5], BALIK_OPS[5:]):
        ops = []
        for opn in grp:
            o = [x for x in SR.OPS if x[0] == opn][0]; sc = scaf[opn]; sr = sc["sr"]; dg = sc["srDg"]
            x = X.ir(opn)
            newm = [m for m in x["msgs"] if "crud" in m and m["to"][2:] in NEW_ENT]
            ents = []
            for m in newm:
                if m["to"][2:] not in ents: ents.append(m["to"][2:])
            mine = [r for r in objs if int(r["ParentID"]) == sr]
            lif = [r for r in mine if r["Object_Type"] in ("Object", "Component")]
            entry = [r for r in lif if int(r["Classifier"]) == int(comp[o[1]]["id"])][0]
            refs = [r for r in mine if r["Object_Type"] == "InteractionOccurrence"]
            dm = sorted([r for r in msgs if int(r["DiagramID"]) == dg], key=lambda r: int(r["SeqNo"]))
            ret = dm[-1]; nret = int(ret["SeqNo"])
            ops.append({"op":"create_or_update_elements","elements":[{"owningElement":sc["srGuid"],"type":"Object","name":"","classifierID":eid[e],"stereotypes":"entity"} for e in ents]}); ei = len(ops) - 1
            L = len(lif); n = len(newm)
            pl = [{"element":"$%d[%d]" % (ei, j),"x":90 + (L + j)*170,"y":40,"width":130,"height":60} for j in range(len(ents))]
            for r in refs:
                rr = [d for d in dobs if int(d["Diagram_ID"]) == dg and int(d["Object_ID"]) == int(r["Object_ID"])][0]
                pl.append({"elementID":int(r["Object_ID"]),"x":int(rr["RectLeft"]),"y":-int(rr["RectTop"]) + 34*n,"width":int(rr["RectRight"]) - int(rr["RectLeft"]),"height":int(rr["RectTop"]) - int(rr["RectBottom"])})
            ops.append({"op":"place_elements_on_diagram","diagram":dg,"elementPlacements":pl})
            mm = [{"connectorID":int(ret["Connector_ID"]),"seqNo":nret + n}]
            for j, m in enumerate(newm):
                mm.append({"source":int(entry["Object_ID"]),"target":"$%d[%d]" % (ei, ents.index(m["to"][2:])),"seqNo":nret + j,"operation":crud[(m["to"][2:], m["crud"])],"notes":"doplněno 17. 10. 2026 (balík N-RE-26)"})
            ops.append({"op":"create_or_update_messages","diagram":dg,"messages":mm})
            ops.append({"op":"apply_classifier_stereotypes","diagram":dg})
            note = sr_note(o, x) + "\nZprávy na entity %s jsou doplněné 17. 10. 2026 (balík N-RE-26) na konec sekvence před návratovou zprávu; v kódu leží uprostřed operace (pořadí viz docs/re-addin/ir_sr_calls.json)." % ", ".join(ents)
            ops.append({"op":"create_or_update_elements","elements":[{"elementID":sr,"notes":note}]})
        out.append(batch("re17-2-%02d-balik-sekvence" % (72 + len(out)), ops))
    return out

def z2_balik_fix():
    """Oprava po kontrole okem: (1) 8 novych kompozic 4 starych DTO: bridge zalozil Direction 'Destination -> Source' + Source Navigable
    -> sipka u Req/Res; srovnat na tvar scaffoldu (Unspecified, Non-Navigable), updaty direction po jednom (FB_OpConnectors ř. 43);
    (2) diagram LDM 1208: 16 entit do mrizky podle vysky (atributy + 4 operace), nic se neprekryva."""
    r71 = json.load(io.open("../../responses/res-re17-2-71-balik-stare-sr-a-ldm.json", encoding="utf-8-sig"))["results"]
    cids = [it["id"] for it in r71[1]["items"]]
    ops = [{"op":"create_or_update_connectors","connectors":[{"connectorID":c,"direction":"Unspecified","sourceEnd":{"navigable":False}}]} for c in cids]
    eid = dict(ENT_ID); eid.update({it["name"]: it["id"] for it in r71[3]["items"]})
    NA = {"Package":5,"Element":14,"TaggedValue":4,"Attribute":11,"Operation":8,"Connector":15,"Diagram":10,"Baseline":6,
          "ObjectScenario":6,"ObjectConstraint":5,"ObjectRequirement":8,"OperationParameter":6,"ConnectorTag":3,"SecurityUser":2,"SecurityGroup":2,"SecurityUserGroup":2}
    h = {e: 40 + 16*(n + 4) for e, n in NA.items()}
    X0 = [40, 240, 440, 640, 840, 1040]
    rows = [[("Baseline",0),("Package",1),("Diagram",2),("SecurityUser",4),("SecurityGroup",5)],
            [("TaggedValue",0),("Element",1),("Connector",2),("ConnectorTag",3),("SecurityUserGroup",5)],
            [("ObjectScenario",0),("ObjectConstraint",1),("ObjectRequirement",2),("Attribute",3),("Operation",4),("OperationParameter",5)]]
    pl = []; y = 40
    for row in rows:
        for e, c in row: pl.append({"elementID":eid[e],"x":X0[c],"y":y,"width":170,"height":h[e]})
        y += max(h[e] for e, c in row) + 70
    ops.append({"op":"place_elements_on_diagram","diagram":1208,"elementPlacements":pl})
    ops.append({"op":"query","sql":"SELECT Connector_ID, Direction, SourceStyle FROM t_connector WHERE Connector_ID IN (%s)" % ",".join(map(str, cids))})
    ops += [{"op":"reload_diagrams","diagrams":[1208,1197]},{"op":"get_diagram_image","diagrams":[1208,1197]}]
    return batch("re17-2-76-balik-oprava", ops)

if __name__ == "__main__":
    which = sys.argv[1]
    b = globals()[which]()
    print(write(b)[:600]); print("ops:", len(b["ops"]))
