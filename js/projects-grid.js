/* projects-grid.js — work grid with dual filters + pagination */
(function () {

  const grid       = document.getElementById('work-grid');
  const empty      = document.getElementById('work-empty');
  const counter    = document.getElementById('work-count');
  const pagInfo    = document.getElementById('pagination-info');
  const pagControls= document.getElementById('pagination-controls');

  if (!grid || !window.PROJECTS) return;

  const CDN       = 'https://static.wixstatic.com/media/';
  const PER_PAGE  = 6;   /* cards per page */

  /* ── State ── */
  let activeTopic  = 'all';
  let activeYear   = 'all';
  let currentPage  = 1;
  let filtered     = [];
  let activeAffiliation = 'all';

  /* ── Build all cards once ── */
  window.PROJECTS.forEach(p => {
    const card = document.createElement('article');
    card.className = 'wk-card';
    card.dataset.topic = p.topic;
    card.dataset.year  = p.year;
    card.dataset.id    = p.id;
    card.dataset.affiliation = p.affiliation || 'other';

    card.innerHTML = `
      <a href="project.html?id=${p.id}" class="wk-card__link">
        <div class="wk-card__img">
          <img src="${CDN}${p.img}" alt="${p.title}" loading="lazy"
               onerror="this.style.display='none'" />
          <div class="wk-card__img-bg"></div>
          <span class="wk-card__type">${p.type}</span>
        </div>
        <div class="wk-card__body">
          <div class="wk-card__meta">
            <span class="wk-card__topic">${cap(p.topic)}</span>
            <span class="wk-card__year">${p.year}</span>
          </div>
          <p class="wk-card__title">${p.title}</p>
          <p class="wk-card__short">${p.short}</p>
        </div>
      </a>`;

    grid.appendChild(card);
  });

  const allCards = Array.from(grid.querySelectorAll('.wk-card'));

  /* ── Apply filters + rebuild page ── */
  function applyFilters() {
  filtered = allCards.filter(card => {
  const topicOk       = activeTopic       === 'all' || card.dataset.topic       === activeTopic;
  const yearOk        = activeYear        === 'all' || card.dataset.year        === activeYear;
  const affiliationOk = activeAffiliation === 'all' || card.dataset.affiliation === activeAffiliation;
  return topicOk && yearOk && affiliationOk;
});

    currentPage = 1;
    renderPage();
  }

  /* ── Render current page ── */
  function renderPage() {
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    currentPage      = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * PER_PAGE;
    const end   = start + PER_PAGE;

    /* Show/hide cards */
    allCards.forEach(card => card.classList.add('wk-card--hidden'));
    filtered.forEach((card, i) => {
      if (i >= start && i < end) card.classList.remove('wk-card--hidden');
    });

    /* Counter */
    counter.textContent = total === 1 ? '1 project' : `${total} projects`;

    /* Empty state */
    empty.style.display = total === 0 ? 'block' : 'none';

    /* Pagination info */
    if (total === 0) {
      pagInfo.textContent = '';
      pagControls.innerHTML = '';
      return;
    }

    const showing = Math.min(end, total) - start;
    pagInfo.textContent = `${start + 1}–${Math.min(end, total)} of ${total}`;

    /* Pagination buttons */
    pagControls.innerHTML = '';

    /* Prev */
    const prev = btn('←', currentPage === 1);
    prev.addEventListener('click', () => { currentPage--; renderPage(); scrollToGrid(); });
    pagControls.appendChild(prev);

    /* Page numbers (show max 5 around current) */
    const range = pageRange(currentPage, totalPages);
    range.forEach(p => {
      if (p === '…') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-btn';
        ellipsis.textContent = '…';
        ellipsis.style.pointerEvents = 'none';
        pagControls.appendChild(ellipsis);
      } else {
        const b = btn(p, false, p === currentPage);
        b.addEventListener('click', () => { currentPage = p; renderPage(); scrollToGrid(); });
        pagControls.appendChild(b);
      }
    });

    /* Next */
    const next = btn('→', currentPage === totalPages);
    next.addEventListener('click', () => { currentPage++; renderPage(); scrollToGrid(); });
    pagControls.appendChild(next);
  }

  function btn(label, disabled, active) {
    const b = document.createElement('button');
    b.className = 'page-btn' + (active ? ' active' : '');
    b.textContent = label;
    b.disabled = disabled;
    return b;
  }

  function pageRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)   return [1, 2, 3, 4, 5, '…', total];
    if (cur >= total - 3) return [1, '…', total-4, total-3, total-2, total-1, total];
    return [1, '…', cur-1, cur, cur+1, '…', total];
  }

  function scrollToGrid() {
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Wire topic buttons ── */
  document.getElementById('filter-topic').querySelectorAll('.filter-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.getElementById('filter-topic').querySelectorAll('.filter-btn')
        .forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      activeTopic = b.dataset.topic;
      applyFilters();
    });
  });

  /* ── Wire year buttons ── */
  document.getElementById('filter-year').querySelectorAll('.filter-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.getElementById('filter-year').querySelectorAll('.filter-btn')
        .forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      activeYear = b.dataset.year;
      applyFilters();
    });
  });

    /* ── Wire affiliation buttons ── */
  document.getElementById('filter-affiliation').querySelectorAll('.filter-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.getElementById('filter-affiliation').querySelectorAll('.filter-btn')
      .forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    activeAffiliation = b.dataset.affiliation;
    applyFilters();
  });
});

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  applyFilters();

})();
