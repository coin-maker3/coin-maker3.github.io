# 2WW Colorectal — Session Handoff (2026-06-29)

> **New terminal: read this first.** Supersedes the older notes in this folder's
> `CLAUDE.md`. Full deep detail is in memory:
> `C:\Users\alima\.claude\projects\C--WINDOWS-system32\memory\project_2ww_triage.md`.

## TL;DR — what this is now

A clinical decision-support + **concordance-audit** tool for the George Eliot
Hospital 2-week-wait colorectal pathway. **LIVE on Firebase**, surgeon-endorsed
(Mr Kasun), pre-audit-registration phase.

- **Live URL:** https://ww-colerectal.web.app  (Firebase project **ww-colerectal**, owned by **coinin350@gmail.com**, region **europe-west2 / London**)
- **Vercel is GONE** — project deleted on purpose; old `*.vercel.app` URLs 404. Do not redeploy to Vercel.

## Where the code is (IMPORTANT)

- **Active working copy = git worktree:** `C:\Users\alima\Desktop\Projects\Misc\2ww-work\2ww-triage\`
  - Branch: `claude/general-session-iea8E`
  - **Changes are UNCOMMITTED** (persist on disk; safe across terminal close). `node_modules` is a junction to the main checkout's copy.
  - Main checkout: `C:\Users\alima\Desktop\Projects\Misc\coin-maker3.github.io\` (on `main`; its `2ww-triage/` folder is untracked dist+node_modules only — the source lives on the branch above).
- Repo: `github.com/coin-maker3/coin-maker3.github.io` (private). Nothing pushed this session.

## Architecture (post-migration)

- **Firebase Hosting** serves the SPA (React 19 + Vite), rewrites `/api/**` → one Cloud Function.
- **Cloud Function `api`** (Gen2, europe-west2, Express) — ports all 6 endpoints; **re-runs the algorithm server-side** on audit save (tamper-proof). Files: `functions/src/{index,store,capture}.ts`, esbuild-bundled (`npm run build` in `functions/`) so the algorithm stays single-source from `../src`.
- **Firestore** (europe-west2) replaces Upstash/Vercel KV. Rules **deny all client access** — server-only (no Firebase JS SDK in the browser). Collections: `audit_cases`, `submissions`, `audit_meta`.
- Algorithm engine unchanged: `GEH-2WW-COLORECTAL v0.4.0`, 95 unit tests passing.

## What got done this session

1. **Patient "referral upload" pathway DISABLED** (Kasun's ask) — default-locked in code. Server `/api/submit` + `/api/retrieve` → 403; clinician Import/Issue buttons hidden; `/patient` form shows "not in use". Flag `CAPTURE_ENABLED` (server `process.env`, client `VITE_CAPTURE_ENABLED`), default OFF. **FY1 audit save stays LIVE** (the deliverable).
2. **Full Firebase migration** off Vercel (above). Deployed + live-verified.
3. **Structured discordance capture** (Kasun approved) — on a mismatch the reviewer must record **reason** (algorithm_error / clinician_deviation / transcription_difference / clinically_equivalent / other) + **direction** (clinician_more / equivalent / clinician_less = under-investigation, flagged red). Server-enforced. Dashboard "Discordance analysis" panel + CSV columns. Deployed + verified.
4. **GEH audit Proposal Form filled + delivered** to the user (editable .docx + .md). Tagged Assurance / Audit / Clinician Led. Generator: `scratchpad/gen-proposal.js`.

## What's next (pending)

- **User is filling** the proposal form's `[bracketed]` bits: Project Lead name+NHS email, Kasun's email, 3 FY1 reviewer names+emails, completion date. Submit to **clinical.audit@geh.nhs.uk**.
- **Open offer:** draft the covering email to the audit team (user hadn't answered).
- **Two questions I asked the user (unanswered):** (a) classify as Assurance (my pick) vs QI? (b) Kasun=supervisor / user=Project Lead framing OK?
- **The real gate before cases can be logged:** Kasun signs off the algorithm against the Trust PDF (in-person walkthrough), then register the audit → get audit ID → brief FY1s (Temi keen; Sid = data).
- **Audit framing settled:** do the **concordance/validation audit first** (current). A second **clinician-adherence audit** reuses the same data "another time" — but only AFTER the algorithm is signed off as faithful to the protocol.

## How to deploy / operate

```
cd C:\Users\alima\Desktop\Projects\Misc\2ww-work\2ww-triage
npm run build                 # SPA → dist
npm --prefix functions run build   # esbuild the function (also runs in predeploy)
firebase deploy --only hosting,functions --project ww-colerectal
npx vitest run                # 95 tests
```
- Firebase CLI is logged in as **coinin350** (verify: `firebase login:list`). NEVER use alimanasm66.
- If an API needs enabling and there's no gcloud: enable via Service Usage REST using the firebase-tools OAuth token in `~/.config/configstore/firebase-tools.json` (pattern used this session).
- To RE-ENABLE the patient pathway later (Phase 2): set `CAPTURE_ENABLED=1` (function env) + `VITE_CAPTURE_ENABLED=1` (build env), redeploy.

## Hard rules (do not break)

- Everything stays **coinin350@gmail.com**. Never alimanasm66.
- **No patient-identifiable data** anywhere in the tool, ever.
- Algorithm is deterministic, versioned, audit-traceable — don't change engine logic without Kasun sign-off.
- Internal target is an ASGBI presentation — **do NOT mention ASGBI in any email to Kasun** (user instruction).
