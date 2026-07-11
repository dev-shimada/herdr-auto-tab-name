#!/usr/bin/env bash
# The full check suite, shared by CI (.github/actions/checks) and the local
# release script. Callers install dependencies (npm ci) first.
#
# Usage: scripts/checks.sh [--strict]
#
# Tools that may be missing on a developer machine (zsh, python3 with
# tomllib) degrade to a warning by default. With --strict a missing tool is
# an error — CI and scripts/release.sh use strict mode so nothing ships
# partially validated.
set -euo pipefail

STRICT=0
if [ "${1:-}" = "--strict" ]; then
  STRICT=1
fi

missing_tool() {
  if [ "$STRICT" = 1 ]; then
    echo "error: $1 (required in strict mode)" >&2
    exit 1
  fi
  echo "warning: $1; skipping (CI runs this check)" >&2
}

npm run check
node tests/smoke.mjs

bash -n shell/hook.bash
if command -v zsh >/dev/null 2>&1; then
  zsh -n shell/hook.zsh
else
  missing_tool "zsh not found for hook.zsh syntax check"
fi

if python3 -c 'import tomllib' 2>/dev/null; then
  python3 - <<'EOF'
import json, re, tomllib

with open("herdr-plugin.toml", "rb") as f:
    manifest = tomllib.load(f)

for key in ("id", "name", "version", "min_herdr_version"):
    assert manifest.get(key), f"herdr-plugin.toml: missing required field {key!r}"
assert re.fullmatch(r"[A-Za-z0-9._:-]+", manifest["id"]), "invalid plugin id"

for hook in manifest.get("events", []):
    assert hook.get("on") and hook.get("command"), f"invalid event hook: {hook}"
for action in manifest.get("actions", []):
    assert action.get("id") and action.get("command"), f"invalid action: {action}"
    assert "." not in action["id"], "action ids must not contain dots"

with open("package.json") as f:
    pkg = json.load(f)
assert pkg["version"] == manifest["version"], (
    f"version mismatch: package.json {pkg['version']} != "
    f"herdr-plugin.toml {manifest['version']}"
)
print(f"manifest OK (version {manifest['version']})")
EOF
else
  missing_tool "python3 with tomllib (3.11+) not found for manifest validation"
fi
