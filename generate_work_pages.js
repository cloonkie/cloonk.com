/* Generate static /work/<project-id>/ shells from js/projects-data.js. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const dataSource = fs.readFileSync(path.join(root, 'js', 'projects-data.js'), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(dataSource, context);

const projects = context.window.PROJECTS;
if (!Array.isArray(projects)) {
  throw new Error('js/projects-data.js did not define window.PROJECTS');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function descriptionFor(project) {
  const raw = project.short || project.context?.problem || project.desc || '';
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (compact.length <= 160) return compact;
  return compact.slice(0, 157).replace(/\s+\S*$/, '') + '...';
}

function listItems(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function staticSection(label, content) {
  if (!content) return '';
  return `
        <section class="detail-section-block is-open">
          <div class="detail-section-header">
            <div class="detail-section-header__left">
              <span class="detail-section-header__label">${escapeHtml(label)}</span>
            </div>
          </div>
          <div class="detail-section-body">
            <div class="detail-section-body__inner">
              <div class="detail-section-content">${content}</div>
            </div>
          </div>
        </section>`;
}

function staticProjectSummary(project, description) {
  const problem = project.context?.problem || project.desc || description;
  const approach = project.approach?.summary || '';
  const results = project.results?.after ? listItems(project.results.after) : '';
  const takeaways = Array.isArray(project.takeaways)
    ? project.takeaways.map((item) => {
        const title = item?.title ? `<h4>${escapeHtml(item.title)}</h4>` : '';
        const body = item?.body ? `<p>${escapeHtml(item.body)}</p>` : '';
        return `<div>${title}${body}</div>`;
      }).join('')
    : '';

  return `
        <article class="detail-static-summary" aria-label="${escapeHtml(project.title)} project summary">
          <div class="detail-breadcrumb">
            <div class="detail-breadcrumb__left">
              <a href="/work.html" class="detail-back">← Work</a>
              <span class="detail-breadcrumb__sep">/</span>
              <span class="detail-breadcrumb__current">${escapeHtml(project.title)}</span>
            </div>
          </div>
          <div class="detail-hero">
            <div>
              <p class="detail-hero__num">${escapeHtml(project.num || '')}</p>
              <h1 class="detail-title">${escapeHtml(project.title)}</h1>
              <p class="detail-short">${escapeHtml(project.short || description)}</p>
            </div>
            <div class="detail-meta">
              ${project.topic ? `<div class="detail-meta__item"><span class="detail-meta__label">Topic</span><span class="detail-meta__value">${escapeHtml(project.topic)}</span></div>` : ''}
              ${project.type ? `<div class="detail-meta__item"><span class="detail-meta__label">Type</span><span class="detail-meta__value">${escapeHtml(project.type)}</span></div>` : ''}
              ${project.year ? `<div class="detail-meta__item"><span class="detail-meta__label">Year</span><span class="detail-meta__value">${escapeHtml(project.year)}</span></div>` : ''}
            </div>
          </div>
          <hr class="divider" />
          ${staticSection('Context', `<div class="detail-prose"><p>${escapeHtml(problem)}</p></div>`)}
          ${staticSection('Approach', approach ? `<div class="detail-prose"><p>${escapeHtml(approach)}</p></div>` : '')}
          ${staticSection('Results', results)}
          ${staticSection('Takeaways', takeaways)}
        </article>`;
}

function pageFor(project) {
  const title = `${project.title} | Kevin Zhang`;
  const description = descriptionFor(project);
  const canonical = `https://cloonk.com/work/${project.id}/`;
  const image = project.img || 'https://cloonk.com/images/hero.jpg';
  const keywords = [project.topic, project.type, project.affiliation, 'Kevin Zhang portfolio']
    .filter(Boolean)
    .join(', ');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        '@id': `${canonical}#project`,
        name: project.title,
        headline: project.title,
        description,
        image,
        url: canonical,
        mainEntityOfPage: canonical,
        author: {
          '@type': 'Person',
          name: 'Kevin Zhang',
          url: 'https://cloonk.com/',
        },
        datePublished: project.year ? `${project.year}-01-01` : undefined,
        keywords,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Work',
            item: 'https://cloonk.com/work.html',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: project.title,
            item: canonical,
          },
        ],
      },
    ],
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="author" content="Kevin Zhang" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#0a0c0f" />
  <link rel="canonical" href="${canonical}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="cloonk | Kevin Zhang" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:alt" content="${escapeHtml(project.title)} project preview" />
  <meta property="og:url" content="${canonical}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(project.title)} project preview" />
  <script type="application/ld+json" id="ld-project">${jsonLd}</script>

  <link rel="icon" type="image/svg+xml" href="../../favicon.svg" />
  <link rel="stylesheet" href="../../css/style.css" />
  <link rel="stylesheet" href="../../css/project-detail.css" />
  <link rel="stylesheet" href="../../css/findings.css" />
  <script>document.documentElement.setAttribute('data-theme', localStorage.getItem('cloonk-theme') === 'light' ? 'light' : 'dark');</script>
</head>
<body data-project-id="${escapeHtml(project.id)}">
  <nav>
    <a class="nav__logo" id="nav-logo" href="../../index.html">cloonk ʕ·ᴥ·ʔ</a>
    <div class="nav__links">
      <a href="../../work.html" class="active">Work</a>
      <a href="../../resume.html">Resume</a>
      <a href="../../info.html">Info</a>
      <a href="../../contact.html">Contact</a>
    </div>

    <div class="nav__right">
      <span class="nav__clock" id="nav-clock"></span>
      <button class="nav__theme-toggle" id="nav-theme-toggle" aria-label="Toggle light/dark mode">
        <svg class="icon-sun" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <svg class="icon-moon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
      <button class="nav__hamburger" id="nav-hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>

  <div class="nav__mobile-menu" id="nav-mobile-menu">
    <a href="../../work.html">Work</a>
    <a href="../../resume.html">Resume</a>
    <a href="../../info.html">Info</a>
    <a href="../../contact.html">Contact</a>
  </div>

  <main>
    <div class="page detail-page" id="detail-root">
      ${staticProjectSummary(project, description)}
      <noscript>
        <article class="detail-not-found">
          <h1 class="detail-title">${escapeHtml(project.title)}</h1>
          <p>${escapeHtml(description)}</p>
          <a href="../../work.html" class="detail-back">Back to Work</a>
        </article>
      </noscript>
    </div>
  </main>

  <footer class="index-footer">
    <div class="footer__left">
      <div class="footer__socials">
        <a href="https://instagram.com/cloonk" target="_blank" rel="noopener">Instagram</a>
        <a href="https://linkedin.com/in/cloonk/" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://open.spotify.com/user/22rxk5lrx3w4nz3y5ehvyd2ja" target="_blank" rel="noopener">Spotify</a>
      </div>
    </div>
    <div class="footer__right">
      <a href="https://cloonk.com">&copy; 2026 Kevin Zhang</a>
    </div>
  </footer>

  <script src="../../js/nav.js"></script>
  <script src="../../js/logo.js"></script>
  <script src="../../js/projects-data.js"></script>
  <script src="../../js/tool-glossary.js"></script>
  <script src="../../js/project-detail.js"></script>
  <script src="../../js/cursor.js"></script>
</body>
</html>
`.replace(/[ \t]+$/gm, '');
}

const workDir = path.join(root, 'work');
fs.mkdirSync(workDir, { recursive: true });

for (const project of projects) {
  if (!/^[a-z0-9-]+$/.test(project.id)) {
    throw new Error(`Unsafe project id: ${project.id}`);
  }
  const projectDir = path.join(workDir, project.id);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'index.html'), pageFor(project), 'utf8');
}

const sitemapPath = path.join(root, 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const lastModified = new Date().toISOString().slice(0, 10);
const startMarker = '  <!-- Generated work pages: start -->';
const endMarker = '  <!-- Generated work pages: end -->';
const workUrls = projects.map((project) => [
  '  <url>',
  `    <loc>https://cloonk.com/work/${project.id}/</loc>`,
  `    <lastmod>${lastModified}</lastmod>`,
  '    <changefreq>monthly</changefreq>',
  '    <priority>0.7</priority>',
  '  </url>',
].join('\n')).join('\n');
const generatedSection = `${startMarker}\n${workUrls}\n${endMarker}`;

let nextSitemap;
if (sitemap.includes(startMarker) && sitemap.includes(endMarker)) {
  nextSitemap = sitemap.replace(
    new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`),
    generatedSection
  );
} else {
  nextSitemap = sitemap.replace('</urlset>', `${generatedSection}\n\n</urlset>`);
}
fs.writeFileSync(sitemapPath, nextSitemap, 'utf8');

console.log(`Generated ${projects.length} work pages and updated sitemap.xml.`);
