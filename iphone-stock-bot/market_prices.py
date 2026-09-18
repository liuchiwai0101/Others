"""Fetch 先達 market prices from iPhonePriceHK."""

from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
from typing import Any

PRICE_URL = "https://www.iphonepricehk.com/iphone-18-pro-max-duo-price"

_MODEL_FROM_CELL = {
    "iphone-18-pro-max": "18-pro-max",
    "iphone-18-pro": "18-pro",
    "iphone-duo": "duo",
}
_MODEL_FROM_SIZE = {"細": "18-pro", "大": "18-pro-max", "摺": "duo"}
_COLOR_STD = {"黑": "Black", "銀": "Silver", "藍": "Glacier", "紅": "Burgundy", "白": "Star White"}
_COLOR_DUO = {"黑": "Night Sky", "白": "Star White"}

_CELL_ID_RE = re.compile(
    r'data-price-cell-id="(iphone-(?:18-pro-max|18-pro|duo))-([細大摺][黑銀藍紅白])-(256GB|512GB|1TB|2TB)"'
)
_LINE_RE = re.compile(
    r"(細|大|摺)\s*(黑|銀|藍|紅|白)\s*(256|512|1TB|2TB)\s*\$([0-9,]+)\s*(?:\(([+\-−+$0-9]+)\))?"
)
_UPDATED_RE = re.compile(r"截至\s*([0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2})")
_PRICE_RE = re.compile(r"price-cell-price[^>]*>\$([0-9,]+)")
_FALLBACK_PRICE_RE = re.compile(r"\$([0-9,]{4,6})")
_DELTA_RE = re.compile(r"\(([+\-−]*\$?[0-9,]+)\)")
_COMMENT_RE = re.compile(r"<!--.*?-->")

_CACHE: dict[str, Any] = {"at": 0.0, "payload": None}


def price_key(model_id: str, storage: str, color: str) -> str:
    return f"{model_id}|{storage}|{color}"


def _storage_label(token: str) -> str:
    token = token.upper().replace(" ", "")
    if token in {"256", "256GB"}:
        return "256GB"
    if token in {"512", "512GB"}:
        return "512GB"
    if token in {"1TB", "1024GB"}:
        return "1TB"
    if token in {"2TB", "2048GB"}:
        return "2TB"
    return token


def _color_name(model_id: str, color_code: str) -> str | None:
    if model_id == "duo":
        return _COLOR_DUO.get(color_code)
    return _COLOR_STD.get(color_code)


def _parse_delta(raw: str | None) -> int | None:
    if not raw:
        return None
    cleaned = raw.replace("−", "-").replace("$", "").replace(",", "").replace("+", "")
    if raw.replace("−", "-").strip().startswith("-") or cleaned.startswith("-"):
        sign = -1
        cleaned = cleaned.replace("-", "")
    else:
        sign = 1
    if not cleaned.isdigit():
        return None
    return sign * int(cleaned)


def _put(
    prices: dict[str, dict[str, int | None]],
    model_id: str,
    storage: str,
    color: str | None,
    amount: int,
    delta: int | None,
    overwrite: bool,
) -> None:
    if not model_id or not color:
        return
    key = price_key(model_id, storage, color)
    if key in prices and not overwrite:
        return
    prices[key] = {"price": amount, "delta": delta}


def parse_market_prices(text: str) -> dict[str, Any]:
    prices: dict[str, dict[str, int | None]] = {}
    html = text or ""

    for match in _CELL_ID_RE.finditer(html):
        model_token, code, storage = match.groups()
        model_id = _MODEL_FROM_CELL.get(model_token)
        chunk = _COMMENT_RE.sub("", html[match.end() : match.end() + 900])
        price_match = _PRICE_RE.search(chunk) or _FALLBACK_PRICE_RE.search(chunk)
        if not model_id or not price_match:
            continue
        amount = int(price_match.group(1).replace(",", ""))
        delta_match = _DELTA_RE.search(chunk[price_match.end() : price_match.end() + 220])
        delta = _parse_delta(delta_match.group(1) if delta_match else None)
        _put(prices, model_id, storage, _color_name(model_id, code[1]), amount, delta, True)

    for size_code, color_code, storage_token, amount_raw, delta_raw in _LINE_RE.findall(html):
        model_id = _MODEL_FROM_SIZE.get(size_code)
        storage = _storage_label(storage_token)
        amount = int(amount_raw.replace(",", ""))
        _put(
            prices,
            model_id or "",
            storage,
            _color_name(model_id or "", color_code),
            amount,
            _parse_delta(delta_raw),
            overwrite=False,
        )

    updated = None
    updated_match = _UPDATED_RE.search(html)
    if updated_match:
        updated = updated_match.group(1)
    return {"prices": prices, "updated_at": updated, "source": PRICE_URL}


def fetch_price_page(timeout: int = 12) -> str:
    request = urllib.request.Request(
        PRICE_URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148"
            ),
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", "replace")


def fetch_market_prices(*, force: bool = True, cache_seconds: float = 45) -> dict[str, Any]:
    now = time.time()
    cached = _CACHE.get("payload")
    if not force and cached and now - float(_CACHE.get("at") or 0) < cache_seconds:
        return cached
    try:
        payload = parse_market_prices(fetch_price_page())
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        if cached:
            return cached
        raise RuntimeError(f"market prices unavailable: {error}") from error
    if payload.get("prices"):
        _CACHE["at"] = now
        _CACHE["payload"] = payload
        return payload
    if cached:
        return cached
    return payload
