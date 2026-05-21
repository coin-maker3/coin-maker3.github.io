"""Day-trader intraday snapshot: gap, RVOL, ATR, spread, SSR, short interest, float.

These are the numbers you read in the first 5 seconds. They are surfaced in the
IntradaySnapshot block AND used to fire structural flags (low float, wide spread,
extreme RVOL, SSR active, high short interest).

Stub returns plausible numbers for the SOPA case and modest defaults otherwise so
the rule engine and frontend rendering can be exercised end-to-end.

Data sources for the real impl:
  • yfinance.Ticker(symbol).fast_info  → last_price, prev_close, ten_day_avg_vol
  • yfinance.Ticker(symbol).history     → today's volume, ATR(14)
  • Alpaca v2/stocks/{symbol}/quotes/latest → bid/ask spread
  • SSR list: https://listingcenter.nasdaq.com/rulebook/nasdaq/rules → /api/SSRList
    or NYSE: https://www.nyse.com/api/regulatory/short-sale-restrictions
  • Short interest % float: Finnhub /stock/short-interest (bi-monthly) or
    yfinance.Ticker(symbol).info["shortPercentOfFloat"]
  • Float: yfinance.Ticker(symbol).info["floatShares"]
"""

from __future__ import annotations

from ..schemas import Flag, FlagCode, IntradaySnapshot, Severity


async def fetch(symbol: str) -> tuple[IntradaySnapshot, list[Flag]]:
    s = symbol.upper()
    if s == "SOPA":
        snap = IntradaySnapshot(
            price=0.31,
            gap_pct=-0.42,
            rvol=14.8,
            atr_pct=0.31,
            spread_bps=320.0,
            short_interest_pct_float=0.08,
            float_shares=7_800_000.0,
            ssr_active=True,
        )
        return snap, [
            Flag(
                code=FlagCode.LOW_FLOAT,
                severity=Severity.INFO,
                message="Float ~7.8M shares — moves on small order flow.",
                source_url=f"https://finance.yahoo.com/quote/{s}/key-statistics",
                source_label="Yahoo key stats",
            ),
            Flag(
                code=FlagCode.WIDE_SPREAD,
                severity=Severity.INFO,
                message="Bid/ask spread 320bps — illiquid, slippage will eat edge.",
                source_url=None,
            ),
        ]
    return IntradaySnapshot(), []


# Flag thresholds the real impl will enforce:
#
#   float_shares < 10M                          → LOW_FLOAT (info)
#   spread_bps > 100                            → WIDE_SPREAD (info)
#   spread_bps > 200 OR ADV < 500k              → LOW_LIQUIDITY (high)
#   ssr_active == True                          → SSR_ACTIVE (medium)
#   abs(gap_pct) > 0.20                         → GAP_OVER_20 (medium)
#   rvol > 10                                   → RVOL_EXTREME (medium, late entry)
#   short_interest_pct_float > 0.20             → HIGH_SHORT_INTEREST (medium)
