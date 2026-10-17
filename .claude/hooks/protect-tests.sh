#!/usr/bin/env bash
# PreToolUse gate for Edit|Write: quality gates and their configs are
# human-owned. The model fixes code until gates pass; it never edits the gates.
set -u

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0

# Normalize to a repo-relative path for matching.
REL="${FILE_PATH#"${CLAUDE_PROJECT_DIR:-$PWD}"/}"

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s is a protected quality-gate file. It is unacceptable to edit tests or gate configs; fix the code instead."}}\n' "$REL"
  exit 0
}

case "$REL" in
  *tests/*.spec.ts|*tests/*.test.ts) deny ;;
  *lighthouserc.cjs|*budget.json|*playwright.config.ts|*acceptance.json) deny ;;
  *.claude/hooks/*|*.claude/settings.json) deny ;;
  *design-rules.md|*build-rules.md) deny ;;
esac

exit 0
