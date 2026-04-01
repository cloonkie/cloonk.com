/* projects-grid.js — vertical right panel + zero-result pill greying */
(function () {

  const grid            = document.getElementById('work-grid');
  const empty           = document.getElementById('work-empty');
  const counter         = document.getElementById('work-count');
  const pagInfo         = document.getElementById('pagination-info');
  const pagControls     = document.getElementById('pagination-controls');
  const activeFiltersEl = document.getElementById('active-filters');
  const clearAllBtn     = document.getElementById('panel-clear-all');
  const filterBadge     = document.getElementById('filter-badge');

  if (!grid || !window.PROJECTS) return;

  const PER_PAGE = 6;

  /* ── State ── */
  const sel = {
    topic:       new Set(),
    year:        new Set(),
    affiliation: new Set(),
    type:        new Set(),
  };
  let activeSort  = 'year-desc';
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
    /* All pill */
    const allBtn = document.createElement('button');
    allBtn.className   = 'filter-pill active';
    allBtn.dataset.type = 'all';
    allBtn.innerHTML   = 'All <span class="pill-count"></span>';
    typeGroup.appendChild(allBtn);

    typeValues.forEach(t => {
      const b = document.createElement('button');
      b.className     = 'filter-pill';
      b.dataset.type  = t.toLowerCase();
      b.innerHTML     = cap(t) + ' <span class="pill-count"></span>';
      typeGroup.appendChild(b);
    });
  }

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

  /* ─────────────────────────────────────────
     MULTI-SELECT PILL WIRING
  ───────────────────────────────────────── */
  function wireMultiFilter(groupId, key) {
    const group = document.getElementById(groupId);
    if (!group) return;

    group.addEventListener('click', e => {
      const pill = e.target.closest('.filter-pill');
      if (!pill || pill.classList.contains('is-disabled')) return;

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

  /* ─────────────────────────────────────────
     ZERO-RESULT GREYING
     For each pill, count how many cards would
     match if that value were toggled in.
  ───────────────────────────────────────── */
  function countIfAdded(key, val, baseCards) {
    /* Simulate adding this value to sel[key] */
    const testSet = new Set(sel[key]);
    if (val === 'all') {
      /* "All" selected = clear the set */
      const simSel = Object.assign({}, sel);
      const tempSet = new Set();
      return baseCards.filter(card => {
        return (key === 'topic'       ? true : (sel.topic.size       === 0 || sel.topic.has(card.dataset.topic)))
            && (key === 'year'        ? true : (sel.year.size        === 0 || sel.year.has(card.dataset.year)))
            && (key === 'affiliation' ? true : (sel.affiliation.size === 0 || sel.affiliation.has(card.dataset.affiliation)))
            && (key === 'type'        ? true : (sel.type.size        === 0 || sel.type.has(card.dataset.type)));
      }).length;
    }
    testSet.add(val);
    return baseCards.filter(card => {
      const testTopic       = key === 'topic'       ? testSet : sel.topic;
      const testYear        = key === 'year'        ? testSet : sel.year;
      const testAffiliation = key === 'affiliation' ? testSet : sel.affiliation;
      const testType        = key === 'type'        ? testSet : sel.type;
      return (testTopic.size       === 0 || testTopic.has(card.dataset.topic))
          && (testYear.size        === 0 || testYear.has(card.dataset.year))
          && (testAffiliation.size === 0 || testAffiliation.has(card.dataset.affiliation))
          && (testType.size        === 0 || testType.has(card.dataset.type));
    }).length;
  }

  function updatePillCounts() {
    const keys = ['topic', 'year', 'affiliation', 'type'];

    keys.forEach(key => {
      const group = document.getElementById('filter-' + key);
      if (!group) return;

      group.querySelectorAll('.filter-pill').forEach(pill => {
        const val = pill.dataset[key];
        const countEl = pill.querySelector('.pill-count');
        const n = countIfAdded(key, val, allCards);

        /* Grey out if adding this filter yields 0 results
           (and it's not already active/selected) */
        const isActive = (!val || val === 'all')
          ? sel[key].size === 0
          : sel[key].has(val);

        if (!isActive && n === 0) {
          pill.classList.add('is-disabled');
        } else {
          pill.classList.remove('is-disabled');
        }

        /* Update count label — hide for "All" pill */
        if (countEl) {
          if (!val || val === 'all') {
            countEl.textContent = '';
          } else {
            countEl.textContent = n;
          }
        }
      });
    });
  }

  /* ── Clear all ── */
  clearAllBtn && clearAllBtn.addEventListener('click', () => {
    ['topic','year','affiliation','type'].forEach(key => {
      sel[key].clear();
      const group = document.getElementById('filter-' + key);
      if (group) syncPills(group, key);
    });
    applyFilters();
  });

  /* ── Badge count ── */
  function updateBadge() {
    const count = ['topic','year','affiliation','type'].filter(k => sel[k].size > 0).length;
    if (filterBadge) {
      filterBadge.textContent = count;
      filterBadge.classList.toggle('visible', count > 0);
    }
    if (clearAllBtn) {
      clearAllBtn.classList.toggle('visible', count > 0);
    }
  }

  /* ── Active chips ── */
  const CHIP_LABEL     = { topic: 'Topic', year: 'Year', affiliation: 'Source', type: 'Type' };
  const AFFIL_DISPLAY  = { FIT: 'FIT', pratt: 'Pratt', professional: 'Professional', other: 'Other' };

  function displayVal(key, val) {
    if (key === 'affiliation') return AFFIL_DISPLAY[val] || cap(val);
    return cap(val);
  }

  function renderChips() {
    if (!activeFiltersEl) return;
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
    updatePillCounts();
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

  /* ── Read URL params and pre-apply filters ──
     e.g. projects.html?affiliation=pratt
          projects.html?affiliation=pratt&topic=design
          projects.html?year=2024,2025
  ───────────────────────────────────────── */
  const urlParams = new URLSearchParams(window.location.search);
  ['topic', 'year', 'affiliation', 'type'].forEach(key => {
    const val = urlParams.get(key);
    if (!val) return;
    val.split(',').forEach(v => sel[key].add(v.trim().toLowerCase()));
    const group = document.getElementById('filter-' + key);
    if (group) syncPills(group, key);
  });

  applyFilters();

})();