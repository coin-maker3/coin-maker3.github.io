"""StockTriage backend — pre-entry sanity check for discretionary day trades.

POST /triage  multipart image  →  ranked list of {verdict, headline, flags, snapshot}

One screenshot can carry one ticker (Webull chart) or many (Webull Top Gainers,
Discord channel). Vision returns N tickers; we triage each in parallel with a
hard per-ticker time budget and rank GO → CAUTION → NO-GO.
"""

from __future__ import annotations

import asyncio
import time
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import rules
from .schemas import (
    Flag,
    FlagCode,
    IntradaySnapshot,
    ScreenshotSource,
    Severity,
    TickerInfo,
    TriageItem,
    TriageResponse,
    Verdict,
    VisionResult,
    VisionTicker,
)
from .services import edgar, earnings, halts, intraday, news, ticker as ticker_service, vision


PER_TICKER_BUDGET_S = 4.0      # per-ticker hard ceiling
PER_FETCHER_BUDGET_S = 2.5     # per upstream call
MAX_TICKERS = 15               # cap a single screenshot's blast radius

_VERDICT_ORDER = {Verdict.GO: 0, Verdict.CAUTION: 1, Verdict.NO_GO: 2}


app = FastAPI(
    title="StockTriage",
    version="0.1.0",
    description="Pre-entry sanity check. Screenshot in → verdict out.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # single-user tool; tighten if exposed publicly
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/triage", response_model=TriageResponse)
async def triage(
    image: Annotated[UploadFile, File(description="Screenshot from Webull or Discord.")],
    source_hint: Annotated[
        ScreenshotSource | None,
        Query(description="Optional override for the vision source classifier."),
    ] = None,
) -> TriageResponse:
    started = time.perf_counter()

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(415, detail="Expected an image upload (image/png, image/jpeg).")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(400, detail="Empty upload.")

    try:
        v_result = await vision.extract_tickers(image_bytes, image.content_type)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, detail=f"Vision extraction failed: {e}") from e

    if source_hint is not None:
        v_result = VisionResult(
            source=source_hint,
            tickers=v_result.tickers,
            model=v_result.model,
            raw_text=v_result.raw_text,
        )

    if not v_result.tickers:
        raise HTTPException(422, detail="No tickers found in screenshot.")

    items = await _triage_all(v_result.tickers[:MAX_TICKERS], v_result.source)
    items.sort(key=lambda x: (_VERDICT_ORDER[x.verdict], -_gap_score(x)))

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    return TriageResponse(vision=v_result, items=items, elapsed_ms=elapsed_ms)


# ── internals ──────────────────────────────────────────────────────────────

def _gap_score(item: TriageItem) -> float:
    """Sort key tie-breaker. Bigger gap = higher rank within the same verdict."""
    g = item.snapshot.gap_pct
    if g is None and item.vision_note:
        # Parse "+74.64% pre-market" → 0.7464
        import re
        m = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", item.vision_note)
        if m:
            return float(m.group(1)) / 100.0
    return g or 0.0


async def _triage_all(
    vision_tickers: list[VisionTicker],
    source: ScreenshotSource,
) -> list[TriageItem]:
    coros = [_triage_one(vt, source) for vt in vision_tickers]
    return await asyncio.gather(*coros)


async def _triage_one(vt: VisionTicker, source: ScreenshotSource) -> TriageItem:
    try:
        symbol = vision.validate_ticker(vt.symbol)
    except ValueError as e:
        return _failed_item(vt, str(e))

    try:
        async with asyncio.timeout(PER_TICKER_BUDGET_S):
            t_info, snap, fetched_flags = await _fan_out(symbol)
    except (TimeoutError, asyncio.TimeoutError):
        return _failed_item(vt, "Upstream fetch timed out.")

    flags = list(fetched_flags)
    flags.extend(_structural_flags(t_info, snap, source))

    # Q-suffix is a free critical check — no API call needed.
    if symbol.endswith("Q") and len(symbol) >= 4:
        flags.insert(0, Flag(
            code=FlagCode.Q_SUFFIX,
            severity=Severity.CRITICAL,
            message=f"Ticker ends in Q — {symbol} is in bankruptcy proceedings.",
            source_url="https://www.sec.gov/divisions/investment/q-and-a.htm",
            source_label="SEC ticker-suffix guide",
        ))

    flags = _dedupe_flags(flags)
    verdict, headline = rules.decide(flags, t_info, snap)
    sources = sorted({f.source_url for f in flags if f.source_url})

    return TriageItem(
        verdict=verdict,
        headline=headline,
        ticker=t_info,
        snapshot=snap,
        flags=flags,
        sources=list(sources),
        vision_note=vt.note,
    )


async def _fan_out(symbol: str) -> tuple[TickerInfo, IntradaySnapshot, list[Flag]]:
    """Run resolver + all fetchers in parallel. One slow source can't sink the rest."""
    async def _bounded(coro):
        try:
            async with asyncio.timeout(PER_FETCHER_BUDGET_S):
                return await coro
        except (TimeoutError, asyncio.TimeoutError):
            return []

    t_info_task = asyncio.create_task(ticker_service.resolve(symbol))
    intraday_task = asyncio.create_task(intraday.fetch(symbol))
    edgar_task = asyncio.create_task(_bounded(edgar.check(symbol)))
    halts_task = asyncio.create_task(_bounded(halts.check(symbol)))
    news_task = asyncio.create_task(_bounded(news.check(symbol)))
    earnings_task = asyncio.create_task(_bounded(earnings.check(symbol)))

    t_info = await t_info_task
    snap, intraday_flags = await intraday_task
    edgar_flags = await edgar_task
    halt_flags = await halts_task
    news_flags = await news_task
    earnings_flags = await earnings_task

    all_flags: list[Flag] = []
    for fs in (edgar_flags, halt_flags, news_flags, earnings_flags, intraday_flags):
        all_flags.extend(fs)
    return t_info, snap, all_flags


def _structural_flags(
    t_info: TickerInfo,
    snap: IntradaySnapshot,
    source: ScreenshotSource,
) -> list[Flag]:
    """Flags derivable from the resolved ticker + snapshot alone — no extra calls."""
    out: list[Flag] = []

    if t_info.market_cap_usd is not None and t_info.market_cap_usd < 50_000_000:
        out.append(Flag(
            code=FlagCode.PENNY_MARKET_CAP,
            severity=Severity.HIGH,
            message=f"Market cap ~${t_info.market_cap_usd / 1e6:.1f}M — penny zone.",
            source_url=f"https://finance.yahoo.com/quote/{t_info.symbol}",
            source_label="Yahoo Finance",
        ))

    if t_info.avg_daily_volume is not None and t_info.avg_daily_volume < 500_000:
        out.append(Flag(
            code=FlagCode.LOW_LIQUIDITY,
            severity=Severity.HIGH,
            message=f"ADV ~{t_info.avg_daily_volume / 1000:.0f}k shares — illiquid.",
            source_url=None,
        ))

    if t_info.exchange and t_info.exchange.upper() in {"OTC", "PINK", "OTCQB", "OTCQX"}:
        out.append(Flag(
            code=FlagCode.OTC_VENUE,
            severity=Severity.HIGH,
            message=f"Listed on {t_info.exchange} — OTC venue, no real PoP.",
            source_url=None,
        ))

    if t_info.drawdown_30d is not None and t_info.drawdown_30d < -0.50:
        out.append(Flag(
            code=FlagCode.DRAWDOWN_30D,
            severity=Severity.MEDIUM,
            message=f"Down {t_info.drawdown_30d * 100:.0f}% over 30d.",
            source_url=None,
        ))

    if source is ScreenshotSource.DISCORD and (
        (t_info.market_cap_usd is not None and t_info.market_cap_usd < 100_000_000)
        or (snap.float_shares is not None and snap.float_shares < 20_000_000)
    ):
        out.append(Flag(
            code=FlagCode.SOCIAL_PUMP,
            severity=Severity.HIGH,
            message="Small-cap ticker sourced from Discord — treat as pump-and-dump until proven otherwise.",
            source_url=None,
        ))

    return out


_SEVERITY_RANK = {Severity.CRITICAL: 3, Severity.HIGH: 2, Severity.MEDIUM: 1, Severity.INFO: 0}


def _dedupe_flags(flags: list[Flag]) -> list[Flag]:
    """Keep one flag per code, preferring the higher-severity instance.
    Order of first occurrence is preserved so critical flags remain on top."""
    best: dict[FlagCode, Flag] = {}
    order: list[FlagCode] = []
    for f in flags:
        existing = best.get(f.code)
        if existing is None:
            best[f.code] = f
            order.append(f.code)
        elif _SEVERITY_RANK[f.severity] > _SEVERITY_RANK[existing.severity]:
            best[f.code] = f
    return [best[code] for code in order]


def _failed_item(vt: VisionTicker, reason: str) -> TriageItem:
    return TriageItem(
        verdict=Verdict.CAUTION,
        headline=f"{vt.symbol}: could not triage — {reason}",
        ticker=TickerInfo(symbol=vt.symbol),
        snapshot=IntradaySnapshot(),
        flags=[],
        sources=[],
        vision_note=vt.note,
    )
