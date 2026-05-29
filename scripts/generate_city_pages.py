#!/usr/bin/env python3
"""Generate the 10 urban-retail-access city pages from template.html + cities.json.

One source of truth: edit template.html (or cities.json), re-run this script,
all city pages stay in sync. The generated files are still committed so
GitHub Pages can serve them statically.

Run from anywhere:
    python scripts/generate_city_pages.py
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
URA_DIR = REPO_ROOT / "projects" / "urban-retail-access"
TEMPLATE_PATH = URA_DIR / "template.html"
CITIES_PATH = URA_DIR / "cities.json"

# ── Build-time constants (shared across all cities) ─────────────────────────
R2_BASE = "https://pub-846dd985fe5743b1a4466cdbb1c48bcc.r2.dev"
MAPBOX_TOKEN = (
    "pk.eyJ1IjoiY2xvb25rIiwiYSI6ImNtbjQxdDF1NzA0YXgycXByNXVuMnllYW4ifQ"
    ".3NHqjWQmGopsx5Xy1uHkQg"
)

RETAIL_CATS = [
    {"key": "all", "label": "All"},
    {"key": "Grocery & Food", "label": "Grocery"},
    {"key": "Restaurant", "label": "Restaurant"},
    {"key": "Pharmacy", "label": "Pharmacy"},
    {"key": "Convenience", "label": "Convenience"},
    {"key": "Fashion", "label": "Fashion"},
    {"key": "Electronics", "label": "Electronics"},
    {"key": "Department Store", "label": "Dept Store"},
    {"key": "Hardware", "label": "Hardware"},
    {"key": "Bookstore", "label": "Books"},
    {"key": "Thrift", "label": "Thrift"},
]
PUBLIC_CATS = [
    {"key": "all", "label": "All"},
    {"key": "Parks & Outdoors", "label": "Parks"},
    {"key": "Education", "label": "Education"},
    {"key": "Community & Govt", "label": "Community"},
    {"key": "Arts & Entertainment", "label": "Arts"},
    {"key": "Health & Medical", "label": "Health"},
    {"key": "Travel & Transport", "label": "Transit"},
    {"key": "Professional & Other", "label": "Other"},
]
RETAIL_KEYS = [c["key"] for c in RETAIL_CATS if c["key"] != "all"]
PUBLIC_KEYS = [c["key"] for c in PUBLIC_CATS if c["key"] != "all"]


def render_city_nav(cities: list[dict], active_slug: str) -> str:
    lines = []
    for i, c in enumerate(cities):
        active = " active" if c["slug"] == active_slug else ""
        indent = "" if i == 0 else "    "
        lines.append(
            f'{indent}<a class="city-btn{active}" data-city="{c["slug"]}" '
            f'href="{c["filename"]}">{c["code"]}'
            f'<span class="full">{c["name"]}</span></a>'
        )
    return "\n".join(lines)


def render_page(template: str, city: dict, cities: list[dict]) -> str:
    name = city["name"]
    slug = city["slug"]
    filename = city["filename"]
    page_url = f"https://cloonk.com/projects/urban-retail-access/{filename}"

    meta_description = (
        f"Urban Access — {name}: an interactive spatial analysis comparing "
        f"retail and public infrastructure reachability across {name} "
        "neighborhoods. Hex-grid access scores by walking, biking, and "
        "driving, layered against median household income."
    )
    social_description = (
        f"Interactive spatial analysis comparing retail and public "
        f"infrastructure reachability across {name} neighborhoods."
    )
    meta_keywords = (
        f"urban access, retail access, public access, {slug}, "
        f"{city['code'].lower()}, spatial analysis, accessibility, "
        "isochrone, mapbox, hex grid, h3, points of interest, poi, "
        "median household income, mhi, urban planning, data visualization"
    )

    nav_html = render_city_nav(cities, slug)

    subs = {
        "__PAGE_TITLE__": f"Urban Access — {name}",
        "__META_DESCRIPTION__": meta_description,
        "__META_KEYWORDS__": meta_keywords,
        "__PAGE_URL__": page_url,
        "__SOCIAL_DESCRIPTION__": social_description,
        "__CITY_NAME__": name,
        "__CITY_SLUG__": slug,
        "__CITY_NAV__": nav_html,
        "__MOBILE_CITY_NAV__": nav_html,
        "__CITY_LAT__": str(city["lat"]),
        "__CITY_LNG__": str(city["lng"]),
        "__CITY_ZOOM__": str(city["zoom"]),
        "__R2_BASE__": R2_BASE,
        "__R2_MHI__": f"{R2_BASE}/cities/{slug}/mhi_tracts.pmtiles",
        "__R2_HEX__": f"{R2_BASE}/cities/{slug}/hex_access.pmtiles",
        "__R2_POI__": f"{R2_BASE}/cities/{slug}/retail_pois.pmtiles",
        "__MAPBOX_TOKEN__": MAPBOX_TOKEN,
        "__RETAIL_CATS_JS__": json.dumps(RETAIL_CATS),
        "__PUBLIC_CATS_JS__": json.dumps(PUBLIC_CATS),
        "__RETAIL_KEYS_JS__": json.dumps(RETAIL_KEYS),
        "__PUBLIC_KEYS_JS__": json.dumps(PUBLIC_KEYS),
    }

    rendered = template
    for placeholder, value in subs.items():
        rendered = rendered.replace(placeholder, value)
    return rendered


def main() -> None:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    cities = json.loads(CITIES_PATH.read_text(encoding="utf-8"))["cities"]

    leftover = [p for p in (
        "__PAGE_TITLE__", "__CITY_NAME__", "__CITY_SLUG__", "__CITY_LAT__",
        "__CITY_LNG__", "__CITY_ZOOM__", "__CITY_NAV__", "__MOBILE_CITY_NAV__",
        "__R2_BASE__", "__R2_MHI__", "__R2_HEX__", "__R2_POI__",
        "__MAPBOX_TOKEN__", "__RETAIL_CATS_JS__", "__PUBLIC_CATS_JS__",
        "__RETAIL_KEYS_JS__", "__PUBLIC_KEYS_JS__", "__META_DESCRIPTION__",
        "__META_KEYWORDS__", "__PAGE_URL__", "__SOCIAL_DESCRIPTION__",
    ) if p not in template]
    if leftover:
        print(f"WARNING: template missing placeholders: {leftover}")

    for city in cities:
        out_path = URA_DIR / city["filename"]
        out_path.write_text(render_page(template, city, cities), encoding="utf-8")
        print(f"  wrote {out_path.relative_to(REPO_ROOT)}")
    print(f"Done. {len(cities)} city pages generated.")


if __name__ == "__main__":
    main()
