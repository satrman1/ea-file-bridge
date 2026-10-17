# -*- coding: utf-8 -*-
# IR reverse add-inu EA File Bridge dle metodiky SA (koncepce RE-FULL, R3).
# Zdroj: src/ @ v0.21 (45de928), pump.wsf v0.6. Strukturu urcuje kod, popisy shrnuti.
# 17. 10. 2026 (Z261017-1): provenance prepsana na v0.22 (0c3e207), overeno 2026-10-17; zmeny chovani
# v0.21..v0.22 = V022_NOTES (veta navic do notes operace katalogu, ne prepis).
# Pravidlo DTO (EA-Repozitar-Kontext par. 6, vzor DoBind): <Sluzba> Request / Response lezi ve stromu POD DTO
# (owningElement = DTO), kompozice DTO -> Req/Res zustava; generator: gen.svc_ops().
REPO = "https://github.com/satrman1/ea-file-bridge"
REF = "v0.22 (0c3e207)"     # do 17. 10. 2026: "v0.21 (45de928)"
VERIFIED = "2026-10-17"   # do 17. 10. 2026: "2026-10-14"
REF_OLD = "v0.21 (45de928)"
DTO_PARTS_UNDER_DTO = True

def P(n, t="string", notes=""): return {"name": n, "type": t, "notes": notes}

# komponenta: key, name, type (FQ MDG), code, notes, ops [(name, params, ret, notes, codepath)]
COMPONENTS = [
 dict(key="pump", name="EAFB Pump", type="IDS-IDesign::IDS-Client", code="pump.wsf",
  notes="Pumpa (Windows Script Host, pump.wsf v0.6): hlídá složku requests\\, připojí se přes COM k běžícímu EA, načte kód operací z prvku AICodeBridge v modelu a předá dávku Manageru. Zobrazuje potvrzovací okno Ano/Ne/Storno u dávek ELEVATED, píše pump-status.json a denní log. Žádná business logika - těla operací žijí v modelu.\nAs-implemented: pumpa čte a přesouvá soubory výměnné složky sama (nejde přes Exchange Folder Access).",
  ops=[]),
 dict(key="ui", name="EAFB Add-in UI", type="IDS-IDesign::IDS-Client",
  code="src/AICodeBridge.EA_*.js; FB_ClipboardImport; FB_ClipboardContext; FB_ProcessFolder; FB_Status; FB_Changes",
  notes="Uživatelské vstupy add-inu uvnitř EA: menu AI Bridge (EA_GetMenuItems/EA_MenuClick), schránkový kanál pro M365 Copilot (import dávky ze schránky, kontext výběru do schránky), GUI fallback bez pumpy (zpracování složky requests\\), stav bridge, dvojklik na řádek Output (navigace na prvek) a add-in search FB_Changes.",
  ops=[]),
 dict(key="rm", name="EAFB Request Manager", type="IDS-IDesign::IDS-Manager", code="src/AICodeBridge.FB_Main.js",
  notes="Orchestrace zpracování dávky protokolu eafb/0.2 (FB_Main): parse, kontrola přístupu a povolených operací, předběžná kontrola, risk gate, potvrzovací okruh, baseline politika, exekuce operací z registru (stop-on-error), kontrola kvality, audit a odpověď. Drží registr 42 operací protokolu.",
  ops=[
   ("ProcessRequest", [P("RequestPath","string","cesta k req-*.json (pumpa) nebo text dávky")], "string",
    "Zpracuje jednu dávku eafb/0.2 a vrátí JSON odpověď (status done | error | confirm_required, results[], risk, qc, audit).", "src/AICodeBridge.FB_Main.js"),
   ("ConfirmPending", [P("Path"),P("Nonce"),P("PayloadHash"),P("Channel"),P("Approve","boolean")], "string",
    "Jediný vstupní bod potvrzení nebo zamítnutí čekající dávky ELEVATED; ověří nonce a otisk dávky, pak dávku provede nebo odmítne.", "src/AICodeBridge.FB_ConfirmPending.js"),
   ("SweepPending", [P("PendingDir"),P("NowMs","number")], "string",
    "Expirace čekajících dávek starších než confirmMaxAgeMin (E_RISK_EXPIRED), nejstarší první.", "src/AICodeBridge.FB_PendingSweep.js"),
   ("StartSession", [], "string",
    "Start session pumpy: nová session baseline politiky, hlášení cíle zápisu, verze a otisk kódu, varování.", "src/AICodeBridge.FB_SessionStart.js"),
   ("Ping", [], "PingResult",
    "Protokolová operace ping - úvodní kotva session: repozitář, verze EA, cíl zápisu (blacklist), přístup uživatele, risk politika, otisk kódu, poznámky pro agenta.", "src/AICodeBridge.FB_OpPing.js"),
   ("GetStatus", [], "string",
    "Lidský přehled stavu bridge pro menu Stav bridge: repozitář, chráněné větve, EA security, složka výměny.", "src/AICodeBridge.FB_Status.js"),
  ]),
 dict(key="val", name="EAFB Batch Validation Engine", type="IDS-IDesign::IDS-Engine",
  code="src/AICodeBridge.FB_Precheck.js; FB_FieldCheck; FB_InterpretError",
  notes="Předběžná kontrola dávky bez okna a bez zápisu: tvar, známé operace a pole (aliasy, nápovědy překlepů), zástupné texty, odkazy $N, existence cílů; převod syrových chyb EA/COM na kódy E_*.",
  ops=[
   ("PrecheckBatch", [P("Request","object"),P("Phase","string","shape | targets")], "PrecheckResult",
    "Dvoufázová předběžná kontrola dávky; vrací jednu chybu s problems[] (E_UNKNOWN_OP, E_ARGS, ...) nebo ok.", "src/AICodeBridge.FB_Precheck.js"),
   ("CheckFields", [P("Request","object")], "FieldCheckResult",
    "Kontrola polí operací: aliasy přepsané v dávce, neznámé pole = varování s nápovědou, chybné taggedValues = E_ARGS.", "src/AICodeBridge.FB_FieldCheck.js"),
   ("InterpretError", [P("RawMessage")], "ErrorInfo",
    "Syrová chyba EA/COM -> čitelný kód (E_PERMISSION, E_LOCKED, E_FILE, E_DB_RETRY) a hláška.", "src/AICodeBridge.FB_InterpretError.js"),
  ]),
 dict(key="scope", name="EAFB Write Scope Engine", type="IDS-IDesign::IDS-Engine",
  code="src/AICodeBridge.FB_ScopePrecheck.js; FB_ScopeCheck; FB_CheckWrite; FB_CheckWriteEl; FB_WriteScope(Cfg); FB_UserAccess; FB_AccessGroups; FB_OpsAllowed; FB_ScopeText",
  notes="Cíl zápisu v režimu blacklist: chráněné větve, implicitní ochrana auditu a add-inu, pravidlo vazby (chráněná jen když jsou oba konce v chráněné části), kaskády mazání (cascadeDelete allow | block), přístup uživatele přes EA security skupiny a whitelist povolených operací.",
  ops=[
   ("PrecheckTargets", [P("Request","object")], "ScopeResult",
    "Kontrola cílů celé zápisové dávky před zápisem, oknem i zálohou (E_BLACKLIST v P2), výpočet kaskád mazání.", "src/AICodeBridge.FB_ScopePrecheck.js"),
   ("CheckWrite", [P("PackageRef")], "ScopeResult",
    "Kontrola zápisu do balíčku (null = povoleno, jinak kód a hláška).", "src/AICodeBridge.FB_CheckWrite.js"),
   ("CheckWriteElement", [P("ObjectRef"),P("Kind")], "ScopeResult",
    "Kontrola zápisu do prvku nebo diagramu po řetězu vlastníků.", "src/AICodeBridge.FB_CheckWriteEl.js"),
   ("CheckUserAccess", [], "AccessResult",
    "Přístup přihlášeného uživatele k zápisovým fíčurám (write | read) podle EA security skupin.", "src/AICodeBridge.FB_UserAccess.js"),
   ("DescribeScope", [], "string",
    "Jedna lidská věta o cíli zápisu pro start session, menu Stav bridge a ping.", "src/AICodeBridge.FB_ScopeText.js"),
  ]),
 dict(key="risk", name="EAFB Risk Gate Engine", type="IDS-IDesign::IDS-Engine",
  code="src/AICodeBridge.FB_RiskGate.js; FB_RiskPolicy; FB_ConfirmSummary; FB_ReasonText; FB_Nonce; FB_RiskNote",
  notes="Deterministické metriky a klasifikace zápisové dávky před exekucí (LOW | ELEVATED | BLOCKED), bez AI hodnocení. Důvody se stabilními kódy, lidský souhrn pro potvrzovací okno, jednorázový nonce potvrzovacího okruhu.",
  ops=[
   ("ClassifyBatch", [P("Request","object")], "RiskResult",
    "Metriky (počty zápisů, mazání, cizí prvky, rozsah) a úroveň rizika s důvody reasonItems[].", "src/AICodeBridge.FB_RiskGate.js"),
   ("BuildConfirmSummary", [P("Response","object"),P("AgeInfo")], "string",
    "Text potvrzovacího okna: co se stane a kde, záloha, důvody větami, legenda.", "src/AICodeBridge.FB_ConfirmSummary.js"),
   ("DescribeReason", [P("ReasonItem","object")], "string",
    "Kód důvodu risk gate -> věta pro člověka.", "src/AICodeBridge.FB_ReasonText.js"),
   ("IssueNonce", [], "string",
    "Jednorázový autorizační token potvrzovacího okruhu.", "src/AICodeBridge.FB_Nonce.js"),
  ]),
 dict(key="bpol", name="EAFB Baseline Policy Engine", type="IDS-IDesign::IDS-Engine",
  code="src/AICodeBridge.FB_BaselinePlan.js; FB_BaselinePolicy; FB_BaselineDecide; FB_BaselineConfig; FB_BaselineName; FB_RecoveryPosture; FB_SubtreeCount; FB_BaselineCleanup",
  notes="Baseline politika: které balíčky jsou nejbližší vlastníci cílů zápisu, sonda velikosti podstromu, nejistota obnovy, rozhodnutí o automatické záloze před zápisem a úklid automatických baselines.",
  ops=[
   ("PlanBaseline", [P("Request","object"),P("Risk","object")], "BaselinePlan",
    "Plán zálohy dávky: scope balíčků, sonda, nejistota.", "src/AICodeBridge.FB_BaselinePlan.js"),
   ("DecideBaseline", [P("Plan","object"),P("Risk","object")], "BaselineDecision",
    "Rozhodnutí: vytvořit / znovupoužít / nelze (E_NO_BASELINE) / bez zálohy.", "src/AICodeBridge.FB_BaselineDecide.js"),
   ("EvaluateRecoveryPosture", [P("Metrics","object"),P("Scope","object")], "string",
    "Jediná funkce nejistoty: full | partial | none.", "src/AICodeBridge.FB_RecoveryPosture.js"),
   ("CleanupBaselines", [P("Mode","string","report | delete"),P("Force","boolean")], "CleanupResult",
    "Úklid automatických baselines starších než limit; ruční baselines se nemažou.", "src/AICodeBridge.FB_BaselineCleanup.js"),
  ]),
 dict(key="qc", name="EAFB Quality Check Engine", type="IDS-IDesign::IDS-Engine",
  code="src/AICodeBridge.FB_QcRun.js; FB_QcConfig; FB_QcText",
  notes="Kontrola kvality po zápisové dávce: SQL kontroly z konfigurace per repozitář scopované na dotčené balíčky; stav kontroly je oddělený od stavu zápisu.",
  ops=[
   ("RunQc", [P("Request","object"),P("Response","object")], "QcResult",
    "Spustí kontroly nad dotčenými balíčky: ciste | nalez | nedobehlo | bez_kontrol.", "src/AICodeBridge.FB_QcRun.js"),
   ("DescribeQc", [P("Qc","object")], "string",
    "Výsledek kontroly kvality jednou větou pro Output, dialog a audit.", "src/AICodeBridge.FB_QcText.js"),
  ]),
 dict(key="itan", name="EAFB ITAN Methodology Engine", type="IDS-IDesign::IDS-Engine",
  code="src/AICodeBridge.FB_OpApplyClassifierStereotypes.js; FB_OpFindOrCreateSR; FB_ScaffoldConfig",
  notes="Porty produkčních skriptů metodiky ITAN do protokolu: dorovnání typu a stereotypu lifelin podle classifieru a scaffold referencující servisní realizace z operace katalogu.",
  ops=[
   ("ApplyClassifierStereotypes", [P("Diagram")], "OpResult",
    "Protokolová operace apply_classifier_stereotypes - port ITAN-Apply Classifier Stereotypes on SD.vbs.", "src/AICodeBridge.FB_OpApplyClassifierStereotypes.js"),
   ("FindOrCreateReferencingSR", [P("Operation"),P("Package")], "OpResult",
    "Protokolová operace find_or_create_referencing_sr - port ITAN-Find or Create Referencing Service Realization.vbs.", "src/AICodeBridge.FB_OpFindOrCreateSR.js"),
  ]),
]

# Resource Access: protokolove operace (jmeno protokolu, fn, write?)
def popn(proto):  # create_or_update_elements -> CreateOrUpdateElements
    return "".join(w.capitalize() for w in proto.split("_"))
def proto_ops(lst):
    out = []
    for proto, fn, w, notes in lst:
        out.append((popn(proto), [P("Operation","object","položka ops[] dávky: op = %s" % proto)], "OpResult",
                    ("Protokolová operace %s (%s). %s" % (proto, "zápis" if w else "čtení", notes)).strip(), "src/AICodeBridge.%s.js" % fn))
    return out

MEA = [
 ("query","FB_OpQuery",False,"SQL jen SELECT/WITH, maxRows, E_SQL_UNBOUNDED nad velkými tabulkami."),
 ("get_selected_context","FB_OpSelectedContext",False,"Výběr v Project browseru a otevřený diagram jako kontext pro agenta."),
 ("find_elements_by_name","FB_OpFindElements",False,""),
 ("find_packages_by_name","FB_OpFindPackages",False,""),
 ("get_elements_information","FB_OpGetElements",False,""),
 ("get_packages_information","FB_OpGetPackages",False,""),
 ("get_connectors_information","FB_OpGetConnectors",False,""),
 ("create_element","FB_OpCreateElement",True,"Legacy eafb/0.1, převod na create_or_update_elements."),
 ("create_or_update_elements","FB_OpElements",True,"Create/update prvků přes Automation API, dedup, tagged values."),
 ("move_elements","FB_OpMoveElements",True,""),
 ("create_or_update_package","FB_OpPackage",True,""),
 ("create_or_update_connectors","FB_OpConnectors",True,""),
 ("create_or_update_attributes","FB_OpAttributes",True,""),
 ("create_or_update_operations","FB_OpOperations",True,""),
 ("create_or_update_scenarios","FB_OpScenarios",True,""),
 ("create_or_update_constraints","FB_OpConstraints",True,""),
 ("create_or_update_requirements","FB_OpRequirements",True,""),
 ("delete_from_model","FB_OpDelete",True,"Mazání přes Automation API (DeleteAt) s kontrolou cíle a kaskád."),
 ("delete_taggedvalue_from_model","FB_OpDeleteTag",True,""),
 ("clone_package","FB_OpClonePackage",True,""),
 ("clone_elements","FB_OpCloneElements",True,""),
 ("export_element_linked_documents","FB_OpLinkedDocExport",False,""),
 ("import_element_linked_documents","FB_OpLinkedDocImport",True,""),
]
DGA = [
 ("get_diagrams_information","FB_OpGetDiagrams",False,""),
 ("create_or_update_diagram","FB_OpDiagram",True,""),
 ("place_elements_on_diagram","FB_OpPlaceElements",True,""),
 ("remove_elements_from_diagram","FB_OpRemoveFromDiagram",True,""),
 ("create_or_update_messages","FB_OpMessages",True,""),
 ("layout_connectors","FB_OpLayoutConnectors",True,""),
 ("change_connector_visibility","FB_OpConnectorVisibility",True,""),
 ("open_diagrams","FB_OpOpenDiagrams",False,"UI operace."),
 ("reload_diagrams","FB_OpReloadDiagrams",False,"UI operace."),
 ("update_diagram_properties","FB_OpUpdateDiagramProps",True,""),
 ("set_diagram_object_style","FB_OpDiagramObjectStyle",True,""),
 ("get_diagram_image","FB_OpDiagramImage",False,"PNG do responses\\images."),
]
BLA = [
 ("get_baselines","FB_OpBaselineList",False,""),
 ("baseline_diff","FB_OpBaselineDiff",False,""),
 ("create_baseline","FB_OpBaselineCreate",True,""),
]
COMPONENTS += [
 dict(key="mea", name="EAFB Model Element Access", type="IDS-IDesign::IDS-Resource Access",
  code="src/AICodeBridge.FB_Op*.js (prvky, balíčky, vazby); FB_ResolveEl; FB_ResolvePkg; FB_ResolvePath; FB_TargetCache; FB_TagRead; FB_TagWrite; FB_DedupFind",
  notes="Čtení a zápis prvků, balíčků, vazeb, atributů, operací, scénářů a tagged values repozitáře EA přes Automation API a SQL (Repository.SQLQuery). Sdílené resolvery cílů ({GUID} | id | jméno | cesta | $N).\nAs-implemented: zápisové operace samy volají Write Scope Engine (CheckWrite/CheckWriteElement) - v IDesign je to opačný směr volání (Resource Access -> Engine).",
  ops=proto_ops(MEA)),
 dict(key="dga", name="EAFB Diagram Access", type="IDS-IDesign::IDS-Resource Access",
  code="src/AICodeBridge.FB_OpDiagram*.js; FB_OpPlaceElements; FB_OpMessages; FB_OpLayoutConnectors; ...",
  notes="Čtení a zápis diagramů repozitáře EA: diagramy, umístění objektů, zprávy sekvenčních diagramů, vedení a viditelnost vazeb, styly, PNG export a UI operace otevření/obnovení.",
  ops=proto_ops(DGA)),
 dict(key="bla", name="EAFB Baseline Access", type="IDS-IDesign::IDS-Resource Access",
  code="src/AICodeBridge.FB_OpBaseline*.js; FB_AutoBaseline; FB_Journal; FB_BaselineNameReserved",
  notes="Baselines balíčků v repozitáři EA (t_document, Project.CreateBaseline/GetBaselines/DeleteBaseline): výpis, diff, ruční a automatická záloha před zápisem, minimální journal pre-image.",
  ops=proto_ops(BLA) + [
   ("CreateAutoBaseline", [P("PackageGuid"),P("Token"),P("Klass")], "BaselineInfo",
    "Líná automatická baseline jednoho balíčku těsně před první zápisovou operací (FB-AUTO-*).", "src/AICodeBridge.FB_AutoBaseline.js"),
   ("WriteJournal", [P("Request","object"),P("Baseline","object")], "string",
    "Pre-image polí, která dávka přepíše.", "src/AICodeBridge.FB_Journal.js"),
  ]),
 dict(key="aud", name="EAFB Audit Access", type="IDS-IDesign::IDS-Resource Access",
  code="src/AICodeBridge.FB_Audit.js; FB_AuditText; FB_RiskAuditTags; FB_LogChanges; Log; FB_OutputFlush",
  notes="Auditní stopa: Artifact za každou dávku v balíčku #AI-LOG (věty pro člověka + strojový záznam + request), riziková pole jako tagged values, výpis změn do Output tabu AI Bridge.",
  ops=[
   ("WriteAudit", [P("RequestId"),P("Summary"),P("RequestText"),P("Human")], "string",
    "Založí auditní Artifact dávky v #AI-LOG; vrací GUID nebo prázdný řetězec.", "src/AICodeBridge.FB_Audit.js"),
   ("WriteRiskAuditTags", [P("AuditGuid"),P("Risk","object"),P("Baseline","object")], "void",
    "Riziková pole na audit jako tagged values (ai.risk.*).", "src/AICodeBridge.FB_RiskAuditTags.js"),
   ("LogChanges", [P("Response","object")], "void",
    "Lidsky čitelný výpis změn s tečkovou cestou do Output tabu.", "src/AICodeBridge.FB_LogChanges.js"),
  ]),
 dict(key="code", name="EAFB Code Access", type="IDS-IDesign::IDS-Resource Access",
  code="src/AICodeBridge.FB_OpDeploySrc.js; FB_CodeInfo; FB_CodeFingerprint; DeployRequest; ExportRequest",
  notes="Kód add-inu uložený v modelu (operace prvku AICodeBridge): nasazení ze složky src\\ (jen dev, v bance deny) a otisk nasazeného kódu fb.code.*.",
  ops=proto_ops([("deploy_src","FB_OpDeploySrc",True,"Jen dev; v bance trvale v deny.")]) + [
   ("GetCodeInfo", [], "CodeInfo",
    "Přečte otisk a verzi nasazeného kódu z tagged values fb.code.*.", "src/AICodeBridge.FB_CodeInfo.js"),
  ]),
 dict(key="xfa", name="EAFB Exchange Folder Access", type="IDS-IDesign::IDS-Resource Access",
  code="src/AICodeBridge.FB_FileBytes.js; FB_StateFile; FB_PendingIndex; FB_PumpAlive; FB_ResolveBaseDir",
  notes="Souborová výměnná složka (requests\\, responses\\, pending\\, state-*.txt): bajtové čtení dávky, malý perzistentní stav, index čekajících dávek, test běžící pumpy.",
  ops=[
   ("ReadRequestBytes", [P("Path")], "array", "Jedno binární čtení souboru (základ otisku dávky).", "src/AICodeBridge.FB_FileBytes.js"),
   ("ReadWriteState", [P("Name"),P("Value")], "string", "Perzistentní stav bridge v state-<name>.txt.", "src/AICodeBridge.FB_StateFile.js"),
   ("UpdatePendingIndex", [P("PendingDir"),P("Action"),P("Entry","object")], "string", "Index čekajících dávek .index.txt.", "src/AICodeBridge.FB_PendingIndex.js"),
   ("IsPumpAlive", [P("BaseDir")], "boolean", "Běží pumpa nad složkou? (pump-status.json, aliveUntil)", "src/AICodeBridge.FB_PumpAlive.js"),
   ("ResolveBaseDir", [], "string", "Kořen výměnné složky pro připojený repozitář.", "src/AICodeBridge.FB_ResolveBaseDir.js"),
  ]),
 dict(key="earepo", name="EA Repository", type="IDS-IDesign::IDS-DB Resource", code="",
  notes="Repozitář Sparx EA (doma .qea/.qeax SQLite, v bance MS SQL). Bridge k němu přistupuje přes Automation API a Repository.SQLQuery.", ops=[]),
 dict(key="xf", name="EAFB Exchange Folder", type="IDS-IDesign::IDS-File Resource", code="requests\\, responses\\, state-*.txt",
  notes="Souborová výměnná složka mezi agentem (VS Code / Copilot) a pumpou.", ops=[]),
 dict(key="util", name="EAFB Utilities", type="IDS-IDesign::IDS-Utility",
  code="src/AICodeBridge.FB_JsonParse.js; FB_JsonStringify; FB_Sha256; B64Encode; B64Decode; FB_Utf8Decode; FB_XmlRows; FB_ComObj; FB_ElementPath",
  notes="Průřezové pomůcky pro dva běhové prostředí (JScript pumpy i JavaScript EA): JSON, SHA-256, Base64, UTF-8, převod XML výsledku SQL, COM objekty, tečková cesta prvku.",
  ops=[
   ("ParseJson", [P("Text")], "object", "Bezpečný JSON parse s pozicí chyby (E_PARSE).", "src/AICodeBridge.FB_JsonParse.js"),
   ("StringifyJson", [P("Value","object"),P("Indent","number")], "string", "", "src/AICodeBridge.FB_JsonStringify.js"),
   ("Sha256", [P("Input")], "string", "Čistá JS SHA-256 bez COM.", "src/AICodeBridge.FB_Sha256.js"),
   ("EncodeBase64", [P("Text")], "string", "", "src/AICodeBridge.B64Encode.js"),
   ("DecodeBase64", [P("Text")], "string", "", "src/AICodeBridge.B64Decode.js"),
   ("DecodeUtf8", [P("Bytes","array")], "string", "", "src/AICodeBridge.FB_Utf8Decode.js"),
   ("ParseXmlRows", [P("Xml")], "array", "XML výsledek SQLQuery -> řádky.", "src/AICodeBridge.FB_XmlRows.js"),
   ("CreateComObject", [P("ProgId")], "object", "COM objekt nezávisle na běhovém prostředí.", "src/AICodeBridge.FB_ComObj.js"),
   ("GetElementPath", [P("Kind"),P("Ref")], "string", "Tečková cesta jako v browseru EA.", "src/AICodeBridge.FB_ElementPath.js"),
  ]),
]

# Vazby volani (Usage) dle kodu: (zdroj, cil, poznamka)
USAGES = [
 ("pump","rm","pumpa vola FB_Main / FB_ConfirmPending / FB_PendingSweep / FB_SessionStart"),
 ("pump","xfa","as-implemented: pumpa cte a presouva soubory sama"),
 ("ui","rm","schranka, GUI fallback, menu Stav bridge"),
 ("rm","val",""),("rm","scope",""),("rm","risk",""),("rm","bpol",""),("rm","qc",""),("rm","itan",""),
 ("rm","mea",""),("rm","dga",""),("rm","bla",""),("rm","aud",""),("rm","code",""),("rm","xfa",""),
 ("mea","scope","as-implemented: Resource Access vola Engine (CheckWrite / CheckWriteElement)"),
 ("dga","scope","as-implemented: Resource Access vola Engine"),
 ("scope","mea","SQL cteni cilu"),("risk","mea","SQL metriky"),("bpol","bla",""),("qc","mea","SQL kontroly"),
 ("itan","mea",""),("itan","dga",""),
 ("mea","earepo",""),("dga","earepo",""),("bla","earepo",""),("aud","earepo",""),("code","earepo",""),
 ("xfa","xf",""),
]

# ---- Logical Design: 4 klicove sluzby (rozsah potvrzen Milosem 14. 10.) ----
def A(n, t="string", notes=""): return {"name": n, "type": t, "notes": notes}
SERVICES = [
 dict(name="ProcessRequest", comp="rm", op="ProcessRequest",
  req=[A("Protocol","string","verze protokolu, eafb/0.2"),A("Id","string","identifikátor dávky, unikátní"),A("Repo","string","podřetězec identity repozitáře"),A("Ops","array","seznam operací protokolu (op + pole operace)")],
  res=[A("Protocol"),A("Id"),A("Status","string","done | error | confirm_required"),A("Results","array","výsledek každé operace (status, items, code, message)"),A("Code","string","kód chyby E_*"),A("Message"),A("Risk","object","metriky a úroveň LOW | ELEVATED | BLOCKED, reasonItems"),A("Qc","object","výsledek kontroly kvality"),A("Audit","string","GUID auditního Artifactu v #AI-LOG"),A("Warnings","array")]),
 dict(name="Ping", comp="rm", op="Ping",
  req=[A("Op","string","ping")],
  res=[A("Status"),A("EaVersion"),A("Repository","string","identita repozitáře (DB_NAME nebo cesta)"),A("Time"),A("WriteScope","object","režim, blacklist, implicitní ochrana, souhrn, agentNotes"),A("CodeInfo","object","verze a otisk nasazeného kódu"),A("RiskPolicy","object"),A("UserAccess","object","write | read, skupiny")]),
 dict(name="CreateOrUpdateElements", comp="mea", op="CreateOrUpdateElements",
  req=[A("Op","string","create_or_update_elements"),A("Elements","array","položky ElementItem: guid | elementID (update), jinak create; package, name, type, stereotypes, notes, taggedValues, classifierID, dedupKey, matchByName")],
  res=[A("Op"),A("Status"),A("Items","array","index, id, guid, name každého zapsaného prvku"),A("Code"),A("Message"),A("Stamped","array","razítka ai.request mimo items po výjimce"),A("Recovery","string","návod obnovy z baseline"),A("Partial","boolean")]),
 dict(name="DeleteFromModel", comp="mea", op="DeleteFromModel",
  req=[A("Op","string","delete_from_model"),A("Targets","array","type (Element | Package | Connector | Diagram | Attribute | Operation | Parameter), id | guid, name")],
  res=[A("Op"),A("Status"),A("Items","array"),A("Removed","array","co se skutečně smazalo"),A("Cascades","array","kaskády EA do chráněné části (cascadeDelete allow)"),A("Code"),A("Message"),A("Warnings","array")]),
]
ENTITIES = [
 ("Package","t_package","Balíček modelu (browser EA)."),
 ("Element","t_object","Prvek modelu (třída, komponenta, objekt, artifact auditu ...)."),
 ("TaggedValue","t_objectproperties","Tagged value prvku (vč. ai.*, fb.code.*, 505-1)."),
 ("Attribute","t_attribute","Atribut prvku."),
 ("Operation","t_operation","Operace prvku (vč. kódu add-inu v Method.Code prvku AICodeBridge)."),
 ("Connector","t_connector","Vazba mezi prvky, vč. zpráv sekvenčních diagramů."),
 ("Diagram","t_diagram","Diagram v balíčku nebo pod prvkem."),
 ("Baseline","t_document","Baseline balíčku (DocType = Baseline)."),
]
ASSOCS = [("Package","Element","1","0..*","vlastní"),("Package","Diagram","1","0..*","vlastní"),("Package","Baseline","1","0..*","zálohuje"),
          ("Element","TaggedValue","1","0..*","nese"),("Element","Attribute","1","0..*","nese"),("Element","Operation","1","0..*","nese"),
          ("Element","Connector","1","0..*","zdroj"),("Connector","Element","0..*","1","cíl"),("Package","Package","0..1","0..*","rodič")]

# ---- Sekvence SR (as-implemented z kodu). lifeliny: klic komponenty nebo "E:<entita>"
# zprava: (z, do, operace (klic komp, jmeno op) | (E, entita, CRUD) | None, jmeno, argumenty)
SEQ = {
 "ProcessRequest": dict(lifelines=["rm","val","scope","risk","bpol","bla","mea","qc","aud"], msgs=[
   ("G","rm",("rm","ProcessRequest"),None,"RequestPath"),
   ("rm","val",("val","PrecheckBatch"),None,"Request, \"shape\""),
   ("rm","scope",("scope","CheckUserAccess"),None,""),
   ("rm","val",("val","PrecheckBatch"),None,"Request, \"targets\""),
   ("rm","scope",("scope","PrecheckTargets"),None,"Request"),
   ("rm","risk",("risk","ClassifyBatch"),None,"Request"),
   ("rm","bpol",("bpol","PlanBaseline"),None,"Request, Risk"),
   ("rm","bpol",("bpol","DecideBaseline"),None,"Plan, Risk"),
   ("rm","bla",("bla","CreateAutoBaseline"),None,"PackageGuid, Token, Klass"),
   ("rm","mea",None,"exekuce operací dávky z registru (stop-on-error)","ops[i]"),
   ("rm","qc",("qc","RunQc"),None,"Request, Response"),
   ("rm","aud",("aud","WriteAudit"),None,"RequestId, Summary, RequestText, Human"),
   ("rm","aud",("aud","LogChanges"),None,"Response"),
   ("rm","G","RETURN","response (done | error | confirm_required)",""),
  ], refs=["CreateOrUpdateElements","DeleteFromModel"],
  note="Větve: chyba předběžné kontroly / E_BLACKLIST = odpověď error bez okna; ELEVATED = dávka do pending\\, odpověď confirm_required a pokračování přes ConfirmPending (okno pumpy); BLOCKED = error. Zápisová část (baseline, exekuce, QC, audit) běží jen u LOW nebo potvrzené dávky."),
 "Ping": dict(lifelines=["rm","scope","code"], msgs=[
   ("G","rm",("rm","Ping"),None,""),
   ("rm","scope",("scope","CheckUserAccess"),None,""),
   ("rm","scope",("scope","DescribeScope"),None,""),
   ("rm","code",("code","GetCodeInfo"),None,""),
   ("rm","G","RETURN","PingResult",""),
  ], refs=[], note="Ping je čtecí operace bez risk gate a bez auditu zápisu; identitu repozitáře bere z FB_RepoId (Utility)."),
 "CreateOrUpdateElements": dict(lifelines=["mea","scope","E:Package","E:Element","E:TaggedValue"], msgs=[
   ("G","mea",("mea","CreateOrUpdateElements"),None,"Operation"),
   ("mea","E:Package",("E","Package","R"),None,"resolve cílového balíčku"),
   ("mea","scope",("scope","CheckWrite"),None,"PackageRef"),
   ("mea","E:TaggedValue",("E","TaggedValue","R"),None,"dedup ai.dedup"),
   ("mea","E:Element",("E","Element","R"),None,"resolve guid | elementID (update)"),
   ("mea","scope",("scope","CheckWriteElement"),None,"ObjectRef, \"element\""),
   ("mea","E:Element",("E","Element","C"),None,"Package.Elements.AddNew"),
   ("mea","E:Element",("E","Element","U"),None,"Element.Update"),
   ("mea","E:TaggedValue",("E","TaggedValue","C"),None,"taggedValues, razítko ai.request"),
   ("mea","G","RETURN","OpResult (items[])",""),
  ], refs=[], note="As-implemented: Resource Access sám volá Write Scope Engine (CheckWrite / CheckWriteElement) - opačný směr volání vůči IDesign; nález pro člověka, ne oprava."),
 "DeleteFromModel": dict(lifelines=["mea","scope","E:Element","E:Connector","E:Diagram","E:Package"], msgs=[
   ("G","mea",("mea","DeleteFromModel"),None,"Operation"),
   ("mea","E:Element",("E","Element","R"),None,"resolve cílů"),
   ("mea","scope",("scope","CheckWriteElement"),None,"ObjectRef, Kind"),
   ("mea","E:Connector",("E","Connector","R"),None,"kaskády SQL (vazby, instance)"),
   ("mea","E:Connector",("E","Connector","D"),None,""),
   ("mea","E:Diagram",("E","Diagram","D"),None,""),
   ("mea","E:Element",("E","Element","D"),None,"Package.Elements.DeleteAt"),
   ("mea","E:Package",("E","Package","D"),None,"Packages.DeleteAt"),
   ("mea","G","RETURN","OpResult (items[], removed[], cascades[])",""),
  ], refs=[], note="Kaskády do chráněné části: cascadeDelete block = E_BLACKLIST už v předběžné kontrole; allow = cascades[] v odpovědi a varování v okně."),
}


# ---- v0.21 -> v0.22 (git diff v0.21 v0.22 -- src/, 15 souboru): veta navic do notes operace katalogu ----
V022_NOTES = {
 "ProcessRequest": "v0.22: odkaz $N[i].compositeDiagram; auto-kompozit MDG prvku založený touto session pumpy se počítá jako vlastní diagram (N-RE-6, N-RE-11).",
 "PrecheckBatch": "v0.22: kontroluje i odkazy $N[i].compositeDiagram a cíl move_elements owningElement.",
 "CheckFields": "v0.22: move_elements zná pole owningElement (aliasy owner, parent).",
 "PrecheckTargets": "v0.22: u move_elements s cílem owningElement kontroluje balíček vlastníka; zná odkaz $N[i].compositeDiagram.",
 "ClassifyBatch": "v0.22: práh affectedPackages vyjmenuje dotčené balíčky tečkovou cestou (summary.packagePaths, max. 10); přesun pod prvek se počítá do balíčku vlastníka.",
 "BuildConfirmSummary": "v0.22: přesun pod jiný prvek ve stromu má vlastní větu okna („PRESUNOUT … pod jiný prvek ve stromu“).",
 "DescribeReason": "v0.22: důvod prahu affectedPackages nese výčet balíčků.",
 "PlanBaseline": "v0.22: u move_elements s cílem owningElement je cílem zálohy balíček vlastníka (FB_BaselinePolicy).",
 "RunQc": "v0.22: kontrola QC-DEMO-001 (prvek bez jména) vynechává instance s classifierem, refy, hranice a gaty (N-RE-9).",
 "ApplyClassifierStereotypes": "v0.22: lifeline s classifierem Actor dostane Type Actor + stereotyp classifieru (nad rámec VBS originálu, N-RE-18).",
 "CreateOrUpdateElements": "v0.22: type DiagramGate/Gate = MessageEndpoint Subtype 2 pod owningElement; jméno \"\" se zapíše už při create; ref s classifierem dostane jméno a kompozitní odkaz classifieru; items nesou compositeDiagramID/GUID (N-RE-1, 2, 4, 11).",
 "MoveElements": "v0.22: cíl owningElement = přesun pod prvek (ParentID + balíček vlastníka, kaskáda potomků a diagramů, readback ParentID; package a owningElement současně = E_ARGS) (N-RE-17).",
 "PlaceElementsOnDiagram": "v0.22: prvek, který už na diagramu je, se přesune (moved, from) místo chyby Update (N-RE-3).",
 "CreateOrUpdateMessages": "v0.22: přesměrování konce zprávy bez seqNo zachová pořadí zpráv (EA jinak SeqNo nuluje).",
}
