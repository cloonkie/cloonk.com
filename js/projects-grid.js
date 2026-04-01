/* projects-grid.js — work grid with hideable filter/sort drawers + active chips */
(function () {

  const grid        = document.getElementById('work-grid');
  const empty       = document.getElementById('work-empty');
  const counter     = document.getElementById('work-count');
  const pagInfo     = document.getElementById('pagination-info');
  const pagControls = document.getElementById('pagination-controls');
  const activeFiltersEl = document.getElementById('active-filters');

  if (!grid || !window.PROJECTS) return;

  const CDN      = 'https://static.wixstatic.com/media/';
  const PER_PAGE = 6;

  /* ── State ── */
  let activeTopic       = 'all';
  let activeYear        = 'all';
  let activeAffiliation = 'all';
  let activeSort        = 'default';
  let currentPage       = 1;
  let filtered          = [];

  /* ── Build all cards once ── */
  window.PROJECTS.forEach(p => {
    const card = document.createElement('article');
    card.className = 'wk-card';
    card.dataset.topic       = p.topic;
    card.dataset.year        = p.year;
    card.dataset.id          = p.id;
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

  /* ── Drawer toggles ── */
  const btnFilter    = document.getElementById('btn-filter');
  const btnRefine    = document.getElementById('btn-refine');
  const filterDrawer = document.getElementById('filter-drawer');
  const refineDrawer = document.getElementById('refine-drawer');
  const filterBadge  = document.getElementById('filter-badge');

  function toggleDrawer(drawerEl, triggerBtn, otherDrawer, otherBtn) {
    const opening = !drawerEl.classList.contains('is-open');
    /* Close the other drawer first */
    otherDrawer.classList.remove('is-open');
    otherBtn.classList.remove('is-open');
    otherBtn.setAttribute('aria-expanded', 'false');
    /* Toggle this one */
    drawerEl.classList.toggle('is-open', opening);
    triggerBtn.classList.toggle('is-open', opening);
    triggerBtn.setAttribute('aria-expanded', String(opening));
  }

  btnFilter.addEventListener('click', () => {
    toggleDrawer(filterDrawer, btnFilter, refineDrawer, btnRefine);
  });
  btnRefine.addEventListener('click', () => {
    toggleDrawer(refineDrawer, btnRefine, filterDrawer, btnFilter);
  });

  /* ── Sort wiring ── */
  document.getElementById('sort-group').querySelectorAll('.sort-pill').forEach(b => {
    b.addEventListener('click', () => {
      document.getElementById('sort-group').querySelectorAll('.sort-pill')
        .forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      activeSort = b.dataset.sort;
      applyFilters();
    });
  });

  /* ── Filter wiring ── */
  function wireFilter(groupId, stateKey, dataKey) {
    document.getElementById(groupId).querySelectorAll('.filter-pill').forEach(b => {
      b.addEventListener('click', () => {
        document.getElementById(groupId).querySelectorAll('.filter-pill')
          .forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        /* update the right state var */
        if (stateKey === 'topic')       activeTopic       = b.dataset[dataKey];
        if (stateKey === 'year')        activeYear        = b.dataset[dataKey];
        if (stateKey === 'affiliation') activeAffiliation = b.dataset[dataKey];
        applyFilters();
      });
    });
  }

  wireFilter('filter-topic',       'topic',       'topic');
  wireFilter('filter-year',        'year',        'year');
  wireFilter('filter-affiliation', 'affiliation', 'affiliation');

  /* ── Active filter badge count ── */
  function updateBadge() {
    const count = (activeTopic !== 'all' ? 1 : 0)
                + (activeYear  !== 'all' ? 1 : 0)
                + (activeAffiliation !== 'all' ? 1 : 0);
    filterBadge.textContent = count;
    filterBadge.classList.toggle('visible', count > 0);
  }

  /* ── Active filter chips below toolbar ── */
  const LABEL_MAP = {
    topic:       { label: 'Topic', reset: () => { activeTopic = 'all'; resetPill('filter-topic', 'topic', 'all'); } },
    year:        { label: 'Year',  reset: () => { activeYear  = 'all'; resetPill('filter-year',  'year',  'all'); } },
    affiliation: { label: 'Source', reset: () => { activeAffiliation = 'all'; resetPill('filter-affiliation', 'affiliation', 'all'); } },
  };

  function resetPill(groupId, dataKey, val) {
    document.getElementById(groupId).querySelectorAll('.filter-pill').forEach(b => {
      b.classList.toggle('active', b.dataset[dataKey] === val);
    });
  }

  function renderChips() {
    activeFiltersEl.innerHTML = '';
    const active = [];
    if (activeTopic !== 'all')       active.push({ key: 'topic',       val: cap(activeTopic) });
    if (activeYear  !== 'all')       active.push({ key: 'year',        val: activeYear });
    if (activeAffiliation !== 'all') active.push({ key: 'affiliation', val: capSource(activeAffiliation) });

    if (active.length === 0) return;

    active.forEach(({ key, val }) => {
      const chip = document.createElement('div');
      chip.className = 'active-chip';
      chip.innerHTML = `<span>${LABEL_MAP[key].label}: ${val}</span><button class="active-chip__remove" aria-label="Remove filter">×</button>`;
      chip.querySelector('.active-chip__remove').addEventListener('click', () => {
        LABEL_MAP[key].reset();
        applyFilters();
      });
      activeFiltersEl.appendChild(chip);
    });

    if (active.length > 1) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'clear-all-btn';
      clearBtn.textContent = 'Clear all';
      clearBtn.addEventListener('click', () => {
        activeTopic = activeYear = activeAffiliation = 'all';
        resetPill('filter-topic',       'topic',       'all');
        resetPill('filter-year',        'year',        'all');
        resetPill('filter-affiliation', 'affiliation', 'all');
        applyFilters();
      });
      activeFiltersEl.appendChild(clearBtn);
    }
  }

  /* ── Apply filters + sort + rebuild page ── */
  function applyFilters() {
    filtered = allCards.filter(card => {
      const topicOk       = activeTopic       === 'all' || card.dataset.topic       === activeTopic;
      const yearOk        = activeYear        === 'all' || card.dataset.year        === activeYear;
      const affiliationOk = activeAffiliation === 'all' || card.dataset.affiliation === activeAffiliation;
      return topicOk && yearOk && affiliationOk;
    });

    /* Sort */
    if (activeSort === 'year-desc') {
      filtered.sort((a, b) => Number(b.dataset.year) - Number(a.dataset.year));
    } else if (activeSort === 'year-asc') {
      filtered.sort((a, b) => Number(a.dataset.year) - Number(b.dataset.year));
    } else {
      /* Default: restore PROJECTS order */
      const order = window.PROJECTS.map(p => p.id);
      filtered.sort((a, b) => order.indexOf(a.dataset.id) - order.indexOf(b.dataset.id));
    }

    /* Re-append in sorted order so DOM matches */
    filtered.forEach(card => grid.appendChild(card));

    currentPage = 1;
    updateBadge();
    renderChips();
    renderPage();
  }

  /* ── Render current page ── */
  function renderPage() {
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    currentPage      = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * PER_PAGE;
    const end   = start + PER_PAGE;

    allCards.forEach(card => card.classList.add('wk-card--hidden'));
    filtered.forEach((card, i) => {
      if (i >= start && i < end) card.classList.remove('wk-card--hidden');
    });

    counter.textContent = total === 1 ? '1 project' : `${total} projects`;
    empty.style.display = total === 0 ? 'block' : 'none';

    if (total === 0) {
      pagInfo.textContent = '';
      pagControls.innerHTML = '';
      return;
    }

    pagInfo.textContent = `${start + 1}–${Math.min(end, total)} of ${total}`;

    pagControls.innerHTML = '';

    const prev = btn('←', currentPage === 1);
    prev.addEventListener('click', () => { currentPage--; renderPage(); scrollToGrid(); });
    pagControls.appendChild(prev);

    pageRange(currentPage, totalPages).forEach(p => {
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

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  function capSource(s) {
    const map = { lim: 'FIT', pratt: 'Pratt', professional: 'Professional', other: 'Other' };
    return map[s] || cap(s);
  }

  applyFilters();

})();