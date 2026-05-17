#!/usr/bin/env bash
# End-to-end smoke: dev-session login → upload sample.pdf → scan → findings → audit.
# Requires server running: npm run dev
# Requires sample.pdf in cwd.
set -euo pipefail
BASE="${BASE:-http://localhost:3001}"
PDF="${PDF:-./sample.pdf}"

if [ ! -f "$PDF" ]; then
  echo "missing $PDF — supply a real SAFE/contract PDF" >&2
  exit 1
fi

echo "1. health"
curl -sS "$BASE/api/health" | tee /dev/stderr; echo

echo "2. dev session"
curl -sS -c .cookies.txt "$BASE/api/dev/session?email=demo@clarifyd.dev" | tee /dev/stderr; echo

echo "3. upload contract"
RESP=$(curl -sS -b .cookies.txt -X POST "$BASE/api/contracts" -F "file=@$PDF")
echo "$RESP"
CID=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).contractId))")

echo "4. start scan"
SCAN=$(curl -sS -b .cookies.txt -X POST "$BASE/api/scans" \
  -H "Content-Type: application/json" -d "{\"contractId\":\"$CID\"}")
echo "$SCAN"
SID=$(echo "$SCAN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).scanId))")

echo "5. poll findings (sleep 45s — Kimi per clause)"
sleep 45
curl -sS -b .cookies.txt "$BASE/api/scans/$SID/findings" | head -c 3000; echo

echo "6. audit chain"
curl -sS -b .cookies.txt "$BASE/api/audit/$SID" | head -c 2000; echo

rm -f .cookies.txt
