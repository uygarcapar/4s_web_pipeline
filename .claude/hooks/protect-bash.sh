#!/usr/bin/env bash
# PreToolUse gate for Bash: the Bash-side twin of protect-tests.sh.
# protect-tests.sh only sees the Edit and Write tools, so `git apply`, `sed -i`
# or a `>` redirection could still change a protected file. This denies a Bash
# command that names a protected path AND looks like it writes.
# Best effort, not a sandbox: a determined script can still get round it.
# Protected files are changed by the operator, via `!` in the session or a
# terminal, never by the agent.
set -u

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && exit 0

PROTECTED='(tests/[^[:space:]]*\.(spec|test)\.ts|lighthouserc\.cjs|budget\.json|playwright\.config\.ts|acceptance\.json|\.claude/hooks/|\.claude/settings\.json|design-rules\.md|build-rules\.md)'

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s Protected files are changed only by the operator. Write a patch under docs/patches/ and ask the operator to apply it."}}\n' "$1"
  exit 0
}

# A patch names its targets inside the file, not on the command line.
if printf '%s' "$COMMAND" | grep -Eq '(git[[:space:]]+(apply|am)|(^|[^a-zA-Z])patch)[[:space:]]' \
   && ! printf '%s' "$COMMAND" | grep -Eq 'git apply --check'; then
  for f in $(printf '%s' "$COMMAND" | grep -Eo '[^[:space:]<]+\.(patch|diff)'); do
    f="${f#\'}"; f="${f%\'}"; f="${f#\"}"; f="${f%\"}"
    [ -f "$f" ] || f="${CLAUDE_PROJECT_DIR:-.}/$f"
    if [ -f "$f" ] && grep -Eq "^(\+\+\+|---) .*$PROTECTED" "$f"; then
      deny "This patch modifies a protected quality-gate file."
    fi
  done
fi

printf '%s' "$COMMAND" | grep -Eq "$PROTECTED" || exit 0

# Drop the harmless forms before looking for writes.
SCRUBBED=$(printf '%s' "$COMMAND" \
  | sed -E 's/git apply --check( -R)?//g; s/[0-9]?>[[:space:]]*\/dev\/null//g; s/2>&1//g')

WRITES='(sed|perl)[[:space:]]+(-[a-zA-Z]*i|--in-place)|git[[:space:]]+(apply|checkout|restore|mv|rm|stash[[:space:]]+pop)|>|(^|[^a-zA-Z])(tee|mv|cp|rm|truncate|install|ln|dd|patch)[[:space:]]|python|node[[:space:]]+-e|writeFile|chmod'

if printf '%s' "$SCRUBBED" | grep -Eq "$WRITES"; then
  deny "This command would modify a protected quality-gate file through Bash."
fi
exit 0
