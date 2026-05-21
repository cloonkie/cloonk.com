# Fashion Tools — cloonk.com

Browser-based tools for merchandising, assortment, and product analytics work. Each tool is a single self-contained HTML file with no build step — load the page, drop in a spreadsheet, work locally in the browser.

All tools share the cloonk.com theme (palette + fonts) and the same `cloonk-theme` localStorage key, so toggling light/dark in any tool flips the main site too, and vice versa.

---

## Tools

| File | Purpose |
| --- | --- |
| [`replenishment-linesheet.html`](replenishment-linesheet.html) | Upload a replenishment line sheet, annotate SKUs, and export selected styles. |
| [`assortment-comparison.html`](assortment-comparison.html) | Compare retailer assortments by UPC/style + color + grid; visualize overlap. |
| [`retailer-door-tracker.html`](retailer-door-tracker.html) | Track brand × retailer door distribution. Map reveal, change history, restore points. |

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

---

## Door Tracker — DS Distribution

### What it does
Tracks brand × retailer door distribution at the physical-store level. The matrix view shows confirmed door counts per (retailer, brand); drill into a cell to see which specific doors carry the brand, edit status (Confirmed / TBD / N/A / Closed), assign tier grades, and write per-door notes. Door Research browses every door on a Mapbox map with fly-in transitions.

### Persistence model
- **Autosave** is backed by IndexedDB (`door-tracker-autosave` DB → `snapshots` store, key `latest`) — every edit is debounced at 250 ms and written to a single keyed row. Legacy `localStorage['doorTrackerAutosave']` is migrated forward on first load and then deleted.
- **Restore points** live in the `restorePoints` store of the same DB. The app captures one automatically every 5 minutes (last 10 kept) and you can capture named ones on demand from the **📌 Snapshots** header button. Restoring a snapshot first creates a `before restore` auto-snapshot so the action is itself undoable.
- **Save / Load** still produce a `door-data.json` file for offline / shared-drive distribution.

### Change history
Every mutation calls `recordHistory(retailer, brand, entry)` which appends to a `history{}` object keyed by `retailer|brand`. The header **⟳ History** button opens a chronological feed of every change across every pair (latest 400 shown, click any row to jump to that pair's drawer). Per-pair history is still reachable from the cell drawer's "⟳ History" button. The author is the currently signed-in user (see Auth wall below).

### Auth wall and attribution
The page is gated by a client-side sign-in modal. **This is not real security** — anyone with browser dev tools can read the user roster and bypass it. It exists for two things: (1) keeping casual viewers out, and (2) attaching a name to every history entry. For confidential data, host the file behind real auth (Cloudflare Access, Netlify Identity, etc.).

The roster is the `USER_ROSTER` object near the bottom of the main script. Each entry maps a lowercase username to `{ hash, name }`, where `hash` is the SHA-256 hex of the password. To add a user, compute the hash in any browser console:

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-password'))
  .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
```

…and append `'username': { hash: '<hex>', name: 'Display Name' }`. The seeded placeholder is `kevin / admin` — replace it.

Session persists across reloads in `localStorage['cloonk-doortracker-user']`. The header shows a chip with the user's name and a **Sign out** action; signing out clears the session and re-prompts.

### Guest mode
The login modal also has a **Continue as guest** button. Guests get a blank anonymized template (`GUEST_SEED` — three generic retailers, three generic brands, five demo doors) and a sandboxed autosave key (`guest:latest` in the same IDB), so guest activity never touches the signed-in user's data. Restore points are tagged with `mode: 'guest' | 'user'` and filtered in the Snapshots list, so the two modes don't see each other's snapshots. Signing out as a guest wipes the sandbox so the next guest sees a fresh template. The user chip shows in the draft-orange color while in guest mode to make the state obvious.

### Map
[Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) renders door details. The access token is a public `pk.*` token URL-restricted to `cloonk.com` in the Mapbox dashboard. The map style follows the cloonk theme (`light-v11` / `dark-v11`) and re-styles live when the theme is toggled.

### Theme
Same `cloonk-theme` localStorage key as the rest of the toolbox — toggling in any tool flips them all (and the main site).
