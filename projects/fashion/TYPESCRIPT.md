# TypeScript migration

## Selling Analysis

Maintained sources:

- `selling-analysis/src/selling-analysis.ts`
- `selling-analysis/src/selling-analysis-app.ts`
- `selling-analysis/src/selling-analysis-globals.d.ts`

The HTML page loads these generated browser artifacts:

- `selling-analysis/dist/selling-analysis.js`
- `selling-analysis/dist/selling-analysis-app.js`

From `projects/fashion`, install dependencies and run:

```powershell
npm install
npm run check:selling-analysis
npm run build:selling-analysis
```

Node.js LTS is installed through `winget`. Restart the VS Code terminal after
installation so `node` and `npm` are added to that terminal's `PATH`.

Keep the generated JavaScript files committed because this repository is
deployed as a static site without a server-side build step.

Both Selling Analysis TypeScript files are compiler-checked. The engine has
typed data contracts, while the DOM-heavy application uses transitional types
at chart and third-party library boundaries that can be narrowed incrementally.

Edit files under `selling-analysis/src`. Do not edit the matching files under
`selling-analysis/dist`, because the next build replaces them.

## UPC Concat

Maintained source:

- `upc-concat/src/upc-concat.ts`

Generated browser artifact:

- `upc-concat/dist/upc-concat.js`

Run:

```powershell
npm run check:upc-concat
npm run build:upc-concat
```

UPC Concat is compiler-checked without suppression directives. Its dynamic
`App` namespace and DOM/XLSX boundaries use transitional declarations, while
collections, IndexedDB access, build output, and browser loading are checked.

## Retail Data Standardizer

Maintained sources:

- `sellout-standardizer/src/sellout-standardizer.ts`
- `sellout-standardizer/src/sellout-standardizer-globals.d.ts`

Generated browser artifact:

- `sellout-standardizer/dist/sellout-standardizer.js`

Run:

```powershell
npm run check:sellout-standardizer
npm run build:sellout-standardizer
```

## Assortment Comparison

Maintained sources are under `assortment-comparison/src`; generated JavaScript
is under `assortment-comparison/dist`.

```powershell
npm run check:assortment-comparison
npm run build:assortment-comparison
```

## DIGI Line Sheet

Maintained sources are under `replenishment-linesheet/src`; generated
JavaScript is under `replenishment-linesheet/dist`.

```powershell
npm run check:replenishment-linesheet
npm run build:replenishment-linesheet
```

## Image Prep

Maintained sources are under `image-prep/src`; generated JavaScript is under
`image-prep/dist`.

```powershell
npm run check:image-prep
npm run build:image-prep
```

## Door Tracker

Maintained sources are under `door-tracker/src`; generated JavaScript is under
`door-tracker/dist`.

```powershell
npm run check:door-tracker
npm run build:door-tracker
```

The tracker keeps its existing classic-script runtime so HTML event handlers,
Mapbox, Supabase, IndexedDB, XLSX, and the static seed/config scripts continue
to use the same browser globals.

To check or build every migrated tool:

```powershell
npm run check
npm run build
```
