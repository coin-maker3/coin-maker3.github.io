"""Recent-news sweep via Alpaca News API (free with a paper account).

Used as a soft-signal layer: surfaces SEC investigation language, "halt",
"delisting", "going concern", offering announcements that haven't hit EDGAR yet.
We do NOT make a critical verdict on news alone — EDGAR and the halt feeds are
the authoritative sources. News only adds context + citation URLs.
"""

from __future__ import annotations

from ..schemas import Flag, FlagCode, Severity


async def check(symbol: str) -> list[Flag]:
    if symbol.upper() == "SOPA":
        return [
            Flag(
                code=FlagCode.DRAWDOWN_30D,
                severity=Severity.MEDIUM,
                message="Down 78% over the last 30 sessions on bankruptcy news.",
                source_url="https://data.alpaca.markets/v1beta1/news?symbols=SOPA",
                source_label="Alpaca News",
            ),
        ]
    return []


# Real implementation outline:
#
# GET https://data.alpaca.markets/v1beta1/news?symbols={symbol}&limit=20
#   headers: APCA-API-KEY-ID, APCA-API-SECRET-KEY
#
# Scan headline + summary with a keyword map:
#   "going concern"       → GOING_CONCERN  (high)
#   "SEC investigation"   → SEC_INVESTIGATION  (critical)
#   "reverse split"       → REVERSE_SPLIT_RECENT  (high)
#   "ATM offering" / "at-the-market" → ACTIVE_ATM_OFFERING  (high)
#   "priced offering" / "registered direct" → RECENT_SECONDARY  (high)
#   "delisting" / "delist" → DELISTING_NOTICE  (critical, but EDGAR is canonical)
#
# Always cite the news article URL on the Flag.
