/* project-detail.js */
(function () {
  const WIX_CDN = 'https://static.wixstatic.com/media/';
  const root    = document.getElementById('detail-root');
  if (!root || !window.PROJECTS) return;

  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  const p      = window.PROJECTS.find(x => x.id === id);

  if (!p) {
    root.innerHTML = `
      <div class="detail-not-found">
        <h1 class="detail-title">Project not found</h1>
        <a href="projects.html" class="detail-back">← Back to Work</a>
      </div>`;
    return;
  }

  document.title = p.title + ' — Kevin Zhang';

  const idx  = window.PROJECTS.indexOf(p);
  const next = window.PROJECTS[idx + 1] || null;

  /* Resolve image src: full URLs pass through; slugs get Wix CDN prefix */
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
        + '</div>' : '');

  /* ── Approach ── */
  var approachHTML = '<span class="detail-label-tag">Methodology</span>'
    + '<div class="detail-prose"><p>' + ((p.approach && p.approach.summary) ? p.approach.summary : (typeof p.approach === 'string' ? p.approach : 'Detailed approach coming soon.')) + '</p></div>'
    + ((p.approach && (p.approach.data || p.approach.steps)) ?
        '<div class="detail-two-col">'
        + (p.approach.data ? '<div><h4>Data &amp; tools</h4><ul>' + p.approach.data.map(function(x){return '<li>'+x+'</li>';}).join('') + '</ul></div>' : '')
        + (p.approach.steps ? '<div><h4>Steps</h4><ul>' + p.approach.steps.map(function(x){return '<li>'+x+'</li>';}).join('') + '</ul></div>' : '')
        + '</div>' : '');

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

  /* ── Artifact: priority → figma → sheets → canva → pdf ── */
  var ARTIFACT_PRIORITY = ['figma', 'sheets', 'canva', 'pdf'];

  var ARTIFACT_LABELS = {
    figma:  'Figma',
    sheets: 'Google Sheets',
    canva:  'Canva',
    pdf:    'PDF'
  };

  var ARTIFACT_OPEN_LABELS = {
    figma:  'Open in Figma ↗',
    sheets: 'Open in Sheets ↗',
    canva:  'Open in Canva ↗',
    pdf:    'Download PDF ↗'
  };

  var ARTIFACT_ICONS = {
    figma:  '<svg width="13" height="13" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 28.5A9.5 9.5 0 1 1 28.5 19 9.5 9.5 0 0 1 19 28.5Z" fill="currentColor"/><path d="M9.5 57A9.5 9.5 0 0 0 19 47.5V38H9.5A9.5 9.5 0 0 0 9.5 57Z" fill="currentColor" opacity=".7"/><path d="M0 19A9.5 9.5 0 0 0 9.5 28.5H19V9.5H9.5A9.5 9.5 0 0 0 0 19Z" fill="currentColor" opacity=".7"/><path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="currentColor" opacity=".5"/><path d="M19 0V19H28.5A9.5 9.5 0 0 0 19 0Z" fill="currentColor" opacity=".5"/></svg>',
    sheets: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="9" x2="9" y2="21" stroke="currentColor" stroke-width="1.5"/></svg>',
    canva:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M9 12c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    pdf:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="17" x2="16" y2="17" stroke="currentColor" stroke-width="1.5"/></svg>'
  };

  /* Collect available sources */
  var pdfRaw = p.pdf || null;
  if (!pdfRaw && p.media) {
    var pdfMedia = p.media.find(function(m){ return m.type === 'pdf'; });
    if (pdfMedia) pdfRaw = pdfMedia.src.startsWith('http') ? pdfMedia.src : WIX_CDN + pdfMedia.src;
  }

  var artifactSources = {
    figma:  p.figma  || null,
    sheets: p.sheets || null,
    canva:  p.canva  || null,
    pdf:    pdfRaw   || null
  };

  var availableTypes = ARTIFACT_PRIORITY.filter(function(t){ return artifactSources[t]; });

  var artifactHTML;

  if (!availableTypes.length) {
    /* No artifact at all */
    artifactHTML = '<span class="detail-label-tag">Full deck</span>'
      + '<div class="detail-pdf-fallback" style="height:200px;border:1px solid var(--border)">'
      + '<p style="color:var(--muted);font-size:13px">No document attached.</p></div>';

  } else {
    var firstType = availableTypes[0];

    /* Tab switcher — only rendered when 2+ sources exist */
    var switcherHTML = '';
    if (availableTypes.length > 1) {
      switcherHTML = '<div class="detail-artifact-switcher">'
        + availableTypes.map(function(t){
            return '<button class="detail-artifact-tab" data-type="' + t + '">'
              + ARTIFACT_ICONS[t]
              + '<span>' + ARTIFACT_LABELS[t] + '</span>'
              + '</button>';
          }).join('')
        + '</div>';
    }

    /* External open link — src and label update on tab switch via JS */
    var extLinkHTML = '<a href="' + artifactSources[firstType] + '" '
      + 'target="_blank" rel="noopener" '
      + 'class="detail-pdf-download detail-artifact-extlink" '
      + 'data-src-figma="'  + (artifactSources.figma  || '') + '" '
      + 'data-src-sheets="' + (artifactSources.sheets || '') + '" '
      + 'data-src-canva="'  + (artifactSources.canva  || '') + '" '
      + 'data-src-pdf="'    + (artifactSources.pdf    || '') + '">'
      + ARTIFACT_OPEN_LABELS[firstType]
      + '</a>';

    /* One iframe panel per available source */
    var panelsHTML = availableTypes.map(function(t){
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

    artifactHTML = '<div class="detail-artifact-header">'
      + '<span class="detail-label-tag" style="margin-bottom:0">Full deck</span>'
      + '<div class="detail-artifact-header__right">'
      + switcherHTML
      + extLinkHTML
      + '</div>'
      + '</div>'
      + panelsHTML;
  }

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
    ? '<a href="project.html?id=' + next.id + '" class="detail-breadcrumb__next">'
        + '<span>Next</span>'
        + '<span class="detail-breadcrumb__sep">/</span>'
        + '<span class="detail-breadcrumb__next-title">' + next.title + '</span>'
        + '<span> →</span>'
        + '</a>'
    : '<a href="projects.html" class="detail-breadcrumb__next"><span>All Work →</span></a>';

  var gallerySection = galleryItems.length ? section('s-gallery', '05', 'Gallery', galleryHTML, false) : '';
  var tkNum          = galleryItems.length ? '06' : '05';

  /* ── Render ── */
  root.innerHTML =
    '<div class="detail-breadcrumb fade-in">'
      + '<div class="detail-breadcrumb__left">'
        + '<a href="projects.html" class="detail-back">← Work</a>'
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
        + (galleryItems.length ? '<button class="detail-section-nav__item" data-target="s-gallery"><span class="detail-section-nav__dot"></span>Gallery</button>' : '')
        + '<button class="detail-section-nav__item" data-target="s-takeaways"><span class="detail-section-nav__dot"></span>Takeaways</button>'
      + '</nav>'
    + '</div>'

    + '<div class="detail-sections">'
      + section('s-artifact',  '01', 'Artifact',  artifactHTML,  true)
      + section('s-context',   '02', 'Context',   contextHTML,   false)
      + section('s-approach',  '03', 'Approach',  approachHTML,  false)
      + section('s-results',   '04', 'Results',   resultsHTML,   false)
      + gallerySection
      + section('s-takeaways', tkNum, 'Takeaways', takeawaysHTML, false)
    + '</div>'

    + '<div class="lightbox" id="lightbox" role="dialog" aria-modal="true">'
      + '<button class="lightbox__close" id="lightbox-close">✕</button>'
      + '<button class="lightbox__prev"  id="lightbox-prev">←</button>'
      + '<button class="lightbox__next"  id="lightbox-next">→</button>'
      + '<div class="lightbox__img-wrap"><img class="lightbox__img" id="lightbox-img" src="" alt=""/></div>'
      + '<p class="lightbox__counter" id="lightbox-counter"></p>'
    + '</div>';

  /* ── Collapsible sections ── */
  root.querySelectorAll('.detail-section-block').forEach(function(block) {
    var hdr = block.querySelector('.detail-section-header');
    hdr.addEventListener('click', function() {
      var open = block.classList.toggle('is-open');
      hdr.setAttribute('aria-expanded', open);
    });
    hdr.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hdr.click(); }
    });
  });

  /* ── Artifact tab switcher ── */
  (function() {
    var tabs    = root.querySelectorAll('.detail-artifact-tab');
    var panels  = root.querySelectorAll('.detail-artifact-panel');
    var extLink = root.querySelector('.detail-artifact-extlink');

    /* Always show the first (or only) panel on load */
    var firstPanel = root.querySelector('.detail-artifact-panel');
    if (firstPanel) firstPanel.style.display = '';

    if (!tabs.length) return; /* single source — nothing more to wire up */

    /* Activate the first tab on load */
    if (tabs[0]) tabs[0].classList.add('is-active');

    function activate(type) {
      /* Tabs */
      tabs.forEach(function(b) {
        b.classList.toggle('is-active', b.dataset.type === type);
      });
      /* Panels */
      panels.forEach(function(panel) {
        panel.style.display = panel.dataset.type === type ? '' : 'none';
      });
      /* External link — update href and label */
      if (extLink) {
        var key = 'src' + type.charAt(0).toUpperCase() + type.slice(1);
        extLink.href        = extLink.dataset[key] || '#';
        extLink.textContent = ARTIFACT_OPEN_LABELS[type] || 'Open ↗';
      }
    }

    tabs.forEach(function(btn) {
      btn.addEventListener('click', function() { activate(btn.dataset.type); });
    });
  })();

  /* ── Section nav click ── */
  root.querySelectorAll('.detail-section-nav__item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = document.getElementById(btn.dataset.target);
      if (!target) return;
      if (!target.classList.contains('is-open')) {
        target.classList.add('is-open');
        target.querySelector('.detail-section-header').setAttribute('aria-expanded', 'true');
      }
      /* Offset accounts for sticky nav height (~56px) + nav-wrap (~48px) + breathing room */
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

  ['s-artifact','s-context','s-approach','s-results','s-gallery','s-takeaways'].forEach(function(sid) {
    var el = document.getElementById(sid);
    if (el) spy.observe(el);
  });

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