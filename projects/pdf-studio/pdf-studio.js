/* ============================================================
   PDF Studio — pdf-studio.js
   A local, browser-based PDF + media toolkit.
   Rendering : pdf.js   (ESM import)
   Editing   : pdf-lib  (global PDFLib)
   Zipping   : JSZip     (global JSZip)
   Nothing leaves the browser.
   ============================================================ */

import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';

const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;

/* ── tiny helpers ─────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const overlay = $('#overlay');
const overlayMsg = $('#overlay-msg');
let overlayDepth = 0;
function busy(msg = 'Working…') { overlayDepth++; overlayMsg.textContent = msg; overlay.hidden = false; }
function done() { overlayDepth = Math.max(0, overlayDepth - 1); if (!overlayDepth) overlay.hidden = true; }

const toastEl = $('#toast');
let toastTimer;
function toast(msg, isErr = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('err', isErr);
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => (toastEl.hidden = true), 250);
  }, isErr ? 4200 : 2600);
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function readAsArrayBuffer(file) {
  return file.arrayBuffer();
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function baseName(name = 'document.pdf') {
  return name.replace(/\.[^.]+$/, '');
}

async function wrap(msg, fn) {
  busy(msg);
  try { return await fn(); }
  catch (e) { console.error(e); toast(e.message || 'Something went wrong', true); }
  finally { done(); }
}

/* ── theme toggle ─────────────────────────────────────────── */
$('#theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const light = root.getAttribute('data-theme') === 'light';
  const next = light ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('cloonk-theme', next); } catch (e) {}
});

/* ── tab / rail switching ─────────────────────────────────── */
const railBtns = $$('.rail-btn');
const panels = $$('.panel');
function showTool(tool) {
  railBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  panels.forEach(p => p.classList.toggle('active', p.dataset.panel === tool));
}
railBtns.forEach(b => b.addEventListener('click', () => showTool(b.dataset.tool)));

/* ── generic dropzone wiring ──────────────────────────────────
   Wires a dropzone + hidden <input> + browse link to a handler
   that receives a FileList. ───────────────────────────────── */
function wireDrop({ zone, input, browse, onFiles, accept }) {
  const z = $(zone), inp = $(input), br = browse && $(browse);
  const pass = (files) => {
    const list = [...files].filter(f => !accept || accept(f));
    if (list.length) onFiles(list);
    else if (files.length) toast('Unsupported file type', true);
  };
  z.addEventListener('click', (e) => { if (e.target.closest('.link-btn')) return; inp.click(); });
  if (br) br.addEventListener('click', (e) => { e.stopPropagation(); inp.click(); });
  inp.addEventListener('change', () => { if (inp.files.length) pass(inp.files); inp.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => z.addEventListener(ev, (e) => {
    e.preventDefault(); z.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, (e) => {
    e.preventDefault(); if (ev === 'dragleave' && z.contains(e.relatedTarget)) return;
    z.classList.remove('drag');
  }));
  z.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) pass(e.dataTransfer.files); });
}

const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImg = (f) => f.type.startsWith('image/');

/* ── drag-to-reorder helper for card/thumb lists ──────────────
   Reorders `arr` in place and calls render() when an item is
   dropped onto another. ───────────────────────────────────── */
function makeSortable(container, itemSelector, arr, render) {
  let dragIdx = null;
  container.addEventListener('dragstart', (e) => {
    const el = e.target.closest(itemSelector);
    if (!el) return;
    dragIdx = +el.dataset.idx;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  container.addEventListener('dragend', (e) => {
    e.target.closest(itemSelector)?.classList.remove('dragging');
    $$(itemSelector, container).forEach(el => el.classList.remove('over'));
  });
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const el = e.target.closest(itemSelector);
    $$(itemSelector, container).forEach(x => x.classList.toggle('over', x === el && +el.dataset.idx !== dragIdx));
  });
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const el = e.target.closest(itemSelector);
    if (!el || dragIdx === null) return;
    const dropIdx = +el.dataset.idx;
    if (dropIdx === dragIdx) return;
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(dropIdx, 0, moved);
    dragIdx = null;
    render();
  });
}

/* helper: load pdf.js document from bytes (always pass a copy) */
function loadPdfjs(bytes) {
  return pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
}

/* render a pdf.js page to a fresh canvas at `scale` */
async function renderPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(res => canvas.toBlob(res, type, quality));
}

/* ============================================================
   1. ORGANIZE & VIEW
   ============================================================ */
const org = {
  bytes: null,          // Uint8Array master
  name: 'document.pdf',
  doc: null,            // pdf.js doc
  order: [],            // [{ orig: pageIndex, rot: 0 }]
  current: 0,
  zoom: 1.1,
  matches: [],          // page indices (0-based, original) with search hits
  matchPtr: -1,
};

wireDrop({
  zone: '#organize-drop', input: '#organize-file', browse: '#organize-browse',
  accept: isPdf, onFiles: (f) => openOrganize(f[0]),
});

async function openOrganize(file) {
  await wrap('Opening PDF…', async () => {
    const buf = new Uint8Array(await readAsArrayBuffer(file));
    org.bytes = buf;
    org.name = file.name;
    org.doc = await loadPdfjs(buf);
    org.order = Array.from({ length: org.doc.numPages }, (_, i) => ({ orig: i, rot: 0 }));
    org.current = 0; org.matches = []; org.matchPtr = -1;
    $('#organize-drop').hidden = true;
    $('#organize-stage').hidden = false;
    $('#organize-tools').hidden = false;
    $('#org-export').disabled = false;
    $('#search-count').textContent = '';
    $('#search-input').value = '';
    await buildThumbs();
    await renderViewer();
  });
}

async function buildThumbs() {
  const wrapEl = $('#thumbs');
  wrapEl.innerHTML = '';
  for (let i = 0; i < org.order.length; i++) {
    const { orig, rot } = org.order[i];
    const page = await org.doc.getPage(orig + 1);
    const vp = page.getViewport({ scale: 0.28, rotation: (page.rotate + rot) % 360 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

    const cell = document.createElement('div');
    cell.className = 'thumb' + (i === org.current ? ' active' : '');
    cell.draggable = true;
    cell.dataset.idx = i;
    cell.append(canvas);
    const num = document.createElement('span');
    num.className = 't-num'; num.textContent = i + 1;
    cell.append(num);
    const actions = document.createElement('div');
    actions.className = 't-actions';
    actions.innerHTML =
      `<button class="t-btn" data-act="rot" title="Rotate">↻</button>` +
      `<button class="t-btn" data-act="del" title="Delete">✕</button>`;
    cell.append(actions);
    cell.addEventListener('click', (e) => {
      const act = e.target.closest('.t-btn')?.dataset.act;
      if (act === 'rot') { org.order[i].rot = (org.order[i].rot + 90) % 360; refreshThumbsAndView(); }
      else if (act === 'del') { deletePage(i); }
      else { org.current = i; renderViewer(); markActiveThumb(); }
    });
    wrapEl.append(cell);
  }
}

function markActiveThumb() {
  $$('#thumbs .thumb').forEach((t, i) => t.classList.toggle('active', i === org.current));
}

async function refreshThumbsAndView() {
  await buildThumbs();
  await renderViewer();
}

function deletePage(i) {
  if (org.order.length <= 1) { toast('A PDF needs at least one page', true); return; }
  org.order.splice(i, 1);
  if (org.current >= org.order.length) org.current = org.order.length - 1;
  refreshThumbsAndView();
}

async function renderViewer() {
  if (!org.order.length) return;
  const { orig, rot } = org.order[org.current];
  const page = await org.doc.getPage(orig + 1);
  const vp = page.getViewport({ scale: org.zoom, rotation: (page.rotate + rot) % 360 });
  const canvas = $('#page-canvas');
  canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  $('#page-indicator').textContent = `${org.current + 1} / ${org.order.length}`;
  $('#zoom-indicator').textContent = Math.round(org.zoom / 1.1 * 100) + '%';
}

$('#page-prev').addEventListener('click', () => { if (org.current > 0) { org.current--; renderViewer(); markActiveThumb(); } });
$('#page-next').addEventListener('click', () => { if (org.current < org.order.length - 1) { org.current++; renderViewer(); markActiveThumb(); } });
$('#zoom-in').addEventListener('click', () => { org.zoom = Math.min(4.4, org.zoom + 0.275); renderViewer(); });
$('#zoom-out').addEventListener('click', () => { org.zoom = Math.max(0.385, org.zoom - 0.275); renderViewer(); });
$('#org-rotate-all').addEventListener('click', () => {
  org.order.forEach(p => p.rot = (p.rot + 90) % 360);
  refreshThumbsAndView();
});

/* search: scan every page's text, collect matching page indices */
let searchDebounce;
$('#search-input').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(e.target.value.trim()), 280);
});
$('#search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') jumpNextMatch();
});

async function runSearch(term) {
  const countEl = $('#search-count');
  org.matches = []; org.matchPtr = -1;
  if (!term) { countEl.textContent = ''; return; }
  await wrap('Searching…', async () => {
    let total = 0;
    const needle = term.toLowerCase();
    for (let i = 0; i < org.order.length; i++) {
      const page = await org.doc.getPage(org.order[i].orig + 1);
      const tc = await page.getTextContent();
      const text = tc.items.map(it => it.str).join(' ').toLowerCase();
      let idx = text.indexOf(needle), hits = 0;
      while (idx !== -1) { hits++; idx = text.indexOf(needle, idx + needle.length); }
      if (hits) { org.matches.push(i); total += hits; }
    }
    countEl.textContent = total
      ? `${total} match${total > 1 ? 'es' : ''} · ${org.matches.length} page${org.matches.length > 1 ? 's' : ''}`
      : 'no matches';
    if (org.matches.length) jumpNextMatch();
  });
}

function jumpNextMatch() {
  if (!org.matches.length) return;
  org.matchPtr = (org.matchPtr + 1) % org.matches.length;
  org.current = org.matches[org.matchPtr];
  renderViewer(); markActiveThumb();
  $$('#thumbs .thumb')[org.current]?.scrollIntoView({ block: 'nearest' });
}

$('#print-btn').addEventListener('click', () => printCurrent());
async function printCurrent() {
  // Export the current arrangement, open in a hidden iframe, print.
  await wrap('Preparing print…', async () => {
    const blob = await buildOrganizedPdf();
    const url = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed'; frame.style.right = '0'; frame.style.bottom = '0';
    frame.style.width = '0'; frame.style.height = '0'; frame.style.border = '0';
    frame.src = url;
    frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
    document.body.append(frame);
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
  });
}

/* build a pdf-lib doc honoring order + rotations */
async function buildOrganizedPdf() {
  const src = await PDFDocument.load(org.bytes.slice());
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, org.order.map(p => p.orig));
  org.order.forEach((p, i) => {
    const page = copied[i];
    if (p.rot) {
      const cur = page.getRotation().angle;
      page.setRotation(degrees((cur + p.rot) % 360));
    }
    out.addPage(page);
  });
  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

$('#org-export').addEventListener('click', () => wrap('Exporting…', async () => {
  const blob = await buildOrganizedPdf();
  download(blob, baseName(org.name) + '-edited.pdf');
  toast('Exported');
}));

/* ============================================================
   2. MERGE  (PDFs + images, drag to order)
   ============================================================ */
let mergeItems = []; // { file, kind:'pdf'|'img', thumb }
wireDrop({
  zone: '#merge-drop', input: '#merge-file', browse: '#merge-browse',
  accept: (f) => isPdf(f) || isImg(f),
  onFiles: (files) => addMergeFiles(files),
});

async function addMergeFiles(files) {
  for (const file of files) {
    const kind = isPdf(file) ? 'pdf' : 'img';
    const item = { file, kind, thumb: null };
    if (kind === 'img') item.thumb = URL.createObjectURL(file);
    mergeItems.push(item);
  }
  renderMergeList();
}

function renderMergeList() {
  const list = $('#merge-list');
  list.innerHTML = '';
  mergeItems.forEach((it, i) => {
    const card = document.createElement('div');
    card.className = 'file-card'; card.draggable = true; card.dataset.idx = i;
    card.innerHTML =
      `<span class="fc-index">${i + 1}</span>` +
      `<button class="fc-remove" title="Remove">✕</button>` +
      (it.kind === 'img'
        ? `<img class="thumb-img" src="${it.thumb}" alt="">`
        : `<div class="fc-icon">📄</div>`) +
      `<div class="fc-name">${it.file.name}</div>`;
    card.querySelector('.fc-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      if (it.thumb) URL.revokeObjectURL(it.thumb);
      mergeItems.splice(i, 1); renderMergeList();
    });
    list.append(card);
  });
  $('#merge-run').disabled = mergeItems.length < 1;
  $('#merge-clear').disabled = mergeItems.length < 1;
}
makeSortable($('#merge-list'), '.file-card', mergeItems, renderMergeList);

$('#merge-clear').addEventListener('click', () => {
  mergeItems.forEach(it => it.thumb && URL.revokeObjectURL(it.thumb));
  mergeItems.length = 0; renderMergeList();   // mutate in place — makeSortable holds this ref
});

$('#merge-run').addEventListener('click', () => wrap('Merging…', async () => {
  const out = await PDFDocument.create();
  for (const it of mergeItems) {
    const buf = new Uint8Array(await readAsArrayBuffer(it.file));
    if (it.kind === 'pdf') {
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
    } else {
      await addImageAsPage(out, it.file, buf, 'fit', 0);
    }
  }
  const bytes = await out.save();
  download(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
  toast(`Merged ${mergeItems.length} file${mergeItems.length > 1 ? 's' : ''}`);
}));

/* embed an image file into a pdf-lib doc as one page */
async function addImageAsPage(out, file, buf, sizeMode, margin) {
  let img;
  if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) {
    img = await out.embedJpg(buf);
  } else if (file.type === 'image/png' || /\.png$/i.test(file.name)) {
    img = await out.embedPng(buf);
  } else {
    // webp/gif/etc → rasterize to PNG via canvas
    const png = await rasterizeToPng(file);
    img = await out.embedPng(png);
  }
  const sizes = { a4: [595.28, 841.89], a4l: [841.89, 595.28], letter: [612, 792] };
  if (sizeMode === 'fit') {
    const page = out.addPage([img.width + margin * 2, img.height + margin * 2]);
    page.drawImage(img, { x: margin, y: margin, width: img.width, height: img.height });
  } else {
    const [pw, ph] = sizes[sizeMode] || sizes.a4;
    const page = out.addPage([pw, ph]);
    const availW = pw - margin * 2, availH = ph - margin * 2;
    const scale = Math.min(availW / img.width, availH / img.height);
    const w = img.width * scale, h = img.height * scale;
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
}

function rasterizeToPng(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = async () => {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      URL.revokeObjectURL(url);
      const blob = await canvasToBlob(c, 'image/png');
      resolve(new Uint8Array(await blob.arrayBuffer()));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    im.src = url;
  });
}

/* ============================================================
   3. SPLIT & EXTRACT
   ============================================================ */
let splitState = { bytes: null, name: '', count: 0 };
wireDrop({
  zone: '#split-drop', input: '#split-file', browse: '#split-browse',
  accept: isPdf, onFiles: (f) => loadSplit(f[0]),
});
async function loadSplit(file) {
  await wrap('Reading PDF…', async () => {
    const buf = new Uint8Array(await readAsArrayBuffer(file));
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    splitState = { bytes: buf, name: file.name, count: doc.getPageCount() };
    $('#split-info').textContent = `${file.name} · ${splitState.count} pages`;
    $('#split-config').hidden = false;
  });
}
$$('input[name="split-mode"]').forEach(r => r.addEventListener('change', () => {
  const mode = $('input[name="split-mode"]:checked').value;
  $('#split-ranges-row').hidden = mode !== 'ranges';
  $('#split-size-row').hidden = mode !== 'size';
}));

function parseRanges(str, max) {
  // returns array of arrays of 0-based page indices, one per comma group
  const groups = [];
  for (const part of str.split(',')) {
    const p = part.trim(); if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = +m[1], b = +m[2]; if (a > b) [a, b] = [b, a];
      const g = [];
      for (let n = a; n <= b; n++) if (n >= 1 && n <= max) g.push(n - 1);
      if (g.length) groups.push(g);
    } else if (/^\d+$/.test(p)) {
      const n = +p; if (n >= 1 && n <= max) groups.push([n - 1]);
    } else {
      throw new Error(`Couldn't read range "${p}"`);
    }
  }
  if (!groups.length) throw new Error('No valid pages in that range');
  return groups;
}

$('#split-run').addEventListener('click', () => wrap('Splitting…', async () => {
  const mode = $('input[name="split-mode"]:checked').value;
  const src = await PDFDocument.load(splitState.bytes.slice(), { ignoreEncryption: true });
  const max = splitState.count;
  let groups;
  if (mode === 'every') groups = Array.from({ length: max }, (_, i) => [i]);
  else if (mode === 'size') {
    const n = Math.max(1, +$('#split-size').value || 1);
    groups = [];
    for (let i = 0; i < max; i += n) groups.push(Array.from({ length: Math.min(n, max - i) }, (_, k) => i + k));
  } else groups = parseRanges($('#split-ranges').value, max);

  if (groups.length === 1) {
    const blob = await pagesToBlob(src, groups[0]);
    download(blob, `${baseName(splitState.name)}-${labelFor(groups[0])}.pdf`);
  } else {
    const zip = new JSZip();
    for (let i = 0; i < groups.length; i++) {
      const blob = await pagesToBlob(src, groups[i]);
      zip.file(`${baseName(splitState.name)}-${labelFor(groups[i])}.pdf`, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    download(zipBlob, `${baseName(splitState.name)}-split.zip`);
  }
  toast(`Created ${groups.length} file${groups.length > 1 ? 's' : ''}`);
}));

function labelFor(g) {
  if (g.length === 1) return `p${g[0] + 1}`;
  return `p${g[0] + 1}-${g[g.length - 1] + 1}`;
}
async function pagesToBlob(src, indices) {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach(p => out.addPage(p));
  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/* ============================================================
   4. COMPRESS  (rasterize pages at chosen DPI + JPEG quality)
   ============================================================ */
let compressState = { bytes: null, name: '', size: 0 };
wireDrop({
  zone: '#compress-drop', input: '#compress-file', browse: '#compress-browse',
  accept: isPdf, onFiles: (f) => loadCompress(f[0]),
});
async function loadCompress(file) {
  const buf = new Uint8Array(await readAsArrayBuffer(file));
  compressState = { bytes: buf, name: file.name, size: file.size };
  $('#compress-info').textContent = `${file.name} · ${fmtBytes(file.size)}`;
  $('#compress-config').hidden = false;
  $('#compress-result').hidden = true;
}
$('#compress-dpi').addEventListener('input', e => $('#compress-dpi-out').textContent = e.target.value + ' DPI');
$('#compress-q').addEventListener('input', e => $('#compress-q-out').textContent = e.target.value + '%');

$('#compress-run').addEventListener('click', () => wrap('Compressing…', async () => {
  const dpi = +$('#compress-dpi').value;
  const quality = +$('#compress-q').value / 100;
  const scale = dpi / 72;
  const doc = await loadPdfjs(compressState.bytes);
  const out = await PDFDocument.create();
  for (let i = 1; i <= doc.numPages; i++) {
    overlayMsg.textContent = `Compressing page ${i} / ${doc.numPages}…`;
    const page = await doc.getPage(i);
    const ptVp = page.getViewport({ scale: 1 });           // points (72dpi)
    const canvas = await renderPageToCanvas(page, scale);
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const pg = out.addPage([ptVp.width, ptVp.height]);
    pg.drawImage(img, { x: 0, y: 0, width: ptVp.width, height: ptVp.height });
  }
  const bytes = await out.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const pct = Math.round((1 - blob.size / compressState.size) * 100);
  const res = $('#compress-result');
  res.hidden = false;
  res.textContent = pct > 0
    ? `${fmtBytes(compressState.size)} → ${fmtBytes(blob.size)}  ·  ${pct}% smaller`
    : `${fmtBytes(compressState.size)} → ${fmtBytes(blob.size)}  ·  already well-compressed (try lower DPI/quality)`;
  download(blob, baseName(compressState.name) + '-compressed.pdf');
}));

/* ============================================================
   5. WATERMARK
   ============================================================ */
let wmBytes = null, wmName = '';
wireDrop({
  zone: '#wm-drop', input: '#wm-file', browse: '#wm-browse',
  accept: isPdf, onFiles: (f) => loadWm(f[0]),
});
async function loadWm(file) {
  wmBytes = new Uint8Array(await readAsArrayBuffer(file)); wmName = file.name;
  $('#wm-info').textContent = `${file.name}`;
  $('#wm-config').hidden = false;
}
$('#wm-op').addEventListener('input', e => $('#wm-op-out').textContent = e.target.value + '%');
$('#wm-size').addEventListener('input', e => $('#wm-size-out').textContent = e.target.value);
$('#wm-angle').addEventListener('input', e => $('#wm-angle-out').textContent = e.target.value + '°');

$('#wm-run').addEventListener('click', () => wrap('Stamping…', async () => {
  const text = $('#wm-text').value || 'DRAFT';
  const op = +$('#wm-op').value / 100;
  const size = +$('#wm-size').value;
  const angle = +$('#wm-angle').value;
  const doc = await PDFDocument.load(wmBytes.slice(), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width / 2 - (tw / 2) * Math.cos(angle * Math.PI / 180),
      y: height / 2 - (tw / 2) * Math.sin(angle * Math.PI / 180),
      size, font, color: rgb(0.5, 0.5, 0.5), opacity: op, rotate: degrees(angle),
    });
  }
  const bytes = await doc.save();
  download(new Blob([bytes], { type: 'application/pdf' }), baseName(wmName) + '-watermarked.pdf');
  toast('Watermark applied');
}));

/* ============================================================
   6. PAGE NUMBERS
   ============================================================ */
let numBytes = null, numName = '';
wireDrop({
  zone: '#num-drop', input: '#num-file', browse: '#num-browse',
  accept: isPdf, onFiles: (f) => loadNum(f[0]),
});
async function loadNum(file) {
  numBytes = new Uint8Array(await readAsArrayBuffer(file)); numName = file.name;
  $('#num-info').textContent = `${file.name}`;
  $('#num-config').hidden = false;
}
$('#num-run').addEventListener('click', () => wrap('Numbering…', async () => {
  const fmt = $('#num-format').value;
  const pos = $('#num-pos').value;
  const start = Math.max(1, +$('#num-start').value || 1);
  const doc = await PDFDocument.load(numBytes.slice(), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const N = pages.length;
  const size = 10, pad = 28;
  pages.forEach((page, i) => {
    const n = start + i;
    const label = buildNumLabel(fmt, n, N);
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(label, size);
    let x, y;
    if (pos[1] === 'l') x = pad; else if (pos[1] === 'r') x = width - pad - tw; else x = (width - tw) / 2;
    y = pos[0] === 't' ? height - pad : pad - 6;
    page.drawText(label, { x, y, size, font, color: rgb(0.35, 0.35, 0.35) });
  });
  const bytes = await doc.save();
  download(new Blob([bytes], { type: 'application/pdf' }), baseName(numName) + '-numbered.pdf');
  toast('Page numbers added');
}));
function buildNumLabel(fmt, n, N) {
  switch (fmt) {
    case 'n/N': return `${n} / ${N}`;
    case 'Page n': return `Page ${n}`;
    case 'Page n of N': return `Page ${n} of ${N}`;
    default: return `${n}`;
  }
}

/* ============================================================
   7. METADATA
   ============================================================ */
let metaBytes = null, metaName = '';
wireDrop({
  zone: '#meta-drop', input: '#meta-file', browse: '#meta-browse',
  accept: isPdf, onFiles: (f) => loadMeta(f[0]),
});
async function loadMeta(file) {
  metaBytes = new Uint8Array(await readAsArrayBuffer(file)); metaName = file.name;
  const doc = await PDFDocument.load(metaBytes.slice(), { ignoreEncryption: true });
  $('#meta-title').value = doc.getTitle() || '';
  $('#meta-author').value = doc.getAuthor() || '';
  $('#meta-subject').value = doc.getSubject() || '';
  $('#meta-keywords').value = (doc.getKeywords() || '');
  const cr = doc.getCreationDate();
  $('#meta-readout').textContent =
    `${file.name} · ${doc.getPageCount()} pages` +
    (cr ? ` · created ${cr.toLocaleDateString()}` : '') +
    (doc.getProducer() ? ` · ${doc.getProducer()}` : '');
  $('#meta-config').hidden = false;
}
$('#meta-run').addEventListener('click', () => wrap('Saving…', async () => {
  const doc = await PDFDocument.load(metaBytes.slice(), { ignoreEncryption: true });
  doc.setTitle($('#meta-title').value);
  doc.setAuthor($('#meta-author').value);
  doc.setSubject($('#meta-subject').value);
  const kw = $('#meta-keywords').value.split(',').map(s => s.trim()).filter(Boolean);
  doc.setKeywords(kw);
  doc.setModificationDate(new Date());
  const bytes = await doc.save();
  download(new Blob([bytes], { type: 'application/pdf' }), baseName(metaName) + '-meta.pdf');
  toast('Metadata saved');
}));

/* ============================================================
   8. IMAGES → PDF
   ============================================================ */
let i2pItems = [];
wireDrop({
  zone: '#i2p-drop', input: '#i2p-file', browse: '#i2p-browse',
  accept: isImg, onFiles: (files) => { files.forEach(f => i2pItems.push({ file: f, thumb: URL.createObjectURL(f) })); renderI2p(); },
});
function renderI2p() {
  const list = $('#i2p-list'); list.innerHTML = '';
  i2pItems.forEach((it, i) => {
    const card = document.createElement('div');
    card.className = 'file-card'; card.draggable = true; card.dataset.idx = i;
    card.innerHTML =
      `<span class="fc-index">${i + 1}</span>` +
      `<button class="fc-remove">✕</button>` +
      `<img class="thumb-img" src="${it.thumb}" alt="">` +
      `<div class="fc-name">${it.file.name}</div>`;
    card.querySelector('.fc-remove').addEventListener('click', (e) => {
      e.stopPropagation(); URL.revokeObjectURL(it.thumb); i2pItems.splice(i, 1); renderI2p();
    });
    list.append(card);
  });
  $('#i2p-config').hidden = i2pItems.length === 0;
}
makeSortable($('#i2p-list'), '.file-card', i2pItems, renderI2p);
$('#i2p-clear').addEventListener('click', () => { i2pItems.forEach(it => URL.revokeObjectURL(it.thumb)); i2pItems.length = 0; renderI2p(); });
$('#i2p-run').addEventListener('click', () => wrap('Building PDF…', async () => {
  const sizeMode = $('#i2p-size').value;
  const margin = +$('#i2p-margin').value;
  const out = await PDFDocument.create();
  for (const it of i2pItems) {
    const buf = new Uint8Array(await readAsArrayBuffer(it.file));
    await addImageAsPage(out, it.file, buf, sizeMode, margin);
  }
  const bytes = await out.save();
  download(new Blob([bytes], { type: 'application/pdf' }), 'images.pdf');
  toast(`Built PDF from ${i2pItems.length} image${i2pItems.length > 1 ? 's' : ''}`);
}));

/* ============================================================
   9. PDF → IMAGES
   ============================================================ */
let p2iState = { bytes: null, name: '', count: 0 };
wireDrop({
  zone: '#p2i-drop', input: '#p2i-file', browse: '#p2i-browse',
  accept: isPdf, onFiles: (f) => loadP2i(f[0]),
});
async function loadP2i(file) {
  await wrap('Reading…', async () => {
    const buf = new Uint8Array(await readAsArrayBuffer(file));
    const doc = await loadPdfjs(buf);
    p2iState = { bytes: buf, name: file.name, count: doc.numPages };
    $('#p2i-info').textContent = `${file.name} · ${doc.numPages} pages`;
    $('#p2i-config').hidden = false;
    $('#p2i-result').hidden = true;
  });
}
$('#p2i-run').addEventListener('click', () => wrap('Rendering…', async () => {
  const fmt = $('#p2i-format').value;
  const scale = +$('#p2i-scale').value;
  const ext = fmt === 'png' ? 'png' : 'jpg';
  const type = fmt === 'png' ? 'image/png' : 'image/jpeg';
  const doc = await loadPdfjs(p2iState.bytes);
  const zip = new JSZip();
  for (let i = 1; i <= doc.numPages; i++) {
    overlayMsg.textContent = `Rendering page ${i} / ${doc.numPages}…`;
    const page = await doc.getPage(i);
    const canvas = await renderPageToCanvas(page, scale);
    const blob = await canvasToBlob(canvas, type, 0.92);
    zip.file(`${baseName(p2iState.name)}-p${String(i).padStart(2, '0')}.${ext}`, blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  download(zipBlob, `${baseName(p2iState.name)}-images.zip`);
  const res = $('#p2i-result'); res.hidden = false;
  res.textContent = `Rendered ${doc.numPages} page${doc.numPages > 1 ? 's' : ''} · ${fmtBytes(zipBlob.size)}`;
}));

/* ============================================================
   10. EXTRACT TEXT
   ============================================================ */
wireDrop({
  zone: '#ext-drop', input: '#ext-file', browse: '#ext-browse',
  accept: isPdf, onFiles: (f) => extractText(f[0]),
});
async function extractText(file) {
  await wrap('Extracting text…', async () => {
    const buf = new Uint8Array(await readAsArrayBuffer(file));
    const doc = await loadPdfjs(buf);
    let all = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let last = null, line = '';
      const parts = [];
      for (const it of tc.items) {
        if (last !== null && Math.abs(it.transform[5] - last) > 2) { parts.push(line.trim()); line = ''; }
        line += it.str + (it.hasEOL ? '\n' : ' ');
        last = it.transform[5];
      }
      if (line.trim()) parts.push(line.trim());
      all += `\n———  Page ${i}  ———\n` + parts.join('\n') + '\n';
    }
    const txt = all.trim();
    $('#ext-out').value = txt || '(No selectable text found — this PDF is likely a scan and would need OCR.)';
    $('#ext-config').hidden = false;
    $('#ext-out').dataset.name = baseName(file.name);
  });
}
$('#ext-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#ext-out').value); toast('Copied'); }
  catch { toast('Copy failed — select manually', true); }
});
$('#ext-download').addEventListener('click', () => {
  const txt = $('#ext-out').value;
  download(new Blob([txt], { type: 'text/plain' }), ($('#ext-out').dataset.name || 'text') + '.txt');
});

/* ============================================================
   11. IMAGE COMPRESSOR
   ============================================================ */
let icItems = []; // { file, name, origSize, blob, outSize, url }
wireDrop({
  zone: '#ic-drop', input: '#ic-file', browse: '#ic-browse',
  accept: isImg, onFiles: (files) => { files.forEach(f => icItems.push({ file: f, name: f.name, origSize: f.size, blob: null })); renderIc(); $('#ic-config').hidden = false; },
});
$('#ic-q').addEventListener('input', e => $('#ic-q-out').textContent = e.target.value + '%');
$('#ic-clear').addEventListener('click', () => { icItems.forEach(it => it.url && URL.revokeObjectURL(it.url)); icItems = []; renderIc(); $('#ic-zip').disabled = true; });

function renderIc() {
  const grid = $('#ic-grid'); grid.innerHTML = '';
  icItems.forEach((it) => {
    const card = document.createElement('div'); card.className = 'ic-card';
    const saved = it.blob ? Math.round((1 - it.outSize / it.origSize) * 100) : null;
    card.innerHTML =
      `<img src="${it.url || URL.createObjectURL(it.file)}" alt="">` +
      `<div class="ic-meta"><div class="ic-name">${it.name}</div>` +
      `<div class="ic-stat">${fmtBytes(it.origSize)}` +
      (it.blob ? ` → ${fmtBytes(it.outSize)} <span class="ic-saved">${saved > 0 ? saved + '% saved' : 'no gain'}</span>` : '') +
      `</div></div>`;
    grid.append(card);
  });
}
$('#ic-run').addEventListener('click', () => wrap('Compressing images…', async () => {
  const type = $('#ic-format').value;
  const quality = +$('#ic-q').value / 100;
  const maxW = parseInt($('#ic-maxw').value, 10);
  for (const it of icItems) {
    const out = await compressImage(it.file, type, quality, isNaN(maxW) ? null : maxW);
    if (it.url) URL.revokeObjectURL(it.url);
    it.blob = out; it.outSize = out.size; it.url = URL.createObjectURL(out);
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    it.outName = baseName(it.name) + '.' + ext;
  }
  renderIc();
  $('#ic-zip').disabled = false;
  toast('Compressed ' + icItems.length + ' image' + (icItems.length > 1 ? 's' : ''));
}));
$('#ic-zip').addEventListener('click', () => wrap('Zipping…', async () => {
  const zip = new JSZip();
  icItems.forEach(it => { if (it.blob) zip.file(it.outName, it.blob); });
  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, 'compressed-images.zip');
}));

function compressImage(file, type, quality, maxW) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = async () => {
      let w = im.naturalWidth, h = im.naturalHeight;
      if (maxW && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const blob = await canvasToBlob(c, type, quality);
      blob ? resolve(blob) : reject(new Error('Could not encode image'));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read ' + file.name)); };
    im.src = url;
  });
}

/* ============================================================
   Header "Open files" — route to the right tool by type
   ============================================================ */
$('#open-files-btn').addEventListener('click', () => $('#global-file').click());
$('#global-file').addEventListener('change', (e) => {
  const files = [...e.target.files]; e.target.value = '';
  if (!files.length) return;
  const pdfs = files.filter(isPdf), imgs = files.filter(isImg);
  if (pdfs.length === 1 && !imgs.length) { showTool('organize'); openOrganize(pdfs[0]); }
  else if (pdfs.length > 1 && !imgs.length) { showTool('merge'); addMergeFiles(pdfs); }
  else if (imgs.length && !pdfs.length) { showTool('imgcompress'); imgs.forEach(f => icItems.push({ file: f, name: f.name, origSize: f.size, blob: null })); renderIc(); $('#ic-config').hidden = false; }
  else { showTool('merge'); addMergeFiles(files); }
});

/* keyboard nav for the viewer */
document.addEventListener('keydown', (e) => {
  if ($('.panel[data-panel="organize"]').classList.contains('active') && org.order.length) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') $('#page-next').click();
    else if (e.key === 'ArrowLeft') $('#page-prev').click();
  }
});

console.log('%cPDF Studio ready — everything runs locally.', 'color:#39ff14');
