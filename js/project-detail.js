/* project-detail.js */
(function () {
  const WIX_CDN = 'https://static.wixstatic.com/media/';
  const root    = document.getElementById('detail-root');
  if (!root || !window.PROJECTS) return;

  const params = new URLSearchParams(window.location.search);
  const id     = document.body.dataset.projectId || params.get('id');
  const p      = window.PROJECTS.find(x => x.id === id);

  if (!p) {
    root.innerHTML = `
      <div class="detail-not-found">
        <h1 class="detail-title">Project not found</h1>
        <a href="/work.html" class="detail-back">← Back to Work</a>
      </div>`;
    // Prevent indexing of empty/invalid project URLs
    var robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex, follow');
    return;
  }

  document.title = p.title + ' — Kevin Zhang';

  /* ── SEO metadata: keep title, description, canonical, and OG/Twitter
        tags in sync with the active project so crawlers and link
        unfurlers see per-project content. ── */
  (function applySEO() {
    var canonical = 'https://cloonk.com/work/' + encodeURIComponent(p.id) + '/';
    var rawDesc   = p.short || ((p.context && p.context.problem) ? p.context.problem : (p.desc || ''));
    var desc      = rawDesc.replace(/\s+/g, ' ').trim();
    if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, '') + '…';
    var image     = p.img || 'https://cloonk.com/images/hero.jpg';
    var title     = p.title + ' — Kevin Zhang';
    var keywords  = [p.topic, p.type, p.affiliation, 'Kevin Zhang portfolio'].filter(Boolean).join(', ');

    function setMeta(selector, attr, key, value) {
      var el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    }

    setMeta('meta[name="description"]',      'name',     'description',      desc);
    setMeta('meta[name="keywords"]',         'name',     'keywords',         keywords);
    setMeta('meta[property="og:title"]',     'property', 'og:title',         title);
    setMeta('meta[property="og:description"]','property','og:description',   desc);
    setMeta('meta[property="og:image"]',     'property', 'og:image',         image);
    setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt',     p.title + ' project preview');
    setMeta('meta[property="og:url"]',       'property', 'og:url',           canonical);
    setMeta('meta[property="og:type"]',      'property', 'og:type',          'article');
    setMeta('meta[name="twitter:title"]',    'name',     'twitter:title',    title);
    setMeta('meta[name="twitter:description"]','name',   'twitter:description', desc);
    setMeta('meta[name="twitter:image"]',    'name',     'twitter:image',    image);
    setMeta('meta[name="twitter:image:alt"]','name',     'twitter:image:alt',p.title + ' project preview');

    var link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);

    // JSON-LD CreativeWork for the project
    var existing = document.getElementById('ld-project');
    if (existing) existing.remove();
    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id   = 'ld-project';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CreativeWork',
          '@id': canonical + '#project',
          'name': p.title,
          'headline': p.title,
          'description': desc,
          'image': image,
          'url': canonical,
          'mainEntityOfPage': canonical,
          'author': {
            '@type': 'Person',
            'name': 'Kevin Zhang',
            'url': 'https://cloonk.com/'
          },
          'datePublished': p.year ? p.year + '-01-01' : undefined,
          'keywords': keywords
        },
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'Work',
              'item': 'https://cloonk.com/work.html'
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': p.title,
              'item': canonical
            }
          ]
        }
      ]
    });
    document.head.appendChild(ld);
  })();

  // Storyline (stat moments + statement breaks) initial state.
  // Order of precedence: reader's localStorage choice → author's hide flags → default on.
  (function applyStorylineState() {
    var lsVal = localStorage.getItem('cloonk-storyline');
    var authorHides = !!(p.hideStatMoments || p.hideStatements);
    var off = lsVal ? (lsVal === 'off') : authorHides;
    document.body.classList.toggle('storyline-off', off);
  })();

  const idx  = window.PROJECTS.indexOf(p);
  const next = window.PROJECTS[idx + 1] || null;

  function imgSrc(raw) {
    return (raw && raw.startsWith('http')) ? raw : WIX_CDN + raw;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  function section(sid, num, label, content, open) {
    return '<div class="detail-section-block' + (open ? ' is-open' : '') + '" id="' + sid + '">'
      + '<div class="detail-section-header" role="button" tabindex="0" aria-expanded="' + (open ? 'true' : 'false') + '">'
      + '<div class="detail-section-header__left">'
      + '<span class="detail-section-header__num">' + num + '</span>'
      + '<span class="detail-section-header__label">' + label + '</span>'
      + '</div>'
      + '<div class="detail-section-toggle"><div class="toggle-bar toggle-bar--h"></div><div class="toggle-bar toggle-bar--v"></div></div>'
      + '</div>'
      + '<div class="detail-section-body"><div class="detail-section-body__inner"><div class="detail-section-content">' + content + '</div></div></div>'
      + '</div>';
  }

  /* ── Context ── */
  var contextHTML = '<span class="detail-label-tag">Overview</span>'
    + '<div class="detail-prose"><p>' + ((p.context && p.context.problem) ? p.context.problem : p.desc) + '</p></div>'
    + ((p.context && (p.context.why || p.context.constraints)) ?
        '<div class="detail-two-col">'
        + (p.context.why ? '<div><h4>Why it mattered</h4><ul>' + p.context.why.map(function(x){return '<li>'+x+'</li>';}).join('') + '</ul></div>' : '')
        + (p.context.constraints ? '<div><h4>Constraints</h4><ul>' + p.context.constraints.map(function(x){return '<li>'+x+'</li>';}).join('') + '</ul></div>' : '')
        + '</div>' : '')
    + ((p.context && p.context.collaboration) ? '<div class="detail-collab"><p>' + p.context.collaboration + '</p></div>' : '');

  /* ── Approach ── */
  function renderApproachMoves(moves) {
    return '<div class="approach-moves">'
      + moves.map(function(m, i) {
          var n = ('0' + (i + 1)).slice(-2);
          return '<div class="approach-move">'
            + '<div class="approach-move__num">' + n + '</div>'
            + '<h4 class="approach-move__title">' + m.title + '</h4>'
            + '<p class="approach-move__body">' + m.body + '</p>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  var approachBodyHTML;
  if (p.approach && p.approach.moves && p.approach.moves.length) {
    approachBodyHTML = renderApproachMoves(p.approach.moves);
  } else if (p.approach && p.approach.summary) {
    approachBodyHTML = '<div class="detail-prose"><p>' + p.approach.summary + '</p></div>';
  } else if (typeof p.approach === 'string') {
    approachBodyHTML = '<div class="detail-prose"><p>' + p.approach + '</p></div>';
  } else {
    approachBodyHTML = '<div class="detail-prose"><p>Detailed approach coming soon.</p></div>';
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function lookupTool(name) {
    if (!window.TOOL_GLOSSARY) return null;
    var key = String(name).toLowerCase().trim().replace(/\s+/g, ' ');
    return window.TOOL_GLOSSARY[key] || null;
  }
  function toolChipHTML(name) {
    var def = lookupTool(name);
    var tipAttr = def ? ' data-tooltip="' + escapeAttr(def) + '"' : '';
    var defClass = def ? '' : ' tool-chip--no-def';
    return '<button type="button" class="tool-chip' + defClass + '"' + tipAttr + '>' + name + '</button>';
  }

  var toolsBlockHTML = (p.approach && p.approach.data && p.approach.data.length)
    ? '<div class="tool-chips-wrap">'
        + '<h4>Data &amp; tools</h4>'
        + '<div class="tool-chips">' + p.approach.data.map(toolChipHTML).join('') + '</div>'
      + '</div>'
    : '';

  var stepsBlockHTML = (p.approach && p.approach.steps && p.approach.steps.length)
    ? '<div class="approach-steps"><h4>Steps</h4><ul>'
        + p.approach.steps.map(function(x){return '<li>'+x+'</li>';}).join('')
      + '</ul></div>'
    : '';

  var approachHTML = '<span class="detail-label-tag">Methodology</span>'
    + approachBodyHTML
    + toolsBlockHTML
    + stepsBlockHTML;

  /* ── Results ── */
  var resultsHTML = '<span class="detail-label-tag">Quantified impact</span>'
    + ((p.results && p.results.metrics) ?
        '<div class="detail-result-grid">'
        + p.results.metrics.map(function(m){return '<div class="detail-result-card"><div class="detail-result-card__num">'+m.num+'</div><div class="detail-result-card__label">'+m.label+'</div></div>';}).join('')
        + '</div>' : '')
    + ((p.results && p.results.before && p.results.after) ?
        '<div class="detail-before-after">'
        + '<div class="detail-ba-col detail-ba-col--before"><div class="detail-ba-col__head">Before</div><ul>' + p.results.before.map(function(x){return '<li>'+x+'</li>';}).join('') + '</ul></div>'
        + '<div class="detail-ba-col detail-ba-col--after"><div class="detail-ba-col__head">After</div><ul>' + p.results.after.map(function(x){return '<li>'+x+'</li>';}).join('') + '</ul></div>'
        + '</div>' : '')
    + ((!p.results || (!p.results.metrics && !p.results.before)) ?
        '<p class="detail-prose" style="color:var(--muted)">Results coming soon.</p>' : '');

  /* ── Artifact: priority → github → figma → sheets → canva → pdf ── */
  var ARTIFACT_PRIORITY = ['live','github', 'figma', 'sheets', 'canva', 'pdf', 'pdfAppendix'];

  var ARTIFACT_LABELS = {
    live: 'Live Site',
    github: 'GitHub',
    figma:  'Figma',
    sheets: 'Google Slides',
    canva:  'Canva',
    pdf:    'PDF',
    pdfAppendix: 'Appendix PDF'
  };

  var ARTIFACT_OPEN_LABELS = {
    live: 'Open Live ↗',
    github: 'View on GitHub ↗',
    figma:  'Open in Figma ↗',
    sheets: 'Open in Slides ↗',
    canva:  'Open in Canva ↗',
    pdf:    'Download PDF ↗',
    pdfAppendix: 'Download Appendix ↗'
  };

  /* ── GitHub icon SVG ── */
  var GITHUB_ICON = '<svg class="detail-github-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>'
    + '</svg>';

  /* Collect available sources */
  var pdfRaw = p.pdf || null;
  if (!pdfRaw && p.media) {
    var pdfMedia = p.media.find(function(m){ return m.type === 'pdf'; });
    if (pdfMedia) pdfRaw = pdfMedia.src.startsWith('http') ? pdfMedia.src : WIX_CDN + pdfMedia.src;
  }

  var artifactSources = {
    live:   p.live   || null,
    github: p.github || null,
    figma:  p.figma  || null,
    sheets: p.sheets || null,
    canva:  p.canva  || null,
    pdf:    pdfRaw   || null,
    pdfAppendix: p.pdf_appendix || null
  };

  if (p.pdf_appendix_label) ARTIFACT_LABELS.pdfAppendix = p.pdf_appendix_label;

  var availableTypes = ARTIFACT_PRIORITY.filter(function(t){ return artifactSources[t]; });

  /* Per-project default artifact override — bubble the preferred type to the
     front of availableTypes so it becomes the initial dropdown + panel. */
  if (p.defaultArtifact && availableTypes.indexOf(p.defaultArtifact) > 0) {
    availableTypes = [p.defaultArtifact].concat(
      availableTypes.filter(function(t) { return t !== p.defaultArtifact; })
    );
  }

  /* ── Build GitHub card HTML ── */
  function buildGitHubCard(url) {
    /* Parse repo name from URL */
    var parts    = url.replace(/\/$/, '').split('/');
    var repoName = parts[parts.length - 1] || 'Repository';
    var owner    = parts[parts.length - 2] || '';

    /* Extract languages/tools from approach.data if available */
    var langs = (p.approach && p.approach.data) ? p.approach.data : [];
    var langBadges = langs.map(function(lang) {
      return '<span class="detail-github-badge">' + lang + '</span>';
    }).join('');

    /* Use project short desc or desc */
    var desc = p.short || p.desc || '';
    if (desc.length > 200) desc = desc.substring(0, 200) + '…';

    return '<div class="detail-github-card">'
      + '<div class="detail-github-card__header">'
        + GITHUB_ICON
        + '<div class="detail-github-card__repo">'
          + '<span class="detail-github-card__owner">' + owner + ' /</span>'
          + '<span class="detail-github-card__name">' + repoName + '</span>'
        + '</div>'
      + '</div>'
      + '<p class="detail-github-card__desc">' + desc + '</p>'
      + (langBadges ? '<div class="detail-github-card__langs">' + langBadges + '</div>' : '')
      + '<a href="' + url + '" target="_blank" rel="noopener" class="detail-github-card__btn">'
        + GITHUB_ICON
        + '<span>View Repository on GitHub</span>'
        + '<span class="detail-github-card__arrow">↗</span>'
      + '</a>'
    + '</div>';
  }

  var artifactHTML;

  if (!availableTypes.length) {
    artifactHTML = '<span class="detail-label-tag">Full deck</span>'
      + '<div class="detail-pdf-fallback" style="height:200px;border:1px solid var(--border)">'
      + '<p style="color:var(--muted);font-size:13px">No document attached.</p></div>';

  } else {
    var firstType = availableTypes[0];

    /* Separate iframe-able types from non-iframe types (github) */
    var iframeTypes = availableTypes.filter(function(t) { return t !== 'github'; });
    var hasGithub   = artifactSources.github ? true : false;

    /* Dropdown — only rendered when 2+ iframe-able sources exist */
    var dropdownHTML = '';
    if (iframeTypes.length > 1) {
      dropdownHTML = '<select class="detail-artifact-select" aria-label="Select format">'
        + iframeTypes.map(function(t){
            return '<option value="' + t + '">' + ARTIFACT_LABELS[t] + '</option>';
          }).join('')
        + '</select>';
    }

    /* External open link — point to first available source */
    var linkType = iframeTypes.length > 0 ? iframeTypes[0] : firstType;
    var extLinkHTML = '<a href="' + artifactSources[linkType] + '" '
      + 'target="_blank" rel="noopener" '
      + 'class="detail-pdf-download detail-artifact-extlink" '
      + 'data-src-github="' + (artifactSources.github || '') + '" '
      + 'data-src-figma="'  + (artifactSources.figma  || '') + '" '
      + 'data-src-sheets="' + (artifactSources.sheets || '') + '" '
      + 'data-src-canva="'  + (artifactSources.canva  || '') + '" '
      + 'data-src-pdf="'    + (artifactSources.pdf    || '') + '" '
      + 'data-src-pdf-appendix="' + (artifactSources.pdfAppendix || '') + '">'
      + ARTIFACT_OPEN_LABELS[linkType]
      + '</a>';

    /* GitHub card (rendered above the iframe panels if present) */
    var githubCardHTML = hasGithub ? buildGitHubCard(artifactSources.github) : '';

    /* One iframe panel per available iframe-able source */
    var panelsHTML = iframeTypes.map(function(t){
      var src    = artifactSources[t];
      var extras = (t === 'figma' || t === 'canva') ? ' allowfullscreen' : '';
      return '<div class="detail-artifact-panel" data-type="' + t + '" style="display:none">'
        + '<div class="detail-pdf-wrap">'
        + '<iframe src="' + src + '" class="detail-pdf-frame" '
        + 'title="' + p.title + ' — ' + ARTIFACT_LABELS[t] + '" '
        + 'loading="lazy"' + extras + '></iframe>'
        + '</div>'
        + '</div>';
    }).join('');

    /* Header with dropdown + external link (only if iframe sources exist) */
    var headerHTML = '';
    if (iframeTypes.length > 0) {
      headerHTML = '<div class="detail-artifact-header">'
        + '<span class="detail-label-tag" style="margin-bottom:0">Full deck</span>'
        + '<div class="detail-artifact-header__right">'
        + dropdownHTML
        + extLinkHTML
        + '</div>'
        + '</div>';
    }

    /* If ONLY github (no iframes), show just the card */
    if (iframeTypes.length === 0 && hasGithub) {
      artifactHTML = '<span class="detail-label-tag">Source code</span>'
        + githubCardHTML;
    } else {
      /* Mixed: github card on top, then iframe header + panels below */
      artifactHTML = githubCardHTML
        + headerHTML
        + panelsHTML;
    }
  }

  /* ── Quote (pull or inline) ── */
  function renderQuote(quote, inline) {
    var cls = 'quote' + (inline ? ' quote--inline' : '');
    return '<figure class="' + cls + '">'
      + '<blockquote class="quote__text">' + quote.text + '</blockquote>'
      + '<figcaption class="quote__attribution">' + quote.attribution + '</figcaption>'
      + '</figure>';
  }

  /* ── Findings (with inline paired quotes) ── */
  function renderFindings(project) {
    if (!project.findings || project.findings.length === 0) return '';

    var quotesByFinding = {};
    if (project.quotes && project.quotes.length) {
      project.quotes.forEach(function(q) {
        if (q.pairsWithFinding !== null && q.pairsWithFinding !== undefined) {
          quotesByFinding[q.pairsWithFinding] = q;
        }
      });
    }

    var findingItems = project.findings.map(function(f, i) {
      var num = ('0' + (i + 1)).slice(-2);
      var imageHtml = f.image
        ? '<div class="finding__media"><img src="' + f.image + '" alt="' + f.title + '" loading="lazy"/></div>'
        : '<div class="finding__media finding__media--empty"></div>';

      var pairedQuoteHtml = quotesByFinding[i] ? renderQuote(quotesByFinding[i], true) : '';

      // Render a labeled block only if its field is populated. Condensed findings
      // (typically those without images) use a single `body` field instead of the
      // observation/evidence/impact split.
      function block(label, value) {
        if (!value) return '';
        return '<div class="finding__block"><span class="finding__label">' + label + '</span><p>' + value + '</p></div>';
      }
      function bodyBlock(value) {
        if (!value) return '';
        return '<div class="finding__block finding__block--body"><p>' + value + '</p></div>';
      }

      return '<article class="finding" data-finding-index="' + i + '">'
        + '<div class="finding__content">'
          + '<div class="finding__number">' + num + '</div>'
          + '<h3 class="finding__title">' + f.title + '</h3>'
          + bodyBlock(f.body)
          + block('Observation', f.observation)
          + block('Evidence', f.evidence)
          + pairedQuoteHtml
          + block('Impact', f.impact)
          + block('Recommendation', f.recommendation)
        + '</div>'
        + imageHtml
        + '</article>';
    }).join('');

    return '<div class="findings">' + findingItems + '</div>';
  }

  /* ── Stat moment (full-bleed editorial break) ── */
  function renderStatMoment(m, i) {
    var headline = m.svg
      ? '<div class="stat-moment__chart">' + m.svg + '</div>'
      : '<div class="stat-moment__value">' + m.value + '</div>';
    return '<section class="stat-moment" data-moment-index="' + i + '">'
      + headline
      + '<p class="stat-moment__label">' + m.label + '</p>'
      + '</section>';
  }

  /* ── Statement break (single-line editorial break) ── */
  function renderStatement(text, i) {
    return '<section class="statement-break" data-statement-index="' + i + '">'
      + '<p class="statement-break__text">' + text + '</p>'
      + '</section>';
  }

  /* ── Impact block ── */
  function renderImpact(impactObj) {
    if (!impactObj) return '';
    var rows = Object.keys(impactObj).map(function(key) {
      return '<div class="impact__row">'
        + '<div class="impact__label">' + key + '</div>'
        + '<p class="impact__text">' + impactObj[key] + '</p>'
        + '</div>';
    }).join('');
    return '<div class="impact"><div class="impact__grid">' + rows + '</div></div>';
  }

  /* ── Further reading (external references / further reading list) ── */
  function renderFurtherReading(project) {
    if (!project.furtherReading || !project.furtherReading.length) return '';
    var items = project.furtherReading.map(function(r) {
      var meta = r.meta ? '<span class="further-reading__meta">' + r.meta + '</span>' : '';
      var note = r.note ? '<p class="further-reading__note">' + r.note + '</p>' : '';
      return '<a class="further-reading__item" href="' + r.url + '" target="_blank" rel="noopener">'
        + '<div class="further-reading__row">'
          + '<span class="further-reading__label">' + r.label + '</span>'
          + meta
          + '<span class="further-reading__arrow">↗</span>'
        + '</div>'
        + note
        + '</a>';
    }).join('');
    return '<div class="further-reading">' + items + '</div>';
  }

  /* ── Closing quote (unpaired) ── */
  function renderClosingQuote(project) {
    if (!project.quotes || !project.quotes.length) return '';
    var closing = project.quotes.filter(function(q) {
      return q.pairsWithFinding === null || q.pairsWithFinding === undefined;
    });
    if (!closing.length) return '';
    return closing.map(function(q) { return renderQuote(q, false); }).join('');
  }

  var findingsHTML = renderFindings(p);
  var hasFindings  = !!findingsHTML;
  var impactHTML   = renderImpact(p.impact);
  var hasImpact    = !!impactHTML;

  var statMoments  = (p.statMoments && p.statMoments.length) ? p.statMoments : [];
  var statements   = (p.statements  && p.statements.length)  ? p.statements  : [];
  var closingQuote = renderClosingQuote(p);

  /* ── Gallery: images only, resolve URLs ── */
  var hasGallery   = p.gallery && p.gallery.length > 0;
  var hasMedia     = p.media   && p.media.length   > 0;
  var galleryItems = hasGallery
    ? p.gallery.map(function(img, i){ return { src: imgSrc(img), i: i }; })
    : hasMedia
      ? p.media.filter(function(m){ return m.type === 'image'; }).map(function(m, i){ return { src: imgSrc(m.src), i: i }; })
      : [];

  var galleryHTML = galleryItems.length
    ? '<span class="detail-label-tag">Images</span>'
      + '<div class="detail-gallery' + (galleryItems.length === 1 ? ' detail-gallery--single' : '') + '">'
      + galleryItems.map(function(g){
          return '<div class="detail-gallery__item" data-index="' + g.i + '">'
            + '<img src="' + g.src + '" alt="' + p.title + ' image ' + g.i + '" loading="lazy" '
            + 'onerror="this.closest(\'.detail-gallery__item\').style.display=\'none\'"/>'
            + '<div class="detail-gallery__overlay"><span class="detail-gallery__zoom">↗ View</span></div>'
            + '</div>';
        }).join('')
      + '</div>'
    : '';

  /* ── Takeaways ── */
  var takeawaysHTML = (p.takeaways && p.takeaways.length)
    ? '<span class="detail-label-tag">Key insights</span>'
      + '<div class="detail-takeaway-list">'
      + p.takeaways.map(function(t, i){
          var title = (typeof t === 'object') ? t.title : ('0' + (i + 1));
          var body  = (typeof t === 'object') ? t.body  : t;
          return '<div class="detail-takeaway-item">'
            + '<div class="detail-takeaway-item__num">0' + (i + 1) + '</div>'
            + '<div class="detail-takeaway-item__text"><h4>' + title + '</h4><p>' + body + '</p></div>'
            + '</div>';
        }).join('')
      + '</div>'
    : '<span class="detail-label-tag">Key insights</span>'
      + '<p class="detail-prose" style="color:var(--muted)">Takeaways coming soon.</p>';

  /* ── Next / breadcrumb link ── */
  var nextLink = next
    ? '<a href="/work/' + next.id + '/" class="detail-breadcrumb__next">'
        + '<span>Next</span>'
        + '<span class="detail-breadcrumb__sep">/</span>'
        + '<span class="detail-breadcrumb__next-title">' + next.title + '</span>'
        + '<span> →</span>'
        + '</a>'
    : '<a href="/work.html" class="detail-breadcrumb__next"><span>All Work →</span></a>';

  var furtherReadingHTML = renderFurtherReading(p);
  var hasFurtherReading  = !!furtherReadingHTML;

  var findingsNum    = '05';
  var impactNum      = String(5 + (hasFindings ? 1 : 0)).padStart(2, '0');
  var galleryNum     = String(5 + (hasFindings ? 1 : 0) + (hasImpact ? 1 : 0)).padStart(2, '0');
  var tkNum          = String(5 + (hasFindings ? 1 : 0) + (hasImpact ? 1 : 0) + (galleryItems.length ? 1 : 0)).padStart(2, '0');
  var frNum          = String(5 + (hasFindings ? 1 : 0) + (hasImpact ? 1 : 0) + (galleryItems.length ? 1 : 0) + 1).padStart(2, '0');

  var findingsSection       = hasFindings ? section('s-findings', findingsNum, 'Findings', findingsHTML, true)  : '';
  var impactSection         = hasImpact   ? section('s-impact',   impactNum,   'Impact',   impactHTML,   true)  : '';
  var gallerySection        = galleryItems.length ? section('s-gallery', galleryNum, 'Gallery', galleryHTML, false) : '';
  var furtherReadingSection = hasFurtherReading ? section('s-further-reading', frNum, 'Further reading', furtherReadingHTML, true) : '';

  /* ── Render ── */
  root.innerHTML =
    '<div class="detail-breadcrumb fade-in">'
      + '<div class="detail-breadcrumb__left">'
        + '<a href="/work.html" class="detail-back">← Work</a>'
        + '<span class="detail-breadcrumb__sep">/</span>'
        + '<span class="detail-breadcrumb__current">' + p.title + '</span>'
      + '</div>'
      + nextLink
    + '</div>'

    + '<div class="detail-hero fade-in">'
      + '<div>'
        + '<p class="detail-hero__num">' + p.num + '</p>'
        + '<h1 class="detail-title">' + p.title + '</h1>'
        + '<p class="detail-short">' + p.short + '</p>'
      + '</div>'
      + '<div class="detail-meta">'
        + '<div class="detail-meta__item"><span class="detail-meta__label">Topic</span><span class="detail-meta__value">' + cap(p.topic) + '</span></div>'
        + '<div class="detail-meta__item"><span class="detail-meta__label">Type</span><span class="detail-meta__value">' + p.type + '</span></div>'
        + '<div class="detail-meta__item"><span class="detail-meta__label">Year</span><span class="detail-meta__value">' + p.year + '</span></div>'
        + (p.role        ? '<div class="detail-meta__item"><span class="detail-meta__label">Role</span><span class="detail-meta__value">' + p.role + '</span></div>' : '')
        + (p.affiliation ? '<div class="detail-meta__item"><span class="detail-meta__label">School</span><span class="detail-meta__value">' + cap(p.affiliation) + '</span></div>' : '')
      + '</div>'
    + '</div>'

    + '<hr class="divider fade-in" />'

    + '<div class="detail-section-nav-wrap fade-in">'
      + '<nav class="detail-section-nav" id="detail-section-nav">'
        + '<button class="detail-section-nav__item is-active" data-target="s-artifact"><span class="detail-section-nav__dot"></span>Artifact</button>'
        + '<button class="detail-section-nav__item" data-target="s-context"><span class="detail-section-nav__dot"></span>Context</button>'
        + '<button class="detail-section-nav__item" data-target="s-approach"><span class="detail-section-nav__dot"></span>Approach</button>'
        + '<button class="detail-section-nav__item" data-target="s-results"><span class="detail-section-nav__dot"></span>Results</button>'
        + (hasFindings ? '<button class="detail-section-nav__item" data-target="s-findings"><span class="detail-section-nav__dot"></span>Findings</button>' : '')
        + (hasImpact ? '<button class="detail-section-nav__item" data-target="s-impact"><span class="detail-section-nav__dot"></span>Impact</button>' : '')
        + (galleryItems.length ? '<button class="detail-section-nav__item" data-target="s-gallery"><span class="detail-section-nav__dot"></span>Gallery</button>' : '')
        + '<button class="detail-section-nav__item" data-target="s-takeaways"><span class="detail-section-nav__dot"></span>Takeaways</button>'
        + (hasFurtherReading ? '<button class="detail-section-nav__item" data-target="s-further-reading"><span class="detail-section-nav__dot"></span>Further reading</button>' : '')
      + '</nav>'
    + '</div>'

    + '<div class="detail-sections">'
      + section('s-artifact',  '01', 'Artifact',  artifactHTML,  true)
      + section('s-context',   '02', 'Context',   contextHTML,   true)
      + (statMoments[0] ? renderStatMoment(statMoments[0], 0) : '')
      + section('s-approach',  '03', 'Approach',  approachHTML,  true)
      + (statements[0]  ? renderStatement(statements[0], 0)   : '')
      + section('s-results',   '04', 'Results',   resultsHTML,   true)
      + findingsSection
      + (statMoments[1] ? renderStatMoment(statMoments[1], 1) : '')
      + impactSection
      + (statMoments[2] ? renderStatMoment(statMoments[2], 2) : '')
      + (statements[1]  ? renderStatement(statements[1], 1)   : '')
      + gallerySection
      + section('s-takeaways', tkNum, 'Takeaways', takeawaysHTML, true)
      + furtherReadingSection
      + (statements[2]  ? renderStatement(statements[2], 2)   : '')
      + closingQuote
    + '</div>'

    + '<div class="lightbox" id="lightbox" role="dialog" aria-modal="true">'
      + '<button class="lightbox__close" id="lightbox-close">✕</button>'
      + '<button class="lightbox__prev"  id="lightbox-prev">←</button>'
      + '<button class="lightbox__next"  id="lightbox-next">→</button>'
      + '<div class="lightbox__img-wrap"><img class="lightbox__img" id="lightbox-img" src="" alt=""/></div>'
      + '<p class="lightbox__counter" id="lightbox-counter"></p>'
    + '</div>'

    + ((statMoments.length || statements.length)
        ? '<button class="storyline-toggle" id="storyline-toggle" type="button" aria-pressed="'
          + (document.body.classList.contains('storyline-off') ? 'true' : 'false')
          + '" aria-label="Toggle storyline elements (stat moments and statement breaks)">'
          + '<span class="storyline-toggle__dot" aria-hidden="true"></span>'
          + '<span class="storyline-toggle__label">Storyline</span>'
          + '</button>'
        : '');

  /* ── Collapsible sections ── */
  function setInnerOverflow(block, open) {
    var inner = block.querySelector('.detail-section-body__inner');
    if (!inner) return;
    if (open) {
      setTimeout(function() {
        if (block.classList.contains('is-open')) inner.style.overflow = 'visible';
      }, 400);
    } else {
      inner.style.overflow = '';
    }
  }

  root.querySelectorAll('.detail-section-block').forEach(function(block) {
    var hdr = block.querySelector('.detail-section-header');
    hdr.addEventListener('click', function() {
      var open = block.classList.toggle('is-open');
      hdr.setAttribute('aria-expanded', open);
      setInnerOverflow(block, open);
    });
    hdr.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hdr.click(); }
    });
    if (block.classList.contains('is-open')) setInnerOverflow(block, true);
  });

  /* ── Artifact select switcher ── */
  (function() {
    var select  = root.querySelector('.detail-artifact-select');
    var panels  = root.querySelectorAll('.detail-artifact-panel');
    var extLink = root.querySelector('.detail-artifact-extlink');

    /* Always show the first iframe panel on load */
    var firstPanel = root.querySelector('.detail-artifact-panel');
    if (firstPanel) firstPanel.style.display = '';

    if (!select) return;

    function activate(type) {
      panels.forEach(function(panel) {
        panel.style.display = panel.dataset.type === type ? '' : 'none';
      });
      if (extLink) {
        var key = type === 'pdfAppendix' ? 'srcPdfAppendix' : 'src' + type.charAt(0).toUpperCase() + type.slice(1);
        extLink.href        = extLink.dataset[key] || '#';
        extLink.textContent = ARTIFACT_OPEN_LABELS[type] || 'Open ↗';
      }
    }

    select.addEventListener('change', function() { activate(select.value); });
  })();

  /* ── Section nav click ── */
  root.querySelectorAll('.detail-section-nav__item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = document.getElementById(btn.dataset.target);
      if (!target) return;
      if (target.classList.contains('detail-section-block') && !target.classList.contains('is-open')) {
        target.classList.add('is-open');
        var hdr = target.querySelector('.detail-section-header');
        if (hdr) hdr.setAttribute('aria-expanded', 'true');
        setInnerOverflow(target, true);
      }
      var navWrap = document.querySelector('.detail-section-nav-wrap');
      var offset  = navWrap ? navWrap.offsetHeight + 64 : 120;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 160, behavior: 'smooth' });
    });
  });

  /* ── Scroll spy ── */
  var navBtns = {};
  root.querySelectorAll('.detail-section-nav__item').forEach(function(b) {
    navBtns[b.dataset.target] = b;
  });
  var spy = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        root.querySelectorAll('.detail-section-nav__item').forEach(function(b) { b.classList.remove('is-active'); });
        if (navBtns[e.target.id]) navBtns[e.target.id].classList.add('is-active');
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

  ['s-artifact','s-context','s-approach','s-results','s-findings','s-impact','s-gallery','s-takeaways'].forEach(function(sid) {
    var el = document.getElementById(sid);
    if (el) spy.observe(el);
  });

  /* ── Editorial break: scroll-triggered accent ── */
  (function() {
    var targets = root.querySelectorAll('.finding, .stat-moment, .statement-break');
    if (!targets.length) return;
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var inViewClass = entry.target.classList.contains('finding') ? 'finding--in-view'
                        : entry.target.classList.contains('stat-moment') ? 'stat-moment--in-view'
                        : 'statement-break--in-view';
        if (entry.isIntersecting) entry.target.classList.add(inViewClass);
        else                      entry.target.classList.remove(inViewClass);
      });
    }, { rootMargin: '-30% 0px -30% 0px', threshold: 0 });
    targets.forEach(function(t) { obs.observe(t); });
  })();

  /* ── Storyline toggle (stat moments + statement breaks) ── */
  var storylineBtn = document.getElementById('storyline-toggle');
  if (storylineBtn) {
    storylineBtn.addEventListener('click', function() {
      var off = document.body.classList.toggle('storyline-off');
      storylineBtn.setAttribute('aria-pressed', off ? 'true' : 'false');
      localStorage.setItem('cloonk-storyline', off ? 'off' : 'on');
    });
  }

  /* ── Lightbox ── */
  if (!galleryItems.length) return;
  var imgs     = galleryItems.map(function(g) { return g.src; });
  var lightbox = document.getElementById('lightbox');
  var lbImg    = document.getElementById('lightbox-img');
  var lbCtr    = document.getElementById('lightbox-counter');
  var cur      = 0;

  function openLB(i)  { cur = i; lbImg.src = imgs[i]; lbCtr.textContent = (i + 1) + ' / ' + imgs.length; lightbox.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeLB()  { lightbox.classList.remove('open'); document.body.style.overflow = ''; }
  function showPrev() { cur = (cur - 1 + imgs.length) % imgs.length; lbImg.src = imgs[cur]; lbCtr.textContent = (cur + 1) + ' / ' + imgs.length; }
  function showNext() { cur = (cur + 1) % imgs.length;               lbImg.src = imgs[cur]; lbCtr.textContent = (cur + 1) + ' / ' + imgs.length; }

  root.querySelectorAll('.detail-gallery__item').forEach(function(item, i) {
    item.addEventListener('click', function() { openLB(i); });
  });
  document.getElementById('lightbox-close').addEventListener('click', closeLB);
  document.getElementById('lightbox-prev').addEventListener('click',  function(e) { e.stopPropagation(); showPrev(); });
  document.getElementById('lightbox-next').addEventListener('click',  function(e) { e.stopPropagation(); showNext(); });
  lightbox.addEventListener('click', function(e) { if (e.target === lightbox) closeLB(); });
  document.addEventListener('keydown', function(e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLB();
    if (e.key === 'ArrowLeft')  showPrev();
    if (e.key === 'ArrowRight') showNext();
  });
  var tx = 0;
  lightbox.addEventListener('touchstart', function(e) { tx = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend',   function(e) { var dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) dx < 0 ? showNext() : showPrev(); });
})();
