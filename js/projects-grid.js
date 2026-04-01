/* projects-grid.js — multi-select filters + sort drawers */
(function () {

  const grid            = document.getElementById('work-grid');
  const empty           = document.getElementById('work-empty');
  const counter         = document.getElementById('work-count');
  const pagInfo         = document.getElementById('pagination-info');
  const pagControls     = document.getElementById('pagination-controls');
  const activeFiltersEl = document.getElementById('active-filters');

  if (!grid || !window.PROJECTS) return;

  const PER_PAGE = 6;

  /* ── State: Sets for multi-select, string for sort ── */
  const sel = {
    topic:       new Set(),
    year:        new Set(),
    affiliation: new Set(),
    type:        new Set(),
  };
  let activeSort  = 'default';
  let currentPage = 1;
  let filtered    = [];

  /* ── Build all cards once ── */
  window.PROJECTS.forEach(p => {
    const card = document.createElement('article');
    card.className = 'wk-card';
    card.dataset.topic       = p.topic;
    card.dataset.year        = p.year;
    card.dataset.id          = p.id;
    card.dataset.affiliation = p.affiliation || 'other';
    card.dataset.type        = (p.type || '').toLowerCase();

    card.innerHTML = `
      <a href="project.html?id=${p.id}" class="wk-card__link">
        <div class="wk-card__img">
          <img src="${p.img}" alt="${p.title}" loading="lazy"
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

  /* ── Dynamically build Type filter from data ── */
  const typeValues = [...new Set(window.PROJECTS.map(p => p.type).filter(Boolean))].sort();
  const typeGroup  = document.getElementById('filter-type');
  if (typeGroup) {
    typeValues.forEach(t => {
      const b = document.createElement('button');
      b.className      = 'filter-pill';
      b.dataset.type   = t.toLowerCase();
      b.textContent    = t;
      typeGroup.appendChild(b);
    });
  }

  /* ── Drawer toggles ── */
  const btnFilter    = document.getElementById('btn-filter');
  const btnRefine    = document.getElementById('btn-refine');
  const filterDrawer = document.getElementById('filter-drawer');
  const refineDrawer = document.getElementById('refine-drawer');
  const filterBadge  = document.getElementById('filter-badge');

  function toggleDrawer(drawerEl, triggerBtn, otherDrawer, otherBtn) {
    const opening = !drawerEl.classList.contains('is-open');
    otherDrawer.classList.remove('is-open');
    otherBtn.classList.remove('is-open');
    otherBtn.setAttribute('aria-expanded', 'false');
    drawerEl.classList.toggle('is-open', opening);
    triggerBtn.classList.toggle('is-open', opening);
    triggerBtn.setAttribute('aria-expanded', String(opening));
  }

  btnFilter.addEventListener('click', () => toggleDrawer(filterDrawer, btnFilter, refineDrawer, btnRefine));
  btnRefine.addEventListener('click', () => toggleDrawer(refineDrawer, btnRefine, filterDrawer, btnFilter));

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

  /* ── Multi-select pill wiring ──
     - Empty Set means "all" (no filter).
     - Clicking "All" clears the Set.
     - Clicking any other pill toggles it in/out of the Set. */
  function wireMultiFilter(groupId, key) {
    const group = document.getElementById(groupId);
    if (!group) return;

    /* Init: "All" pill starts active */
    const allPill = group.querySelector('.filter-pill[data-' + key + '="all"]')
                 || group.querySelector('.filter-pill');
    if (allPill) allPill.classList.add('active');

    group.addEventListener('click', e => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;

      const val = pill.dataset[key];

      if (!val || val === 'all') {
        sel[key].clear();
      } else {
        sel[key].has(val) ? sel[key].delete(val) : sel[key].add(val);
      }

      syncPills(group, key);
      applyFilters();
    });
  }

  function syncPills(group, key) {
    group.querySelectorAll('.filter-pill').forEach(p => {
      const v = p.dataset[key];
      p.classList.toggle('active',
        (!v || v === 'all') ? sel[key].size === 0 : sel[key].has(v)
      );
    });
  }

  wireMultiFilter('filter-topic',       'topic');
  wireMultiFilter('filter-year',        'year');
  wireMultiFilter('filter-affiliation', 'affiliation');
  wireMultiFilter('filter-type',        'type');

  /* ── Badge count ── */
  function updateBadge() {
    const count = ['topic','year','affiliation','type'].filter(k => sel[k].size > 0).length;
    filterBadge.textContent = count;
    filterBadge.classList.toggle('visible', count > 0);
  }

  /* ── Active chips ── */
  const CHIP_LABEL = { topic: 'Topic', year: 'Year', affiliation: 'Source', type: 'Type' };
  const AFFIL_DISPLAY = { lim: 'FIT', pratt: 'Pratt', professional: 'Professional', other: 'Other' };

  function displayVal(key, val) {
    if (key === 'affiliation') return AFFIL_DISPLAY[val] || cap(val);
    return cap(val);
  }

  function renderChips() {
    activeFiltersEl.innerHTML = '';
    let total = 0;

    ['topic', 'year', 'affiliation', 'type'].forEach(key => {
      sel[key].forEach(val => {
        total++;
        const chip = document.createElement('div');
        chip.className = 'active-chip';
        chip.innerHTML = `<span>${CHIP_LABEL[key]}: ${displayVal(key, val)}</span>`
          + `<button class="active-chip__remove" aria-label="Remove ${val}">×</button>`;
        chip.querySelector('.active-chip__remove').addEventListener('click', () => {
          sel[key].delete(val);
          const group = document.getElementById('filter-' + key);
          if (group) syncPills(group, key);
          applyFilters();
        });
        activeFiltersEl.appendChild(chip);
      });
    });

    if (total > 1) {
      const clearBtn = document.createElement('button');
      clearBtn.className   = 'clear-all-btn';
      clearBtn.textContent = 'Clear all';
      clearBtn.addEventListener('click', () => {
        ['topic','year','affiliation','type'].forEach(key => {
          sel[key].clear();
          const group = document.getElementById('filter-' + key);
          if (group) syncPills(group, key);
        });
        applyFilters();
      });
      activeFiltersEl.appendChild(clearBtn);
    }
  }

  /* ── Apply filters ── */
  function applyFilters() {
    filtered = allCards.filter(card => {
      return (sel.topic.size       === 0 || sel.topic.has(card.dataset.topic))
          && (sel.year.size        === 0 || sel.year.has(card.dataset.year))
          && (sel.affiliation.size === 0 || sel.affiliation.has(card.dataset.affiliation))
          && (sel.type.size        === 0 || sel.type.has(card.dataset.type));
    });

    if (activeSort === 'year-desc') {
      filtered.sort((a, b) => Number(b.dataset.year) - Number(a.dataset.year));
    } else if (activeSort === 'year-asc') {
      filtered.sort((a, b) => Number(a.dataset.year) - Number(b.dataset.year));
    } else {
      const order = window.PROJECTS.map(p => p.id);
      filtered.sort((a, b) => order.indexOf(a.dataset.id) - order.indexOf(b.dataset.id));
    }

    filtered.forEach(card => grid.appendChild(card));

    currentPage = 1;
    updateBadge();
    renderChips();
    renderPage();
  }

  /* ── Render page ── */
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

    if (total === 0) { pagInfo.textContent = ''; pagControls.innerHTML = ''; return; }

    pagInfo.textContent  = `${start + 1}–${Math.min(end, total)} of ${total}`;
    pagControls.innerHTML = '';

    const prev = mkBtn('←', currentPage === 1);
    prev.addEventListener('click', () => { currentPage--; renderPage(); scrollToGrid(); });
    pagControls.appendChild(prev);

    pageRange(currentPage, totalPages).forEach(p => {
      if (p === '…') {
        const s = document.createElement('span');
        s.className = 'page-btn'; s.textContent = '…'; s.style.pointerEvents = 'none';
        pagControls.appendChild(s);
      } else {
        const b = mkBtn(p, false, p === currentPage);
        b.addEventListener('click', () => { currentPage = p; renderPage(); scrollToGrid(); });
        pagControls.appendChild(b);
      }
    });

    const next = mkBtn('→', currentPage === totalPages);
    next.addEventListener('click', () => { currentPage++; renderPage(); scrollToGrid(); });
    pagControls.appendChild(next);
  }

  function mkBtn(label, disabled, active) {
    const b = document.createElement('button');
    b.className   = 'page-btn' + (active ? ' active' : '');
    b.textContent = label;
    b.disabled    = disabled;
    return b;
  }

  function pageRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)   return [1, 2, 3, 4, 5, '…', total];
    if (cur >= total - 3) return [1, '…', total-4, total-3, total-2, total-1, total];
    return [1, '…', cur-1, cur, cur+1, '…', total];
  }

  function scrollToGrid() { grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  applyFilters();

})();