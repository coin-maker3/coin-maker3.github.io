from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Verdict(str, Enum):
    GO = "GO"
    CAUTION = "CAUTION"
    NO_GO = "NO-GO"


class Severity(str, Enum):
    CRITICAL = "critical"   # any one ⇒ NO-GO
    HIGH = "high"           # 1 ⇒ CAUTION, 2+ ⇒ NO-GO
    MEDIUM = "medium"       # 2+ ⇒ CAUTION
    INFO = "info"           # surfaced but does not move verdict


class ScreenshotSource(str, Enum):
    WEBULL_LIST = "webull_list"     # Top Gainers / Most Active / watchlist
    WEBULL_CHART = "webull_chart"   # single-ticker chart view
    DISCORD = "discord"             # chat channel with $TICKER mentions
    UNKNOWN = "unknown"


class FlagCode(str, Enum):
    # ── company-killer flags (critical) ──
    BANKRUPTCY_FILED = "bankruptcy_filed"
    DELISTING_NOTICE = "delisting_notice"
    TRADING_HALT = "trading_halt"
    Q_SUFFIX = "q_suffix_ticker"
    SEC_INVESTIGATION = "sec_investigation"
    GOING_CONCERN = "going_concern"
    # ── structural red flags (high) ──
    ACTIVE_ATM_OFFERING = "active_atm_offering"     # dilution machine
    RECENT_SECONDARY = "recent_secondary_offering"   # priced offering in last 7d
    REVERSE_SPLIT_RECENT = "reverse_split_recent"
    PENNY_MARKET_CAP = "penny_market_cap"            # < $50M
    LOW_LIQUIDITY = "low_liquidity"                  # ADV < 500k or spread > 1%
    OTC_VENUE = "otc_venue"
    HALT_HISTORY_5D = "halt_history_5d"              # 2+ halts in last 5 sessions
    SOCIAL_PUMP = "social_pump_candidate"            # Discord + low float + penny
    # ── intraday context (medium) ──
    DRAWDOWN_30D = "drawdown_30d"                    # > 50% down, no catalyst
    EARNINGS_24H = "earnings_within_24h"
    SSR_ACTIVE = "ssr_active"                        # SEC Rule 201 in force
    GAP_OVER_20 = "gap_over_20pct"
    RVOL_EXTREME = "rvol_extreme"                    # > 10× avg, late entry risk
    HIGH_SHORT_INTEREST = "high_short_interest"      # > 20% float (squeeze risk)
    INSIDER_SELLING = "insider_selling_form4"        # recent Form 4 sales
    # ── informational (info) ──
    LOW_FLOAT = "low_float"
    WIDE_SPREAD = "wide_spread"


class Flag(BaseModel):
    code: FlagCode
    severity: Severity
    message: str = Field(..., description="Plain-English, one line.")
    source_url: str | None = Field(None, description="Primary citation for this flag.")
    source_label: str | None = None


class IntradaySnapshot(BaseModel):
    """The numbers a day trader reads in the first 5 seconds."""
    price: float | None = None
    gap_pct: float | None = Field(None, description="Open vs prior close, as decimal.")
    rvol: float | None = Field(None, description="Today's volume / 30d avg.")
    atr_pct: float | None = Field(None, description="14-day ATR as % of price.")
    spread_bps: float | None = Field(None, description="Bid/ask spread in basis points.")
    short_interest_pct_float: float | None = None
    float_shares: float | None = None
    ssr_active: bool | None = None


class TickerInfo(BaseModel):
    symbol: str
    exchange: str | None = None
    name: str | None = None
    market_cap_usd: float | None = None
    avg_daily_volume: float | None = None
    last_close: float | None = None
    drawdown_30d: float | None = Field(None, description="Negative number, e.g. -0.62")


class VisionTicker(BaseModel):
    symbol: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    note: str | None = Field(None, description="e.g. '+74.64% pre-market' if visible")


class VisionResult(BaseModel):
    source: ScreenshotSource
    tickers: list[VisionTicker]
    model: str
    raw_text: str | None = Field(None, description="OCR'd text block for debugging.")


class TriageItem(BaseModel):
    """One ticker's verdict — the unit a day trader scans."""
    verdict: Verdict
    headline: str
    ticker: TickerInfo
    snapshot: IntradaySnapshot
    flags: list[Flag]
    sources: list[str] = Field(default_factory=list)
    # Pre-market hint surfaced by vision (e.g. "+74.64%") so we can rank even
    # before yfinance fills in the real number.
    vision_note: str | None = None


class TriageResponse(BaseModel):
    """Top-level response. Always a list — single-ticker chart screenshots
    just return a list of length 1."""
    vision: VisionResult
    items: list[TriageItem] = Field(
        ..., description="Sorted: GO first, then CAUTION, then NO-GO."
    )
    elapsed_ms: int


class TriageError(BaseModel):
    detail: str
    stage: Literal["vision", "resolve", "fetch", "rules"]
