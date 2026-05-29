#!/usr/bin/env python3
"""
Build static Census-backed market layers for the retail door tracker.

This is intentionally a precompute step: the browser reads the exported
GeoJSON files and never calls the Census API during normal use.
"""

from __future__ import annotations

import argparse
import os
import json
import math
import re
import tempfile
import urllib.parse
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import Point, Polygon, box


ACS_VARIABLES = {
    "total_population": "B01003_001E",
    "median_household_income": "B19013_001E",
    "total_households": "B19001_001E",
    "households_150k_199k": "B19001_016E",
    "households_200k_plus": "B19001_017E",
}

STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09",
    "DE": "10", "DC": "11", "FL": "12", "GA": "13", "HI": "15", "ID": "16", "IL": "17",
    "IN": "18", "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24",
    "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29", "MT": "30", "NE": "31",
    "NV": "32", "NH": "33", "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38",
    "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46",
    "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54",
    "WI": "55", "WY": "56",
}

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOOR_SEED = REPO_ROOT / "projects" / "fashion" / "data" / "door-tracker-seed.js"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "projects" / "fashion" / "data"
WEB_MERCATOR = "EPSG:3857"
WGS84 = "EPSG:4326"
SQM_PER_SQMI = 2_589_988.110336


@dataclass
class Door:
    retailer: str
    door_number: str
    name: str
    state: str
    lat: float
    lng: float

    @property
    def key(self) -> str:
        return f"{normalize_retailer(self.retailer)}|{self.door_number}"


def normalize_retailer(value: str) -> str:
    key = str(value or "").strip()
    upper = key.upper()
    aliases = {
        "DLL": "Dillard's", "DILLARDS": "Dillard's", "DILLARD'S": "Dillard's",
        "BLM": "Bloomingdales", "BLOOMINGDALES": "Bloomingdales",
        "NRD": "Nordstrom", "NORDSTROM": "Nordstrom",
        "BELK": "BELK", "KOHLS": "Kohl", "KOHL'S": "Kohl",
        "HOLTRENFREW": "Holt", "HOLT RENFREW": "Holt",
        "VON MAUR": "Von Maur", "WEBSTER": "Webster", "THE WEBSTER": "Webster",
    }
    return aliases.get(key) or aliases.get(upper) or key


def parse_doors(seed_path: Path) -> list[Door]:
    text = seed_path.read_text(encoding="utf-8")
    match = re.search(r"const\s+SEED\s*=\s*(\{.*?\});", text, re.S)
    if not match:
        raise RuntimeError(f"Could not find const SEED JSON in {seed_path}")
    seed = json.loads(match.group(1))
    doors = []
    for raw in seed.get("doorLocations", []):
        try:
            lat = float(raw.get("lat"))
            lng = float(raw.get("lng"))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(lat) or not math.isfinite(lng):
            continue
        if abs(lat) < 0.001 and abs(lng) < 0.001:
            continue
        doors.append(Door(
            retailer=str(raw.get("retailer", "")).strip(),
            door_number=str(raw.get("doorNumber", "")).strip(),
            name=str(raw.get("name", "")).strip(),
            state=str(raw.get("state", "")).strip().upper(),
            lat=lat,
            lng=lng,
        ))
    if not doors:
        raise RuntimeError("No geocoded doors found.")
    return doors


def census_get(url: str, params: dict | list[tuple[str, str]], api_key: str | None = None) -> list[dict]:
    if api_key:
        if isinstance(params, list):
            params = [*params, ("key", api_key)]
        else:
            params = {**params, "key": api_key}
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    try:
        data = resp.json()
    except ValueError as exc:
        preview = resp.text.strip().replace("\n", " ")[:500]
        raise RuntimeError(f"Census API did not return JSON for {resp.url}: {preview}") from exc
    header, rows = data[0], data[1:]
    return [dict(zip(header, row)) for row in rows]


def pull_acs(acs_year: int, states: Iterable[str], geography: str, api_key: str | None = None) -> pd.DataFrame:
    base = f"https://api.census.gov/data/{acs_year}/acs/acs5"
    variable_list = ["NAME", *ACS_VARIABLES.values()]
    records = []
    for st in sorted(states):
        fips = STATE_FIPS.get(st)
        if not fips:
            continue
        if geography == "block-group":
            params = {"get": ",".join(variable_list), "for": "block group:*", "in": f"state:{fips} county:* tract:*"}
        else:
            params = {"get": ",".join(variable_list), "for": "tract:*", "in": f"state:{fips} county:*"}
        records.extend(census_get(base, params, api_key=api_key))
    if not records:
        raise RuntimeError("Census API returned no ACS rows.")
    df = pd.DataFrame(records)
    for label, var in ACS_VARIABLES.items():
        df[label] = pd.to_numeric(df[var], errors="coerce")
    df.loc[df["median_household_income"] < 0, "median_household_income"] = pd.NA
    df["affluent_households"] = df["households_150k_199k"].fillna(0) + df["households_200k_plus"].fillna(0)
    df["GEOID"] = df["state"] + df["county"] + df["tract"] + (df["block group"] if geography == "block-group" else "")
    return df


def download_tiger_geometry(acs_year: int, states: Iterable[str], geography: str, cache_dir: Path) -> gpd.GeoDataFrame:
    layers = []
    tiger_kind = "bg" if geography == "block-group" else "tract"
    for st in sorted(states):
        fips = STATE_FIPS.get(st)
        if not fips:
            continue
        url = f"https://www2.census.gov/geo/tiger/GENZ{acs_year}/shp/cb_{acs_year}_{fips}_{tiger_kind}_500k.zip"
        local = cache_dir / Path(urllib.parse.urlparse(url).path).name
        if not local.exists():
            response = requests.get(url, timeout=90)
            response.raise_for_status()
            local.write_bytes(response.content)
        layer = gpd.read_file(f"zip://{local}")
        if layer.crs is None:
            layer = layer.set_crs(WGS84, allow_override=True)
        else:
            layer = layer.to_crs(WGS84)
        layers.append(layer)
    if not layers:
        raise RuntimeError("No TIGER geometries downloaded.")
    combined = gpd.GeoDataFrame(pd.concat(layers, ignore_index=True), geometry="geometry")
    return combined.set_crs(WGS84, allow_override=True)


def build_door_gdf(doors: list[Door]) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        [{
            "door_key": d.key,
            "retailer": normalize_retailer(d.retailer),
            "door_number": d.door_number,
            "door_name": d.name,
            "state": d.state,
            "geometry": Point(d.lng, d.lat),
        } for d in doors],
        crs=WGS84,
    )


def safe_number(value) -> float:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return 0.0
    return num if math.isfinite(num) else 0.0


def hex_grid(bounds, edge_miles: float) -> gpd.GeoDataFrame:
    minx, miny, maxx, maxy = bounds
    edge = edge_miles * 1609.344
    width = math.sqrt(3) * edge
    height = 2 * edge
    dx = width
    dy = height * 0.75
    polygons = []
    y = miny - height
    row = 0
    while y <= maxy + height:
        x = minx - width + (row % 2) * width / 2
        while x <= maxx + width:
            points = []
            for i in range(6):
                angle = math.radians(60 * i + 30)
                points.append((x + edge * math.cos(angle), y + edge * math.sin(angle)))
            polygons.append(Polygon(points))
            x += dx
        y += dy
        row += 1
    return gpd.GeoDataFrame({"hex_id": [f"hex_{i:05d}" for i in range(len(polygons))]}, geometry=polygons, crs=WEB_MERCATOR)


def weighted_metrics(targets: gpd.GeoDataFrame, census: gpd.GeoDataFrame, doors: gpd.GeoDataFrame, id_col: str) -> gpd.GeoDataFrame:
    rows = []
    census = census.copy()
    census["census_area"] = census.geometry.area
    for _, target in targets.iterrows():
        geom = target.geometry
        candidates = census[census.intersects(geom)]
        pop = households = affluent = income_weighted = 0.0
        for _, tract in candidates.iterrows():
            inter_area = tract.geometry.intersection(geom).area
            if inter_area <= 0 or tract.census_area <= 0:
                continue
            weight = inter_area / tract.census_area
            pop += safe_number(tract.total_population) * weight
            hh = safe_number(tract.total_households) * weight
            households += hh
            affluent += safe_number(tract.affluent_households) * weight
            income = tract.median_household_income
            if pd.notna(income) and income > 0:
                income_weighted += income * hh
        area_sqmi = geom.area / SQM_PER_SQMI
        door_count = int(doors.within(geom).sum())
        rows.append({
            id_col: target[id_col],
            "population": round(pop),
            "median_household_income": round(income_weighted / households) if households else None,
            "population_density": round(pop / area_sqmi, 2) if area_sqmi else 0,
            "affluent_households": round(affluent),
            "existing_door_count": door_count,
            "nearby_door_count": door_count,
            "area_sqmi": round(area_sqmi, 3),
        })
    metric_df = pd.DataFrame(rows)
    out = targets.merge(metric_df, on=id_col, how="left")
    out["door_density"] = out["existing_door_count"].fillna(0) / out["area_sqmi"].replace({0: pd.NA})
    return out


def add_opportunity_score(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    out = gdf.copy()
    metric_map = {
        "median_household_income": "income_index",
        "population_density": "density_index",
        "affluent_households": "affluent_household_index",
        "door_density": "door_density_index",
    }
    for src, dst in metric_map.items():
        values = pd.to_numeric(out[src], errors="coerce").fillna(0)
        mn, mx = values.min(), values.max()
        out[dst] = 0 if mx == mn else (values - mn) / (mx - mn)
    score = (
        out["income_index"] * 0.40
        + out["density_index"] * 0.25
        + out["affluent_household_index"] * 0.25
        - out["door_density_index"] * 0.10
    ).clip(0, 1)
    out["opportunity_score"] = (score * 100).round(1)
    return out


def export_geojson(gdf: gpd.GeoDataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serializable = gdf.to_crs(WGS84).copy()
    path.write_text(serializable.to_json(drop_id=True), encoding="utf-8")


def build_layers(args: argparse.Namespace) -> None:
    doors = parse_doors(args.door_seed)
    state_codes = {d.state for d in doors if d.state in STATE_FIPS}
    door_gdf = build_door_gdf(doors)
    door_proj = door_gdf.to_crs(WEB_MERCATOR)

    with tempfile.TemporaryDirectory() as tmp:
        cache_dir = Path(args.cache_dir) if args.cache_dir else Path(tmp)
        cache_dir.mkdir(parents=True, exist_ok=True)
        acs = pull_acs(args.acs_year, state_codes, args.geography, api_key=args.census_api_key)
        tiger = download_tiger_geometry(args.tiger_year or args.acs_year, state_codes, args.geography, cache_dir)

    census = tiger.merge(acs, on="GEOID", how="inner").to_crs(WEB_MERCATOR)
    census = census[census.intersects(box(*door_proj.total_bounds).buffer(args.market_padding_miles * 1609.344))]

    radius_m = args.radius_miles * 1609.344
    trade = door_proj.copy()
    trade["geometry"] = trade.buffer(radius_m)
    trade["trade_area_type"] = "radius"
    trade["radius_miles"] = args.radius_miles

    market_area = trade.geometry.union_all()
    hexes = hex_grid(gpd.GeoSeries([market_area], crs=WEB_MERCATOR).total_bounds, args.hex_edge_miles)
    hexes = hexes[hexes.intersects(market_area)].copy()
    hexes["geometry"] = hexes.geometry.intersection(market_area)

    hex_metrics = add_opportunity_score(weighted_metrics(hexes, census, door_proj, "hex_id"))
    trade_metrics = add_opportunity_score(weighted_metrics(trade, census, door_proj, "door_key"))

    output_dir = args.output_dir
    export_geojson(hex_metrics, output_dir / "hex_market_data.geojson")
    export_geojson(trade_metrics, output_dir / "door_trade_area_metrics.geojson")
    metadata = {
        "census_dataset": "ACS 5-Year Detailed Tables",
        "acs_year": args.acs_year,
        "date_refreshed": date.today().isoformat(),
        "geography": args.geography,
        "variables_used": ACS_VARIABLES,
        "radius_isochrone_assumptions": {
            "preferred": "20-minute drive area when routing/isochrone support is available",
            "used": f"{args.radius_miles:g}-mile radius fallback",
            "routing_available": False,
        },
        "hex_edge_miles": args.hex_edge_miles,
        "opportunity_score": "income_index*0.40 + density_index*0.25 + affluent_household_index*0.25 - door_density_index*0.10, clamped to 0-100",
    }
    (output_dir / "market_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh static Census market GeoJSON layers.")
    parser.add_argument("--acs-year", type=int, default=2024)
    parser.add_argument("--tiger-year", type=int, default=None)
    parser.add_argument("--geography", choices=["tract", "block-group"], default="tract")
    parser.add_argument("--radius-miles", type=float, default=5.0)
    parser.add_argument("--hex-edge-miles", type=float, default=5.0)
    parser.add_argument("--market-padding-miles", type=float, default=25.0)
    parser.add_argument("--door-seed", type=Path, default=DEFAULT_DOOR_SEED)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--cache-dir", type=Path, default=None)
    parser.add_argument("--census-api-key", default=os.environ.get("CENSUS_API_KEY"), help="Optional Census API key. Defaults to the CENSUS_API_KEY environment variable.")
    args = parser.parse_args()
    build_layers(args)


if __name__ == "__main__":
    main()
