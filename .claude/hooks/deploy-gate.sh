#!/usr/bin/env bash
# PreToolUse gate for Bash: block `vercel` deploys unless the verify stage
# has passed and left its marker. A hook deny applies even in
# bypassPermissions mode (permission order: hooks -> deny -> ask -> mode -> allow).
set -u

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

# Only gate vercel invocations; allow everything else through.
case "$COMMAND" in
  *vercel*) ;;
  *) exit 0 ;;
esac

# Read-only vercel commands are safe.
case "$COMMAND" in
  *"vercel ls"*|*"vercel whoami"*|*"vercel --version"*|*"vercel -v"*) exit 0 ;;
esac

MARKER="${CLAUDE_PROJECT_DIR:-.}/.pipeline/verify-passed"
if [ -f "$MARKER" ]; then
  exit 0
fi

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Deploy blocked: verify has not passed (.pipeline/verify-passed marker missing). Run the verify stage first."}}
JSON
exit 0
