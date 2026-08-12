---
description: Reload the mind-map after /clear and resume exactly where we left off
---

Read the file `.claude/mindmap.md` in the project root now.

Then:

1. Give a short briefing (5 lines max) in this shape:
   - **We were doing:** … (from 🎯 Active Focus, including the key files)
   - **Already failed:** … (from 🪦 Graveyard — the things we must not retry)
   - **Up next:** … (from 📌 Pending Work)
2. Immediately continue with the top item of Active Focus / Pending Work. Do not ask the user to re-explain the task; only ask a question if the mind-map is genuinely ambiguous about what to do next.

If `.claude/mindmap.md` does not exist, say so and offer to start one with `/mind-map:save`.
