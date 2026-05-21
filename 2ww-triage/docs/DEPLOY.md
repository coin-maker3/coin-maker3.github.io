# Deployment guide (testing)

Two deployments are useful during the pilot phase.

## A. GitHub Pages (current — clinician-only, no patient form)

What's already live at `https://coin-maker3.github.io/triage/`.

- Static build pushed to `main:/triage/`
- No backend; the "Import patient submission" panel is non-functional here
- Useful for surgeons to play with the algorithm before the patient form
  is involved

Rebuild and redeploy:
```
cd 2ww-triage
npx vite build --base=/triage/
rm -rf ../triage && cp -r dist ../triage   # if you're at repo root
git add ../triage && git commit && git push
```

## B. Vercel (testing — full patient + clinician workflow)

This is what enables the patient form to actually receive submissions and
the clinician to import them by reference.

### One-time setup (5 minutes)

From the `2ww-triage/` folder on your laptop:

```
# 1. Install Vercel CLI globally (one-time)
npm i -g vercel

# 2. Log in (browser pops open)
vercel login

# 3. Link this folder to a new Vercel project
vercel link
# When asked: scope=your-vercel-account, project=2ww-triage (or whatever name)

# 4. Create the KV store for storing patient submissions
vercel kv create twoww-submissions --region lhr1
# (lhr1 = London. Use fra1 if lhr1 unavailable — both are EEA.)

# 5. Link the KV store to the project
vercel kv connect twoww-submissions
# Choose: All Environments

# 6. Set the testing-only safety env var
vercel env add PILOT_REQUIRE_TEST_PREFIX
# When prompted, enter: 1
# Environments: Production, Preview, Development
```

### Deploy

```
vercel deploy --prod
```

You'll get a URL like `https://2ww-triage-xxx.vercel.app/`.

### How to use it

1. Open the URL — that's the clinician view
2. Click "Generate reference" — gives you e.g. `TEST-AB12-CD34` and a link
3. Open that link on your phone (or send to a colleague) — the patient view
4. Fill the form, submit
5. On the clinician side, click "Import…" and paste the reference

Data lives in Vercel KV (London region) and auto-expires after 48 hours.

### Cost

- Hobby tier: free
- KV: 30k requests/month free — this pilot won't come close
- Estimated monthly: **£0** during testing

### Privacy reminder

- The `PILOT_REQUIRE_TEST_PREFIX=1` env var enforces that all references
  start with `TEST-`. Real NHS numbers will be rejected. This is the
  testing-only guardrail.
- Once production governance is cleared (DPIA, DCB0129/0160, CSO sign-off,
  NHS Login wired up), remove this env var and switch to the production
  identity model described in `DESIGN.md`.
- The repo is currently **public**. Before any clinical use beyond
  testing, move it to a private repo (see earlier conversation).

## C. Other hosting options (equivalents)

| Host         | KV equivalent          | Notes                          |
|--------------|------------------------|--------------------------------|
| Cloudflare Pages | Workers KV         | UK edge; same `api/` works with minor edits |
| Railway      | Postgres / Redis       | You already have a sub         |
| Fly.io       | Upstash Redis          | LHR region available           |
| AWS UK       | DynamoDB / ElastiCache | For the production Phase 3+    |

Vercel + Vercel KV is the most direct match because:

- You already have a Vercel subscription
- KV is automatically EEA-resident in `lhr1` or `fra1`
- Zero infrastructure to manage during testing
- Easy to swap to AWS UK later when production governance demands it
