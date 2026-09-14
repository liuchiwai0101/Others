# iPhone 18 Pro Max Stock Bot (Hong Kong)

Real-time stock checker for **iPhone 18 Pro Max** on the **Apple Store Hong Kong** (`apple.com/hk`).

Polls Apple HK for:

- **In-store pickup** near a Hong Kong district/area or a specific Apple Store
- **Online delivery** ship dates within Hong Kong

Alerts when availability changes (console, optional Discord/webhook, optional desktop notification).

## Quick start

```bash
cd iphone-stock-bot
python3 bot.py --init
# Edit config.json — set location (e.g. Central, Causeway Bay)
python3 bot.py
python3 bot.py --once
python3 bot.py --location "Causeway Bay" --once
python3 bot.py --store R428 --once   # ifc mall only
```

## Configuration

| Field | Description |
| --- | --- |
| `location` | HK district/area for nearby pickup (e.g. `Central`, `Tsim Sha Tsui`, `Causeway Bay`, `Sha Tin`) |
| `store_number` | Optional Apple Store ID instead of district (see table below) |
| `poll_interval_seconds` | Poll interval (minimum 15s) |
| `part_numbers` | `"all"` or a list like `["MJXN4ZA/A"]` |
| `filters.storage_gb` | e.g. `[256, 512]` |
| `filters.colors` | e.g. `["Black", "Glacier"]` |
| `check_pickup` / `check_online_delivery` | Toggle checks |
| `notifications.webhook_url` | Discord/Slack webhook for alerts |

## Hong Kong Apple Stores

| Store ID | Store |
| --- | --- |
| `R428` | ifc mall (Central) |
| `R499` | Canton Road (Tsim Sha Tsui) |
| `R409` | Causeway Bay |
| `R485` | Festival Walk (Kowloon Tong) |
| `R673` | apm Hong Kong (Kwun Tong) |
| `R610` | New Town Plaza (Sha Tin) |

## Example: watch 256GB Black only

```json
{
  "location": "Central",
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

## Supported variants (HK SKUs)

All 16 Hong Kong iPhone 18 Pro Max part numbers (`ZA/A`) are in `products.json` — 256GB–2TB in Black, Silver, Burgundy, Glacier.

## How it works

Uses Apple Hong Kong store endpoints:

- Pickup: `GET https://www.apple.com/hk/shop/retail/pickup-message`
- Delivery: `GET https://www.apple.com/hk/shop/delivery-message`

This bot is **HK-only** and is not affiliated with Apple. Poll no faster than every 15 seconds.
