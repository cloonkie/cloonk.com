# PDF Studio

A local, browser-based PDF + media toolkit, styled in the cloonk design system.
Modeled on the everyday jobs people open Acrobat for — but everything runs
client-side. **No account, no upload, no server.** A file dropped in never
leaves the browser tab.

Live: <https://cloonk.com/projects/pdf-studio/>

## Tools

| Tool | What it does |
| --- | --- |
| **Organize & view** | Render and read a PDF, search its text, drag pages to reorder, rotate or delete individual pages, then export a fresh PDF. Print the current arrangement. |
| **Merge** | Combine several PDFs *and* images into one file; drag the cards to set order. |
| **Split & extract** | Pull out custom page ranges (`1-3, 5, 8-10`), burst every page into its own file, or split into fixed-size chunks. Multi-file output comes back as a `.zip`. |
| **Compress** | Shrink a heavy/scanned PDF by re-rendering pages to JPEG at a chosen DPI and quality. Reports the before→after size. |
| **Watermark** | Stamp diagonal text (DRAFT, CONFIDENTIAL, …) across every page with adjustable opacity, size and angle. |
| **Page numbers** | Add numbers in several formats (`1`, `1 / N`, `Page 1 of N`) and any corner/center, with a custom start value. |
| **Metadata** | Read and rewrite title, author, subject and keywords. |
| **Images → PDF** | Turn JPG/PNG/WebP into a PDF, one image per page, with page-size and margin options. Drag to reorder. |
| **PDF → Images** | Render every page to PNG or JPEG at 1×/2×/3× and download as a `.zip`. |
| **Extract text** | Pull the selectable text layer out to `.txt` (scanned image-only PDFs have no text layer — that needs OCR, which this tool doesn't do). |
| **Image compressor** | Batch resize / re-quality / convert images to JPEG, WebP or PNG; download all as a `.zip`. |

## How it works

Pure front-end. No build step.

- **[pdf.js](https://github.com/mozilla/pdf.js)** — page rendering, text search, text extraction.
- **[pdf-lib](https://pdf-lib.js.org/)** — every structural edit: merge, split, copy/reorder/rotate/delete pages, embed images, draw watermarks and page numbers, read/write metadata.
- **[JSZip](https://stuk.github.io/jszip/)** — packaging multi-file output.
- **Canvas API** — image compression/conversion and PDF page rasterization.

All three libraries load from jsDelivr; once the page is cached it works offline.

```
projects/pdf-studio/
├── index.html       # shell: header, tool rail, panels
├── pdf-studio.css   # cloonk theme ramp + components
├── pdf-studio.js    # ES module — all eleven tools
└── README.md
```

## Honest limits (browser-only)

These were intentionally **not** built, because they can't be done well — or
at all — without a backend, and a server would break the "nothing leaves your
machine" guarantee that is the point of the tool:

- **OCR** (scanned image → searchable text)
- **Password encryption / decryption** (pdf-lib can't add a password)
- **E-signatures / signature workflows** (needs identity + a server)
- **AI summarize / chat / rewrite** (needs a model API)
- **Office conversion** (PDF ⇄ Word/Excel/PowerPoint with layout fidelity)

The compressor is most effective on scans and image-heavy PDFs; a PDF that is
mostly vector text is already small and may not shrink (the tool says so when
that happens).
