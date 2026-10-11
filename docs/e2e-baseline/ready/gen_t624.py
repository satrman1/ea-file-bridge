# gen_t624.py <res-R1.json> [<guid cizího UC pro R7>]  -> vygeneruje req R2..R7
import json,sys
res=json.load(open(sys.argv[1],encoding='utf-8-sig'))
r=res['results']
R=r[0]['guid']
els=r[1]['items']; g={e['name']:e['guid'] for e in els}
dia=r[2]['items'][0]['guid']
foreignUC=sys.argv[2] if len(sys.argv)>2 else None
def w(id,ops): json.dump({"protocol":"eafb/0.2","id":id,"repo":"EAEXAMPLE.QEA","ops":ops},open('req-%s.json'%id,'w',encoding='utf-8'),indent=1,ensure_ascii=False)
UC1=g['UC-R1 Vypujc knihu']; UC2=g['UC-R2 Vrat knihu']; POM=g['Pomocny prvek']; ACT=g['Ctenar']
# R2 scenare + constraints do UC z teze session
w('20261011-B41-R2-scenare',[
 {"op":"create_or_update_scenarios","element":UC1,"scenarios":[{"name":"Basic Path","type":"Basic Path","steps":[{"kind":"actor","text":"Ctenar vybere knihu"},{"kind":"system","text":"System overi dostupnost"},{"kind":"actor","text":"Ctenar potvrdi vypujcku"},{"kind":"system","text":"System zaeviduje vypujcku"}]}]},
 {"op":"create_or_update_constraints","element":UC1,"constraints":[{"name":"Ctenar je prihlasen","type":"Pre-condition"},{"name":"Vypujcka je zaevidovana","type":"Post-condition"}]}])
# R3 doplneni prvku na diagram z predchozi davky
w('20261011-B42-R3-na-diagram',[
 {"op":"create_or_update_elements","elements":[{"package":R,"type":"Actor","name":"Knihovnik","notes":"druhy aktor"}]},
 {"op":"place_elements_on_diagram","diagram":dia,"elementPlacements":[{"element":"$0[0]","x":40,"y":220}]},
 {"op":"create_or_update_connectors","connectors":[{"source":"$0[0]","target":UC2,"type":"Association"}]}])
# R4 datovy model - uz hotovo v B43 s "@R" -> dosadit
b=json.load(open('req-20261011-B43-R4-datovy-model.json',encoding='utf-8'))
s=json.dumps(b,ensure_ascii=False).replace('"@R"','"%s"'%R); open('req-20261011-B43-R4-datovy-model.json','w',encoding='utf-8').write(s)
# R5 smazani pomocneho prvku
w('20261011-B44-R5-delete',[{"op":"delete_from_model","targets":[{"type":"Element","guid":POM}]}])
# R6 preklep v nazvu operace: a) vytvorit s preklepem, b) opravit
w('20261011-B45a-R6-operace-preklep',[{"op":"create_or_update_operations","element":g.get('Kniha','@KNIHA'),"operations":[{"name":"vypujcKnhu","returnType":"boolean","notes":"preklep"}]}])
w('20261011-B45b-R6-operace-oprava',[{"op":"create_or_update_operations","element":g.get('Kniha','@KNIHA'),"operations":[{"guid":"@OPGUID","name":"vypujcKnihu","returnType":"boolean","notes":"opraveno"}]}])
# R7 scenare do ciziho UC (z minuleho tydne)
if foreignUC:
    w('20261011-B46-R7-cizi-uc',[{"op":"create_or_update_scenarios","element":foreignUC,"scenarios":[{"name":"Alternate - kniha nedostupna","type":"Alternate","steps":[{"kind":"system","text":"System oznami nedostupnost"}]}]}])
print('R',R,'UC1',UC1,'dia',dia,'POM',POM)
