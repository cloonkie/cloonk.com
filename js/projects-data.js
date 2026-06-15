/* projects-data.js
 * CDN: https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev
 * Images: assests/images/{id}-1.jpg (etc.)
 * PDFs:   assests/pdf/ exact filenames
 */

window.PROJECTS = [
  {
    "num": "35",
    "id": "imagery",
    "title": "Imagery",
    "short": "28 canvas-based image filters — halftone, dither, glitch, ASCII, and more.",
    "desc": "A browser-based image filter studio with 28 Photoshop-inspired effects running entirely on the client via the Canvas API. Upload any image and every filter renders simultaneously at full resolution — no uploads, no waiting. Includes a catalog page showing each filter live on an accent-color leaf. Filters span halftone families, sketch effects, generative noise, retro VHS and Matrix Rain, pixel sorting, glitch warping, sticker cutout, and more — each with a breadth of customizable parameters.",
    "topic": "creative tools",
    "type": "Tools",
    "year": "2026",
    "affiliation": null,
    "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/projects%20no%20img.png",
    "gallery": [],
    "media": [],
    "pdf": null,
    "pdf_label": null,
    "figma": null, "sheets": null, "canva": null,
    "github": "https://github.com/cloonkie/cloonk.com/tree/main/projects/imagery",
    "live": "https://cloonk.com/projects/imagery/",
    "hideStatMoments": true,
    "hideStatements": true,
    "quotes": null, "findings": null, "statMoments": null, "impact": null, "statements": null,
    "context": {
      "problem": "Creative filter tools either live behind paywalls (Photoshop, Lightroom) or upload your image to a server. The goal was to build the full richness of destructive image effects — halftone families, generative noise fields, glitch warps, retro effects, sticker cutout — in a purely client-side canvas pipeline with real customization, at zero cost and zero upload."
    },
    "approach": {
      "summary": "All 28 filter functions are pure ImageData transforms running in OffscreenCanvas. A registry drives both the interactive studio (upload → render grid → tweak params → download) and a catalog page that renders each filter live using an SVG leaf as the source image. Techniques include Floyd-Steinberg dithering, Sobel edge detection, BFS flood-fill for sticker background removal, seeded Voronoi, fractal value noise, and custom AABB pixel-sorting. The catalog uses a IMAGERY_CATALOG flag to reuse the filter engine without wiring DOM UI.",
      "data": ["Canvas API", "OffscreenCanvas", "ImageData", "Floyd-Steinberg dithering", "Sobel edge detection", "BFS flood fill", "Voronoi", "Fractal noise", "Vanilla JS", "GitHub Pages"]
    },
    "results": {
      "before": ["Creative canvas filters required server-side processing or paid software", "No single-page tool running 28 simultaneous effects on uploaded images"],
      "after": ["28 filters rendering simultaneously in-browser on upload — halftone, dither, ASCII, glitch, sticker, noise, VHS, and more", "Per-filter parameter controls with live re-render", "A catalog page with live previews on each filter for discovery", "Full-resolution download, no upload, no login"]
    },
    "takeaways": [
      { "title": "Canvas API is deep enough to rebuild Photoshop destructive effects", "body": "Every filter in here — Floyd-Steinberg dithering, Sobel-based edge detection, BFS sticker cutout, seeded Voronoi cells, fractal noise fields — runs entirely on ImageData manipulations in the browser. No WebGL, no server, no libraries. The constraint forced legible, composable pixel math." }
    ]
  },

  {
      "num": "34",
      "id": "nyc-soundhood",
      "title": "NYC Soundhood",
      "short": "Connect Spotify, get your top 3 NYC neighborhoods — by ear.",
      "desc": "Connect Spotify and the tool reads your real top artists and the dozens of micro-genres behind them — \"brooklyn drill,\" \"bedroom pop,\" \"deep house\" — folds them into ten sonic families, and reads your average artist popularity as a mainstream-to-underground dial. That taste fingerprint is then scored against the hand-authored sonic profile of fourteen NYC neighborhoods, and out come your closest three, with the reasoning shown.\n\nIt runs entirely in the browser on Spotify's PKCE auth flow — no server, no client secret. The access token lives only in the open tab and is dropped when it closes; no listening data is uploaded, stored, or logged. A sample-data preview lets anyone see the matching engine run without connecting an account.",
      "topic": "data analysis",
      "type": "Tools",
      "year": "2026",
      "affiliation": null,
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/projects%20no%20img.png",
      "gallery": [],
      "media": [],
      "pdf": null,
      "pdf_label": null,
      "figma": null, "sheets": null, "canva": null,
      "github": "https://github.com/cloonkie/cloonk.com/tree/main/projects/nyc-soundhood",
      "live": "https://cloonk.com/projects/nyc-soundhood/",
      "hideStatMoments": true,
      "hideStatements": true,
      "quotes": null, "findings": null, "statMoments": null, "impact": null, "statements": null,
      "context": {
        "problem": "\"What kind of music are you into?\" is a question people answer with a vibe, not a vector. Spotify already knows the real answer — it just hands it back as a Wrapped slideshow once a year. The idea here was to turn that latent taste data into something playful and place-based: if your listening were a New York neighborhood, which one would it be? The constraint was the same one every cloonk tool holds to — it had to run with no backend and never hold onto anyone's data."
      },
      "approach": {
        "summary": "A single-page app on Spotify's Authorization Code + PKCE flow — fully client-side, no secret, no server to send a token to. It pulls the user's top 50 artists, classifies each artist's Spotify genres into ten sonic families via keyword rules, weights by listening rank, and reads average artist popularity as a mainstream-to-underground axis. The resulting taste vector is matched to fourteen hand-profiled neighborhoods by weighted cosine similarity, blended with axis proximity. Results show match percentages, the driving genres, and a full taste-fingerprint readout.",
        "data": ["JavaScript (ES modules)", "Spotify Web API", "OAuth PKCE", "Web Crypto API", "Cosine similarity", "Client-side processing", "GitHub Pages"]
      },
      "results": {
        "before": ["Your music taste is rich structured data locked inside one app's once-a-year recap", "No fun, shareable way to translate listening into a sense of place", "Most \"connect your Spotify\" toys route your data through someone's server"],
        "after": ["Connect Spotify → your top 3 NYC neighborhoods with match scores and reasoning", "A taste fingerprint — ten sonic families, a mainstream-to-underground dial, and your top genres — rendered from real listening", "Auth and analysis run entirely in-tab; the token is never persisted and no listening data leaves the browser", "A sample-data preview so the engine is explorable without an account"]
      },
      "takeaways": [
        { "title": "PKCE means a 'connect your account' toy needs no backend", "body": "The reflex with anything that touches a user's Spotify is to stand up a server to hold the client secret. The Authorization Code + PKCE flow removes that entirely — the browser proves it started the request with a hashed verifier, no secret required. So the honest privacy story and the architecture are the same one: there's no server to send your listening history to, because there's no server at all." }
      ]
    },

  {
      "num": "33",
      "id": "pdf-studio",
      "title": "PDF Studio",
      "short": "An Acrobat-style PDF toolkit that runs entirely in the browser.",
      "desc": "A local, browser-based document toolkit modeled on the everyday jobs people open Acrobat for — view, organize, merge, split, compress, watermark, number, convert and edit PDFs, plus a batch image compressor. Eleven tools share one work surface and the cloonk theme.\n\nThe whole thing runs client-side: pdf.js renders and reads pages, pdf-lib rewrites them, JSZip packages multi-file output. No account, no upload, no server — a file dropped in never leaves the tab. It's the rare case where 'on-device' isn't a privacy nicety but the entire architecture: there is no backend to send anything to.",
      "topic": "data analysis",
      "type": "Tools",
      "year": "2026",
      "affiliation": null,
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/projects%20no%20img.png",
      "gallery": [],
      "media": [],
      "pdf": null,
      "pdf_label": null,
      "figma": null, "sheets": null, "canva": null,
      "github": "https://github.com/cloonkie/cloonk.com/tree/main/projects/pdf-studio",
      "live": "https://cloonk.com/projects/pdf-studio/",
      "hideStatMoments": true,
      "hideStatements": true,
      "quotes": null, "findings": null, "statMoments": null, "impact": null, "statements": null,
      "context": {
        "problem": "The everyday PDF jobs — combine a few files, pull out a page range, shrink a scan small enough to email, drop a DRAFT watermark, turn photos into a PDF — usually mean a paid Acrobat seat or uploading sensitive documents to a free web converter whose privacy terms nobody reads. Both are bad options for a quick, one-off task on a file you'd rather not hand to a stranger's server."
      },
      "approach": {
        "summary": "A single-page app with eleven focused tools on a shared work surface, styled in the cloonk light/dark system. pdf.js handles rendering, search, and text extraction; pdf-lib handles every structural edit (merge, split, rotate, reorder, delete, watermark, page numbers, metadata, image embedding); JSZip packages multi-file downloads. The compressor re-renders pages to JPEG at a chosen DPI and quality. Nothing is uploaded — there is no backend.",
        "data": ["JavaScript (ES modules)", "pdf.js", "pdf-lib", "JSZip", "Canvas API", "Client-side processing", "GitHub Pages"]
      },
      "results": {
        "before": ["Routine PDF edits required a paid desktop app or an upload-to-a-stranger web tool", "Sensitive documents left the user's machine to get processed", "No single place for view + organize + convert + compress"],
        "after": ["Eleven tools — organize/view, merge, split, compress, watermark, page numbers, metadata, images→PDF, PDF→images, extract text, image compressor — in one browser tab", "Files never leave the device; the privacy guarantee is structural, not a promise", "Free, login-free, installs nothing, works offline once loaded"]
      },
      "takeaways": [
        { "title": "On-device is a feature, not a footnote", "body": "For documents, 'nothing is uploaded' is the whole value proposition. Browsers can now render, rewrite, and repackage PDFs entirely client-side — so the honest version of a PDF tool is one with no server to send your file to in the first place. The constraint and the selling point are the same thing." }
      ]
    },

  {
      "num": "32",
      "id": "fashion-toolbox",
      "title": "Fashion Toolbox",
      "short": "Enterprise-style merchandising analysis, in the browser.",
      "desc": "A growing set of single-purpose, browser-based tools for assortment and replenishment work — built so the kind of analysis usually locked behind enterprise software runs locally, for free, with no login and nothing uploaded.\n\nThe toolbox is a filing-cabinet hub that springs open to the available tools: DIGI LINE SHEET for product review and Assortment Comparison for retailer overlap, with more to come. Every tool shares one design system and the cloonk theme.",
      "topic": "data analysis",
      "type": "Tools",
      "year": "2026",
      "affiliation": null,
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/toolbox-sd.png",
      "gallery": [],
      "media": [],
      "pdf": null,
      "pdf_label": null,
      "figma": null, "sheets": null, "canva": null,
      "github": "https://github.com/cloonkie/cloonk.com/tree/main/projects/fashion",
      "live": "https://cloonk.com/projects/fashion/",
      "hideStatMoments": true,
      "hideStatements": true,
      "quotes": null, "findings": null, "statMoments": null, "impact": null, "statements": null,
      "context": {
        "problem": "Merchandising analysis — replenishment review, assortment overlap — usually means enterprise BI seats or manual spreadsheet grinding. Both are slow, gated, and hard to share. The goal was to make that work accessible: open a page, drop in a sheet, get the answer, with no install, no login, and nothing leaving the machine."
      },
      "approach": {
        "summary": "Each tool is a focused, client-side app that reads a spreadsheet in the browser and never uploads it. They share one design system (fashion.css / fashion.js) and the cloonk light/dark theme, surfaced through a filing-cabinet hub that springs open to reveal the available tools.",
        "data": ["JavaScript", "SheetJS", "Client-side processing", "Shared design system", "GitHub Pages"]
      },
      "results": {
        "before": ["Assortment and replenishment analysis required enterprise software or manual spreadsheet work", "Nothing shareable or self-serve", "Tool styling duplicated per file"],
        "after": ["Free, login-free, browser-only tools — data never leaves the machine", "A shared fashion design system and a toolbox hub that scales as tools are added", "Two tools live: DIGI LINE SHEET and Assortment Comparison"]
      },
      "takeaways": [
        { "title": "Accessible beats powerful when the power is gated", "body": "Most merchandising analysis isn't hard math — it's locked behind tools people can't reach. A small browser tool that runs locally and asks for nothing democratizes the work more than a more capable system nobody can open." }
      ]
    },

  {
      "num": "31",
      "id": "urban-retail-access",
      "title": "Urban Access",
      "short": "Walking access is twice as unequal as income.",
      "desc": "Across 454,000 hexagons in ten US cities, the median Gini coefficient for 20-minute pedestrian destination counts is 0.90 — against a US household-income Gini of about 0.41. Walking access is roughly twice as unequally distributed as income itself. Income predicts walk access in every city tested; whether richer or poorer neighborhoods come out ahead depends on whether the metro was built around a dense core or a freeway grid.\n\nUrban Access is the GIS pipeline that surfaces this. A Python + DuckDB + Valhalla + Tippecanoe + Mapbox GL stack joins Foursquare OS Places, Census ACS income, and OpenStreetMap pedestrian routing across ten metros. The dashboard frames three reader-facing questions — how are you getting there, what are you looking for, and how long are you willing to travel — and repaints the city for every combination.",
      "topic": "data analysis",
      "type": "Data Engineering",
      "year": "2026",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/urban-retail-access-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/urban-retail-access-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/urban-retail-access-1.jpg" }],
      "pdf": null,
      "pdf_label": "Urban Access - Project Proposal",
      "figma": null, "sheets": null, "canva": null,
      "github": "https://github.com/cloonkie/cloonk.com/tree/main/projects/urban-retail-access",
      "live": "https://cloonk.com/projects/urban-retail-access/index.html",
      "hideStatMoments": true,
      "hideStatements": true,
      "quotes": [
        {
          "text": "Solid set of data and a lot of useful information here. The design works — the color palette pops nicely, and the piece is engaging and easy to navigate.",
          "attribution": "Nancy Smith, Associate Professor of Visual Communication & Information Design, Pratt Institute",
          "pairsWithFinding": null
        }
      ],
      "findings": [
        {
          "title": "NYC: top-quartile tracts walk to 4.4× more than the bottom",
          "observation": "In NYC's bottom-income-quartile tracts, an average 20-minute walk reaches 437 destinations. In top-quartile tracts, 1,911. The richest reach 4.4× as many destinations on foot as the poorest.",
          "evidence": "Across 6,992 NYC hexagons, Spearman r between tract median household income and 20-min walk access is −0.177 (p < 0.001). The aggregate r is weak because density and income are decoupled at the city-edge level, but the Q1/Q4 ratio is the cleaner number: 4.4× more in Q4 across all destination categories.",
          "impact": "The 'everything within walking distance' Manhattan stereotype is real — and bounded by income. Lower Manhattan and West Village tracts are mostly Q4. Outer-borough tracts away from subway lines are mostly Q1.",
          "recommendation": "In the dashboard, switch from 'all destinations' to 'pharmacy.' Absolute counts drop everywhere; the Q4/Q1 ratio widens. Access to essential services is more income-segmented than the all-categories view suggests.",
          "image": null
        },
        {
          "title": "Phoenix: bottom-quartile tracts walk to 6.5× more than the top",
          "observation": "In Phoenix Q1: 22 destinations reachable in a 20-min walk. In Q4: 3.4. The relationship is the *opposite* of NYC — and statistically significant in the same direction across six other sprawl-pattern metros.",
          "evidence": "Spearman r = +0.011 (effectively zero), but the quartile breakdown reveals the structure: poorer tracts cluster in the old urban grid; wealthier tracts spread into the exurbs where there is nothing within a walk.",
          "impact": "'Walkable' and 'wealthy' are not the same variable. In Phoenix they're anti-correlated at the quartile level. Suburbs are where wealth went; sidewalks are where everything else stayed.",
          "recommendation": "Compare Phoenix Q4 to NYC Q4 at 20 minutes, same destination filter. Same income tier — 560× more destinations on foot in NYC. The variable doing the work is urban form, not income.",
          "image": null
        },
        {
          "title": "Walking access is twice as unequally distributed as income itself",
          "observation": "The median Gini coefficient for 20-minute walk-access counts across the ten cities is 0.897. The US household-income Gini is 0.41. Walking access is roughly twice as concentrated as the income distribution it correlates with.",
          "evidence": "Range across cities: Philadelphia 0.546 (the lowest, and the only sub-0.7 city) → Phoenix 0.973. NYC 0.925, LA 0.965, San Diego 0.969. Education-category Gini is consistently highest of all subcategories — schools are concentrated relative to other destinations in every metro measured.",
          "impact": "A near-monopoly Gini means walking destinations are concentrated in a small share of neighborhoods. In Phoenix, a handful of hexes hold nearly all the walk-reachable destinations in the metro.",
          "recommendation": "Open the analytics modal's Gini panel and sort by category. The lower the absolute count of destinations of that type in the city, the more concentrated they tend to be. Education is the canonical case across all ten cities.",
          "image": null
        },
        {
          "title": "When the map goes black, that's the answer",
          "observation": "Filter to pharmacy + walking + 5 minutes anywhere in suburban Houston, Phoenix, or Fort Worth. Most of the map turns black — score zero, no destinations reachable. This is not missing data. This is the city.",
          "evidence": "In NYC, 24.3% of Q1 hexes report zero destinations reachable in a 5-minute walk. In sprawl-pattern metros, that percentage runs higher across all income quartiles. The dashboard reports zero rather than hiding the hex, because the absence is the finding.",
          "impact": "Five minutes on foot is not enough time to reach anything in places designed around the car. The empty state is a measurement, not a gap in the data.",
          "recommendation": "When you see the black map, try widening to 10 or 20 minutes, or switching the mode to drive. The destination doesn't appear closer — but the gap between modes is the diagnostic. A wide walk-vs-drive gap is the visual signature of car dependence.",
          "image": null
        }
      ],
      "statMoments": [
        {
          "value": "0.897",
          "label": "Median Gini coefficient for 20-minute walk access across the 10 cities. The US household-income Gini is 0.41. Walking access is roughly twice as unequally distributed as income itself."
        },
        {
          "value": "10 / 10",
          "label": "Cities where the income–walk-access correlation is statistically significant. Direction varies (negative in 7, positive in 3); magnitude is large enough to matter in every one of them."
        },
        {
          "value": "454,000",
          "label": "H3 resolution-9 hexagons in the dataset. Each is roughly the size of a city block. Each holds an answer to what's reachable from its center on foot at 5, 10, and 20 minutes."
        }
      ],
      "impact": {
        "analytical": "First reproducible cross-city study of pedestrian destination access vs. income at H3 resolution-9 across ten US metros. Surfaces the direction-varies pattern that single-city walkability studies systematically miss.",
        "methodological": "Pipeline parameterized — adding a new city is a config entry, not a rebuild. ACS sentinel cleaning, Valhalla isochrone integration, DuckDB spatial join optimization, and Tippecanoe vector tile compression are documented and version-controlled.",
        "discoverability": "Dashboard frames three reader-facing questions (mode, category, time) that translate directly into filter combinations. Hex-level resolution lets users zoom into the specific block they live on, not the tract they belong to.",
        "reproducibility": "End-to-end open-source stack — Python, DuckDB, Valhalla, Tippecanoe, Mapbox GL — running on free or low-cost infrastructure (Cloudflare R2, GitHub Pages). Re-runnable against updated Census vintages or new cities with no proprietary dependencies.",
        "scalability": "Processes 259K POIs and 454K hexagons across 10 cities in roughly an hour per city; the cost is dominated by Valhalla routing, not by storage or rendering. The hex-tile-PMTiles pattern handles datasets an order of magnitude larger without front-end changes.",
        "policy": "Demonstrates that the income–walkability relationship is a function of urban form, not just household income. Policy interventions targeting walkability without accounting for built form will land differently in dense vs. sprawl-pattern metros."
      },
      "statements": [
        "Walking access is more unevenly distributed than income.",
        "Suburbs are where wealth went; sidewalks are where everything else stayed.",
        "Same income variable. Different cities. Opposite signs."
      ],
      "context": {
        "problem": "Walking access in the average US city is roughly twice as unequally distributed as income itself. The median Gini coefficient for 20-minute pedestrian destination counts across the ten cities measured here is 0.897 — against a US household-income Gini of about 0.41. That gap is the access problem this project surfaces. Existing tools measure walkability or income but rarely both at the same scale. Walk Score gives you a number without a breakdown. Census data gives you demographics without destinations. The pipeline this project builds is the layer that joins them — at neighborhood resolution, across ten cities, reproducibly.",
        "why": ["Pedestrian accessibility is one of the most direct determinants of daily quality of life for non-car-owning residents", "The income–walkability relationship varies by city structure — denser metros show richer-equals-more-access, sprawl-pattern metros show the reverse. Single-city studies miss this; a ten-city pipeline surfaces it.", "Existing tools either lack geographic specificity or can't be reproduced or updated"]
      },
      "approach": {
        "summary": "Built the data pipeline from scratch: cleaned and normalized POI data from Foursquare OS Places across 10 cities, generated census tract-level pedestrian isochrones through Valhalla at 5/10/20-minute intervals, joined isochrone coverage to POI counts using DuckDB spatial queries, and aggregated to H3 resolution 9 hexagons for the front-end layer. Mapbox GL JS handles all rendering. The dashboard frames three reader-facing questions — **how are you getting there** (walk, bike, drive), **what are you looking for** (pharmacy, grocery, park, transit, and more), and **how long are you willing to travel** (5, 10, or 20 minutes) — and repaints the city for every combination. Equity analytics are computed city-by-city and surfaced in an in-dashboard analytics panel with Spearman correlation, Gini coefficients, and quartile breakdowns.",
        "data": ["Python", "DuckDB", "Valhalla Routing Engine", "Tippecanoe", "Mapbox GL JS", "Cloudflare R2", "GeoJSON", "Census ACS", "Foursquare OS Places", "H3 Hexagonal Grid"],
        "moves": [
          {
            "title": "Cleaning and joining the data",
            "body": "Foursquare OS Places for the destinations, Census ACS B19013_001E for median household income, OpenStreetMap network data for the walking and driving graph. DuckDB does the spatial join at scale — projecting POIs into census tract polygons, dropping the ACS sentinel value (−666,666,666) before any downstream math, and producing one tract-level POI count per category before any isochrone work begins."
          },
          {
            "title": "Isochrones and hex aggregation",
            "body": "Valhalla generates pedestrian, bicycle, and auto travel-distance contours from each H3 resolution-9 cell centroid at 5, 10, and 20 minutes. The hex grid was chosen over census tracts because tract boundaries lie — a single tract can span a freeway. Hexes are ~0.1 km², roughly the size of two city blocks. The mode × category × time combinatorics produce 18 access scores per hex; the dashboard surfaces one at a time."
          },
          {
            "title": "Tile pipeline and front-end",
            "body": "Tippecanoe compresses the hex layer into PMTiles, hosted on Cloudflare R2 for sub-second loads. Mapbox GL JS renders. Adding a new city is a parameter swap — same tile schema, different bucket prefix, same per-city stats JSON contract. The pipeline runs end-to-end in roughly an hour per city; the cost is dominated by Valhalla routing, not rendering."
          },
          {
            "title": "Cross-city analytics",
            "body": "Spearman correlation, Gini coefficient, and income-quartile breakdowns computed per city offline and served as static JSON. The analytics modal compares cities apples-to-apples — same hex grid, same isochrone assumptions, same category buckets. The all-10-cities statistical significance finding came out of this pass; so did the direction-varies pattern."
          }
        ]
      },
      "results": {
        "before": ["No unified tool for cross-city pedestrian accessibility comparison at neighborhood scale", "Walking isochrones and income data never joined into a single queryable analytical layer", "Raw data sources required significant processing before spatial joins were feasible — no existing pipeline handled this at scale", "Front-end needed to balance analytical depth with interpretability for non-GIS audiences"],
        "after": ["End-to-end GIS pipeline processing 259K+ POIs across 454,000 hexagons in 10 cities, fully reproducible", "Statistically significant income–walk-access correlation in all 10 cities — but the direction reverses: in 7 metros, lower-income tracts have more walk access; in 3 (NYC, LA, San Diego) it runs the other way", "Median Gini coefficient for 20-minute walk access across the dataset: 0.897 — roughly twice the US household-income Gini", "Interactive dashboard deployed with city switching plus the three reader-facing questions (mode, category, time-band), and in-dashboard equity analytics including Spearman r, Gini, and quartile breakdown", "Framework documented for extension to additional cities, transit modes, or updated Census vintages"]
      },
      "takeaways": [
        { "title": "Infrastructure is the analysis", "body": "The hardest part of this project wasn't the map — it was the pipeline that makes the map trustworthy. Projection alignment, DuckDB spatial query optimization, tile generation performance, Valhalla routing configuration: none of these are glamorous, but all of them determine whether the analysis is valid. You can't separate the infrastructure from the insight. Building it correctly is the research." },
        { "title": "The story wasn't the gap. It was the direction.", "body": "An income–walkability gap shows up in every city in the dataset. The interesting finding was which way it ran. In dense metros (NYC, LA, San Diego), richer tracts walk to more. In sprawl-pattern metros (Phoenix, Fort Worth, Houston, Dallas), the relationship reverses — poorer, denser, older neighborhoods reach more on foot than the wealthier exurbs that surround them. A single-city study would have called this an artifact. Ten cities, same pipeline, makes it structural." }
      ]
    },

  {
    "num": "30",
    "id": "undl-idp",
    "title": "UN Digital Library",
    "short": "Designing for What Users Actually See",
    "desc": "The UN Digital Library's most-visited page is also where users give up. We ran the platform's first formal usability study. I owned the data layer — and the comparative SUS benchmark that gave the 46.4 score real institutional context, rather than letting it sit against a generic 68-point threshold.",
    "topic": "ux research",
    "type": "UX Research",
    "year": "2026",
    "affiliation": "pratt",
    "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/undl.png",
    "gallery": [
      "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Formatting.jpg",
      "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Matomo%20Results.jpg",
      "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Opacity%20Analytics.jpg",
      "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Rainbow%20Sheet.jpg",
      "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20SUS%20Result.jpg",
      "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Survery%20Result.jpg",
      "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Term%20Reccomendation.jpg"
    ],
    "media": [
      { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/undl.png" },
      { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Formatting.jpg" },
      { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Matomo%20Results.jpg" },
      { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Opacity%20Analytics.jpg" },
      { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Rainbow%20Sheet.jpg" },
      { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20SUS%20Result.jpg" },
      { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Survery%20Result.jpg" },
      { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20Term%20Reccomendation.jpg" }
    ],
    "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/UNDL%20IDP%20Final%20Report.pdf",
    "pdf_label": "UNDL Item Details Page Research",
    "figma": "https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/slides/8s86dGE2V3ADDe9NAxOc1B/UNDL-IDP-Final-Report",
    "sheets": null, "canva": null, "github": null, "live": null,
    "findings": [
      {
        "title": "Users looked for authors. The interface showed acronyms.",
        "observation": "When asked to identify the author of an IDP, participants saw 'UNCTAD' and couldn't tell if they were looking at a person, an organization, or a typo.",
        "evidence": "Opacity maps across eight participants show concentrated attention at the top of the page, followed by repeated dips into the Details section to verify authorship. Five of eight reported at the end of their session that they didn't know what the acronym meant.",
        "impact": "'Who is the author?' is one of the UNDL's most frequent service desk inquiries. The interface itself is generating the question.",
        "recommendation": "Where renaming isn't possible due to institutional taxonomy, add tooltips that expand acronyms in context. Where it is possible, lead with full names.",
        "image": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/undl-rec-tooltip.png"
      },
      {
        "title": "'Formats' meant something to users that it didn't mean to the UNDL",
        "observation": "Participants opened the Formats section expecting to choose a download format — PDF, Word — and found bibliographic citation styles instead.",
        "evidence": "Gaze maps show participants fixating on Formats for extended periods, opening multiple options, and reporting frustration. One participant: \"I don't even know what these mean. When I clicked on them, they're cut off so I don't think it worked.\"",
        "impact": "Time spent in the wrong section is the most measurable form of the labels-as-access-barrier problem — and the most common one we observed.",
        "recommendation": "Rename 'Formats' → 'Citation Formats.' Eliminates the ambiguity entirely without any structural change to the page.",
        "image": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/undl-rec-rename.png"
      },
      {
        "title": "Layout changes between record types had no visual explanation",
        "observation": "Some IDPs have a Download button. Some don't — because the underlying record hasn't been digitized. Users hitting the second case didn't know why the button was missing.",
        "evidence": "Heat maps show users scanning for the title and Download button on IDPs where neither exists, then giving up. P2: \"There's no title. I don't actually know what this page is — the last one had a title.\"",
        "impact": "This is one reason nearly half of UNDL survey respondents listed 'finding records' as their top pain point.",
        "recommendation": "Keep layout consistent across record types. Render the Download button in a disabled state with a tooltip routing users to a librarian for non-digitized records.",
        "image": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/rec-disabled-download.png"
      },
      {
        "title": "The IDP didn't meet WCAG readability minimums",
        "observation": "Half of participants flagged the IDP as hard to read because text was too small and too thin.",
        "evidence": "Body text rendered at 12px / 200 weight — below WCAG minimums for both size (14px) and weight (400).",
        "impact": "A readability failure on the most-visited page of a global public archive is also an accessibility compliance failure.",
        "recommendation": "Increase body text to 14px / 400 weight with proportional header scaling. No layout change required.",
        "image": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/undl-rec-font-wcag.png"
      }
    ],
    "statMoments": [
      {
        "value": "5 / 8",
        "label": "participants couldn't tell whether the IDP author was a person or an organization. Eye-tracking showed them repeatedly defaulting to the Details section to verify."
      },
      {
        "value": "46.4",
        "label": "SUS score against an industry benchmark of 68. Below every peer platform in the comparative benchmark set.",
        "svg": "<svg viewBox=\"0 0 700 240\" xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-labelledby=\"sus-title\" aria-describedby=\"sus-desc\"><title id=\"sus-title\">SUS Score 46.4 out of 100</title><desc id=\"sus-desc\">A 0-to-100 System Usability Scale showing the score 46.4 in accent color, positioned 21.6 points below the industry benchmark of 68 which is marked with a dashed line.</desc><text x=\"350\" y=\"50\" text-anchor=\"middle\" style=\"font-family: var(--font-display), 'Cabinet Grotesk', sans-serif; font-size: 56px; font-weight: 500; fill: var(--accent);\">46.4</text><text x=\"350\" y=\"78\" text-anchor=\"middle\" style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; fill: var(--fg); opacity: 0.55;\">out of 100</text><line x1=\"100\" y1=\"140\" x2=\"600\" y2=\"140\" style=\"stroke: var(--fg)\" stroke-width=\"1\" opacity=\"0.25\"/><g style=\"stroke: var(--fg)\" stroke-width=\"1\" opacity=\"0.35\"><line x1=\"100\" y1=\"134\" x2=\"100\" y2=\"146\"/><line x1=\"225\" y1=\"134\" x2=\"225\" y2=\"146\"/><line x1=\"350\" y1=\"134\" x2=\"350\" y2=\"146\"/><line x1=\"475\" y1=\"134\" x2=\"475\" y2=\"146\"/><line x1=\"600\" y1=\"134\" x2=\"600\" y2=\"146\"/></g><g style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 11px; fill: var(--fg); opacity: 0.5;\" text-anchor=\"middle\"><text x=\"100\" y=\"163\">0</text><text x=\"225\" y=\"163\">25</text><text x=\"350\" y=\"163\">50</text><text x=\"475\" y=\"163\">75</text><text x=\"600\" y=\"163\">100</text></g><line x1=\"440\" y1=\"105\" x2=\"440\" y2=\"150\" style=\"stroke: var(--fg)\" stroke-width=\"1\" opacity=\"0.6\" stroke-dasharray=\"3 3\"/><text x=\"440\" y=\"98\" text-anchor=\"middle\" style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; fill: var(--fg); opacity: 0.7;\">Industry benchmark · 68</text><circle cx=\"332\" cy=\"140\" r=\"14\" fill=\"none\" style=\"stroke: var(--accent)\" stroke-width=\"1\" opacity=\"0.3\"/><circle cx=\"332\" cy=\"140\" r=\"9\" style=\"fill: var(--accent)\"/><path d=\"M 332 168 L 332 178 L 440 178 L 440 168\" fill=\"none\" style=\"stroke: var(--fg)\" stroke-width=\"1\" opacity=\"0.4\"/><text x=\"386\" y=\"195\" text-anchor=\"middle\" style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 11px; fill: var(--fg); opacity: 0.6;\">21.6 points below</text><text x=\"100\" y=\"220\" text-anchor=\"start\" style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 12px; letter-spacing: 0.05em; fill: var(--fg); opacity: 0.7;\">Not acceptable</text><text x=\"600\" y=\"220\" text-anchor=\"end\" style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 12px; letter-spacing: 0.05em; fill: var(--fg); opacity: 0.7;\">Excellent</text></svg>"
      },
      {
        "value": "1.9 / 7",
        "label": "average SEQ difficulty on the linked-record task. All eight participants reported low confidence — even the five who completed it correctly.",
        "svg": "<svg viewBox=\"0 0 700 220\" xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-labelledby=\"seq-title\" aria-describedby=\"seq-desc\"><title id=\"seq-title\">SEQ Score 1.9 out of 7</title><desc id=\"seq-desc\">A 7-point ease scale labeled Very Difficult on the left and Very Easy on the right, with 1.9 marked near the Very Difficult end in accent color.</desc><text x=\"350\" y=\"50\" text-anchor=\"middle\" style=\"font-family: var(--font-display), 'Cabinet Grotesk', sans-serif; font-size: 56px; font-weight: 500; fill: var(--accent);\">1.9</text><text x=\"350\" y=\"78\" text-anchor=\"middle\" style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; fill: var(--fg); opacity: 0.55;\">out of 7</text><line x1=\"100\" y1=\"130\" x2=\"600\" y2=\"130\" style=\"stroke: var(--fg)\" stroke-width=\"1\" opacity=\"0.25\"/><g style=\"stroke: var(--fg)\" stroke-width=\"1\" opacity=\"0.35\"><line x1=\"100\" y1=\"124\" x2=\"100\" y2=\"136\"/><line x1=\"183.33\" y1=\"124\" x2=\"183.33\" y2=\"136\"/><line x1=\"266.67\" y1=\"124\" x2=\"266.67\" y2=\"136\"/><line x1=\"350\" y1=\"124\" x2=\"350\" y2=\"136\"/><line x1=\"433.33\" y1=\"124\" x2=\"433.33\" y2=\"136\"/><line x1=\"516.67\" y1=\"124\" x2=\"516.67\" y2=\"136\"/><line x1=\"600\" y1=\"124\" x2=\"600\" y2=\"136\"/></g><g style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 11px; fill: var(--fg); opacity: 0.5;\" text-anchor=\"middle\"><text x=\"100\" y=\"153\">1</text><text x=\"183.33\" y=\"153\">2</text><text x=\"266.67\" y=\"153\">3</text><text x=\"350\" y=\"153\">4</text><text x=\"433.33\" y=\"153\">5</text><text x=\"516.67\" y=\"153\">6</text><text x=\"600\" y=\"153\">7</text></g><circle cx=\"175\" cy=\"130\" r=\"14\" fill=\"none\" style=\"stroke: var(--accent)\" stroke-width=\"1\" opacity=\"0.3\"/><circle cx=\"175\" cy=\"130\" r=\"9\" style=\"fill: var(--accent)\"/><text x=\"100\" y=\"185\" text-anchor=\"start\" style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 12px; letter-spacing: 0.05em; fill: var(--fg); opacity: 0.7;\">Very Difficult</text><text x=\"600\" y=\"185\" text-anchor=\"end\" style=\"font-family: var(--font-body), 'Satoshi', sans-serif; font-size: 12px; letter-spacing: 0.05em; fill: var(--fg); opacity: 0.7;\">Very Easy</text></svg>"
      }
    ],
    "quotes": [
      {
        "text": "I tried to find a person's name first — saw UNCTAD, which I think is a company, not a person's name.",
        "attribution": "P7, on author identification",
        "pairsWithFinding": 0
      },
      {
        "text": "I thought 'Formats' was available document formats. I don't even know what these mean.",
        "attribution": "P3, on the Formats section",
        "pairsWithFinding": 1
      },
      {
        "text": "There's no title. I don't actually know what this page is — the last one had a title.",
        "attribution": "P2, on the IDP without a download button",
        "pairsWithFinding": 2
      },
      {
        "text": "I really, really love the way that you set the stakes and brought us through it.",
        "attribution": "Ariel Lebowitz, Librarian and Communications & Outreach Specialist, Dag Hammarskjöld Library, United Nations",
        "pairsWithFinding": null
      },
      {
        "text": "It's really gonna help us — getting into the mindset of rethinking even the language is a big win.",
        "attribution": "Megan Wacha, Scholarly Communications Officer, Dag Hammarskjöld Library, United Nations",
        "pairsWithFinding": null
      },
      {
        "text": "Outstanding final report. Your team delivered a rigorous, well-thought-out UXR study — highly impressed by how effectively you triangulated multiple data streams given the scope. The deck tells a great story and breaks the findings into clear recommendations. Great work across all deliverables.",
        "attribution": "Kat Chiluiza, Lead Design Researcher at athenahealth · Visiting Professor, School of Information, Pratt Institute",
        "pairsWithFinding": null
      }
    ],
    "impact": {
      "usability": "Four implementation-ready specifications targeting the highest-frequency user failures observed in moderated sessions — relabeling, tooltips, disabled-state pattern, and typography compliance.",
      "operational": "Recommendations target the interface-level source of the UNDL's most-asked service desk questions, reducing helpdesk load by addressing root cause rather than triaging symptom.",
      "accessibility": "Body content brought into WCAG compliance via the 14px / 400 weight typography update, with proportional header scaling to preserve hierarchy.",
      "discoverability": "Layout consistency and disabled-state tooltips designed to route users toward non-digitized records — not let them disappear into silent dead-ends.",
      "scalability": "Specifications scoped to the existing vendor relationship — implementable per record-type template, no full platform rebuild required.",
      "institutional": "Delivered to the UNDL's Chief of Information Management Section, with a pending invitation to present findings to the broader library and tech department."
    },
    "statements": [
      "When the dataset is 82.5% noise, the cleaning is the analysis.",
      "A successful task and a confident user aren't the same thing.",
      "Specialist language isn't neutral — it's an access barrier with traffic numbers attached."
    ],
    "context": {
      "problem": "The United Nations Digital Library hosts one of the world’s largest institutional archives — but its most-visited page was quietly failing the people trying to use it. Researchers struggled to interpret specialist terminology, layouts shifted unpredictably across record types, and the platform’s analytics were so bot-saturated that the UNDL couldn’t reliably measure real user behavior. Before we could evaluate the interface itself, we first had to rebuild a trustworthy picture of how people were actually using it.",
      "why": [
        "The UNDL serves a global audience of researchers, journalists, diplomats, and students — even marginal usability improvements compound across an institutional audience",
        "The Item Details Page is the highest-traffic page on the site, and the platform had never undergone a formal usability study before this engagement",
        "Recommendations needed to be scoped for institutional constraints — implementable against an existing vendor relationship, not dependent on a full redesign"
      ],
      "collaboration": "None of this happens without Sara Her, Shelly Guan, and Liwei Jiang.  The 36-issue rainbow sheet, the two key findings, and the final deck were collective work — what I owned was the data layer, the cross-stream join, and the SUS benchmark that anchored the recommendation list at delivery."
    },
    "approach": {
      "summary": "I led the analytical layer of the study — cleaning and reconstructing behavioral data, operationalizing usability metrics, and translating raw session outputs into defensible findings.",
      "data": ["Pandas", "Tobii Pro Eye Tracking", "Retrospective Think-Aloud", "SUS Scoring", "SEQ Task Evaluation", "Matomo Analytics", "Comparative Benchmarking", "Figma", "Miro", "Survey Design", "Stakeholder Presentation"],
      "moves": [
        {
          "title": "Building the data layer",
          "body": "Matomo's session data was 82.5% bot traffic. Cleaning it wasn't preprocessing — it was the first finding of the study, and the precondition for trusting anything downstream. From there, I structured SUS, SEQ, and open-ended survey responses into a single dataset that made cross-method validation possible, and distributed results so the team could align on severity before the 36-issue rainbow sheet was finalized."
        },
        {
          "title": "Conducting in-person eye-tracking study",
          "body": "Across eight moderated sessions, Tobii captured fixations, RTA captured what participants said, and SUS and SEQ captured confidence. None of those streams meant much alone. I built the join — so 'users defaulted to the Details section to verify authorship' is backed by gaze data, a quote, and a confidence score, not just one of them."
        },
        {
          "title": "Benchmarking against peer archives",
          "body": "The 46.4 SUS score landed differently when stakeholders could see it anchored against named peer platforms instead of a generic industry threshold. The benchmark was what made the recommendation list defensible at delivery."
        }
      ]
    },
    "results": {
      "before": [
        "Eye-tracking opacity maps and gaze plots showed users defaulting to the Details section to verify authorship — the interface's specialist labels were generating the very questions the UNDL service desk fielded most often",
        "Across eight moderated sessions, no participant reported confidence in their results, even on the tasks they successfully completed — the linked-record task averaged 1.9 / 7 on SEQ difficulty",
        "Cross-method validation surfaced 36 distinct usability issues, prioritized by severity and frequency across the participant pool"
      ],
      "after": [
        "Two key findings consolidated from the 36-issue rainbow sheet — (1) specialist labels and terminology create access barriers; (2) inconsistent layouts and sub-WCAG typography compound them",
        "Four implementation-ready recommendations scoped against the existing vendor relationship — 'Formats' → 'Citation Formats,' a tooltip pattern for terms locked to internal taxonomy, a disabled-state Download pattern for non-digitized records, and a 14px / 400-weight typography update for WCAG compliance",
        "Final report delivered to the UNDL's Chief of Information Management Section, with a pending invitation to present findings to the broader library and tech department"
      ]
    },
    "takeaways": [
      {
        "title": "Data reveals where users struggle. The real work is making the reason impossible to ignore.",
        "body": "Every heatmap gap is a specific, diagnosable failure — a visual hierarchy problem, a contrast issue, an affordance that doesn't communicate what it needs to. But that diagnosis only holds if the underlying data is clean, consistently structured, and contextualized against something real. The comparative benchmark didn't just add a slide to the presentation — it changed how stakeholders heard the SUS score. Numbers land differently when they're anchored. That's the work."
      },
      {
        "title": "A successful task and a confident user aren't the same thing.",
        "body": "Five of eight participants completed the linked-record task correctly. Every one of them, including the five who succeeded, rated the task at 1.9 / 7 difficulty and reported they didn't trust they'd found the right thing. Task completion is a binary the interface measures easily. Confidence is the variable it actually changes. When eye-tracking and self-report tell different stories about the same moment, that gap is where the design work lives."
      },
      {
        "title": "Specialist language isn't neutral — it's an access barrier with traffic numbers attached.",
        "body": "The UNDL's labels weren't wrong; they were internally consistent with a bibliographic system built by experts for experts. But every general-public user who left without finding a document was a measurable cost of that consistency. The recommendation — relabel where you can, tooltip where you can't — is small. The principle is bigger. Every specialist label assumes the user already speaks the system’s language."
      }
    ]
  },

  {
      "num": "29",
      "id": "amon-carter-analytics",
      "title": "Amon Carter Museum",
      "short": "Making a World-Class Collection Findable Online",
      "desc": "A comprehensive digital analytics and SEO audit of the Amon Carter Museum of American Art in Fort Worth. The Amon Carter has a nationally significant collection — world-class photography holdings, Ansel Adams, Georgia O'Keeffe — but its digital presence wasn't reflecting that significance in search. This project was about understanding exactly why, and building a prioritized roadmap to change it.\n\nCultural institutions face a specific digital challenge: their value is self-evident to people who already know them, and nearly invisible to everyone else. The audit was designed to measure that gap and close it.",
      "topic": "analytics",
      "type": "Data Strategy",
      "year": "2025",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/amon-carter-sd.png",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/amon-carter-analytics-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/amon-carter-analytics-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Amon%20Carter%20Museum%20-%20Digital%20Analysis%20compressed.pdf",
      "pdf_label": "Amon Carter Museum Digital Analysis",
      "figma": "https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/slides/qAdfvqwVitl7kLyXTJ3EZK/Amon-Carter-Museum---Digital-Analysis",
      "sheets": "https://docs.google.com/presentation/d/1I5UVwKtHquX6FS57xzJl1zMliOr4kz781Xbgu0-nU3k/preview",
      "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The Amon Carter's organic search performance was limited almost entirely to branded queries — people already looking for the museum by name. Non-branded discovery, the pathway for new audiences who don't yet know the museum exists, was essentially absent. The audit needed to diagnose the structural reasons for that gap: technical issues, content alignment failures, and backlink profile weaknesses all contributing."
      },
      "approach": {
        "summary": "Used GA4 behavioral data, SEMrush for keyword and competitive analysis, and Screaming Frog for a full technical crawl. Combined with a manual content audit to build a complete picture of digital performance across technical health, search visibility, and content relevance. Findings were organized into three tiers: quick wins, medium-term structural changes, and long-term content strategy investments — each with estimated impact and implementation complexity scoring.",
        "data": ["GA4", "SEMrush", "Screaming Frog", "Excel", "Competitive Analysis", "Content Audit", "Technical SEO"]
      },
      "results": {
        "before": ["Organic traffic almost entirely branded — new audience discovery near zero", "Technical SEO issues affecting page indexing and crawl efficiency across collection pages", "Content not structured around the actual search queries used by potential visitors", "No clear KPI framework for tracking digital performance over time"],
        "after": ["Prioritized SEO roadmap with 23 specific recommendations across technical, on-page, and content layers", "Identified 14 high-volume non-branded keyword opportunities with low competition and direct relevance to the collection", "Proposed a KPI framework for ongoing tracking across traffic, engagement, and conversion dimensions", "Delivered recommendations with estimated impact scoring so the team could sequence implementation by return on effort"]
      },
      "takeaways": [
        { "title": "Institutions with irreplaceable collections should have proportional digital visibility", "body": "There's something genuinely frustrating about a museum with world-class American art being effectively invisible in search results. Digital strategy isn't optional for cultural institutions anymore — it's how new audiences discover that these places exist. The collection deserves to be found." }
      ]
    },

  {
      "num": "28",
      "id": "incalculable-loss",
      "title": "Incalculable Loss",
      "short": "Accessibility Without Sanitizing the Art",
      "desc": "A collaborative accessibility design project developed in partnership with the Cooper Hewitt Smithsonian Design Museum, built around a genuine constraint: we could not modify the original work. Incalculable Loss is an interactive digital memorial originally published by the New York Times documenting the first 100,000 COVID-19 deaths in the US — a piece that is deliberately chaotic, overwhelming, and difficult to parse. That difficulty is the artistic statement.\n\nOur job was to design an accessible layer around it: a structured framing experience that allows screen reader users, low-vision users, and keyboard-only users to engage meaningfully with a piece that resists engagement by design. It's the hardest UX problem I've worked on, because the usual playbook — add clarity, reduce friction, create predictability — would have destroyed what made the work significant.",
      "topic": "ux research",
      "type": "UX Design",
      "year": "2025",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/incalculable-loss-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/incalculable-loss-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/incalculable-loss-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Incalculable%20Loss-compressed.pdf",
      "pdf_label": "Incalculable Loss - Accessibility Case Study",
      "figma": "https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/slides/xELHx8u7ImAM4NIzF2l5Q2/Digital-Accessibility---Deck",
      "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "impact": null, "statements": null,
      "quotes": [
        {
          "text": "Loved the emphasis on empathetic design.",
          "attribution": "Liza Burroughs, UX Researcher (Accessibility) at Google · Visiting Professor, Pratt Institute",
          "pairsWithFinding": null
        }
      ],
      "furtherReading": [
        {
          "label": "Lineages and Legacies for Collecting Digital Design",
          "meta": "Walthew & Lipps · Journal of Design History · 2026",
          "note": "Cooper Hewitt's institutional reflection on collecting An Incalculable Loss as a web archive, written by curator Andrea Lipps (the museum collaborator on this project) and conservator Jessica Walthew. The paper situates the NYT piece within a 'performance' lineage for digital design and describes how the museum preserved its self-paced scroll experience as primary asset.",
          "url": "https://academic.oup.com/jdh/advance-article-abstract/doi/10.1093/jdh/epaf039/8436893"
        },
        {
          "label": "Nat Cheng — Incalculable Loss",
          "meta": "Collaborator's portfolio writeup",
          "note": "Project teammate's case study of the same Cooper Hewitt accessibility engagement, with the team's own visuals and process documentation.",
          "url": "https://natjcheng.com/incalculableloss"
        }
      ],
      "context": {
        "problem": "The original NYT piece was built as a continuous scroll with no semantic structure, making screen reader traversal disorienting and nonlinear. Custom links were largely non-functional, creating dead ends for keyboard users. Emotional and narrative content — obituary snippets, death counts, individual stories — was invisible to assistive technology. The Cooper Hewitt had no mechanism to surface the piece's meaning to users who couldn't see it, and no permission to touch the original code.",
        "constraints": ["Could not modify any code in the original NYT piece", "Solution had to be implementable as a non-destructive overlay layer", "Accessibility improvements had to preserve the intentional emotional weight and chaos of the piece"]
      },
      "approach": {
        "summary": "Designed a persistent side panel delivering a structured, screen-reader-friendly linear narrative path synchronized with the scroll experience. Developed a three-level content taxonomy — death date and count, white card text, individual background obituaries — mapped to custom keyboard shortcuts for direct navigation. The key decision was maintaining two paths: a linear guided experience that honors the scroll, and an autonomous navigation mode for users who want control over their own path through the content.",
        "data": ["Figma", "WCAG 2.1+", "BeautifulSoup (HTML extraction analysis)", "Screen Reader Testing — NVDA, VoiceOver, JAWS", "ARIA", "Miro", "Cooper Hewitt Stakeholder Collaboration"]
      },
      "results": {
        "before": ["Zero structured navigation path for screen reader users in the existing piece", "Custom links non-functional — keyboard navigation hit dead ends throughout", "Emotional narrative content (obituaries, individual stories) completely invisible to assistive technology", "No accessible entry state to frame the piece before users entered it", "WCAG 2.1 compliance failures across color contrast, keyboard trapping, and focus management"],
        "after": ["Persistent side panel providing synchronized linear narrative path for screen reader traversal", "Three-level keyboard navigation taxonomy with custom shortcut layer for autonomous exploration", "Accessible entry state designed to communicate the piece's intent before the user encounters its chaos", "BeautifulSoup HTML analysis identified specific class targets for non-destructive overlay implementation", "WCAG 2.1+ annotated Figma prototype covering every keyboard pattern and ARIA implementation", "Full case study and technical recommendation document delivered to Cooper Hewitt as stakeholder artifact"]
      },
      "takeaways": [
        { "title": "Accessibility and artistic intent are not opposites — they require negotiation", "body": "The hardest design constraint wasn't technical. It was philosophical: the piece is inaccessible by design. Its chaos, its overwhelming scale, its refusal to organize — these are the artistic statement. Making it accessible without sanitizing that statement required understanding what the experience is meant to do emotionally, then finding ways to honor that through structure. That negotiation is the work." }
      ]
    },

  {
      "num": "27",
      "id": "jif-site-audit",
      "title": "JIF.com Audit",
      "short": "A Brand Everyone Knows, Invisible in Search",
      "desc": "A technical and strategic SEO audit of JIF.com — a site for one of the most recognizable consumer brands in American kitchens. JIF has the kind of name recognition most brands would spend their entire digital budget to acquire. And yet the site was performing significantly below its potential in organic search, particularly for the non-branded queries that drive new audience discovery.\n\nThis audit was an exercise in understanding the gap between brand awareness and digital visibility — and building a specific roadmap to close it.",
      "topic": "seo",
      "type": "Audit",
      "year": "2025",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/jif-sd.png",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/jif-site-audit-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/jif-site-audit-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/SEO%20Audit%20for%20Jif.com%20Guideline-compressed.pdf",
      "pdf_label": "SEO Audit for JIF.com",
      "figma": "https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/slides/1MLb8sAkRC3Tja9UHCcZqE/Jig-Assignment",
      "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "JIF's search visibility was almost entirely brand-driven — people searching 'JIF peanut butter' found it easily. People searching 'peanut butter recipes,' 'best peanut butter for baking,' or 'how to store peanut butter' — all high-volume queries with direct JIF relevance — were landing on competitor and food media sites. The technical audit revealed specific crawlability and link equity issues. The content audit revealed a site not organized around how people actually search."
      },
      "approach": {
        "summary": "Used Screaming Frog for a full technical crawl identifying indexing, crawlability, and internal linking issues. SEMrush provided keyword gap analysis and competitive benchmarking to quantify the non-branded search opportunity. Findings were triaged by implementation difficulty and traffic impact to create a phased roadmap that prioritized fast wins without deprioritizing structural changes.",
        "data": ["Screaming Frog", "SEMrush", "Google Search Console", "Technical SEO", "Content Gap Analysis", "Structured Data Evaluation"]
      },
      "results": {
        "before": ["Technical issues blocking efficient crawling of high-value recipe and product pages", "Recipe content not optimized for the search queries driving the most relevant inbound traffic", "No structured data implementation — significant featured snippet opportunities missed entirely", "Backlink profile strong on branded terms, nearly absent on category and recipe terms"],
        "after": ["Identified 31 specific technical fixes across crawlability, internal linking, and page speed", "Built a content gap map showing 40+ keyword opportunities aligned with existing JIF content", "Structured data implementation recommended across all recipe pages with projected featured snippet capture", "Phased roadmap delivered with effort-to-impact scoring for every recommendation"]
      },
      "takeaways": [
        { "title": "Brand recognition doesn't transfer to search visibility automatically", "body": "People know JIF. Google doesn't rank on familiarity — it ranks on signals. SEO is earned through structure, content alignment, and technical execution, not inherited through decades of brand awareness. That gap is surprisingly common among legacy consumer brands, and it's almost always fixable." }
      ]
    },

  {
      "num": "26",
      "id": "nyc-tourism-final",
      "title": "NYC Tourism Redesign",
      "short": "From IA Research to Applied Design",
      "desc": "A full research-to-redesign project examining NYCTourism.com through the lens of its most underserved audience: local business owners trying to participate in the tourism ecosystem. The site was built primarily for tourists, and it showed. Business owners — looking for submission forms, partnership pathways, and participation opportunities — were navigating a structure that simply wasn't designed for their goals.\n\nThe project ran in two connected phases: an IA research study combining interviews, card sorting, and tree testing to surface the gap between the site's structure and business-owner mental models, followed by a full Figma redesign translating those findings into an applied solution. Every design decision was anchored to a specific research finding — which makes the process harder but the outcome far more defensible.",
      "topic": "ux research",
      "type": "UX Design",
      "year": "2025",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/nyc-tourism-sd.png",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/nyc-tourism-final-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/nyc-tourism-final-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/Final%20Presentation%20-%20NYCTourism%20Communicating%20User%20Research.pdf",
      "pdf_label": "NYC Tourism Redesign - Final Presentation",
      "figma": "https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/slides/ApwB2KG4pKoDg5tlS8Gr9v/Final-Presentation---NYCTourism-Communicating-User-Research",
      "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "impact": null, "statements": null,
      "quotes": [
        {
          "text": "Good job, Kevin. I really like that you approached this case study with your marketing and data visualization expertise — it made it a very personal case study tailored to your goals. Your title was captivating and the overall structure and storytelling made sense.",
          "attribution": "Johna Shi, Senior Product Designer at JPMorgan Chase & Co. · Visiting Assistant Professor, School of Information, Pratt Institute",
          "pairsWithFinding": null
        }
      ],
      "context": {
        "problem": "NYCTourism.com has two meaningfully different user groups with conflicting mental models: tourists looking for things to do, and businesses looking to participate in the tourism ecosystem. The site's IA was built almost entirely for the former, leaving the latter to navigate a structure never designed for their goals. Business-related pathways were buried, inconsistently labeled, and written in language only internal teams used.",
        "why": ["Business owners represent a revenue-generating segment the tourism authority has direct interest in retaining", "Card sorting revealed that users grouped business-facing content under categories the site didn't have", "Tree testing showed sub-40% task success rates on key business-owner navigation paths"]
      },
      "approach": {
        "summary": "Phase one: recruited five business owner participants, ran semi-structured interviews to map mental models, card sorting to surface categorization expectations, and tree testing to validate specific navigation paths with quantified success rates. Phase two: built a Figma prototype introducing dual entry pathways — one for visitors, one for businesses — unified under a shared visual system, iterated through three feedback rounds, and validated the revised structure through second-round usability testing.",
        "data": ["Semi-Structured Interviews", "Card Sorting", "Tree Testing", "Optimal Workshop", "Figma", "Miro", "Zoom", "Iterative Prototyping", "Usability Testing"]
      },
      "results": {
        "before": ["Business owners couldn't locate participation pathways in under three attempts on average", "Navigation labels written in internal taxonomy — not the language users actually used", "Single IA structure trying to serve two audiences with fundamentally incompatible goals", "No clear entry point differentiation between tourist-facing and business-facing content"],
        "after": ["Dual-entry navigation system with clear audience routing established at the homepage level", "Business-facing pathways surfaced to primary navigation, removing the need to hunt through tourist content", "All revised labels drawn directly from language used in participant interviews", "Second-round usability testing showed 80%+ task success rate across both audience types"]
      },
      "takeaways": [
        { "title": "A site can't serve two audiences well if it treats them as one", "body": "The moment you have two user types with genuinely different goals and mental models, you have an IA problem that content updates alone can't solve. You need separate entry points and separate structural logic. Trying to serve everyone through the same architecture serves no one particularly well." },
        { "title": "Research is only useful when it drives decisions, not just documents problems", "body": "The midterm study surfaced the gap clearly. The final redesign was the test of whether those findings could be translated into something real. Every design decision that couldn't be traced to a specific research finding got questioned. That constraint is uncomfortable, but it's what makes the output trustworthy." }
      ]
    },

  {
      "num": "25",
      "id": "eyewear-sales-analysis",
      "title": "Eyewear Sales Analysis",
      "short": "100K+ Rows and One Real Question",
      "desc": "This project started from an actual problem at work. I manage department store accounts at EssilorLuxottica, and the sales data I work with daily — SKU-level, multi-account, multi-brand — is enormous and fragmented across export formats. Our team was spending more time cleaning and reconciling data than actually analyzing it. I wanted to build something that changed that ratio.\n\nThe question wasn't just 'what does the data say.' It was: what's actually driving eyewear sales performance, and can we build a framework that makes that question answerable every time without starting from scratch?",
      "topic": "data analysis",
      "type": "Analytics",
      "year": "2025",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/eyewear-sales-analysis-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/eyewear-sales-analysis-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/eyewear-sales-analysis-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/What%27s%20Driving%20Eyewear%20Sales_.pdf",
      "pdf_label": "What's Driving Eyewear Sales?",
      "figma": null,
      "sheets": "https://docs.google.com/presentation/d/1q4ruGfN-bCCI1i_v5cMW1qyRFMrZO2nFbQ2qWVwSDFg/preview",
      "canva": null,
      "github": "https://github.com/cloonkie/Retail-R-Analytics/tree/main",
      "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The raw sales data existed across multiple export formats with inconsistent field naming, duplicated entries, and non-standardized category codes that varied by account. Before any analysis was possible, the data needed normalization. But normalization isn't the interesting part — it's the cost of admission. The real question was about performance drivers: which product attributes predict sell-through? How does pricing interact with promotional activity? Where are the account-level patterns hiding in the aggregate numbers?"
      },
      "approach": {
        "summary": "Cleaned and standardized 100K+ rows of eyewear sales data in R using tidyverse, built a normalization pipeline handling the most common inconsistency patterns across account exports, then ran exploratory analysis through ggplot2 to surface performance patterns across price tier, brand, account type, and promotional cadence. The framework was built to be repeatable — not a one-time analysis, but a reusable structure for ongoing quarterly reporting.",
        "data": ["R", "tidyverse", "ggplot2", "Excel", "Data Cleaning", "Exploratory Analysis", "Retail Analytics"]
      },
      "results": {
        "before": ["Data cleaning consumed the majority of analysis time, leaving limited capacity for actual insight generation", "No consistent way to compare performance across brands within the same account due to naming inconsistencies", "Promotion impact on sell-through was unmeasured and therefore unmanaged", "Pricing analysis limited to snapshot comparisons — no framework for trend analysis"],
        "after": ["Built a normalized data pipeline reducing prep time by approximately 70% on subsequent analyses", "Identified price tier as the strongest single predictor of promotional lift across brands", "Surfaced three account-level performance patterns invisible in aggregate reporting", "Framework adopted informally by the team for subsequent quarterly review cycles"]
      },
      "takeaways": [
        { "title": "The most valuable analysis I've done used real data with real stakes", "body": "There's a meaningful difference between learning R through tutorials and using it to answer a question your team genuinely needs answered by Friday. The stakes change your relationship to the work, and the constraints change the quality of the output. Real messy data is a better teacher than any cleaned dataset." }
      ]
    },

  {
      "num": "24",
      "id": "eyewear-db",
      "title": "Eyewear Database System",
      "short": "Normalizing 15 Tables of Sales Reality",
      "desc": "A database design project built on the same retail data universe as the Eyewear Sales Analysis — but where that project asked analytical questions, this one asked structural ones. How should this data actually be organized? What does a relational schema look like that makes every analytical question faster and every report more reliable?\n\nBuilt in SQL from the ground up with real SPS Reporting data from EssilorLuxottica as the source material, the system covers product, retailer, account, and time dimensions with automated inventory triggers and 13 analytical query templates designed for the actual reporting use cases my team runs.",
      "topic": "data analysis",
      "type": "Data Engineering",
      "year": "2025",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/eyewear-db-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/eyewear-db-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/eyewear-db-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/Eyewear%20Database%20Slides.pdf",
      "pdf_label": "Eyewear Database Slides",
      "figma": "https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/slides/4sktzXNoRfRS9Xn3GlDhZo/Eyewear-Database-Slides",
      "sheets": null, "canva": null,
      "github": "https://github.com/cloonkie/Database-Design",
      "live": null, "findings": null, "statMoments": null, "impact": null, "statements": null,
      "quotes": [
        {
          "text": "Your implemented Sales database looks good and you carried through your design from the earlier stage consistently, with the revisions we discussed along the way. You added a good amount of representative data to demonstrate your database's use with the queries provided, and your queries were nicely complex, leveraging many of the techniques we've covered this semester.",
          "attribution": "Monica Maceli, Professor, Pratt Institute",
          "pairsWithFinding": null
        }
      ],
      "context": {
        "problem": "The source data was structured for export, not analysis. The same product could appear under three different naming conventions depending on which account it came from. Retailer codes weren't normalized across brands. Time dimensions were split across columns requiring transformation before any trend analysis was possible. The database design challenge: build the schema that makes this data reliably queryable without those transformations every time.",
        "constraints": ["Schema had to accommodate products across multiple brands with different attribute structures", "Needed to support both transactional reporting and time-series analysis without separate tables", "Inventory trigger logic had to work without a persistent connection to live POS data"]
      },
      "approach": {
        "summary": "Designed a normalized relational schema across 15 tables covering product hierarchy, retailer and account structure, sales transactions, inventory state, and time dimensions. Built in check constraints and referential integrity rules to prevent the data quality failures that had made the original flat files unreliable. Wrote 13 parameterized query templates covering the most common reporting use cases from actual team workflows.",
        "data": ["SQL", "Database Design", "Normalization", "ERD Modeling", "Trigger Design", "Referential Integrity", "Query Optimization"]
      },
      "results": {
        "before": ["Product naming inconsistencies required manual reconciliation before any cross-brand analysis", "No referential integrity between sales transactions and product or retailer records", "Inventory triggers nonexistent — stock-out events only discoverable after the fact", "Ad-hoc analytical queries required 30-50 lines of data preparation before any actual analysis logic"],
        "after": ["15-table normalized schema with full referential integrity across product, retailer, and time dimensions", "Automated inventory triggers flagging reorder thresholds before stock-out events occur", "13 parameterized query templates reducing ad-hoc analysis setup from hours to minutes", "Schema designed for extensibility — new brands and accounts can be added without structural changes to existing tables"]
      },
      "takeaways": [
        { "title": "A good schema is a decision you make once that pays off every time you run a query", "body": "The cost of a poorly designed database compounds over time. Every query written against a bad schema is harder than it needs to be. Getting the structure right at the beginning is the highest-leverage decision in any data project — more important than the analysis tools, more important than the visualization layer. The foundation is the work." }
      ]
    },

  {
      "num": "23",
      "id": "rooted-in-data",
      "title": "Rooted in Data",
      "short": "The Equity Story Inside Tree Canopy Data",
      "desc": "A data visualization poster examining the distribution of urban tree canopy across New York City's five boroughs — and the equity argument buried inside that distribution. Trees in cities aren't randomly placed. They're the product of decades of investment decisions, and those decisions have followed familiar patterns: more trees in wealthier neighborhoods, fewer in lower-income ones. This poster was an attempt to make that argument visually — rigorous enough to be taken seriously as analysis, designed well enough to reach people who don't read academic papers.\n\nGrowing up in Brooklyn, this one felt personal.",
      "topic": "data analysis",
      "type": "Design",
      "year": "2025",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/rooted-in-data-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/rooted-in-data-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/rooted-in-data-1.jpg" }],
      "pdf": null,
      "pdf_label": "Rooted in Data Poster",
      "figma": "https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/design/INAECV26h3cHgS86pNJMry/Final-Portfolio-Poster",
      "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The NYC Parks Department tree census data is publicly available, detailed, and largely invisible to the public conversation about environmental equity. The challenge was translating it from a technical dataset into a visual argument that a general audience could engage with — without sacrificing the analytical rigor that makes the argument credible. That tension between accessibility and accuracy is the central design problem in data communication.",
        "why": ["NYC's urban heat island effect falls disproportionately on neighborhoods with lower canopy coverage", "The correlation between income and canopy density is statistically significant but rarely visualized clearly", "Existing coverage of tree equity was text-heavy and inaccessible to general audiences"]
      },
      "approach": {
        "summary": "Cleaned and merged the NYC tree census with American Community Survey income and demographic data in R, built spatial visualizations using ggplot2, and designed the final poster layout in Figma and Illustrator. Every analytical decision — which variables to map, how to bin income quartiles, which borough comparisons to foreground — was as deliberate as every design decision. The two processes were genuinely inseparable.",
        "data": ["R", "ggplot2", "NYC Open Data", "Census ACS", "Figma", "Illustrator", "Spatial Analysis"]
      },
      "results": {
        "before": ["Tree census data available but presented only as tabular municipal records inaccessible to general audiences", "The equity dimension of canopy distribution absent from mainstream conversation about urban greening", "No single visualization connecting canopy density, income, and demographic data across all five boroughs simultaneously"],
        "after": ["Merged dataset connecting tree density to income quartile and racial composition at the census tract level across all five boroughs", "Statistically significant correlation between median income and canopy coverage visualized and annotated clearly", "Poster designed for public legibility — a general audience can follow the equity argument without a statistics background", "Selected for display in Pratt's 2025 graduate exhibition"]
      },
      "takeaways": [
        { "title": "Data visualization is an act of translation, not just display", "body": "The dataset proved what I suspected. The design work was about making that proof legible to someone who didn't already know the story. Those are genuinely different skills, and both matter. A visualization that's analytically correct but communicatively opaque hasn't done its job." }
      ]
    },

  {
      "num": "22",
      "id": "poseidon-user-testing",
      "title": "Poseidon Project",
      "short": "Watching Users Navigate Information They Didn't Ask For",
      "desc": "A usability evaluation of the Poseidon Project — a research platform built to educate users on industrial fish farming and its environmental impact. The site was clearly made with care and conviction. But care doesn't guarantee usability, and this project was a reminder of that gap.\n\nThe most instructive part wasn't finding the friction points — it was watching participants rationalize their confusion in real time, adjusting their behavior to compensate for the interface rather than acknowledging that the interface was failing them. That's the thing about usability testing: users will work harder than they should before they'll admit something is broken.",
      "topic": "ux research",
      "type": "User Research",
      "year": "2024",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/posiden-project-sd.png",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/poseidon-user-testing-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/poseidon-user-testing-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Poseidon%20project%20User%20Testing%20Report-compressed.pdf",
      "pdf_label": "Poseidon User Testing Report",
      "pdf_appendix": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Rauch%20Foundation%20Poseidon%20Project%20User%20Testing%20Report%202026-compressed.pdf",
      "pdf_appendix_label": "APPENDIX PDF",
      "figma": "https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/slides/56F00c7dBQenYEccbioP8J/Poseidon-project-User-Testing-Report",
      "sheets": null, "canva": null, "github": null, "live": null, "statMoments": null, "impact": null, "statements": null,
      "quotes": [
        {
          "text": "Thanks Kevin and the Pratt team for all of the terrific work. We have truly enjoyed working with you.",
          "attribution": "Patti Schaefer, Managing Director, The Rauch Foundation",
          "pairsWithFinding": null
        },
        {
          "text": "Fantastic UX presentation. You gave us clear, actionable suggestions, which have sparked productive conversation for our group. Very well done.",
          "attribution": "Anne Halligan, Director of Programs, The Rauch Foundation",
          "pairsWithFinding": null
        }
      ],
      "findings": [
        {
          "title": "Users went to global search first; local search was hidden behind 'Quick Search'",
          "body": "Every participant defaulted to the global search bar when asked to find a specific resource. Start Research's local search was tucked behind a 'Quick Search' button most users never noticed — flagged in heuristic evaluation as a severity-3 Flexibility & Ease of Use violation, and echoed across the affinity board's Search Methods cluster as missing search visibility, content density, and double-click-required tags.",
          "recommendation": "Surface search prominently, move categories into a persistent sidebar (Region, Resource Type, Topic, plus a Language filter participants asked for), and reformat resources as cards so density becomes legible."
        },
        {
          "title": "'Briefs' read as a duplicate of Start Research with no apparent purpose",
          "body": "Participants couldn't distinguish Briefs from Start Research or Get the Facts; several suggested removing it entirely. Heuristic evaluation flagged the title as a severity-2 Match between Consistency violation, and the affinity board's Mismatched Expectations cluster captured the same confusion around 'Register' (which users wanted called 'Join Us'). An entire tab was rhetorical dead weight, eroding trust in the rest of the IA.",
          "recommendation": "Rename Briefs → Deep Dive and reformat it as a topic-grouped carousel (Economic, Health, case studies) so its purpose is carried by structure, not title. Rename Register → Join Us and visually separate it from informational tabs."
        },
        {
          "title": "No pathways between pages; the journey dead-ended at the bottom",
          "body": "On a multi-layer information site, continuity between pages was load-bearing — but participants consistently scrolled back up to the header rather than use the footer's quick links. The affinity board's Flow between Pages cluster captured requests for tools that 'connected Get the Facts and Start Research,' a 'method to flow between pages,' and 'clearer indication of information hierarchy between pages.'",
          "recommendation": "Add a 'Learn More' section above the footer with two curated next-step cards per page (e.g., Dive Deeper, Start Research) so every page has an obvious next move."
        }
      ],
      "context": {
        "problem": "The Poseidon Project is content-heavy and trying to do something genuinely difficult: make complex, politically charged environmental research accessible to a general audience that didn't seek it out. The interface needed to guide users through dense information without making them feel lectured. In practice, the navigation structure was actively working against that goal — written for subject-matter experts, tested by the people who built it."
      },
      "approach": {
        "summary": "Conducted moderated usability testing with five participants across different levels of environmental awareness, using think-aloud protocol and task-based evaluation. Sessions were recorded and analyzed to identify friction patterns across navigation, labeling, content hierarchy, and information accessibility. Findings were categorized by severity and frequency to create a prioritized recommendation set.",
        "data": ["Moderated Usability Testing", "Think-Aloud Protocol", "Task-Based Evaluation", "Severity Rating", "Zoom", "Miro", "Notion"]
      },
      "results": {
        "before": ["Users couldn't locate core research content without multiple failed navigation attempts", "Navigation labels written for subject-matter experts rather than general audiences", "Critical information buried three to four levels deep without clear pathfinding", "No clear onboarding or entry point for first-time visitors unfamiliar with the subject matter"],
        "after": ["Every friction point mapped to a specific interface decision with a proposed resolution", "Navigation labels rewritten using language drawn directly from participant sessions", "Top three structural changes identified that would resolve the majority of observed task failures", "Prioritized recommendation report delivered with severity scoring and implementation guidance"]
      },
      "takeaways": [
        { "title": "The people who built the thing can't see what's broken", "body": "This is the core argument for user testing, and it never gets less true. You're too close to your own decisions to see the gaps. The moment a real user says 'wait, where do I go from here?' — that's more valuable than any internal review process could produce. Watch people use your thing. Do it early, do it often, and don't moderate toward the answers you want." }
      ]
    },

  {
      "num": "21",
      "id": "data-viz-literacy",
      "title": "Data Visualization Literacy",
      "short": "Why Most People Can't Actually Read a Chart",
      "desc": "A research paper examining data visualization literacy — specifically, the gap between how charts are produced and how they're actually understood. I wrote this during a period when data visualization was everywhere: COVID dashboards, election maps, economic indicators all presented to general audiences with the assumption that visual equals legible. That assumption, it turns out, is frequently wrong and rarely examined.\n\nThe more important the visualization, the more complex it tends to be. And the more complex it is, the more likely it is to be misread by the audience it most needs to reach.",
      "topic": "research",
      "type": "Academic",
      "year": "2024",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/data-viz-literacy-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/data-viz-literacy-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/data-viz-literacy-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Data%20Visualization%20Literacy%20%28Final%29-compressed.pdf",
      "pdf_label": "Data Visualization Literacy (Final)",
      "defaultArtifact": "pdf",
      "figma": null,
      "sheets": "https://docs.google.com/presentation/d/16FxaEJI7zm_iJC_9-h5A_JIzp7rK_LTYS7nQWYcpi98/preview",
      "canva": null, "github": null, "live": null, "statMoments": null, "impact": null, "statements": null,
      "quotes": [
        {
          "text": "Excellent paper on data viz literacy. Very well researched and grounded in multiple sources, methodical and comprehensive in its coverage of what data viz is, why it's important and how to promote it — well-written and easy to read. I'd like your permission to host it on my website as a sample of student work. Definitely a good illustration of research, critical thinking, and writing skills for your portfolio.",
          "attribution": "Irene Lopatovska, Professor, Pratt Institute",
          "pairsWithFinding": null
        }
      ],
      "findings": [
        {
          "title": "Digital natives are tech-fluent at leisure and stall at evaluation",
          "body": "Studies of first-year college students show that growing up with technology produces surface fluency — gaming, social networks, slide-making — but not the critical skills DVL assumes. Mentzer et al. (2024) found that the digital skills students did have were learned in isolation: confidence in slide-making didn't correlate with word-processing or spreadsheet competence, even though most curricula treat them as one skill set.",
          "recommendation": "Stop assuming generational exposure transfers to professional competence. Teach DVL as a distinct skill, alongside the data, digital, and AI literacies it depends on."
        },
        {
          "title": "The barriers to DVL are pedagogical and infrastructural, not generational",
          "body": "UNICEF's 2021 ASEAN survey stacks three barriers: 32% of young people lacked devices, 25.5% said their schools offered little or no digital-literacy training, and 23.7% felt the training they got was inadequate. COVID-era emergency remote learning made it worse by removing the only access point through which many students engaged with digital tools — and exposed the gap between digital and data literacy that pedagogy had been allowed to ignore.",
          "recommendation": "Integrate DVL into general curriculum at every level, not as an elective. Treat digital and data literacy as foundational scaffolding the rest of the curriculum stands on."
        },
        {
          "title": "73% of CDOs name data literacy as their top barrier to analytics",
          "body": "Deloitte's 2022 global survey of Chief Data Officers found data literacy cited as the leading obstacle to improving analytics at their organizations — more than twice as often as 'resistance to change.' The literacy gap doesn't close at graduation; it follows people into the workforce, where the cost compounds across teams that can't evaluate the dashboards they depend on.",
          "recommendation": "Treat DVL as a professional skill subject to continuing education, not a one-time literacy. Audit which decision-makers actually pass a VLAT-style assessment and target training to the gap."
        },
        {
          "title": "Some chart forms remain hard even for information-science students",
          "body": "Rogers & Jeffcoat (2024) applied the Visualization Literacy Assessment Test (Lee et al., 2017) to information-science students. None scored in the lowest quartile — but stacked bar and stacked area charts consistently tripped them up. The test's value isn't a single literacy score; it's a per-chart diagnostic of which forms a given audience can be trusted to read.",
          "recommendation": "Match chart type to audience literacy. Reserve stacked forms for audiences validated against VLAT or DVL-FW; serve mainstream policy and public-health audiences with simpler forms anchored by annotation density and guided interpretation."
        },
        {
          "title": "Audiences rate visualizations on personal experience, not framework rigor",
          "body": "Peck et al. (2022) interviewed rural Pennsylvanians ranking ten visualizations of drug use in America. Preferences had little to do with VLAT-measurable criteria or DVL-FW best practices. Two participants rated a chart valuable because it included alcohol statistics — substances they had personal histories with — and another disliked it because it omitted opioids: 'I don't see many people dying' from the drugs that were included.",
          "recommendation": "Treat audience research as part of the visualization brief. The best-formed chart for a community is the one whose categories match what the community already understands itself to be at stake in."
        },
        {
          "title": "DVL also fuels counternarratives — anti-masking groups used orthodox design for unorthodox science",
          "body": "Lee et al. (2021) documented how COVID-era anti-masking movements produced high-quality visualizations using the same data, tools, and design conventions as public-health institutions — and reached conclusions opposite to scientific consensus. This isn't a flaw of DVL; it's a corollary of widespread fluency. Generative-AI tools (Ye et al., 2024) widen the gap further: the skill of producing drops while the skill of evaluating doesn't.",
          "recommendation": "Don't withhold DVL teaching out of fear of misuse — but pair chart-reading literacy with source evaluation, methodological critique, and the politics of framing. DVL alone doesn't immunize anyone."
        }
      ],
      "context": {
        "problem": "Visualization literacy research shows a consistent pattern: people read simple charts at reasonable accuracy, but performance drops significantly with more complex forms — choropleth maps, scatter plots with encoded variables, dual axes, diverging scales. The research and policy visualizations that matter most tend to be the most complex. The audience that most needs to understand them tends to have the least training in reading them.",
        "collaboration": "Co-authored with Vincent Allport at Pratt Institute, November 2024."
      },
      "approach": {
        "summary": "Reviewed existing research across data literacy, visual cognition, and education to build a framework for understanding where and why visualization comprehension fails. Mapped failure modes against common chart types and identified the interventions most supported by the evidence: annotation density, guided interpretation layers, and progressive disclosure of complexity.",
        "data": ["Literature Review", "Visualization Research Synthesis", "Academic Sources", "Cognitive Science Research"]
      },
      "results": {
        "before": ["Visualization literacy often treated as binary — either you can read charts or you can't", "Educational interventions focused on chart-making skills rather than chart-reading skills", "DVL discussed alongside but rarely distinguished from adjacent digital, data, and AI literacies"],
        "after": ["Situated DVL against digital, data, and AI literacies — each foundational to the next, with DVL specifically focused on evaluating, interpreting, and creating visualizations", "Synthesized the field's existing assessment infrastructure: the Visualization Literacy Assessment Test (VLAT, Lee et al. 2017) for per-chart diagnostics and the Data Visualization Literacy Framework (DVL-FW, Börner et al. 2019) for typology-based curriculum design", "Documented the field's central tension: widespread DVL also enables high-quality counternarratives (Lee et al. 2021 on COVID anti-masking visualizations), so chart-reading literacy has to be paired with source-evaluation and methodological critique"]
      },
      "takeaways": [
        { "title": "Making a chart is not the same thing as communicating data", "body": "The field spends enormous energy on making visualizations more sophisticated and elegant. I'd argue we'd get more value from making them more readable. A chart that's misunderstood by 60% of its audience hasn't done its job regardless of how well it's designed. Legibility and rigor should not be in tension." }
      ]
    },

  {
      "num": "20",
      "id": "chipotle-ux",
      "title": "Chipotle UX Evaluation",
      "short": "Friction in a Supposedly Simple Flow",
      "desc": "A heuristic evaluation of Chipotle's digital ordering platform using Nielsen's ten usability principles. Chipotle's ordering flow is interesting as a UX object because it's both widely used and widely complained about — a rare combination that suggests something specific is wrong, rather than general dissatisfaction.\n\nThe evaluation identified exactly where the friction was living, and why it was harder to fix than it might appear from the outside.",
      "topic": "ux research",
      "type": "User Research",
      "year": "2024",
      "affiliation": "pratt",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/chipotle-ux-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/chipotle-ux-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/chipotle-ux-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/INFO%20644%20-%20CHIPOTLE%20HEURISTIC%20EVALUATION-compressed.pdf",
      "pdf_label": "Chipotle Heuristic Evaluation",
      "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Digital ordering for quick-service restaurants has a specific UX challenge: the flow needs to be fast, customizable, and error-tolerant simultaneously. Chipotle's menu has famously high customization complexity — over 65,000 possible burrito combinations — and the interface's job is to make that complexity feel manageable without slowing down the order. In practice, the interface was failing at that task in specific, diagnosable ways."
      },
      "approach": {
        "summary": "Evaluated Chipotle's web and iOS ordering flows against all ten Nielsen heuristics, scoring each identified violation on a 0-4 severity scale. Documented specific interface states for each violation with annotated screenshots, and proposed resolutions prioritized by severity and estimated implementation complexity.",
        "data": ["Heuristic Evaluation", "Nielsen's 10 Usability Heuristics", "Severity Rating Framework", "Interface Documentation", "iOS and Web Platform Analysis"]
      },
      "results": {
        "before": ["System feedback during order modification insufficient — users uncertain whether actions had registered", "Customization required multiple interactions to complete modifications that comparable platforms handle in one", "Error recovery paths unclear when modifications conflicted with item availability", "Cart state visibility poor across mobile breakpoints"],
        "after": ["14 distinct heuristic violations catalogued across the full ordering flow", "Three critical-severity issues (score 3+) identified for immediate remediation", "Interface modifications proposed for each violation with low-fidelity sketches and rationale", "Evaluation framework documented for potential extension to competitor platform comparison"]
      },
      "takeaways": [
        { "title": "Complexity is fine. Hidden complexity is the UX problem.", "body": "Chipotle's menu is genuinely complex — that's not the issue. The issue is an interface that makes that complexity feel like the user's problem rather than something the system is managing for them. Good UX for high-complexity products is about making the user feel capable. When they feel uncertain, you've lost." }
      ]
    },

  {
      "num": "19",
      "id": "premier-protein-muffin",
      "title": "Premier Protein Muffin",
      "short": "One Insight, Two Markets",
      "desc": "A full integrated marketing strategy for a Premier Protein product extension — a ready-to-eat protein muffin positioned as a real meal replacement rather than a snack. The genuinely challenging part of this brief was a dual-market requirement: the US target was working mothers, and the China market target was career-focused urban women. Two markets, one product, meaningfully different cultural contexts.\n\nI wanted to test whether a single behavioral insight could hold across both — and whether 'convenience as self-care' translated differently in Brooklyn versus Beijing.",
      "topic": "marketing",
      "type": "Strategy",
      "year": "2024",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/premier-protein-muffin-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/premier-protein-muffin-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/premier-protein-muffin-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Premier%20Protein%20MUFFIN%20PPT-compressed.pdf",
      "pdf_label": "Premier Protein Muffin IMC Strategy",
      "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The core insight was about time scarcity and nutritional compromise — the moment where someone grabs something fast because there's no better option, not because they want to. That insight translated across markets, but the product communication couldn't be identical. The US execution needed to feel like self-care; the China execution needed to feel like performance fuel. Same product, same underlying need, different emotional register."
      },
      "approach": {
        "summary": "Conducted parallel CDSTEP analyses for both markets, identified behavioral overlap and strategic divergence, and built a unified product positioning with differentiated communication approaches for each market. The positioning was designed to be scalable: one core truth expressed through culturally appropriate language and channel selection.",
        "data": ["CDSTEP Analysis", "Consumer Segmentation", "Cross-Cultural Research", "IMC Planning", "Market Entry Strategy"]
      },
      "results": {
        "before": ["No Premier Protein product addressing the meal replacement segment directly", "Existing line positioned as fitness supplement rather than everyday nutritional staple", "No China market strategy for the brand"],
        "after": ["Defined behavioral segmentation framework that worked across both markets despite cultural differences", "Positioned the product as functional meal infrastructure — something you rely on, not something you reward yourself with", "Built differentiated communication strategies within a unified brand framework and consistent product identity"]
      },
      "takeaways": [
        { "title": "Global strategy works when the insight travels, even when the execution doesn't", "body": "The same human need — not enough time, too many demands on your attention — shows up differently in different cultural contexts. The job is to find the insight that's true in both places, then let the execution be genuinely local. Forcing the same creative across markets is the most common mistake in global brand strategy." }
      ]
    },

  {
      "num": "18",
      "id": "heinz-brand-loyalty",
      "title": "Heinz Brand Loyalty",
      "short": "Why People Don't Switch, Even When They Easily Could",
      "desc": "A brand loyalty analysis asking a genuinely interesting behavioral question: Heinz ketchup costs more than its competitors, performs similarly to several of them in blind tests, and yet maintains dominant market share across decades. Why? This project was less about marketing strategy and more about consumer psychology — the specific mechanisms that turn a low-involvement purchase into an unexpectedly durable brand loyalty behavior.\n\nThe standard answer — 'strong brand identity' — isn't wrong, but it's not an explanation. I wanted to get to the behavioral layer underneath it.",
      "topic": "marketing",
      "type": "Proposal",
      "year": "2023",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/heinz-brand-loyalty-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/heinz-brand-loyalty-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/heinz-brand-loyalty-1.jpg" }],
      "pdf": null, "pdf_label": null, "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The analytical puzzle: Heinz is in a commodity category where rational switching is easy and cheap. Yet switching rates are remarkably low. Behavioral economics gives us tools to understand non-switching — default bias, sensory memory, loss aversion — but applying those frameworks to a specific brand case requires identifying which mechanism is doing the most work."
      },
      "approach": {
        "summary": "Drew on behavioral economics research (default bias, sensory conditioning, context-triggered behavior) and brand perception studies to build a framework for understanding habitual loyalty in low-involvement categories. Applied the framework specifically to Heinz, identifying three distinct mechanisms sustaining its position: sensory memory anchoring, ritual object association, and context ubiquity creating trust by default.",
        "data": ["Behavioral Economics Research", "Brand Perception Analysis", "Consumer Psychology Frameworks", "Competitive Category Analysis"]
      },
      "results": {
        "before": ["Category treated as commodity with price sensitivity as the primary loyalty variable", "Brand loyalty attributed generically to 'quality' and 'heritage' without behavioral specificity", "No framework for distinguishing between active loyalty and habitual non-switching"],
        "after": ["Identified three distinct mechanisms sustaining Heinz loyalty: sensory memory, ritual association, and context ubiquity", "Demonstrated that the bottle design itself functions as a loyalty mechanism independent of the product inside it", "Built a transferable framework for analyzing habitual brand loyalty in other mature consumer goods categories"]
      },
      "takeaways": [
        { "title": "Habit is the most powerful brand moat — and the hardest to build on purpose", "body": "Heinz didn't build loyalty through advertising. It built it by being in every diner, every backyard, every refrigerator for a century. That kind of loyalty is almost impossible to manufacture intentionally, which is exactly why it's so valuable once you have it." }
      ]
    },

  {
      "num": "17",
      "id": "work-pod-proposal",
      "title": "Work Pod Proposal",
      "short": "Designing Focus Back Into Open Offices",
      "desc": "A spatial design concept addressing one of the more persistent problems in modern office design: the open floor plan creates collaboration but destroys concentration. The Work Pod proposal was developed for a graduate course in information environments at Pratt, and it pushed me to think about space not as architecture but as information design — how does the physical environment shape attention, and what does a space need to communicate to function well for focused work?",
      "topic": "design",
      "type": "Proposal",
      "year": "2023",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/work-pod-proposal-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/work-pod-proposal-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/work-pod-proposal-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/INFO-639%20FINAL%20Proposal-compressed.pdf",
      "pdf_label": "Work Pod Proposal",
      "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Research consistently shows that open offices reduce productivity for tasks requiring sustained concentration, despite remaining popular for their perceived collaboration benefits. The constraint I set for the proposal was meaningful: the solution had to exist within existing open floor plans without structural renovation. It had to communicate 'focus work happens here' through its own design language, without requiring anyone to change the room around it."
      },
      "approach": {
        "summary": "Developed design specifications for a self-contained, acoustically managed pod unit with clear visual and behavioral affordances for focused work. The proposal addressed materiality, acoustic treatment, light quality, and the ergonomics of single-occupant use. Visual design language was deliberately distinct from the surrounding office environment to reinforce behavioral mode-switching.",
        "data": ["Spatial Design", "Acoustic Research", "Ergonomics", "Behavioral Design", "Office Environment Research"]
      },
      "results": {
        "before": ["Open office environments offered no physical mechanism for signaling focus-mode intent", "Interruption rates in observed office environments averaging 7-8 per hour for deep work tasks", "No modular, non-permanent solution available at a reasonable implementation cost"],
        "after": ["Designed a modular pod unit with defined acoustic, visual, and ergonomic specifications", "Behavioral affordance system allowing occupants to signal availability status to colleagues", "Cost and installation framework designed for deployment without facility renovation"]
      },
      "takeaways": [
        { "title": "The best spatial design is invisible until you need it", "body": "A good focus environment doesn't call attention to itself. It removes friction between the person and the work they're trying to do. The pod's job is to disappear once you're inside it — so completely that you forget you're in an open office." }
      ]
    },

  {
      "num": "16",
      "id": "mccormick-mixology",
      "title": "McCormick Mixology",
      "short": "Extending a Brand Into a New Behavior",
      "desc": "A brand extension concept positioning McCormick in the cocktail and home mixology space. This was a genuinely interesting brief because McCormick has enormous latent potential that its current marketing largely ignores — it's a flavor authority that lives primarily in the kitchen, but flavor doesn't stop at the stove.\n\nThe mixology angle felt like a natural extension because it leverages exactly what McCormick is good at — formulation, flavor precision, accessibility — in a category that was experiencing real growth in the direct-to-consumer space. The challenge was making it feel inevitable rather than opportunistic.",
      "topic": "marketing",
      "type": "Proposal",
      "year": "2023",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-1.jpg",
      "gallery": [
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-1.jpg",
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-2.jpg",
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-3.jpg",
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-4.jpg"
      ],
      "media": [
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-1.jpg" },
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-2.jpg" },
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-3.jpg" },
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/mccormick-mixology-4.jpg" }
      ],
      "pdf": null, "pdf_label": null, "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The risk with any brand extension is dilution — new revenue but lost brand clarity. McCormick Mixology needed to feel like a logical evolution of the brand's authority, not a cynical pivot toward a trending category. The through-line between what McCormick represents (precision, flavor expertise, kitchen accessibility) and what the cocktail audience values had to be genuinely present, not just asserted."
      },
      "approach": {
        "summary": "Researched the home mixology market — size, growth drivers, consumer profile, competitive landscape — and mapped McCormick's existing equity against the category's needs. Built the product concept around pre-formulated cocktail spice blends designed to lower the barrier to entry for home bartenders. Pricing, packaging, and channel strategy all leveraged McCormick's existing manufacturing and retail distribution infrastructure.",
        "data": ["Brand Extension Strategy", "Market Sizing", "Consumer Segmentation", "Product Development", "Go-to-Market Planning"]
      },
      "results": {
        "before": ["McCormick limited to traditional cooking use cases with no presence in beverage", "No product offering for the growing home entertaining and cocktail culture segment", "Younger consumers not engaging with the brand outside of holiday cooking occasions"],
        "after": ["Pre-formulated cocktail blend product line concept with clear positioning and pricing architecture", "Distribution strategy leveraging existing retail relationships for immediate shelf placement", "Brand extension positioned to grow engagement with Millennial and Gen Z consumers without disrupting core kitchen equity"]
      },
      "takeaways": [
        { "title": "The best brand extensions don't feel like brand extensions", "body": "If you have to explain why a company is entering a new category, the extension probably isn't right. The test is whether a customer's reaction is 'of course' rather than 'really?' McCormick Mixology worked as a concept because it felt like something they should have already done." }
      ]
    },

  {
      "num": "15",
      "id": "coca-cola-zero",
      "title": "Coca-Cola Zero",
      "short": "Precision at a Scale That Makes Precision Hard",
      "desc": "A media planning strategy for Coca-Cola Zero Sugar — which sounds straightforward until you reckon with what Coca-Cola actually is as an advertising entity. This is a brand that touches essentially every available media surface. The interesting challenge wasn't building a strategy from scratch; it was thinking about how to allocate finite attention and budget within a system that's already ubiquitous. Where do the marginal dollars go? What's actually moving the needle for a product trying to build its own identity within one of the world's most recognizable brand umbrellas?",
      "topic": "marketing",
      "type": "Strategy",
      "year": "2023",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/coca-cola-zero-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/coca-cola-zero-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/coca-cola-zero-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Coca%20Cola%20Zero%20Media%20AD%20Plan-compressed.pdf",
      "pdf_label": "Coca-Cola Zero Media AD Plan",
      "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Zero Sugar lives in a complicated brand position: it has the benefit of Coca-Cola's legacy trust but carries the liability of being the 'healthier' option — a label that can feel clinical in a category defined by pleasure. The media strategy needed to work with that positioning, leaning into what Zero Sugar actually is for its specific consumer rather than trying to be everything Coke Classic is to everyone."
      },
      "approach": {
        "summary": "Segmented the media plan around the Zero Sugar consumer's actual behavior: health-conscious but not health-obsessed, interested in flavor and experience, active in streaming and digital-first environments. Built allocation recommendations around reach efficiency and contextual relevance rather than pure scale, with specific attention to the channels where the Zero Sugar audience could be reached without cannibalizing Classic's positioning.",
        "data": ["Media Planning", "Audience Segmentation", "Channel Strategy", "Budget Allocation Modeling"]
      },
      "results": {
        "before": ["Broad media spend without Zero Sugar-specific targeting or positioning", "Over-reliance on legacy broadcast channels with declining relevance for the target audience", "Fragmented brand voice across Zero Sugar's own campaign history"],
        "after": ["Defined a targeted media allocation strategy weighted toward digital, streaming, and sports adjacency", "Aligned messaging with the specific identity positioning — flavor-forward, not restriction-forward", "Improved channel integration with clear Zero Sugar brand voice differentiated from Coke Classic"]
      },
      "takeaways": [
        { "title": "Big budgets don't solve positioning problems — they amplify them", "body": "You can buy a lot of media for a message that doesn't land. The strategic work is figuring out what the message should actually be and who it's really for. The media plan follows from that clarity, not the other way around." }
      ]
    },

  {
      "num": "14",
      "id": "smiski-campaign",
      "title": "SMISKI Campaign",
      "short": "Marketing to Collectors, Not Consumers",
      "desc": "A campaign concept for SMISKI — the glow-in-the-dark blind box figures from Dream Co. that have developed a quietly devoted collector community. The interesting challenge with SMISKI isn't awareness; it's depth. The people who love these figures really love them, but the brand has limited crossover into mainstream consciousness.\n\nI wanted to build a campaign that honored the collector community without compromising it — one that created entry points for newcomers while making existing fans feel more seen.",
      "topic": "marketing",
      "type": "Copy Writing",
      "year": "2023",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/smiski-campaign-1.jpg",
      "gallery": [
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/smiski-campaign-1.jpg",
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/smiski-campaign-2.jpg"
      ],
      "media": [
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/smiski-campaign-1.jpg" },
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/smiski-campaign-2.jpg" }
      ],
      "pdf": null, "pdf_label": null, "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Blind box collectibles live and die on scarcity, ritual, and community. A campaign that pushed too hard toward mainstream would alienate the core. A campaign that stayed too niche would leave growth on the table. The brief required finding the tonal register that could hold both audiences simultaneously."
      },
      "approach": {
        "summary": "Researched collector behavior patterns around blind box toys and studied how comparable brands — Pop Mart and Sonny Angel — had navigated growth without diluting their communities. Built a campaign concept centered on the ritual of unboxing rather than the product itself, positioning SMISKI not as a toy you buy but as a small, recurring moment of surprise in your day.",
        "data": ["Consumer Research", "Collector Behavior Analysis", "Competitive Analysis", "Copywriting", "Campaign Strategy"]
      },
      "results": {
        "before": ["Brand marketing focused on product features and series drops", "Limited bridge content between collector community and general audiences", "Brand voice inconsistent across channels"],
        "after": ["Developed a campaign voice that spoke to the ritual of discovery rather than the product", "Created entry-point copy for new audiences without alienating the collector base", "Established a tone framework that could scale across platforms without losing brand character"]
      },
      "takeaways": [
        { "title": "Niche brands grow by deepening, not widening", "body": "The temptation is always to reach further. But the brands that build lasting collector communities do it by making existing fans feel more seen, not by chasing new ones. Growth follows depth — rarely the other way around." }
      ]
    },

  {
      "num": "13",
      "id": "tiffany-lock-campaign",
      "title": "Tiffany's Lock Campaign",
      "short": "When a Product Becomes a Symbol",
      "desc": "A campaign analysis built around Tiffany's Lock collection — one of the more successful luxury campaign launches of the past few years. The Lock is an almost deceptively simple object, but the campaign transformed a bracelet into a cultural statement about permanence and connection at a moment when both felt genuinely uncertain. I wanted to understand exactly how that happened — how a brand turns a product into a moment.\n\nTiffany had been trying to modernize for years with mixed results. The Lock succeeded in a way its predecessors hadn't, and that success was specific enough to be analyzed.",
      "topic": "marketing",
      "type": "Analysis",
      "year": "2023",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-lock-campaign-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-lock-campaign-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-lock-campaign-1.jpg" }],
      "pdf": null, "pdf_label": null, "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The analysis question was: what specifically made this campaign land where others hadn't? Was it the product design? The casting? The timing? The cross-platform execution? I broke it down into components to find out — because 'strong brand identity' is not an explanation, it's a label."
      },
      "approach": {
        "summary": "Broke the campaign into its components — creative concept, talent partnerships, media distribution, product design — and evaluated each one against the brand's broader repositioning goals under new ownership. Analyzed engagement data, press coverage, and social response to distinguish genuine cultural resonance from paid visibility.",
        "data": ["Campaign Analysis", "Influencer Strategy Evaluation", "Media Planning Analysis", "Brand Perception Research"]
      },
      "results": {
        "before": ["Brand messaging fragmented across campaigns without a unifying emotional core", "Influencer partnerships chosen for reach rather than identity alignment", "Limited differentiation between Tiffany and competitor luxury jewelry brands in the under-35 market"],
        "after": ["Lock campaign built every touchpoint around a single symbolic concept — and held to it", "Talent partnerships created authentic reach by selecting figures whose personal narratives matched the campaign's emotional logic", "Measurable increase in brand consideration among under-35 consumers as documented in luxury tracking surveys post-launch"]
      },
      "takeaways": [
        { "title": "Symbolism is a multiplier", "body": "A product with a clear symbolic meaning generates conversation that advertising can't buy. The best campaigns don't explain the product — they create the conditions for people to assign their own meaning to it. The lock already means something to most people. The campaign just pointed at that meaning." }
      ]
    },

  {
      "num": "12",
      "id": "peleton-ad-campaign",
      "title": "Peleton Ad Campaign",
      "short": "Fitness as Identity, Not Effort",
      "desc": "A copywriting and campaign strategy project from FIT exploring how brands can shift their positioning from product-centric to behavior-centric. I came into this thinking about how people actually relate to fitness equipment — not as machines, but as symbols of who they want to be. The challenge was writing copy that didn't just sell a bike, but sold a version of your life. I wanted the language to feel like something you'd hang above your desk, not a tagline in a commercial.\n\nThe most interesting tension in Peloton's marketing is that the product itself is unglamorous — it's a stationary bike with a screen. What makes it compelling is the ritual it creates. So the copy had to live there, in the space between waking up and getting on the bike, rather than in the bike itself.",
      "topic": "marketing",
      "type": "Copy Writing",
      "year": "2023",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/peleton-ad-campaign-1.jpg",
      "gallery": [
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/peleton-ad-campaign-1.jpg"
      ],
      "media": [
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/peleton-ad-campaign-1.jpg" }
      ],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Peleton%20Marketing%20Concept-compressed.pdf",
      "pdf_label": "Peloton Marketing Concept",
      "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Peloton's existing messaging leaned heavily on performance metrics and community features — impressive, but cold. The brief was to reposition the brand around a behavioral insight: people don't buy fitness products to exercise more, they buy them to feel like the kind of person who exercises. The copy needed to live in that gap — between who someone is and who they're working toward becoming."
      },
      "approach": {
        "summary": "I mapped out the emotional states surrounding at-home fitness — motivation, guilt, pride, routine — and wrote toward each one. Rather than leading with product features, I led with rituals. The bike becomes part of how you start your day, not something you have to find time for. Each headline was tested against a single question: does this make someone feel capable, or does it make them feel like they're not doing enough?",
        "data": ["Copywriting", "Brand Positioning", "Consumer Behavior Research", "Creative Strategy"]
      },
      "results": {
        "before": ["Messaging led with equipment specs and class variety", "Brand voice felt aspirational in a way that excluded casual users", "Copy treated exercise as a scheduled event rather than a daily habit"],
        "after": ["Reframed Peloton as lifestyle infrastructure rather than fitness equipment", "Aligned messaging with routine-based identity rather than performance goals", "Shifted tone from aspirational to relatable — less 'achieve more', more 'this is just what you do now'"]
      },
      "takeaways": [
        { "title": "The best copy describes the person, not the product", "body": "People buy things because of what they say about them, not what the thing does. Writing toward identity rather than features is a fundamentally different skill — one I keep coming back to across every discipline I work in." }
      ]
    },

  {
      "num": "11",
      "id": "knit-wear",
      "title": "Knit & Wear",
      "short": "Craft as Post-Pandemic Reclamation",
      "desc": "A trend analysis examining knitting's unexpected resurgence during and after COVID — not as a fashion trend, but as a behavioral one. The number of people who picked up needles in 2020-2021 was genuinely striking. Ravelry saw massive membership spikes, yarn became a sought-after commodity, and the aesthetics of handmade knitwear started appearing in runway collections from brands that had never engaged with craft before.\n\nThe surface explanation is 'people were bored at home.' But that doesn't explain the persistence of the trend once lockdowns ended. Something else was happening.",
      "topic": "trend",
      "type": "Forecast",
      "year": "2022",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/knit-wear-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/knit-wear-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/knit-wear-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Knit%20and%20Wear%20-%20The%20Loop%20Towards%20Fashion%20Sustainability-compressed.pdf",
      "pdf_label": "Knit & Wear - The Loop Towards Fashion Sustainability",
      "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The deeper driver, I argued, was reclamation: in a period when agency felt genuinely limited, making something by hand represented a form of control. That's a behavioral insight with durability well beyond the pandemic context — it connects to the broader slow fashion movement, repair culture, and the growing consumer discomfort with disposable production."
      },
      "approach": {
        "summary": "Synthesized platform growth data, search trend analysis, and cultural reporting to trace the resurgence through its phases: initial pandemic crafting, post-pandemic retention, and the transition into mainstream fashion adoption and runway incorporation. Connected the trend to adjacent behavioral patterns including sustainability, repair culture, and identity-driven consumption.",
        "data": ["Platform Growth Analysis", "Search Trend Research", "Cultural Reporting Synthesis", "Fashion Forecasting", "Consumer Behavior Analysis"]
      },
      "results": {
        "before": ["Knitwear treated as niche, seasonal, and associated with an older consumer demographic", "Limited connection drawn between the craft revival and sustainability or self-expression trends", "Knitting's cultural resurgence underestimated as a pandemic-specific anomaly"],
        "after": ["Linked the knitting resurgence to three durable behavioral drivers: agency, sustainability, and identity expression", "Positioned handmade and craft aesthetics as a lasting design influence rather than a cyclical trend", "Connected the behavioral shift to broader consumption changes that outlasted lockdown conditions"]
      },
      "takeaways": [
        { "title": "A trend with a behavioral driver lasts longer than a trend with an aesthetic driver", "body": "Knitwear isn't trending because it looks good right now — though it does. It's trending because making something by hand addresses a genuine human need for agency and creative output. Trends rooted in behavior are much harder to displace than trends rooted in aesthetics, because aesthetics can be replicated instantly while behavioral needs can't be manufactured." }
      ]
    },

  {
      "num": "10",
      "id": "textile-dyes",
      "title": "Textile Dyes",
      "short": "The Environmental Cost of Color",
      "desc": "A research study examining the environmental consequences of synthetic textile dye production — specifically, the contamination of waterways near major garment-producing facilities. Developed at FIT, where fashion and sustainability exist in productive but sometimes uncomfortable tension.\n\nI came into this knowing the broad outlines of the problem. The research pushed me toward the specifics, which are considerably worse than the headline version — and considerably more localized to communities with the least political ability to push back.",
      "topic": "fashion",
      "type": "Research",
      "year": "2022",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/textile-dyes-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/textile-dyes-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/textile-dyes-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/SC121%20Textile%20Dye%20Final%20Project-compressed.pdf",
      "pdf_label": "Textile Dye Final Project",
      "figma": null,
      "sheets": "https://docs.google.com/presentation/d/1ox276aGzMoSRfiH56olQjwNA5_XcneleJCVaoZYInEg/preview",
      "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Fashion's environmental impact is enormous and widely acknowledged, but usually discussed at a level of abstraction that makes accountability feel distant. This project tried to make one piece of it concrete: what specifically happens to water systems near textile dyeing facilities in major production regions, and who actually bears the health costs of those decisions?"
      },
      "approach": {
        "summary": "Reviewed environmental impact studies from major textile-producing regions in South and Southeast Asia, synthesized findings on specific chemical contaminants and documented health effects, and examined the regulatory landscape — including why existing frameworks consistently fail to prevent contamination that independent research clearly documents.",
        "data": ["Environmental Research", "Toxicology Studies", "Sustainability Analysis", "Regulatory Review", "Supply Chain Research"]
      },
      "results": {
        "before": ["Environmental impact of fashion understood vaguely as 'high' without specific pathways documented", "Dye contamination treated as an abstract production externality rather than a documented community health impact", "Consumer awareness of specific supply chain environmental costs minimal"],
        "after": ["Documented contamination pathways from synthetic dye production to groundwater and river systems in specific regions", "Connected specific production decisions to measurable health outcomes in affected communities", "Outlined the regulatory gap between what existing frameworks require and what independent environmental research consistently documents"]
      },
      "takeaways": [
        { "title": "Environmental harm is most durable when it's invisible to the people creating it", "body": "The fast fashion system's environmental cost is real and thoroughly documented. The gap isn't in the evidence — it's in the distance between the people making purchasing decisions in New York and the communities bearing the consequences of those decisions in Bangladesh and Vietnam. Closing that distance is a communication problem as much as a policy problem." }
      ]
    },

  {
      "num": "09",
      "id": "kensie-merchandising",
      "title": "Kensie Merchandising",
      "short": "Modernizing a Brand Without Losing Its Customer",
      "desc": "A buying and assortment proposal for Kensie, a contemporary women's brand with strong roots in the mid-range department store channel. This project was essentially an exercise in brand rehabilitation through product strategy: identifying what was working, what was aging out, and what the assortment needed to do to stay relevant against faster-moving competitors in the same price tier.\n\nKensie's challenge isn't unusual for brands that grew up in the department store ecosystem — they built identity around a customer profile that has since diversified. The hard part is evolving without abandoning the loyalty that kept them viable.",
      "topic": "fashion",
      "type": "Merchandising",
      "year": "2022",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/kensie-merchandising-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/kensie-merchandising-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/kensie-merchandising-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Kensie%20Outerwear%20Buy%20Plan-compressed.pdf",
      "pdf_label": "Kensie Outerwear Buy Plan",
      "figma": null, "sheets": null,
      "canva": "https://www.canva.com/design/DAFRRksmzJ0/Mx33XwankOhmdQxxKlzEPw/view?embed",
      "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The outerwear category was simultaneously Kensie's highest-margin opportunity and its most visibly dated segment. Competitors at the same price point had modernized silhouettes and introduced functional fabrics while Kensie's outerwear remained anchored in aesthetic trends from several seasons prior. The buy plan needed to make that gap visible with sales evidence, not just style judgment."
      },
      "approach": {
        "summary": "Conducted category-level sell-through analysis using available retail data, benchmarked against key department store competitors, and built a buy plan for the outerwear category with specific volume recommendations by style, price tier, and fabrication. The proposal balanced modernization with retention — protecting the styles that were still performing for the core customer while introducing new directions for growth.",
        "data": ["Buy Planning", "Sell-Through Analysis", "Competitive Benchmarking", "Assortment Strategy"]
      },
      "results": {
        "before": ["Outerwear assortment anchored in styles that had seen declining sell-through for two consecutive seasons", "No functional fabric offering in a category where competitors had established it as table stakes", "Price architecture concentrated in a single tier, leaving growth opportunities on the table"],
        "after": ["Buy plan with specific style recommendations, volume splits, and price tier diversification", "Identified three silhouette opportunities with validated demand and competitive white space", "Outerwear strategy built to serve both the existing core customer and an adjacent growth segment"]
      },
      "takeaways": [
        { "title": "Loyalty lives in specific product categories, not the whole brand", "body": "When you look at the sell-through data, customers don't love brands equally across all categories. They love what the brand does best. The strategic question is: which categories is this brand trusted in, and how do you protect that trust while making room for evolution?" }
      ]
    },

  {
      "num": "08",
      "id": "cl-kpop-eye-candy",
      "title": "CL Influencer Analysis",
      "short": "Identity as the Real Brand Asset",
      "desc": "An influencer analysis of CL — the Korean artist, former 2NE1 member, and solo act who occupies a genuinely unusual position in global pop culture. What interested me about CL wasn't her reach metrics, but her identity construction: the way she moves between Korean hip-hop aesthetics, American streetwear, and high fashion without losing a coherent sense of self.\n\nThat coherence is rare in influencer culture and it's exactly what makes her brand partnerships land. Most influencer analysis misses this entirely because it's measuring the wrong thing.",
      "topic": "fashion",
      "type": "Analysis",
      "year": "2022",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/cl-kpop-eye-candy-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/cl-kpop-eye-candy-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/cl-kpop-eye-candy-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/CL%20Influencer%20Report-compressed.pdf",
      "pdf_label": "CL Influencer Report",
      "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Standard influencer analysis focuses on follower counts and demographic match. This project pushed toward a harder question: what makes a brand partnership feel authentic rather than transactional? CL's collaborations consistently feel like the former, even when they cross significant cultural and commercial distances. I wanted to understand the mechanism behind that."
      },
      "approach": {
        "summary": "Analyzed CL's content strategy, brand partnerships, and public positioning across platforms and markets over a multi-year window. Mapped her styling and visual identity choices over time to identify the deliberate consistency underlying apparent variety. The analysis treated her image-making as a design system — with intentional constraints and deliberate exceptions.",
        "data": ["Influencer Content Analysis", "Brand Partnership Evaluation", "Cross-Cultural Positioning Research", "Identity Coherence Framework Development"]
      },
      "results": {
        "before": ["Influencer analysis framework focused on reach metrics and demographic overlap", "Brand partnerships evaluated on exposure alone", "No analytical tool for assessing identity coherence across an influencer's body of work"],
        "after": ["Developed a framework for evaluating authenticity through identity coherence across time and context", "Identified specific visual and tonal signals that make CL's partnerships feel earned rather than rented", "Connected cross-cultural fluency to measurable commercial value in global influencer strategy"]
      },
      "takeaways": [
        { "title": "Influence is earned by people who know exactly who they are", "body": "The most valuable influencers aren't the ones with the biggest audiences — they're the ones whose audiences trust them completely. That trust is built through identity consistency, not content volume. When you know what someone stands for, you believe them when they endorse something." }
      ]
    },

  {
      "num": "07",
      "id": "uniqlo-assortment-refresh",
      "title": "UNIQLO Assortment Refresh",
      "short": "Finding the Gaps in a Perfect Range",
      "desc": "A merchandising proposal that asked a genuinely interesting question: if you were UNIQLO's buyer right now, what would you add, reduce, or retire? This project required getting past the surface-level appreciation for UNIQLO's aesthetic — the clean basics, the LifeWear story — and looking at the assortment analytically.\n\nUNIQLO's strength is also its constraint. Extreme consistency executes a narrow range of product types exceptionally well, but consistency can calcify into stagnation. The assortment analysis identified exactly where that was starting to happen.",
      "topic": "fashion",
      "type": "Merchandising",
      "year": "2022",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/uniqlo-assortment-refresh-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/uniqlo-assortment-refresh-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/uniqlo-assortment-refresh-1.jpg" }],
      "pdf": null, "pdf_label": null, "figma": null,
      "sheets": "https://docs.google.com/presentation/d/1GFaZ6dN5ZGqY3qgU74TBj3fOUXO7cHbUVRJDHNT_Cxk/preview",
      "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "UNIQLO had under-indexed in three emerging categories: gender-neutral sizing systems, technical performance fabrics for urban commuters, and occasion-dressing crossover pieces. The assortment had held steady while consumer expectations shifted. The proposal needed to make that gap visible with evidence, not just intuition."
      },
      "approach": {
        "summary": "Built a category-level map of the existing assortment, benchmarked it against key competitors — Muji, COS, and Zara's premium lines — and identified under-indexed segments by cross-referencing search trend data with assortment gaps. The proposal centered on three specific additions and two volume reductions, each with supporting rationale.",
        "data": ["Assortment Analysis", "Competitive Benchmarking", "Search Trend Analysis", "Buying Strategy"]
      },
      "results": {
        "before": ["Assortment strong in core categories but silent in emerging consumer segments", "No performance fabric positioning despite growing commuter and travel wear demand", "Size and fit systems unchanged despite significant consumer expectation shifts"],
        "after": ["Identified three high-opportunity additions with demand evidence and competitive white space", "Proposed two category reductions to create space and improve clarity", "Built a buying rationale framework that could be replicated for future assortment review cycles"]
      },
      "takeaways": [
        { "title": "Assortment planning is hypothesis testing", "body": "Every buying decision is a bet on what customers will want. The difference between good and great buyers is whether they can explain — with evidence — why they're placing that bet. Intuition is the starting point, not the justification." }
      ]
    },

  {
      "num": "06",
      "id": "tiffany-ar",
      "title": "Tiffany and Co's AR",
      "short": "Luxury in the Age of Digital Access",
      "desc": "An analysis of Tiffany's NFT and augmented reality campaigns, examined through the lens of brand strategy and audience expansion. I wrote this during the peak of the NFT moment, when legacy brands were experimenting with digital ownership — some thoughtfully, most opportunistically. Tiffany was one of the more interesting cases because they had something real to protect: a brand built entirely on exclusivity and physical presence.\n\nHow do you extend a brand like that into a medium defined by accessibility and replicability? That question turned out to have a more nuanced answer than I expected.",
      "topic": "marketing",
      "type": "Analysis",
      "year": "2022",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-ar-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-ar-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-ar-1.jpg" }],
      "pdf": null, "pdf_label": null, "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "The core tension in Tiffany's AR strategy was that the tools it used — Snapchat filters, blockchain tokens, social media distribution — are fundamentally democratizing. They extend reach to people who would never walk into a Fifth Avenue store. But Tiffany's brand equity lives in scarcity and prestige. The analysis question: could digital expansion grow the brand without diluting what made it valuable?"
      },
      "approach": {
        "summary": "Evaluated the campaign across three dimensions: audience reach and demographic shift, brand integrity and perception among existing customers, and the commercial execution of the digital products themselves. Used public data on NFT sales performance, Snapchat engagement benchmarks, and press coverage to assess where the strategy created genuine value versus where it was performative.",
        "data": ["Snapchat AR Platform Analysis", "NFT Market Research", "Social Media Strategy", "Luxury Brand Positioning", "Campaign Analysis"]
      },
      "results": {
        "before": ["Brand reach primarily limited to high-income consumers with access to physical retail", "Minimal engagement with Gen Z and digital-native audiences", "No brand participation mechanism below the $500 price point"],
        "after": ["NFT collections created a new entry point into brand participation at a lower price ceiling", "Snapchat filters extended brand visibility to a younger demographic at near-zero cost", "Demonstrated that luxury and accessibility can coexist when digital channels are positioned as aspiration builders, not discount mechanisms"]
      },
      "takeaways": [
        { "title": "Luxury brands don't have to choose between exclusivity and reach — but they have to be deliberate about which tools serve which purpose", "body": "The brands that navigate this well use digital channels to build aspiration, not just awareness. There's a meaningful difference between making a brand feel reachable and making it feel cheap. Tiffany mostly threaded that needle." }
      ]
    },

  {
      "num": "05",
      "id": "tiffany-store-plan",
      "title": "Tiffany and Co's Store Plan",
      "short": "Where Brand Strategy Meets Floor Plan",
      "desc": "This one was personal. I spent time at Tiffany & Co. and came away with a deep respect for how deliberately every square foot of a luxury retail environment is managed. For this FIT project, I built out a full store plan — fixture layouts, traffic flow, product adjacencies, display hierarchies — translating what I'd experienced as both an observer and a participant into a structured spatial strategy.\n\nIt's one thing to feel a store working well. It's another to understand exactly why it works — and to be able to build that logic from the ground up.",
      "topic": "fashion",
      "type": "Merchandising",
      "year": "2022",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-1.jpg",
      "gallery": [
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-1.jpg",
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-2.jpg",
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-3.jpg",
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-4.jpg",
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-5.jpg"
      ],
      "media": [
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-1.jpg" },
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-2.jpg" },
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-3.jpg" },
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-4.jpg" },
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/tiffany-store-plan-5.jpg" }
      ],
      "pdf": null, "pdf_label": null, "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Retail space is expensive, and every layout decision has a measurable impact on conversion, dwell time, and average transaction value. The challenge was to go beyond 'this looks good' and build a layout logic that could be defended with merchandising principles — why this category sits near the entrance, why the highest-margin items are at eye level, why the back wall anchors the floor plan.",
        "why": ["Tiffany's customer journey is highly intentional — every step from door to display case is choreographed", "The store plan had to communicate brand prestige without ever feeling transactional", "Conversion in luxury retail depends on comfort and time in store, not urgency"]
      },
      "approach": {
        "summary": "Mapped the store using established merchandising frameworks — decompression zone, destination placement, adjacency logic — and applied them to Tiffany's specific product hierarchy and customer journey. Cross-referenced with direct observations from the physical space and competitive luxury retail environments.",
        "data": ["Store Planning", "Merchandising Strategy", "Traffic Flow Analysis", "Luxury Retail Research"]
      },
      "results": {
        "before": ["Store layout driven primarily by aesthetic and brand presentation without performance logic", "Product adjacencies based on visual harmony rather than cross-sell opportunity", "No explicit framework connecting physical placement to conversion outcomes"],
        "after": ["Developed a layout with clear conversion logic from entrance to transaction point", "Identified high-margin destination zones and anchor products within the floor plan", "Built a product adjacency map grounded in purchase behavior rather than aesthetics alone"]
      },
      "takeaways": [
        { "title": "Great retail design is invisible", "body": "When a store layout works, customers don't notice it — they just move naturally toward the things they want. The layout's job is to make every product discoverable without making the space feel engineered. That tension between logic and feeling is what makes retail design genuinely interesting." }
      ]
    },

  {
      "num": "04",
      "id": "kenzo-product-elements",
      "title": "Kenzo Product Elements",
      "short": "Reading a Garment Like a Design Brief",
      "desc": "A structured product analysis of Kenzo pieces from a FIT merchandising course. The project required getting close to the physical object — examining stitching, label placement, fabric weight, print registration — and translating those details into a coherent picture of how a brand communicates through construction. I treated each garment like a brief: what decisions were made, and why?\n\nFashion brand analysis tends to stay at the level of aesthetic and marketing. This project pushed deeper, into the product itself. The question was whether you could reverse-engineer brand identity from a hem finish or a zipper pull. Turns out, you can.",
      "topic": "fashion",
      "type": "Analysis",
      "year": "2022",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/kenzo-product-elements-1.jpg",
      "gallery": [
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/kenzo-product-elements-1.jpg"
      ],
      "media": [
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/kenzo-product-elements-1.jpg" }
      ],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Kenzo%20Product%20Elements%20Final%20Project-compressed.pdf",
      "pdf_label": "Kenzo Product Elements Final Project",
      "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Most brand analysis at FIT lived at the campaign and identity level. This project asked something harder: can you identify a brand's design philosophy purely from the product, without looking at its advertising? I wanted to build that analytical muscle — using physical construction as evidence rather than aesthetic as intuition."
      },
      "approach": {
        "summary": "I physically handled and documented multiple Kenzo pieces, categorizing decisions across material, construction, silhouette, and finishing. Each element was mapped against the brand's stated identity and price positioning to identify where design decisions were deliberate signals versus category defaults. The goal was a replicable framework for reading products as brand artifacts.",
        "data": ["Product Analysis", "Material Study", "Brand Positioning", "Design Evaluation"]
      },
      "results": {
        "before": ["Brand analysis limited to campaigns and visual identity", "Product-level decisions treated as aesthetic rather than strategic", "No framework for connecting construction choices to brand communication"],
        "after": ["Built a repeatable framework for reading products as brand artifacts", "Identified Kenzo signatures — oversized fits, bold print registration, relaxed finishing — as deliberate brand signals, not incidental choices", "Linked product-level decisions to positioning and consumer expectations across price tiers"]
      },
      "takeaways": [
        { "title": "A brand lives in its product, not just its advertising", "body": "The most honest version of a brand is in the details consumers touch and feel. Learning to read those details changed how I think about both design and analysis — and it made me a better analyst when I got to retail, where the product is the data." }
      ]
    },

  {
      "num": "03",
      "id": "race-to-space",
      "title": "Race To Space",
      "short": "Space as Cultural Color Palette",
      "desc": "A color-focused micro trend forecast built around the aesthetic influence of space exploration on fashion and design. This was a tighter, more deliberate piece than macro trend work — the constraint was the point. By narrowing to color, I had to be precise about where space imagery was actually showing up in product and cultural reference, rather than gesturing at a vague 'space-inspired' mood.\n\nThe interesting thing about this trend was that it was being driven by two very different forces simultaneously: NASA's Artemis program reactivating cultural interest in exploration, and Silicon Valley's space tourism moment creating an entirely new aesthetic vocabulary.",
      "topic": "trend",
      "type": "Forecast",
      "year": "2021",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/race-to-space-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/race-to-space-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/race-to-space-1.jpg" }],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/FM245%20Fashion%20Forecast%20Popcorn%20No.2_%20Color-compressed.pdf",
      "pdf_label": "Race to Space Color Forecast",
      "figma": null,
      "sheets": "https://docs.google.com/presentation/d/1d2AuDGjMxD5UCVOA1GoauqRPMa3P-2g0wyPq1FMFT5g/preview",
      "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Color forecasting is deceptively hard. The goal isn't to identify colors that look interesting right now — it's to identify the cultural and commercial forces that will make a specific palette feel current twelve to eighteen months from now. The challenge was distinguishing the signal from the noise in a space aesthetic that was simultaneously high-fashion and tech-bro."
      },
      "approach": {
        "summary": "Traced the color palette from its cultural sources — NASA imagery, SpaceX livery and brand language, space-adjacent luxury campaigns — through to projected commercial application across activewear, accessories, and interiors. Built a directional palette with specific Pantone references and category application notes.",
        "data": ["Color Forecasting", "Cultural Trend Analysis", "Pantone Referencing", "Cross-Category Application Research"]
      },
      "results": {
        "before": ["Space aesthetic in fashion treated as costume or novelty rather than a directional trend", "Color palette undefined and inconsistent across early adopter brands", "No framework connecting cultural event (space race revival) to commercial color application"],
        "after": ["Defined a specific palette — deep navy, matte silver, iridescent off-white, acid orange — with documented cultural sourcing", "Mapped application across three priority categories with specific product direction", "Forecast directionally validated by subsequent runway and commercial collections in 2022-2023"]
      },
      "takeaways": [
        { "title": "A good color forecast tells a story, not just a palette", "body": "The palette is the output. The story — the cultural forces that are going to make that palette feel inevitable to a buyer twelve months from now — is the actual work. Anyone can identify colors that are trending. The valuable skill is explaining why they will still feel right when the product hits the floor." }
      ]
    },

  {
      "num": "02",
      "id": "sos-save-our-society",
      "title": "SOS - Save Our Society",
      "short": "Sustainability as Structural Behavior Change",
      "desc": "A macro trend forecast examining sustainability in fashion — not as a marketing strategy or a product category, but as a structural shift in how consumers relate to ownership, production, and brand accountability. Developed in 2021, when the industry was still largely responding to environmental pressure with greenwashing rather than systemic change. I wanted the forecast to cut through that noise and identify the behavioral shift that was actually happening.",
      "topic": "trend",
      "type": "Forecast",
      "year": "2021",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/sos-save-our-society-1.jpg",
      "gallery": ["https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/sos-save-our-society-1.jpg"],
      "media": [{ "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/sos-save-our-society-1.jpg" }],
      "pdf": null, "pdf_label": null, "figma": null, "sheets": null, "canva": null, "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Most sustainability forecasting at the time focused on materials innovation or resale market growth. What I was more interested in was the accountability shift: the growing consumer expectation that brands be provably responsible for their supply chains, not just vocally committed. Sustainability was becoming less about what a brand made and more about what it could demonstrate."
      },
      "approach": {
        "summary": "Analyzed emerging consumer research on purchase decision drivers, mapped the disconnect between stated sustainability values and actual purchasing behavior, and identified the tension between affordability and ethical production as the central unsolved problem in the space. The forecast treated this not as a marketing challenge but as a structural industry tension.",
        "data": ["Trend Analysis", "Consumer Behavior Research", "Sustainability Landscape Review", "Supply Chain Research"]
      },
      "results": {
        "before": ["Sustainability narratives focused on materials innovation and end-of-life recycling", "Consumer skepticism high due to widespread greenwashing and unverifiable claims", "No framework differentiating genuine transparency from performative commitment"],
        "after": ["Forecast identified provability and supply chain transparency as the emerging brand differentiators", "Connected behavioral economics research to consumption patterns in sustainable fashion", "Positioned accountability expectation as a durable structural shift, not a trend cycle that would reverse"]
      },
      "takeaways": [
        { "title": "Sustainability becomes real when consumers stop accepting claims and start demanding proof", "body": "The shift I was tracking in 2021 wasn't in materials or messaging — it was in consumer sophistication. When the audience gets smarter about how to evaluate environmental claims, the bar for authenticity rises permanently. Brands that didn't build genuine accountability infrastructure in this window are going to feel that pressure compound." }
      ]
    },

  {
      "num": "01",
      "id": "fashion-freedom",
      "title": "Fashion=Freedom",
      "short": "Gen Z, Digital Identity, and Self-Determination",
      "desc": "A macro trend forecast developed at FIT in 2021, during the period when conversations around digital identity and the metaverse were just starting to take real shape. I was interested in how Gen Z's relationship with privacy, self-expression, and technology was creating a fundamentally different relationship with fashion — not as a status signal, but as a medium for control.\n\nAt a time when so much of life had moved online and physical agency felt limited, what you wore — digitally or physically — was one of the few things you could still choose. That felt like the real driver underneath the aesthetic shifts everyone else was writing about.",
      "topic": "trend",
      "type": "Forecast",
      "year": "2021",
      "affiliation": "fit",
      "img": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/fashion-freedom-1.jpg",
      "gallery": [
        "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/fashion-freedom-1.jpg"
      ],
      "media": [
        { "type": "image", "src": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/images/fashion-freedom-1.jpg" }
      ],
      "pdf": "https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/assests/pdf/Fashion%20Equal%20Freedom%20Macro%20Trend%20Forecast-compressed.pdf",
      "pdf_label": "Fashion=Freedom Macro Trend Forecast",
      "figma": null, "sheets": null,
      "canva": "https://www.canva.com/design/DAExDRLnXhs/HC3jQIZs8NF4p8LtjCratQ/view?embed",
      "github": null, "live": null, "findings": null, "statMoments": null, "quotes": null, "impact": null, "statements": null,
      "context": {
        "problem": "Most trend forecasting in 2021 was focused on the aesthetic shift toward comfort and casualness post-pandemic. I wanted to look at something structurally different: the behavioral shift toward individuality and autonomy. Why were young consumers investing in digital goods? Why were microtrends accelerating while macro trends fragmented? The answer, I thought, was in the psychology of control."
      },
      "approach": {
        "summary": "Pulled from cultural analysis, emerging platform behavior — Roblox skins, NFT fashion drops, TikTok microtrends — and consumer psychology research on autonomy and self-expression. The forecast identified privacy, control, and self-authorship as the core drivers, not aesthetics, and traced how those drivers were manifesting in both digital and physical product choices.",
        "data": ["Trend Analysis", "Cultural Research", "Consumer Psychology", "Platform Behavior Analysis"]
      },
      "results": {
        "before": ["Trend forecasting framed around aesthetic shifts in silhouette and color", "Limited connection drawn between platform behavior and fashion consumption patterns", "Gen Z treated as a demographic rather than a behavioral cohort with distinct psychological drivers"],
        "after": ["Repositioned the trend around behavioral drivers rather than visual ones", "Connected metaverse activity, NFT fashion, and physical styling choices to a single underlying need for self-determination", "Forecast proved directionally accurate — the following two years saw significant investment in digital fashion and deeply individualized product lines"]
      },
      "takeaways": [
        { "title": "Trends are behavioral before they're visual", "body": "The mistake most forecasters make is chasing the aesthetic. The signal is always in the behavior underneath it. What are people doing, and why? The visual follows from that answer — not the other way around." }
      ]
    }
];
