# -*- coding: utf-8 -*-
"""extract_ldm.py - sloupce repozitare EA, ktere EA File Bridge skutecne cte nebo pise (Z261017-1 krok 4, N-RE-13).

Vstup: src/*.js (kod bridge). Vystup: ldm_atributy.json = {entita: [{name, type, notes}]} pro 8 entit
`LDM of EA Repository` (reverse add-inu v EAExample). Dve cesty:
  1) SQL: v kazdem souboru se najdou vyskyty tabulky (t_object, t_object o, t_object AS o) a jejich aliasy;
     sloupec = token `alias.Sloupec` nebo holy nazev sloupce na radku s nazvem tabulky (jen sloupce
     ze znameho schematu EA nize - filtr proti sumu). Porovnani bez ohledu na velikost pismen.
  2) Automation API (jen soubory FB_Op*.js, ktere entitu zjevne pouzivaji - znacky MARK): vlastnost objektu
     `.Vlastnost` -> sloupec podle mapy API (napr. Element.ClassifierID -> Classifier, Method.ReturnType -> Type).
Jmeno atributu = nazev sloupce (PascalCase jako v EA schematu), typ = prosty text string|number|guid|datetime,
notes = ktere FB_ soubory sloupec pouzivaji (SQL / API). Spusteni: python3 extract_ldm.py [cesta k src] (default ../../src).
"""
import io, os, re, sys, json, glob

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src")

ENT = {  # entita LDM -> tabulka EA
 "Package": "t_package", "Element": "t_object", "TaggedValue": "t_objectproperties", "Attribute": "t_attribute",
 "Operation": "t_operation", "Connector": "t_connector", "Diagram": "t_diagram", "Baseline": "t_document"}

COLS = {  # zname sloupce schematu EA (podmnozina; filtr SQL tokenu)
 "t_package": "Package_ID Name Parent_ID CreatedDate ModifiedDate Notes ea_guid XMLPath IsControlled Version Protected PkgOwner Namespace TPos PackageFlags",
 "t_object": "Object_ID Object_Type Diagram_ID Name Alias Author Version Note Package_ID Stereotype NType Complexity Status Abstract Tagged PDATA1 PDATA2 PDATA3 PDATA4 PDATA5 Visibility GenType GenFile Phase Classifier ea_guid ParentID RunState Classifier_guid TPos IsRoot IsLeaf IsSpec IsActive StateFlags PackageFlags Multiplicity StyleEx CreatedDate ModifiedDate",
 "t_objectproperties": "PropertyID Object_ID Property Value Notes ea_guid",
 "t_attribute": "Object_ID Name Scope Stereotype Containment IsStatic IsCollection IsOrdered LowerBound UpperBound Container Notes Derived ID Pos Length Precision Scale Const Style Classifier Default Type ea_guid StyleEx",
 "t_operation": "OperationID Object_ID Name Scope Type ReturnArray Stereotype IsStatic Concurrency Notes Behaviour Abstract Pos Const Style Pure Classifier Code IsRoot IsLeaf IsQuery ea_guid StyleEx",
 "t_connector": "Connector_ID Name Direction Notes Connector_Type SubType SourceCard DestCard SourceRole DestRole SourceIsAggregate DestIsAggregate Start_Object_ID End_Object_ID SeqNo Stereotype PDATA1 PDATA2 PDATA3 PDATA4 PDATA5 DiagramID ea_guid SourceIsNavigable DestIsNavigable StyleEx",
 "t_diagram": "Diagram_ID Package_ID ParentID Diagram_Type Name Version Author ShowDetails Notes Stereotype cx cy Scale CreatedDate ModifiedDate PDATA Locked ea_guid TPos StyleEx",
 "t_document": "DocID DocName Notes Style ElementID ElementType StrContent DocType Author Version IsActive Sequence DocDate",
}
COLS = {t: c.split() for t, c in COLS.items()}

MARK = {  # Automation: soubor entitu pouziva, kdyz obsahuje nekterou znacku
 "Package": r"GetPackageByID|GetPackageByGuid|Packages\.AddNew", "Element": r"GetElementByID|GetElementByGuid|Elements\.AddNew",
 "TaggedValue": r"TaggedValues\.", "Attribute": r"GetAttributeByID|Attributes\.AddNew", "Operation": r"GetMethodByID|Methods\.",
 "Connector": r"GetConnectorByID|Connectors\.AddNew", "Diagram": r"GetDiagramByID|Diagrams\.AddNew",
 "Baseline": r"CreateBaseline|GetBaselines|DeleteBaseline"}
API = {  # vlastnost Automation -> sloupec (jen jednoznacne)
 "Package": {"PackageID": "Package_ID", "PackageGUID": "ea_guid", "ParentID": "Parent_ID"},
 "Element": {"ElementID": "Object_ID", "ElementGUID": "ea_guid", "ClassifierID": "Classifier", "ParentID": "ParentID",
             "PackageID": "Package_ID", "Alias": "Alias"},
 "TaggedValue": {"PropertyID": "PropertyID", "PropertyGUID": "ea_guid", "Value": "Value"},
 "Attribute": {"AttributeID": "ID", "AttributeGUID": "ea_guid", "LowerBound": "LowerBound", "UpperBound": "UpperBound", "Default": "Default"},
 "Operation": {"MethodID": "OperationID", "MethodGUID": "ea_guid", "ReturnType": "Type", "Code": "Code"},
 "Connector": {"ConnectorID": "Connector_ID", "ConnectorGUID": "ea_guid", "ClientID": "Start_Object_ID", "SupplierID": "End_Object_ID",
               "SequenceNo": "SeqNo", "Direction": "Direction"},
 "Diagram": {"DiagramID": "Diagram_ID", "DiagramGUID": "ea_guid", "ExtendedStyle": "StyleEx", "StyleEx": "StyleEx"},
 "Baseline": {},
}

PRIMARY = {"FB_OpPackage": "Package", "FB_OpElements": "Element", "FB_OpMoveElements": "Element", "FB_OpCreateElement": "Element",
 "FB_OpDeleteTag": "TaggedValue", "FB_OpAttributes": "Attribute", "FB_OpOperations": "Operation", "FB_OpConnectors": "Connector",
 "FB_OpMessages": "Connector", "FB_OpDiagram": "Diagram", "FB_OpPlaceElements": "Diagram", "FB_OpBaselineCreate": "Baseline"}
GENERIC = {  # obecne vlastnosti (Name, Notes, ...) - prirazuji se jen primarni entite souboru
 "Package": {"Name": "Name", "Notes": "Notes"},
 "Element": {"Name": "Name", "Notes": "Note", "Type": "Object_Type", "Stereotype": "Stereotype", "StereotypeEx": "Stereotype", "Subtype": "NType"},
 "TaggedValue": {"Name": "Property", "Notes": "Notes"},
 "Attribute": {"Name": "Name", "Type": "Type", "Notes": "Notes", "ClassifierID": "Classifier", "Pos": "Pos", "Stereotype": "Stereotype"},
 "Operation": {"Name": "Name", "Notes": "Notes", "ClassifierID": "Classifier", "Pos": "Pos", "Stereotype": "Stereotype"},
 "Connector": {"Name": "Name", "Notes": "Notes", "Type": "Connector_Type", "Subtype": "SubType", "Stereotype": "Stereotype"},
 "Diagram": {"Name": "Name", "Notes": "Notes", "Type": "Diagram_Type", "Stereotype": "Stereotype", "Author": "Author", "Version": "Version"},
}

def ctype(c):
    lc = c.lower()
    if lc in ("ea_guid", "classifier_guid"): return "guid"
    if lc.endswith("date"): return "datetime"
    if lc.endswith("_id") or lc.endswith("id") or lc in ("pos", "ntype", "classifier", "seqno", "tpos", "cx", "cy", "scale", "sequence", "lowerbound", "upperbound", "isactive", "locked", "sourceisaggregate", "destisaggregate", "packageflags"):
        return "number"
    return "string"

def scan(src):
    use = {e: {} for e in ENT}  # entita -> sloupec -> set(znacek "SQL:FB_x" / "API:FB_x")
    files = sorted(glob.glob(os.path.join(src, "*.js")))
    for f in files:
        short = os.path.basename(f).replace("AICodeBridge.", "").replace(".js", "")
        txt = io.open(f, encoding="utf-8", errors="replace").read()
        for e, t in ENT.items():
            canon = {c.lower(): c for c in COLS[t]}
            if re.search(r"\b%s\b" % t, txt, re.I):
                aliases = set(m.group(2) for m in re.finditer(r"\b(%s)\s+(?:AS\s+)?([a-z]{1,3})\b(?!\s*\()" % t, txt, re.I)
                              if m.group(2).upper() not in ("ON", "AS", "IN", "OR", "AND", "WHERE"))
                for a in aliases:
                    for m in re.finditer(r"\b%s\.([A-Za-z_0-9]+)" % re.escape(a), txt):
                        c = canon.get(m.group(1).lower())
                        if c: use[e].setdefault(c, set()).add("SQL:" + short)
                for line in txt.splitlines():
                    if re.search(r"\b%s\b" % t, line, re.I):
                        for mw in re.finditer(r"(?<![.\w])([A-Za-z_][A-Za-z_0-9]*)", line):   # holy nazev, ne alias.Sloupec jine tabulky
                            c = canon.get(mw.group(1).lower())
                            if c and not (c in ("Name", "Notes", "Version", "Type", "Style", "Scale", "Status") and not re.search(r"(SELECT|WHERE|ORDER|GROUP|SET)\b", line, re.I)):
                                use[e].setdefault(c, set()).add("SQL:" + short)
            if short.startswith("FB_Op") and re.search(MARK[e], txt):
                props = dict(API[e])
                if PRIMARY.get(short) == e: props.update(GENERIC.get(e, {}))   # Name/Notes/Type... jen v souboru, ktery entitu zapisuje
                for prop, col in props.items():
                    if re.search(r"\.%s\b" % prop, txt):
                        use[e].setdefault(col, set()).add("API:" + short)
    return use

def build(src=SRC):
    use = scan(src)
    out = {}
    for e in ENT:
        attrs = []
        for c in sorted(use[e], key=lambda x: (COLS[ENT[e]].index(x) if x in COLS[ENT[e]] else 99, x)):
            sq = sorted(x[4:] for x in use[e][c] if x.startswith("SQL:"))
            ap = sorted(x[4:] for x in use[e][c] if x.startswith("API:"))
            parts = []
            if sq: parts.append("SQL: " + ", ".join(sq))
            if ap: parts.append("API: " + ", ".join(ap))
            n = "; ".join(parts)
            if len(n) > 480: n = n[:470] + " …"
            attrs.append({"name": c, "type": ctype(c), "notes": n})
        out[e] = attrs
    return out

if __name__ == "__main__":
    o = build()
    io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ldm_atributy.json"), "w", encoding="utf-8").write(json.dumps(o, ensure_ascii=False, indent=1))
    for e, a in o.items(): print(e, len(a), [x["name"] for x in a])
