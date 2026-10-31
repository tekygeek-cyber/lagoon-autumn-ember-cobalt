#!/bin/sh
# Restart the Groww desk API if it stops. The login page cannot finish without it.
cd /workspace
while true; do
  if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8090/api/health; then
    if ! python3 -c "import fastapi,uvicorn,growwapi,pyotp,pandas,numpy" >/dev/null 2>&1; then
      pip3 install -q -r /workspace/backend/requirements.txt
    fi
    python3 -m uvicorn main:app --app-dir /workspace/backend --host 127.0.0.1 --port 8090 >>/tmp/groww-api.log 2>&1 &
    sleep 2
  fi
  sleep 5
done
