/* ============================================================
   imagery.js — 11 canvas-based image filters
   All processing is local; nothing is uploaded.
   ============================================================ */

'use strict';

// ── State ─────────────────────────────────────────────────────
const state = {
  src: null,       // ImageBitmap of the uploaded image
  active: null,    // currently selected filter id
  settings: {},    // per-filter settings
  rendering: new Set(),
};

// ── Filter registry ──────────────────────────────────────────
const FILTERS = [
  {
    id: 'color-halftone',
    name: 'Color Halftone',
    sub: 'Pixelate',
    params: [
      { id: 'size',   label: 'Max Radius', min: 2,  max: 24, step: 1,   def: 6 },
      { id: 'angle1', label: 'C angle',    min: 0,  max: 90, step: 1,   def: 108 },
    ],
  },
  {
    id: 'halftone-dot',
    name: 'Halftone',
    sub: 'Pattern · Dot',
    params: [
      { id: 'size',  label: 'Cell Size', min: 4,  max: 40, step: 2,   def: 10 },
      { id: 'angle', label: 'Angle',     min: 0,  max: 90, step: 1,   def: 45 },
    ],
  },
  {
    id: 'halftone-circle',
    name: 'Halftone',
    sub: 'Pattern · Circle',
    params: [
      { id: 'size',  label: 'Cell Size', min: 4,  max: 40, step: 2,   def: 12 },
      { id: 'angle', label: 'Angle',     min: 0,  max: 90, step: 1,   def: 45 },
    ],
  },
  {
    id: 'halftone-line',
    name: 'Halftone',
    sub: 'Pattern · Line',
    params: [
      { id: 'size',  label: 'Line Height', min: 2,  max: 24, step: 1, def: 6 },
      { id: 'angle', label: 'Angle',       min: 0,  max: 90, step: 1, def: 0 },
    ],
  },
  {
    id: 'graphic-pen',
    name: 'Graphic Pen',
    sub: 'Sketch',
    params: [
      { id: 'length',  label: 'Stroke Length', min: 2,  max: 20, step: 1,   def: 8 },
      { id: 'density', label: 'Density',       min: 10, max: 90, step: 5,   def: 50 },
    ],
  },
  {
    id: 'stamp',
    name: 'Stamp',
    sub: 'Stylize',
    params: [
      { id: 'smooth',    label: 'Smoothness', min: 1,   max: 10, step: 1,   def: 4 },
      { id: 'threshold', label: 'Threshold',  min: 50,  max: 200, step: 5,  def: 128 },
    ],
  },
  {
    id: 'bitmap',
    name: 'Bitmap',
    sub: 'Mode · 20 pixels',
    params: [
      { id: 'size',      label: 'Pixel Size', min: 4,   max: 40, step: 2,   def: 20 },
      { id: 'threshold', label: 'Threshold',  min: 50,  max: 210, step: 5,  def: 128 },
    ],
  },
  {
    id: 'patchwork',
    name: 'Patchwork',
    sub: 'Texture',
    params: [
      { id: 'size',   label: 'Patch Size', min: 4,  max: 48, step: 2,   def: 16 },
      { id: 'relief', label: 'Relief',     min: 0,  max: 10, step: 1,   def: 4 },
    ],
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    sub: 'Pixelate',
    params: [
      { id: 'size', label: 'Cell Size', min: 2,  max: 60, step: 1,   def: 12 },
    ],
  },
  {
    id: 'row-stretch',
    name: 'Row Stretch',
    sub: 'Single Row Marquee',
    params: [
      { id: 'row', label: 'Source Row %', min: 0, max: 100, step: 1,  def: 50 },
    ],
  },
  {
    id: 'path-blur',
    name: 'Path Blur',
    sub: 'Blur & Dissolve',
    params: [
      { id: 'distance', label: 'Distance', min: 4,  max: 60, step: 2,   def: 20 },
      { id: 'grain',    label: 'Grain',    min: 0,  max: 100, step: 5,  def: 40 },
    ],
  },
];

// ── Default settings ─────────────────────────────────────────
FILTERS.forEach(f => {
  state.settings[f.id] = {};
  f.params.forEach(p => { state.settings[f.id][p.id] = p.def; });
});

// ── DOM refs ──────────────────────────────────────────────────
const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('fileInput');
const grid        = document.getElementById('filterGrid');
const settingsBox = document.getElementById('settingsBox');
const settingsCnt = document.getElementById('settingsContent');
const emptyState  = document.getElementById('emptyState');
const downloadBtn = document.getElementById('downloadBtn');
const themeToggle = document.getElementById('themeToggle');
const toast       = document.getElementById('toast');
let toastTimer;

// ── Theme ─────────────────────────────────────────────────────
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('cloonk-theme', t); } catch(e) {}
}
themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'light' ? 'dark' : 'light');
});

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, dur = 2400) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), dur);
}

// ── Upload ────────────────────────────────────────────────────
function handleFiles(files) {
  const file = Array.from(files).find(f => f.type.startsWith('image/'));
  if (!file) { showToast('No image found in selection.'); return; }
  const url = URL.createObjectURL(file);
  createImageBitmap(new Image()).catch(() => {}); // warm up
  const img = new Image();
  img.onload = () => {
    createImageBitmap(img).then(bmp => {
      if (state.src) state.src.close();
      state.src = bmp;
      URL.revokeObjectURL(url);
      emptyState.hidden = true;
      grid.hidden = false;
      downloadBtn.disabled = false;
      renderAll();
    });
  };
  img.src = url;
}

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFiles(e.target.files));
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  handleFiles(e.dataTransfer.files);
});

// ── Grid build ────────────────────────────────────────────────
function buildGrid() {
  grid.innerHTML = '';

  // Original cell
  const origCell = makeCell('original', 'Original', 'Source');
  grid.appendChild(origCell);

  FILTERS.forEach(f => {
    const cell = makeCell(f.id, f.name, f.sub);
    cell.addEventListener('click', () => selectFilter(f.id));
    grid.appendChild(cell);
  });
}

function makeCell(id, name, sub) {
  const wrap = document.createElement('div');
  wrap.className = 'filter-cell';
  wrap.dataset.id = id;

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'filter-canvas-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'filter-canvas';
  canvas.id = `canvas-${id}`;

  const label = document.createElement('div');
  label.className = 'filter-label';
  label.innerHTML = `<strong>${name}</strong><span>${sub}</span>`;

  canvasWrap.appendChild(canvas);
  wrap.appendChild(canvasWrap);
  wrap.appendChild(label);
  return wrap;
}

function selectFilter(id) {
  document.querySelectorAll('.filter-cell').forEach(c => c.classList.remove('active'));
  const cell = document.querySelector(`.filter-cell[data-id="${id}"]`);
  if (cell) cell.classList.add('active');

  document.querySelectorAll('.filter-list-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  state.active = id;
  downloadBtn.disabled = false;
  renderSettings(id);
  settingsBox.hidden = false;
}

// ── Settings panel ────────────────────────────────────────────
function renderSettings(id) {
  const f = FILTERS.find(f => f.id === id);
  if (!f) { settingsCnt.innerHTML = ''; return; }

  const titleEl = document.getElementById('settingsTitle');
  if (titleEl) titleEl.innerHTML = `${f.name} <em>${f.sub}</em>`;

  settingsCnt.innerHTML = f.params.map(p => `
    <div class="param-row">
      <label class="param-label">${p.label}</label>
      <div class="param-controls">
        <input type="range" id="p-${id}-${p.id}"
          min="${p.min}" max="${p.max}" step="${p.step}"
          value="${state.settings[id][p.id]}">
        <span class="param-val" id="pv-${id}-${p.id}">${state.settings[id][p.id]}</span>
      </div>
    </div>
  `).join('');

  f.params.forEach(p => {
    const slider = document.getElementById(`p-${id}-${p.id}`);
    const valEl  = document.getElementById(`pv-${id}-${p.id}`);
    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      state.settings[id][p.id] = v;
      valEl.textContent = v;
      renderOne(id);
    });
  });
}

// ── Render pipeline ───────────────────────────────────────────
function renderAll() {
  renderOriginal();
  FILTERS.forEach(f => renderOne(f.id));
}

function renderOriginal() {
  const canvas = document.getElementById('canvas-original');
  if (!canvas || !state.src) return;
  const { w, h } = thumbSize(state.src.width, state.src.height);
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(state.src, 0, 0, w, h);
}

function renderOne(id) {
  if (!state.src) return;
  const canvas = document.getElementById(`canvas-${id}`);
  if (!canvas) return;

  const { w, h } = thumbSize(state.src.width, state.src.height);
  canvas.width  = w;
  canvas.height = h;

  // Draw source at thumb size
  const off = new OffscreenCanvas(w, h);
  const offCtx = off.getContext('2d');
  offCtx.drawImage(state.src, 0, 0, w, h);
  const src = offCtx.getImageData(0, 0, w, h);

  const s = state.settings[id];
  let result;

  if      (id === 'color-halftone')  result = filterColorHalftone(src, w, h, s);
  else if (id === 'halftone-dot')    result = filterHalftoneDot(src, w, h, s);
  else if (id === 'halftone-circle') result = filterHalftoneCircle(src, w, h, s);
  else if (id === 'halftone-line')   result = filterHalftoneLine(src, w, h, s);
  else if (id === 'graphic-pen')     result = filterGraphicPen(src, w, h, s);
  else if (id === 'stamp')           result = filterStamp(src, w, h, s);
  else if (id === 'bitmap')          result = filterBitmap(src, w, h, s);
  else if (id === 'patchwork')       result = filterPatchwork(src, w, h, s);
  else if (id === 'mosaic')          result = filterMosaic(src, w, h, s);
  else if (id === 'row-stretch')     result = filterRowStretch(src, w, h, s);
  else if (id === 'path-blur')       result = filterPathBlur(src, w, h, s);

  if (result) {
    const ctx = canvas.getContext('2d');
    ctx.putImageData(result, 0, 0);
  }
}

function thumbSize(sw, sh) {
  const MAX = 320;
  const ratio = Math.min(MAX / sw, MAX / sh, 1);
  return { w: Math.round(sw * ratio), h: Math.round(sh * ratio) };
}

// ── Helpers ───────────────────────────────────────────────────
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function lum(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function blurImageData(data, w, h, radius) {
  // Simple box blur (separable)
  const src = new Uint8ClampedArray(data);
  const tmp = new Uint8ClampedArray(data.length);
  const r = Math.max(1, Math.round(radius));

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let R = 0, G = 0, B = 0, A = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const xi = clamp(x + k, 0, w - 1);
        const i = (y * w + xi) * 4;
        R += src[i]; G += src[i+1]; B += src[i+2]; A += src[i+3]; n++;
      }
      const i = (y * w + x) * 4;
      tmp[i] = R/n; tmp[i+1] = G/n; tmp[i+2] = B/n; tmp[i+3] = A/n;
    }
  }
  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let R = 0, G = 0, B = 0, A = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const yi = clamp(y + k, 0, h - 1);
        const i = (yi * w + x) * 4;
        R += tmp[i]; G += tmp[i+1]; B += tmp[i+2]; A += tmp[i+3]; n++;
      }
      const i = (y * w + x) * 4;
      data[i] = R/n; data[i+1] = G/n; data[i+2] = B/n; data[i+3] = A/n;
    }
  }
}

// ── Filter: Color Halftone ────────────────────────────────────
function filterColorHalftone(src, w, h, s) {
  const size = s.size || 6;
  const out = new ImageData(w, h);
  const d = out.data;
  // White background
  for (let i = 0; i < d.length; i += 4) { d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 255; }

  const angles = [108, 162, 90, 45].map(a => a * Math.PI / 180);
  const channels = [0, 1, 2]; // R=C, G=M, B=Y
  const colors = [[0,255,255], [255,0,255], [255,255,0]]; // CMY

  channels.forEach((ch, ci) => {
    const ang = angles[ci];
    const cos = Math.cos(ang), sin = Math.sin(ang);

    for (let gy = -size; gy < h + size; gy += size) {
      for (let gx = -size; gx < w + size; gx += size) {
        // Rotate grid center back to image space
        const ix = Math.round(gx * cos - gy * sin);
        const iy = Math.round(gx * sin + gy * cos);

        // Sample average channel value in region
        let sum = 0, cnt = 0;
        for (let dy = -size; dy <= size; dy++) {
          for (let dx = -size; dx <= size; dx++) {
            const px = clamp(ix + dx, 0, w - 1);
            const py = clamp(iy + dy, 0, h - 1);
            const idx = (py * w + px) * 4;
            sum += src.data[idx + ch];
            cnt++;
          }
        }
        const avg = cnt ? sum / cnt : 0;
        const ink = 1 - avg / 255;
        const radius = Math.sqrt(ink) * size * 0.85;
        if (radius < 0.5) continue;

        // Paint dot in rotated grid
        const dotX = Math.round(gx * cos - gy * sin);
        const dotY = Math.round(gx * sin + gy * cos);
        const [cr, cg, cb] = colors[ci];

        for (let dy = -size; dy <= size; dy++) {
          for (let dx = -size; dx <= size; dx++) {
            const px = dotX + dx, py = dotY + dy;
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > radius) continue;
            const idx = (py * w + px) * 4;
            // Multiply blending (subtractive CMY)
            d[idx]   = Math.round(d[idx]   * cr / 255);
            d[idx+1] = Math.round(d[idx+1] * cg / 255);
            d[idx+2] = Math.round(d[idx+2] * cb / 255);
          }
        }
      }
    }
  });
  return out;
}

// ── Filter: Halftone Dot ──────────────────────────────────────
function filterHalftoneDot(src, w, h, s) {
  const size = s.size || 10;
  const ang = (s.angle || 45) * Math.PI / 180;
  const out = new ImageData(w, h);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) { d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=255; }

  const cos = Math.cos(ang), sin = Math.sin(ang);

  for (let gy = -size; gy < h + size*2; gy += size) {
    for (let gx = -size; gx < w + size*2; gx += size) {
      const cx = gx * cos - gy * sin;
      const cy = gx * sin + gy * cos;

      const sx = clamp(Math.round(cx), 0, w-1);
      const sy = clamp(Math.round(cy), 0, h-1);
      let sum = 0, cnt = 0;
      const sr = Math.max(1, Math.floor(size/2));
      for (let dy = -sr; dy <= sr; dy++) {
        for (let dx = -sr; dx <= sr; dx++) {
          const px = clamp(sx+dx, 0, w-1), py = clamp(sy+dy, 0, h-1);
          const i = (py*w+px)*4;
          sum += lum(src.data[i], src.data[i+1], src.data[i+2]);
          cnt++;
        }
      }
      const luma = cnt ? sum/cnt : 0;
      const radius = (1 - luma/255) * size * 0.72;
      if (radius < 0.5) continue;

      // Paint filled circle
      for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
          const px = Math.round(cx) + dx, py = Math.round(cy) + dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          if (Math.sqrt(dx*dx+dy*dy) > radius) continue;
          const idx = (py*w+px)*4;
          d[idx]=0; d[idx+1]=0; d[idx+2]=0; d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

// ── Filter: Halftone Circle (ring) ───────────────────────────
function filterHalftoneCircle(src, w, h, s) {
  const size = s.size || 12;
  const ang = (s.angle || 45) * Math.PI / 180;
  const out = new ImageData(w, h);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) { d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=255; }

  const cos = Math.cos(ang), sin = Math.sin(ang);

  for (let gy = -size; gy < h + size*2; gy += size) {
    for (let gx = -size; gx < w + size*2; gx += size) {
      const cx = gx * cos - gy * sin;
      const cy = gx * sin + gy * cos;
      const sx = clamp(Math.round(cx), 0, w-1);
      const sy = clamp(Math.round(cy), 0, h-1);

      let sum = 0, cnt = 0;
      const sr = Math.max(1, Math.floor(size/2));
      for (let dy = -sr; dy <= sr; dy++) {
        for (let dx = -sr; dx <= sr; dx++) {
          const px = clamp(sx+dx, 0, w-1), py = clamp(sy+dy, 0, h-1);
          const i = (py*w+px)*4;
          sum += lum(src.data[i], src.data[i+1], src.data[i+2]);
          cnt++;
        }
      }
      const luma = cnt ? sum/cnt : 0;
      const outerR = (1 - luma/255) * size * 0.72;
      const innerR = outerR * 0.52;
      if (outerR < 0.8) continue;

      for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
          const px = Math.round(cx)+dx, py = Math.round(cy)+dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const dist = Math.sqrt(dx*dx+dy*dy);
          if (dist > outerR || dist < innerR) continue;
          const idx = (py*w+px)*4;
          d[idx]=0; d[idx+1]=0; d[idx+2]=0; d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

// ── Filter: Halftone Line ─────────────────────────────────────
function filterHalftoneLine(src, w, h, s) {
  const lineH = Math.max(2, s.size || 6);
  const ang   = (s.angle || 0) * Math.PI / 180;
  const out   = new ImageData(w, h);
  const d     = out.data;
  for (let i = 0; i < d.length; i += 4) { d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=255; }

  const cos = Math.cos(ang), sin = Math.sin(ang);

  for (let band = -lineH; band < w + h + lineH; band += lineH) {
    // Average luma along this band line
    let sum = 0, cnt = 0;
    for (let t = 0; t < Math.max(w, h); t++) {
      const px = clamp(Math.round(t * cos - band * sin), 0, w-1);
      const py = clamp(Math.round(t * sin + band * cos), 0, h-1);
      const i = (py*w+px)*4;
      sum += lum(src.data[i], src.data[i+1], src.data[i+2]);
      cnt++;
    }
    const luma = cnt ? sum/cnt : 0;
    const thick = Math.round((1 - luma/255) * lineH * 0.96);
    if (thick < 1) continue;

    // Paint the stripe
    for (let t = 0; t < Math.max(w, h) + lineH; t++) {
      for (let dt = -Math.ceil(thick/2); dt <= Math.floor(thick/2); dt++) {
        const px = Math.round(t * cos - (band + dt) * sin);
        const py = Math.round(t * sin + (band + dt) * cos);
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const idx = (py*w+px)*4;
        d[idx]=0; d[idx+1]=0; d[idx+2]=0; d[idx+3]=255;
      }
    }
  }
  return out;
}

// ── Filter: Graphic Pen ───────────────────────────────────────
function filterGraphicPen(src, w, h, s) {
  const len     = Math.max(2, s.length || 8);
  const density = (s.density || 50) / 100;

  const out = new ImageData(w, h);
  const d   = out.data;
  for (let i = 0; i < d.length; i += 4) { d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=255; }

  // Draw diagonal strokes with frequency based on inverse luminance
  const spacing = Math.max(1, Math.round(len * (1 - density * 0.5)));

  for (let y = -len; y < h + len; y += spacing) {
    for (let x = -len; x < w + len; x += spacing) {
      // Sample center luma
      const sx = clamp(x, 0, w-1), sy = clamp(y, 0, h-1);
      const i = (sy*w+sx)*4;
      const luma = lum(src.data[i], src.data[i+1], src.data[i+2]);
      const threshold = 255 * (1 - density);
      if (luma > threshold) continue;

      // Draw a diagonal stroke (45°)
      const strokeLen = Math.round(len * (1 - luma / 255) * 0.9 + 2);
      for (let t = 0; t < strokeLen; t++) {
        const px = x + t, py = y + t;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const idx = (py*w+px)*4;
        d[idx]=0; d[idx+1]=0; d[idx+2]=0; d[idx+3]=255;
      }
    }
  }
  return out;
}

// ── Filter: Stamp ─────────────────────────────────────────────
function filterStamp(src, w, h, s) {
  const smooth    = s.smooth    || 4;
  const threshold = s.threshold || 128;

  const data = new Uint8ClampedArray(src.data);
  blurImageData(data, w, h, smooth * 2);

  const out = new ImageData(w, h);
  const d   = out.data;

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const l   = lum(data[idx], data[idx+1], data[idx+2]);
    const ink = l < threshold ? 0 : 255;
    d[idx]=ink; d[idx+1]=ink; d[idx+2]=ink; d[idx+3]=255;
  }
  return out;
}

// ── Filter: Bitmap ────────────────────────────────────────────
function filterBitmap(src, w, h, s) {
  const size      = s.size      || 20;
  const threshold = s.threshold || 128;
  const out = new ImageData(w, h);
  const d   = out.data;

  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      let sum = 0, cnt = 0;
      for (let dy = 0; dy < size && y+dy < h; dy++) {
        for (let dx = 0; dx < size && x+dx < w; dx++) {
          const i = ((y+dy)*w+(x+dx))*4;
          sum += lum(src.data[i], src.data[i+1], src.data[i+2]);
          cnt++;
        }
      }
      const avgL = cnt ? sum/cnt : 0;
      const ink  = avgL < threshold ? 0 : 255;
      for (let dy = 0; dy < size && y+dy < h; dy++) {
        for (let dx = 0; dx < size && x+dx < w; dx++) {
          const idx = ((y+dy)*w+(x+dx))*4;
          d[idx]=ink; d[idx+1]=ink; d[idx+2]=ink; d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

// ── Filter: Patchwork ─────────────────────────────────────────
function filterPatchwork(src, w, h, s) {
  const size   = s.size   || 16;
  const relief = s.relief || 4;
  const out    = new ImageData(w, h);
  const d      = out.data;

  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      let R=0,G=0,B=0,cnt=0;
      for (let dy=0; dy<size&&y+dy<h; dy++) {
        for (let dx=0; dx<size&&x+dx<w; dx++) {
          const i=((y+dy)*w+(x+dx))*4;
          R+=src.data[i]; G+=src.data[i+1]; B+=src.data[i+2]; cnt++;
        }
      }
      const ar=cnt?R/cnt:0, ag=cnt?G/cnt:0, ab=cnt?B/cnt:0;

      for (let dy=0; dy<size&&y+dy<h; dy++) {
        for (let dx=0; dx<size&&x+dx<w; dx++) {
          const px=x+dx, py=y+dy;
          const idx=(py*w+px)*4;
          let bright = 0;
          // Top-left bevel highlight
          if (dx < relief || dy < relief) bright = relief * 6;
          // Bottom-right bevel shadow
          if (dx >= size-relief || dy >= size-relief) bright = -relief * 6;
          d[idx]   = clamp(ar + bright, 0, 255);
          d[idx+1] = clamp(ag + bright, 0, 255);
          d[idx+2] = clamp(ab + bright, 0, 255);
          d[idx+3] = 255;
        }
      }
    }
  }
  return out;
}

// ── Filter: Mosaic ────────────────────────────────────────────
function filterMosaic(src, w, h, s) {
  const size = Math.max(2, s.size || 12);
  const out  = new ImageData(w, h);
  const d    = out.data;

  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      let R=0,G=0,B=0,cnt=0;
      for (let dy=0;dy<size&&y+dy<h;dy++) {
        for (let dx=0;dx<size&&x+dx<w;dx++) {
          const i=((y+dy)*w+(x+dx))*4;
          R+=src.data[i]; G+=src.data[i+1]; B+=src.data[i+2]; cnt++;
        }
      }
      const ar=cnt?R/cnt:0,ag=cnt?G/cnt:0,ab=cnt?B/cnt:0;
      for (let dy=0;dy<size&&y+dy<h;dy++) {
        for (let dx=0;dx<size&&x+dx<w;dx++) {
          const idx=((y+dy)*w+(x+dx))*4;
          d[idx]=ar; d[idx+1]=ag; d[idx+2]=ab; d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

// ── Filter: Row Stretch ───────────────────────────────────────
function filterRowStretch(src, w, h, s) {
  const pct    = (s.row != null ? s.row : 50) / 100;
  const srcRow = clamp(Math.round(pct * (h - 1)), 0, h - 1);
  const out    = new ImageData(w, h);
  const d      = out.data;

  // Copy the source row pixels
  const row = new Uint8ClampedArray(w * 4);
  for (let x = 0; x < w; x++) {
    const si = (srcRow * w + x) * 4;
    row[x*4]   = src.data[si];
    row[x*4+1] = src.data[si+1];
    row[x*4+2] = src.data[si+2];
    row[x*4+3] = src.data[si+3];
  }

  // Stretch to every row
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      d[di]   = row[x*4];
      d[di+1] = row[x*4+1];
      d[di+2] = row[x*4+2];
      d[di+3] = row[x*4+3];
    }
  }
  return out;
}

// ── Filter: Path Blur & Dissolve ──────────────────────────────
function filterPathBlur(src, w, h, s) {
  const dist  = Math.max(2, s.distance || 20);
  const grain = (s.grain || 40) / 100;

  // Horizontal motion blur
  const blurred = new Uint8ClampedArray(src.data.length);
  const half = Math.floor(dist / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let R=0,G=0,B=0,cnt=0;
      for (let d2 = -half; d2 <= half; d2++) {
        const px = clamp(x + d2, 0, w-1);
        const i = (y*w+px)*4;
        R+=src.data[i]; G+=src.data[i+1]; B+=src.data[i+2]; cnt++;
      }
      const i=(y*w+x)*4;
      blurred[i]=R/cnt; blurred[i+1]=G/cnt; blurred[i+2]=B/cnt; blurred[i+3]=255;
    }
  }

  // Dissolve: randomly mix original and blurred based on grain level
  const out = new ImageData(w, h);
  const d   = out.data;
  for (let i = 0; i < w*h; i++) {
    const idx = i*4;
    const useOrig = Math.random() > grain;
    if (useOrig) {
      d[idx]   = src.data[idx];
      d[idx+1] = src.data[idx+1];
      d[idx+2] = src.data[idx+2];
    } else {
      d[idx]   = blurred[idx];
      d[idx+1] = blurred[idx+1];
      d[idx+2] = blurred[idx+2];
    }
    d[idx+3] = 255;
  }
  return out;
}

// ── Download ──────────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  const id = state.active;
  if (!id || !state.src) { showToast('Select a filter first.'); return; }
  const canvas = document.getElementById(`canvas-${id}`);
  if (!canvas) return;
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cloonk-${id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
});

// ── Close settings ────────────────────────────────────────────
document.getElementById('closeSettings').addEventListener('click', () => {
  settingsBox.hidden = true;
  document.querySelectorAll('.filter-cell, .filter-list-item').forEach(c => c.classList.remove('active'));
  state.active = null;
  downloadBtn.disabled = true;
});

// ── Init ──────────────────────────────────────────────────────
buildGrid();
