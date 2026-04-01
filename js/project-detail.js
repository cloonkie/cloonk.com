/* project-detail.js */
(function () {
  const CDN  = 'https://static.wixstatic.com/media/';
  const root = document.getElementById('detail-root');
  if (!root || !window.PROJECTS) return;

  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  const p      = window.PROJECTS.find(x => x.id === id);

  if (!p) {
    root.innerHTML = `
      <div class="detail-not-found">
        <p class="label label--gold">404</p>
        <h1 class="detail-title">Project not found</h1>
        <a href="projects.html" class="detail-back">← Back to Work</a>
      </div>`;
    return;
  }

  document.title = `${p.title} — Kevin Zhang`;

  const idx  = window.PROJECTS.indexOf(p);
  const prev = window.PROJECTS[idx - 1] || null;
  const next = window.PROJECTS[idx + 1] || null;

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  /* ── Section builder ── */
  function section(id, num, label, contentHTML, openByDefault) {
    return `
      <div class="detail-section-block${openByDefault ? ' is-open' : ''}" id="${id}">
        <div class="detail-section-header" role="button" tabindex="0" aria-expanded="${openByDefault ? 'true' : 'false'}">
          <div class="detail-section-header__left">
            <span class="detail-section-header__num">${num}</span>
            <span class="detail-section-header__label">${label}</span>
          </div>
          <div class="detail-section-toggle">
            <div class="toggle-bar toggle-bar--h"></div>
            <div class="toggle-bar toggle-bar--v"></div>
          </div>
        </div>
        <div class="detail-section-body">
          <div class="detail-section-body__inner">
            <div class="detail-section-content">${contentHTML}</div>
          </div>
        </div>
      </div>`;
  }

  /* ── Context section ── */
  const contextHTML = `
    <span class="detail-label-tag">Business problem</span>
    <div class="detail-prose">${(p.context && p.context.problem) ? `<p>${p.context.problem}</p>` : `<p>${p.desc}</p>`}</div>
    ${(p.context && (p.context.why || p.context.constraints)) ? `
    <div class="detail-two-col">
      ${p.context.why ? `<div><h4>Why it mattered</h4><ul>${p.context.why.map(x=>`<li>${x}</li>`).join('')}</ul></div>` : ''}
      ${p.context.constraints ? `<div><h4>Constraints</h4><ul>${p.context.constraints.map(x=>`<li>${x}</li>`).join('')}</ul></div>` : ''}
    </div>` : ''}`;

  /* ── Approach section ── */
  const approachHTML = `
    <span class="detail-label-tag">Methodology</span>
    <div class="detail-prose">${(p.approach && p.approach.summary) ? `<p>${p.approach.summary}</p>` : '<p>Detailed approach coming soon.</p>'}</div>
    ${(p.approach && (p.approach.data || p.approach.steps)) ? `
    <div class="detail-two-col">
      ${p.approach.data ? `<div><h4>Data &amp; tools</h4><ul>${p.approach.data.map(x=>`<li>${x}</li>`).join('')}</ul></div>` : ''}
      ${p.approach.steps ? `<div><h4>Execution steps</h4><ul>${p.approach.steps.map(x=>`<li>${x}</li>`).join('')}</ul></div>` : ''}
    </div>` : ''}`;

  /* ── Results section ── */
  const resultsHTML = `
    <span class="detail-label-tag">Quantified impact</span>
    ${(p.results && p.results.metrics) ? `
    <div class="detail-result-grid">
      ${p.results.metrics.map(m=>`
        <div class="detail-result-card">
          <div class="detail-result-card__num">${m.num}</div>
          <div class="detail-result-card__label">${m.label}</div>
        </div>`).join('')}
    </div>` : ''}
    ${(p.results && p.results.before && p.results.after) ? `
    <div class="detail-before-after">
      <div class="detail-ba-col detail-ba-col--before">
        <div class="detail-ba-col__head">Before</div>
        <ul>${p.results.before.map(x=>`<li>${x}</li>`).join('')}</ul>
      </div>
      <div class="detail-ba-col detail-ba-col--after">
        <div class="detail-ba-col__head">After</div>
        <ul>${p.results.after.map(x=>`<li>${x}</li>`).join('')}</ul>
      </div>
    </div>` : ''}`;

  /* ── Artifact (PDF) section ── */
  const hasPDF = p.pdf && p.pdf.length > 0;
  const artifactHTML = hasPDF ? `
    <div class="detail-pdf-section-header">
      <span class="detail-label-tag" style="margin-bottom:0">Full deck</span>
      <a href="${p.pdf}" target="_blank" rel="noopener" class="detail-pdf-download">Download PDF ↗</a>
    </div>
    <div class="detail-pdf-wrap">
      <iframe src="${p.pdf}" class="detail-pdf-frame" title="${p.title} PDF" loading="lazy">
        <div class="detail-pdf-fallback">
          <p>PDF preview unavailable.</p>
          <a href="${p.pdf}" target="_blank" rel="noopener">Open PDF ↗</a>
        </div>
      </iframe>
    </div>` :
    `<span class="detail-label-tag">Full deck</span>
    <div class="detail-pdf-fallback" style="height:200px;border:1px solid var(--border)">
      <p style="color:var(--muted);font-size:13px">No document attached to this project.</p>
    </div>`;

  /* ── Gallery section ── */
  const hasGallery = p.gallery && p.gallery.length > 0;
  const hasMedia   = p.media && p.media.length > 0;
  const galleryItems = hasGallery ? p.gallery.map((img, i) => ({ src: CDN + img, i }))
                     : hasMedia   ? p.media.filter(m => m.type === 'image').map((m, i) => ({
                         src: m.src.startsWith('http') ? m.src : CDN + m.src, i
                       })) : [];

  const galleryHTML = galleryItems.length ? `
    <span class="detail-label-tag">Images</span>
    <div class="detail-gallery${galleryItems.length === 1 ? ' detail-gallery--single' : ''}">
      ${galleryItems.map(({src, i}) => `
        <div class="detail-gallery__item" data-index="${i}">
          <img src="${src}" alt="${p.title} — image ${i+1}" loading="lazy"
            onerror="this.closest('.detail-gallery__item').style.display='none'" />
          <div class="detail-gallery__overlay"><span class="detail-gallery__zoom">↗ View</span></div>
        </div>`).join('')}
    </div>` : '';

  /* ── Takeaways section ── */
  const takeawaysHTML = (p.takeaways && p.takeaways.length) ? `
    <span class="detail-label-tag">Key insights</span>
    <div class="detail-takeaway-list">
      ${p.takeaways.map((t, i) => `
        <div class="detail-takeaway-item">
          <div class="detail-takeaway-item__num">0${i+1}</div>
          <div class="detail-takeaway-item__text">
            <h4>${t.title}</h4>
            <p>${t.body}</p>
          </div>
        </div>`).join('')}
    </div>` :
    `<span class="detail-label-tag">Key insights</span>
    <p class="detail-prose" style="color:var(--muted)">Takeaways coming soon.</p>`;

  /* ── Full render ── */
  root.innerHTML = `
    <div class="detail-breadcrumb fade-in">
      <a href="projects.html" class="detail-back">← Work</a>
      <span class="detail-breadcrumb__sep">/</span>
      <span class="detail-breadcrumb__current">${p.title}</span>
    </div>

    <div class="detail-hero fade-in">
      <div>
        <p class="detail-hero__num">${p.num}</p>
        <h1 class="detail-title">${p.title}</h1>
        <p class="detail-short">${p.short}</p>
      </div>
      <div class="detail-meta">
        <div class="detail-meta__item">
          <span class="detail-meta__label">Topic</span>
          <span class="detail-meta__value">${cap(p.topic)}</span>
        </div>
        <div class="detail-meta__item">
          <span class="detail-meta__label">Type</span>
          <span class="detail-meta__value">${p.type}</span>
        </div>
        <div class="detail-meta__item">
          <span class="detail-meta__label">Year</span>
          <span class="detail-meta__value">${p.year}</span>
        </div>
        ${p.role ? `<div class="detail-meta__item"><span class="detail-meta__label">Role</span><span class="detail-meta__value">${p.role}</span></div>` : ''}
      </div>
    </div>

    <hr class="divider fade-in" />

    <div class="detail-section-nav-wrap fade-in">
      <nav class="detail-section-nav" id="detail-section-nav">
        <button class="detail-section-nav__item is-active" data-target="s-artifact"><span class="detail-section-nav__dot"></span>Artifact</button>
        <button class="detail-section-nav__item" data-target="s-context"><span class="detail-section-nav__dot"></span>Context</button>
        <button class="detail-section-nav__item" data-target="s-approach"><span class="detail-section-nav__dot"></span>Approach</button>
        <button class="detail-section-nav__item" data-target="s-results"><span class="detail-section-nav__dot"></span>Results</button>
        ${galleryItems.length ? '<button class="detail-section-nav__item" data-target="s-gallery"><span class="detail-section-nav__dot"></span>Gallery</button>' : ''}
        <button class="detail-section-nav__item" data-target="s-takeaways"><span class="detail-section-nav__dot"></span>Takeaways</button>
      </nav>
    </div>

    <div class="detail-sections">
      ${section('s-artifact', '01', 'Artifact', artifactHTML, true)}
      ${section('s-context',  '02', 'Context',  contextHTML,  false)}
      ${section('s-approach', '03', 'Approach', approachHTML, false)}
      ${section('s-results',  '04', 'Results',  resultsHTML,  false)}
      ${galleryItems.length ? section('s-gallery', '05', 'Gallery', galleryHTML, false) : ''}
      ${section('s-takeaways', galleryItems.length ? '06' : '05', 'Takeaways', takeawaysHTML, false)}
    </div>

    <nav class="detail-nav fade-in" aria-label="Project navigation">
  <div class="detail-nav__prev">
    ${prev ? `<a href="project.html?id=${prev.id}" class="detail-nav__link">
      <span class="detail-nav__dir">← Previous</span>
      <span class="detail-nav__name">${prev.title}</span>
    </a>` : ''}
  </div>
  <div class="detail-nav__all-wrap">
    <a href="projects.html" class="detail-nav__all">All Work</a>
  </div>
  <div class="detail-nav__next">
    ${next ? `<a href="project.html?id=${next.id}" class="detail-nav__link detail-nav__link--right">
      <span class="detail-nav__dir">Next →</span>
      <span class="detail-nav__name">${next.title}</span>
    </a>` : ''}
  </div>
</nav>

    <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">
      <button class="lightbox__close" id="lightbox-close" aria-label="Close">✕</button>
      <button class="lightbox__prev" id="lightbox-prev" aria-label="Previous">←</button>
      <button class="lightbox__next" id="lightbox-next" aria-label="Next">→</button>
      <div class="lightbox__img-wrap"><img class="lightbox__img" id="lightbox-img" src="" alt="" /></div>
      <p class="lightbox__counter" id="lightbox-counter"></p>
    </div>
  `;

  /* ── Collapsible toggle ── */
  root.querySelectorAll('.detail-section-block').forEach(block => {
    const hdr = block.querySelector('.detail-section-header');
    hdr.addEventListener('click', () => {
      const open = block.classList.toggle('is-open');
      hdr.setAttribute('aria-expanded', open);
    });
    hdr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hdr.click(); }
    });
  });

  /* ── Section nav: click ── */
  root.querySelectorAll('.detail-section-nav__item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      if (!target.classList.contains('is-open')) {
        target.classList.add('is-open');
        target.querySelector('.detail-section-header').setAttribute('aria-expanded', 'true');
      }
      const offset = 96;
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  /* ── Section nav: scroll spy ── */
  const sectionIds = ['s-artifact','s-context','s-approach','s-results','s-gallery','s-takeaways'];
  const navBtns = {};
  root.querySelectorAll('.detail-section-nav__item').forEach(b => { navBtns[b.dataset.target] = b; });
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        root.querySelectorAll('.detail-section-nav__item').forEach(b => b.classList.remove('is-active'));
        if (navBtns[e.target.id]) navBtns[e.target.id].classList.add('is-active');
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
  sectionIds.forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });

  /* ── Project nav reveal ── */
  const nav = root.querySelector('.detail-nav');
  if (nav) {
    new IntersectionObserver(([e]) => { if (e.isIntersecting) nav.classList.add('is-visible'); }, { threshold: 0.1 }).observe(nav);
  }

  /* ── Lightbox ── */
  if (!galleryItems.length) return;
  const imgs      = galleryItems.map(g => g.src);
  const lightbox  = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lightbox-img');
  const lbCounter = document.getElementById('lightbox-counter');
  let current = 0;

  function openLB(i) {
    current = i; lbImg.src = imgs[i];
    lbCounter.textContent = `${i+1} / ${imgs.length}`;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLB() { lightbox.classList.remove('open'); document.body.style.overflow = ''; }
  function showPrev() { current = (current - 1 + imgs.length) % imgs.length; lbImg.src = imgs[current]; lbCounter.textContent = `${current+1} / ${imgs.length}`; }
  function showNext() { current = (current + 1) % imgs.length; lbImg.src = imgs[current]; lbCounter.textContent = `${current+1} / ${imgs.length}`; }

  root.querySelectorAll('.detail-gallery__item').forEach((item, i) => item.addEventListener('click', () => openLB(i)));
  document.getElementById('lightbox-close').addEventListener('click', closeLB);
  document.getElementById('lightbox-prev').addEventListener('click', e => { e.stopPropagation(); showPrev(); });
  document.getElementById('lightbox-next').addEventListener('click', e => { e.stopPropagation(); showNext(); });
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLB(); });
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLB();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });
  let tx = 0;
  lightbox.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) dx < 0 ? showNext() : showPrev(); });
})();