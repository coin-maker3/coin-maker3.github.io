# 🧠 Mind Map — short-term memory for Claude Code that survives `/clear`

You know the moment. You've spent an hour with Claude Code chasing a bug — three approaches tried and failed, the real fix half-identified — and the context window fills up. You type `/clear` (or auto-compact kicks in), and the agent wakes up with total amnesia: it cheerfully suggests the exact approach that failed 40 minutes ago, and you spend ten minutes re-explaining where you were.

**Mind Map fixes this.** It's a tiny, zero-dependency Claude Code plugin that keeps a small, structured *working-memory* file in your project and — this is the important part — restores it into Claude's context **automatically, deterministically, via hooks** at the start of every session, including immediately after `/clear` and after compaction. No command to remember, no database, no API keys, no background service.

## What it remembers

Mind Map maintains one small markdown file, `.claude/mindmap.md`, with exactly three sections:

| Section | What it holds |
|---|---|
| 🎯 **Active Focus** | The exact task, files, and approach being worked on *right now* |
| 🪦 **Graveyard** | Approaches already tried that **failed**, each with a one-line reason — so a fresh session never wastes time repeating a known dead end |
| 📌 **Pending Work** | Unresolved bugs, loose ends, and the immediate next steps |

It's plain markdown in your repo. You can read it, edit it, commit it to share state with teammates, or gitignore it to keep it personal.

## How it works

Two hooks do all the heavy lifting — neither depends on the model "remembering" to use its memory:

1. **`SessionStart` hook** (fires on `startup`, `resume`, `clear`, and `compact`)
   Injects the mind-map into Claude's context the moment a session begins, along with standing instructions to keep it updated silently as work progresses. After a `/clear`, Claude literally starts the session already knowing what you were doing, what failed, and what's next. It also creates the file from a template on first run.

2. **`Stop` hook** (fires when Claude finishes a turn)
   A deterministic freshness gate. It tracks how many turns have passed since the mind-map file was last written. If it goes stale (default: 4 turns), the hook blocks the stop **once** and has Claude bring the file up to date before finishing — then resets. So even if the model gets absorbed in the work and forgets its standing instructions, the file can never drift far from reality. A loop guard (`stop_hook_active`) makes runaway blocking impossible.

The injected context is capped (8 KB) and the hooks push Claude to keep the file under 120 lines — overwrite, don't append; date Graveyard entries and prune them after ~2 weeks; move anything *durable* out to `CLAUDE.md`. Working memory is a whiteboard, not an archive.

## Install

In Claude Code:

```
/plugin marketplace add coin-maker3/claude-mind-map
/plugin install mind-map@claude-mind-map
```

That's it. On your next session start, `.claude/mindmap.md` appears in your project and starts being maintained automatically.

> Installing from the `coin-maker3.github.io` monorepo instead? Use
> `/plugin marketplace add coin-maker3/coin-maker3.github.io` and then
> `/plugin install mind-map@coin-maker3`.

**Requirements:** Claude Code with plugin support, a POSIX shell, and `jq` *or* `python3` on PATH (nearly every dev machine has one; there's even a pure-shell fallback).

## Commands

Everything is automatic, but three commands give you manual control:

| Command | What it does |
|---|---|
| `/mind-map:recall` | Re-read the mind-map, brief you in 5 lines (*we were doing… / already failed… / up next…*), and resume work. Handy right after `/clear` if you want an explicit briefing rather than a silent restore. |
| `/mind-map:save [notes]` | Snapshot the current session state into the file right now — e.g. just before you `/clear` or step away. Optional notes get folded in. |
| `/mind-map:bury <approach>` | Instantly tombstone a failed idea: `/mind-map:bury raising the timeout — race condition is in the client, not the server`. |

## Configuration

| Knob | How |
|---|---|
| Nudge interval | Plugin setting `nudge_turns`, or env `MINDMAP_NUDGE_TURNS` (default `4`) |
| Disable everywhere | `export MINDMAP_DISABLE=1` |
| Disable for one project | `touch .claude/mindmap.off` |
| Keep it out of git | add `.claude/mindmap.md` to `.gitignore` (commit it instead if you want shared team memory) |

## Why not just use ___?

We surveyed the existing memory ecosystem before building this. Almost everything targets **long-term** memory (facts, conventions, learnings) and misses **short-term working state** — and `/clear` specifically:

| | Survives `/clear` automatically | Tracks failed attempts | Zero external deps | Deterministic (not model goodwill) | Bounded size |
|---|---|---|---|---|---|
| `CLAUDE.md` / auto-memory | file survives, but task state was never in it | ✗ | ✓ | ✗ | partial |
| claude-mem (SQLite + vector DB + worker) | partial | weakly | ✗ (Bun, daemon) | retrieval isn't | ✗ |
| mem0 / MCP memory servers | only if the model queries | ✗ | ✗ (API keys / Docker) | ✗ | ✗ |
| Memory-bank patterns (Cline/Roo style) | only if the model reads | in theory; stale in practice | ✓ | ✗ | ✗ (bloats) |
| Handoff-file plugins | ✗ (manual command, pre-compact only) | ✓ manually | mostly | half | ✗ (append log) |
| **Mind Map** | **✓ (SessionStart on `clear`)** | **✓ by design (Graveyard)** | **✓** | **✓ (hooks own the transport)** | **✓ (capped + pruned)** |

The core insight: hooks should guarantee *transport* (when memory is captured and re-injected), and the model only supplies *content*. Every tool that inverts this — trusting the model to remember to call a memory tool — fails exactly when it matters most: deep into a long session, under context pressure.

Mind Map **complements** `CLAUDE.md` (durable rules) and Claude's built-in auto-memory (long-term learnings). It owns the one layer they don't: the last hour of work.

## What the file looks like mid-task

```markdown
# 🧠 Mind Map

_Last updated: 2026-08-12 14:32 — debugging the flaky checkout test_

## 🎯 Active Focus
- Fixing intermittent failure in `tests/checkout.spec.ts` (timeout on CI only)
- Current approach: mocking the payment gateway clock instead of raising timeouts
- Files: `tests/checkout.spec.ts`, `src/payments/gateway.ts`

## 🪦 Graveyard
- (2026-08-12) Raising test timeout to 30s — still flaky, root cause is a race, not slowness
- (2026-08-12) `waitFor` on the spinner element — spinner unmounts before assertion runs
- (2026-08-11) Retry-wrapper around the whole test — masks the bug, PR reviewer rejected

## 📌 Pending Work
- BUG: `gateway.ts` swallows the AbortError (found while debugging — fix after test is green)
- Add CI artifact upload for failing test traces
- Next: verify the clock mock passes 20 consecutive CI runs
```

Clear the chat. Ask "keep going". Claude picks up at the clock mock — and never suggests raising the timeout again.

## Repository layout

```
.claude-plugin/
  plugin.json          # plugin manifest
  marketplace.json     # lets you install straight from this repo
commands/
  recall.md  save.md  bury.md
hooks/
  hooks.json           # SessionStart + Stop wiring
scripts/
  session-start.sh     # restore + auto-create + standing instructions
  stop-nudge.sh        # deterministic freshness gate
templates/
  mindmap-template.md
```

## Uninstall

```
/plugin uninstall mind-map@claude-mind-map
```

Then delete `.claude/mindmap.md` from your project if you don't want to keep it. (You might — it reads like a very honest project diary.)

## License

MIT
