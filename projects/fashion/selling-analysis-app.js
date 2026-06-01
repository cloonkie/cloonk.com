/* ============================================================================
   selling-analysis-app.js  —  Sell-Through Diagnostic orchestration
   Loads the raw .xlsx via SheetJS, runs selling-analysis.js, renders the lenses,
   supports client-side theme authoring and a JSON snapshot for shared-drive use.
   ========================================================================== */
(function () {
  'use strict';
  const A = window.SOA;

  /* ---- brand-code -> display name (user-editable; unknowns fall back to code)
   * High-confidence EssilorLuxottica codes only; extend as needed. ---------- */
  const BRAND_NAMES = {
    RB: 'Ray-Ban', CH: 'Chanel', PR: 'Prada', PS: 'Prada Linea Rossa',
    VE: 'Versace', OO: 'Oakley', MU: 'Miu Miu', TF: 'Tom Ford',
    OV: 'Oliver Peoples', PO: 'Persol', DG: 'Dolce & Gabbana',
    VO: 'Vogue', AN: 'Arnette', BE: 'Burberry', TY: 'Tory Burch',
    MK: 'Michael Kors', HC: 'Coach', RJ: 'Ray-Ban Junior',
  };
  const brandLabel = c => BRAND_NAMES[c] ? `${BRAND_NAMES[c]} (${c})` : c;

  /* ---- application state ------------------------------------------------- */
  const state = {
    records: [],            // canonical parsed rows
    enriched: [],           // enriched (recomputed when params/themes change)
    optionalDims: [],       // UPC-grain dims present in the file (if any)
    params: { promoThreshold: 0.20, agedYear: 2020 },
    themes: {},             // { collectionRelease: themeString }  (authored)
    filters: {},            // { field: Set(values) }
    fileName: null,
    foundFields: [],
    analyses: A.evaluateAnalyses({}),
    selectedAnalysis: 'integrity',
  };

  // dimensions offered as filters (only render those present in data)
  const FILTER_DIMS = [
    ['retailer', 'Retailer'], ['location', 'Location'], ['brand', 'Brand'],
    ['door', 'Door'], ['week', 'Week'], ['size', 'Size'],
    ['brandCategory', 'Brand Category'], ['materialCode', 'Material'],
    ['frameMaterial', 'Frame Material'], ['priceRange', 'Price Range'],
    ['newness', 'Newness'], ['theme', 'Theme'],
    ['lensColor', 'Lens Color'], ['frameColor', 'Frame Color'],
    ['templeColor', 'Temple Color'],
  ];

  /* ---- formatting helpers ------------------------------------------------ */
  const $ = id => document.getElementById(id);
  const fmtInt = n => n == null ? '–' : Math.round(n).toLocaleString();
  const fmt$ = n => n == null ? '–' : '$' + Math.round(n).toLocaleString();
  const fmtPct = n => n == null ? '–' : (n * 100).toFixed(1) + '%';
  const el = (tag, attrs, html) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  };
  const setText = (node, value) => { if (node) node.textContent = value; };
  function table(headers, rows) {
    const t = el('table');
    const thead = el('thead');
    const htr = el('tr');
    headers.forEach(h => {
      const th = el('th');
      th.textContent = h;
      htr.appendChild(th);
    });
    thead.appendChild(htr); t.appendChild(thead);
    const tb = el('tbody');
    rows.forEach(r => {
      const tr = el('tr');
      r.forEach(c => {
        const td = el('td');
        td.textContent = c;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  }
  function updateHeaderStats() {
    setText($('statRows'), state.records.length ? state.records.length.toLocaleString() : '0');
    setText($('statFile'), state.fileName || 'none');
  }
  const lensId = id => id.replace(/^lens-/, '');
  const analysisFor = id => state.analyses.find(a => a.id === lensId(id));
  const selectedMeta = () => state.analyses.find(a => a.id === state.selectedAnalysis);

  function selectAnalysis(id, opts) {
    if (!state.analyses.some(a => a.id === id)) return;
    state.selectedAnalysis = id;
    const select = $('projectSelect');
    if (select) select.value = id;
    renderProjectChips();
    document.querySelectorAll('.tab').forEach(tab => {
      const active = lensId(tab.dataset.target) === id;
      tab.classList.toggle('active', active);
    });
    document.querySelectorAll('.lens').forEach(lens => {
      lens.classList.toggle('active', lensId(lens.id) === id);
    });
    const specificLens = $(`lens-${id}`);
    const genericLens = $('lens-workbench');
    if (genericLens) {
      genericLens.classList.toggle('active', !specificLens);
      if (!specificLens) renderGenericRead();
    }
    updateProjectStatus();
    updateTabsAvailability();
    if (!opts || opts.renderGuide !== false) renderAnalysisGuide();
  }

  function updateProjectStatus() {
    const host = $('projectStatus');
    if (!host) return;
    const meta = selectedMeta();
    if (!meta) return;
    if (!state.fileName) {
      host.textContent = `${meta.name}: drop a workbook and see whether this story is ready.`;
      return;
    }
    const supportedOthers = state.analyses.filter(a => a.ready && a.id !== state.selectedAnalysis);
    host.textContent = meta.ready
      ? `${meta.name} is ready. The same file also carries ${supportedOthers.length} side read${supportedOthers.length === 1 ? '' : 's'}.`
      : `${meta.name}: layer in ${meta.missing.map(A.fieldLabel).join(', ')} or leave this story out.`;
  }

  function populateProjectSelect() {
    const select = $('projectSelect');
    if (!select) return;
    select.innerHTML = '';
    A.ANALYSES.forEach(meta => {
      const option = document.createElement('option');
      option.value = meta.id;
      option.textContent = `${meta.priority}. ${meta.name}`;
      select.appendChild(option);
    });
    select.value = state.selectedAnalysis;
    renderProjectChips();
  }

  function renderProjectChips() {
    const host = $('projectChips');
    if (!host) return;
    host.innerHTML = '';
    A.ANALYSES.forEach(meta => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `project-chip${meta.id === state.selectedAnalysis ? ' is-active' : ''}`;
      btn.textContent = meta.name;
      btn.addEventListener('click', () => selectAnalysis(meta.id));
      host.appendChild(btn);
    });
  }

  function renderRequirementNotice(host, id) {
    const meta = analysisFor(id);
    if (!meta || meta.ready) return false;
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'layer-needed' }, 'Layer needed'));
    host.appendChild(el('h4', null, `${meta.name} needs another data layer`));
    host.appendChild(el('p', null, meta.question));
    host.appendChild(el('p', { class: 'note' },
      `Add ${meta.missing.map(A.fieldLabel).join(', ')} or remove this read from scope.`));
    host.appendChild(table(['Data layer', 'Status'], meta.metrics.map(field => [
      A.fieldLabel(field),
      meta.missingMetrics.includes(field) ? 'Layer needed' : 'Found',
    ])));
    return true;
  }

  function renderGenericRead() {
    const host = $('lens-workbench');
    if (!host) return;
    const meta = selectedMeta();
    if (!meta) return;
    host.innerHTML = '';
    if (!meta.ready) {
      renderRequirementNotice(host, meta.id);
      return;
    }
    host.appendChild(el('div', { class: 'layer-needed is-ready' }, 'Ready'));
    host.appendChild(el('h4', null, meta.name));
    host.appendChild(el('p', null, meta.question));
    host.appendChild(table(['Layer', 'Use'], meta.metrics.map(field => [
      A.fieldLabel(field),
      meta.availableMetrics.includes(field) ? 'Keep' : 'Optional add',
    ])));
    host.appendChild(el('p', { class: 'note' },
      'This read is wired into readiness. The next pass can turn this layer check into its dedicated chart or scoring table.'));
  }

  function renderAnalysisGuide() {
    const host = $('analysisGuide');
    if (!host) return;
    host.innerHTML = '';
    if (!state.fileName) {
      host.appendChild(el('p', { class: 'analysis-guide__empty' },
        'The ready reads will appear here after the file lands.'));
      return;
    }
    state.analyses.forEach(meta => {
      const isSelected = meta.id === state.selectedAnalysis;
      const isAlsoSupported = meta.ready && !isSelected;
      const card = el('article', {
        class: `analysis-card${meta.ready ? ' is-ready' : ' needs-layer'}${isSelected ? ' is-selected' : ''}${isAlsoSupported ? ' also-supported' : ''}`,
      });
      card.dataset.analysisId = meta.id;
      const status = isSelected
        ? (meta.ready ? 'Ready' : 'Add')
        : (meta.ready ? 'Also' : 'Add');
      card.appendChild(el('div', { class: 'analysis-card__top' },
        `<span>${meta.priority}. ${meta.name}</span><b>${status}</b>`));
      const fields = meta.ready
        ? `Carries ${meta.availableMetrics.map(A.fieldLabel).join(', ')}`
        : `Layer ${meta.missing.map(A.fieldLabel).join(', ')} / leave out`;
      card.appendChild(el('small', null, fields));
      card.addEventListener('click', () => selectAnalysis(meta.id));
      host.appendChild(card);
    });
  }

  function updateTabsAvailability() {
    document.querySelectorAll('.tab').forEach(tab => {
      const meta = analysisFor(tab.dataset.target);
      const missing = meta && !meta.ready;
      tab.classList.toggle('is-unavailable', Boolean(missing));
      tab.classList.toggle('is-selected-project', lensId(tab.dataset.target) === state.selectedAnalysis);
      tab.dataset.layerState = missing ? 'layer-needed' : 'ready';
      tab.title = missing
        ? `Layer in: ${meta.missing.map(A.fieldLabel).join(', ')}`
        : '';
    });
  }

  /* ---- ingestion --------------------------------------------------------- */
  function loadWorkbook(file) {
    state.fileName = file.name;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        // prefer a sheet named like the sell-out dump; else first sheet that parses
        let sheetName = wb.SheetNames.find(n => /sell.?out/i.test(n)) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        const parsed = A.parseRecords(aoa);
        state.records = parsed.records;
        state.optionalDims = parsed.availableOptionalDims;
        state.foundFields = parsed.foundFields;
        state.analyses = parsed.analyses;
        updateHeaderStats();
        updateProjectStatus();
        renderAnalysisGuide();
        updateTabsAvailability();
        buildFilterUI();
        recomputeAndRender();
        const readyCount = state.analyses.filter(a => a.ready).length;
        const supportedOthers = state.analyses.filter(a => a.ready && a.id !== state.selectedAnalysis).length;
        const primary = selectedMeta();
        $('status').textContent =
          `Loaded ${state.records.length.toLocaleString()} rows from "${file.name}" · sheet "${sheetName}"`
          + ` · ${readyCount}/${state.analyses.length} analyses ready`
          + (primary ? ` · selected: ${primary.ready ? 'ready' : 'layer needed'}` : '')
          + (supportedOthers ? ` · also supports ${supportedOthers} other type${supportedOthers === 1 ? '' : 's'}` : '')
          + (state.optionalDims.length ? ` · extra dims: ${state.optionalDims.join(', ')}` : '');
      } catch (err) {
        $('status').textContent = 'Error reading workbook: ' + err.message;
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---- recompute pipeline ------------------------------------------------ */
  function activeFilters() {
    // turn checked sets into the structure applyFilters expects
    const f = {};
    for (const k in state.filters) if (state.filters[k] && state.filters[k].size) f[k] = state.filters[k];
    return f;
  }
  function recomputeAndRender() {
    state.enriched = A.enrich(state.records, state.params, state.themes);
    const rows = A.applyFilters(state.enriched, activeFilters());
    renderKPIs(rows);
    renderIntegrity(rows);
    renderLiquidation(rows);
    renderVelocity(rows);
    renderMomentum(rows);
    renderPromo(rows);
    renderThemeAuthoring(rows);
    renderGenericRead();
  }

  /* ---- filter UI --------------------------------------------------------- */
  function buildFilterUI() {
    const host = $('filters');
    host.innerHTML = '';
    state.filters = {};
    FILTER_DIMS.forEach(([field, label]) => {
      // 'theme' needs enrichment (authored values); raw dims read from records
      const vals = field === 'theme'
        ? A.distinct(A.enrich(state.records, state.params, state.themes), 'theme')
        : A.distinct(state.records, field);
      if (!vals.length) return;
      const det = el('details', { class: 'filter' });
      const sum = el('summary', null, `${label} <span class="cnt"></span>`);
      det.appendChild(sum);
      const box = el('div', { class: 'opts' });
      vals.forEach(v => {
        const id = `f_${field}_${btoa(unescape(encodeURIComponent(String(v)))).replace(/=/g,'')}`;
        const lab = el('label');
        const cb = el('input', { type: 'checkbox', value: String(v) });
        cb.addEventListener('change', () => {
          if (!state.filters[field]) state.filters[field] = new Set();
          if (cb.checked) state.filters[field].add(v); else state.filters[field].delete(v);
          sum.querySelector('.cnt').textContent =
            state.filters[field].size ? `(${state.filters[field].size})` : '';
          recomputeAndRender();
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(' ' + (field === 'brand' ? brandLabel(v) : v)));
        box.appendChild(lab);
      });
      det.appendChild(box);
      host.appendChild(det);
    });
  }

  /* ---- KPI strip --------------------------------------------------------- */
  function renderKPIs(rows) {
    const sale = rows.filter(r => r._validSale);
    const tyUnits = A.sum(sale, r => r.tyUnits);
    const tyRtl = A.sum(sale, r => r.tyRtl);
    const lyUnits = A.sum(rows.filter(r => r.lyUnits > 0), r => r.lyUnits);
    const dead = rows.filter(r => r._dead);
    const promo = A.promoAnalysis(rows, { groupBy: ['brand'] });
    const cards = [
      ['Rows in view', fmtInt(rows.length)],
      ['TY units (clean)', fmtInt(tyUnits)],
      ['TY retail (clean)', fmt$(tyRtl)],
      ['YoY units', lyUnits ? fmtPct(tyUnits / lyUnits - 1) : '–'],
      ['Dead-stock units', fmtInt(A.sum(dead, r => r.tyOH))],
      ['Promo unit share', fmtPct(promo.overall.promoUnitPct)],
    ];
    $('kpis').innerHTML = '';
    cards.forEach(([k, v]) => {
      const c = el('div', { class: 'kpi' });
      c.appendChild(el('div', { class: 'kpi-v' }, v));
      c.appendChild(el('div', { class: 'kpi-k' }, k));
      $('kpis').appendChild(c);
    });
  }

  /* ---- LENS 0: integrity ------------------------------------------------- */
  function renderIntegrity(rows) {
    const rep = A.integrityReport(rows);
    const host = $('lens-integrity'); host.innerHTML = '';
    if (renderRequirementNotice(host, 'integrity')) return;
    host.appendChild(el('p', null,
      `${fmtInt(rep.totalRows)} rows in view · ${fmtInt(rep.noTySale)} have no TY sell-out `
      + `(stock-only / inactive). Flags below are excluded from the metrics they would distort.`));
    const fl = rep.flags;
    const flagRows = [
      ['MSRP missing/zero', fl.msrp_invalid || 0, 'AUR, promo, markdown'],
      ['Negative units', fl.neg_units || 0, 'sales totals, velocity'],
      ['Negative retail $', fl.neg_retail || 0, 'AUR, promo'],
      ['Negative on-hand', fl.neg_oh || 0, 'inventory health'],
      ['ST% out of range (<0 or >1)', fl.st_out_of_range || 0, 'velocity matrix'],
      ['AUR above MSRP (>100%)', fl.aur_above_msrp || 0, 'promo penetration'],
    ].map(r => [r[0], fmtInt(r[1]), r[2]]);
    host.appendChild(table(['Integrity flag', 'Rows', 'Excluded from'], flagRows));
    const rc = rep.reconciliation;
    host.appendChild(el('h4', null, 'Reconciliation vs published Overview'));
    host.appendChild(table(['Metric', 'Raw (all rows)', 'Clean (valid sales)', 'Overview total'], [
      ['TY units', fmtInt(rc.rawUnits), fmtInt(rc.cleanUnits), fmtInt(rc.overviewUnits)],
      ['TY retail $', fmt$(rc.rawRtl), fmt$(rc.cleanRtl), fmt$(rc.overviewRtl)],
    ]));
    host.appendChild(el('p', { class: 'note' },
      'Note: the Overview totals reflect the full unfiltered dataset; apply no filters to reconcile exactly.'));
  }

  /* ---- LENS 1: liquidation ---------------------------------------------- */
  function renderLiquidation(rows) {
    const host = $('lens-liquidation'); host.innerHTML = '';
    if (renderRequirementNotice(host, 'liquidation')) return;
    const data = A.liquidationRadar(rows, { groupBy: ['brand', 'retailer'] });
    host.appendChild(el('p', null,
      'Liquidation candidates ranked by retail value tied up in dead stock '
      + '(on-hand units with zero TY sell-out, valued at MSRP). '
      + '“Cover” = total on-hand ÷ TY units sold.'));
    const top = data.filter(d => d.tiedRetail > 0).slice(0, 25).map(d => [
      d.group.split(' \u203a ').map((p, i) => i === 0 ? brandLabel(p) : p).join(' › '),
      fmtInt(d.deadRows), fmtInt(d.strandedUnits), fmt$(d.tiedRetail),
      fmtPct(d.deadOHShare), d.coverRatio == null ? '–' : d.coverRatio.toFixed(1),
    ]);
    host.appendChild(table(
      ['Brand › Retailer', 'Dead SKUs', 'Stranded units', 'Tied retail $', 'Dead % of OH', 'Cover'],
      top));
  }

  /* ---- LENS 2: velocity matrix ------------------------------------------ */
  function renderVelocity(rows) {
    const host = $('lens-velocity'); host.innerHTML = '';
    if (renderRequirementNotice(host, 'velocity')) return;
    const v = A.velocityMatrix(rows);
    host.appendChild(el('p', null,
      `${fmtInt(v.n)} selling SKU-rows classified on a median split `
      + `(ST% median ${fmtPct(v.stMed)}, volume median ${fmtInt(v.volMed)} units). `
      + `Quadrant = sell-through × volume.`));
    // 2x2 quadrant grid
    const grid = el('div', { class: 'quad-grid' });
    const cell = (name, desc) => {
      const c = el('div', { class: 'quad' });
      c.appendChild(el('div', { class: 'quad-n' }, fmtInt(v.counts[name])));
      c.appendChild(el('div', { class: 'quad-name' }, name));
      c.appendChild(el('div', { class: 'quad-rtl' }, fmt$(v.rtlByQuad[name]) + ' TY'));
      c.appendChild(el('div', { class: 'quad-desc' }, desc));
      return c;
    };
    grid.appendChild(cell('Sleeper', 'High ST, low volume → chase units'));
    grid.appendChild(cell('Star', 'High ST, high volume → protect stock'));
    grid.appendChild(cell('Dog', 'Low ST, low volume → exit'));
    grid.appendChild(cell('Slow-bleeder', 'Low ST, high volume → markdown risk'));
    host.appendChild(grid);
    // top sleepers worth chasing
    const sleepers = v.points.filter(p => p.quad === 'Sleeper')
      .sort((a, b) => b.st - a.st).slice(0, 15)
      .map(p => [brandLabel(p.brand), p.retailer, p.collection, p.material,
                 p.priceRange, fmtPct(p.st), fmtInt(p.units)]);
    host.appendChild(el('h4', null, 'Top Sleepers (chase candidates)'));
    host.appendChild(table(
      ['Brand', 'Retailer', 'Collection', 'Material', 'Price', 'ST%', 'TY units'], sleepers));
  }

  /* ---- LENS 3: momentum decomposition ----------------------------------- */
  function renderMomentum(rows) {
    const host = $('lens-momentum'); host.innerHTML = '';
    if (renderRequirementNotice(host, 'momentum')) return;
    const m = A.momentum(rows).filter(b => b.tyUnits > 0 || b.lyUnits > 0).slice(0, 30);
    host.appendChild(el('p', null,
      'YoY unit change decomposed per brand: New (collections with no LY sales) '
      + '− Dropped (LY collections gone this year) + Continuing (Δ on collections in both years).'));
    const rowsOut = m.map(b => [
      brandLabel(b.brand), fmtInt(b.tyUnits), fmtInt(b.lyUnits),
      (b.unitVar >= 0 ? '+' : '') + fmtInt(b.unitVar),
      b.unitVarPct == null ? '–' : fmtPct(b.unitVarPct),
      '+' + fmtInt(b.newGain), '−' + fmtInt(b.droppedLoss),
      (b.contDelta >= 0 ? '+' : '') + fmtInt(b.contDelta),
    ]);
    host.appendChild(table(
      ['Brand', 'TY units', 'LY units', 'Δ units', 'Δ %', 'New', 'Dropped', 'Continuing'], rowsOut));
  }

  /* ---- LENS 4: full-price vs promo -------------------------------------- */
  function renderPromo(rows) {
    const host = $('lens-promo'); host.innerHTML = '';
    if (renderRequirementNotice(host, 'promo')) return;
    const p = A.promoAnalysis(rows, { groupBy: ['brand'] });
    host.appendChild(el('p', null,
      `Promo = blended AUR more than ${fmtPct(state.params.promoThreshold)} below MSRP. `
      + `Because the data is YTD-aggregated, this is promo intensity per row, not a true unit split. `
      + `${fmtInt(p.validRows)} rows priced; ${fmtInt(p.aboveMsrpExcluded)} above-MSRP rows excluded. `
      + `Overall promo unit share: ${fmtPct(p.overall.promoUnitPct)}.`));
    const rowsOut = p.groups.filter(g => g.totalUnits > 0).slice(0, 30).map(g => [
      brandLabel(g.group), fmtInt(g.totalUnits),
      fmtPct(g.fullPriceUnitPct), fmtPct(g.promoUnitPct),
      fmtPct(g.promoRtlPct), fmtPct(g.medDiscountDepth),
      g.promoUnitPct > 0.30 ? '⚠ promo-dependent' : '',
    ]);
    host.appendChild(table(
      ['Brand', 'TY units', 'Full-price %', 'Promo %', 'Promo $ %', 'Med. discount', 'Flag'],
      rowsOut));
  }

  /* ---- Theme authoring --------------------------------------------------- *
   * For the current collection-material grain, themes are keyed on
   * CollectionRelease. When a UPC-grain re-pull lands, switch the key to UPC.
   */
  function renderThemeAuthoring(rows) {
    const host = $('lens-theme'); host.innerHTML = '';
    if (renderRequirementNotice(host, 'theme')) return;
    host.appendChild(el('p', null,
      'Assign a marketing theme to each collection. Themes persist in the snapshot '
      + 'and activate a “Theme” filter + breakdowns once authored. '
      + (state.optionalDims.includes('theme')
          ? 'A Theme column was detected in the file and takes precedence.'
          : 'No Theme column in the file yet — author below.')));
    const collections = A.distinct(rows, 'collection');
    const wrap = el('div', { class: 'theme-grid' });
    collections.forEach(col => {
      const row = el('div', { class: 'theme-row' });
      const colLabel = el('span', { class: 'theme-col' });
      colLabel.textContent = col;
      row.appendChild(colLabel);
      const inp = el('input', { type: 'text', placeholder: 'theme…', value: state.themes[col] || '' });
      inp.addEventListener('change', () => {
        const val = inp.value.trim();
        if (val) state.themes[col] = val; else delete state.themes[col];
        buildFilterUI();        // refresh theme filter options
        recomputeAndRender();
      });
      row.appendChild(inp);
      wrap.appendChild(row);
    });
    host.appendChild(wrap);
  }

  /* ---- snapshot (themes + params) for shared-drive persistence ----------- */
  function exportSnapshot() {
    const snap = {
      version: 1, tool: 'sell-through-diagnostic',
      exportedAt: new Date().toISOString(),
      sourceFile: state.fileName,
      params: state.params, themes: state.themes,
    };
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sell-through-snapshot.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importSnapshot(file) {
    const r = new FileReader();
    r.onload = e => {
      try {
        const snap = JSON.parse(e.target.result);
        if (snap.params) Object.assign(state.params, snap.params);
        if (snap.themes) state.themes = Object.assign({}, snap.themes);
        $('promoThresh').value = Math.round(state.params.promoThreshold * 100);
        $('agedYear').value = state.params.agedYear;
        updateHeaderStats();
        updateProjectStatus();
        renderAnalysisGuide();
        updateTabsAvailability();
        buildFilterUI();
        recomputeAndRender();
        $('status').textContent = `Snapshot loaded (${Object.keys(state.themes).length} themes).`;
      } catch (err) { $('status').textContent = 'Bad snapshot: ' + err.message; }
    };
    r.readAsText(file);
  }

  /* ---- wire up controls -------------------------------------------------- */
  function init() {
    populateProjectSelect();
    updateHeaderStats();
    selectAnalysis(state.selectedAnalysis, { renderGuide: false });
    renderAnalysisGuide();
    updateTabsAvailability();
    $('projectSelect')?.addEventListener('change', e => selectAnalysis(e.target.value));
    $('file').addEventListener('change', e => e.target.files[0] && loadWorkbook(e.target.files[0]));
    $('snapIn').addEventListener('change', e => e.target.files[0] && importSnapshot(e.target.files[0]));
    $('snapOut').addEventListener('click', exportSnapshot);
    $('promoThresh').addEventListener('change', e => {
      const v = parseFloat(e.target.value);
      state.params.promoThreshold = isFinite(v) ? v / 100 : 0.20;
      if (state.records.length) recomputeAndRender();
    });
    $('agedYear').addEventListener('change', e => {
      const v = parseInt(e.target.value, 10);
      state.params.agedYear = isFinite(v) ? v : 2020;
      if (state.records.length) recomputeAndRender();
    });
    // tab switching
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      selectAnalysis(lensId(t.dataset.target));
    }));
  }

  let themePending = 0;
  function applyTheme(next) {
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cloonk-theme', next); } catch (e) {}
  }
  function swapTheme(next) {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.add('theme-switching');
    themePending++;
    const settle = () => {
      if (--themePending <= 0) {
        themePending = 0;
        root.classList.remove('theme-switching');
      }
    };
    if (typeof document.startViewTransition === 'function' && !reduce) {
      document.startViewTransition(() => applyTheme(next)).finished.finally(settle);
    } else {
      applyTheme(next);
      requestAnimationFrame(() => requestAnimationFrame(settle));
    }
  }
  window.toggleTheme = function () {
    swapTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  };
  window.addEventListener('storage', e => {
    if (e.key === 'cloonk-theme') swapTheme(e.newValue === 'light' ? 'light' : 'dark');
  });

  document.addEventListener('DOMContentLoaded', init);
})();
