# iPhone 18 Pro Max Stock Bot

Real-time stock checker for **iPhone 18 Pro Max** using Apple's official store APIs.

Polls Apple for:

- **In-store pickup** availability near your ZIP code or a specific store
- **Online delivery** ship dates

Alerts you when availability changes (console, optional Discord/webhook, optional desktop notification).

## Quick start

```bash
cd iphone-stock-bot
python3 bot.py --init          # creates config.json
# Edit config.json — set your zip_code and optional filters
python3 bot.py                 # start watching (every 30s by default)
python3 bot.py --once          # single check
python3 bot.py --zip 10001 --once
```

## Configuration

Copy `config.example.json` to `config.json` (or run `python3 bot.py --init`).

| Field | Description |
| --- | --- |
| `zip_code` | US ZIP for nearby store pickup search |
| `store_number` | Optional Apple store ID (e.g. `R250`) instead of ZIP |
| `poll_interval_seconds` | How often to poll (minimum 15s) |
| `part_numbers` | `"all"` or a list like `["MJW44LL/A"]` |
| `filters.storage_gb` | e.g. `[256, 512]` |
| `filters.colors` | e.g. `["Black", "Silver"]` |
| `check_pickup` | Enable in-store checks |
| `check_online_delivery` | Enable online ship-date checks |
| `notifications.webhook_url` | Discord/Slack webhook URL for alerts |
| `notifications.notify_on_available_only` | Only alert when stock becomes available |
| `notifications.desktop_alert` | Use `notify-send` on Linux |

## Example: watch 256GB Black only

```json
{
  "zip_code": "94103",
  "poll_interval_seconds": 30,
  "part_numbers": "all",
  "filters": {
    "storage_gb": [256],
    "colors": ["Black"]
  },
  "check_pickup": true,
  "check_online_delivery": true,
  "notifications": {
    "webhook_url": null,
    "notify_on_available_only": true,
    "desktop_alert": false
  }
}
```

## Supported variants

All 16 US iPhone 18 Pro Max SKUs are in `products.json` (256GB–2TB, Black/Silver/Burgundy/Glacier).

## How it works

Uses Apple's undocumented but publicly accessible endpoints:

- Pickup: `GET /shop/retail/pickup-message`
- Delivery: `GET /shop/delivery-message`

Status is reported as **available**, **unavailable**, or **unknown** (on API/network errors — never guessed as out-of-stock).

## Notes

- Respect Apple's servers: don't poll faster than every 15 seconds.
- Part numbers are US (`LL/A`) models; other countries need different SKUs in `products.json`.
- This bot is unofficial and not affiliated with Apple.
