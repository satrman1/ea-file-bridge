import json,io,sys,os
f=os.path.expanduser('~/mnt/ea-file-bridge/responses/res-%s.json'%sys.argv[1])
if not os.path.exists(f): print('NO RES'); sys.exit()
d=json.load(io.open(f,encoding='utf-8-sig'))
full = len(sys.argv)>2
print(d['status'], d.get('code'), (d.get('message') or '')[:600])
for n,r in enumerate(d.get('results',[])):
  it=r.get('items',[])
  rows=r.get('rows')
  print(n, r.get('op'), r.get('status'), r.get('code') or '', (r.get('message') or '')[:300], len(it), [(x.get('id'),x.get('name'),x.get('moved')) for x in it][:6], r.get('warnings') or '')
  if rows is not None: print('   rows', r.get('rowCount'), json.dumps(rows,ensure_ascii=False)[:(100000 if full else 1500)])
rk=d.get('risk',{})
print('risk', rk.get('riskLevel'), rk.get('riskReasons'), 'qc', json.dumps(d.get('qc'),ensure_ascii=False)[:300])
