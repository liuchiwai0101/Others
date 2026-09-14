#!/usr/bin/env python3
"""Real-time iPhone 18 Pro Max stock checker for Apple Store pickup and delivery."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from apple_client import (
    ApiError,
    DeliveryResult,
    PickupResult,
    StockStatus,
    check_delivery,
    check_pickup,
)

ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "config.json"
PRODUCTS_FILE = ROOT / "products.json"


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_default_config(path: Path) -> None:
    example = ROOT / "config.example.json"
    path.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")


def resolve_part_numbers(config: dict, catalog: dict) -> list[str]:
    configured = config.get("part_numbers", "all")
    all_parts = list(catalog["variants"].keys())

    if configured == "all":
        selected = all_parts
    else:
        selected = [part for part in configured if part in catalog["variants"]]
        unknown = [part for part in configured if part not in catalog["variants"]]
        for part in unknown:
            print(f"warning: unknown part number {part}", file=sys.stderr)

    filters = config.get("filters") or {}
    storage_filter = {str(value) for value in filters.get("storage_gb") or []}
    color_filter = {value.lower() for value in filters.get("colors") or []}

    if not storage_filter and not color_filter:
        return selected

    filtered: list[str] = []
    for part in selected:
        label = catalog["variants"][part]
        storage, color = label.split(" ", 1)
        storage_value = storage.replace("GB", "").replace("TB", "000")
        if storage_filter and storage_value not in storage_filter and storage not in storage_filter:
            continue
        if color_filter and color.lower() not in color_filter:
            continue
        filtered.append(part)

    return filtered


def status_icon(status: StockStatus) -> str:
    return {
        StockStatus.AVAILABLE: "✅",
        StockStatus.UNAVAILABLE: "❌",
        StockStatus.INELIGIBLE: "⛔",
        StockStatus.UNKNOWN: "❓",
    }[status]


def format_pickup_lines(results: list[PickupResult], catalog: dict) -> list[str]:
    lines: list[str] = []
    grouped: dict[str, list[PickupResult]] = {}
    for result in results:
        grouped.setdefault(result.part_number, []).append(result)

    available_parts = {
        part: stores
        for part, stores in grouped.items()
        if any(store.status == StockStatus.AVAILABLE for store in stores)
    }

    if available_parts:
        lines.append("IN-STORE PICKUP — AVAILABLE")
        for part_number in sorted(available_parts):
            store_results = available_parts[part_number]
            label = catalog["variants"].get(part_number, store_results[0].product_title)
            lines.append(f"  {status_icon(StockStatus.AVAILABLE)} {label} ({part_number})")
            for result in store_results:
                if result.status != StockStatus.AVAILABLE:
                    continue
                lines.append(
                    f"      @ {result.store_name}, {result.city}, {result.state} [{result.store_number}]"
                )
        return lines

    lines.append("IN-STORE PICKUP — none available nearby")
    for part_number, store_results in sorted(grouped.items()):
        label = catalog["variants"].get(part_number, store_results[0].product_title)
        sample = store_results[0]
        lines.append(
            f"  {status_icon(sample.status)} {label} ({part_number}) — {sample.quote} "
            f"({len(store_results)} store(s) checked)"
        )
    return lines


def format_delivery_lines(results: list[DeliveryResult], catalog: dict) -> list[str]:
    lines = ["ONLINE DELIVERY"]
    for result in results:
        label = catalog["variants"].get(result.part_number, result.part_number)
        lines.append(
            f"  {status_icon(result.status)} {label} ({result.part_number}) — ships {result.delivery_date}"
        )
    return lines


def notify_webhook(url: str, message: str) -> None:
    payload = json.dumps({"content": message}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "iphone-stock-bot/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10):
            pass
    except urllib.error.URLError as exc:
        print(f"warning: webhook notification failed: {exc.reason}", file=sys.stderr)


def notify_desktop(title: str, message: str) -> None:
    try:
        subprocess.run(
            ["notify-send", title, message],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        print("warning: notify-send not installed; skipping desktop alert", file=sys.stderr)


class ChangeTracker:
    def __init__(self) -> None:
        self._pickup: dict[tuple[str, str], StockStatus] = {}
        self._delivery: dict[str, StockStatus] = {}

    def pickup_changes(self, results: list[PickupResult]) -> list[PickupResult]:
        changed: list[PickupResult] = []
        for result in results:
            key = (result.part_number, result.store_number)
            previous = self._pickup.get(key)
            if previous != result.status:
                changed.append(result)
            self._pickup[key] = result.status
        return changed

    def delivery_changes(self, results: list[DeliveryResult]) -> list[DeliveryResult]:
        changed: list[DeliveryResult] = []
        for result in results:
            previous = self._delivery.get(result.part_number)
            if previous != result.status:
                changed.append(result)
            self._delivery[result.part_number] = result.status
        return changed


def maybe_alert(
    config: dict,
    pickup_changes: list[PickupResult],
    delivery_changes: list[DeliveryResult],
    catalog: dict,
) -> None:
    notifications = config.get("notifications") or {}
    available_only = notifications.get("notify_on_available_only", True)

    alerts: list[str] = []
    for result in pickup_changes:
        if available_only and result.status != StockStatus.AVAILABLE:
            continue
        label = catalog["variants"].get(result.part_number, result.product_title)
        alerts.append(
            f"Pickup {result.status.value}: {label} at {result.store_name} ({result.city}, {result.state})"
        )

    for result in delivery_changes:
        if available_only and result.status != StockStatus.AVAILABLE:
            continue
        label = catalog["variants"].get(result.part_number, result.part_number)
        alerts.append(f"Delivery {result.status.value}: {label} — {result.delivery_date}")

    if not alerts:
        return

    message = "\n".join(alerts)
    print("\nALERT")
    print(message)

    webhook_url = notifications.get("webhook_url")
    if webhook_url:
        notify_webhook(webhook_url, message)

    if notifications.get("desktop_alert"):
        notify_desktop("iPhone 18 Pro Max Stock Alert", message)


def run_check(config: dict, catalog: dict, tracker: ChangeTracker | None) -> bool:
    part_numbers = resolve_part_numbers(config, catalog)
    if not part_numbers:
        print("No part numbers selected. Update config.json filters or part_numbers.", file=sys.stderr)
        return False

    timestamp = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"\n[{timestamp}] Checking {len(part_numbers)} iPhone 18 Pro Max variant(s)...")

    pickup_results: list[PickupResult] = []
    delivery_results: list[DeliveryResult] = []
    errors: list[ApiError] = []

    if config.get("check_pickup", True):
        pickup_results, pickup_errors = check_pickup(
            part_numbers,
            zip_code=config.get("zip_code"),
            store_number=config.get("store_number"),
        )
        errors.extend(pickup_errors)
        print("\n".join(format_pickup_lines(pickup_results, catalog)))

    if config.get("check_online_delivery", True):
        delivery_results, delivery_errors = check_delivery(part_numbers)
        errors.extend(delivery_errors)
        print("\n".join(format_delivery_lines(delivery_results, catalog)))

    for error in errors:
        print(f"warning: {error.part_number}: {error.reason}", file=sys.stderr)

    if tracker is not None:
        maybe_alert(
            config,
            tracker.pickup_changes(pickup_results),
            tracker.delivery_changes(delivery_results),
            catalog,
        )

    return True


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG,
        help=f"Path to config JSON (default: {DEFAULT_CONFIG.name})",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single check and exit",
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Create config.json from the example file",
    )
    parser.add_argument(
        "--zip",
        dest="zip_code",
        help="Override zip code from config",
    )
    parser.add_argument(
        "--interval",
        type=int,
        help="Override poll interval in seconds",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.init:
        if args.config.exists():
            print(f"{args.config} already exists")
            return 1
        save_default_config(args.config)
        print(f"Created {args.config}. Edit zip_code and filters, then run: python bot.py")
        return 0

    if not args.config.exists():
        save_default_config(args.config)
        print(f"Created {args.config}. Edit it, then re-run this command.")
        return 0

    config = load_json(args.config)
    catalog = load_json(PRODUCTS_FILE)

    if args.zip_code:
        config["zip_code"] = args.zip_code
    if args.interval:
        config["poll_interval_seconds"] = args.interval

    if not config.get("zip_code") and not config.get("store_number") and config.get("check_pickup", True):
        print("Set zip_code or store_number in config.json (or pass --zip).", file=sys.stderr)
        return 1

    tracker = None if args.once else ChangeTracker()

    if args.once:
        run_check(config, catalog, tracker)
        return 0

    interval = max(15, int(config.get("poll_interval_seconds", 30)))
    print(
        f"Watching iPhone 18 Pro Max stock every {interval}s "
        f"near zip {config.get('zip_code') or config.get('store_number')} "
        f"(Ctrl+C to stop)"
    )

    try:
        while True:
            run_check(config, catalog, tracker)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
