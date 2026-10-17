#!/bin/bash
# s17.sh <id> [wait_s] : vhodi ready-17/req-<id>.json do requests\ (jen kdyz res jeste neni) a ceka na res; vypis vcetne rows
id=$1; w=${2:-90}; cd ~/mnt/ea-file-bridge
f=responses/res-$id.json
if [ -f $f ] && ! grep -q '"status":"processing"\|"status":"confirm_required"' $f; then echo "res uz existuje - necopiruji"; else [ -f $f ] || cp docs/re-addin/ready-17/req-$id.json requests/; fi
for i in $(seq 1 $w); do
  if [ -f $f ]; then
    if grep -q '"status":"confirm_required"' $f; then echo CONFIRM_REQUIRED; break; fi
    if ! grep -q '"status":"processing"' $f; then break; fi
  fi; sleep 2
done
python3 ~/mnt/ea-file-bridge/docs/re-addin/r17.py $id
