// TypeScript source. Builds to dist/assortment-comparison.js.
// Application state, spreadsheet, and DOM contracts are typed incrementally below.
const COLORS = ['#0073C2', '#EFC000', '#CD534C', '#39B185', '#8E44AD'];
const DB_NAME = 'assortment-comparison-autosave';
const STORE_NAME = 'snapshots';
const SAVE_KEY = 'latest';

let rawRows = [];
let normalizedRows = [];
let activeSegment = 'all';
let autosaveTimer = null;
let hydrating = false;

document.getElementById('fileInput').addEventListener('change', handleFile);
document.getElementById('landingInput').addEventListener('change', handleFile);
initInfoModal();

const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('click', () => document.getElementById('landingInput').click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
});

restoreSnapshot();

function initInfoModal() {
  const overlay = document.getElementById('infoModalOverlay');
  const btn = document.getElementById('infoBtn');
  const closeBtn = document.getElementById('infoModalClose');
  if (!overlay || !btn || !closeBtn) return;

  function openModal() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  document.querySelectorAll('.info-modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.info-modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.info-modal-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = document.getElementById('modal-tab-' + tab.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });
}

function handleFile(e) {
  if (e.target.files.length) processFile(e.target.files[0]);
}

function processFile(file) {
  if (!isSheetJsReady()) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const result = e.target?.result;
      if (!(result instanceof ArrayBuffer)) throw new Error('Workbook could not be read as binary data.');
      const data = new Uint8Array(result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!json.length) { showToast('No data rows found.'); return; }
      loadRows(json);
      showToast(`Loaded ${json.length} row${json.length !== 1 ? 's' : ''}`);
    } catch (err) {
      showToast('Error reading file: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function loadRows(rows, options: any = {}) {
  rawRows = rows;
  normalizedRows = normalizeRows(rows);
  if (!normalizedRows.length) {
    showToast('Could not find retailer and product columns.');
    return;
  }
  activeSegment = options.activeSegment || 'all';
  showApp();
  populateControls(options.filters || {});
  updateComparison({ skipSave: options.skipSave });
}

function normalizeRows(rows) {
  return rows.map((row, index) => {
    const keys = Object.keys(row);
    const get = names => {
      const found = keys.find(k => names.some(n => cleanHeader(k) === cleanHeader(n)));
      return found ? row[found] : '';
    };
    const retailer = str(get(['Retailer', 'Retailer Selling', 'Account', 'KAC', 'Customer', 'Store', 'Banner']));
    const brand = str(get(['Brand']));
    const release = str(get(['Release', 'Release Date', 'Launch', 'Launch Date', 'Drop', 'Drop Date', 'Season']));
    const style = str(get(['Style', 'Label', 'SKU', 'Product']));
    const upc = str(get(['UPC', 'GTIN', 'EAN', 'Barcode']));
    const color = str(get(['Color', 'Colour']));
    const grid = str(get(['Grid', 'Material', 'Model']));
    const unitSold = num(get(['Unit Sold', 'Units Sold', 'Sold', 'U Sold', 'Sold U', 'Sold Units', 'Sales Units']));
    const unitOh = num(get(['Unit OH', 'Units OH', 'On Hand', 'On Hand U', 'OH', 'OH Units', 'Remain', 'Remaining', 'Stock', 'Inventory', 'Qty', 'Quantity', 'Units']));
    const fallback = str(get(['Label', 'SKU', 'Product']));
    return {
      rowId: index,
      retailer,
      brand,
      release,
      style: style || fallback,
      upc,
      color,
      grid,
      unitSold,
      unitOh,
    };
  }).filter(row => row.retailer && (row.upc || row.style || row.grid || row.color || row.brand));
}

function showApp() {
  document.getElementById('uploadView').style.display = 'none';
  document.getElementById('appView').style.display = 'grid';
  document.getElementById('toolbar').style.display = 'flex';
  document.getElementById('headerStats').style.display = 'flex';
  document.getElementById('btnClear').style.display = '';
  document.getElementById('btnExport').style.display = '';
}

function populateControls(filters: any = {}) {
  const retailers = unique(normalizedRows.map(r => r.retailer)).sort();
  const requestedRetailers = filters.retailers && filters.retailers.length ? filters.retailers : retailers.slice(0, 3);
  const selectedRetailers = requestedRetailers.filter(name => retailers.includes(name));
  setupMultiSelect('retailer', retailers, selectedRetailers.length ? selectedRetailers : retailers.slice(0, 3), {
    allLabel: 'All retailers',
    singularLabel: 'retailer',
    pluralLabel: 'retailers',
    maxSelectable: 5,
    requireOne: true,
  });

  const brands = unique(normalizedRows.map(r => r.brand).filter(Boolean)).sort();
  const requestedBrands = filters.brands && filters.brands.length ? filters.brands : (filters.brand ? [filters.brand] : []);
  const selectedBrands = requestedBrands.filter(name => brands.includes(name));
  setupMultiSelect('brand', brands, selectedBrands, {
    allLabel: 'All brands',
    singularLabel: 'brand',
    pluralLabel: 'brands',
    requireOne: false,
  });

  document.getElementById('keyMode').value = ['upc', 'style'].includes(filters.keyMode) ? filters.keyMode : 'upc';
  document.getElementById('metricMode').value = ['sold', 'oh', 'both'].includes(filters.metricMode) ? filters.metricMode : 'oh';
  document.getElementById('searchInput').value = filters.search || '';
}

const MS_STATE = {};

function setupMultiSelect(key, options, selected, config) {
  MS_STATE[key] = { options: options.slice(), selected: new Set(selected), config };
  const panel = document.getElementById(`${key}Panel`);
  const trigger = document.getElementById(`${key}Trigger`);
  const dropdown = document.getElementById(`${key}Dropdown`);
  if (!panel || !trigger || !dropdown) return;
  if (!options.length) {
    panel.innerHTML = '<div class="ms-empty">No options available.</div>';
  } else {
    const actions = `
      <div class="ms-actions">
        <button type="button" onclick="msSelectAll('${key}')">Select all</button>
        <button type="button" onclick="msClear('${key}')">Clear</button>
      </div>`;
    const items = options.map(name => `
      <label class="ms-option">
        <input type="checkbox" value="${escAttr(name)}" ${MS_STATE[key].selected.has(name) ? 'checked' : ''} onchange="msToggle('${key}', this)">
        <span class="ms-option-label">${escHtml(name)}</span>
      </label>`).join('');
    panel.innerHTML = actions + items;
  }
  trigger.onclick = e => { e.stopPropagation(); msToggleOpen(key); };
  panel.onclick = e => e.stopPropagation();
  msUpdateLabel(key);
}

function msToggleOpen(key) {
  const dropdown = document.getElementById(`${key}Dropdown`);
  const trigger = document.getElementById(`${key}Trigger`);
  if (!dropdown) return;
  const willOpen = !dropdown.classList.contains('open');
  document.querySelectorAll('.ms-dropdown.open').forEach(el => {
    el.classList.remove('open');
    const t = el.querySelector('.ms-trigger');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
  if (willOpen) {
    dropdown.classList.add('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }
}

function msToggle(key, input) {
  const state = MS_STATE[key];
  if (!state) return;
  const value = input.value;
  const cfg = state.config || {};
  if (input.checked) {
    if (cfg.maxSelectable && state.selected.size >= cfg.maxSelectable) {
      input.checked = false;
      showToast(`Up to ${cfg.maxSelectable} ${cfg.pluralLabel || 'items'} can be compared at once.`);
      return;
    }
    state.selected.add(value);
  } else {
    if (cfg.requireOne && state.selected.size <= 1) {
      input.checked = true;
      return;
    }
    state.selected.delete(value);
  }
  msUpdateLabel(key);
  updateComparison();
}

function msSelectAll(key) {
  const state = MS_STATE[key];
  if (!state) return;
  const cfg = state.config || {};
  const limit = cfg.maxSelectable || state.options.length;
  state.selected = new Set(state.options.slice(0, limit));
  msSyncCheckboxes(key);
  msUpdateLabel(key);
  if (cfg.maxSelectable && state.options.length > cfg.maxSelectable) {
    showToast(`Selected the first ${cfg.maxSelectable} of ${state.options.length} ${cfg.pluralLabel || 'items'}.`);
  }
  updateComparison();
}

function msClear(key) {
  const state = MS_STATE[key];
  if (!state) return;
  const cfg = state.config || {};
  if (cfg.requireOne) {
    const first = state.options[0];
    state.selected = new Set(first ? [first] : []);
  } else {
    state.selected = new Set();
  }
  msSyncCheckboxes(key);
  msUpdateLabel(key);
  updateComparison();
}

function msSyncCheckboxes(key) {
  const state = MS_STATE[key];
  const panel = document.getElementById(`${key}Panel`);
  if (!state || !panel) return;
  panel.querySelectorAll('input[type=checkbox]').forEach(input => {
    input.checked = state.selected.has(input.value);
  });
}

function msUpdateLabel(key) {
  const state = MS_STATE[key];
  const label = document.getElementById(`${key}Label`);
  if (!state || !label) return;
  const cfg = state.config || {};
  const count = state.selected.size;
  const total = state.options.length;
  if (count === 0) {
    label.textContent = cfg.allLabel || 'All';
    label.classList.add('is-muted');
  } else if (count === total) {
    label.textContent = cfg.allLabel || 'All';
    label.classList.remove('is-muted');
  } else if (count === 1) {
    label.textContent = Array.from(state.selected)[0];
    label.classList.remove('is-muted');
  } else {
    label.textContent = `${count} ${cfg.pluralLabel || 'selected'}`;
    label.classList.remove('is-muted');
  }
}

function msGetSelected(key) {
  const state = MS_STATE[key];
  if (!state) return [];
  return state.options.filter(name => state.selected.has(name));
}

document.addEventListener('click', e => {
  if (!e.target.closest('.ms-dropdown')) {
    document.querySelectorAll('.ms-dropdown.open').forEach(el => {
      el.classList.remove('open');
      const t = el.querySelector('.ms-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }
});

function updateComparison(options: any = {}) {
  const selectedRetailers = getSelectedRetailers().slice(0, 5);
  const filteredRows = getFilteredRows(selectedRetailers);
  const productMap = buildProductMap(filteredRows);
  const products = Array.from(productMap.values());
  const segments = buildSegments(products, selectedRetailers);
  const visibleProducts = activeSegment === 'all' ? products : (segments.find(s => s.key === activeSegment)?.products || []);

  document.getElementById('statRows').textContent = normalizedRows.length.toLocaleString();
  document.getElementById('statProducts').textContent = buildProductMap(normalizedRows).size.toLocaleString();
  document.getElementById('statRetailers').textContent = unique(normalizedRows.map(r => r.retailer)).length;
  document.getElementById('summaryMeta').textContent = `${products.length.toLocaleString()} compared products`;
  document.getElementById('tableMeta').textContent = `${visibleProducts.length.toLocaleString()} shown`;

  renderSummary(filteredRows, selectedRetailers);
  renderSegments(segments);
  renderVenn(selectedRetailers, segments);
  renderTable(visibleProducts);
  if (!options.skipSave) scheduleSave();
}

function getSelectedRetailers() {
  return msGetSelected('retailer');
}

function getSelectedBrands() {
  return msGetSelected('brand');
}

function getFilteredRows(selectedRetailers) {
  const brands = getSelectedBrands();
  const brandSet = brands.length ? new Set(brands) : null;
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  return normalizedRows.filter(row => {
    if (selectedRetailers.length && !selectedRetailers.includes(row.retailer)) return false;
    if (brandSet && !brandSet.has(row.brand)) return false;
    if (search) {
      const haystack = `${row.brand} ${row.release} ${row.style} ${row.upc} ${row.color} ${row.grid} ${row.retailer}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function buildProductMap(rows) {
  const map = new Map();
  rows.forEach(row => {
    const key = productKey(row);
    if (!map.has(key)) {
      map.set(key, {
        key,
        brand: row.brand,
        release: row.release,
        style: row.style,
        upc: row.upc,
        color: row.color,
        grid: row.grid,
        retailers: new Set(),
        soldByRetailer: {},
        ohByRetailer: {},
        sold: 0,
        oh: 0,
      });
    }
    const item = map.get(key);
    item.retailers.add(row.retailer);
    item.soldByRetailer[row.retailer] = (item.soldByRetailer[row.retailer] || 0) + row.unitSold;
    item.ohByRetailer[row.retailer] = (item.ohByRetailer[row.retailer] || 0) + row.unitOh;
    item.sold += row.unitSold;
    item.oh += row.unitOh;
    if (!item.release && row.release) item.release = row.release;
    if (!item.upc && row.upc) item.upc = row.upc;
    if (!item.style && row.style) item.style = row.style;
  });
  return map;
}

function productKey(row) {
  const mode = document.getElementById('keyMode').value;
  const primary = mode === 'style'
    ? (row.style || row.upc)
    : (row.upc || row.style);
  return str(primary || row.grid || row.color || row.brand).toLowerCase();
}

function buildSegments(products, selectedRetailers) {
  const segmentMap = new Map();
  products.forEach(product => {
    const present = selectedRetailers.filter(name => product.retailers.has(name));
    if (!present.length) return;
    const key = present.join('|');
    if (!segmentMap.has(key)) {
      segmentMap.set(key, { key, names: present, products: [], sold: 0, oh: 0 });
    }
    const segment = segmentMap.get(key);
    segment.products.push(product);
    segment.sold += product.sold;
    segment.oh += product.oh;
  });
  return Array.from(segmentMap.values()).sort((a, b) => b.products.length - a.products.length || a.key.localeCompare(b.key));
}

function getMetricMode() {
  const el = document.getElementById('metricMode');
  const value = el ? el.value : 'oh';
  return value === 'sold' || value === 'both' ? value : 'oh';
}
function metricLabel() {
  const mode = getMetricMode();
  return mode === 'sold' ? 'Unit Sold' : mode === 'both' ? 'Sold + OH' : 'Unit OH';
}
function metricLabelShort() {
  const mode = getMetricMode();
  return mode === 'sold' ? 'sold' : mode === 'both' ? 'sold + OH' : 'OH';
}
function metricValue(obj) {
  if (!obj) return 0;
  const mode = getMetricMode();
  const sold = obj.sold || 0;
  const oh = obj.oh || 0;
  return mode === 'sold' ? sold : mode === 'both' ? sold + oh : oh;
}
function metricFromRetailerMaps(product, retailer) {
  const mode = getMetricMode();
  const sold = (product.soldByRetailer && product.soldByRetailer[retailer]) || 0;
  const oh = (product.ohByRetailer && product.ohByRetailer[retailer]) || 0;
  return mode === 'sold' ? sold : mode === 'both' ? sold + oh : oh;
}

function renderSummary(rows, selectedRetailers) {
  const html = selectedRetailers.map((name, i) => {
    const retailerRows = rows.filter(row => row.retailer === name);
    const styles = buildProductMap(retailerRows).size;
    const sold = retailerRows.reduce((sum, row) => sum + row.unitSold, 0);
    const oh = retailerRows.reduce((sum, row) => sum + row.unitOh, 0);
    const denom = sold + oh;
    const sellThru = denom > 0 ? (sold / denom) * 100 : 0;
    return `
      <div class="retailer-card">
        <div class="retailer-name"><span class="swatch" style="background:${COLORS[i % COLORS.length]}"></span>${escHtml(name)}</div>
        <div class="retailer-metrics">
          <div><div class="metric-label">Styles</div><div class="metric-value">${styles.toLocaleString()}</div></div>
          <div><div class="metric-label">Unit Sold</div><div class="metric-value">${sold.toLocaleString()}</div></div>
          <div><div class="metric-label">Unit OH</div><div class="metric-value">${oh.toLocaleString()}</div></div>
          <div><div class="metric-label">Sell-Thru</div><div class="metric-value">${sellThru.toFixed(1)}%</div></div>
        </div>
      </div>`;
  }).join('');
  document.getElementById('summaryGrid').innerHTML = html || '<div class="empty">Select at least one retailer.</div>';
}

function renderSegments(segments) {
  const allCount = segments.reduce((sum, s) => sum + s.products.length, 0);
  const label = metricLabel();
  const rows = [
    `<button class="segment-btn ${activeSegment === 'all' ? 'active' : ''}" onclick="setSegmentEncoded('${encodeURIComponent('all')}')"><span class="segment-name">All Compared</span><span class="segment-meta">${allCount.toLocaleString()} styles</span><span class="segment-meta"></span></button>`,
    ...segments.map(segment => `
      <button class="segment-btn ${activeSegment === segment.key ? 'active' : ''}" onclick="setSegmentEncoded('${encodeURIComponent(segment.key)}')">
        <span class="segment-name">${escHtml(segment.names.join(' + '))}</span>
        <span class="segment-meta">${segment.products.length.toLocaleString()} styles</span>
        <span class="segment-meta">${metricValue(segment).toLocaleString()} ${escHtml(metricLabelShort())}</span>
      </button>`)
  ];
  document.getElementById('segmentList').innerHTML = rows.join('');
  const active = activeSegment === 'all' ? 'All Compared' : (segments.find(s => s.key === activeSegment)?.names.join(' + ') || 'All Compared');
  document.getElementById('activeSegmentName').textContent = active;
}

function setSegment(key) {
  activeSegment = key;
  updateComparison();
}

function setSegmentEncoded(key) {
  setSegment(decodeURIComponent(key));
}

const VENN_VIEW = { width: 720, height: 560 };

function renderVenn(retailers, segments) {
  const wrap = document.getElementById('vennWrap');
  if (!retailers.length) {
    wrap.innerHTML = '<div class="empty">Select retailers to compare.</div>';
    return;
  }

  const { width, height } = VENN_VIEW;
  const positions = getCirclePositions(retailers.length, width, height);
  const segmentByKey = Object.fromEntries(segments.map(s => [s.key, s]));
  const retailerStats = buildRetailerStatsFromSegments(retailers, segments);
  const groupCenter = averageCenter(positions);

  const circleMarkup = retailers.map((name, i) => `
    <circle class="venn-circle"
      cx="${positions[i].x}" cy="${positions[i].y}" r="${positions[i].r}"
      fill="${COLORS[i % COLORS.length]}" fill-opacity="0.38"
      stroke="${COLORS[i % COLORS.length]}" stroke-width="2"
      onclick="setSegmentEncoded('${encodeURIComponent(name)}')"></circle>
  `).join('');

  const nameLabelMarkup = retailers.map((name, i) => {
    const label = getOuterLabelPlacement(positions[i], groupCenter, width, height, retailers.length);
    return `
      <text class="venn-label" x="${label.x}" y="${label.y}" text-anchor="${label.anchor}">
        <tspan x="${label.x}" dy="0">${escHtml(name)}</tspan>
        <tspan class="venn-label-sub" x="${label.x}" dy="15">${retailerHeader(retailerStats[name])}</tspan>
      </text>`;
  }).join('');

  const regionLabelMarkup = buildRegionLabels(retailers, segmentByKey, positions);

  wrap.innerHTML = `
    <svg class="venn-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Retailer assortment overlap" preserveAspectRatio="xMidYMid meet">
      ${circleMarkup}
      ${regionLabelMarkup}
      ${nameLabelMarkup}
    </svg>`;
}

function getCirclePositions(count, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  if (count === 1) return [{ x: cx, y: cy, r: 170 }];
  if (count === 2) {
    const r = 160;
    const sep = r * 0.95;
    return [
      { x: cx - sep / 2, y: cy, r },
      { x: cx + sep / 2, y: cy, r },
    ];
  }
  if (count === 3) {
    const r = 145;
    const dx = 92;
    const dy = 55;
    return [
      { x: cx - dx, y: cy - dy, r },
      { x: cx + dx, y: cy - dy, r },
      { x: cx,      y: cy + 70, r },
    ];
  }
  if (count === 4) {
    const r = 128;
    const dx = 78;
    const dy = 62;
    return [
      { x: cx - dx, y: cy - dy, r },
      { x: cx + dx, y: cy - dy, r },
      { x: cx - dx, y: cy + dy, r },
      { x: cx + dx, y: cy + dy, r },
    ];
  }
  const r = 122;
  const ringX = 118;
  const ringY = 105;
  const yShift = 8;
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    positions.push({
      x: cx + Math.cos(angle) * ringX,
      y: cy + Math.sin(angle) * ringY + yShift,
      r,
    });
  }
  return positions;
}

function averageCenter(positions) {
  return {
    x: positions.reduce((s, p) => s + p.x, 0) / positions.length,
    y: positions.reduce((s, p) => s + p.y, 0) / positions.length,
  };
}

function getOuterLabelPlacement(circle, groupCenter, width, height, count) {
  const halfTextW = 120;
  const verticalPad = 26;
  const minX = halfTextW;
  const maxX = width - halfTextW;
  const topY = Math.max(circle.y - circle.r - verticalPad, 24);
  const bottomY = Math.min(circle.y + circle.r + verticalPad + 4, height - 20);

  if (count === 1) {
    return { x: clamp(circle.x, minX, maxX), y: topY, anchor: 'middle' };
  }

  const above = circle.y <= groupCenter.y;
  const y = above ? topY : bottomY;
  const x = clamp(circle.x, minX, maxX);
  return { x, y, anchor: 'middle' };
}

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function buildRegionLabels(retailers, segmentByKey, positions) {
  const combos = Object.values(segmentByKey) as any[];
  const unitsLabel = metricLabelShort();
  return combos.map(segment => {
    const center = getRegionCentroid(segment, retailers, positions);
    if (!center) return '';
    return `
      <circle class="venn-region ${activeSegment === segment.key ? 'active' : ''}"
        cx="${center.x}" cy="${center.y - 7}" r="32"
        onclick="setSegmentEncoded('${encodeURIComponent(segment.key)}')"></circle>
      <text class="region-label ${activeSegment === segment.key ? 'active' : ''}"
        x="${center.x}" y="${center.y}" text-anchor="middle">
        <tspan class="venn-count" x="${center.x}" dy="0">${segment.products.length}</tspan>
        <tspan x="${center.x}" dy="17">${metricValue(segment).toLocaleString()} ${escHtml(unitsLabel)}</tspan>
      </text>`;
  }).join('');
}

function getRegionCentroid(segment, retailers, positions) {
  const includedIdx = segment.names
    .map(name => retailers.indexOf(name))
    .filter(idx => idx >= 0);
  if (!includedIdx.length) return null;
  const excludedIdx = positions.map((_, i) => i).filter(i => !includedIdx.includes(i));

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  includedIdx.forEach(i => {
    const p = positions[i];
    if (p.x - p.r < minX) minX = p.x - p.r;
    if (p.x + p.r > maxX) maxX = p.x + p.r;
    if (p.y - p.r < minY) minY = p.y - p.r;
    if (p.y + p.r > maxY) maxY = p.y + p.r;
  });

  const steps = 50;
  const stepX = (maxX - minX) / steps;
  const stepY = (maxY - minY) / steps;
  let sumX = 0, sumY = 0, sumW = 0;

  for (let xi = 0; xi <= steps; xi++) {
    const x = minX + xi * stepX;
    for (let yi = 0; yi <= steps; yi++) {
      const y = minY + yi * stepY;

      let minIncludedClearance = Infinity;
      let ok = true;
      for (const i of includedIdx) {
        const p = positions[i];
        const d = Math.hypot(x - p.x, y - p.y);
        const clearance = p.r - d;
        if (clearance < 0) { ok = false; break; }
        if (clearance < minIncludedClearance) minIncludedClearance = clearance;
      }
      if (!ok) continue;

      let minExcludedClearance = Infinity;
      for (const i of excludedIdx) {
        const p = positions[i];
        const d = Math.hypot(x - p.x, y - p.y);
        const clearance = d - p.r;
        if (clearance < 0) { ok = false; break; }
        if (clearance < minExcludedClearance) minExcludedClearance = clearance;
      }
      if (!ok) continue;

      const weight = Math.min(minIncludedClearance, excludedIdx.length ? minExcludedClearance : Infinity);
      const w = weight > 0 ? weight * weight : 0.0001;
      sumX += x * w;
      sumY += y * w;
      sumW += w;
    }
  }

  if (sumW === 0) return null;
  return { x: sumX / sumW, y: sumY / sumW };
}

function buildRetailerStatsFromSegments(retailers, segments) {
  const stats = Object.fromEntries(retailers.map(name => [name, { styles: 0, sold: 0, oh: 0 }]));
  segments.forEach(segment => {
    segment.names.forEach(name => {
      stats[name].styles += segment.products.length;
      stats[name].sold += segment.products.reduce((sum, item) => sum + ((item.soldByRetailer && item.soldByRetailer[name]) || 0), 0);
      stats[name].oh += segment.products.reduce((sum, item) => sum + ((item.ohByRetailer && item.ohByRetailer[name]) || 0), 0);
    });
  });
  return stats;
}

function retailerHeader(stats) {
  const styles = (stats ? stats.styles : 0).toLocaleString();
  const metric = metricValue(stats).toLocaleString();
  return `${styles} styles · ${metric} ${metricLabelShort()}`;
}

function renderTable(products) {
  const rows = products
    .slice()
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.style.localeCompare(b.style))
    .slice(0, 600)
    .map(item => `
      <tr>
        <td>${escHtml(item.brand) || '-'}</td>
        <td>${escHtml(item.release) || '-'}</td>
        <td class="mono">${escHtml(item.style) || '-'}</td>
        <td class="mono">${escHtml(item.grid) || '-'}</td>
        <td class="mono">${escHtml(item.upc) || '-'}</td>
        <td>${escHtml(Array.from(item.retailers).sort().join(', '))}</td>
        <td class="mono">${(item.sold || 0).toLocaleString()}</td>
        <td class="mono">${(item.oh || 0).toLocaleString()}</td>
      </tr>`);
  document.getElementById('productRows').innerHTML = rows.join('') || '<tr><td colspan="8" class="empty">No products match the current view.</td></tr>';
}

function exportSegment() {
  if (!isSheetJsReady()) return;
  const selectedRetailers = getSelectedRetailers().slice(0, 5);
  const products = Array.from(buildProductMap(getFilteredRows(selectedRetailers)).values());
  const segments = buildSegments(products, selectedRetailers);
  const visibleProducts = activeSegment === 'all' ? products : (segments.find(s => s.key === activeSegment)?.products || []);
  const rows = visibleProducts.map(item => ({
    Brand: item.brand,
    Release: item.release,
    Style: item.style,
    Grid: item.grid,
    UPC: item.upc,
    Retailer: Array.from(item.retailers).sort().join(', '),
    'Unit Sold': item.sold || 0,
    'Unit OH': item.oh || 0,
  }));
  if (!rows.length) { showToast('No rows to export.'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Assortment View');
  XLSX.writeFile(wb, `Assortment_Comparison_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadTemplate() {
  if (!isSheetJsReady()) return;
  const rows = getAssortmentSampleRows().slice(0, 6);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, 'Assortment_Comparison_Template.xlsx');
}

function getAssortmentSampleRows() {
  return [
    { Brand: 'Brand Alpha', Release: 'Core 2026', Style: 'ALP-100', Grid: 'G-101', UPC: '900000100001', Retailer: 'Retailer North', 'Unit Sold': 148, 'Unit OH': 36 },
    { Brand: 'Brand Alpha', Release: 'Core 2026', Style: 'ALP-100', Grid: 'G-101', UPC: '900000100001', Retailer: 'Retailer East', 'Unit Sold': 96, 'Unit OH': 22 },
    { Brand: 'Brand Alpha', Release: 'Core 2026', Style: 'ALP-100', Grid: 'G-101', UPC: '900000100001', Retailer: 'Retailer West', 'Unit Sold': 61, 'Unit OH': 18 },
    { Brand: 'Brand Alpha', Release: 'Seasonal 2026', Style: 'ALP-120', Grid: 'G-104', UPC: '900000100002', Retailer: 'Retailer North', 'Unit Sold': 72, 'Unit OH': 41 },
    { Brand: 'Brand Alpha', Release: 'Seasonal 2026', Style: 'ALP-120', Grid: 'G-104', UPC: '900000100002', Retailer: 'Retailer South', 'Unit Sold': 44, 'Unit OH': 27 },
    { Brand: 'Brand Beta', Release: 'Core 2026', Style: 'BET-210', Grid: 'G-210', UPC: '900000200001', Retailer: 'Retailer North', 'Unit Sold': 132, 'Unit OH': 58 },
    { Brand: 'Brand Beta', Release: 'Core 2026', Style: 'BET-210', Grid: 'G-210', UPC: '900000200001', Retailer: 'Retailer South', 'Unit Sold': 119, 'Unit OH': 34 },
    { Brand: 'Brand Beta', Release: 'Core 2026', Style: 'BET-230', Grid: 'G-230', UPC: '900000200002', Retailer: 'Retailer East', 'Unit Sold': 38, 'Unit OH': 62 },
    { Brand: 'Brand Beta', Release: 'Core 2026', Style: 'BET-230', Grid: 'G-230', UPC: '900000200002', Retailer: 'Retailer West', 'Unit Sold': 51, 'Unit OH': 49 },
    { Brand: 'Brand Gamma', Release: 'Launch 2026', Style: 'GAM-300', Grid: 'G-300', UPC: '900000300001', Retailer: 'Retailer North', 'Unit Sold': 84, 'Unit OH': 20 },
    { Brand: 'Brand Gamma', Release: 'Launch 2026', Style: 'GAM-300', Grid: 'G-300', UPC: '900000300001', Retailer: 'Retailer East', 'Unit Sold': 29, 'Unit OH': 17 },
    { Brand: 'Brand Gamma', Release: 'Launch 2026', Style: 'GAM-315', Grid: 'G-315', UPC: '900000300002', Retailer: 'Retailer West', 'Unit Sold': 17, 'Unit OH': 44 },
    { Brand: 'Brand Delta', Release: 'Limited 2026', Style: 'DEL-410', Grid: 'G-410', UPC: '900000400001', Retailer: 'Retailer South', 'Unit Sold': 46, 'Unit OH': 12 },
    { Brand: 'Brand Delta', Release: 'Limited 2026', Style: 'DEL-410', Grid: 'G-410', UPC: '900000400001', Retailer: 'Retailer West', 'Unit Sold': 24, 'Unit OH': 9 },
    { Brand: 'Brand Echo', Release: 'Test 2026', Style: 'ECH-500', Grid: 'G-500', UPC: '', Retailer: 'Retailer North', 'Unit Sold': 12, 'Unit OH': 31 },
    { Brand: 'Brand Echo', Release: 'Test 2026', Style: 'ECH-500', Grid: 'G-500', UPC: '', Retailer: 'Retailer East', 'Unit Sold': 9, 'Unit OH': 28 },
    { Brand: 'Brand Echo', Release: 'Test 2026', Style: 'ECH-520', Grid: 'G-520', UPC: '900000500002', Retailer: 'Retailer South', 'Unit Sold': 5, 'Unit OH': 55 },
    { Brand: 'Brand Alpha', Release: 'Archive', Style: 'ALP-090', Grid: 'G-090', UPC: '900000100090', Retailer: 'Retailer Outlet', 'Unit Sold': 203, 'Unit OH': 14 },
    { Brand: 'Brand Beta', Release: 'Archive', Style: 'BET-205', Grid: 'G-205', UPC: '900000200205', Retailer: 'Retailer Outlet', 'Unit Sold': 167, 'Unit OH': 22 },
    { Brand: 'Brand Gamma', Release: 'Archive', Style: 'GAM-290', Grid: 'G-290', UPC: '900000300290', Retailer: 'Retailer Outlet', 'Unit Sold': 91, 'Unit OH': 37 },
  ];
}

function downloadSampleData() {
  if (!isSheetJsReady()) return;
  const rows = getAssortmentSampleRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Assortment Sample');
  XLSX.writeFile(wb, 'Assortment_Comparison_Sample_Data.xlsx');
  showToast('Sample data downloaded');
}

function loadSampleData() {
  loadRows(getAssortmentSampleRows(), {
    filters: {
      retailers: ['Retailer North', 'Retailer East', 'Retailer West'],
      keyMode: 'upc',
      metricMode: 'both',
    },
  });
  showToast('Loaded anonymized sample assortment');
}

function scheduleSave() {
  if (hydrating || !rawRows.length) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveSnapshot, 400);
}

function saveSnapshot() {
  const snapshot = {
    key: SAVE_KEY,
    savedAt: new Date().toISOString(),
    rawRows,
    activeSegment,
    filters: {
      retailers: getSelectedRetailers(),
      brands: getSelectedBrands(),
      keyMode: document.getElementById('keyMode').value,
      metricMode: getMetricMode(),
      search: document.getElementById('searchInput').value,
    },
  };
  withStore('readwrite', store => store.put(snapshot)).catch(() => {
    showToast('Autosave storage is full. Export before closing.');
  });
}

function restoreSnapshot() {
  withStore('readonly', store => store.get(SAVE_KEY)).then((snapshot: any) => {
    if (!snapshot || !snapshot.rawRows || !snapshot.rawRows.length) return;
    hydrating = true;
    loadRows(snapshot.rawRows, {
      filters: snapshot.filters || {},
      activeSegment: snapshot.activeSegment || 'all',
      skipSave: true,
    });
    hydrating = false;
    showToast(`Restored ${snapshot.rawRows.length} saved row${snapshot.rawRows.length !== 1 ? 's' : ''}`);
  }).catch(() => {});
}

function clearSaved() {
  rawRows = [];
  normalizedRows = [];
  activeSegment = 'all';
  withStore('readwrite', store => store.delete(SAVE_KEY)).finally(() => {
    document.getElementById('uploadView').style.display = 'grid';
    document.getElementById('appView').style.display = 'none';
    document.getElementById('toolbar').style.display = 'none';
    document.getElementById('headerStats').style.display = 'none';
    document.getElementById('btnClear').style.display = 'none';
    document.getElementById('btnExport').style.display = 'none';
    showToast('Saved comparison cleared.');
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest) {
  return openDb().then(db => new Promise<any>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

/* One unified viewport-level cross-fade via View Transitions API.
   theme-switching (in style.css) suppresses per-element transitions for the
   duration so the cross-fade isn't competing with thousands of tweens. */
let _themePending = 0;
function _applyTheme(next) {
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('cloonk-theme', next); } catch (e) {}
}
function _swapTheme(next) {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('theme-switching');
  _themePending++;
  const settle = () => {
    if (--_themePending <= 0) { _themePending = 0; root.classList.remove('theme-switching'); }
  };
  if (typeof document.startViewTransition === 'function' && !reduce) {
    document.startViewTransition(() => _applyTheme(next)).finished.finally(settle);
  } else {
    _applyTheme(next);
    requestAnimationFrame(() => requestAnimationFrame(settle));
  }
}
function toggleTheme() {
  _swapTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
}
window.addEventListener('storage', e => {
  if (e.key === 'cloonk-theme') _swapTheme(e.newValue === 'light' ? 'light' : 'dark');
});

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function isSheetJsReady() {
  if (typeof XLSX !== 'undefined') return true;
  showToast('Spreadsheet tools are unavailable. Check your internet connection and reload.');
  return false;
}

function cleanHeader(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function str(value) { return value == null ? '' : String(value).trim(); }
function num(value) {
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
function escHtml(value) {
  return str(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(value) { return escHtml(value).replace(/'/g, '&#39;'); }
