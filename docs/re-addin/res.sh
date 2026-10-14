#!/bin/bash
f=~/mnt/ea-file-bridge/responses/res-$1.json
python3 - "$f" <<'P'
import json,io,sys
d=json.load(io.open(sys.argv[1],encoding='utf-8-sig'))
print(d['status'], d.get('code'), (d.get('message') or '')[:300])
for n,r in enumerate(d.get('results',[])):
  it=r.get('items',[])
  print(n, r.get('op'), r.get('status'), r.get('code') or '', (r.get('message') or '')[:200], len(it), [(x.get('id'),x.get('name')) for x in it][:4], r.get('warnings') or '')
print('risk', d.get('risk',{}).get('riskLevel'), 'qc', json.dumps(d.get('qc'),ensure_ascii=False)[:250])
P
