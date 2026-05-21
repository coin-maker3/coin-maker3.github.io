from .schemas import Flag, FlagCode, IntradaySnapshot, Severity, TickerInfo, Verdict


CRITICAL_FLAGS = {
    FlagCode.BANKRUPTCY_FILED,
    FlagCode.DELISTING_NOTICE,
    FlagCode.TRADING_HALT,
    FlagCode.Q_SUFFIX,
    FlagCode.SEC_INVESTIGATION,
}


def _snapshot_line(snap: IntradaySnapshot) -> str:
    """One-line intraday read for the bottom of the headline."""
    parts: list[str] = []
    if snap.price is not None:
        parts.append(f"${snap.price:.2f}")
    if snap.gap_pct is not None:
        parts.append(f"gap {snap.gap_pct * 100:+.1f}%")
    if snap.rvol is not None:
        parts.append(f"RVOL {snap.rvol:.1f}×")
    if snap.atr_pct is not None:
        parts.append(f"ATR {snap.atr_pct * 100:.1f}%")
    if snap.spread_bps is not None:
        parts.append(f"spread {snap.spread_bps:.0f}bps")
    return " · ".join(parts)


def decide(
    flags: list[Flag],
    ticker: TickerInfo,
    snapshot: IntradaySnapshot,
) -> tuple[Verdict, str]:
    """Map a flag set + snapshot to a verdict and one-paragraph headline."""
    criticals = [f for f in flags if f.code in CRITICAL_FLAGS or f.severity is Severity.CRITICAL]
    highs = [f for f in flags if f.severity is Severity.HIGH]
    mediums = [f for f in flags if f.severity is Severity.MEDIUM]

    snap_line = _snapshot_line(snapshot)
    snap_suffix = f" [{snap_line}]" if snap_line else ""

    if criticals:
        primary = criticals[0]
        rest = ", ".join(f.code.value for f in criticals[1:] + highs[:2])
        tail = f" Also: {rest}." if rest else ""
        return Verdict.NO_GO, f"{primary.message}{tail} Do not enter.{snap_suffix}"

    if len(highs) >= 2:
        codes = ", ".join(f.code.value for f in highs[:3])
        return (
            Verdict.NO_GO,
            f"Multiple high-severity flags: {codes}. Skip this trade.{snap_suffix}",
        )

    if highs or len(mediums) >= 2:
        worst = (highs + mediums)[0]
        return (
            Verdict.CAUTION,
            f"{worst.message} Size down or wait for the next setup.{snap_suffix}",
        )

    return Verdict.GO, f"{ticker.symbol}: no blocking flags. Standard risk applies.{snap_suffix}"
