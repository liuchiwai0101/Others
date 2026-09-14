"""Shared stock-check logic for CLI and web UI."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from apple_client import (
    ApiError,
    DeliveryResult,
    PickupResult,
    StockStatus,
    check_delivery,
    check_pickup,
)

ROOT = Path(__file__).resolve().parent
PRODUCTS_FILE = ROOT / "products.json"


def _expand_storage_filters(values: list[int | str]) -> set[str]:
    expanded: set[str] = {str(value) for value in values}
    if expanded.intersection({"1024", "1000"}):
        expanded.update({"1024", "1000", "1TB"})
    if expanded.intersection({"2048", "2000"}):
        expanded.update({"2048", "2000", "2TB"})
    return expanded


def _storage_aliases(storage: str) -> set[str]:
    aliases = {storage, storage.replace("GB", "").replace("TB", "000")}
    if storage.startswith("1TB"):
        aliases.update({"1024", "1000", "1TB"})
    if storage.startswith("2TB"):
        aliases.update({"2048", "2000", "2TB"})
    return aliases


def load_catalog() -> dict[str, Any]:
    with PRODUCTS_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def resolve_part_numbers(config: dict, catalog: dict) -> list[str]:
    configured = config.get("part_numbers", "all")
    all_parts = list(catalog["variants"].keys())

    if configured == "all":
        selected = all_parts
    else:
        selected = [part for part in configured if part in catalog["variants"]]

    filters = config.get("filters") or {}
    storage_filter = _expand_storage_filters(filters.get("storage_gb") or [])
    color_filter = {value.lower() for value in filters.get("colors") or []}

    if not storage_filter and not color_filter:
        return selected

    filtered: list[str] = []
    for part in selected:
        label = catalog["variants"][part]
        storage, color = label.split(" ", 1)
        storage_aliases = _storage_aliases(storage)
        if storage_filter and storage_aliases.isdisjoint(storage_filter):
            continue
        if color_filter and color.lower() not in color_filter:
            continue
        filtered.append(part)

    return filtered


@dataclass
class StockCheckResult:
    checked_at: str
    part_numbers: list[str]
    pickup: list[dict[str, Any]]
    delivery: list[dict[str, Any]]
    errors: list[dict[str, str]]
    summary: dict[str, int]


def _serialize_pickup(result: PickupResult) -> dict[str, Any]:
    data = asdict(result)
    data["status"] = result.status.value
    return data


def _serialize_delivery(result: DeliveryResult) -> dict[str, Any]:
    data = asdict(result)
    data["status"] = result.status.value
    return data


def _serialize_error(error: ApiError) -> dict[str, str]:
    return {"part_number": error.part_number, "reason": error.reason}


def run_stock_check(config: dict) -> StockCheckResult:
    catalog = load_catalog()
    part_numbers = resolve_part_numbers(config, catalog)

    pickup_results: list[PickupResult] = []
    delivery_results: list[DeliveryResult] = []
    errors: list[ApiError] = []

    if not part_numbers:
        errors.append(ApiError(part_number="*", reason="no variants selected"))
    else:
        if config.get("check_pickup", True):
            pickup_results, pickup_errors = check_pickup(
                part_numbers,
                location=config.get("location"),
                store_number=config.get("store_number"),
            )
            errors.extend(pickup_errors)

        if config.get("check_online_delivery", True):
            delivery_results, delivery_errors = check_delivery(part_numbers)
            errors.extend(delivery_errors)

    pickup_available = sum(1 for item in pickup_results if item.status == StockStatus.AVAILABLE)
    delivery_available = sum(1 for item in delivery_results if item.status == StockStatus.AVAILABLE)

    return StockCheckResult(
        checked_at=datetime.now(timezone.utc).astimezone().isoformat(),
        part_numbers=part_numbers,
        pickup=[_serialize_pickup(item) for item in pickup_results],
        delivery=[_serialize_delivery(item) for item in delivery_results],
        errors=[_serialize_error(item) for item in errors],
        summary={
            "pickup_available": pickup_available,
            "pickup_checked": len({item.part_number for item in pickup_results}),
            "delivery_available": delivery_available,
            "delivery_checked": len(delivery_results),
            "stores_checked": len({item.store_number for item in pickup_results}),
        },
    )
