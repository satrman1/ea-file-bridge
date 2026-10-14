#!/bin/bash
# submit.sh <id> [wait_s] : vhodi ready/req-<id>.json do requests\ a ceka na res (processing/confirm_required = ceka dal)
id=$1; w=${2:-60}; cd ~/mnt/ea-file-bridge
cp docs/re-addin/ready/req-$id.json requests/
f=responses/res-$id.json
for i in $(seq 1 $w); do
  if [ -f $f ]; then
    if grep -q '"status":"confirm_required"' $f; then echo CONFIRM_REQUIRED; exit 0; fi
    if ! grep -q '"status":"processing"' $f; then break; fi
  fi; sleep 2
done
python3 - "$f" <<'P'
import json,io,sys,os
d=json.load(io.open(os.path.expanduser('~/mnt/ea-file-bridge/'+sys.argv[1]),encoding='utf-8-sig'))
print(d['status'], d.get('code'), (d.get('message') or '')[:300])
for n,r in enumerate(d.get('results',[])):
  it=r.get('items',[])
  print(n, r.get('op'), r.get('status'), r.get('code') or '', (r.get('message') or '')[:200], len(it), [(x.get('id'),x.get('name')) for x in it][:4], r.get('warnings') or '')
print('risk', d.get('risk',{}).get('riskLevel'), 'qc', json.dumps(d.get('qc'),ensure_ascii=False)[:250])
P
