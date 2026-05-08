# Urban Access

**How does walkable access to retail and public destinations vary across income levels in major US cities?**

An interactive web dashboard overlaying Census median household income with H3 hex-binned accessibility scores across 10 US cities. Built as a graduate information science project at Pratt Institute.


---

## Overview

Urban Access measures how many retail stores, public services, and civic amenities residents can reach on foot, by bike, or by car within 5, 10, or 20 minutes — then maps those scores against neighborhood income at the Census tract level. The goal is to surface patterns of access inequality that are invisible in traditional retail density maps.

Each hexagonal cell (~174m edge, ~0.1 km²) gets an accessibility score per mode and time threshold. Scores are computed for 18 POI categories spanning grocery stores, pharmacies, parks, schools, transit stops, and more.

---

## Cities

New York · Los Angeles · Chicago · Houston · Phoenix · San Antonio · Philadelphia · San Diego · Dallas · Fort Worth

---

## Data Sources

| Source | Dataset | Year |
|--------|---------|------|
| US Census Bureau | ACS 5-Year Estimates (B19013_001E — Median Household Income) | 2022 |
| US Census Bureau | TIGER/Line Tract Boundaries | 2022 |
| Foursquare | OS Places (open source POI dataset) | 2025 |
| Uber | H3 Hierarchical Hexagonal Grid | — |

Census MHI data contains sentinel null values (`-666,666,666`) which are cleaned before rendering. All 5 NYC boroughs (Bronx, Brooklyn, Manhattan, Queens, Staten Island) are included.

---

## Methodology

### Access Scoring

For each H3 resolution-9 hex centroid, a KDTree haversine query counts POIs within straight-line distance thresholds adjusted by a mode-specific detour factor:

| Mode | Speed | Detour Factor |
|------|-------|---------------|
| Pedestrian | 5 km/h | 1.4× |
| Bicycle | 15 km/h | 1.3× |
| Auto | 30 km/h | 1.2× |

Scores are precomputed for all 9 combinations of mode × time (5/10/20 min) across 18 POI categories and stored as hex properties.

### Analytics

City-level analytics are precomputed in `city_stats.json` per city:

- **Spearman correlation** between MHI and pedestrian_20_all access score
- **Income quartile averages** for all mode/time/category combinations
- **Access deserts** — % of hexes with zero reachable destinations per quartile
- **Walk–drive gap** — difference in reachable destinations between walking and driving
- **Gini coefficient** — inequality of access distribution across all hex cells

Quartile thresholds are city-specific, derived from each city's own MHI distribution.

---

## Stack

```
Data pipeline      Python · GeoPandas · H3 · DuckDB · SciPy (cKDTree)
Tile generation    Tippecanoe → PMTiles
Tile hosting       Cloudflare R2
Frontend           Mapbox GL JS v3 · mapbox-pmtiles@1
Fonts              DM Mono · Syne (Google Fonts)
Hosting            GitHub Pages
```

---

## Pipeline

The pipeline runs as a single `pipeline.py` with step selection, city filtering, and resume capability.

```bash
# Full run
python3 pipeline.py

# Resume from a specific step
python3 pipeline.py --from 5

# Single city
python3 pipeline.py --steps 5 6 7 8 --city new-york

# Force re-run (ignore cache)
python3 pipeline.py --steps 5b 6 --city new-york --force
```

| Step | Name | Description |
|------|------|-------------|
| 1 | `fetch_census` | Fetch MHI + population from Census API |
| 2 | `fetch_tiger` | Download TIGER/Line tract boundaries |
| 3 | `join_mhi` | Spatial join MHI onto tracts, compute density |
| 4 | `fetch_fsq` | Fetch Foursquare POIs via DuckDB |
| 5 | `hex_access` | H3 hex grid + KDTree accessibility scores |
| 5b | `clip_water` | Clip tracts and hexes to land boundary |
| 5c | `analytics` | Precompute city-level analytics |
| 6 | `split_export` | Split per-city PMTiles via Tippecanoe |
| 7 | `build_frontend` | Generate per-city HTML files |
| 8 | `upload` | Upload PMTiles to Cloudflare R2 |

### Environment

Credentials are loaded from `pipeline.env`:

```
CENSUS_API_KEY=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=urban-retail-access
```

### Requirements

```bash
pip install geopandas h3 duckdb scipy pandas pyarrow boto3 requests
# tippecanoe must be installed separately
```

Foursquare OS Places data is loaded from a local cache, HuggingFace (`hf://datasets/foursquare/fsq-os-places`), or anonymous S3 fallback. HuggingFace requires a classic Read token for gated repo access.

---

## Frontend

The frontend is a single-page HTML application generated from a Python template (`pipeline.py` step 7). One HTML file is produced per city; `index.html` is New York.

### Features

- **Dual mode** — toggle between Retail and Public destination categories
- **Transport controls** — walk / bike / drive × 5 / 10 / 20 min
- **Multi-select categories** — filter hex scores and POI dots simultaneously
- **Stacked tooltip** — hover shows MHI, access score, and POI name in one tooltip
- **Hex detail panel** — click any hex for a category breakdown with inline bar charts
- **Analytics modal** — income × access correlation, quartile analysis, access deserts, walk–drive gap, Gini coefficient — all precomputed and reactive to mode/time dropdowns
- **Legend** — live marker tracks hovered MHI and access score values
- **Mobile responsive** — hamburger nav at ≤700px
- **WCAG partial** — `aria-label`, `aria-pressed`, `aria-checked`, focus rings, keyboard navigation

### Tile Architecture

PMTiles are served from Cloudflare R2 via range requests. Each city has three tile files:

```
cities/{slug}/mhi_tracts.pmtiles    Census tract MHI polygons
cities/{slug}/hex_access.pmtiles    H3 hex accessibility scores
cities/{slug}/retail_pois.pmtiles   Foursquare POI points
```

Hex tiles render above road labels. MHI tract tiles render below the Mapbox water layer so harbour/bay fill masks them correctly.

---

## Known Limitations

- Access scores use straight-line distance with a detour factor, not actual street network routing
- Scores reflect POI density, not quality, operating hours, or affordability
- POI data coverage may be uneven in lower-density or suburban areas
- `city_stats.json` analytics are precomputed at walk 20 min for correlation; other mode/time combinations are precomputed for quartile charts but the Spearman r is fixed to pedestrian
- H3 hexes extend slightly beyond administrative boundaries before the water clip step

---

## Repository Structure

```
pipeline.py              Main pipeline runner
pipeline.env             Credentials (not committed)
output/
  mhi_data.parquet       Census MHI + population
  tiger_tracts.geojson   TIGER tract boundaries
  mhi_tracts.geojson     Joined MHI + tracts
  fsq_retail.parquet     Foursquare POIs
  hex_access_{slug}.geojson     Raw hex scores per city
  mhi_tracts_clipped_{slug}.geojson
  hex_access_clipped_{slug}.geojson
  cities/{slug}/
    mhi_tracts.pmtiles
    hex_access.pmtiles
    retail_pois.pmtiles
    city_stats.json
frontend/
  index.html             New York (default)
  {slug}.html            Other cities
```

---

## Author

Kevin Zhang · Pratt Institute, School of Information · 2025
