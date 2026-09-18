#!/usr/bin/env python3
"""Export a stock snapshot for the static GitHub Pages UI."""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
DOCS = REPO / "docs"

sys.path.insert(0, str(ROOT))

from market_prices import fetch_market_prices  # noqa: E402
from service import StockCheckResult, run_stock_check  # noqa: E402


def serialize(result: StockCheckResult) -> dict:
    return {
        "checked_at": result.checked_at,
        "part_numbers": result.part_numbers,
        "models": result.models,
        "errors": result.errors,
        "summary": result.summary,
        "source": "github-actions",
    }


def main() -> int:
    DOCS.mkdir(parents=True, exist_ok=True)
    result = run_stock_check(
        {
            "location": "Central",
            "store_number": None,
            "models": "all",
            "check_pickup": True,
            "check_online_delivery": True,
            "filters": {"storage_gb": [], "colors": []},
        }
    )
    payload = serialize(result)
    try:
        market = fetch_market_prices(force=True)
        payload["market_prices"] = market.get("prices") or {}
        payload["market_updated_at"] = market.get("updated_at")
        payload["market_source"] = market.get("source")
    except Exception as error:
        print(f"market prices skipped: {error}")
    out = DOCS / "stock.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {out} · variants={payload['summary'].get('variant_count')} "
        f"pickup={payload['summary'].get('pickup_available')} "
        f"stores={payload['summary'].get('stores_checked')}"
    )
    sys.path.insert(0, str(DOCS))
    from build_site import build  # noqa: E402

    built = build()
    print(f"Rebuilt {built}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
