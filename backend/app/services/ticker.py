"""yfinance lookups: market cap, ADV, exchange, last close, drawdown.

Stub returns realistic SOPA-shaped data so the rule engine can be tested without
a network round-trip. Replace `resolve` with a real yfinance call.
"""

from __future__ import annotations

from ..schemas import TickerInfo


async def resolve(symbol: str) -> TickerInfo:
    # TODO: yfinance.Ticker(symbol).fast_info / .history(period="30d")
    return TickerInfo(
        symbol=symbol,
        exchange="NASDAQ",
        name="Society Pass Inc.",
        market_cap_usd=2_400_000.0,   # well under $50M ⇒ penny zone
        avg_daily_volume=180_000.0,
        last_close=0.31,
        drawdown_30d=-0.78,
    )
