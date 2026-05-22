# UPC Concat — Schema-Mapping & Concatenation Tool

A single-file, offline HTML tool that maps product data spread across multiple
spreadsheets into one **canonical schema**, joins the same physical SKU across
those files by **identity fields**, and resolves **concatenated descriptions**
through a safe Excel-like formula language.

It ships with an eyewear example profile, but the engine is generic — nothing
about eyewear is hard-coded. It is a small ETL/concat engine that happens to
come pre-loaded with two sample EssilorLuxottica file definitions.

- **File:** `upc-concat.html` (single file, ~110 KB unminified)
- **Standalone profile:** `default-profile.json` (also embedded inline in the HTML)
- **Test fixtures:** `upc-concat-test-fixtures.md`

---

## How to host

The tool is a static page with no build step and no server-side code.

- **`file://`** — just double-click `upc-concat.html`. The only external
  dependency is SheetJS, loaded from a CDN; the first open needs an internet
  connection, after which the browser caches it.
- **Any static host** — drop `upc-concat.html` anywhere (GitHub Pages, S3,
  nginx, `python -m http.server`). On cloonk.com it lives at
  `projects/fashion/upc-concat.html` and is listed in the Fashion Toolbox.

All parsing, indexing, and resolution happen in the browser. No data is uploaded.

---

## The three-layer model

1. **Sources** — registered files. Each has a sheet, a header row (1-indexed),
   and one or more declared **key columns** used as join keys. Indices are built
   on those columns when the file is attached.
2. **Canonical schema** — your standard field vocabulary. Two field types:
   - **Direct** — value looked up from a column in a source file.
   - **Derived** — value computed from a formula referencing other fields.
3. **Field mappings** — each direct field has an *ordered* list of
   `{file, column}` sources. Resolution walks the list; the first non-blank
   value wins.

### Priority

- **File-level priority** ranks all files top to bottom (drag to reorder in
  panel 1). This is the default source order for every direct field.
- **Field-level override** — tick "override file priority" inside a field to
  reorder that field's sources independently. Each source row shows whether it
  is `inherited` or `manual`.

### Identity & clusters

Fields flagged ★ **identity** are used to join rows. On *Run*, the tool builds a
cluster index: every source row's identity values become aliases for one logical
SKU, and rows across files that share *any* identity value merge into one
cluster. Paste a UPC, CPID, Grid, Art Base, Material — anything mapped to an
identity field — and the tool finds the cluster, then resolves every field by
walking priority across all rows in that cluster.

Leading-zero UPCs are handled: numeric identity values are indexed in raw,
zero-stripped, and zero-padded (11–14 digit) forms, so `0097963819817` and
`97963819817` collide correctly.

---

## Adding a new source file

1. Click **+ Register file** in panel 1.
2. Choose the workbook, pick the sheet and the header row.
3. Give it a `file id` (e.g. `file_pricing`).
4. List the **key columns** — by header name, or by spreadsheet letter
   (`G`) when the header cell is blank.
5. Register. The file appears as a slot; map canonical fields to its columns in
   the schema editor.

Files dropped onto the dropzone are auto-matched to profile slots by the
`expected_filename_pattern` (glob with `*`). Unmatched files become new ad-hoc
slots automatically.

If a re-attached file is missing a mapped column, that source is flagged with a
red badge; resolution skips it and records the skip in the source trail.

---

## Defining a derived field

1. Click **+ Derived field** in panel 2.
2. Open the field, rename it, write a formula.
3. The preview box shows syntax highlighting; parse errors appear live.
4. Optionally tick ★ to make the derived value an identity (join) field.

Formulas are evaluated per row in dependency order (topological sort). Circular
references are detected and reported in the warnings strip at the top of the
page.

### Expression language

No `eval()` — a hand-written tokenizer + recursive-descent parser + interpreter.

**References & literals**

| Form | Meaning |
|---|---|
| `{field_name}` | value of another canonical field |
| `"text"` `'text'` | string literal |
| `42` `3.14` | number literal |
| `TRUE` `FALSE` | boolean |
| `BLANK` | blank (empty, but distinct from `""`) |

**Operators**

- `&` — string concatenation (blank concatenates as empty, Excel-style)
- `+` `-` `*` `/` — numeric, with string→number coercion when pure numeric
- `=` `<>` `<` `<=` `>` `>=` — comparison, returns boolean

**Functions** (case-insensitive)

| Function | Meaning |
|---|---|
| `CONCAT(a,b,…)` | concatenate, blank args dropped |
| `JOIN(delim,a,b,…)` | concatenate with delimiter, blank args dropped |
| `IF(cond,then,else)` | conditional |
| `IFBLANK(v,fallback)` | fallback if `v` is blank |
| `COALESCE(a,b,…)` | first non-blank value |
| `UPPER LOWER TRIM` | string case / whitespace |
| `LEFT(s,n) RIGHT(s,n) MID(s,start,len)` | substrings, 1-indexed |
| `LEN(s)` | string length |
| `PAD(s,len,char)` | left-pad (default char `0`) — for UPC normalization |
| `REPLACE(s,find,rep)` / `SUBSTR` | string replace (all occurrences) |
| `CONTAINS STARTSWITH ENDSWITH` | boolean tests |
| `NUMBER(s)` | coerce to number |
| `TEXT(n)` | coerce to text |

**Examples**

```
grid          = {color} & {size}
art_base      = {material} & {color} & {size}
desc_short    = JOIN(" ", {brand}, {material}, {eye_size})
desc_full     = JOIN(" ", {brand}, {material}, {eye_size}, {frame_color_desc}, {lens_color_desc}, IFBLANK({lens_features}, ""))
upc_padded    = PAD({primary_upc}, 13, "0")
is_sun        = IF({product_type} = "SUN", "SUNGLASSES", "OPTICAL")
gender_letter = LEFT({gender}, 1)
price_display = NUMBER({msrp_us}) & " " & IFBLANK({msrp_currency}, "USD")
```

Error behavior: an undefined `{field}` returns `BLANK` with a warning shown in
the row's source trail; a sensible type mismatch coerces silently, otherwise
returns `BLANK`; circular references are rejected and listed in the warnings.

---

## Output templates

Panel 3 holds named formulas evaluated after all canonical fields resolve. Each
template becomes a column in the results table and a column in exports. They use
the same expression language and can reference any canonical field.

---

## Sharing profiles with teammates

A **profile** is the full configuration — schema, mappings, file priority,
templates — *without* the source data. Files are re-attached each session.

- **Save** — names the current config and stores it in `localStorage`
  (key `upc_concat_profiles`).
- **Export** — downloads the profile as JSON.
- **Import** — loads a JSON profile from disk; re-attach the source files after.
- **Reset** — reloads the bundled `default-profile.json`.
- **Discard** — reverts to the last saved state.

An orange dot next to the profile name marks unsaved changes.

To share a workflow: build and test it, **Export**, send the `.json` to a
teammate, who **Imports** it and drops their own copy of the source files into
the matching slots.

---

## Running a resolution

1. Attach source files (panel 1).
2. Paste keys into panel 4 — one per line, any mix of identity types. The
   detected-type preview updates as you type once clusters exist.
3. Click **Run resolution**. The progress bar shows cluster building.
4. Results appear in panel 5 — sortable (click a header), filterable, with a
   per-row **trail** expander showing where every value came from.
5. Export via **Copy TSV**, **.csv**, or **.xlsx** (the xlsx file includes a
   second `_source_trail` sheet with per-cell attribution).

---

## Performance

- Indexing and clustering run in chunked work loops with a progress bar, so the
  UI stays responsive on large sheets (216K-row `OpenText` is the design
  target).
- Lookups are O(1) per identity-index hit.
- The tool warns at 100K rows and refuses at 1M rows.

---

## Out of scope

Server-side parsing, authentication, writing back to source files, live SAP/API
integration, cross-row aggregation (`SUM`/`COUNT`), cell references in formulas,
product image rendering, and version diffing.
