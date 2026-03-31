/* project-detail.js — full detail page with PDF embed + image lightbox */
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

  const hasPDF     = p.pdf && p.pdf.length > 0;
  const hasGallery = p.gallery && p.gallery.length > 0;

  /* ── PDF section ── */
  const pdfHTML = hasPDF ? `
    <section class="detail-section fade-in">
      <div class="detail-section__header">
        <p class="label label--gold">Document</p>
        <a href="${p.pdf}" target="_blank" rel="noopener" class="detail-pdf-download">
          Open PDF ↗
        </a>
      </div>
      <div class="detail-pdf-wrap">
        <iframe
          src="${p.pdf}"
          class="detail-pdf-frame"
          title="${p.title} PDF"
          loading="lazy">
          <div class="detail-pdf-fallback">
            <p>PDF preview not available in this browser.</p>
            <a href="${p.pdf}" target="_blank" rel="noopener" class="detail-back">Download PDF ↗</a>
          </div>
        </iframe>
      </div>
    </section>` : '';

  /* ── Gallery section ── */
  const galleryHTML = hasGallery ? `
    <section class="detail-section fade-in">
      <p class="label label--gold">Gallery</p>
      <div class="detail-gallery ${p.gallery.length === 1 ? 'detail-gallery--single' : ''}">
        ${p.gallery.map((img, i) => `
          <div class="detail-gallery__item" data-index="${i}">
            <img
              src="${CDN}${img}"
              alt="${p.title} — image ${i + 1}"
              loading="lazy"
              onerror="this.closest('.detail-gallery__item').style.display='none'" />
            <div class="detail-gallery__overlay">
              <span class="detail-gallery__zoom">↗ View</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>` : '';

  /* ── Full render ── */
  root.innerHTML = `
    <div class="detail-breadcrumb fade-in">
      <a href="projects.html" class="detail-back">← Work</a>
      <span class="detail-breadcrumb__sep">/</span>
      <span class="detail-breadcrumb__current">${p.title}</span>
    </div>

    <div class="detail-header fade-in">
      <div class="detail-header__left">
        <p class="label label--gold">${p.num}</p>
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
      </div>
    </div>

    <hr class="divider fade-in" />

    <section class="detail-section fade-in">
      <p class="label label--gold">Overview</p>
      <p class="detail-desc">${p.desc}</p>
    </section>

    ${pdfHTML}
    ${galleryHTML}

    <nav class="detail-nav fade-in" aria-label="Project navigation">
      <div class="detail-nav__prev">
        ${prev ? `<a href="project.html?id=${prev.id}" class="detail-nav__link">
          <span class="detail-nav__dir">← Previous</span>
          <span class="detail-nav__name">${prev.title}</span>
        </a>` : '<span></span>'}
      </div>
      <a href="projects.html" class="detail-nav__all">All Work</a>
      <div class="detail-nav__next">
        ${next ? `<a href="project.html?id=${next.id}" class="detail-nav__link detail-nav__link--right">
          <span class="detail-nav__dir">Next →</span>
          <span class="detail-nav__name">${next.title}</span>
        </a>` : '<span></span>'}
      </div>
    </nav>

    <!-- Lightbox -->
    <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">
      <button class="lightbox__close" id="lightbox-close" aria-label="Close">✕</button>
      <button class="lightbox__prev" id="lightbox-prev" aria-label="Previous">←</button>
      <button class="lightbox__next" id="lightbox-next" aria-label="Next">→</button>
      <div class="lightbox__img-wrap">
        <img class="lightbox__img" id="lightbox-img" src="" alt="" />
      </div>
      <p class="lightbox__counter" id="lightbox-counter"></p>
    </div>
  `;

  /* ── Lightbox logic ── */
  if (!hasGallery) return;

  const imgs      = p.gallery.map(slug => CDN + slug);
  const lightbox  = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lightbox-img');
  const lbCounter = document.getElementById('lightbox-counter');
  let current     = 0;

  function openLightbox(i) {
    current = i;
    lbImg.src = imgs[i];
    lbCounter.textContent = `${i + 1} / ${imgs.length}`;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    lbImg.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showPrev() {
    current = (current - 1 + imgs.length) % imgs.length;
    lbImg.src = imgs[current];
    lbCounter.textContent = `${current + 1} / ${imgs.length}`;
  }

  function showNext() {
    current = (current + 1) % imgs.length;
    lbImg.src = imgs[current];
    lbCounter.textContent = `${current + 1} / ${imgs.length}`;
  }

  /* Wire gallery items */
  root.querySelectorAll('.detail-gallery__item').forEach((item, i) => {
    item.addEventListener('click', () => openLightbox(i));
  });

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });
  document.getElementById('lightbox-next').addEventListener('click', (e) => { e.stopPropagation(); showNext(); });

  /* Click backdrop to close */
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox__img-wrap')) closeLightbox();
  });

  /* Keyboard */
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  showPrev();
    if (e.key === 'ArrowRight') showNext();
  });

  /* Touch swipe */
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) dx < 0 ? showNext() : showPrev();
  });

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

})();


const nav = document.querySelector('.detail-nav');

const observer = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) {
      nav.classList.add('is-visible');
    }
  },
  { threshold: 0.2 }
);

if (nav) observer.observe(nav);