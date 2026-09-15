#!/usr/bin/env python3
"""Real-time iPhone stock checker for Apple Store Hong Kong."""

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

from apple_client import DeliveryResult, PickupResult, StockStatus
from service import load_catalog, run_stock_check

ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "config.json"


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_default_config(path: Path) -> None:
    example = ROOT / "config.example.json"
    path.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")


def status_icon(status: StockStatus) -> str:
    return {
        StockStatus.AVAILABLE: "✅",
        StockStatus.UNAVAILABLE: "❌",
        StockStatus.INELIGIBLE: "⛔",
        StockStatus.UNKNOWN: "❓",
    }[status]


def _place_label(result: PickupResult) -> str:
    parts = [result.store_name]
    if result.city:
        parts.append(result.city)
    if result.state and result.state != "HK":
        parts.append(result.state)
    return ", ".join(parts)


def variant_labels(catalog: dict) -> dict[str, str]:
    labels: dict[str, str] = {}
    for model in catalog.get("models", {}).values():
        for part_number, label in model.get("variants", {}).items():
            labels[part_number] = f"{model['name']} {label}"
    return labels


def format_pickup_lines(results: list[PickupResult], catalog: dict) -> list[str]:
    variants = variant_labels(catalog)
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
        lines.append("IN-STORE PICKUP (HK) — AVAILABLE")
        for part_number in sorted(available_parts):
            store_results = available_parts[part_number]
            label = variants.get(part_number, store_results[0].product_title)
            lines.append(f"  {status_icon(StockStatus.AVAILABLE)} {label} ({part_number})")
            for result in store_results:
                if result.status != StockStatus.AVAILABLE:
                    continue
            lines.append(
                f"      @ {_place_label(result)} [{result.store_number}]"
                + (f" — pick up {result.available_when}" if result.available_when else "")
            )
        return lines

    lines.append("IN-STORE PICKUP (HK) — none available nearby")
    for part_number, store_results in sorted(grouped.items()):
        label = variants.get(part_number, store_results[0].product_title)
        sample = store_results[0]
        lines.append(
            f"  {status_icon(sample.status)} {label} ({part_number}) — {sample.quote} "
            f"({len(store_results)} store(s) checked)"
        )
    return lines


def format_delivery_lines(results: list[dict], catalog: dict) -> list[str]:
    variants = variant_labels(catalog)
    lines = ["ONLINE DELIVERY (HK)"]
    for result in results:
        label = variants.get(result["part_number"], result["part_number"])
        lines.append(
            f"  {status_icon(StockStatus(result['status']))} {label} ({result['part_number']}) — ships {result['delivery_date']}"
        )
    return lines


def notify_webhook(url: str, message: str) -> None:
    payload = json.dumps({"content": message}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "iphone-stock-bot-hk/1.0"},
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
        labels = variant_labels(catalog)
        label = labels.get(result.part_number, result.product_title)
        alerts.append(
            f"Pickup {result.status.value}: {label} at {_place_label(result)}"
            + (f" — pick up {result.available_when}" if result.available_when else "")
        )

    labels = variant_labels(catalog)
    for result in delivery_changes:
        if available_only and result.status != StockStatus.AVAILABLE:
            continue
        label = labels.get(result.part_number, result.part_number)
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
        notify_desktop("iPhone HK Stock Alert", message)


def run_check(config: dict, catalog: dict, tracker: ChangeTracker | None) -> bool:
    result = run_stock_check(config)
    if not result.part_numbers:
        print("No part numbers selected. Update config.json filters or part_numbers.", file=sys.stderr)
        return False

    timestamp = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"\n[{timestamp}] Checking {len(result.part_numbers)} iPhone (HK) variant(s) across {result.summary['model_count']} model(s)...")

    pickup_results = [
        PickupResult(
            part_number=item["part_number"],
            status=StockStatus(item["status"]),
            quote=item["quote"],
            available_when=item.get("available_when", ""),
            product_title=item["product_title"],
            store_name=item["store_name"],
            store_number=item["store_number"],
            city=item["city"],
            state=item["state"],
            store_url=item.get("store_url", ""),
        )
        for item in result.pickup
    ]
    print("\n".join(format_pickup_lines(pickup_results, catalog)))

    if config.get("check_online_delivery", True):
        print("\n".join(format_delivery_lines(result.delivery, catalog)))

    for error in result.errors:
        print(f"warning: {error['part_number']}: {error['reason']}", file=sys.stderr)

    if tracker is not None:
        delivery_results = [
            DeliveryResult(
                part_number=item["part_number"],
                status=StockStatus(item["status"]),
                delivery_date=item["delivery_date"],
                product_title=item["product_title"],
            )
            for item in result.delivery
        ]
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
        "--location",
        help="Override HK district/area (e.g. Central, Causeway Bay, Tsim Sha Tsui)",
    )
    parser.add_argument(
        "--store",
        dest="store_number",
        help="Override Apple Store ID (e.g. R428 for ifc mall)",
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
        print(
            f"Created {args.config}. Edit location (HK district) and filters, "
            "then run: python3 bot.py"
        )
        return 0

    if not args.config.exists():
        save_default_config(args.config)
        print(f"Created {args.config}. Edit it, then re-run this command.")
        return 0

    config = load_json(args.config)
    catalog = load_catalog()

    if args.location:
        config["location"] = args.location
    if args.store_number:
        config["store_number"] = args.store_number
    if args.interval:
        config["poll_interval_seconds"] = args.interval

    if (
        not config.get("location")
        and not config.get("store_number")
        and config.get("check_pickup", True)
    ):
        print(
            "Set location (HK district) or store_number in config.json "
            "(or pass --location / --store).",
            file=sys.stderr,
        )
        return 1

    tracker = None if args.once else ChangeTracker()

    if args.once:
        run_check(config, catalog, tracker)
        return 0

    interval = max(15, int(config.get("poll_interval_seconds", 30)))
    where = config.get("store_number") or config.get("location")
    print(
        f"Watching iPhone (HK) stock every {interval}s "
        f"near {where} (Ctrl+C to stop)"
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
