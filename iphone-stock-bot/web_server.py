#!/usr/bin/env python3
"""Web UI server for the Hong Kong iPhone stock checker."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from market_prices import fetch_market_prices
from service import catalog_models, load_catalog, run_stock_check


def _storage_to_gb(token: str) -> int:
    token = token.upper()
    if token.endswith("TB"):
        return int(float(token[:-2]) * 1024)
    if token.endswith("GB"):
        return int(token[:-2])
    return int(token)


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"

app = FastAPI(title="iPhone HK Stock Checker", version="2.2.0")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class Filters(BaseModel):
    storage_gb: list[int] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)


class CheckRequest(BaseModel):
    location: str | None = "Central"
    store_number: str | None = None
    models: list[str] | str = "all"
    check_pickup: bool = True
    check_online_delivery: bool = True
    filters: Filters = Field(default_factory=Filters)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/prices")
async def market_prices() -> dict[str, Any]:
    try:
        payload = fetch_market_prices(force=True)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return payload


@app.get("/api/catalog")
async def catalog() -> dict[str, Any]:
    data = load_catalog()
    models = catalog_models(data)
    colors = sorted(
        {
            label.split(" ", 1)[1]
            for model in models
            for label in model["variants"].values()
            if " " in label
        }
    )
    storages = sorted(
        {
            _storage_to_gb(label.split(" ", 1)[0])
            for model in models
            for label in model["variants"].values()
            if " " in label
        }
    )
    return {
        "country": data["country"],
        "models": models,
        "stores": data["stores"],
        "locations": [
            "Central",
            "Causeway Bay",
            "Tsim Sha Tsui",
            "Kowloon Tong",
            "Kwun Tong",
            "Sha Tin",
        ],
        "storages": storages,
        "colors": colors,
    }


@app.post("/api/check")
async def check_stock(request: CheckRequest) -> dict[str, Any]:
    if request.check_pickup and not request.location and not request.store_number:
        raise HTTPException(
            status_code=400,
            detail="location or store_number is required when pickup checks are enabled",
        )

    config = {
        "location": request.location,
        "store_number": request.store_number,
        "models": request.models,
        "check_pickup": request.check_pickup,
        "check_online_delivery": request.check_online_delivery,
        "part_numbers": "all",
        "filters": request.filters.model_dump(),
    }
    result = run_stock_check(config)
    try:
        market = fetch_market_prices(force=not request.check_pickup or request.check_online_delivery)
    except Exception:
        market = {"prices": {}, "updated_at": None, "source": None}
    return {
        "checked_at": result.checked_at,
        "part_numbers": result.part_numbers,
        "models": result.models,
        "pickup": result.pickup,
        "delivery": result.delivery,
        "errors": result.errors,
        "summary": result.summary,
        "market_prices": market.get("prices") or {},
        "market_updated_at": market.get("updated_at"),
        "market_source": market.get("source"),
    }


def main() -> None:
    import uvicorn

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    uvicorn.run("web_server:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
