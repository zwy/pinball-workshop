#!/usr/bin/env bash
# Start the pinball-workshop dev server via launchd and verify it answers.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-5173}"
LABEL="com.pinball-workshop.dev"
LOG=/tmp/pinball-workshop-dev.log

existing="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 {print $2; exit}' || true)"
if [[ -n "$existing" ]]; then
  cwd="$(lsof -a -p "$existing" -d cwd -F n 2>/dev/null | sed -n 's/^n//p' | head -n1)"
  if [[ "$cwd" == "$ROOT" ]]; then
    echo "Already running (PID $existing) at http://127.0.0.1:$PORT/"
    exit 0
  fi
  echo "Port $PORT is already used by PID $existing (not this project)." >&2
  echo "Check it with: ps -p $existing -o pid,ppid,command" >&2
  exit 1
fi

if ! launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  "$ROOT/scripts/install_launchd_mac.sh" --root "$ROOT"
fi

launchctl kickstart "gui/$UID/$LABEL"
sleep 3
status="$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)"
if [[ "$status" == "200" ]]; then
  echo "Service ready: http://127.0.0.1:$PORT/ (log: $LOG)"
else
  echo "Service not ready yet; check $LOG." >&2
  exit 1
fi
