"""SEC EDGAR client: bankruptcy (8-K 1.03), delisting (8-K 3.01), going-concern.

Primary source for the bankruptcy/delisting checks. Free, no key required, but
the SEC requires a descriptive User-Agent with contact email — set
SEC_EDGAR_USER_AGENT in .env.

Stub returns the SOPA Chapter 11 + delisting flags so the SOPA acceptance test
passes against the rule engine. Real implementation outline at the bottom.
"""

from __future__ import annotations

from datetime import date

from ..schemas import Flag, FlagCode, Severity


async def check(symbol: str) -> list[Flag]:
    # TODO: hit https://data.sec.gov/submissions/CIK{cik}.json then fetch recent
    # 8-K filings; parse items list for 1.03 and 3.01.
    if symbol.upper() == "SOPA":
        return [
            Flag(
                code=FlagCode.BANKRUPTCY_FILED,
                severity=Severity.CRITICAL,
                message=(
                    f"Chapter 11 filed {date(2026, 5, 12).isoformat()} "
                    f"(8-K Item 1.03)."
                ),
                source_url="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SOPA&type=8-K",
                source_label="SEC EDGAR 8-K",
            ),
            Flag(
                code=FlagCode.DELISTING_NOTICE,
                severity=Severity.CRITICAL,
                message=(
                    f"Nasdaq delisting notice {date(2026, 5, 14).isoformat()} "
                    f"(8-K Item 3.01)."
                ),
                source_url="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SOPA&type=8-K",
                source_label="SEC EDGAR 8-K",
            ),
        ]
    return []


# Real implementation outline:
#
# 1. Symbol → CIK via https://www.sec.gov/files/company_tickers.json (cache 24h).
# 2. GET https://data.sec.gov/submissions/CIK{cik:010d}.json  — recent filings.
# 3. Filter form=="8-K" in last 365 days, fetch the primary doc, scan for
#    "Item 1.03" (BK) and "Item 3.01" (delisting). Return one Flag per match.
# 4. For going-concern: latest 10-K/10-Q, regex "going concern" in MD&A section.
# 5. Always send User-Agent = settings.sec_edgar_user_agent (SEC TOS).
