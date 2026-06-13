// TypeScript source. Builds to dist/replenishment-linesheet.js.
// Application state, spreadsheet, and DOM contracts are typed incrementally below.
// ─── State ───
let allItems = [];
let selectedSet = new Set();
let notesMap = {};
let imageMap = {}; // id -> base64 data URL or URL string
let activePresentationId = null;
let autosaveReady = true;
let autosaveTimer = null;
let autosaveHydrating = false;

const AUTOSAVE_DB = 'rp-linesheet-autosave';
const AUTOSAVE_STORE = 'snapshots';
const AUTOSAVE_KEY = 'latest';

// ─── Color Map for dots ───
const COLOR_MAP = {
  'BLACK': '#1a1a1a', 'WHITE': '#f5f5f5', 'RED': '#c0392b', 'BLUE': '#2980b9',
  'GREEN': '#27ae60', 'YELLOW': '#f1c40f', 'ORANGE': '#e67e22', 'PURPLE': '#8e44ad',
  'PINK': '#e84393', 'BROWN': '#795548', 'GREY': '#95a5a6', 'GRAY': '#95a5a6',
  'GOLD': '#d4a72a', 'SILVER': '#bdc3c7', 'TORTOISE': '#8B6508', 'NAVY': '#2c3e50',
  'MATTE BLACK': '#2c2c2c', 'POLISHED BLACK': '#111',
};

function guessColor(name) {
  if (!name) return '#888';
  const upper = name.toUpperCase();
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (upper.includes(key)) return val;
  }
  return '#888';
}

// ─── File handling ───
document.getElementById('fileInput').addEventListener('change', handleFile);
document.getElementById('fileInputLanding').addEventListener('change', handleFile);
restoreAutosave();

const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('click', () => document.getElementById('fileInputLanding').click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    processFile(e.dataTransfer.files[0]);
  }
});

// ─── Image folder loading ───
document.getElementById('imageFolder').addEventListener('change', handleImageFiles);

function handleImageFiles(e) {
  const files = Array.from(e.target.files) as File[];
  if (!files.length) return;
  let matched = 0;
  let processed = 0;
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if (!imageFiles.length) {
    showToast('No image files selected.');
    return;
  }

  imageFiles.forEach(file => {
    const nameNoExt = file.name.replace(/\.[^.]+$/, '').trim().toLowerCase();
    // Match by SKU, Style, Grid, or Material
    const item = allItems.find(it =>
      it.sku.toLowerCase() === nameNoExt ||
      it.style.toLowerCase() === nameNoExt ||
      it.grid.toLowerCase() === nameNoExt ||
      it.material.toLowerCase() === nameNoExt
    );
    if (item) {
      const reader = new FileReader();
      reader.onload = () => {
        imageMap[item.id] = reader.result;
        matched++;
        processed++;
        if (processed >= imageFiles.length) {
          renderCards();
          scheduleAutosave();
          showToast(`Matched ${matched} image${matched !== 1 ? 's' : ''} to SKUs`);
        }
      };
      reader.readAsDataURL(file);
    } else {
      processed++;
      if (processed >= imageFiles.length) {
        renderCards();
        scheduleAutosave();
        showToast(`Matched ${matched} image${matched !== 1 ? 's' : ''} to SKUs`);
      }
    }
  });
}

function handleFile(e) {
  if (e.target.files.length) processFile(e.target.files[0]);
}

function processFile(file) {
  if (!isSheetJsReady()) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const result = e.target?.result;
      if (!(result instanceof ArrayBuffer)) throw new Error('Workbook could not be read as binary data.');
      const data = new Uint8Array(result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!json.length) { showToast('No data rows found.'); return; }

      // Try to extract embedded images via JSZip (xlsx is a zip)
      extractEmbeddedImages(data).then(embeddedImages => {
        loadData(json, embeddedImages);
      }).catch(() => {
        loadData(json, {});
      });
    } catch (err) {
      showToast('Error reading file: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// Extract images embedded in xlsx and map them to their anchored data row.
async function extractEmbeddedImages(data) {
  const images: any = {};
  try {
    // Dynamically load JSZip if needed
    if (typeof JSZip === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }
    const zip = await JSZip.loadAsync(data);
    images.byUpc = {};

    const firstSheetPath = await getFirstWorksheetPath(zip);
    const firstSheet = zip.file(firstSheetPath);
    await extractRichDataImages(zip, firstSheetPath, images);

    const sheetRels = zip.file(relsPathFor(firstSheetPath));
    if (firstSheet && sheetRels) {
      const sheetDoc = parseXml(await firstSheet.async('string'));
      const sheetRelsDoc = parseXml(await sheetRels.async('string'));
      const drawingRelId = getRelId(firstByLocalName(sheetDoc, 'drawing'));
      const drawingRel = findRelationship(sheetRelsDoc, drawingRelId);
      if (drawingRel) {
        const drawingPath = resolveZipPath(parentPath(firstSheetPath), drawingRel.getAttribute('Target'));
        const drawingFile = zip.file(drawingPath);
        const drawingRelsFile = zip.file(relsPathFor(drawingPath));
        if (drawingFile && drawingRelsFile) {
          const drawingDoc = parseXml(await drawingFile.async('string'));
          const drawingRelsDoc = parseXml(await drawingRelsFile.async('string'));
          const anchors = (Array.from(drawingDoc.getElementsByTagName('*')) as Element[])
            .filter(el => ['twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor'].includes(el.localName));

          for (const anchor of anchors) {
            const rowEl = firstByLocalName(anchor, 'row');
            const blip = firstByLocalName(anchor, 'blip');
            const imageRelId = getRelId(blip);
            if (!rowEl || !imageRelId) continue;

            const imageRel = findRelationship(drawingRelsDoc, imageRelId);
            if (!imageRel) continue;

            const mediaPath = resolveZipPath(parentPath(drawingPath), imageRel.getAttribute('Target'));
            const mediaFile = zip.file(mediaPath);
            if (!mediaFile) continue;

            const jsonRowIndex = parseInt(rowEl.textContent, 10) - 1;
            if (jsonRowIndex < 0 || images[jsonRowIndex]) continue;
            images[jsonRowIndex] = await zipImageToDataURL(mediaPath, mediaFile);
          }
        }
      }
    }

    // Fallback for workbooks without usable drawing anchors.
    if (!hasExtractedImages(images)) {
      const mediaFiles = [];
      zip.forEach((path, entry) => {
        if (path.startsWith('xl/media/') && !entry.dir) {
          mediaFiles.push({ path, entry });
        }
      });
      mediaFiles.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
      for (let i = 0; i < mediaFiles.length; i++) {
        const { path, entry } = mediaFiles[i];
        images[i] = await zipImageToDataURL(path, entry);
      }
    }
  } catch (e) {
    // Silently fail — images are optional
  }
  return images;
}

async function extractRichDataImages(zip, firstSheetPath, images) {
  const richValuesFile = zip.file('xl/richData/rdrichvalue.xml');
  const webImagesFile = zip.file('xl/richData/rdRichValueWebImage.xml');
  const webImagesRelsFile = zip.file('xl/richData/_rels/rdRichValueWebImage.xml.rels');
  const firstSheet = zip.file(firstSheetPath);
  if (!richValuesFile || !webImagesFile || !webImagesRelsFile) return;

  const richValuesDoc = parseXml(await richValuesFile.async('string'));
  const webImagesDoc = parseXml(await webImagesFile.async('string'));
  const webImagesRelsDoc = parseXml(await webImagesRelsFile.async('string'));
  const richValues = (Array.from(richValuesDoc.getElementsByTagName('*')) as Element[]).filter(el => el.localName === 'rv');
  const webImages = (Array.from(webImagesDoc.getElementsByTagName('*')) as Element[]).filter(el => el.localName === 'webImageSrd');
  const richValueImages = [];

  for (let rvIndex = 0; rvIndex < richValues.length; rvIndex++) {
    const values = (Array.from(richValues[rvIndex].children) as Element[]).filter(el => el.localName === 'v').map(el => el.textContent || '');
    const webImageIndex = parseInt(values[0], 10);
    const upcText = normalizeLookupKey(values[4]);
    const webImage = webImages[webImageIndex];
    const blipRelId = getRelId(firstByLocalName(webImage, 'blip'));
    const imageRel = findRelationship(webImagesRelsDoc, blipRelId);
    if (!imageRel) continue;

    const mediaPath = resolveZipPath('xl/richData', imageRel.getAttribute('Target'));
    const mediaFile = zip.file(mediaPath);
    if (!mediaFile) continue;

    const dataUrl = await zipImageToDataURL(mediaPath, mediaFile);
    richValueImages[rvIndex] = dataUrl;
    if (upcText) images.byUpc[upcText] = dataUrl;
  }

  if (!firstSheet) return;
  const sheetDoc = parseXml(await firstSheet.async('string'));
  (Array.from(sheetDoc.getElementsByTagName('*')) as Element[]).filter(el => el.localName === 'c' && el.hasAttribute('vm')).forEach(cell => {
    const cellRef = cell.getAttribute('r') || '';
    const rowNumber = parseInt(cellRef.replace(/^[A-Z]+/, ''), 10);
    const richValueIndex = parseInt(cell.getAttribute('vm'), 10) - 1;
    const dataUrl = richValueImages[richValueIndex];
    if (rowNumber > 1 && dataUrl) images[rowNumber - 2] = dataUrl;
  });
}

function hasExtractedImages(images) {
  return Object.keys(images).some(key => key !== 'byUpc') || Object.keys(images.byUpc || {}).length > 0;
}

async function zipImageToDataURL(path, entry) {
  const blob = await entry.async('blob');
  const ext = path.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return blobToDataURL(blob, mime);
}

function blobToDataURL(blob, mime) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

async function getFirstWorksheetPath(zip) {
  const workbook = zip.file('xl/workbook.xml');
  const workbookRels = zip.file('xl/_rels/workbook.xml.rels');
  if (!workbook || !workbookRels) return 'xl/worksheets/sheet1.xml';

  const workbookDoc = parseXml(await workbook.async('string'));
  const workbookRelsDoc = parseXml(await workbookRels.async('string'));
  const firstSheet = firstByLocalName(workbookDoc, 'sheet');
  const firstSheetRel = findRelationship(workbookRelsDoc, getRelId(firstSheet));
  return firstSheetRel
    ? resolveZipPath('xl', firstSheetRel.getAttribute('Target'))
    : 'xl/worksheets/sheet1.xml';
}

function firstByLocalName(root, name) {
  if (!root) return null;
  return (Array.from(root.getElementsByTagName('*')) as Element[]).find(el => el.localName === name);
}

function getRelId(el) {
  if (!el) return '';
  return el.getAttribute('r:id') || el.getAttribute('r:embed') || el.getAttribute('id') || el.getAttribute('embed') || '';
}

function findRelationship(doc, id) {
  if (!id) return null;
  return (Array.from(doc.getElementsByTagName('*')) as Element[]).find(el =>
    el.localName === 'Relationship' && el.getAttribute('Id') === id
  );
}

function parentPath(path) {
  return path.slice(0, path.lastIndexOf('/'));
}

function relsPathFor(path) {
  const base = parentPath(path);
  const name = path.slice(path.lastIndexOf('/') + 1);
  return `${base}/_rels/${name}.rels`;
}

function resolveZipPath(baseDir, target) {
  if (!target) return '';
  const rawParts = (target.startsWith('/') ? target.slice(1) : `${baseDir}/${target}`).split('/');
  const parts = [];
  rawParts.forEach(part => {
    if (!part || part === '.') return;
    if (part === '..') parts.pop();
    else parts.push(part);
  });
  return parts.join('/');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const STANDARD_HEADERS = new Set([
  'Brand','SKU','UPC','Image','Rank','Status','Style','Material','Grid','Color',
  'Polarized','Size','MSRP','EOL Date','Release','YTD Sls U','Order Level',
  'On Hand U','5-Wk Avg S/T %','Notes','Selected'
]);

function detectCustomHeaders(json) {
  if (!json.length) return [];
  return Object.keys(json[0]).filter(h => !STANDARD_HEADERS.has(h)).slice(0, 2);
}

function loadData(json, embeddedImages: any = {}, options: any = {}) {
  imageMap = options.imageMap || {};

  const customHeaders = options.preparedItems
    ? (json[0] ? [json[0].custom1Label, json[0].custom2Label].filter(Boolean) : [])
    : detectCustomHeaders(json);

  allItems = options.preparedItems ? json : json.map((row, i) => ({
    id: i,
    brand: str(row['Brand']),
    sku: str(row['SKU']),
    upc: str(row['UPC']),
    image: str(row['Image']),
    rank: num(row['Rank']),
    status: str(row['Status']),
    style: str(row['Style']),
    material: str(row['Material']),
    grid: str(row['Grid']),
    color: str(row['Color']),
    polarized: parseBool(row['Polarized']),
    size: str(row['Size']),
    msrp: num(row['MSRP']),
    eol: formatDate(row['EOL Date']),
    release: str(row['Release']),
    ytdSales: num(row['YTD Sls U']),
    orderLevel: num(row['Order Level']),
    onHand: num(row['On Hand U']),
    sellThru: pctNum(row['5-Wk Avg S/T %']),
    notes: str(row['Notes']),
    custom1Label: customHeaders[0] || '',
    custom1: customHeaders[0] ? str(row[customHeaders[0]]) : '',
    custom2Label: customHeaders[1] || '',
    custom2: customHeaders[1] ? str(row[customHeaders[1]]) : '',
  }));

  if (!options.imageMap) {
    // Map images: prefer URL in "Image" column, fall back to embedded images
    allItems.forEach((it, i) => {
      const imageSrc = normalizeImageSrc(it.image);
      const upcKey = normalizeLookupKey(it.upc);
      if (imageSrc) {
        imageMap[it.id] = imageSrc;
      } else if (embeddedImages.byUpc && embeddedImages.byUpc[upcKey]) {
        imageMap[it.id] = embeddedImages.byUpc[upcKey];
      } else if (embeddedImages[i]) {
        // Use extracted embedded image by row index
        imageMap[it.id] = embeddedImages[i];
      }
    });
  }

  notesMap = options.notesMap || {};
  if (!options.notesMap) allItems.forEach(it => { if (it.notes) notesMap[it.id] = it.notes; });
  selectedSet = new Set(options.selectedIds || []);

  // Populate brand filter
  const brands = [...new Set(allItems.map(it => it.brand).filter(Boolean))].sort();
  const brandSel = document.getElementById('filterBrand');
  brandSel.innerHTML = '<option value="">All Brands</option>' + brands.map(b => `<option value="${escAttr(b)}">${escHtml(b)}</option>`).join('');

  const statuses = [...new Set(allItems.map(it => it.status).filter(Boolean))].sort();
  const statusSel = document.getElementById('filterStatus');
  statusSel.innerHTML = '<option value="">All Statuses</option>' + statuses.map(s => `<option value="${escAttr(s)}">${escHtml(s)}</option>`).join('');
  if (options.filters) applyFilterState(options.filters);

  // Show UI
  document.getElementById('landing').style.display = 'none';
  document.getElementById('gridContainer').style.display = '';
  document.getElementById('toolbar').style.display = '';
  document.getElementById('headerStats').style.display = '';
  document.getElementById('btnImages').style.display = '';
  document.getElementById('btnClear').style.display = '';
  document.getElementById('btnExport').style.display = '';

  renderCards();
  showToast(options.restored ? `Restored ${allItems.length} saved SKU${allItems.length !== 1 ? 's' : ''}` : `Loaded ${allItems.length} SKU${allItems.length !== 1 ? 's' : ''}`);
  if (!options.skipAutosave) scheduleAutosave();
}

// ─── Browser autosave ───
function restoreAutosave() {
  readAutosaveSnapshot().then((snapshot: any) => {
    autosaveReady = true;
    if (!snapshot || !snapshot.allItems || !snapshot.allItems.length) return;
    autosaveHydrating = true;
    loadData(snapshot.allItems, {}, {
      preparedItems: true,
      imageMap: snapshot.imageMap || {},
      notesMap: snapshot.notesMap || {},
      selectedIds: snapshot.selectedIds || [],
      filters: snapshot.filters || {},
      restored: true,
      skipAutosave: true,
    });
    autosaveHydrating = false;
  }).catch(() => {
    autosaveReady = false;
  });
}

function scheduleAutosave() {
  if (!autosaveReady || autosaveHydrating || !allItems.length) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveAutosaveSnapshot, 450);
}

function saveAutosaveSnapshot() {
  const snapshot = {
    key: AUTOSAVE_KEY,
    savedAt: new Date().toISOString(),
    allItems,
    imageMap,
    notesMap,
    selectedIds: Array.from(selectedSet),
    filters: getFilterState(),
  };
  writeAutosaveSnapshot(snapshot).catch(() => {
    showToast('Autosave storage is full. Export your selects before closing.');
  });
}

function getFilterState() {
  return {
    brand: document.getElementById('filterBrand').value,
    status: document.getElementById('filterStatus').value,
    polarized: document.getElementById('filterPolarized').value,
    sort: document.getElementById('sortBy').value,
    selection: document.getElementById('filterSelection').value,
    search: document.getElementById('searchInput').value,
  };
}

function applyFilterState(filters) {
  setSelectValue('filterBrand', filters.brand);
  setSelectValue('filterStatus', filters.status);
  setSelectValue('filterPolarized', filters.polarized);
  setSelectValue('sortBy', filters.sort);
  setSelectValue('filterSelection', filters.selection);
  document.getElementById('searchInput').value = filters.search || '';
}

function setSelectValue(id, value) {
  const el = document.getElementById(id);
  if ([...el.options].some(opt => opt.value === value)) el.value = value || '';
}

function openAutosaveDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(AUTOSAVE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(AUTOSAVE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withAutosaveStore(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest) {
  return openAutosaveDb().then(db => new Promise<any>((resolve, reject) => {
    const tx = db.transaction(AUTOSAVE_STORE, mode);
    const store = tx.objectStore(AUTOSAVE_STORE);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

function readAutosaveSnapshot() {
  return withAutosaveStore('readonly', store => store.get(AUTOSAVE_KEY));
}

function writeAutosaveSnapshot(snapshot) {
  return withAutosaveStore('readwrite', store => store.put(snapshot));
}

function deleteAutosaveSnapshot() {
  return withAutosaveStore('readwrite', store => store.delete(AUTOSAVE_KEY));
}

async function clearLineSheet() {
  if (!allItems.length) return;
  const confirmed = window.fashionConfirm
    ? await window.fashionConfirm('Clear the loaded line sheet and saved browser autosave?', {
        title: 'Clear Line Sheet',
        confirmLabel: 'Clear',
      })
    : confirm('Clear the loaded line sheet and saved browser autosave?');
  if (!confirmed) return;

  clearTimeout(autosaveTimer);
  allItems = [];
  selectedSet = new Set();
  notesMap = {};
  imageMap = {};

  document.getElementById('fileInput').value = '';
  document.getElementById('fileInputLanding').value = '';
  document.getElementById('imageFolder').value = '';
  document.getElementById('filterBrand').innerHTML = '<option value="">All</option>';
  document.getElementById('filterStatus').innerHTML = '<option value="">All</option>';
  document.getElementById('filterPolarized').value = '';
  document.getElementById('sortBy').value = 'rank-asc';
  document.getElementById('filterSelection').value = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('cardGrid').innerHTML = '';
  document.getElementById('statTotal').textContent = '0';
  document.getElementById('statSelected').textContent = '0';
  document.getElementById('statFiltered').textContent = '0';
  document.getElementById('landing').style.display = '';
  document.getElementById('gridContainer').style.display = 'none';
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('headerStats').style.display = 'none';
  document.getElementById('btnImages').style.display = 'none';
  document.getElementById('btnClear').style.display = 'none';
  document.getElementById('btnExport').style.display = 'none';
  updateSelectionBar();
  closeLightbox();

  deleteAutosaveSnapshot()
    .then(() => showToast('Line sheet cleared'))
    .catch(() => showToast('Line sheet cleared. Autosave could not be removed.'));
}

// ─── Helpers ───
function str(v) { return v == null ? '' : String(v).trim(); }
function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function pctNum(v) {
  if (v == null || v === '') return 0;
  const raw = String(v).trim();
  const n = parseFloat(raw.replace('%', ''));
  if (isNaN(n)) return 0;
  return raw.includes('%') || n > 1 ? n / 100 : n;
}
function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  return s === 'true' || s === 'yes' || s === '1';
}
function formatDate(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return v.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }
  try {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  } catch {}
  return str(v);
}
function formatPct(v) {
  if (!v && v !== 0) return '—';
  return (v * 100).toFixed(1) + '%';
}
function formatCurrency(v) {
  if (!v && v !== 0) return '—';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function normalizeImageSrc(v) {
  const s = str(v);
  if (!s) return '';
  if (/^#(VALUE|N\/A|REF|NAME|NULL|DIV\/0|NUM)!?$/i.test(s)) return '';
  const imageFormula = s.match(/^=IMAGE\(\s*"([^"]+)"/i);
  return imageFormula ? imageFormula[1] : s;
}
function normalizeLookupKey(v) {
  return str(v).replace(/\D/g, '');
}

// ─── Render ───
function getFiltered() {
  const brand = document.getElementById('filterBrand').value;
  const status = document.getElementById('filterStatus').value;
  const polarized = document.getElementById('filterPolarized').value;
  const sel = document.getElementById('filterSelection').value;
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const sort = document.getElementById('sortBy').value;

  let items = [...allItems];

  if (brand) items = items.filter(it => it.brand === brand);
  if (status) items = items.filter(it => it.status === status);
  if (polarized) items = items.filter(it => String(it.polarized) === polarized);
  if (sel === 'selected') items = items.filter(it => selectedSet.has(it.id));
  if (sel === 'unselected') items = items.filter(it => !selectedSet.has(it.id));
  if (search) items = items.filter(it =>
    it.style.toLowerCase().includes(search) ||
    it.sku.toLowerCase().includes(search) ||
    it.color.toLowerCase().includes(search) ||
    it.brand.toLowerCase().includes(search) ||
    it.material.toLowerCase().includes(search)
  );

  // Sort
  const [field, dir] = sort.split('-');
  const mul = dir === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    let va, vb;
    if (field === 'rank') {
      const aMissing = !a.rank;
      const bMissing = !b.rank;
      if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
      va = a.rank; vb = b.rank;
    }
    else if (field === 'price') { va = a.msrp; vb = b.msrp; }
    else if (field === 'brand') { va = a.brand.toLowerCase(); vb = b.brand.toLowerCase(); return va < vb ? -1 * mul : va > vb ? 1 * mul : 0; }
    else if (field === 'sell') { va = a.sellThru; vb = b.sellThru; }
    else { va = a.rank; vb = b.rank; }
    return (va - vb) * mul;
  });

  return items;
}

function renderCards() {
  const items = getFiltered();
  const grid = document.getElementById('cardGrid');

  document.getElementById('statTotal').textContent = allItems.length;
  document.getElementById('statSelected').textContent = selectedSet.size;
  document.getElementById('statFiltered').textContent = items.length;

  if (!items.length) {
    grid.innerHTML = '<div class="empty-state"><p>No SKUs match current filters.</p></div>';
    updateSelectionBar();
    scheduleAutosave();
    return;
  }

  grid.innerHTML = items.map(it => {
    const isSel = selectedSet.has(it.id);
    const note = notesMap[it.id] || '';
    const imgSrc = imageMap[it.id] || '';
    const hasImg = !!imgSrc;
    return `
    <div class="card ${isSel ? 'selected' : ''}" data-id="${it.id}" onclick="toggleSelect(event, ${it.id})">
      <div class="card-rank">Rank<strong>#${it.rank || '—'}</strong></div>
      <div class="card-top">
        <div class="card-image-area ${hasImg ? 'has-image' : ''}" ${hasImg ? `onclick="openLightbox(event, ${it.id})"` : ''}>
          ${hasImg
            ? `<img src="${escAttr(imgSrc)}" alt="${escAttr(it.brand + ' ' + it.style)}" loading="lazy">`
            : `<div class="card-image-placeholder">No Image</div>`
          }
        </div>
        <div class="card-info-area">
          <div class="card-brand">${escHtml(it.brand)}</div>
          <div class="card-style">${escHtml(it.style)}</div>
          <div class="card-color-row">
            <span class="card-color-dot" style="background:${guessColor(it.color)}"></span>
            <span class="card-color-name">${escHtml(it.color) || '—'}</span>
          </div>
          <div class="card-msrp">MSRP ${formatCurrency(it.msrp)}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-stat">
          <span class="card-stat-label">Material</span>
          <span class="card-stat-value">${escHtml(it.material) || '—'}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">Size</span>
          <span class="card-stat-value">${escHtml(it.size) || '—'}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">Polarized</span>
          <span class="card-stat-value ${it.polarized ? 'polarized-yes' : 'polarized-no'}">${it.polarized ? 'Yes' : 'No'}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">Release</span>
          <span class="card-stat-value">${escHtml(it.release) || '—'}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">YTD Sales</span>
          <span class="card-stat-value highlight">${it.ytdSales.toLocaleString()}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">Order Level</span>
          <span class="card-stat-value">${it.orderLevel.toLocaleString()}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">On Hand</span>
          <span class="card-stat-value">${it.onHand.toLocaleString()}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">5-Wk S/T</span>
          <span class="card-stat-value highlight">${formatPct(it.sellThru)}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">EOL</span>
          <span class="card-stat-value">${escHtml(it.eol) || '—'}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">Grid</span>
          <span class="card-stat-value">${escHtml(it.grid) || '—'}</span>
        </div>
        ${it.custom1Label ? `
        <div class="card-stat">
          <span class="card-stat-label">${escHtml(it.custom1Label)}</span>
          <span class="card-stat-value">${escHtml(it.custom1) || '—'}</span>
        </div>` : ''}
        ${it.custom2Label ? `
        <div class="card-stat">
          <span class="card-stat-label">${escHtml(it.custom2Label)}</span>
          <span class="card-stat-value">${escHtml(it.custom2) || '—'}</span>
        </div>` : ''}
      </div>
      <div class="card-ids">
      <span><strong>SKU:</strong> ${escHtml(it.sku)}</span>
      <span><strong>UPC:</strong> ${escHtml(it.upc)}</span>
      <span class="status-${escAttr(statusClass(it.status))}">
      <strong>Status:</strong> ${escHtml(it.status) || '—'}
      </span>
      </div>
      <div class="card-footer">
        <textarea class="card-notes"
          placeholder="Add notes…"
          onclick="event.stopPropagation()"
          oninput="saveNote(${it.id}, this.value)"
        >${escHtml(note)}</textarea>
      </div>
    </div>`;
  }).join('');

  updateSelectionBar();
  scheduleAutosave();
}

// ─── Selection ───
function toggleSelect(e, id) {
  if (e.target.tagName === 'TEXTAREA') return;
  // Don't toggle selection when clicking on image area
  if (e.target.closest('.has-image')) return;
  const cardEl = e.currentTarget;
  if (cardEl) cardEl.classList.add('is-pressing');
  if (selectedSet.has(id)) selectedSet.delete(id);
  else selectedSet.add(id);
  // Toggle only the clicked card's class — avoid rebuilding the whole grid
  // (was hundreds of ms per click with thousands of cards).
  if (cardEl) {
    cardEl.classList.toggle('selected', selectedSet.has(id));
    if (typeof window.refreshCloonkCursorLabel === 'function') window.refreshCloonkCursorLabel(cardEl);
    requestAnimationFrame(() => cardEl.classList.remove('is-pressing'));
  }
  document.getElementById('statSelected').textContent = selectedSet.size;
  updateSelectionBar();
  scheduleAutosave();
}

// ─── Presentation Mode ───
function openLightbox(e, id) {
  if (e) e.stopPropagation();
  const item = allItems.find(it => it.id === id);
  if (!item) return;
  const lb = document.getElementById('lightbox');
  renderPresentationItem(item);
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderPresentationItem(item) {
  const imgSrc = imageMap[item.id] || '';
  const photo = document.getElementById('presentationPhoto');
  const img = document.getElementById('lightboxImg');
  activePresentationId = item.id;
  img.src = imgSrc;
  photo.classList.toggle('no-image', !imgSrc);
  document.getElementById('lightboxImg').alt = [item.brand, item.style, item.color].filter(Boolean).join(' ');
  document.getElementById('presentationRank').textContent = `Rank #${item.rank || '-'}`;
  document.getElementById('presentationStatus').textContent = item.status || 'Status -';
  document.getElementById('presentationTitle').textContent = item.style || item.sku || 'Untitled SKU';
  document.getElementById('presentationSubtitle').textContent = [item.brand, item.color, formatCurrency(item.msrp)].filter(Boolean).join(' / ');
  document.getElementById('presentationSpecs').innerHTML = getPresentationSpecs(item)
    .map(spec => `
      <div class="presentation-spec ${spec.wide ? 'presentation-spec--wide' : ''}">
        <dt>${escHtml(spec.label)}</dt>
        <dd>${escHtml(spec.value) || '-'}</dd>
      </div>
    `).join('');

  const notes = document.getElementById('presentationNotes');
  notes.value = notesMap[item.id] || '';
  notes.oninput = () => {
    notesMap[item.id] = notes.value;
    const cardNotes = document.querySelector(`.card[data-id="${item.id}"] .card-notes`);
    if (cardNotes && cardNotes.value !== notes.value) cardNotes.value = notes.value;
    scheduleAutosave();
  };

  document.getElementById('presentationSelected').textContent = selectedSet.has(item.id)
    ? 'Selected for export.'
    : 'Not selected for export. Click the product card behind this view to change selection.';
  updatePresentationNav();
}

function getPresentationSpecs(item) {
  const specs = [
    ['SKU', item.sku],
    ['UPC', item.upc],
    ['Material', item.material],
    ['Grid', item.grid],
    ['Color', item.color],
    ['Size', item.size],
    ['Polarized', item.polarized ? 'Yes' : 'No'],
    ['MSRP', formatCurrency(item.msrp)],
    ['Release', item.release],
    ['EOL', item.eol],
    ['YTD Sales', item.ytdSales.toLocaleString()],
    ['Order Level', item.orderLevel.toLocaleString()],
    ['On Hand', item.onHand.toLocaleString()],
    ['5-Wk S/T', formatPct(item.sellThru)]
  ];
  if (item.custom1Label) specs.push([item.custom1Label, item.custom1, true]);
  if (item.custom2Label) specs.push([item.custom2Label, item.custom2, true]);
  return specs.map(([label, value, wide]) => ({ label, value, wide }));
}

function getPresentationList() {
  return getFiltered();
}

function updatePresentationNav() {
  const items = getPresentationList();
  const index = items.findIndex(it => it.id === activePresentationId);
  const hasPosition = index >= 0;
  document.getElementById('presentationPrev').disabled = !hasPosition || index === 0;
  document.getElementById('presentationNext').disabled = !hasPosition || index === items.length - 1;
  document.getElementById('presentationPosition').textContent = hasPosition
    ? `${index + 1} of ${items.length} visible SKU${items.length !== 1 ? 's' : ''}`
    : 'Current SKU is outside the visible list';
}

function navigatePresentation(e, direction) {
  if (e) e.stopPropagation();
  const items = getPresentationList();
  const index = items.findIndex(it => it.id === activePresentationId);
  if (index < 0) return;
  const next = items[index + direction];
  if (!next) return;
  renderPresentationItem(next);
}

function closeLightbox(e?: Event) {
  // Keep presentation controls interactive; only the backdrop and close button dismiss.
  if (e && e.target.closest && e.target.closest('.presentation-shell')) return;
  const lb = document.getElementById('lightbox');
  lb.classList.remove('open');
  activePresentationId = null;
  document.body.style.overflow = '';
}

// Close lightbox on Escape
document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (e.key === 'Escape') closeLightbox();
  if (!lb || !lb.classList.contains('open')) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === 'ArrowLeft') navigatePresentation(e, -1);
  if (e.key === 'ArrowRight') navigatePresentation(e, 1);
});

// ─── Info / Appendix modal ───
(function setupInfoModal() {
  const overlay = document.getElementById('infoModalOverlay');
  const btn     = document.getElementById('infoBtn');
  const closeBtn = document.getElementById('infoModalClose');
  if (!overlay || !btn) return;

  function openModal(tab?: string) {
    overlay.classList.add('open');
    if (tab) showTab(tab);
  }
  function closeModal() { overlay.classList.remove('open'); }

  function showTab(name) {
    document.querySelectorAll('.info-modal-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.info-modal-pane').forEach(p =>
      p.classList.toggle('active', p.id === 'modal-tab-' + name));
  }

  btn.addEventListener('click', () => openModal());
  closeBtn.addEventListener('click', closeModal);

  // Click outside the modal closes it.
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Tab switching.
  document.querySelectorAll('.info-modal-tab').forEach(tab => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  // Escape closes modal (handled before the lightbox Escape since lightbox is
  // separate; this also no-ops if the modal isn't open).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  // Mark the link to the current page so the Resources tab highlights it.
  const here = location.pathname.split('/').pop() || 'index.html';
  overlay.querySelectorAll('.info-link').forEach(a => {
    const target = a.getAttribute('href').split('/').pop();
    if (target && target === here) a.setAttribute('aria-current', 'page');
  });
})();

// ─── Theme toggle (shared with cloonk.com via `cloonk-theme` key) ───
// Icon swap is handled in CSS by the [data-theme="light"] selector.
// Swap is a single viewport-level cross-fade via the View Transitions API,
// so the 280-ms animation runs once for the whole page instead of firing
// per-element on every card (which lagged on big sheets).
function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
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
function toggleTheme() { swapTheme(isLightTheme() ? 'dark' : 'light'); }
// If another cloonk tab toggles the theme, mirror it here.
window.addEventListener('storage', (e) => {
  if (e.key !== 'cloonk-theme') return;
  swapTheme(e.newValue === 'light' ? 'light' : 'dark');
});

// ─── HTML escape ───
function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return escHtml(s).replace(/'/g, '&#39;');
}
function statusClass(status) {
  return str(status).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function selectAll() {
  getFiltered().forEach(it => selectedSet.add(it.id));
  // Walk existing DOM instead of rebuilding the grid.
  document.querySelectorAll('#cardGrid .card').forEach(el => {
    const id = Number(el.dataset.id);
    if (selectedSet.has(id)) el.classList.add('selected');
  });
  if (typeof window.refreshCloonkCursorLabel === 'function') window.refreshCloonkCursorLabel();
  document.getElementById('statSelected').textContent = selectedSet.size;
  updateSelectionBar();
  scheduleAutosave();
}

function deselectAll() {
  selectedSet.clear();
  document.querySelectorAll('#cardGrid .card.selected').forEach(el => {
    el.classList.remove('selected');
  });
  if (typeof window.refreshCloonkCursorLabel === 'function') window.refreshCloonkCursorLabel();
  document.getElementById('statSelected').textContent = 0;
  updateSelectionBar();
  scheduleAutosave();
}

function updateSelectionBar() {
  const bar = document.getElementById('selectionBar');
  const count = selectedSet.size;
  document.getElementById('selBarCount').textContent = count;
  bar.classList.toggle('visible', count > 0);
}

// ─── Notes ───
function saveNote(id, val) {
  notesMap[id] = val;
  if (activePresentationId === id) {
    const notes = document.getElementById('presentationNotes');
    if (notes && notes.value !== val) notes.value = val;
  }
  scheduleAutosave();
}

// ─── Export ───
function exportSelects() {
  if (!isSheetJsReady()) return;
  const selected = allItems.filter(it => selectedSet.has(it.id));
  if (!selected.length) { showToast('Select at least one SKU to export.'); return; }

  const rows = selected.map(it => {
    const row = {
      'Brand': it.brand,
      'SKU': it.sku,
      'UPC': it.upc,
      'Image': it.image || '',
      'Rank': it.rank,
      'Style': it.style,
      'Material': it.material,
      'Grid': it.grid,
      'Color': it.color,
      'Polarized': it.polarized,
      'Size': it.size,
      'MSRP': it.msrp,
      'EOL Date': it.eol,
      'Release': it.release,
      'YTD Sls U': it.ytdSales,
      'Order Level': it.orderLevel,
      'On Hand U': it.onHand,
      '5-Wk Avg S/T %': it.sellThru,
    };
    if (it.custom1Label) row[it.custom1Label] = it.custom1;
    if (it.custom2Label) row[it.custom2Label] = it.custom2;
    row['Notes'] = notesMap[it.id] || '';
    row['Selected'] = 'YES';
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Selects');

  // Column widths
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }));

  XLSX.writeFile(wb, `RP_Selects_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast(`Exported ${selected.length} SKU${selected.length !== 1 ? 's' : ''}`);
}

// ─── Template download ───
function downloadTemplate() {
  if (!isSheetJsReady()) return;
  const headers = ['Brand','SKU','UPC','Image','Rank','Status','Style','Material','Grid','Color','Polarized','Size','MSRP','EOL Date','Release','YTD Sls U','Order Level','On Hand U','5-Wk Avg S/T %','Custom 1','Custom 2','Notes'];
  const sample = ['Brand Alpha','SKU-1001','900000100001','',1,'Active','ALP-100','Metal','G-101','Black',false,54,145,'2026-11-22','Core 2026',341,244,194,0.44,'Core door','Replenish','Synthetic example row'];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, 'RP_Line_Sheet_Template.xlsx');
  showToast('Template downloaded');
}

function getLineSheetSampleRows() {
  return [
    { Brand:'Brand Alpha', SKU:'SKU-1001', UPC:'900000100001', Image:'', Rank:1, Status:'Active', Style:'ALP-100', Material:'Metal', Grid:'G-101', Color:'Black', Polarized:false, Size:54, MSRP:145, 'EOL Date':'2026-11-22', Release:'Core 2026', 'YTD Sls U':341, 'Order Level':244, 'On Hand U':194, '5-Wk Avg S/T %':0.44, 'Assortment Role':'Core door', 'Planner Flag':'Replenish', Notes:'Healthy velocity with enough stock for review' },
    { Brand:'Brand Alpha', SKU:'SKU-1002', UPC:'900000100002', Image:'', Rank:2, Status:'Active', Style:'ALP-120', Material:'Acetate', Grid:'G-104', Color:'Tortoise', Polarized:true, Size:52, MSRP:165, 'EOL Date':'2026-12-15', Release:'Seasonal 2026', 'YTD Sls U':218, 'Order Level':188, 'On Hand U':82, '5-Wk Avg S/T %':0.51, 'Assortment Role':'Seasonal read', 'Planner Flag':'Watch depth', Notes:'Strong sell-through, narrow size coverage' },
    { Brand:'Brand Alpha', SKU:'SKU-1003', UPC:'900000100003', Image:'', Rank:8, Status:'Review', Style:'ALP-140', Material:'Mixed', Grid:'G-140', Color:'Smoke', Polarized:false, Size:56, MSRP:155, 'EOL Date':'2026-08-01', Release:'Test 2026', 'YTD Sls U':64, 'Order Level':96, 'On Hand U':118, '5-Wk Avg S/T %':0.18, 'Assortment Role':'Test', 'Planner Flag':'Reduce', Notes:'Low turn and above-plan on hand' },
    { Brand:'Brand Beta', SKU:'SKU-2001', UPC:'900000200001', Image:'', Rank:3, Status:'Active', Style:'BET-210', Material:'Acetate', Grid:'G-210', Color:'Navy', Polarized:false, Size:53, MSRP:120, 'EOL Date':'2027-01-30', Release:'Core 2026', 'YTD Sls U':289, 'Order Level':210, 'On Hand U':76, '5-Wk Avg S/T %':0.57, 'Assortment Role':'Core door', 'Planner Flag':'Replenish', Notes:'Good replenishment candidate' },
    { Brand:'Brand Beta', SKU:'SKU-2002', UPC:'900000200002', Image:'', Rank:6, Status:'Active', Style:'BET-230', Material:'Metal', Grid:'G-230', Color:'Gold', Polarized:false, Size:51, MSRP:132, 'EOL Date':'2026-10-18', Release:'Core 2026', 'YTD Sls U':122, 'Order Level':138, 'On Hand U':141, '5-Wk Avg S/T %':0.31, 'Assortment Role':'Volume support', 'Planner Flag':'Hold', Notes:'Stable but not urgent' },
    { Brand:'Brand Beta', SKU:'SKU-2003', UPC:'900000200003', Image:'', Rank:11, Status:'Exit', Style:'BET-205', Material:'Acetate', Grid:'G-205', Color:'Crystal', Polarized:false, Size:50, MSRP:118, 'EOL Date':'2026-06-30', Release:'Archive', 'YTD Sls U':44, 'Order Level':0, 'On Hand U':97, '5-Wk Avg S/T %':0.12, 'Assortment Role':'Archive', 'Planner Flag':'Exit', Notes:'Clear remaining inventory' },
    { Brand:'Brand Gamma', SKU:'SKU-3001', UPC:'900000300001', Image:'', Rank:4, Status:'Active', Style:'GAM-300', Material:'Injected', Grid:'G-300', Color:'Olive', Polarized:true, Size:58, MSRP:98, 'EOL Date':'2027-03-15', Release:'Launch 2026', 'YTD Sls U':176, 'Order Level':152, 'On Hand U':45, '5-Wk Avg S/T %':0.63, 'Assortment Role':'Performance', 'Planner Flag':'Replenish', Notes:'Fastest recent sell-through' },
    { Brand:'Brand Gamma', SKU:'SKU-3002', UPC:'900000300002', Image:'', Rank:7, Status:'Review', Style:'GAM-315', Material:'Injected', Grid:'G-315', Color:'Matte Blue', Polarized:true, Size:60, MSRP:104, 'EOL Date':'2026-09-20', Release:'Launch 2026', 'YTD Sls U':93, 'Order Level':86, 'On Hand U':111, '5-Wk Avg S/T %':0.28, 'Assortment Role':'Performance', 'Planner Flag':'Monitor', Notes:'Polarized mix needs door review' },
    { Brand:'Brand Delta', SKU:'SKU-4001', UPC:'900000400001', Image:'', Rank:5, Status:'Active', Style:'DEL-410', Material:'Titanium', Grid:'G-410', Color:'Silver', Polarized:false, Size:55, MSRP:210, 'EOL Date':'2027-02-10', Release:'Limited 2026', 'YTD Sls U':81, 'Order Level':60, 'On Hand U':24, '5-Wk Avg S/T %':0.49, 'Assortment Role':'Premium capsule', 'Planner Flag':'Protect', Notes:'Low depth but healthy premium productivity' },
    { Brand:'Brand Echo', SKU:'SKU-5001', UPC:'900000500001', Image:'', Rank:9, Status:'Test', Style:'ECH-500', Material:'Bio acetate', Grid:'G-500', Color:'Sage', Polarized:false, Size:49, MSRP:135, 'EOL Date':'2026-11-05', Release:'Test 2026', 'YTD Sls U':37, 'Order Level':48, 'On Hand U':52, '5-Wk Avg S/T %':0.22, 'Assortment Role':'New concept', 'Planner Flag':'Read', Notes:'Sample row with newer concept status' },
    { Brand:'Brand Echo', SKU:'SKU-5002', UPC:'', Image:'', Rank:12, Status:'Review', Style:'ECH-520', Material:'Bio acetate', Grid:'G-520', Color:'Amber', Polarized:false, Size:51, MSRP:135, 'EOL Date':'', Release:'Test 2026', 'YTD Sls U':18, 'Order Level':30, 'On Hand U':68, '5-Wk Avg S/T %':0.09, 'Assortment Role':'New concept', 'Planner Flag':'Validate UPC', Notes:'Missing UPC included to test cleanup workflows' },
    { Brand:'Brand Delta', SKU:'SKU-4002', UPC:'900000400002', Image:'', Rank:10, Status:'Active', Style:'DEL-430', Material:'Titanium', Grid:'G-430', Color:'Gunmetal', Polarized:true, Size:57, MSRP:225, 'EOL Date':'2027-04-01', Release:'Limited 2026', 'YTD Sls U':69, 'Order Level':54, 'On Hand U':33, '5-Wk Avg S/T %':0.39, 'Assortment Role':'Premium capsule', 'Planner Flag':'Hold', Notes:'' }
  ];
}

function downloadSampleData() {
  if (!isSheetJsReady()) return;
  const rows = getLineSheetSampleRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Line Sheet Sample');
  XLSX.writeFile(wb, 'RP_Line_Sheet_Sample_Data.xlsx');
  showToast('Sample data downloaded');
}

function loadSampleData() {
  loadData(getLineSheetSampleRows(), {}, {
    filters: {
      brand: '',
      status: '',
      polarized: '',
      sort: 'rank-asc',
      selection: '',
      search: '',
    },
  });
  showToast('Loaded anonymized sample line sheet');
}

// ─── Toast ───
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2800);
}

function isSheetJsReady() {
  if (typeof XLSX !== 'undefined') return true;
  showToast('Spreadsheet tools are unavailable. Check your internet connection and reload.');
  return false;
}
