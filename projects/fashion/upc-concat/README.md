# UPC Concat — Schema-Mapping & Concatenation Tool

A single-file, offline HTML tool that maps product data spread across multiple
spreadsheets into one **canonical schema**, joins the same physical SKU across
those files by **identity fields**, and resolves **concatenated descriptions**
through a safe Excel-like formula language.

The shipped profile ("Eyewear Starter") defines a canonical eyewear field
vocabulary but does **not** bind to any specific source files — register the
workbooks you actually use, then point each canonical field at the columns in
those workbooks.

- **File:** `index.html`
- **Standalone starter profile:** `default-profile.json` (also embedded inline)
- **Test fixtures:** `upc-concat-test-fixtures.md`

---

## How to host

The tool is a static page with no build step and no server-side code.

- **`file://`** — just double-click `index.html`. The only external
  dependency is SheetJS, loaded from a CDN; the first open needs an internet
  connection, after which the browser caches it.
- **Any static host** — host the `upc-concat/` folder anywhere (GitHub Pages, S3,
  nginx, `python -m http.server`). On cloonk.com it lives at
  `projects/fashion/upc-concat/` and is listed in the Fashion Toolbox.

All parsing, indexing, and resolution happen in the browser. No data is uploaded.

---

## The three-layer model

1. **Sources** — registered workbooks. Each source is one sheet of one workbook
   with a header row. Indices are built on the declared key columns when the
   file is attached.
2. **Canonical schema** — your standard field vocabulary. Two field types:
   - **Direct** — value looked up from a column in a source file.
   - **Derived** — value computed from a formula referencing other fields.
3. **Field mappings** — each direct field has an *ordered* list of
   `file → sheet → column` sources. Resolution walks the list; the first
   non-blank value wins.

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

## Steps

1. **Register source files.** Drop workbooks onto the dropzone or click
   "+ Register file". For each, pick the sheet and the header row (1-indexed),
   then declare the key columns — by header name, or by column letter (`G`)
   when the header cell is blank.
2. **Map each canonical field to** `file → sheet → column`. Open a field in
   the Schema panel. For direct fields, add one or more sources (a registered
   file plus a column in that file's sheet). For derived fields, write a
   formula referencing other canonical fields with `{name}`.
3. **Rank file priority** in the Sources panel. The order applies to every
   field's source list by default. Override on a per-field basis when needed.
4. **Define output templates** — named formulas that concatenate canonical
   fields into ready-to-paste descriptions.
5. **Paste keys and run.** Mix identity types freely — the tool detects each
   key's type and finds its cluster.
6. **Inspect & export.** Expand any row's *trail* to see where every value
   came from. Copy TSV, or download `.csv` / `.xlsx` (with a per-cell
   source-trail sheet).

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
- **Reset** — reloads the bundled `default-profile.json` (Eyewear Starter).
- **Discard** — reverts to the last saved state.

An orange dot next to the profile name marks unsaved changes.

To share a workflow: register your files, finish mapping, **Save** and then
**Export**, send the `.json` to a teammate, who **Imports** it and re-attaches
their own copies of the source files.

---

## Running a resolution

1. Register & attach source files (panel 1).
2. Map each canonical field's sources (panel 2).
3. Paste keys into panel 4 — one per line, any mix of identity types. The
   detected-type preview updates as you type once clusters exist.
4. Click **Run resolution**. The progress bar shows cluster building.
5. Results appear in panel 5 — sortable (click a header), filterable, with a
   per-row **trail** expander showing where every value came from.
6. Export via **Copy TSV**, **.csv**, or **.xlsx** (the xlsx file includes a
   second `_source_trail` sheet with per-cell attribution).

---

## Performance

- Indexing and clustering run in chunked work loops with a progress bar, so the
  UI stays responsive on large sheets (200K+ row workbooks).
- Lookups are O(1) per identity-index hit.
- The tool warns at 100K rows and refuses at 1M rows.

---

## Out of scope

Server-side parsing, authentication, writing back to source files, live API
integration, cross-row aggregation (`SUM`/`COUNT`), cell references in formulas,
product image rendering, and version diffing.
