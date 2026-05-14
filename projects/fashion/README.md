# Fashion Tools — cloonk.com

Browser-based tools for merchandising, assortment, and product analytics work. Each tool is a single self-contained HTML file with no build step — load the page, drop in a spreadsheet, work locally in the browser.

All tools share the cloonk.com theme (palette + fonts) and the same `cloonk-theme` localStorage key, so toggling light/dark in any tool flips the main site too, and vice versa.

---

## Tools

| File | Purpose |
| --- | --- |
| [`replenishment-linesheet.html`](replenishment-linesheet.html) | Upload a replenishment line sheet, annotate SKUs, and export selected styles. |

More tools land here over time. The header popover in each tool links to its siblings.

---

## RP Line Sheet — Replenishment Review

### What it does
Loads a replenishment-style spreadsheet (one row per SKU) and renders each row as a card. You can filter, sort, search, annotate with notes, attach product photos, select the SKUs you want to keep, and export the selection back to `.xlsx`.

The whole thing runs in the browser — nothing is uploaded anywhere.

### Quick start
1. Open [`replenishment-linesheet.html`](replenishment-linesheet.html).
2. Click **↓ Template** to download a blank `.xlsx` with the expected columns.
3. Fill it in and load it via **↑ Load Sheet** (or drag-and-drop onto the landing zone).
4. Optionally click **↑ Images** to bulk-attach product photos by filename.
5. Filter / sort / search to narrow the assortment, click cards to select, write notes.
6. Click **↓ Export Selects** to download a `.xlsx` of just the selected SKUs (with your notes).

### Spreadsheet schema

The first sheet of the workbook is read. Expected columns (exact header names):

| Column | Type | Notes |
| --- | --- | --- |
| `Brand` | text | Populates the brand filter. |
| `SKU` | text | Internal style code. |
| `UPC` | text | Used to match embedded `.xlsx` images by UPC. |
| `Image` | text | Optional. URL or `=IMAGE("…")` formula — used as the card photo if present. |
| `Rank` | number | Default sort field. |
| `Status` | text | Free text — `Active`, `Discontinued`, `EOL`, etc. Status-specific colors are applied. |
| `Style` | text | Style name shown on the card. |
| `Material` | text | Used in search + image filename matching. |
| `Grid` | text | Used in search + image filename matching. |
| `Color` | text | A dot is drawn using a guessed swatch from the color name. |
| `Polarized` | boolean | `true` / `false` / `yes` / `no` / `1` / `0`. |
| `Size` | text | Free text. |
| `MSRP` | number | Rendered as currency. |
| `EOL Date` | date | Excel date or text. |
| `Release` | text | Free text. |
| `YTD Sls U` | number | Highlighted as a KPI on the card. |
| `Order Level` | number | |
| `On Hand U` | number | |
| `5-Wk Avg S/T %` | number | Sell-thru. Stored as a fraction — `0.04` and `4%` both work. |
| `Notes` | text | Pre-fills the card's note field. |

Unknown / missing values render as `—`.

### Images — three sources, in priority order

1. **`Image` column URL or `=IMAGE("…")` formula.** Highest priority. Excel error values (`#VALUE!`, `#N/A`, etc.) are ignored.
2. **Embedded `.xlsx` images.** If the workbook has images anchored to rows (Insert → Pictures → "Cell over the picture") or stored as Excel rich-data web images, they're extracted via JSZip and matched by UPC or row index.
3. **Bulk-loaded local files via ↑ Images.** Click the button and pick any number of image files. Each image's filename (sans extension, case-insensitive) is matched against `SKU`, `Style`, `Grid`, or `Material` on every SKU. The first match wins. A toast reports how many matched.

Clicking a card photo opens a full-screen lightbox.

### Filters and sort

- **Brand** — populated from the loaded data.
- **Status** — populated from the loaded data.
- **Polarized** — Yes / No / All.
- **Show** — All / Selected / Not Selected.
- **Search** — free text, matches `Style`, `SKU`, `Color`, `Brand`, `Material`.
- **Sort** — Rank, MSRP, Brand A–Z, Sell-Thru, each with asc/desc.

The header shows live `Total / Selected / Filtered` counts.

### Selection and export

- Click anywhere on a card (outside the notes textarea and the photo) to toggle selection.
- **Select All Visible** picks every card currently in view.
- The bottom selection bar shows live count + quick export.
- **↓ Export Selects** writes `RP_Selects_YYYY-MM-DD.xlsx` containing the selected rows plus a `Selected: YES` column and any notes you wrote.

Notes persist for the session (in-memory) and are written into the export. They are **not** saved back to the original file.

### Theme

Both light and dark use the cloonk palette:
- Dark: `#0a0a0a` bg, `#f5f2ec` fg, `#39ff14` neon green accent
- Light: `#f5f2ec` bg, `#0a0a0a` fg, `#1b09bc` royal blue accent

Toggle via the sun/moon button in the header. The chosen theme is shared with `cloonk.com` via the `cloonk-theme` localStorage key — changing it in one tab updates other open cloonk tabs live.

### Tech

- [SheetJS](https://sheetjs.com/) for `.xlsx` read/write.
- [JSZip](https://stuk.github.io/jszip/) (loaded on demand) for extracting embedded `.xlsx` images.
- Cabinet Grotesk + Satoshi from [Fontshare](https://www.fontshare.com/); DM Mono from Google Fonts.
- No framework, no build step, no backend.

### Browser support

Anything that supports `FileReader`, `URL.createObjectURL`, and `color-mix(in oklab, …)` — Chrome / Edge / Firefox / Safari from roughly mid-2023 onward.
