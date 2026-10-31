#!/bin/sh
set -eu
cd /workspace
# :8081 is QA-only — a revive must never inherit a stale built-output preview.
node scripts/preview.mjs stop || true

if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8090/api/health; then
  if ! python3 -c "import fastapi,uvicorn,growwapi,pyotp,pandas,numpy" >/dev/null 2>&1; then
    pip3 install -q -r /workspace/backend/requirements.txt
  fi
  python3 -m uvicorn main:app --app-dir /workspace/backend --host 127.0.0.1 --port 8090 >>/tmp/groww-api.log 2>&1 &
fi

# Keep the desk API up across crashes. One watchdog only.
watch=0
for p in /proc/[0-9]*; do
  cmd=$(tr "\0" " " 2>/dev/null < "$p/cmdline" || true)
  case "$cmd" in
    *keep-api.sh*) watch=1 ;;
  esac
done
if [ "$watch" -eq 0 ]; then
  sh /workspace/scripts/keep-api.sh >>/tmp/groww-api.log 2>&1 &
fi

# Keep the preview on the website. The API on 8090 is not the page.
curl -sf -m 2 -X POST http://127.0.0.1:6015/__control/target -H 'content-type: application/json' -d '{"port":8080}' >/dev/null 2>&1 || true

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
