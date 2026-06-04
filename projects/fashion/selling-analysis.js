/* ============================================================================
   selling-analysis.js  —  Sell-Through Diagnostic engine
   Pure, side-effect-free computation. No DOM. Runs in browser or Node.
   ----------------------------------------------------------------------------
   Grain note: the current data dump is at
        Retailer x Location x Brand x CollectionRelease x Frame_Material x MSRP.
   This is ABOVE colorway. The schema below tolerates a future UPC-grain re-pull
   carrying upc / lensColor / frameColor / templeColor / style / theme — those
   dimensions activate automatically when their columns are present. Until then
   only what exists in the file is analyzed. Theme can also be authored client
   side (see selling-analysis-app.js) and is keyed on CollectionRelease for the current grain.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SOA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- canonical field <- source-header synonyms (normalized) ------------ */
  const FIELD_SYNONYMS = {
    retailer:       ['retailer'],
    location:       ['location'],
    brand:          ['brand'],
    door:           ['door', 'store', 'store number', 'door number', 'location id'],
    week:           ['week', 'week ending', 'week end', 'weekending', 'fiscal week', 'date'],
    collection:     ['collectionrelease', 'collection release', 'collection'],
    frameMaterial:  ['frame_material', 'frame material'],
    frameShape:     ['frame shape', 'frame_shape', 'shape', 'silhouette'],
    size:           ['size', 'eye size', 'frame size'],
    msrp:           ['msrp'],
    buyUnits:       ['buy units', 'bought units', 'ordered units', 'receipt units', 'receipts units', 'purchased units'],
    tyUnits:        ['ty ytd units sls', 'ty ytd units', 'ty ytd unit sales', 'ty units sls', 'ty units'],
    tyRtl:          ['ty ytd rtl sls', 'ty ytd retail sales', 'ty ytd dollar sales', 'ty ytd dollars', 'ty rtl sls', 'ty retail'],
    tyOH:           ['ty wtd units oh', 'ty wtd oh units', 'ty wtd on hand', 'ty units oh', 'ty oh units', 'ty oh'],
    tyST:           ['ty ytd st%', 'ty ytd st', 'ty ytd sell through', 'ty st%', 'ty st'],
    lyUnits:        ['ly ytd units sls', 'ly ytd units', 'ly ytd unit sales', 'ly units sls', 'ly units'],
    lyRtl:          ['ly ytd rtl sls', 'ly ytd retail sales', 'ly ytd dollar sales', 'ly ytd dollars', 'ly rtl sls', 'ly retail'],
    lyOH:           ['ly wtd units oh', 'ly wtd oh units', 'ly wtd on hand', 'ly units oh', 'ly oh units', 'ly oh'],
    lyST:           ['ly ytd st%', 'ly ytd st', 'ly ytd sell through', 'ly st%', 'ly st'],
    newness:        ['newness'],
    brandCategory:  ['brand category'],
    materialCode:   ['material code'],
    priceRange:     ['price range'],
    // ---- optional, activate on a UPC-grain re-pull -----------------------
    upc:            ['upc'],
    style:          ['style', 'style number', 'model'],
    lensColor:      ['lens color', 'lens_color', 'lenscolor'],
    frameColor:     ['frame color', 'frame_color', 'framecolor', 'front color'],
    templeColor:    ['temple color', 'temple_color', 'templecolor'],
    theme:          ['theme', 'marketing theme', 'campaign'],
    transactionId:  ['transaction id', 'transaction', 'basket id', 'order id', 'receipt id'],
    margin:         ['margin', 'gross margin', 'gm$', 'gross margin $', 'profit'],
    doorCount:      ['door count', 'doors', 'num doors', 'store count'],
  };
  const NUMERIC_FIELDS = ['msrp', 'buyUnits', 'tyUnits', 'tyRtl', 'tyOH', 'tyST',
                          'lyUnits', 'lyRtl', 'lyOH', 'lyST', 'margin', 'doorCount'];
  // optional fields that, when present as columns, become extra dimensions
  const OPTIONAL_DIMS = ['upc', 'style', 'lensColor', 'frameColor',
                         'templeColor', 'theme', 'frameShape'];
  const FIELD_LABELS = {
    retailer: 'Retailer',
    location: 'Location',
    brand: 'Brand',
    door: 'Door / Store',
    week: 'Week / Date',
    collection: 'Collection Release',
    frameMaterial: 'Frame Material',
    frameShape: 'Frame Shape',
    size: 'Size',
    msrp: 'MSRP',
    buyUnits: 'Buy Units',
    tyUnits: 'TY Units Sold',
    tyRtl: 'TY Retail Sales',
    tyOH: 'TY On Hand',
    tyST: 'TY Sell-Through %',
    lyUnits: 'LY Units Sold',
    lyRtl: 'LY Retail Sales',
    lyOH: 'LY On Hand',
    lyST: 'LY Sell-Through %',
    newness: 'Newness',
    brandCategory: 'Brand Category',
    materialCode: 'Material Code',
    priceRange: 'Price Range',
    upc: 'UPC',
    style: 'Style',
    lensColor: 'Lens Color',
    frameColor: 'Frame Color',
    templeColor: 'Temple Color',
    theme: 'Theme',
    transactionId: 'Transaction / Basket ID',
    margin: 'Margin',
    doorCount: 'Door Count',
  };
  const ANALYSES = [
    {
      id: 'integrity',
      name: 'Data Integrity',
      priority: 1,
      question: 'Can this report be trusted before any merchandising read?',
      required: ['brand', 'retailer'],
      metrics: ['msrp', 'tyUnits', 'tyRtl', 'tyOH', 'tyST'],
    },
    {
      id: 'liquidation',
      name: 'Liquidation Radar',
      priority: 2,
      question: 'Where is inventory tied up with little or no current sell-out?',
      required: ['brand', 'retailer', 'tyOH', 'tyUnits', 'msrp'],
      metrics: ['tyOH', 'tyUnits', 'msrp'],
    },
    {
      id: 'velocity',
      name: 'Velocity Matrix',
      priority: 3,
      question: 'Which items are high sell-through / low volume sleepers versus slow movers?',
      required: ['brand', 'retailer', 'tyST', 'tyUnits'],
      metrics: ['tyST', 'tyUnits', 'tyRtl'],
    },
    {
      id: 'momentum',
      name: 'YoY Momentum',
      priority: 4,
      question: 'Is growth coming from newness, continuing business, or lost collections?',
      required: ['brand', 'collection', 'tyUnits', 'lyUnits'],
      metrics: ['tyUnits', 'lyUnits'],
    },
    {
      id: 'promo',
      name: 'Full-Price vs Promo',
      priority: 5,
      question: 'How dependent is sell-out on markdown depth versus full-price demand?',
      required: ['brand', 'msrp', 'tyUnits', 'tyRtl'],
      metrics: ['msrp', 'tyUnits', 'tyRtl'],
    },
    {
      id: 'productivity',
      name: 'Assortment Productivity',
      priority: 6,
      question: 'Which brands, collections, materials, price bands, or retailers earn their space?',
      required: ['brand', 'tyUnits'],
      metrics: ['tyUnits', 'tyRtl', 'tyOH', 'upc', 'style', 'retailer', 'doorCount'],
    },
    {
      id: 'sizeCurve',
      name: 'Size Curve Analyzer',
      priority: 7,
      question: 'Where does size demand differ from the buy curve or on-hand curve?',
      required: ['size', 'tyUnits'],
      metrics: ['size', 'tyUnits', 'tyOH', 'buyUnits'],
    },
    {
      id: 'doorClustering',
      name: 'Door Clustering',
      priority: 8,
      question: 'Which stores behave alike by mix, price tier, material preference, or velocity?',
      required: ['door', 'brand', 'tyUnits'],
      metrics: ['door', 'brand', 'priceRange', 'materialCode', 'tyUnits', 'tyST'],
    },
    {
      id: 'markdownSensitivity',
      name: 'Markdown Sensitivity',
      priority: 9,
      question: 'How much do units or sell-through respond to discount depth?',
      required: ['msrp', 'tyUnits', 'tyRtl'],
      metrics: ['msrp', 'tyUnits', 'tyRtl', 'tyST', 'brandCategory'],
    },
    {
      id: 'exitPlanner',
      name: 'Inventory Aging & Exit Planner',
      priority: 10,
      question: 'Which old or slow inventory should exit first?',
      required: ['collection', 'tyOH', 'tyUnits', 'msrp'],
      metrics: ['collection', 'tyOH', 'tyUnits', 'tyST', 'msrp', 'lyUnits'],
    },
    {
      id: 'forecasting',
      name: 'Demand Forecasting Lite',
      priority: 11,
      question: 'What will sell over the next 4-13 weeks, and where is stockout risk?',
      required: ['week', 'tyUnits'],
      metrics: ['week', 'tyUnits', 'tyOH', 'style', 'upc', 'door'],
    },
    {
      id: 'anomalyDetection',
      name: 'Anomaly Detection',
      priority: 12,
      question: 'Which rows look weird enough to inspect before trusting the file?',
      required: ['brand'],
      metrics: ['tyUnits', 'tyRtl', 'tyOH', 'tyST', 'msrp', 'retailer', 'collection'],
    },
    {
      id: 'retailerScorecard',
      name: 'Retailer Scorecard',
      priority: 13,
      question: 'How do retailers compare across mix, productivity, promo, growth, and inventory health?',
      required: ['retailer', 'brand', 'tyUnits'],
      metrics: ['retailer', 'brand', 'tyUnits', 'tyRtl', 'tyOH', 'tyST', 'lyUnits', 'msrp'],
    },
    {
      id: 'collectionLifecycle',
      name: 'Collection Lifecycle',
      priority: 14,
      question: 'Where is each collection in its launch, maturity, decay, or exit curve?',
      required: ['collection', 'tyUnits'],
      metrics: ['collection', 'tyUnits', 'lyUnits', 'tyOH', 'tyST', 'week'],
    },
    {
      id: 'priceArchitecture',
      name: 'Price Architecture',
      priority: 15,
      question: 'Which price tiers are overloaded, missing, or underperforming?',
      required: ['priceRange', 'tyUnits'],
      metrics: ['priceRange', 'msrp', 'tyUnits', 'tyRtl', 'tyOH', 'brand'],
    },
    {
      id: 'marketBasket',
      name: 'Market Basket / Co-Performance',
      priority: 16,
      question: 'Which brands tend to appear together — in the same basket, or the same door?',
      // A real basket id is ideal but rare on the sell-out grain; brand + any shared
      // dimension (door / location / retailer) is enough to build a co-presence network.
      required: ['brand', 'retailer'],
      metrics: ['transactionId', 'door', 'location', 'collection', 'brand', 'style', 'upc', 'tyUnits', 'week'],
    },
    {
      id: 'cannibalization',
      name: 'Cannibalization Detector',
      priority: 17,
      question: 'Which new products may be taking demand from similar older products?',
      required: ['collection', 'brand', 'tyUnits', 'lyUnits'],
      metrics: ['collection', 'brand', 'tyUnits', 'lyUnits', 'materialCode', 'priceRange', 'style'],
    },
    {
      id: 'whitespace',
      name: 'Whitespace Finder',
      priority: 18,
      question: 'Where are high-performing attributes missing or under-stocked elsewhere?',
      required: ['retailer', 'brand', 'tyUnits'],
      metrics: ['retailer', 'brand', 'tyUnits', 'tyOH', 'materialCode', 'priceRange', 'door'],
    },
    {
      id: 'replenishment',
      name: 'Replenishment Prioritizer',
      priority: 19,
      question: 'Which SKUs deserve chase or replenishment first?',
      required: ['tyUnits', 'tyOH'],
      metrics: ['upc', 'style', 'tyUnits', 'tyOH', 'tyST', 'margin', 'doorCount', 'msrp'],
    },
    {
      id: 'scenarioPlanner',
      name: 'Scenario Planner',
      priority: 20,
      question: 'What could happen if we mark down, replenish, or exit selected inventory?',
      required: ['tyUnits', 'tyOH', 'msrp'],
      metrics: ['tyUnits', 'tyOH', 'msrp', 'tyRtl', 'margin', 'tyST'],
    },
    {
      id: 'theme',
      name: 'Theme Authoring',
      priority: 21,
      question: 'Can collections be grouped into marketing themes for later reads?',
      required: ['collection'],
      metrics: ['collection', 'theme'],
    },
    {
      id: 'attributeDrivers',
      name: 'Attribute Drivers',
      priority: 22,
      question: 'Which product attributes — shape, material, colour, size, price tier — actually drive performance?',
      required: ['brand', 'tyUnits'],
      metrics: ['tyST', 'tyUnits', 'frameShape', 'frameMaterial', 'materialCode', 'lensColor',
        'frameColor', 'templeColor', 'size', 'priceRange', 'brandCategory', 'brand'],
    },
    {
      id: 'seasonality',
      name: 'Seasonality & Timing',
      priority: 23,
      question: 'How does demand move with the calendar, and how consistent is that pattern year to year?',
      required: ['week', 'tyUnits'],
      metrics: ['week', 'tyUnits', 'tyST'],
    },
    {
      id: 'priceElasticity',
      name: 'Price Elasticity',
      priority: 24,
      question: 'How sensitive are units to price (AUR), and is premium pricing actually realized vs MSRP?',
      required: ['msrp', 'tyUnits', 'tyRtl'],
      metrics: ['msrp', 'tyUnits', 'tyRtl', 'tyST', 'brand', 'priceRange'],
    },
  ];

  const norm = s => String(s == null ? '' : s)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const n = parseFloat(String(v).replace(/[, $%]/g, ''));
    return isFinite(n) ? n : null;
  }

  function headerValue(row, idx) {
    return norm(row && row[idx]);
  }

  function carryForwardHeaders(row) {
    const out = [];
    let last = '';
    const len = row ? row.length : 0;
    for (let i = 0; i < len; i++) {
      const v = headerValue(row, i);
      if (v) last = v;
      out[i] = last;
    }
    return out;
  }

  function compactHeader(parts) {
    const seen = new Set();
    return parts
      .map(norm)
      .filter(Boolean)
      .filter(part => {
        if (seen.has(part)) return false;
        seen.add(part);
        return true;
      })
      .join(' ');
  }

  function headerCandidates(aoa, headerRow) {
    const leaf = aoa[headerRow] || [];
    const clusterRows = [];
    for (let r = Math.max(0, headerRow - 3); r < headerRow; r++) {
      const carried = carryForwardHeaders(aoa[r]);
      if (carried.some(Boolean)) clusterRows.push(carried);
    }
    return leaf.map((raw, idx) => {
      const leafText = headerValue(leaf, idx);
      const clusters = clusterRows
        .map(row => row[idx])
        .filter(Boolean);
      const clusterText = compactHeader(clusters);
      return [
        leafText,
        compactHeader([clusterText, leafText]),
        compactHeader([leafText, clusterText]),
      ].filter(Boolean);
    });
  }

  function fieldLabel(field) {
    return FIELD_LABELS[field] || field;
  }

  function evaluateAnalyses(map) {
    const found = Object.keys(map || {});
    const foundSet = new Set(found);
    return ANALYSES.map(analysis => {
      const missing = analysis.required.filter(field => !foundSet.has(field));
      const availableMetrics = analysis.metrics.filter(field => foundSet.has(field));
      const missingMetrics = analysis.metrics.filter(field => !foundSet.has(field));
      return {
        id: analysis.id,
        name: analysis.name,
        priority: analysis.priority,
        question: analysis.question,
        required: analysis.required.slice(),
        metrics: analysis.metrics.slice(),
        availableMetrics,
        missing,
        missingMetrics,
        ready: missing.length === 0,
      };
    }).sort((a, b) => a.priority - b.priority);
  }

  /* ---- locate header row + map columns ----------------------------------- */
  function buildColumnMap(aoa) {
    let best = { headerRow: -1, map: {}, headers: [], headerCandidates: [], score: 0 };
    for (let i = 0; i < Math.min(aoa.length, 25); i++) {
      const headers = (aoa[i] || []).map(norm);
      const candidates = headerCandidates(aoa, i);
      const map = {};
      for (const field in FIELD_SYNONYMS) {
        const syns = FIELD_SYNONYMS[field];
        const idx = candidates.findIndex(candidates => candidates.some(h => syns.includes(h)));
        if (idx >= 0) map[field] = idx;
      }
      const fields = Object.keys(map);
      const hasIdentity = fields.some(field => !NUMERIC_FIELDS.includes(field));
      const hasMetric = fields.some(field => NUMERIC_FIELDS.includes(field));
      const score = fields.length + (hasIdentity ? 2 : 0) + (hasMetric ? 2 : 0);
      if (score > best.score) best = { headerRow: i, map, headers, headerCandidates: candidates, score };
    }
    const matched = Object.keys(best.map);
    const hasEnough = matched.length >= 2 && matched.some(field => !NUMERIC_FIELDS.includes(field));
    if (!hasEnough) {
      throw new Error('Could not locate a usable header row. Need at least one recognized dimension and one metric or attribute.');
    }
    return {
      headerRow: best.headerRow,
      map: best.map,
      headers: best.headers,
      headerCandidates: best.headerCandidates,
    };
  }

  /* ---- aoa -> canonical records ------------------------------------------ */
  function parseRecords(aoa) {
    const { headerRow, map, headers, headerCandidates } = buildColumnMap(aoa);
    const records = [];
    for (let i = headerRow + 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row) continue;
      const rec = {};
      let allEmpty = true;
      for (const field in map) {
        let v = row[map[field]];
        if (NUMERIC_FIELDS.includes(field)) v = num(v);
        else v = (v == null || v === '') ? null : String(v).trim();
        rec[field] = v;
        if (v != null && v !== '') allEmpty = false;
      }
      // Keep any row that has mapped data; each analysis decides if it has
      // enough dimensions/metrics to run.
      if (allEmpty) continue;
      records.push(rec);
    }
    const availableOptionalDims = OPTIONAL_DIMS.filter(d => d in map);
    return {
      records,
      columnMap: map,
      headers,
      headerCandidates,
      foundFields: Object.keys(map),
      analyses: evaluateAnalyses(map),
      availableOptionalDims,
    };
  }

  /* ---- price band from a sticker price, given sorted band edges ---------- *
   * edges [100,150,200,250,300] → "$0-99" "$100-149" … "$250-299" "$300+".   */
  function priceBandLabel(m, edges) {
    if (m == null || !(m > 0)) return null;
    const e = (edges && edges.length) ? edges : [100, 150, 200, 250, 300];
    if (m < e[0]) return '$0-' + (e[0] - 1);
    for (let i = 1; i < e.length; i++) if (m < e[i]) return '$' + e[i - 1] + '-' + (e[i] - 1);
    return '$' + e[e.length - 1] + '+';
  }

  /* ---- per-row enrichment ------------------------------------------------ *
   * params: { promoThreshold (0..1, fraction OFF msrp), agedYear,
   *           priceBands [edges], priceBandSource 'auto'|'msrp'|'column' }
   * themes: { [collectionRelease]: themeString }  (authored client-side)
   */
  function enrich(records, params, themes) {
    const p = Object.assign({
      promoThreshold: 0.20, agedYear: 2020,
      priceBands: [100, 150, 200, 250, 300], priceBandSource: 'auto',
    }, params || {});
    const th = themes || {};
    const edges = (p.priceBands && p.priceBands.length)
      ? p.priceBands.slice().filter(n => typeof n === 'number' && isFinite(n) && n > 0).sort((a, b) => a - b)
      : [100, 150, 200, 250, 300];
    const src = p.priceBandSource || 'auto';   // 'auto' | 'msrp' | 'column'
    return records.map(r => {
      const e = Object.assign({}, r);

      const u = e.tyUnits, rtl = e.tyRtl, oh = e.tyOH, msrp = e.msrp;

      // ---- price band: keep the file's column, or derive bands from MSRP ----
      // 'auto'   → use the Price Range column when present, else derive from MSRP
      // 'msrp'   → always derive from MSRP (override any column)
      // 'column' → only ever use the file's Price Range column
      const colBand = (e.priceRange != null && e.priceRange !== '') ? e.priceRange : null;
      const msrpBand = priceBandLabel(msrp, edges);
      e.priceRange = src === 'msrp' ? (msrpBand || colBand)
        : src === 'column' ? colBand
        : (colBand || msrpBand);   // auto

      e.aur      = (u != null && u > 0 && rtl != null) ? rtl / u : null;
      e.aurRatio = (e.aur != null && msrp != null && msrp > 0) ? e.aur / msrp : null;
      e.promoIndex = (e.aurRatio != null) ? 1 - e.aurRatio : null;        // depth off MSRP

      // release vintage
      const ym = e.collection ? String(e.collection).match(/(\d{4})/) : null;
      e.relYear = ym ? parseInt(ym[1], 10) : null;

      // YoY unit variance
      e.unitVar = (e.tyUnits != null || e.lyUnits != null)
        ? (e.tyUnits || 0) - (e.lyUnits || 0) : null;

      // ---- integrity flags (a row may trip several) ----------------------
      e._flags = [];
      if (msrp == null || msrp <= 0)          e._flags.push('msrp_invalid');
      if (u != null && u < 0)                 e._flags.push('neg_units');
      if (rtl != null && rtl < 0)             e._flags.push('neg_retail');
      if (oh != null && oh < 0)               e._flags.push('neg_oh');
      if (e.tyST != null && (e.tyST > 1 || e.tyST < 0)) e._flags.push('st_out_of_range');
      if (e.aurRatio != null && e.aurRatio > 1.0) e._flags.push('aur_above_msrp');

      // ---- usability gates for each kind of metric -----------------------
      e._validSale = (u != null && u > 0 && rtl != null && rtl > 0);
      e._validAUR  = (e._validSale && msrp > 0 && e.aurRatio != null && e.aurRatio <= 1.0);

      // ---- promo classification (only meaningful where AUR is valid) ------
      e.isPromo = e._validAUR ? (e.aurRatio < (1 - p.promoThreshold)) : null;

      // ---- inventory health ----------------------------------------------
      e._hasOH = (oh != null && oh > 0);
      e._dead  = e._hasOH && (u == null || u <= 0);                       // stock, no TY sell
      e._aged  = e._hasOH && e.relYear != null && e.relYear < p.agedYear; // old vintage on book
      e._cover = (e._hasOH && u != null && u > 0) ? oh / u : null;        // OH-to-sales cover

      // ---- theme (authored, keyed on collection for current grain) -------
      if (e.theme == null && e.collection != null && th[e.collection]) e.theme = th[e.collection];

      return e;
    });
  }

  /* ---- generic helpers --------------------------------------------------- */
  function groupBy(rows, keyFn) {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  }
  const sum = (rows, f) => rows.reduce((a, r) => { const v = f(r); return a + (v == null ? 0 : v); }, 0);
  function median(arr) {
    const a = arr.filter(x => x != null).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /* ---- distinct values for a dimension (for filter controls) ------------- */
  function distinct(rows, field) {
    const s = new Set();
    for (const r of rows) if (r[field] != null && r[field] !== '') s.add(r[field]);
    return Array.from(s).sort();
  }

  /* ---- apply global filters --------------------------------------------- *
   * filters: { field: Set<value> | array } ; relYear: {min,max}
   */
  function applyFilters(rows, filters) {
    const f = filters || {};
    return rows.filter(r => {
      for (const field in f) {
        if (field === 'relYear') {
          const { min, max } = f.relYear || {};
          if (min != null && (r.relYear == null || r.relYear < min)) return false;
          if (max != null && (r.relYear == null || r.relYear > max)) return false;
          continue;
        }
        const allowed = f[field];
        if (!allowed) continue;
        const set = allowed instanceof Set ? allowed : new Set(allowed);
        if (set.size === 0) continue;        // empty = no filter
        if (!set.has(r[field])) return false;
      }
      return true;
    });
  }

  /* ======================================================================= *
   *  LENS 0 — Data Integrity
   * ======================================================================= */
  function integrityReport(rows) {
    const tally = {};
    const bump = k => tally[k] = (tally[k] || 0) + 1;
    let noTySale = 0;
    for (const r of rows) {
      if (!(r.tyUnits != null && r.tyUnits > 0)) noTySale++;
      r._flags.forEach(bump);
    }
    // reconciliation back to source totals
    const rawUnits = sum(rows, r => r.tyUnits);
    const rawRtl   = sum(rows, r => r.tyRtl);
    const cleanUnits = sum(rows.filter(r => r._validSale), r => r.tyUnits);
    const cleanRtl   = sum(rows.filter(r => r._validSale), r => r.tyRtl);
    return {
      totalRows: rows.length,
      noTySale,
      flags: tally,
      reconciliation: {
        rawUnits, rawRtl, cleanUnits, cleanRtl,
        // published Overview grand totals for eyeball check
        overviewUnits: 92228, overviewRtl: 25702661.95,
      },
    };
  }

  /* ======================================================================= *
   *  LENS 1 — Liquidation Radar (inventory health)
   * ======================================================================= */
  function liquidationRadar(rows, opts) {
    const groupKeys = (opts && opts.groupBy) || ['brand', 'retailer'];
    const key = r => groupKeys.map(k => r[k] == null ? '—' : r[k]).join(' \u203a ');
    const g = groupBy(rows, key);
    const out = [];
    g.forEach((rs, k) => {
      const dead = rs.filter(r => r._dead);
      const aged = rs.filter(r => r._aged);
      const strandedUnits = sum(dead, r => r.tyOH);
      const tiedRetail    = sum(dead, r => (r.tyOH || 0) * (r.msrp || 0)); // value-at-sticker proxy
      const totalOH       = sum(rs, r => r.tyOH);
      const tyUnits       = sum(rs, r => (r.tyUnits != null && r.tyUnits > 0) ? r.tyUnits : 0);
      out.push({
        group: k,
        skuRows: rs.length,
        deadRows: dead.length,
        agedRows: aged.length,
        strandedUnits,
        tiedRetail,
        totalOH,
        deadOHShare: totalOH ? strandedUnits / totalOH : null,
        coverRatio: tyUnits ? totalOH / tyUnits : null,
      });
    });
    out.sort((a, b) => b.tiedRetail - a.tiedRetail);
    return out;
  }

  /* ======================================================================= *
   *  LENS 2 — Velocity Matrix (ST% x volume quadrants)
   * ======================================================================= */
  function velocityMatrix(rows) {
    const valid = rows.filter(r => r._validSale && r.tyST != null && r.tyST >= 0 && r.tyST <= 1);
    const stMed = median(valid.map(r => r.tyST));
    const volMed = median(valid.map(r => r.tyUnits));
    const classify = r => {
      const hiST = r.tyST >= stMed, hiVol = r.tyUnits >= volMed;
      if (hiST && hiVol) return 'Star';
      if (hiST && !hiVol) return 'Sleeper';      // sells fast, low volume -> chase units
      if (!hiST && hiVol) return 'Slow-bleeder';  // big inventory, soft sell-through
      return 'Dog';
    };
    const points = valid.map(r => ({
      brand: r.brand, retailer: r.retailer, collection: r.collection,
      material: r.materialCode, priceRange: r.priceRange,
      st: r.tyST, units: r.tyUnits, rtl: r.tyRtl,
      quad: classify(r),
    }));
    const counts = { Star: 0, Sleeper: 0, 'Slow-bleeder': 0, Dog: 0 };
    const rtlByQuad = { Star: 0, Sleeper: 0, 'Slow-bleeder': 0, Dog: 0 };
    points.forEach(p => { counts[p.quad]++; rtlByQuad[p.quad] += p.rtl || 0; });
    return { stMed, volMed, points, counts, rtlByQuad, n: valid.length };
  }

  /* ======================================================================= *
   *  LENS 3 — YoY Momentum Decomposition (per brand waterfall)
   *  var = new-collection gains  -  dropped-collection losses  +  continuing delta
   * ======================================================================= */
  function momentum(rows) {
    const byBrand = groupBy(rows, r => r.brand);
    const out = [];
    byBrand.forEach((rs, brand) => {
      const byCol = groupBy(rs, r => r.collection || '—');
      let newGain = 0, droppedLoss = 0, contDelta = 0, ty = 0, ly = 0;
      byCol.forEach(crs => {
        const t = sum(crs, r => (r.tyUnits != null && r.tyUnits > 0) ? r.tyUnits : 0);
        const l = sum(crs, r => (r.lyUnits != null && r.lyUnits > 0) ? r.lyUnits : 0);
        ty += t; ly += l;
        if (l === 0 && t > 0) newGain += t;
        else if (t === 0 && l > 0) droppedLoss += l;
        else contDelta += (t - l);
      });
      out.push({
        brand, tyUnits: ty, lyUnits: ly, unitVar: ty - ly,
        unitVarPct: ly ? (ty - ly) / ly : null,
        newGain, droppedLoss, contDelta,
      });
    });
    out.sort((a, b) => b.tyUnits - a.tyUnits);
    return out;
  }

  /* ======================================================================= *
   *  LENS 4 — Full-Price vs Promo
   *  Promo = blended AUR more than `promoThreshold` below MSRP.
   *  Because data is YTD-aggregated, this is promo *intensity per row*, not a
   *  clean unit-level full/promo split. Reported as penetration accordingly.
   * ======================================================================= */
  function promoAnalysis(rows, opts) {
    const groupKeys = (opts && opts.groupBy) || ['brand'];
    const valid = rows.filter(r => r._validAUR);          // excludes above-MSRP + bad rows
    const aboveMsrp = rows.filter(r => r._flags.includes('aur_above_msrp')).length;

    const key = r => groupKeys.map(k => r[k] == null ? '—' : r[k]).join(' \u203a ');
    const g = groupBy(valid, key);
    const rowsOut = [];
    g.forEach((rs, k) => {
      const promoRows = rs.filter(r => r.isPromo);
      const promoUnits = sum(promoRows, r => r.tyUnits);
      const totalUnits = sum(rs, r => r.tyUnits);
      const promoRtl   = sum(promoRows, r => r.tyRtl);
      const totalRtl   = sum(rs, r => r.tyRtl);
      const avgDepth   = median(rs.map(r => r.promoIndex));
      rowsOut.push({
        group: k,
        rows: rs.length,
        totalUnits, promoUnits,
        promoUnitPct: totalUnits ? promoUnits / totalUnits : null,
        fullPriceUnitPct: totalUnits ? 1 - promoUnits / totalUnits : null,
        promoRtlPct: totalRtl ? promoRtl / totalRtl : null,
        medDiscountDepth: avgDepth,
      });
    });
    rowsOut.sort((a, b) => (b.promoUnitPct || 0) - (a.promoUnitPct || 0));

    // overall
    const promoUnitsAll = sum(valid.filter(r => r.isPromo), r => r.tyUnits);
    const unitsAll = sum(valid, r => r.tyUnits);
    return {
      groups: rowsOut,
      validRows: valid.length,
      aboveMsrpExcluded: aboveMsrp,
      overall: {
        promoUnitPct: unitsAll ? promoUnitsAll / unitsAll : null,
        units: unitsAll, promoUnits: promoUnitsAll,
      },
    };
  }

  /* ---- stats helpers (for the extended reads) ---------------------------- */
  function mean(arr) { const a = arr.filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
  function stdev(arr) {
    const a = arr.filter(x => x != null);
    if (a.length < 2) return 0;
    const m = a.reduce((s, x) => s + x, 0) / a.length;
    return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
  }
  function linreg(pts) {
    const n = pts.length;
    if (n < 2) return { slope: 0, intercept: n ? pts[0][1] : 0 };
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(([x, y]) => { sx += x; sy += y; sxx += x * x; sxy += x * y; });
    const d = n * sxx - sx * sx;
    const slope = d ? (n * sxy - sx * sy) / d : 0;
    return { slope, intercept: (sy - slope * sx) / n };
  }
  const parseLow = s => { const m = String(s).match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };

  /* ======================================================================= *
   *  LENS 5 — Assortment Productivity
   * ======================================================================= */
  function assortmentProductivity(rows, opts) {
    const dim = (opts && opts.groupBy) || 'brand';
    const g = groupBy(rows, r => (r[dim] == null || r[dim] === '') ? '—' : r[dim]);
    const out = [];
    g.forEach((rs, k) => {
      const valid = rs.filter(r => r._validSale);
      const rtl = sum(valid, r => r.tyRtl), units = sum(valid, r => r.tyUnits), oh = sum(rs, r => r.tyOH);
      out.push({
        key: k, skus: rs.length, units, rtl, oh,
        rtlPerSku: rs.length ? rtl / rs.length : 0,
        cover: units ? oh / units : null,
        stProxy: (units + oh) ? units / (units + oh) : null,
      });
    });
    out.sort((a, b) => b.rtl - a.rtl);
    return out;
  }

  /* ======================================================================= *
   *  LENS 6 — Size Curve
   * ======================================================================= */
  function sizeCurveAnalysis(rows) {
    const g = groupBy(rows.filter(r => r.size != null && r.size !== ''), r => r.size);
    const out = [];
    g.forEach((rs, k) => out.push({
      size: String(k),
      units: sum(rs, r => (r.tyUnits > 0 ? r.tyUnits : 0)),
      oh: sum(rs, r => r.tyOH),
      buy: sum(rs, r => r.buyUnits),
    }));
    out.sort((a, b) => parseLow(a.size) - parseLow(b.size));
    const tU = sum(out, o => o.units) || 1, tO = sum(out, o => o.oh) || 1, tB = sum(out, o => o.buy);
    out.forEach(o => { o.sellShare = o.units / tU; o.ohShare = o.oh / tO; o.buyShare = tB ? o.buy / tB : null; });
    return out;
  }

  /* ======================================================================= *
   *  LENS 7 — Price Architecture
   * ======================================================================= */
  function priceArchitectureAnalysis(rows) {
    const g = groupBy(rows.filter(r => r.priceRange != null && r.priceRange !== ''), r => r.priceRange);
    const out = [];
    g.forEach((rs, k) => {
      const valid = rs.filter(r => r._validSale);
      const units = sum(valid, r => r.tyUnits), rtl = sum(valid, r => r.tyRtl);
      out.push({ band: String(k), skus: rs.length, units, rtl, oh: sum(rs, r => r.tyOH), aur: units ? rtl / units : null });
    });
    out.sort((a, b) => parseLow(a.band) - parseLow(b.band));
    return out;
  }

  /* ======================================================================= *
   *  LENS 8 — Inventory Aging & Exit
   * ======================================================================= */
  function inventoryAging(rows) {
    const g = groupBy(rows.filter(r => r._hasOH), r => r.relYear != null ? String(r.relYear) : 'Unknown');
    const out = [];
    g.forEach((rs, k) => out.push({
      year: k, oh: sum(rs, r => r.tyOH),
      tiedRetail: sum(rs, r => (r.tyOH || 0) * (r.msrp || 0)),
      dead: rs.filter(r => r._dead).length, skus: rs.length,
    }));
    out.sort((a, b) => (a.year === 'Unknown' ? 9999 : parseInt(a.year, 10)) - (b.year === 'Unknown' ? 9999 : parseInt(b.year, 10)));
    return out;
  }

  /* ======================================================================= *
   *  LENS 9 — Markdown Sensitivity
   * ======================================================================= */
  function markdownSensitivityAnalysis(rows, nb) {
    nb = nb || 8;
    const valid = rows.filter(r => r._validAUR && r.promoIndex != null && r.promoIndex >= 0);
    const buckets = [];
    for (let i = 0; i < nb; i++) buckets.push({ lo: i / nb, hi: (i + 1) / nb, units: 0, rows: 0, stSum: 0, stN: 0 });
    valid.forEach(r => {
      const d = Math.max(0, Math.min(0.999, r.promoIndex));
      const b = buckets[Math.floor(d * nb)];
      b.units += r.tyUnits > 0 ? r.tyUnits : 0; b.rows++;
      if (r.tyST != null) { b.stSum += r.tyST; b.stN++; }
    });
    buckets.forEach(b => { b.depth = (b.lo + b.hi) / 2; b.avgUnits = b.rows ? b.units / b.rows : 0; b.avgST = b.stN ? b.stSum / b.stN : null; });
    const fit = linreg(buckets.filter(b => b.rows > 0).map(b => [b.depth, b.avgUnits]));
    return { buckets, fit, n: valid.length };
  }

  /* ======================================================================= *
   *  LENS 10 — Demand Forecasting Lite
   * ======================================================================= */
  function demandForecast(rows, horizon) {
    horizon = horizon || 8;
    const g = groupBy(rows.filter(r => r.week != null && r.week !== ''), r => String(r.week));
    const series = [];
    g.forEach((rs, k) => series.push({ week: k, units: sum(rs, r => (r.tyUnits > 0 ? r.tyUnits : 0)) }));
    series.sort((a, b) => a.week < b.week ? -1 : a.week > b.week ? 1 : 0);
    const fit = linreg(series.map((s, i) => [i, s.units]));
    const proj = [];
    for (let i = 0; i < horizon; i++) { const x = series.length + i; proj.push({ step: i + 1, units: Math.max(0, fit.slope * x + fit.intercept) }); }
    return { series, proj, fit };
  }

  /* ======================================================================= *
   *  LENS 11 — Anomaly Detection (z-score on ST% and AUR ratio)
   * ======================================================================= */
  function anomalyDetection(rows) {
    const valid = rows.filter(r => r._validSale);
    const stM = mean(valid.map(r => r.tyST)), stS = stdev(valid.map(r => r.tyST)) || 1;
    const aurM = mean(valid.map(r => r.aurRatio)), aurS = stdev(valid.map(r => r.aurRatio)) || 1;
    const points = valid.map(r => {
      const zST = r.tyST != null && stM != null ? (r.tyST - stM) / stS : 0;
      const zAUR = r.aurRatio != null && aurM != null ? (r.aurRatio - aurM) / aurS : 0;
      const score = Math.max(Math.abs(zST), Math.abs(zAUR));
      return { brand: r.brand, retailer: r.retailer, collection: r.collection, units: r.tyUnits, rtl: r.tyRtl, st: r.tyST, aurRatio: r.aurRatio, score, outlier: score > 2.5 };
    });
    points.sort((a, b) => b.score - a.score);
    return { points, outliers: points.filter(p => p.outlier) };
  }

  /* ======================================================================= *
   *  LENS 12 — Retailer Scorecard (radar across 5 normalized axes)
   * ======================================================================= */
  function retailerScorecard(rows) {
    const g = groupBy(rows, r => r.retailer == null ? '—' : r.retailer);
    const raw = [];
    g.forEach((rs, k) => {
      const valid = rs.filter(r => r._validSale);
      const rtl = sum(valid, r => r.tyRtl), units = sum(valid, r => r.tyUnits);
      const ly = sum(rs.filter(r => r.lyUnits > 0), r => r.lyUnits);
      const oh = sum(rs, r => r.tyOH), deadOH = sum(rs.filter(r => r._dead), r => r.tyOH);
      const promoUnits = sum(valid.filter(r => r.isPromo), r => r.tyUnits);
      raw.push({
        retailer: k, rtl, skus: rs.length, units, rtlPerSku: rs.length ? rtl / rs.length : 0,
        fullPrice: units ? 1 - promoUnits / units : null,
        growth: ly ? units / ly - 1 : null,
        invHealth: oh ? 1 - deadOH / oh : null,
      });
    });
    const axes = [['rtl', 'Mix'], ['rtlPerSku', 'Productivity'], ['fullPrice', 'Full-price'], ['growth', 'Growth'], ['invHealth', 'Inv. health']];
    axes.forEach(([f]) => {
      const vals = raw.map(r => r[f]).filter(x => x != null);
      const min = vals.length ? Math.min.apply(null, vals) : 0, max = vals.length ? Math.max.apply(null, vals) : 1;
      raw.forEach(r => { r.norm = r.norm || {}; r.norm[f] = (r[f] == null || max === min) ? 0.5 : (r[f] - min) / (max - min); });
    });
    raw.sort((a, b) => b.rtl - a.rtl);
    return { retailers: raw, axes };
  }

  /* ======================================================================= *
   *  LENS 13 — Collection Lifecycle
   * ======================================================================= */
  function collectionLifecycle(rows) {
    const g = groupBy(rows.filter(r => r.collection != null && r.collection !== ''), r => r.collection);
    const cur = new Date().getFullYear();
    const out = [];
    g.forEach((rs, k) => {
      const units = sum(rs, r => (r.tyUnits > 0 ? r.tyUnits : 0));
      const ly = sum(rs.filter(r => r.lyUnits > 0), r => r.lyUnits), oh = sum(rs, r => r.tyOH);
      const stVals = rs.map(r => r.tyST).filter(x => x != null && x >= 0 && x <= 1);
      const st = stVals.length ? mean(stVals) : ((units + oh) ? units / (units + oh) : null);
      const age = rs[0].relYear != null ? cur - rs[0].relYear : null;
      let stage = 'Mature';
      if (ly === 0 && units > 0) stage = 'Launch';
      else if (units === 0 && oh > 0) stage = 'Exit';
      else if (ly > 0 && units < ly * 0.7) stage = 'Decay';
      else if (units > ly) stage = 'Growth';
      out.push({ collection: String(k), age, units, ly, oh, st, stage });
    });
    out.sort((a, b) => b.units - a.units);
    return out;
  }

  /* ======================================================================= *
   *  LENS 14 — Door Clustering (quadrant on volume × sell-through)
   *  Uses tyUnits + tyST (both in the read's metric set) so it works even when
   *  retail $ is absent; AUR is reported alongside only when tyRtl is present.
   * ======================================================================= */
  function doorClustering(rows) {
    const g = groupBy(rows.filter(r => r.door != null && r.door !== ''), r => r.door);
    const points = [];
    g.forEach((rs, k) => {
      const units = sum(rs, r => (r.tyUnits > 0 ? r.tyUnits : 0));
      const oh = sum(rs, r => r.tyOH);
      const stVals = rs.map(r => r.tyST).filter(x => x != null && x >= 0 && x <= 1);
      const st = stVals.length ? mean(stVals) : ((units + oh) ? units / (units + oh) : null);
      const valid = rs.filter(r => r._validSale);
      const vUnits = sum(valid, r => r.tyUnits), vRtl = sum(valid, r => r.tyRtl);
      points.push({ door: String(k), units, st, aur: vUnits ? vRtl / vUnits : null, skus: rs.length });
    });
    const unitMed = median(points.map(p => p.units)), stMed = median(points.map(p => p.st));
    points.forEach(p => {
      const hiV = (p.units || 0) >= (unitMed || 0), hiS = (p.st || 0) >= (stMed || 0);
      p.cluster = hiV && hiS ? 'High-vol · fast' : hiV && !hiS ? 'High-vol · slow' : !hiV && hiS ? 'Low-vol · fast' : 'Low-vol · slow';
    });
    return { points, unitMed, stMed };
  }

  /* ======================================================================= *
   *  LENS 15 — Market Basket (brand co-occurrence by transaction)
   * ======================================================================= */
  /* Item co-occurrence over a grouping key. With transactionId it's a true market
   * basket; on the usual sell-out grain (no basket id) the same math over door /
   * location / retailer yields a co-assortment ("perform together") network.        */
  function coPerformance(rows, opts) {
    opts = opts || {};
    const by = opts.by || 'transactionId';
    const item = opts.item || 'brand';
    const groups = groupBy(
      rows.filter(r => r[by] != null && r[by] !== '' && r[item] != null && r[item] !== ''),
      r => r[by]);
    const pair = new Map(), single = new Map();
    groups.forEach(rs => {
      const items = Array.from(new Set(rs.map(r => r[item])));     // distinct items in this group
      items.forEach(b => single.set(b, (single.get(b) || 0) + 1));
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const ab = [items[i], items[j]].sort();          // keep endpoints, not just a joined label
          const key = JSON.stringify(ab);                  // collision-proof composite key
          const e = pair.get(key) || { a: ab[0], b: ab[1], count: 0 };
          e.count++;
          pair.set(key, e);
        }
    });
    const nGroups = groups.size || 1;
    // lift = P(a,b) / (P(a)·P(b)) — co-occurrence above what independence predicts (>1 = together)
    const pairs = Array.from(pair.values()).map(e => {
      const sa = single.get(e.a) || 0, sb = single.get(e.b) || 0;
      const lift = (sa && sb) ? (e.count * nGroups) / (sa * sb) : null;
      return { pair: e.a + ' + ' + e.b, a: e.a, b: e.b, count: e.count, lift };
    }).sort((a, b) => b.count - a.count);
    return {
      pairs, baskets: groups.size, by, item,
      brands: Array.from(single, ([k, v]) => ({ brand: k, count: v })).sort((a, b) => b.count - a.count),
    };
  }
  // back-compat: true market basket keyed on transaction id
  function marketBasket(rows) { return coPerformance(rows, { by: 'transactionId', item: 'brand' }); }

  /* ======================================================================= *
   *  LENS 16 — Cannibalization
   * ======================================================================= */
  function cannibalization(rows) {
    const g = groupBy(rows.filter(r => r.brand != null), r => r.brand + ' / ' + (r.materialCode || r.priceRange || '—'));
    const out = [];
    g.forEach((rs, k) => {
      const byCol = groupBy(rs, r => r.collection || '—');
      let newGain = 0, oldLoss = 0;
      byCol.forEach(crs => {
        const t = sum(crs, r => (r.tyUnits > 0 ? r.tyUnits : 0)), l = sum(crs, r => (r.lyUnits > 0 ? r.lyUnits : 0));
        if (l === 0 && t > 0) newGain += t; else if (t < l) oldLoss += (l - t);
      });
      if (newGain > 0 && oldLoss > 0) out.push({ group: k, newGain, oldLoss, net: newGain - oldLoss, risk: Math.min(1, oldLoss / (newGain + oldLoss)) });
    });
    out.sort((a, b) => b.oldLoss - a.oldLoss);
    return out;
  }

  /* ======================================================================= *
   *  LENS 17 — Whitespace (attribute × retailer gaps)
   * ======================================================================= */
  function whitespace(rows, opts) {
    const attr = (opts && opts.attr) || 'priceRange';
    const retailers = distinct(rows, 'retailer');
    const attrs = distinct(rows, attr);
    const cell = {};
    rows.forEach(r => {
      if (r.retailer == null || r[attr] == null) return;
      const key = r[attr] + ' ' + r.retailer;
      cell[key] = (cell[key] || 0) + (r.tyUnits > 0 ? r.tyUnits : 0);
    });
    const matrix = attrs.map(a => retailers.map(ret => cell[a + ' ' + ret] || 0));
    const rowTotals = matrix.map(row => row.reduce((s, x) => s + x, 0));
    const gaps = [];
    attrs.forEach((a, ai) => retailers.forEach((ret, ri) => {
      if (rowTotals[ai] > 0 && matrix[ai][ri] === 0) gaps.push({ attr: a, retailer: ret, rowStrength: rowTotals[ai] });
    }));
    gaps.sort((a, b) => b.rowStrength - a.rowStrength);
    return { attr, attrs, retailers, matrix, rowTotals, gaps };
  }

  /* ======================================================================= *
   *  LENS 18 — Replenishment Prioritizer
   * ======================================================================= */
  function replenishment(rows) {
    const valid = rows.filter(r => r.tyUnits > 0 && r._hasOH);
    const scored = valid.map(r => {
      const cover = r.tyUnits ? r.tyOH / r.tyUnits : null;
      const urgency = (r.tyST != null ? r.tyST : 0.5) * (cover != null ? 1 / (1 + cover) : 0.5);
      return { sku: (r.style || r.upc || r.collection || '—'), brand: r.brand, units: r.tyUnits, oh: r.tyOH, st: r.tyST, cover, margin: r.margin, urgency };
    });
    scored.sort((a, b) => b.urgency - a.urgency);
    return scored;
  }

  /* ======================================================================= *
   *  LENS 19 — Scenario Planner (hold / markdown / replenish / exit)
   * ======================================================================= */
  function scenarioPlanner(rows, params) {
    const md = (params && params.markdown) || 0.30, rep = (params && params.replenishPct) || 0.20;
    const onHand = rows.filter(r => r._hasOH);
    const tiedRetail = sum(onHand, r => (r.tyOH || 0) * (r.msrp || 0));
    const dead = onHand.filter(r => r._dead);
    const deadTied = sum(dead, r => (r.tyOH || 0) * (r.msrp || 0));
    const baseUnits = sum(rows.filter(r => r._validSale), r => r.tyUnits);
    const baseRtl = sum(rows.filter(r => r._validSale), r => r.tyRtl);
    const scenarios = [
      { name: 'Hold', units: baseUnits, retail: baseRtl, freedCash: 0 },
      { name: 'Markdown', units: baseUnits * (1 + md * 0.8), retail: baseRtl * (1 - md * 0.4), freedCash: deadTied * md },
      { name: 'Replenish', units: baseUnits * (1 + rep * 0.5), retail: baseRtl * (1 + rep * 0.5), freedCash: -tiedRetail * rep * 0.3 },
      { name: 'Exit dead', units: baseUnits, retail: baseRtl, freedCash: deadTied * 0.5 },
    ];
    return { scenarios, tiedRetail, deadTied, onHandRows: onHand.length };
  }

  /* ======================================================================= *
   *  STATISTICAL CORE — small dense linear algebra for OLS regression
   *  No deps; sized for the dummy-variable models below (p ≲ a few dozen).
   * ======================================================================= */
  // invert a square matrix via Gauss–Jordan with partial pivoting; singular
  // columns are left as zero rows (acts like a pseudo-inverse so we never throw)
  function invMatrix(A) {
    const n = A.length;
    const M = A.map((row, i) => row.slice().concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let col = 0; col < n; col++) {
      let piv = col, best = Math.abs(M[col][col]);
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > best) { best = Math.abs(M[r][col]); piv = r; }
      if (best < 1e-12) continue;                       // singular pivot → skip (pseudo-inverse)
      if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
      const pv = M[col][col];
      for (let c = 0; c < 2 * n; c++) M[col][c] /= pv;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col];
        if (!f) continue;
        for (let c = 0; c < 2 * n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map(row => row.slice(n));
  }

  // Ordinary least squares. X = n×p design matrix (include an intercept column),
  // y = n target. Returns coefficients, std errors, t-stats, R² and adj-R².
  function ols(X, y) {
    const n = X.length, p = n ? X[0].length : 0;
    if (!n || !p) return { beta: [], se: [], t: [], r2: null, adjR2: null, n, p };
    const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
    const Xty = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      for (let a = 0; a < p; a++) {
        Xty[a] += xi[a] * y[i];
        for (let b = a; b < p; b++) XtX[a][b] += xi[a] * xi[b];
      }
    }
    for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];  // symmetrize
    for (let a = 0; a < p; a++) XtX[a][a] += 1e-6;        // tiny ridge for numerical stability
    const inv = invMatrix(XtX);
    const beta = new Array(p).fill(0);
    for (let a = 0; a < p; a++) { let s = 0; for (let b = 0; b < p; b++) s += inv[a][b] * Xty[b]; beta[a] = s; }
    const ybar = y.reduce((s, v) => s + v, 0) / n;
    let rss = 0, tss = 0;
    for (let i = 0; i < n; i++) {
      let yh = 0; for (let a = 0; a < p; a++) yh += X[i][a] * beta[a];
      rss += (y[i] - yh) * (y[i] - yh);
      tss += (y[i] - ybar) * (y[i] - ybar);
    }
    const df = Math.max(1, n - p), sigma2 = rss / df;
    const se = beta.map((_, a) => Math.sqrt(Math.max(0, sigma2 * inv[a][a])));
    const t = beta.map((b, a) => (se[a] > 0 ? b / se[a] : 0));
    const r2 = tss > 0 ? 1 - rss / tss : 0;
    const adjR2 = (tss > 0 && n > p) ? 1 - (rss / df) / (tss / (n - 1)) : r2;
    return { beta, se, t, r2, adjR2, n, p, sigma2 };
  }

  // parse a year+month out of a date-ish string (ISO, US, or anything Date can read)
  function parseYM(v) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);          // YYYY-MM-DD
    if (m) return { y: +m[1], m: +m[2] };
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);            // MM/DD/YYYY
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return { y, m: +m[1] }; }
    const t = Date.parse(s);
    if (!isNaN(t)) { const d = new Date(t); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; }
    return null;
  }
  function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 2) return null;
    let sa = 0, sb = 0; for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
    const ma = sa / n, mb = sb / n;
    let cov = 0, va = 0, vb = 0;
    for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cov += da * db; va += da * da; vb += db * db; }
    return (va > 0 && vb > 0) ? cov / Math.sqrt(va * vb) : null;
  }

  /* ======================================================================= *
   *  LENS 20 — Attribute Drivers (multivariate OLS on one-hot attributes)
   *  Isolates each attribute level's own effect on performance while holding the
   *  other attributes fixed; reports coefficient, t-stat, significance, and R².
   * ======================================================================= */
  function attributeDrivers(rows, opts) {
    opts = opts || {};
    const candidate = opts.dims || ['frameShape', 'frameMaterial', 'materialCode',
      'lensColor', 'frameColor', 'templeColor', 'size', 'priceRange', 'brandCategory', 'brand'];
    // target: sell-through % when it's broadly usable, else log(units) (velocity)
    const useST = opts.target === 'st' || (opts.target !== 'units' && rows.some(r => r.tyST != null && r.tyST >= 0 && r.tyST <= 1));
    const valid = rows.filter(r => useST ? (r.tyST != null && r.tyST >= 0 && r.tyST <= 1) : (r.tyUnits != null && r.tyUnits > 0));
    let dims = candidate.filter(d => distinct(valid, d).length >= 2);
    // frameMaterial and materialCode encode the same thing 1:1 — keep one to avoid a collinear design
    if (dims.includes('frameMaterial') && dims.includes('materialCode')) dims = dims.filter(d => d !== 'materialCode');
    const target = useST ? 'st' : 'units';
    if (!dims.length || valid.length < 10) return { insufficient: true, terms: [], r2: null, n: valid.length, dims, target };
    const minCount = Math.max(3, Math.round(valid.length * 0.02));
    const baselines = {};
    let cols = [];                                       // {dim, level, count} → one dummy column each
    dims.forEach(d => {
      const counts = {};
      valid.forEach(r => { const v = r[d]; if (v != null && v !== '') counts[v] = (counts[v] || 0) + 1; });
      const ls = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      baselines[d] = ls[0];                              // most common level is the reference
      ls.slice(1).forEach(l => { if (counts[l] >= minCount) cols.push({ dim: d, level: l, count: counts[l] }); });
    });
    // keep the model well-posed: cap columns so p stays comfortably below n
    const maxCols = Math.max(1, Math.floor(valid.length / 3) - 1);
    if (cols.length > maxCols) cols = cols.slice().sort((a, b) => b.count - a.count).slice(0, maxCols);
    const p = cols.length + 1;
    const X = [], y = [];
    valid.forEach(r => {
      const row = new Array(p).fill(0); row[0] = 1;      // intercept
      cols.forEach((c, j) => { if (String(r[c.dim]) === String(c.level)) row[j + 1] = 1; });
      X.push(row);
      y.push(useST ? r.tyST : Math.log(r.tyUnits));
    });
    const fit = ols(X, y);
    const terms = cols.map((c, j) => ({
      dim: c.dim, level: c.level, baseline: baselines[c.dim], count: c.count,
      coef: fit.beta[j + 1], se: fit.se[j + 1], t: fit.t[j + 1], sig: Math.abs(fit.t[j + 1]) >= 1.96,
    })).sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));
    return { terms, intercept: fit.beta[0], r2: fit.r2, adjR2: fit.adjR2, n: fit.n, p: fit.p, target, baselines, dims };
  }

  /* ======================================================================= *
   *  LENS 21 — Seasonality & Timing (monthly index + trend + cross-year fit)
   * ======================================================================= */
  function seasonality(rows) {
    const dated = [];
    rows.forEach(r => {
      const ym = parseYM(r.week);
      if (ym) dated.push({ month: ym.m, year: ym.y, ord: ym.y * 12 + ym.m, units: (r.tyUnits > 0 ? r.tyUnits : 0) });
    });
    if (dated.length < 6) return { insufficient: true, months: [] };
    const byMonth = {};
    dated.forEach(d => { (byMonth[d.month] = byMonth[d.month] || []).push(d); });
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const arr = byMonth[m] || [];
      months.push({ month: m, units: arr.reduce((s, d) => s + d.units, 0), n: arr.length });
    }
    const present = months.filter(x => x.n > 0);
    const avgUnits = present.length ? present.reduce((s, x) => s + x.units, 0) / present.length : 0;
    months.forEach(x => { x.index = (x.n > 0 && avgUnits) ? x.units / avgUnits : null; });
    // chronological trend (units per period over time)
    const byOrd = {};
    dated.forEach(d => { byOrd[d.ord] = (byOrd[d.ord] || 0) + d.units; });
    const ords = Object.keys(byOrd).map(Number).sort((a, b) => a - b);
    const trend = linreg(ords.map((o, i) => [i, byOrd[o]]));
    // cross-year consistency
    const years = Array.from(new Set(dated.map(d => d.year))).sort();
    let consistency = null, yearSeries = [];
    if (years.length >= 2) {
      yearSeries = years.map(y => {
        const arr = new Array(12).fill(0);
        dated.filter(d => d.year === y).forEach(d => { arr[d.month - 1] += d.units; });
        return { year: y, units: arr };
      });
      const cors = [];
      for (let i = 0; i < yearSeries.length; i++)
        for (let j = i + 1; j < yearSeries.length; j++) {
          const c = pearson(yearSeries[i].units, yearSeries[j].units);
          if (c != null) cors.push(c);
        }
      consistency = cors.length ? cors.reduce((s, c) => s + c, 0) / cors.length : null;
    } else {
      const idx = present.map(x => x.index);
      const m = mean(idx), sd = stdev(idx);
      consistency = m ? Math.max(0, 1 - sd / m) : null;   // evenness proxy when only one year
    }
    const peak = present.slice().sort((a, b) => b.units - a.units)[0] || null;
    const trough = present.slice().sort((a, b) => a.units - b.units)[0] || null;
    return { months, present, peak, trough, trendSlope: trend.slope, years, yearSeries, consistency, n: dated.length };
  }

  /* ======================================================================= *
   *  LENS 22 — Price Elasticity (log–log OLS of units on AUR) + realization
   * ======================================================================= */
  function priceElasticity(rows) {
    const valid = rows.filter(r => r._validSale && r.aur != null && r.aur > 0 && r.tyUnits > 0);
    if (valid.length < 8) return { insufficient: true, n: valid.length, points: [] };
    const X = valid.map(r => [1, Math.log(r.aur)]);
    const y = valid.map(r => Math.log(r.tyUnits));
    const fit = ols(X, y);
    const withMsrp = valid.filter(r => r.msrp > 0 && r.aurRatio != null);
    const medRealization = median(withMsrp.map(r => r.aurRatio));
    const points = valid.map(r => ({
      aur: r.aur, msrp: r.msrp, units: r.tyUnits, st: r.tyST,
      aurRatio: r.aurRatio, brand: r.brand, promo: r.isPromo === true,
    }));
    return {
      elasticity: fit.beta[1], intercept: fit.beta[0], r2: fit.r2, tStat: fit.t[1],
      n: fit.n, points, medRealization, lnFit: { slope: fit.beta[1], intercept: fit.beta[0] },
    };
  }

  return {
    FIELD_SYNONYMS, OPTIONAL_DIMS, FIELD_LABELS, ANALYSES,
    num, buildColumnMap, parseRecords, enrich, priceBandLabel,
    fieldLabel, evaluateAnalyses,
    groupBy, sum, median, distinct, applyFilters, mean, stdev, linreg,
    integrityReport, liquidationRadar, velocityMatrix, momentum, promoAnalysis,
    assortmentProductivity, sizeCurveAnalysis, priceArchitectureAnalysis, inventoryAging,
    markdownSensitivityAnalysis, demandForecast, anomalyDetection, retailerScorecard,
    collectionLifecycle, doorClustering, marketBasket, coPerformance, cannibalization, whitespace,
    replenishment, scenarioPlanner,
    invMatrix, ols, pearson, attributeDrivers, seasonality, priceElasticity,
  };
});
