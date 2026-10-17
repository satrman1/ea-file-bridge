#!/bin/bash
# w17.sh <id> [wait_s]: ceka, az res davky prestane byt confirm_required/processing; vypis kratce
id=$1; w=${2:-170}; f=~/mnt/ea-file-bridge/responses/res-$id.json
for i in $(seq 1 $((w/2))); do grep -q '"status":"confirm_required"\|"status":"processing"' $f || break; sleep 2; done
python3 ~/mnt/ea-file-bridge/docs/re-addin/r17.py $id | cut -c1-220 | grep -v " ok   0 \[\] $" | head -20
