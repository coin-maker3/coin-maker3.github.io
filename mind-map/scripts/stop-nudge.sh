#!/usr/bin/env bash
# mind-map: Stop hook
# Deterministic freshness gate. Counts turns since the mind-map was last
# written; once it goes stale for N turns, blocks the stop ONCE and asks
# Claude to bring the file up to date before finishing. This is what makes
# updates automatic instead of relying on the model to remember.
set -u

input="$(cat 2>/dev/null || true)"

# Never re-block a turn that is already continuing because of a stop hook.
case "$input" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

dir="${CLAUDE_PROJECT_DIR:-$PWD}"
map="$dir/.claude/mindmap.md"

[ -f "$map" ] || exit 0
[ "${MINDMAP_DISABLE:-0}" = "1" ] && exit 0
[ -f "$dir/.claude/mindmap.off" ] && exit 0

# Per-project turn counter, stored outside the project tree.
data="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/mind-map}"
mkdir -p "$data" 2>/dev/null || data="${TMPDIR:-/tmp}"
key="$(printf '%s' "$dir" | cksum | awk '{print $1}')"
state="$data/turns-$key"

now="$(date +%s)"
mt="$(stat -c %Y "$map" 2>/dev/null || stat -f %m "$map" 2>/dev/null || echo "$now")"
age=$(( now - mt ))

# Map was written in the last 5 minutes → it is being kept fresh; reset.
if [ "$age" -lt 300 ]; then
  printf '0' > "$state" 2>/dev/null
  exit 0
fi

n="$(cat "$state" 2>/dev/null || printf '0')"
case "$n" in '' | *[!0-9]*) n=0 ;; esac
n=$(( n + 1 ))
printf '%s' "$n" > "$state" 2>/dev/null

threshold="${CLAUDE_PLUGIN_OPTION_NUDGE_TURNS:-${MINDMAP_NUDGE_TURNS:-4}}"
case "$threshold" in '' | *[!0-9]* | 0) threshold=4 ;; esac

if [ "$n" -ge "$threshold" ]; then
  printf '0' > "$state" 2>/dev/null
  reason="[mind-map] .claude/mindmap.md is stale. Before stopping, silently bring it up to date: rewrite 🎯 Active Focus to the current task/files/approach, add any approaches that failed since the last update to 🪦 Graveyard (one line each, dated, with why), refresh 📌 Pending Work, update the '_Last updated:_' line, and keep the file under 120 lines. If nothing has changed, just refresh the '_Last updated:_' line. Then stop. No need to tell the user about this."
  lines="$(wc -l < "$map" 2>/dev/null || echo 0)"
  if [ "$lines" -gt 150 ]; then
    reason="$reason ALSO: the file is $lines lines — condense it back under 120 (prune stale Active Focus detail, drop Graveyard entries older than ~2 weeks, merge duplicates)."
  fi
  # Emit both the classic top-level form and the hookSpecificOutput form so
  # the block works across Claude Code versions.
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg r "$reason" '{decision: "block", reason: $r, hookSpecificOutput: {hookEventName: "Stop", permissionDecision: "block", permissionDecisionReason: $r}}'
  else
    printf '{"decision":"block","reason":"%s","hookSpecificOutput":{"hookEventName":"Stop","permissionDecision":"block","permissionDecisionReason":"%s"}}' "$reason" "$reason"
  fi
fi
exit 0
