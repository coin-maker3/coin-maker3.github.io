# StockTriage — backend

Pre-entry sanity check for discretionary day trades. Screenshot in → ranked
verdicts out. No auth, no DB, single-user.

## Why

When you're tired or down on the day, a 30-second news check is the difference
between SOPA-the-bagholder and SOPA-the-skipped. This service automates that
30-second check.

## What it does

`POST /triage` accepts an image (Webull Top Gainers, Webull chart, or a Discord
channel screenshot) and returns a ranked list of per-ticker verdicts:

```
GO       — no blocking flags, standard risk
CAUTION  — one high or multiple medium flags
NO-GO    — any critical flag (bankruptcy / delisting / halt / Q-suffix / SEC
           investigation) OR 2+ high-severity flags
```

Each verdict carries:
- `headline` — 2–3 lines, no hedging
- `snapshot` — price, gap%, RVOL, ATR%, spread, float, short interest, SSR
- `flags[]` — every fired check with its citation URL
- `sources[]` — deduped list of source URLs to verify in 5 seconds

## Pipeline

```
image ──► vision (Claude Haiku 4.5)   ──► list of tickers
              │
              ▼
   for each ticker, in parallel:
              │
   ┌──────────┼──────────┬──────────┬──────────┬──────────┐
   ▼          ▼          ▼          ▼          ▼          ▼
 yfinance   EDGAR     halts     news      earnings   intraday
 (info)     (8-K)     (RSS)     (Alpaca)  (yfinance) (yf+Alpaca)
   │          │          │          │          │          │
   └──────────┴──────────┴──────────┴──────────┴──────────┘
                            │
                            ▼
                       RuleEngine
                            │
                            ▼
                     ranked TriageItems
```

Hard budgets: 2.5s per upstream call, 4s per ticker, parallel across tickers.

## Data sources

| Check | Source | Cost |
|---|---|---|
| Bankruptcy (Chapter 11) | SEC EDGAR 8-K Item 1.03 | free |
| Delisting notice | SEC EDGAR 8-K Item 3.01 | free |
| Going concern | SEC EDGAR 10-K/10-Q MD&A | free |
| Trading halt | Nasdaq + NYSE halt feeds | free |
| Q-suffix | derived from ticker | free |
| ATM offering / secondary | SEC EDGAR S-3 / 424B5 / 8-K 1.01 | free |
| Insider sales | SEC EDGAR Form 4 | free |
| Market cap, ADV, exchange | yfinance | free |
| Gap, RVOL, ATR | yfinance | free |
| Bid/ask spread | Alpaca quotes | free (paper) |
| Short interest % float | yfinance / Finnhub | free |
| Float shares | yfinance | free |
| SSR active | Nasdaq SSR list | free |
| Earnings date | yfinance calendar | free |
| News sweep (soft) | Alpaca News API | free (paper) |

No paid keys required.

## Vision model

`claude-haiku-4-5-20251001` — fastest image-input Claude, ~$0.0005 per
screenshot, ~600ms P50. Falls back to `claude-sonnet-4-6` only when Haiku
returns confidence < 0.85 on any ticker.

## Local dev

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
```

Probe the stub end-to-end (no API key needed — services are stubbed):

```bash
curl -F "image=@some.jpg" http://localhost:8000/triage
```

Run the SOPA acceptance test:

```bash
pytest
```

## Deployment

Railway, same pattern as PulseTrader.
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`
Set `ANTHROPIC_API_KEY`, `ALPACA_API_KEY`, `ALPACA_API_SECRET`,
`SEC_EDGAR_USER_AGENT` (your email) in the Railway env.

## What's stubbed in v0.1

All upstream fetchers (`vision`, `ticker`, `edgar`, `halts`, `news`,
`earnings`, `intraday`) return canned data shaped exactly like the real
responses so the rule engine, orchestrator, and SOPA acceptance test all
pass end-to-end without network. Each stub file has a `Real implementation
outline` block at the bottom — fill them in next session.

## SOPA acceptance test

`tests/test_rules.py::test_sopa_is_no_go` pins the canonical failure case
(Chapter 11 12 May, delisting 14 May, halt 21 May 2026). If this ever
returns anything other than `NO-GO`, the build is broken — period.
