#!/bin/bash
# fsubmit.sh <id> [wait_s] : vhodi ready-fix/req-<id>.json do requests\ a ceka na res
id=$1; w=${2:-60}; cd ~/mnt/ea-file-bridge
f=responses/res-$id.json
# lekce 15. 10.: opakovane vhozeni hotove davky = E_DUPLICATE_ID a puvodni res jde do superseded\ - na cteni vysledku slouzi res.sh
if [ -f $f ] && ! grep -q '"status":"processing"\|"status":"confirm_required"' $f; then echo "res uz existuje - necopiruji (pouzij res.sh $id)"; else cp docs/re-addin/ready-fix/req-$id.json requests/; fi
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
  rows=r.get('rows')
  print(n, r.get('op'), r.get('status'), r.get('code') or '', (r.get('message') or '')[:200], len(it), [(x.get('id'),x.get('name')) for x in it][:6], r.get('warnings') or '')
  if rows is not None: print('   rows', json.dumps(rows,ensure_ascii=False)[:1500])
print('risk', d.get('risk',{}).get('riskLevel'), d.get('risk',{}).get('riskReasons'), 'qc', json.dumps(d.get('qc'),ensure_ascii=False)[:250])
P
