# Deploying the 2WW Triage Aid

Two ways to host this. Pick **B** — it's simpler and needs no CLI or token sharing.

## A. GitHub Pages (current — read-only clinician demo)

Live at `https://coin-maker3.github.io/triage/`. Static build, no backend, so:
- Patient form submission doesn't work
- "Import patient submission" doesn't work
- Audit module doesn't work (no storage)

Only useful as a clinician-side demo of the algorithm.

## B. Vercel via GitHub UI (recommended — full app + audit)

**No CLI. No tokens. Three minutes of clicking.**

### One-time setup

1. Open **https://vercel.com/new** in a browser, signed in to your Vercel account
2. Click **Import Git Repository** → connect GitHub if not already → pick `coin-maker3/coin-maker3.github.io`
3. **Configure Project**:
   - Project Name: `2ww-triage` (or whatever)
   - Framework Preset: Vite (auto-detected)
   - **Root Directory: `2ww-triage`** ← important; click Edit to set this
   - Click **Deploy**
4. Wait ~1 minute for the first build. You'll get a URL like `https://2ww-triage-xxx.vercel.app/`
5. In the project → **Storage** tab → **Create Database** → **KV** → name `twoww-kv`, region `lhr1` (London) → **Connect to Project**. The `KV_*` env vars are added automatically.
6. In the project → **Settings** → **Environment Variables**:
   - Add `PILOT_REQUIRE_TEST_PREFIX` = `1` for **Production**, **Preview** and **Development**
7. In the project → **Deployments** tab → most recent → ⋯ → **Redeploy** (so the build picks up the new env vars)

### Set the production branch (one-time)

If the Vercel project defaulted to deploying `main` instead of the feature branch:

- Settings → **Git** → **Production Branch** → set to `claude/general-session-iea8E` (or merge the branch to `main` first)

### From then on

Every `git push` to the production branch auto-deploys. You never need to touch the CLI.

### URLs the team will use

| Audience | URL |
|---|---|
| Clinician (you) | `https://2ww-triage-xxx.vercel.app/` |
| Patient pre-clinic form | `https://2ww-triage-xxx.vercel.app/#/patient?ref=TEST-ABC` |
| FY1 audit dashboard | `https://2ww-triage-xxx.vercel.app/#/audit` |
| FY1 enter new audit case | `https://2ww-triage-xxx.vercel.app/#/audit/new` |

### Cost

- **Vercel Hobby:** free
- **KV (Upstash):** 30k commands/month free — audit pilot will use far less
- **Estimated monthly:** £0

### Privacy safeguards on Vercel

- All data sits on **Vercel KV** in `lhr1` (London) — UK soil
- Encrypted at rest (KMS) and in transit (TLS 1.3)
- `PILOT_REQUIRE_TEST_PREFIX=1` env var enforces all references start with `TEST-` so real NHS numbers can't be used during testing
- Patient submissions auto-expire after 48 hours
- Audit cases retained until you remove them (planned for the duration of the audit + Trust 7-year retention)
- No PID flows into the system by design — the form has no name / DOB / NHS-number fields

### When you go to production (post-IG sign-off)

- Remove `PILOT_REQUIRE_TEST_PREFIX` env var
- Wire in NHS Login for the patient form
- Wire in CIS2 / NHSmail for clinician auth
- Migrate KV → AWS UK (per `DESIGN.md`) when scale requires it

## C. Cloudflare Pages / Railway / Render — alternatives

Same code works on any of these. Vercel + Vercel KV is recommended only because:
- You already have a Vercel account
- KV is auto-provisioned in London with a click
- GitHub integration deploys on every push without CLI faff

## Local development

```bash
cd 2ww-triage
npm install
npm run dev          # http://localhost:5173/
npm run test:run     # unit tests
npm run smoke:local  # E2E smoke against local build
```

Local dev uses an in-memory KV (data dies when the dev server restarts) so you don't need to set up anything to develop.
