"""Apple Store Hong Kong availability API client."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
# Hong Kong Apple Online Store only
BASE_URL = "https://www.apple.com/hk/shop"


class StockStatus(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    INELIGIBLE = "ineligible"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class PickupResult:
    part_number: str
    status: StockStatus
    quote: str
    available_when: str
    product_title: str
    store_name: str
    store_number: str
    city: str
    state: str
    store_url: str = ""


@dataclass(frozen=True)
class DeliveryResult:
    part_number: str
    status: StockStatus
    delivery_date: str
    product_title: str


@dataclass(frozen=True)
class ApiError:
    part_number: str
    reason: str


def _request(url: str) -> tuple[int, dict[str, Any] | None, str | None]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8")
            if not raw.strip():
                return response.status, None, "empty response body"
            return response.status, json.loads(raw), None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:200]
        return exc.code, None, f"HTTP {exc.code}: {body}"
    except urllib.error.URLError as exc:
        return 0, None, f"network error: {exc.reason}"
    except json.JSONDecodeError as exc:
        return 200, None, f"invalid JSON: {exc.msg}"


def _pickup_status(raw: str | None) -> StockStatus:
    if raw == "available":
        return StockStatus.AVAILABLE
    if raw == "unavailable":
        return StockStatus.UNAVAILABLE
    if raw == "ineligible":
        return StockStatus.INELIGIBLE
    return StockStatus.UNKNOWN


_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_MONTHS = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
}


def _pickup_date(availability: dict[str, Any], regular: dict[str, Any]) -> str:
    quote = (availability.get("pickupSearchQuote") or "").strip()
    store_quote = (regular.get("storePickupQuote") or "").strip()

    if quote.lower().startswith("available "):
        return quote[len("Available ") :].strip()
    if quote and quote.lower() not in {"currently unavailable", "unavailable"}:
        return quote

    # e.g. "Today at Apple ifc mall" / "Sun 20 Sept at Apple ifc mall"
    if " at Apple " in store_quote:
        return store_quote.split(" at Apple ", 1)[0].strip()
    if store_quote.lower().startswith("today"):
        return "Today"
    return quote or store_quote or ""


def _encoded_pickup_datetime(store: dict[str, Any]) -> datetime | None:
    raw = str(store.get("pickupEncodedUpperDateString") or "").strip()
    if len(raw) == 8 and raw.isdigit():
        return datetime.strptime(raw, "%Y%m%d")
    return None


def _expand_store_days(text: str) -> set[str]:
    cleaned = (text or "").replace(":", "").strip()
    days: set[str] = set()
    if not cleaned:
        return days
    for chunk in cleaned.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            start_text, end_text = [part.strip()[:3].title() for part in chunk.split("-", 1)]
            if start_text in _WEEKDAYS and end_text in _WEEKDAYS:
                start = _WEEKDAYS.index(start_text)
                end = _WEEKDAYS.index(end_text)
                if start <= end:
                    days.update(_WEEKDAYS[start : end + 1])
                else:
                    days.update(_WEEKDAYS[start:] + _WEEKDAYS[: end + 1])
            continue
        day = chunk[:3].title()
        if day in _WEEKDAYS:
            days.add(day)
    return days


def _to_24h_range(text: str) -> str:
    def convert(match: re.Match[str]) -> str:
        hour = int(match.group(1))
        minute = match.group(2)
        meridian = match.group(3).upper()
        if meridian == "PM" and hour != 12:
            hour += 12
        if meridian == "AM" and hour == 12:
            hour = 0
        return f"{hour}:{minute}"

    converted = re.sub(r"(\d{1,2}):(\d{2})\s*([AP]M)", convert, text or "", flags=re.I)
    return converted.replace(" - ", "–").replace("-", "–").strip()


def _special_hours(store: dict[str, Any], when: datetime) -> str:
    label = f"{_MONTHS[when.month]} {when.day}"
    for item in (store.get("specialHours") or {}).get("specialHoursData") or []:
        days = str(item.get("specialDays") or "").replace(":", "").strip()
        if days == label:
            return str(item.get("specialTimings") or "").strip()
    for holiday in (store.get("retailStore") or {}).get("storeHolidays") or []:
        if str(holiday.get("date") or "").strip() != label:
            continue
        if holiday.get("closed"):
            return "Closed"
        return str(holiday.get("hours") or "").strip()
    return ""


def _regular_hours(store: dict[str, Any], weekday: str | None) -> str:
    entries = (store.get("storeHours") or {}).get("hours") or []
    if not entries:
        entries = (store.get("retailStore") or {}).get("storeHours") or []
    if not entries:
        return ""
    if weekday:
        for entry in entries:
            days = _expand_store_days(str(entry.get("storeDays") or ""))
            if not days or weekday in days:
                return str(entry.get("storeTimings") or "").strip()
    return str(entries[0].get("storeTimings") or "").strip()


def _store_hours_for_pickup(store: dict[str, Any]) -> str:
    when = _encoded_pickup_datetime(store)
    raw = ""
    if when:
        raw = _special_hours(store, when) or _regular_hours(store, _WEEKDAYS[when.weekday()])
    if not raw:
        raw = _regular_hours(store, None)
    return _to_24h_range(raw) if raw else ""


def _available_when(availability: dict[str, Any], regular: dict[str, Any], store: dict[str, Any]) -> str:
    date = _pickup_date(availability, regular)
    if not date or date.lower() in {"currently unavailable", "unavailable"}:
        return date
    hours = _store_hours_for_pickup(store)
    if date and hours:
        return f"{date} · {hours}"
    return date or hours


def _build_pickup_url(
    part_numbers: list[str],
    location: str | None,
    store_number: str | None,
) -> str:
    params: list[tuple[str, str]] = [("pl", "true")]
    for index, part in enumerate(part_numbers):
        params.append((f"parts.{index}", part))

    if store_number:
        params.extend(
            [
                ("store", store_number),
                ("purchaseOption", "fullPrice"),
                ("mts.0", "regular"),
                ("fts", "true"),
            ]
        )
    elif location:
        params.append(("location", location))
    else:
        raise ValueError("location or store_number is required for pickup checks")

    return f"{BASE_URL}/retail/pickup-message?{urllib.parse.urlencode(params)}"


def check_pickup(
    part_numbers: list[str],
    location: str | None = None,
    store_number: str | None = None,
) -> tuple[list[PickupResult], list[ApiError]]:
    if not part_numbers:
        return [], []

    url = _build_pickup_url(part_numbers, location, store_number)
    status_code, payload, error = _request(url)
    if error or payload is None:
        return [], [ApiError(part_number="*", reason=error or "unknown error")]

    body = payload.get("body", {})
    if body.get("errorMessage"):
        return [], [ApiError(part_number="*", reason=body["errorMessage"])]

    stores = body.get("stores") or []
    if not stores:
        message = body.get("notAvailableNearby") or body.get("notAvailableNearOneStore") or "no stores returned"
        return [], [ApiError(part_number="*", reason=message)]

    results: list[PickupResult] = []
    for store in stores:
        store_name = store.get("storeName", "Unknown Store")
        store_number_value = store.get("storeNumber", "")
        city = store.get("city") or ""
        state = store.get("state") or "HK"
        store_url = (
            store.get("reservationUrl")
            or store.get("makeReservationUrl")
            or ""
        ).replace("http://", "https://")

        for part_number, availability in (store.get("partsAvailability") or {}).items():
            regular = (availability.get("messageTypes") or {}).get("regular") or {}
            results.append(
                PickupResult(
                    part_number=part_number,
                    status=_pickup_status(availability.get("pickupDisplay")),
                    quote=availability.get("pickupSearchQuote") or regular.get("storePickupQuote") or "",
                    available_when=_available_when(availability, regular, store),
                    product_title=(regular.get("storePickupProductTitle") or part_number).replace("\xa0", " "),
                    store_name=store_name,
                    store_number=store_number_value,
                    city=city,
                    state=state,
                    store_url=store_url,
                )
            )

    if status_code != 200 and not results:
        return [], [ApiError(part_number="*", reason=f"HTTP {status_code}")]

    return results, []


def check_delivery(part_numbers: list[str]) -> tuple[list[DeliveryResult], list[ApiError]]:
    if not part_numbers:
        return [], []

    params: list[tuple[str, str]] = [("mt", "regular")]
    for index, part in enumerate(part_numbers):
        params.append((f"parts.{index}", part))

    url = f"{BASE_URL}/delivery-message?{urllib.parse.urlencode(params)}"
    status_code, payload, error = _request(url)
    if error or payload is None:
        return [], [ApiError(part_number="*", reason=error or "unknown error")]

    delivery_message = (((payload.get("body") or {}).get("content") or {}).get("deliveryMessage") or {})
    results: list[DeliveryResult] = []

    for part_number in part_numbers:
        part_data = delivery_message.get(part_number)
        if not part_data:
            results.append(
                DeliveryResult(
                    part_number=part_number,
                    status=StockStatus.UNKNOWN,
                    delivery_date="unknown",
                    product_title=part_number,
                )
            )
            continue

        regular = part_data.get("regular") or {}
        options = regular.get("deliveryOptions") or []
        messages = regular.get("deliveryOptionMessages") or []
        message_name = (messages[0].get("displayName") if messages else "") or ""
        option_date = options[0].get("date") if options else None
        buyability = regular.get("buyability") or {}
        is_buyable = buyability.get("isBuyable")
        inventory = buyability.get("inventory")

        if is_buyable is False and message_name:
            date_text = message_name.split("—")[0].strip()
        elif option_date and not str(option_date).lower().startswith("order today"):
            date_text = option_date
        elif message_name:
            date_text = message_name.split("—")[0].strip()
        else:
            quote = (regular.get("orderByDeliveryBy") or "").strip()
            date_text = quote if quote and not quote.lower().startswith("order today") else "unknown"

        if is_buyable is True and (inventory is None or inventory > 0):
            status = StockStatus.AVAILABLE
        elif is_buyable is False or inventory == 0:
            status = StockStatus.UNAVAILABLE
        else:
            lowered = date_text.lower()
            status = StockStatus.UNAVAILABLE if "unavailable" in lowered else StockStatus.AVAILABLE

        results.append(
            DeliveryResult(
                part_number=part_number,
                status=status,
                delivery_date=date_text,
                product_title=part_number,
            )
        )

    if status_code != 200 and not results:
        return [], [ApiError(part_number="*", reason=f"HTTP {status_code}")]

    return results, []
