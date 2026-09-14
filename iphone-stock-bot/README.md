# iPhone 18 Pro Stock Bot (Hong Kong)

Real-time stock checker for **iPhone 18 Pro** and **iPhone 18 Pro Max** on **Apple Store Hong Kong** (`apple.com/hk`).

Tracks both models (32 variants): 256GB–2TB in Black, Silver, Burgundy, and Glacier.

Polls Apple HK for:

- **In-store pickup** near a Hong Kong district/area or a specific Apple Store
- **Online delivery** ship dates within Hong Kong

Alerts when availability changes (console, optional Discord/webhook, optional desktop notification).

## Live web UI

Public static site (GitHub Pages), refreshed from Apple HK about every 10 minutes:

- **GitHub Pages:** https://liuchiwai0101.github.io/Others/
- **jsDelivr mirror:** https://cdn.jsdelivr.net/gh/liuchiwai0101/Others@cursor/iphone-18-stock-bot-1629/docs/

Source files live in `/docs` at the repo root. GitHub Actions runs `export_stock.py` and deploys the snapshot.

## Quick start

### Local web UI (live checks)

```bash
cd iphone-stock-bot
pip install -r requirements.txt
python3 web_server.py
# Open http://127.0.0.1:8080
```

The UI shows 18 Pro and 18 Pro Max with pickup/delivery tables. Filter by model, storage, and colour; check once or auto-refresh with browser notifications when pickup stock appears.

### CLI

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

## Supported models (HK SKUs)

iPhone 18 Pro and iPhone 18 Pro Max part numbers are in `products.json` (HK `ZA/A` SKUs).

## How it works

Uses Apple Hong Kong store endpoints:

- Pickup: `GET https://www.apple.com/hk/shop/retail/pickup-message`
- Delivery: `GET https://www.apple.com/hk/shop/delivery-message`

This bot is **HK-only** and is not affiliated with Apple. Poll no faster than every 15 seconds.
