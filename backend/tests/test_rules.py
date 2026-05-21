"""The SOPA acceptance test: 20 May 2026 must come back NO-GO.

This pins the rule engine's behaviour for the canonical failure case the whole
app exists to prevent. If this ever returns anything other than NO-GO, the
build is broken — period.
"""

from app.rules import decide
from app.schemas import (
    Flag,
    FlagCode,
    IntradaySnapshot,
    Severity,
    TickerInfo,
    Verdict,
)


def _sopa_flags() -> list[Flag]:
    return [
        Flag(
            code=FlagCode.BANKRUPTCY_FILED,
            severity=Severity.CRITICAL,
            message="Chapter 11 filed 2026-05-12 (8-K Item 1.03).",
            source_url="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SOPA&type=8-K",
        ),
        Flag(
            code=FlagCode.DELISTING_NOTICE,
            severity=Severity.CRITICAL,
            message="Nasdaq delisting notice 2026-05-14 (8-K Item 3.01).",
            source_url="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SOPA&type=8-K",
        ),
        Flag(
            code=FlagCode.TRADING_HALT,
            severity=Severity.CRITICAL,
            message="Trading suspension scheduled 2026-05-21 (Nasdaq T1 → H10).",
            source_url="https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts",
        ),
    ]


def _sopa_ticker() -> TickerInfo:
    return TickerInfo(
        symbol="SOPA",
        exchange="NASDAQ",
        name="Society Pass Inc.",
        market_cap_usd=2_400_000.0,
        avg_daily_volume=180_000.0,
        last_close=0.31,
        drawdown_30d=-0.78,
    )


def _sopa_snapshot() -> IntradaySnapshot:
    return IntradaySnapshot(price=0.31, gap_pct=-0.42, rvol=14.8)


def test_sopa_is_no_go():
    verdict, headline = decide(_sopa_flags(), _sopa_ticker(), _sopa_snapshot())
    assert verdict is Verdict.NO_GO
    assert "Chapter 11" in headline
    assert "Do not enter" in headline


def test_clean_ticker_is_go():
    ticker = TickerInfo(
        symbol="AAPL",
        exchange="NASDAQ",
        market_cap_usd=3_500_000_000_000.0,
        avg_daily_volume=60_000_000.0,
    )
    verdict, _ = decide([], ticker, IntradaySnapshot(price=240.0, rvol=0.9))
    assert verdict is Verdict.GO


def test_two_highs_become_no_go():
    ticker = TickerInfo(symbol="XYZ", market_cap_usd=10_000_000.0)
    flags = [
        Flag(
            code=FlagCode.PENNY_MARKET_CAP,
            severity=Severity.HIGH,
            message="Market cap ~$10M — penny zone.",
        ),
        Flag(
            code=FlagCode.LOW_LIQUIDITY,
            severity=Severity.HIGH,
            message="ADV ~120k shares — illiquid.",
        ),
    ]
    verdict, _ = decide(flags, ticker, IntradaySnapshot())
    assert verdict is Verdict.NO_GO


def test_single_high_is_caution():
    ticker = TickerInfo(symbol="XYZ", market_cap_usd=10_000_000.0)
    flags = [
        Flag(
            code=FlagCode.PENNY_MARKET_CAP,
            severity=Severity.HIGH,
            message="Market cap ~$10M — penny zone.",
        ),
    ]
    verdict, _ = decide(flags, ticker, IntradaySnapshot())
    assert verdict is Verdict.CAUTION
