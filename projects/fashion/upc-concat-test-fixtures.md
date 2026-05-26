# UPC Concat — Test Fixtures

A checklist for verifying the tool with your own files. The bundled profile is a
canonical-field starter only — it doesn't lock in any specific workbooks. Pick
two or more of your own source files (each with overlapping SKUs identified by
different keys) and walk through this list.

> **What's a hard contract vs. illustrative.** The hard contract is the
> **logic**: detection, cluster merging, leading-zero handling, broken-mapping
> warnings, formula behavior. The specific resolved values depend on your data
> and your mappings — those are illustrative only.

## How to run the check

1. Register at least two source files (Sources panel). Pick the sheet, the
   header row, and declare key columns for each.
2. For each canonical field you care about, map sources as `file → sheet → column`
   in the Schema panel.
3. Confirm no slot shows a red "column missing" badge. Fix any column-name
   mismatch in the schema editor first.
4. Paste a mix of identity keys into the Input panel.
5. The detect line should report a mix by identity type (e.g. `primary_upc`,
   `cpid`, `grid`, `art_base`, `material`).
6. Click **Run resolution** and inspect the table + per-row trails.

## What to verify

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | A raw UPC mapped only in File A | Detected as `primary_upc`, resolves to a cluster, brand fills from File A. |
| 2 | The same UPC with leading zeros (e.g. `0097963819817`) | Resolves to the same cluster as #1 — proves leading-zero variant indexing. |
| 3 | A CPID mapped only in File B | Detected as `cpid`, resolves to a cluster that also contains File A rows via shared identity. |
| 4 | A derived Grid (`{color} & {size}`) value | Detected as `grid`, resolves to the same cluster as #1 if the SKU is the same. |
| 5 | An Art Base value | Detected as `art_base`, resolves to the same cluster as #1. |
| 6 | A Material value shared across both files | Detected as `material`, resolves to a cluster with rows from both files. |
| 7 | A UPC present only in File A (no overlap) | Resolves to a cluster with File A rows; File-B-sourced fields are `BLANK`. |
| 8 | A SKU present only in File B (no overlap) | Same, mirror-image — brand falls back to File B per the priority list. |
| 9 | `0` or a single digit | `unmatched`, no crash. |
| 10 | A long string of zeros (`00000000000`) | `unmatched`, no crash, no false cluster hit. |
| 11 | A nonexistent UPC (`99999999999`) | `unmatched`, no crash. |
| 12 | An input line with leading/trailing whitespace | Trimmed and matched normally. |
| 13 | Two duplicate keys in the input | Both rows resolve identically and idempotently. |
| 14 | A blank input line | Skipped, not counted. |
| 15 | A SKU whose File-A column has a value but File-B column is blank | Brand resolves from File A (priority 1); trail shows priority 1. |
| 16 | A SKU whose File-A column is blank but File-B column has a value | Brand resolves from File B (priority 2); trail shows "priority 1 returned blank → priority 2". |
| 17 | Re-attach a file with a column renamed | The mapped source shows a red "broken" badge in the schema editor; resolution skips it. |
| 18 | A formula referencing a field that's blank | `&` concatenates as empty (Excel-style); `JOIN` drops blank args. |
| 19 | A formula with a circular reference (`a = {b} & "x"`, `b = {a} & "y"`) | Rejected at save; warning at the top of the page lists the cycle path. |
| 20 | A column with a blank header referenced by letter (e.g. `G`) | Resolves correctly via the letter fallback. |

## Expected behaviors to confirm

- **Cluster merge** — keys belonging to the same SKU (UPC, CPID, Grid, Art
  Base, Material) all share `cluster_id`. Toggle "show cluster_id" in the
  results filter bar to verify.
- **Leading zeros** — a raw and a zero-padded form of the same numeric identity
  resolve to the same cluster. If they don't, the numeric-variant indexing is
  broken.
- **Cross-file priority** — for a SKU present in both files, a field with two
  sources resolves from the higher-priority file when non-blank, and falls
  back when blank. Confirm with the per-row trail (`← … (priority N)`).
- **Derived fields** — the trail shows `derived: {formula}`; values like
  `desc_short` and `desc_full` concatenate with single spaces and drop blanks.
- **Unmatched** — degenerate inputs show `detected_identity = unmatched` and
  all canonical fields `BLANK`; the run does not error.
- **Templates** — each output template column populates for matched rows.
- **Export** — `.xlsx` export contains a `Resolved` sheet and a
  `_source_trail` sheet; row counts match the results table.

## Formula parser spot-checks

Paste these as derived fields and confirm the live preview / parse status:

| Formula | Expected behavior |
|---|---|
| `{color} & {size}` | concatenates color + size, blank handled as empty string |
| `PAD({primary_upc}, 13, "0")` | left-pads the UPC to 13 digits |
| `LEFT({material}, 3)` | first 3 characters of material |
| `IF({product_type} = "SUN", "SUNGLASSES", "OPTICAL")` | branches on product type |
| `JOIN(" ", {brand}, {material})` | brand + material with single space, blanks dropped |
| `a = {b} & "x"` paired with `b = {a} & "y"` | rejected — circular reference warning |
| `LEFT(42, 2)` | coerces silently → `"42"` then takes 2 chars → `"42"` |
| `CONCAT({brand}, BLANK, {material})` | blank arg dropped from output |
