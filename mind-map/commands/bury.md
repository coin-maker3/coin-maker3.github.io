---
description: Add a failed approach to the Graveyard so it is never retried
argument-hint: <the approach that failed and (optionally) why>
---

Add this failed approach to the 🪦 Graveyard section of `.claude/mindmap.md` (create the file with the three sections if it is missing):

> $ARGUMENTS

Rules:

- Write it as one line: `- (YYYY-MM-DD) approach — why it failed`, using today's date. If the user did not say why, fill in the reason from your knowledge of this session; if you don't know it either, write `— reason not recorded`.
- If no arguments were given at all, instead bury the most recent approach from this session that failed or was abandoned.
- Don't duplicate an existing Graveyard entry — if it's already there, refine that line instead.
- Update the `_Last updated:_` line, then confirm with the single Graveyard line you wrote.
