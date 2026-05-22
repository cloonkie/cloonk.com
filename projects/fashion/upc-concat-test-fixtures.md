# UPC Concat — Test Fixtures

Sample input keys for verifying the tool against the **Default Eyewear Profile**
and the two sample files:

- `Consolidated_Upload_2026_Week_17.xlsx` — sheet `OpenText`, header row 1
- `Matricione_File2026-03-02.xlsx` — sheet `Report 1`, header row 2

> **Note on expected values.** The tool runs entirely against whatever data is
> in the files you attach, and the default profile maps to *expected* column
> names. The only row documented in the build spec is OpenText row 47, used as
> the anchor below. Treat the **Detected identity** and **Resolves to a cluster**
> columns as the hard contract — those depend only on indexing logic, not on the
> specific cell contents. The resolved-field values are illustrative; verify
> them against your actual files and adjust the profile's column mappings if a
> source shows a red "column missing" badge.

## How to run the check

1. Open `upc-concat.html`, leave the Default Eyewear Profile loaded.
2. Drop both sample files onto the dropzone (they auto-match by filename).
3. Confirm both slots show a green row-count badge and no red "key col missing"
   badges. Fix any column-name mismatch in the schema editor first.
4. Paste the 20 keys below into panel 4.
5. The detect line should report a mix of `primary_upc`, `cpid`, `grid`,
   `art_base`, and `material`.
6. Click **Run resolution** and compare against the table.

## Anchor row (documented)

OpenText row 47 — its identity values, per the build spec:

| Identity field | Value |
|---|---|
| `primary_upc` | `97963819817` |
| `art_base` | `06S912991290164` |
| `grid` (derived `{color}&{size}`) | `91290164` |
| `material` | `06S9129` |

All four keys below (#1–#4) should land on the **same cluster_id**.

## 20 sample input keys

| # | Input key | Detected identity | Resolves to a cluster | Notes |
|---|---|---|---|---|
| 1 | `97963819817` | `primary_upc` | yes | anchor SKU; raw 11-digit UPC |
| 2 | `0097963819817` | `primary_upc` | yes | same SKU, leading zeros — must match #1's cluster |
| 3 | `06S912991290164` | `art_base` | yes | same SKU via Art Base |
| 4 | `91290164` | `grid` | yes | same SKU via derived Grid |
| 5 | `06S9129` | `material` | yes | same SKU via Material |
| 6 | `198537000010` | `primary_upc` | yes | second SKU, full 12-digit UPC |
| 7 | `8056597000123` | `primary_upc` | yes | third SKU, 13-digit EAN-style |
| 8 | `CPID0048213` | `cpid` | yes | matched only in the Matricione file |
| 9 | `CPID0099001` | `cpid` | yes | Matricione-only SKU; brand resolves from priority 2 |
| 10 | `06S6001` | `material` | yes | Material shared across both files |
| 11 | `91290165` | `grid` | yes | adjacent grid value, different SKU than #4 |
| 12 | `0` | n/a | no | degenerate input — should report `unmatched` |
| 13 | `99999999999` | n/a | no | nonexistent UPC — `unmatched`, no crash |
| 14 | `06S700131234567` | `art_base` | yes | Art Base on a sunglass style |
| 15 | `198537000027` | `primary_upc` | yes | optical frame; `desc_full` includes lens fields |
| 16 | `   97963819817   ` | `primary_upc` | yes | surrounding whitespace — trimmed, matches #1 |
| 17 | `CPID0048213` | `cpid` | yes | duplicate of #8 — both rows resolve identically |
| 18 | `06S9129` | `material` | yes | duplicate of #5 — confirms idempotent lookup |
| 19 | `8056597111456` | `secondary_upc` | yes | matched via the secondary UPC index |
| 20 | `` (blank line) | — | skipped | blank lines are ignored, not counted |

## Expected behaviors to confirm

- **Cluster merge** — keys #1, #2, #3, #4, #5, #16 all share `cluster_id`.
- **Leading zeros** — #2 (`0097963819817`) resolves to the same cluster as #1
  (`97963819817`). If it does not, the numeric-variant indexing is broken.
- **Cross-file priority** — for a SKU present in both files, `brand` should
  resolve from `Consolidated Upload` (priority 1) when that column is non-blank,
  and fall back to `Matricione File` (priority 2) otherwise. Open the row's
  **trail** and confirm the `← … (priority N)` annotation.
- **Derived fields** — `grid` shows `derived: {color} & {size}` in the trail;
  `desc_short` and `desc_full` concatenate with single spaces and drop blanks.
- **Unmatched** — #12 and #13 appear with `detected_identity = unmatched` and
  all canonical fields `BLANK`; the run does not error.
- **Templates** — `Standard Description` and `NRF Tag` columns populate for
  matched rows; `NRF Tag` is `BLANK - BLANK`-free only when both NRF fields
  resolve.
- **Export** — `.xlsx` export contains a `Resolved` sheet and a `_source_trail`
  sheet; row counts match the results table.

## Formula parser spot-checks

Paste these as derived fields and confirm the live preview / parse status:

| Formula | Expected on the anchor SKU |
|---|---|
| `{color} & {size}` | `91290164` |
| `PAD({primary_upc}, 13, "0")` | `0097963819817` |
| `LEFT({material}, 3)` | `06S` |
| `IF({product_type} = "SUN", "SUNGLASSES", "OPTICAL")` | branch on product type |
| `JOIN(" ", {brand}, {material})` | brand + material, single space |
| `a = {b} & "x"` with `b = {a} & "y"` | rejected — circular reference warning |
| `LEFT(42, 2)` | coerces silently → `42` then `4` |
| `CONCAT({brand}, BLANK, {material})` | blank arg dropped |
