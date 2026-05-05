# cloonk ʕ·ᴥ·ʔ

Personal portfolio of **Kevin Zhang** — designer and data analyst.  
Live at [cloonk.com](https://cloonk.com) · Deployed via GitHub Pages.

---

## Stack

Vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no dependencies.  
Assets hosted on Cloudflare R2. Typefaces via [Fontshare](https://www.fontshare.com).

---

## Structure

```
cloonk.com/
├── index.html              # Entry point — all routing handled client-side
├── project.html            # Project detail page shell
├── projects-data.js        # All project entries (single source of truth)
├── project-detail.js       # Renders project detail panels and GitHub cards
├── scroll-carousel.js      # 3D scroll carousel with touch + resize support
├── scroll-carousel.css     # Carousel styles (4 responsive breakpoints)
├── github-card.css         # Styled source code card for GitHub-only projects
└── assets/
    └── images/             # Local assets (project images hosted on R2)
```

---

## Design System

### Color

| Token | Dark Mode | Light Mode |
|---|---|---|
| Background | `#0a0a0a` | `#f5f2ec` |
| Foreground | `#f5f2ec` | `#0a0a0a` |
| Accent | `#39ff14` | `#1b09bc` |

### Typography

| Role | Font | Source |
|---|---|---|
| Display | Cabinet Grotesk | Fontshare |
| Body | Satoshi | Fontshare |

### Logo

The logo string `"cloonk ʕ·ᴥ·ʔ"` uses exact Unicode:  
`U+0295 U+00B7 U+1D25 U+00B7 U+0294` — the bear-nose character is `U+1D25`, not the visually similar `U+1D65`.

---

## Adding a Project

All projects live in `projects-data.js` as entries in the `projects` array. Every entry must follow this schema exactly — missing fields will break the renderer.

```js
{
  "num": "34",                          // Display order (string)
  "id": "your-project-id",             // Unique slug, used in routing
  "title": "Project Title",
  "short": "One-line descriptor",
  "desc": "Abstract shown in card and detail header.",
  "topic": "ux research",              // Filter category
  "type": "UX Research",               // Display label
  "year": "2026",
  "affiliation": "pratt",              // "pratt" | "work" | "personal"
  "img": "https://...r2.dev/image.png",
  "gallery": ["https://..."],          // Array of image URLs
  "media": [
    { "type": "image", "src": "https://..." }
  ],
  "pdf": null,                         // PDF URL or null
  "pdf_label": null,                   // Button label string or null
  "figma": null,                       // Figma embed URL or null
  "sheets": null,
  "canva": null,
  "github": null,                      // GitHub repo URL or null
  "live": null,                        // Live site URL or null
  "context": {
    "problem": "What was broken and why it mattered.",
    "why": [
      "Bullet one",
      "Bullet two",
      "Bullet three"
    ]
  },
  "approach": {
    "summary": "How you approached solving the problem.",
    "data": ["Tool A", "Tool B", "Method C"]
  },
  "results": {
    "before": ["Finding one", "Finding two"],
    "after": ["Outcome one", "Outcome two"]
  },
  "takeaways": [
    {
      "title": "The headline lesson.",
      "body": "The elaboration on what you learned and why it matters."
    }
  ]
}
```

### GitHub-only projects

If a project has a `github` URL but no `pdf`, `figma`, or other artifacts, the detail panel renders a styled source code card instead of the artifact dropdown. Set all other media fields to `null`.

If a project has GitHub *plus* other artifacts, the card renders above the existing dropdown.

The language badges in the card are driven by the `approach.data` array — list languages and tools there as you normally would.

---

## Deployment

The site deploys automatically via GitHub Pages on push to `main`.  
Custom domain: `cloonk.com` — configured via `CNAME` file at the repo root.

No build step. What you push is what goes live.

---

## Easter Eggs & Details

A few intentional details worth knowing about — both for anyone poking around the code and as a reminder not to accidentally remove them.

### The Bear `ʕ·ᴥ·ʔ`

The logo isn't decorative copy-paste — it's a precisely constructed kaomoji. Each character is hardcoded:

| Character | Unicode | Role |
|---|---|---|
| `ʕ` | U+0295 | Left arm |
| `·` | U+00B7 | Left eye |
| `ᴥ` | U+1D25 | Nose |
| `·` | U+00B7 | Right eye |
| `ʔ` | U+0294 | Right arm |

The nose `U+1D25` is a Latin letter for voiced uvular trill. There is a visually identical character at `U+1D65` — do not substitute it. The kaomoji will look the same but the character will be wrong.

### Custom Cursor

The site replaces the default OS cursor with a custom cursor. Implemented in CSS/JS — if you're debugging pointer behavior or hit-testing, check for cursor override styles before assuming the browser default is active.

### Draggable Photos

Certain images on the site are interactive — they can be picked up and moved around the page. This is intentional, not a layout bug. If photos appear out of place, a visitor probably moved them.

### Custom Photoshopped Assets

Several project thumbnails and hero images are original composites — not stock photos or raw screenshots. These are handmade and live in the R2 bucket. If an image looks too good to be a direct export, it probably isn't.

---

## Contact

[kevinzhang813@gmail.com](mailto:kevinzhang813@gmail.com)  
[linkedin.com/in/cloonk](https://linkedin.com/in/cloonk/)  
[@cloonk](https://instagram.com/cloonk)
