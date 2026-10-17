#!/usr/bin/env bash
# Stop gate: refuse to let a generate/fix session end while the cheap gates
# (typecheck) fail. Guards stop_hook_active to avoid the 8-block override:
# if this hook already blocked once this turn, let the session stop.
set -u

INPUT=$(cat)
STOP_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

# Only enforce inside a generated site working copy (it has site.config.ts).
# Orchestrator/admin sessions are not gated here.
if [ ! -f "$ROOT/site.config.ts" ] && [ ! -f "$ROOT/template/site.config.ts" ]; then
  exit 0
fi

DIR="$ROOT"
[ -f "$ROOT/template/site.config.ts" ] && DIR="$ROOT/template"

OUT=$(cd "$DIR" && npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  REASON=$(printf '%s' "$OUT" | head -50 | jq -Rs .)
  printf '{"decision":"block","reason":%s}\n' "$REASON"
  exit 0
fi

exit 0
