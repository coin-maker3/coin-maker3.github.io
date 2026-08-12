#!/usr/bin/env bash
# mind-map: SessionStart hook
# Restores the project's mind-map into Claude's context at the start of every
# session — including right after /clear and after auto-compact — and installs
# the standing instructions that keep the file updated in the background.
set -u

dir="${CLAUDE_PROJECT_DIR:-$PWD}"
map="$dir/.claude/mindmap.md"

# Opt-outs: env var, or a marker file in the project.
[ "${MINDMAP_DISABLE:-0}" = "1" ] && exit 0
[ -f "$dir/.claude/mindmap.off" ] && exit 0

# First run in this project: create the mind-map from the bundled template.
if [ ! -f "$map" ]; then
  mkdir -p "$dir/.claude" 2>/dev/null || exit 0
  template="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/templates/mindmap-template.md"
  cp "$template" "$map" 2>/dev/null || exit 0
fi

# Best-effort read of the hook input to learn why the session started.
input="$(cat 2>/dev/null || true)"
src="startup"
case "$input" in
  *'"source":"clear"'* | *'"source": "clear"'*)     src="clear" ;;
  *'"source":"compact"'* | *'"source": "compact"'*) src="compact" ;;
  *'"source":"resume"'* | *'"source": "resume"'*)   src="resume" ;;
esac

case "$src" in
  clear)   lead="The chat was just cleared, but the project's short-term memory was preserved in the mind-map below. Treat it as what you knew before the clear." ;;
  compact) lead="The conversation was just compacted. The mind-map below is the authoritative record of current work — trust it over any lossy summary." ;;
  resume)  lead="This session is resuming. The mind-map below records the working state." ;;
  *)       lead="This project keeps a mind-map — a small short-term memory file that survives /clear." ;;
esac

# Cap what we inject so a bloated file can never flood the context window.
content="$(head -c 8000 "$map" 2>/dev/null || true)"
[ -n "$content" ] || exit 0

context="<mind-map source=\"$src\" file=\".claude/mindmap.md\">
$lead

$content
</mind-map>

MIND-MAP MAINTENANCE RULES (standing instructions for this whole session):
1. The file .claude/mindmap.md is this project's short-term working memory. Keep it accurate AS YOU WORK, without being asked and without announcing it — just Edit the file when state changes.
2. Update 🎯 Active Focus whenever the task, approach, or set of files being worked on changes.
3. The moment an approach fails (test failure, dead end, reverted change, rejected idea), add ONE line to 🪦 Graveyard: '- (YYYY-MM-DD) approach — why it failed'. Never retry a Graveyard item unless new information invalidates the reason.
4. Keep 📌 Pending Work current: add discovered bugs and next steps; delete items when resolved.
5. Every time you edit the file, refresh the '_Last updated:_' line with the current date/time and a few words of context.
6. Keep the whole file under 120 lines: overwrite rather than append, one line per item, prune Graveyard entries older than ~2 weeks, merge duplicates. Detail lives in the code and git history — this file is a map, not a journal.
7. This file is SHORT-TERM memory only. If something proves durable (a convention, a build quirk, an architectural decision), move it to CLAUDE.md and delete it from here.
8. If the user's first message after a clear is about ongoing work, use the mind-map to continue seamlessly instead of asking them to re-explain."

# Emit JSON so the text is injected as context (stdout alone is not injected
# for SessionStart). Prefer jq, fall back to python3, then a sed-based escaper.
if command -v jq >/dev/null 2>&1; then
  printf '%s' "$context" | jq -Rs '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: .}}'
elif command -v python3 >/dev/null 2>&1; then
  printf '%s' "$context" | python3 -c 'import json,sys; print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": sys.stdin.read()}}))'
else
  esc=$(printf '%s' "$context" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' | awk '{printf "%s\\n", $0}')
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$esc"
fi
exit 0
