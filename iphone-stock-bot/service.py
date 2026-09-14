"""Shared stock-check logic for CLI and web UI."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

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
API_BATCH_SIZE = 16


def _expand_storage_filters(values: list[int | str]) -> set[str]:
    expanded: set[str] = {str(value) for value in values}
    if expanded.intersection({"1024", "1000"}):
        expanded.update({"1024", "1000", "1TB"})
    if expanded.intersection({"2048", "2000"}):
        expanded.update({"2048", "2000", "2TB"})
    if "128" in expanded:
        expanded.update({"128", "128GB"})
    return expanded


def _storage_aliases(storage: str) -> set[str]:
    aliases = {storage, storage.replace("GB", "").replace("TB", "000")}
    if storage.startswith("128GB"):
        aliases.update({"128", "128GB"})
    if storage.startswith("1TB"):
        aliases.update({"1024", "1000", "1TB"})
    if storage.startswith("2TB"):
        aliases.update({"2048", "2000", "2TB"})
    return aliases


def load_catalog() -> dict[str, Any]:
    with PRODUCTS_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def catalog_models(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    order = catalog.get("model_order") or list(catalog.get("models", {}).keys())
    models: list[dict[str, Any]] = []
    for model_id in order:
        model = catalog["models"].get(model_id)
        if not model:
            continue
        models.append(
            {
                "id": model_id,
                "name": model["name"],
                "variants": model["variants"],
                "variant_count": len(model["variants"]),
            }
        )
    return models


def part_lookup(catalog: dict[str, Any]) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    for model in catalog_models(catalog):
        for part_number, label in model["variants"].items():
            lookup[part_number] = {
                "model_id": model["id"],
                "model_name": model["name"],
                "label": label,
            }
    return lookup


def resolve_part_numbers(config: dict, catalog: dict) -> list[str]:
    selected_models = config.get("models", "all")
    model_ids = (
        [model["id"] for model in catalog_models(catalog)]
        if selected_models == "all"
        else [model_id for model_id in selected_models if model_id in catalog.get("models", {})]
    )

    configured = config.get("part_numbers", "all")
    lookup = part_lookup(catalog)

    if configured == "all":
        selected = [
            part_number
            for part_number, meta in lookup.items()
            if meta["model_id"] in model_ids
        ]
    else:
        selected = [part for part in configured if part in lookup and lookup[part]["model_id"] in model_ids]

    filters = config.get("filters") or {}
    storage_filter = _expand_storage_filters(filters.get("storage_gb") or [])
    color_filter = {value.lower() for value in filters.get("colors") or []}

    if not storage_filter and not color_filter:
        return selected

    filtered: list[str] = []
    for part in selected:
        label = lookup[part]["label"]
        storage, color = label.split(" ", 1)
        storage_aliases = _storage_aliases(storage)
        if storage_filter and storage_aliases.isdisjoint(storage_filter):
            continue
        if color_filter and color.lower() not in color_filter:
            continue
        filtered.append(part)

    return filtered


def _chunked(items: list[str], size: int = API_BATCH_SIZE) -> Iterable[list[str]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


@dataclass
class StockCheckResult:
    checked_at: str
    part_numbers: list[str]
    models: list[dict[str, Any]]
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


def _group_by_model(
    catalog: dict[str, Any],
    part_numbers: list[str],
    pickup_results: list[PickupResult],
    delivery_results: list[DeliveryResult],
) -> list[dict[str, Any]]:
    lookup = part_lookup(catalog)
    pickup_by_part: dict[str, list[PickupResult]] = {}
    for result in pickup_results:
        pickup_by_part.setdefault(result.part_number, []).append(result)

    delivery_by_part = {result.part_number: result for result in delivery_results}

    grouped: dict[str, dict[str, Any]] = {}
    for model in catalog_models(catalog):
        grouped[model["id"]] = {
            "id": model["id"],
            "name": model["name"],
            "summary": {
                "variant_count": 0,
                "pickup_available": 0,
                "delivery_available": 0,
            },
            "variants": [],
        }

    for part_number in part_numbers:
        meta = lookup.get(part_number)
        if not meta:
            continue

        model_id = meta["model_id"]
        pickup_entries = pickup_by_part.get(part_number, [])
        available_stores = [
            {
                "store_name": entry.store_name,
                "store_number": entry.store_number,
                "city": entry.city,
                "quote": entry.quote,
            }
            for entry in pickup_entries
            if entry.status == StockStatus.AVAILABLE
        ]
        pickup_status = (
            StockStatus.AVAILABLE.value
            if available_stores
            else (
                pickup_entries[0].status.value
                if pickup_entries
                else StockStatus.UNKNOWN.value
            )
        )

        delivery = delivery_by_part.get(part_number)
        delivery_status = delivery.status.value if delivery else StockStatus.UNKNOWN.value
        delivery_date = delivery.delivery_date if delivery else "unknown"

        variant = {
            "part_number": part_number,
            "label": meta["label"],
            "pickup_status": pickup_status,
            "pickup_quote": pickup_entries[0].quote if pickup_entries else "",
            "pickup_stores": available_stores,
            "delivery_status": delivery_status,
            "delivery_date": delivery_date,
        }

        model_entry = grouped[model_id]
        model_entry["variants"].append(variant)
        model_entry["summary"]["variant_count"] += 1
        if pickup_status == StockStatus.AVAILABLE.value:
            model_entry["summary"]["pickup_available"] += 1
        if delivery_status == StockStatus.AVAILABLE.value:
            model_entry["summary"]["delivery_available"] += 1

    order = catalog.get("model_order") or list(grouped.keys())
    return [
        grouped[model_id]
        for model_id in order
        if model_id in grouped and grouped[model_id]["variants"]
    ]


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
            for batch in _chunked(part_numbers):
                batch_pickup, batch_errors = check_pickup(
                    batch,
                    location=config.get("location"),
                    store_number=config.get("store_number"),
                )
                pickup_results.extend(batch_pickup)
                errors.extend(batch_errors)

        if config.get("check_online_delivery", True):
            for batch in _chunked(part_numbers):
                batch_delivery, batch_errors = check_delivery(batch)
                delivery_results.extend(batch_delivery)
                errors.extend(batch_errors)

    pickup_available = sum(1 for item in pickup_results if item.status == StockStatus.AVAILABLE)
    delivery_available = sum(1 for item in delivery_results if item.status == StockStatus.AVAILABLE)
    models = _group_by_model(catalog, part_numbers, pickup_results, delivery_results)

    return StockCheckResult(
        checked_at=datetime.now(timezone.utc).astimezone().isoformat(),
        part_numbers=part_numbers,
        models=models,
        pickup=[_serialize_pickup(item) for item in pickup_results],
        delivery=[_serialize_delivery(item) for item in delivery_results],
        errors=[_serialize_error(item) for item in errors],
        summary={
            "model_count": len(models),
            "variant_count": len(part_numbers),
            "pickup_available": pickup_available,
            "pickup_checked": len({item.part_number for item in pickup_results}),
            "delivery_available": delivery_available,
            "delivery_checked": len(delivery_results),
            "stores_checked": len({item.store_number for item in pickup_results}),
            "models_with_pickup": sum(
                1 for model in models if model["summary"]["pickup_available"] > 0
            ),
        },
    )
