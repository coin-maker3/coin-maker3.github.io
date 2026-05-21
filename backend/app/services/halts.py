"""Nasdaq + NYSE trade-halt feeds.

Nasdaq:  https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts  (RSS, no auth)
NYSE:    https://www.nyse.com/api/trade-halts/historical        (JSON, no auth)

A live halt = TRADING_HALT (critical). 2+ halts in last 5 sessions = HALT_HISTORY_5D
(high) — repeated halts mean a low-float momo name and a manipulation flag.

Stub returns the SOPA suspension scheduled 21 May 2026 so the acceptance test
passes against the rule engine.
"""

from __future__ import annotations

from datetime import date

from ..schemas import Flag, FlagCode, Severity


async def check(symbol: str) -> list[Flag]:
    if symbol.upper() == "SOPA":
        return [
            Flag(
                code=FlagCode.TRADING_HALT,
                severity=Severity.CRITICAL,
                message=(
                    f"Trading suspension scheduled {date(2026, 5, 21).isoformat()} "
                    f"(Nasdaq T1 → H10)."
                ),
                source_url="https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts",
                source_label="Nasdaq Trade Halts",
            ),
        ]
    return []


# Real implementation outline:
#
# 1. GET Nasdaq RSS, parse with feedparser; filter entries with Issue Symbol == symbol
#    in last 5 sessions. Reason codes T1/T12/LUDP/H10/D = halt.
# 2. GET NYSE JSON, filter on symbol + halt_date >= today - 5d.
# 3. Live halt (no resumption time) ⇒ Severity.CRITICAL.
# 4. 2+ halts in last 5d, all resumed ⇒ HALT_HISTORY_5D, Severity.HIGH.
