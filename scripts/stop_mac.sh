#!/usr/bin/env bash
# Stop only the listener on the target port. Never kill every port client.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-5173}"
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" || "${2:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

find_pid_for_port() {
  local pid safe cmd cwd pids
  local target="$1" dry="$2"
  pids="$(lsof -nP -iTCP:"$target" -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 {print $2}' | sort -u || true)"
  if [[ -z "$pids" ]]; then
    echo "No listener on port $target."
    return 0
  fi
  for pid in $pids; do
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    cwd="$(lsof -a -p "$pid" -d cwd -F n 2>/dev/null | sed -n 's/^n//p' | head -n1)"
    safe=0
    if [[ "$cwd" == "$ROOT" ]]; then
      safe=1
    fi
    if [[ "$cmd" == *"vite"* || "$cmd" == *"pinball-workshop"* ]]; then
      safe=1
    fi
    echo "PID $pid"
    echo "  cwd: $cwd"
    echo "  command: $cmd"
    if [[ "$dry" -eq 1 ]]; then
      echo "  dry-run: would $([ "$safe" -eq 1 ] && echo kill || echo refuse)"
      continue
    fi
    if [[ "$safe" -eq 1 ]]; then
      kill "$pid"
      echo "Sent TERM to $pid."
    else
      echo "Refusing to kill; command/cwd is not clearly this project." >&2
      echo "Verify manually and run: kill $pid" >&2
    fi
  done
}
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
find_pid_for_port "$PORT" "$DRY_RUN"
