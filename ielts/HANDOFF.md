# IELTS Writing Lab — Handoff / Context Brief

> Read this first. It is the full context for the project so work can continue in a
> terminal session without starting over. Written 2026-06-13.

---

## 1. What this project is

A web app that lets a candidate practise **IELTS Academic Writing (Task 1 + Task 2)**
under real exam conditions and get **strict, honest band feedback from an AI examiner**
(the real Claude model, graded against the official IELTS public band descriptors).

**Why it exists:** the owner and many IMG / Sudanese doctors consistently get **6.5 in
Writing when they need 7.0** (Listening/Reading are fine — Writing is the hurdle). The
owner's wife is preparing now. Long-term goal is to **sell access** (e.g. a time-limited
"exam pass") to that niche community.

**Two hard requirements from the owner:**
1. The examiner must be **accurate and never over-promise** the band. Honesty over flattery.
2. It must be **engaging** — something a user opens daily and is hooked by, not once-and-quit.

---

## 2. Current state (what's done)

The app is **built and committed**. Plain static site, **no build step**, vanilla HTML/CSS/JS.

### Files (all under `/ielts/`)
- `ielts/index.html` — app shell / all views.
- `ielts/styles.css` — styling (dark, mobile-responsive).
- `ielts/app.js` — all logic (router, exam timing, charts, examiner API call, Coach, storage).
- `ielts/tasks.js` — task bank: Task 1 visuals (line/bar/table/process/pie) with the
  underlying `dataFacts` the examiner needs to judge accuracy + model answers; Task 2
  prompts + model answers; the **official IELTS band descriptors** (`BAND_DESCRIPTORS`).

### Features built
- Authentic exam timing (Task 1 = 20 min/150+ words, Task 2 = 40 min/250+, Full test = 60 min),
  live word count, SVG-rendered Task 1 charts.
- **Strict AI examiner**: scores the 4 official criteria as whole bands, app computes the
  task band = avg rounded to nearest 0.5; full-test overall = (T1 + T2×2)/3. Structured-output
  JSON via `output_config.format`. System prompt is explicitly anti-inflation (band-7 grammar
  needs frequent error-free sentences, etc.).
- **Upgrade Engine** (`upgrade_edits`): the smallest surgical edits that lift the candidate's
  own essay one band, each tagged to a criterion + why.
- **Red-pen markup**: the candidate's essay rendered with their error spans highlighted in place.
- **Coach view**: extracts `recurring_patterns` per essay and aggregates them across attempts
  into a personal "language fingerprint" + a readiness read + the #1 thing blocking the target.
- Engagement: streaks, target-band gap, milestones/achievements, band-over-time chart,
  "weakest criterion" focus.

### The AI call
- Model default `claude-opus-4-8` (selectable: also `claude-sonnet-4-6`, `claude-haiku-4-5`).
- Endpoint `POST https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`.
- `output_config.format` = json_schema (see `MARK_SCHEMA` in app.js). `effort: "high"` for
  non-haiku models. `max_tokens: 6000`.
- **Two key modes** (frontend handles both, see `markOne` in app.js):
  1. **Device key**: user pastes their Anthropic key into the app's ⚙︎ Settings; stored in
     `localStorage`; browser calls Anthropic directly with header
     `anthropic-dangerous-direct-browser-access: true`.
  2. **Server key**: frontend POSTs to `/api/mark`, a serverless proxy that holds the key in a
     server env var. **This proxy (`api/mark.js`) and `vercel.json` currently live only on the
     branch `claude/oet-writing-practice-app-kq5wif`, NOT on `main`** (they were removed from
     main to avoid changing the existing Vercel "2ww" project's build — see §5).

---

## 3. 🔒 SECURITY — read carefully

- **Never commit the Anthropic API key to this repo.** It is a public GitHub Pages site;
  any key in the code is world-readable and will be abused within minutes.
- The key the owner pasted into the assistant chat earlier **must be rotated**
  (console.anthropic.com → delete it → make a new one). Treat it as compromised.
- Correct places for the key: (a) the app's own ⚙︎ Settings (browser localStorage, per device),
  or (b) a server env var `ANTHROPIC_API_KEY` on a backend (Vercel) for the paid version.

---

## 4. ⛔ CURRENT BLOCKER — getting it live

The app is on `main` but **GitHub Pages has not rebuilt the site since 2026-05-21**. Pushes
made from the web sandbox did not trigger a Pages build (confirmed: latest `pages build and
deployment` run is for commit `09b9f761`, May 21). So `https://coin-maker3.github.io/ielts/`
is not live yet.

**Fix options (pick one):**
1. **Trigger a Pages build** (fastest, needs the owner's authenticated `gh`):
   ```
   gh api -X POST repos/coin-maker3/coin-maker3.github.io/pages/builds
   ```
   Then confirm: `gh api repos/coin-maker3/coin-maker3.github.io/pages/builds/latest`
   and open `https://coin-maker3.github.io/ielts/`.
2. **Add a GitHub Actions deploy workflow** so it auto-publishes on every push, and (if needed)
   set Pages Source = "GitHub Actions". This removes the manual trigger forever.
3. **Use Vercel**: the "2ww" Vercel project already auto-deploys this repo. The app would be at
   `<2ww-domain>/ielts/`. For AI marking with no per-user key, add env var `ANTHROPIC_API_KEY`
   in that Vercel project (note: re-add `api/mark.js` + `vercel.json` from the feature branch).

After it's live: open it → ⚙︎ Settings → paste the (rotated) key → Save → mark a real essay.

---

## 5. ⚠️ Constraints — do NOT break the other projects

This repo (`coin-maker3.github.io`) hosts more than this app:
- `index.html` (root) = the **Orbitra** landing page. **Do not modify.**
- `triage/` = an existing **2WW colorectal triage** tool. **Do not modify.**
- `app-ads.txt` = AdMob verification. Leave it.
- A **Vercel project named "2ww"** is connected to this same repo and auto-deploys it.

The IELTS work only **adds** the `/ielts/` folder. `vercel.json` and `api/` were intentionally
kept off `main` so the 2ww/triage deploy behaves exactly as before. If you reintroduce them,
verify the triage app still deploys.

---

## 6. Branches
- `main` — the static IELTS app (device-key mode) + Orbitra + triage. Live host = GitHub Pages.
- `claude/oet-writing-practice-app-kq5wif` — same app **plus** `api/mark.js` (Vercel serverless
  examiner proxy) and `vercel.json`. This is the basis for the future paid/backend version.

---

## 7. Roadmap (owner's intent)
1. **Now:** get it live, owner + wife test that the marking feels right and fair.
2. **Backend version:** Vercel function holds the key (env var), no per-user key; add basic
   usage caps so an open endpoint can't run up the bill.
3. **Paid product:** accounts/login + Stripe + quotas + a **time-limited "exam pass"** (best fit
   for candidates with a deadline). Cost per marked essay ≈ a few cents (Haiku ~1-2¢, Sonnet
   ~3-4¢, Opus ~6-7¢) → healthy margin with quotas.
4. **Moat:** not the tech (anyone can call Claude) but a **trusted brand in the IMG/OET niche**,
   the band-7-calibrated examiner, and the adaptive Coach that learns the individual.
5. Possible additions: **OET** (the wife's actual exam) and **IELTS General** letter task;
   typing-speed warm-up; more task variety.

Trademark note: market as independent practice, **not affiliated with IELTS/IDP/British
Council/Cambridge/OET**.

---

## 8. Suggested first terminal actions
1. Rotate the API key.
2. Trigger the Pages build (§4 option 1) and confirm `/ielts/` is live.
3. Open the app, add the key in ⚙︎ Settings, run one Task 2 essay end-to-end, sanity-check the
   band and the Upgrade Engine / Coach output.
4. Decide: stay on GitHub Pages + device key for testing, or stand up the Vercel backend (§4
   option 3) for the no-per-user-key path.
