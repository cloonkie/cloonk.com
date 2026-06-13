# Projects

Runnable browser tools, interactive experiments, and data applications hosted
under <https://cloonk.com/projects/>.

This namespace is separate from `/work/`:

- `/projects/<tool>/` is the live application.
- `/work/<project-id>/` is the portfolio case study explaining the work.

## Public projects

| Route | Purpose |
| --- | --- |
| [`/projects/`](./) | Playground and project collection landing page. |
| [`/projects/nyc-soundhood/`](nyc-soundhood/) | Spotify taste-to-neighborhood matching application. |
| [`/projects/pdf-studio/`](pdf-studio/) | Local PDF and image editing toolkit. |
| [`/projects/fashion/`](fashion/) | Browser-based fashion merchandising toolbox. |
| [`/projects/urban-retail-access/`](urban-retail-access/) | Urban destination-access mapping and analysis. |

The Fashion Toolbox contains its own documented tool inventory in
[`fashion/README.md`](fashion/README.md).

## SEO requirements

Every public project route must include:

- A unique title and concise description.
- `index, follow` robots metadata.
- A canonical URL using the folder route with a trailing slash.
- Open Graph and Twitter title, description, image, and URL metadata.
- JSON-LD appropriate to the page, usually `SoftwareApplication`,
  `WebApplication`, or `CollectionPage`.
- A matching entry in the root [`sitemap.xml`](../sitemap.xml).

Compatibility redirects, test pages, and templates must use
`noindex, follow` and must not appear in the sitemap.

## Adding a project

1. Create `projects/<project-id>/index.html`.
2. Add complete static SEO metadata to its `<head>`.
3. Add the canonical route to `sitemap.xml`.
4. Add the project to `projects/index.html`.
5. Add or update its project-specific README.
6. If it has a portfolio write-up, add its record to
   [`js/projects-data.js`](../js/projects-data.js) and run:

```powershell
node generate_work_pages.js
```

The site deploys statically through GitHub Pages. Generated files and compiled
browser assets must be committed because there is no deployment build step.
