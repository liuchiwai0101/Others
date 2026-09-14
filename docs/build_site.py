#!/usr/bin/env python3
"""Build a self-contained docs/index.html for htmlpreview / GitHub Pages."""

from __future__ import annotations

import json
from pathlib import Path

DOCS = Path(__file__).resolve().parent


def build() -> Path:
    template = (DOCS / "index.template.html").read_text(encoding="utf-8")
    css = (DOCS / "style.css").read_text(encoding="utf-8")
    js = (DOCS / "app.js").read_text(encoding="utf-8")
    catalog = json.loads((DOCS / "products.json").read_text(encoding="utf-8"))
    stock_path = DOCS / "stock.json"
    stock = json.loads(stock_path.read_text(encoding="utf-8")) if stock_path.exists() else {}

    html = (
        template.replace("/*INLINE_CSS*/", css)
        .replace("/*EMBEDDED_CATALOG*/", json.dumps(catalog, ensure_ascii=False))
        .replace("/*EMBEDDED_STOCK*/", json.dumps(stock, ensure_ascii=False))
        .replace("/*INLINE_JS*/", js)
    )
    out = DOCS / "index.html"
    out.write_text(html, encoding="utf-8")
    return out


if __name__ == "__main__":
    path = build()
    print(f"Wrote {path} ({path.stat().st_size} bytes)")
