"""Earnings calendar check.

Day-trader risk: holding through an earnings release is gambling, not trading.
Flag anything reporting in the next 24h.

Stub returns no flags. Real impl uses yfinance.Ticker(symbol).calendar or
Finnhub /stock/earnings.
"""

from __future__ import annotations

from ..schemas import Flag


async def check(symbol: str) -> list[Flag]:
    _ = symbol
    return []


# Real implementation outline:
#
#   t = yf.Ticker(symbol)
#   cal = t.calendar  # DataFrame with 'Earnings Date'
#   if next earnings date is within 24h:
#       return [Flag(code=EARNINGS_24H, severity=MEDIUM,
#                    message=f"Earnings on {dt.isoformat()} — binary risk.",
#                    source_url=f"https://finance.yahoo.com/calendar/earnings?symbol={symbol}")]
