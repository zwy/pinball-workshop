#!/usr/bin/env bash
# Install the launchd agent from the repo and rewrite the hard-coded path.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Set the exact absolute path to the checkout if it is not the current directory.
if [[ "${1:-}" == "--root" ]]; then
  ROOT="${2:?--root needs a path}"
fi
PLIST_SRC="$ROOT/deploy/mac/com.pinball-workshop.plist"
LABEL="com.pinball-workshop.dev"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/Library/LaunchAgents"
sed "s|/Users/USERNAME/Sites/pinball-workshop|$ROOT|g" "$PLIST_SRC" > "$PLIST_DST"
launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$PLIST_DST"
echo "Installed $PLIST_DST using project root: $ROOT"
