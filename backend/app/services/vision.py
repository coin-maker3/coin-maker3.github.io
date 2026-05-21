"""Screenshot → list of tickers via Claude vision.

Handles three input shapes:
  • Webull "Top Gainers / Most Active / Watchlist" — vertical list of N tickers
  • Webull single-ticker chart view — one ticker in the header
  • Discord channel screenshots — pull every $TICKER mention from chat lines

Returns a VisionResult with a list of VisionTicker (1..N). Even chart screenshots
return a list of length 1, so the downstream triage pipeline is uniform.

Stub returns the Webull Top Gainers sample so the pipeline can be exercised
end-to-end without an API call.
"""

from __future__ import annotations

import base64
import re

from ..config import settings
from ..schemas import ScreenshotSource, VisionResult, VisionTicker


_TICKER_RE = re.compile(r"^[A-Z]{1,5}(\.[A-Z])?$")
_DISCORD_DOLLAR_TICKER_RE = re.compile(r"\$([A-Z]{1,5})\b")


async def extract_tickers(image_bytes: bytes, content_type: str) -> VisionResult:
    """STUB. Real call goes to Anthropic Messages API with image input."""
    _ = base64.b64encode(image_bytes)
    _ = content_type
    return VisionResult(
        source=ScreenshotSource.WEBULL_LIST,
        model=f"stub::{settings.vision_model}",
        tickers=[
            VisionTicker(symbol="ATPC", confidence=0.98, note="+74.64% pre-market"),
            VisionTicker(symbol="WHLR", confidence=0.98, note="+71.58% pre-market"),
            VisionTicker(symbol="SBFM", confidence=0.97, note="+55.95% pre-market"),
            VisionTicker(symbol="LIMN", confidence=0.97, note="+45.21% pre-market"),
            VisionTicker(symbol="PCLA", confidence=0.96, note="+44.28% pre-market"),
            VisionTicker(symbol="INFQ", confidence=0.95, note="+25.22% pre-market"),
            VisionTicker(symbol="QUCY", confidence=0.95, note="+25.21% pre-market"),
            VisionTicker(symbol="CODX", confidence=0.95, note="+20.50% pre-market"),
            VisionTicker(symbol="QBTS", confidence=0.94, note="+16.84% pre-market"),
        ],
    )


def validate_ticker(symbol: str) -> str:
    s = symbol.strip().upper()
    if not _TICKER_RE.match(s):
        raise ValueError(f"Implausible ticker from vision: {symbol!r}")
    return s


def extract_dollar_tickers(text: str) -> list[str]:
    """Fallback regex sweep used on Discord OCR text before sending to LLM."""
    return list(dict.fromkeys(_DISCORD_DOLLAR_TICKER_RE.findall(text)))


# Prompt sketch for the real implementation:
#
#   system: |
#     You are reading a stock-trading screenshot. The user feeds you screenshots
#     from Webull (chart view OR Market Movers list) and Discord channels.
#     Return ONLY the report_screenshot tool call. Rules:
#       • If it is a Webull "Top Gainers / Most Active / Watchlist" list, return
#         EVERY ticker visible top-to-bottom, with the pre-market % change as
#         the note when visible (e.g. "+74.64% pre-market").
#       • If it is a Webull single-ticker chart, return exactly one ticker.
#       • If it is a Discord channel, return every $TICKER mention, deduped,
#         in the order they first appear. Ignore obvious non-tickers (URLs,
#         hashtags, dollar amounts like $100).
#       • Confidence < 0.5 means "I cannot read this" — return tickers: [].
#
#   tool:
#     name: report_screenshot
#     input_schema:
#       source: enum[webull_list, webull_chart, discord, unknown]
#       tickers: array<{symbol: str, confidence: float, note: str?}>
#
#   model:    settings.vision_model       (Haiku 4.5 — fast & cheap)
#   fallback: settings.vision_fallback_model if any confidence < 0.85
