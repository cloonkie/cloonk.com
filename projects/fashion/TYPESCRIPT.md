# TypeScript migration

## Selling Analysis

Maintained sources:

- `src/selling-analysis/selling-analysis.ts`
- `src/selling-analysis/selling-analysis-app.ts`
- `src/selling-analysis/selling-analysis-globals.d.ts`

The HTML page loads these generated browser artifacts:

- `dist/selling-analysis/selling-analysis.js`
- `dist/selling-analysis/selling-analysis-app.js`

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

Edit files under `src/selling-analysis`. Do not edit the matching files under
`dist/selling-analysis`, because the next build replaces them.

## UPC Concat

Maintained source:

- `src/upc-concat/upc-concat.ts`

Generated browser artifact:

- `dist/upc-concat/upc-concat.js`

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

- `src/sellout-standardizer/sellout-standardizer.ts`
- `src/sellout-standardizer/sellout-standardizer-globals.d.ts`

Generated browser artifact:

- `dist/sellout-standardizer/sellout-standardizer.js`

Run:

```powershell
npm run check:sellout-standardizer
npm run build:sellout-standardizer
```

## Assortment Comparison

Maintained sources are under `src/assortment-comparison`; generated JavaScript
is under `dist/assortment-comparison`.

```powershell
npm run check:assortment-comparison
npm run build:assortment-comparison
```

## DIGI Line Sheet

Maintained sources are under `src/replenishment-linesheet`; generated
JavaScript is under `dist/replenishment-linesheet`.

```powershell
npm run check:replenishment-linesheet
npm run build:replenishment-linesheet
```

## Image Prep

Maintained sources are under `src/image-prep`; generated JavaScript is under
`dist/image-prep`.

```powershell
npm run check:image-prep
npm run build:image-prep
```

## Door Tracker

Maintained sources are under `src/door-tracker`; generated JavaScript is under
`dist/door-tracker`.

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
