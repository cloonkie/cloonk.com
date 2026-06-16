/* ============================================================
   darkroom.js — 28 canvas-based image filters
   All processing is local; nothing is uploaded.
   ============================================================ */

'use strict';

// ── State ─────────────────────────────────────────────────────
const state = {
  src:       null,
  active:    null,
  settings:  {},
};

// ── Filter icons (SVG path data, 20×20 viewBox) ─────────────
const ICONS = {
  'color-halftone':  '<circle cx="5" cy="5" r="2.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="5" cy="15" r="1.5"/><circle cx="15" cy="15" r="2.5"/><circle cx="10" cy="10" r="2"/>',
  'halftone-dot':    '<circle cx="4" cy="4" r="2.5" fill-opacity=".9"/><circle cx="10" cy="4" r="1.8"/><circle cx="16" cy="4" r="3"/><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="2.5"/><circle cx="16" cy="10" r="1.2"/><circle cx="4" cy="16" r="2.8"/><circle cx="10" cy="16" r="2"/><circle cx="16" cy="16" r="1.6"/>',
  'halftone-circle': '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="1.5"/>',
  'halftone-line':   '<line x1="2" y1="5" x2="18" y2="5" stroke-width="1.5"/><line x1="2" y1="9" x2="18" y2="9" stroke-width="2.5"/><line x1="2" y1="13" x2="18" y2="13" stroke-width="1.5"/><line x1="2" y1="17" x2="18" y2="17" stroke-width="3"/>',
  'graphic-pen':     '<line x1="3" y1="17" x2="17" y2="3" stroke-width="1.5" stroke-linecap="round"/><line x1="6" y1="17" x2="17" y2="6" stroke-width="1" stroke-linecap="round"/><line x1="3" y1="14" x2="14" y2="3" stroke-width="1" stroke-linecap="round"/><line x1="9" y1="17" x2="17" y2="9" stroke-width="1.5" stroke-linecap="round"/>',
  'stamp':           '<rect x="4" y="3" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="13" width="6" height="4" rx="0.5"/>',
  'bitmap':          '<rect x="2" y="2" width="6" height="6" rx="0.5"/><rect x="12" y="2" width="6" height="6" rx="0.5" fill-opacity=".4"/><rect x="2" y="12" width="6" height="6" rx="0.5" fill-opacity=".4"/><rect x="12" y="12" width="6" height="6" rx="0.5"/>',
  'patchwork':       '<rect x="2" y="2" width="7" height="7" rx="0.5"/><rect x="11" y="2" width="7" height="7" rx="0.5" fill-opacity=".7"/><rect x="2" y="11" width="7" height="7" rx="0.5" fill-opacity=".7"/><rect x="11" y="11" width="7" height="7" rx="0.5"/>',
  'mosaic':          '<rect x="2" y="2" width="5" height="5" rx="0.3"/><rect x="8" y="2" width="5" height="5" rx="0.3" fill-opacity=".6"/><rect x="14" y="2" width="4" height="5" rx="0.3" fill-opacity=".8"/><rect x="2" y="8" width="5" height="5" rx="0.3" fill-opacity=".5"/><rect x="8" y="8" width="5" height="5" rx="0.3"/><rect x="14" y="8" width="4" height="5" rx="0.3" fill-opacity=".3"/><rect x="2" y="14" width="5" height="4" rx="0.3" fill-opacity=".9"/><rect x="8" y="14" width="5" height="4" rx="0.3" fill-opacity=".4"/><rect x="14" y="14" width="4" height="4" rx="0.3" fill-opacity=".7"/>',
  'row-stretch':     '<line x1="2" y1="10" x2="18" y2="10" stroke-width="3" stroke-linecap="round"/><line x1="2" y1="6" x2="18" y2="6" stroke-width="1" stroke-linecap="round" stroke-opacity=".5"/><line x1="2" y1="14" x2="18" y2="14" stroke-width="1" stroke-linecap="round" stroke-opacity=".5"/>',
  'path-blur':       '<line x1="3" y1="10" x2="17" y2="10" stroke-width="2.5" stroke-linecap="round"/><line x1="5" y1="7" x2="15" y2="7" stroke-width="1.5" stroke-linecap="round" stroke-opacity=".4"/><line x1="5" y1="13" x2="15" y2="13" stroke-width="1.5" stroke-linecap="round" stroke-opacity=".4"/><line x1="7" y1="4" x2="13" y2="4" stroke-width="1" stroke-linecap="round" stroke-opacity=".2"/><line x1="7" y1="16" x2="13" y2="16" stroke-width="1" stroke-linecap="round" stroke-opacity=".2"/>',
  'ascii':           '<text x="2" y="9" font-size="6" font-family="monospace" fill="currentColor">A</text><text x="8" y="9" font-size="6" font-family="monospace" fill="currentColor">S</text><text x="14" y="9" font-size="6" font-family="monospace" fill="currentColor">C</text><text x="2" y="17" font-size="6" font-family="monospace" fill="currentColor">I</text><text x="8" y="17" font-size="6" font-family="monospace" fill="currentColor">I</text><text x="14" y="17" font-size="6" font-family="monospace" fill="currentColor">·</text>',
  'dithering':       '<rect x="2" y="2" width="4" height="4"/><rect x="8" y="2" width="4" height="4" fill-opacity=".5"/><rect x="14" y="2" width="4" height="4"/><rect x="5" y="5" width="4" height="4" fill-opacity=".3"/><rect x="11" y="5" width="4" height="4"/><rect x="2" y="8" width="4" height="4" fill-opacity=".7"/><rect x="8" y="8" width="4" height="4"/><rect x="14" y="8" width="4" height="4" fill-opacity=".4"/><rect x="5" y="11" width="4" height="4"/><rect x="11" y="11" width="4" height="4" fill-opacity=".6"/><rect x="2" y="14" width="4" height="4"/><rect x="8" y="14" width="4" height="4" fill-opacity=".2"/><rect x="14" y="14" width="4" height="4"/>',
  'matrix-rain':     '<line x1="4" y1="2" x2="4" y2="18" stroke-width="1.5" stroke-linecap="round" stroke-opacity=".3"/><line x1="10" y1="2" x2="10" y2="18" stroke-width="1.5" stroke-linecap="round" stroke-opacity=".7"/><line x1="16" y1="2" x2="16" y2="18" stroke-width="1.5" stroke-linecap="round" stroke-opacity=".5"/><circle cx="4" cy="6" r="1.5"/><circle cx="10" cy="3" r="1.5"/><circle cx="16" cy="9" r="1.5"/>',
  'dots':            '<circle cx="5" cy="5" r="3"/><circle cx="15" cy="5" r="1.5"/><circle cx="10" cy="10" r="2.5"/><circle cx="5" cy="15" r="1.5"/><circle cx="15" cy="15" r="2.8"/>',
  'contour':         '<path d="M10 3 C16 3 18 7 18 10 C18 15 14 17 10 17 C6 17 2 15 2 10 C2 7 4 3 10 3Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6 C14 6 15 8 15 10 C15 13 12 14 10 14 C8 14 5 13 5 10 C5 8 6 6 10 6Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  'pixel-sort':      '<rect x="2" y="2" width="16" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><line x1="2" y1="5" x2="11" y2="5" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="5" x2="18" y2="5" stroke-width="0.5" stroke-linecap="round" stroke-opacity=".3"/><line x1="2" y1="9" x2="7" y2="9" stroke-width="2" stroke-linecap="round"/><line x1="7" y1="9" x2="18" y2="9" stroke-width="0.5" stroke-linecap="round" stroke-opacity=".3"/><line x1="2" y1="13" x2="15" y2="13" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="17" x2="9" y2="17" stroke-width="2" stroke-linecap="round"/>',
  'blockify':        '<rect x="1" y="1" width="8" height="8" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1" fill-opacity=".8"/><rect x="2" y="11" width="7" height="6" rx="1" fill-opacity=".9"/><rect x="10" y="10" width="8" height="8" rx="1" fill-opacity=".7"/>',
  'threshold':       '<path d="M2 14 L8 14 L8 8 L14 8 L14 4 L18 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="2" y1="18" x2="18" y2="18" stroke-width="1" stroke-opacity=".4"/>',
  'edge-detect':     '<rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 10 L10 7 L13 10 L10 13Z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  'crosshatch':      '<line x1="2" y1="18" x2="18" y2="2" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="14" x2="14" y2="2" stroke-width="1" stroke-linecap="round" stroke-opacity=".7"/><line x1="6" y1="18" x2="18" y2="6" stroke-width="1" stroke-linecap="round" stroke-opacity=".7"/><line x1="2" y1="6" x2="6" y2="2" stroke-width="1" stroke-linecap="round" stroke-opacity=".5"/><line x1="14" y1="18" x2="18" y2="14" stroke-width="1" stroke-linecap="round" stroke-opacity=".5"/>',
  'wave-lines':      '<path d="M2 10 Q5 5 8 10 Q11 15 14 10 Q17 5 20 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M2 6 Q5 2 8 6 Q11 10 14 6 Q17 2 20 6" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-opacity=".5"/><path d="M2 14 Q5 10 8 14 Q11 18 14 14 Q17 10 20 14" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-opacity=".5"/>',
  'noise-field':     '<circle cx="6" cy="6" r="1"/><circle cx="14" cy="4" r="1.5"/><circle cx="10" cy="9" r="1"/><circle cx="4" cy="13" r="1.5"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="16" r="1.5"/><circle cx="14" cy="17" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="18" cy="7" r="1.5"/>',
  'voronoi':         '<path d="M10 2 L18 6 L16 15 L10 18 L4 15 L2 6Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2 L10 18 M2 6 L16 15 M18 6 L4 15" stroke="currentColor" stroke-width="1" stroke-opacity=".4"/>',
  'vhs':             '<rect x="2" y="4" width="16" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="7" x2="18" y2="7" stroke-width="1" stroke-opacity=".5"/><line x1="2" y1="10" x2="18" y2="10" stroke-width="1"/><line x1="2" y1="13" x2="14" y2="13" stroke-width="1" stroke-opacity=".5"/><line x1="5" y1="11" x2="9" y2="9" stroke-width="1.5" stroke-linecap="round" stroke-opacity=".8"/>',
  'fractal-haze':    '<line x1="2" y1="6" x2="6" y2="6" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="8" x2="12" y2="8" stroke-width="2.5" stroke-linecap="round"/><line x1="2" y1="10" x2="18" y2="10" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="12" x2="14" y2="12" stroke-width="2.5" stroke-linecap="round"/><line x1="2" y1="14" x2="8" y2="14" stroke-width="1.5" stroke-linecap="round"/>',
  'sticker':         '<path d="M10 2 C14 2 18 5 18 9 C18 13 15 17 10 18 C5 17 2 13 2 9 C2 5 6 2 10 2Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 5 C13 5 15 7 15 9 C15 12 13 14 10 15 C7 14 5 12 5 9 C5 7 7 5 10 5Z"/>',
  'pixel-stretch':   '<rect x="2" y="4" width="3" height="12" rx="0.5"/><rect x="6" y="4" width="8" height="3" rx="0.5"/><rect x="6" y="9" width="12" height="2" rx="0.5"/><rect x="6" y="13" width="5" height="3" rx="0.5"/>',
  'original':        '<rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="7" r="1.5"/><path d="M3 14 L7 10 L10 13 L13 9 L17 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
};

function filterIcon(id) {
  const paths = ICONS[id] || '';
  return `<svg viewBox="0 0 20 20" fill="currentColor" stroke="none" xmlns="http://www.w3.org/2000/svg" class="filter-icon">${paths}</svg>`;
}

// ── Filter registry ──────────────────────────────────────────
const FILTERS = [

  // ── Original 11 ──────────────────────────────────────────
  {
    id: 'color-halftone', name: 'Color Halftone', sub: 'CMY Pixelate',
    params: [
      { id: 'size',   label: 'Max Radius',  min: 2,  max: 24,  step: 1, def: 6 },
      { id: 'spread', label: 'Angle Spread',min: 10, max: 60,  step: 1, def: 36 },
    ],
  },
  {
    id: 'halftone-dot', name: 'Halftone', sub: 'Pattern · Dot',
    params: [
      { id: 'size',  label: 'Cell Size', min: 4,  max: 40, step: 2, def: 10 },
      { id: 'angle', label: 'Angle°',    min: 0,  max: 90, step: 1, def: 45 },
    ],
  },
  {
    id: 'halftone-circle', name: 'Halftone', sub: 'Pattern · Circle',
    params: [
      { id: 'size',      label: 'Cell Size',   min: 4,  max: 40,  step: 2,   def: 12 },
      { id: 'thickness', label: 'Ring Width %', min: 10, max: 80,  step: 5,   def: 45 },
    ],
  },
  {
    id: 'halftone-line', name: 'Halftone', sub: 'Pattern · Line',
    params: [
      { id: 'size',  label: 'Band Height', min: 2,  max: 24, step: 1, def: 6 },
      { id: 'angle', label: 'Angle°',      min: 0,  max: 90, step: 1, def: 0 },
    ],
  },
  {
    id: 'graphic-pen', name: 'Graphic Pen', sub: 'Sketch',
    params: [
      { id: 'length',   label: 'Stroke Length', min: 2,  max: 20, step: 1, def: 8 },
      { id: 'density',  label: 'Density %',     min: 10, max: 90, step: 5, def: 50 },
      { id: 'angle',    label: 'Angle°',        min: 0,  max: 135,step: 45,def: 45 },
    ],
  },
  {
    id: 'stamp', name: 'Stamp', sub: 'Stylize',
    params: [
      { id: 'smooth',    label: 'Smoothness', min: 1,  max: 10,  step: 1, def: 4 },
      { id: 'threshold', label: 'Threshold',  min: 50, max: 210, step: 5, def: 128 },
    ],
  },
  {
    id: 'bitmap', name: 'Bitmap', sub: 'Mode · Block',
    params: [
      { id: 'size',      label: 'Pixel Size', min: 4,  max: 40,  step: 2, def: 20 },
      { id: 'threshold', label: 'Threshold',  min: 50, max: 210, step: 5, def: 128 },
    ],
  },
  {
    id: 'patchwork', name: 'Patchwork', sub: 'Texture',
    params: [
      { id: 'size',   label: 'Patch Size', min: 4,  max: 48, step: 2, def: 16 },
      { id: 'relief', label: 'Relief',     min: 0,  max: 12, step: 1, def: 4 },
    ],
  },
  {
    id: 'mosaic', name: 'Mosaic', sub: 'Pixelate',
    params: [
      { id: 'size', label: 'Cell Size', min: 2, max: 60, step: 1, def: 12 },
    ],
  },
  {
    id: 'row-stretch', name: 'Row Stretch', sub: 'Single Row Marquee',
    params: [
      { id: 'row',   label: 'Source Row %',  min: 0, max: 100, step: 1, def: 50 },
      { id: 'blend', label: 'Blend with Src %', min: 0, max: 100, step: 5, def: 0 },
    ],
  },
  {
    id: 'path-blur', name: 'Path Blur', sub: 'Blur & Dissolve',
    params: [
      { id: 'distance', label: 'Distance',  min: 4,  max: 80,  step: 2,  def: 20 },
      { id: 'grain',    label: 'Dissolve %',min: 0,  max: 100, step: 5,  def: 40 },
      { id: 'angle',    label: 'Angle°',    min: 0,  max: 135, step: 45, def: 0 },
    ],
  },

  // ── New 15 ───────────────────────────────────────────────
  {
    id: 'ascii', name: 'ASCII', sub: 'Character Art',
    params: [
      { id: 'cellSize', label: 'Cell Size',   min: 4,  max: 20, step: 1, def: 9 },
      { id: 'contrast', label: 'Contrast',    min: 50, max: 200,step: 5, def: 110 },
      { id: 'color', label: 'Color mode', min: 0, max: 1, step: 1, def: 1, options: ['Monochrome', 'Source color'] },
    ],
  },
  {
    id: 'dithering', name: 'Dithering', sub: 'Floyd–Steinberg',
    params: [
      { id: 'levels',    label: 'Color Levels', min: 2,  max: 8,   step: 1, def: 2 },
      { id: 'strength',  label: 'Strength %',   min: 10, max: 100, step: 5, def: 100 },
      { id: 'grayscale', label: 'Palette', min: 0, max: 1, step: 1, def: 1, options: ['Color', 'Grayscale'] },
    ],
  },
  {
    id: 'matrix-rain', name: 'Matrix Rain', sub: 'Glyphs',
    params: [
      { id: 'columns',  label: 'Column Width', min: 6,  max: 24, step: 2, def: 12 },
      { id: 'density',  label: 'Density %',    min: 10, max: 100,step: 5, def: 70 },
      { id: 'fade',     label: 'Fade Depth',   min: 1,  max: 10, step: 1, def: 5 },
    ],
  },
  {
    id: 'dots', name: 'Dots', sub: 'Color Field',
    params: [
      { id: 'spacing', label: 'Spacing',   min: 4,  max: 30, step: 1, def: 10 },
      { id: 'minSize', label: 'Min Size',  min: 1,  max: 8,  step: 1, def: 1 },
      { id: 'maxSize', label: 'Max Size',  min: 3,  max: 20, step: 1, def: 7 },
    ],
  },
  {
    id: 'contour', name: 'Contour', sub: 'Iso Lines',
    params: [
      { id: 'levels',    label: 'Level Count', min: 3,  max: 24, step: 1, def: 10 },
      { id: 'thickness', label: 'Line Width',  min: 1,  max: 4,  step: 1, def: 1 },
      { id: 'color', label: 'Line color', min: 0, max: 1, step: 1, def: 0, options: ['White', 'Source color'] },
    ],
  },
  {
    id: 'pixel-sort', name: 'Pixel Sort', sub: 'Glitch',
    params: [
      { id: 'threshold', label: 'Luma Threshold', min: 10, max: 240, step: 5,  def: 80 },
      { id: 'upper',     label: 'Upper Bound',    min: 50, max: 255, step: 5,  def: 200 },
      { id: 'direction', label: 'Direction', min: 0, max: 1, step: 1, def: 0, options: ['Horizontal', 'Vertical'] },
    ],
  },
  {
    id: 'blockify', name: 'Blockify', sub: 'Chunked Blocks',
    params: [
      { id: 'size',     label: 'Block Size',  min: 8,  max: 80, step: 4, def: 24 },
      { id: 'variance', label: 'Jitter',      min: 0,  max: 20, step: 1, def: 6 },
      { id: 'gap',      label: 'Gap',         min: 0,  max: 6,  step: 1, def: 2 },
    ],
  },
  {
    id: 'threshold', name: 'Threshold', sub: 'Posterize',
    params: [
      { id: 'levels',  label: 'Levels',     min: 2,  max: 8,   step: 1, def: 2 },
      { id: 'smooth',  label: 'Pre-Blur',   min: 0,  max: 6,   step: 1, def: 0 },
      { id: 'channel', label: 'Channel mode', min: 0, max: 1, step: 1, def: 0, options: ['Luminance', 'RGB'] },
    ],
  },
  {
    id: 'edge-detect', name: 'Edge Detect', sub: 'Sobel',
    params: [
      { id: 'strength', label: 'Strength',   min: 1,  max: 6,  step: 1, def: 3 },
      { id: 'invert', label: 'Background', min: 0, max: 1, step: 1, def: 1, options: ['White', 'Black'] },
      { id: 'color', label: 'Edge color', min: 0, max: 1, step: 1, def: 0, options: ['Black and white', 'Source color'] },
    ],
  },
  {
    id: 'crosshatch', name: 'Crosshatch', sub: 'Engraving',
    params: [
      { id: 'spacing',    label: 'Line Spacing', min: 3,  max: 20, step: 1, def: 7 },
      { id: 'lineWidth',  label: 'Line Width',   min: 1,  max: 3,  step: 1, def: 1 },
      { id: 'passes',     label: 'Directions',   min: 1,  max: 4,  step: 1, def: 3 },
    ],
  },
  {
    id: 'wave-lines', name: 'Wave Lines', sub: 'Distortion',
    params: [
      { id: 'amplitude', label: 'Amplitude',    min: 2,  max: 40, step: 1, def: 12 },
      { id: 'frequency', label: 'Frequency',    min: 1,  max: 16, step: 1, def: 5 },
      { id: 'spacing',   label: 'Line Spacing', min: 2,  max: 20, step: 1, def: 6 },
    ],
  },
  {
    id: 'noise-field', name: 'Noise Field', sub: 'Texture Overlay',
    params: [
      { id: 'scale',    label: 'Noise Scale',  min: 5,  max: 120, step: 5,  def: 40 },
      { id: 'strength', label: 'Strength %',   min: 10, max: 100, step: 5,  def: 60 },
      { id: 'colorize', label: 'Noise color', min: 0, max: 1, step: 1, def: 0, options: ['Monochrome', 'Color'] },
    ],
  },
  {
    id: 'voronoi', name: 'Voronoi', sub: 'Cell Diagram',
    params: [
      { id: 'points',   label: 'Cell Count',    min: 10, max: 300, step: 10, def: 80 },
      { id: 'edges', label: 'Cell edges', min: 0, max: 1, step: 1, def: 1, options: ['Hidden', 'Visible'] },
      { id: 'edgeW',    label: 'Edge Width',    min: 1,  max: 4,   step: 1,  def: 1 },
    ],
  },
  {
    id: 'vhs', name: 'VHS', sub: 'Tape Glitch',
    params: [
      { id: 'chroma',    label: 'Chroma Shift', min: 1,  max: 30,  step: 1, def: 8 },
      { id: 'scanlines', label: 'Scan Lines',   min: 0,  max: 8,   step: 1, def: 3 },
      { id: 'noise',     label: 'Noise %',      min: 0,  max: 60,  step: 5, def: 18 },
    ],
  },
  {
    id: 'fractal-haze', name: 'Fractal Haze', sub: 'Warp Distortion',
    params: [
      { id: 'intensity',  label: 'Intensity',   min: 5,  max: 100, step: 5, def: 50 },
      { id: 'threshold',  label: 'Threshold',   min: 10, max: 200, step: 5, def: 80 },
      { id: 'direction', label: 'Direction', min: 0, max: 1, step: 1, def: 0, options: ['Horizontal', 'Vertical'] },
    ],
  },
  {
    id: 'pixel-stretch', name: 'Pixel Stretch', sub: 'Glitch Warp',
    params: [
      { id: 'threshold', label: 'Trigger Luma',  min: 10, max: 240, step: 5,  def: 60  },
      { id: 'upper',     label: 'Upper Luma',    min: 30, max: 255, step: 5,  def: 220 },
      { id: 'maxLen',    label: 'Max Stretch',   min: 4,  max: 200, step: 4,  def: 60  },
      { id: 'direction', label: 'Direction', min: 0, max: 1, step: 1, def: 0, options: ['Horizontal', 'Vertical'] },
      { id: 'density',   label: 'Run Chance %',  min: 5,  max: 100, step: 5,  def: 50  },
    ],
  },
  {
    id: 'sticker', name: 'Sticker', sub: 'Cut-out & Background',
    params: [
      { id: 'tolerance', label: 'BG Tolerance', min: 5,  max: 120, step: 5,  def: 35 },
      { id: 'borderW',   label: 'Border Width', min: 0,  max: 24,  step: 1,  def: 8 },
      { id: 'borderHue', label: 'Border Hue°',  min: 0,  max: 360, step: 5,  def: 0 },
      { id: 'bg', label: 'Background', min: 0, max: 6, step: 1, def: 1, options: ['Checkerboard', 'Cream paper', 'Blueprint', 'Kraft', 'Denim', 'Dot pattern', 'Noise grid'] },
    ],
  },
];

// ── Filter descriptions (used by tooltip) ─────────────────────
const FILTER_DESCRIPTIONS = {
  'color-halftone':  'Splits the image into CMY channels and draws rotated dot grids — the classic offset-print look.',
  'halftone-dot':    'Converts luminance to black dot radius on a white grid. Larger dots in shadows, smaller in highlights.',
  'halftone-circle': 'Ring-shaped halftone: dark areas show thick annular rings, light areas fade out.',
  'halftone-line':   'Luminance drives line thickness within evenly-spaced bands. Rotatable at any angle.',
  'graphic-pen':     'Diagonal ink strokes hatched at a chosen angle. Mimics a crosshatch sketch.',
  'stamp':           'Heavy blur then binary threshold creates a two-tone cut-out — rubber stamp or linocut look.',
  'bitmap':          'Pixelates to large blocks then thresholds to pure black and white. 1-bit at low resolution.',
  'patchwork':       'Divides into solid-colour square tiles with a bevelled highlight and shadow — quilted surface.',
  'mosaic':          'Averages colour within each block for a classic pixel-art or stained-glass effect.',
  'row-stretch':     'Samples one horizontal row and stretches it to fill the frame — minimalist glitch abstraction.',
  'path-blur':       'Directional motion blur along any angle, blended at a selectable dissolve rate.',
  'ascii':           'Maps luminance to character density in a monospace grid. Toggle colour to tint each character.',
  'dithering':       'Floyd–Steinberg error diffusion quantises to a small palette while preserving tonal range.',
  'matrix-rain':     'Falling katakana and digit columns over a darkened source. Density driven by brightness.',
  'dots':            'Evenly-spaced filled circles sized by inverse luminance. Bold pop-art aesthetic.',
  'contour':         'Traces iso-luminance level-set lines like a topographic map. Control the number of levels.',
  'pixel-sort':      'Finds luminance-banded runs and sorts them by brightness — signature glitch streaks.',
  'blockify':        'Randomly jittered square blocks with bevel highlights — a chunky, offset mosaic.',
  'threshold':       'Posterises to a fixed number of tonal steps, per-channel for screen-printed poster effects.',
  'edge-detect':     'Sobel gradient magnitude isolates outlines. Invert for white lines; colourize from source.',
  'crosshatch':      'Up to four hatch directions accumulate like hand engraving — dark areas fill densely.',
  'wave-lines':      'Sinusoidal displacement of scan-lines, with amplitude modulated by local luminance.',
  'noise-field':     'Fractal value noise adds organic texture — monochrome bump or colourised channel warp.',
  'voronoi':         'Seeds random cells and fills each with the colour of its nearest point — a stained-glass mosaic.',
  'vhs':             'Simulates VHS tape dropout: colour bleed, scanlines, noise, and chroma shift.',
  'sticker':         'BFS flood-fills from corners to remove the background, adds a border, and places on a texture.',
  'pixel-stretch':   'Triggers on mid-luminance pixels and streaks their colour across the frame — glitch warp.',
  'fractal-haze':    'Fractal noise mixed with blurred source creates a dreamy, hazy atmospheric glow.',
};

// ── Filter families (used by the discovery toolbar) ───────────
const FILTER_FAMILIES = {
  'color-halftone': 'Halftone', 'halftone-dot': 'Halftone', 'halftone-circle': 'Halftone',
  'halftone-line': 'Halftone', 'dots': 'Halftone',
  'graphic-pen': 'Sketch', 'stamp': 'Sketch', 'contour': 'Sketch',
  'edge-detect': 'Sketch', 'crosshatch': 'Sketch',
  'bitmap': 'Pixel', 'mosaic': 'Pixel', 'blockify': 'Pixel',
  'patchwork': 'Texture', 'noise-field': 'Texture',
  'row-stretch': 'Glitch', 'pixel-sort': 'Glitch', 'vhs': 'Glitch',
  'fractal-haze': 'Glitch', 'pixel-stretch': 'Glitch',
  'path-blur': 'Blur',
  'ascii': 'Generative', 'matrix-rain': 'Generative', 'voronoi': 'Generative',
  'dithering': 'Retro', 'threshold': 'Retro',
  'wave-lines': 'Distort',
  'sticker': 'Cutout',
};
const ALL_FAMILIES = [...new Set(Object.values(FILTER_FAMILIES))].sort();

// ── Default settings ──────────────────────────────────────────
FILTERS.forEach(f => {
  state.settings[f.id] = {};
  f.params.forEach(p => { state.settings[f.id][p.id] = p.def; });
});

// ── DOM refs (null-safe — catalog page omits these elements) ──
const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('fileInput');
const grid        = document.getElementById('filterGrid');
const settingsBox = document.getElementById('settingsBox');
const settingsCnt = document.getElementById('settingsContent');
const emptyState  = document.getElementById('emptyState');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const settingsScrim  = document.getElementById('settingsScrim');
const settingsDownload = document.getElementById('settingsDownload');
const themeToggle = document.getElementById('themeToggle');
const toast       = document.getElementById('toast');
const studioStatus = document.getElementById('studioStatus');
let toastTimer;
let renderGeneration = 0;

// ── Theme ─────────────────────────────────────────────────────
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('cloonk-theme', t); } catch(e) {}
}
if (themeToggle && !window.DARKROOM_CATALOG) themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'light' ? 'dark' : 'light');
});

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, dur = 2400) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), dur);
}

function setStudioStatus(message = '') {
  if (!studioStatus) return;
  studioStatus.textContent = message;
  studioStatus.hidden = !message;
}

// ── Upload ────────────────────────────────────────────────────
// Decode an image Blob, set it as the source, render, and (optionally)
// persist it to IndexedDB so it survives a refresh.
function loadSourceBlob(blob, name, persist) {
  setStudioStatus(`Reading ${name || 'image'}...`);
  const url = URL.createObjectURL(blob);
  const img = new Image();
  return new Promise(resolve => {
    const afterLoad = async (bmp) => {
      if (state.src && state.src.close) state.src.close();
      state.src = bmp;
      state.isDefaultSource = false;
      URL.revokeObjectURL(url);
      if (emptyState) emptyState.hidden = true;
      grid.hidden = false;
      document.querySelectorAll('.filter-cell.downloaded').forEach(c => c.classList.remove('downloaded'));
      if (window.refreshSourceLabel) window.refreshSourceLabel(name, bmp.width, bmp.height);
      if (persist) {
        idbPut('image', blob).catch(() => {});
        idbPut('name', name || 'image').catch(() => {});
      }
      await renderAll();
      if (state.active) { renderSettings(state.active); syncDrawerPreview(state.active); }
      resolve(true);
    };
    img.onload = () => {
      const bitmapFn = typeof createImageBitmap === 'function'
        ? createImageBitmap(img)
        : Promise.resolve((() => {
            const oc = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
            oc.getContext('2d').drawImage(img, 0, 0);
            return oc;
          })());
      bitmapFn.then(afterLoad).catch(() => {
        URL.revokeObjectURL(url);
        showToast('Could not process image.');
        setStudioStatus('Could not process that image.');
        resolve(false);
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast('Could not load image.');
      setStudioStatus('Could not load that image.');
      resolve(false);
    };
    img.src = url;
  });
}

function handleFiles(files) {
  const file = Array.from(files).find(f => f.type.startsWith('image/'));
  if (!file) { showToast('No image found.'); return; }
  loadSourceBlob(file, file.name, true);
}

if (dropzone) {
  fileInput.addEventListener('change', e => {
    handleFiles(e.target.files);
    e.target.value = '';
  });
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    handleFiles(e.dataTransfer.files);
  });
}

// ── Grid ──────────────────────────────────────────────────────
function buildGrid() {
  grid.innerHTML = '';
  grid.appendChild(makeCell('original', 'Original', 'Source'));
  FILTERS.forEach(f => {
    const cell = makeCell(f.id, f.name, f.sub);
    cell.addEventListener('click', () => selectFilter(f.id));
    grid.appendChild(cell);
  });
}

function makeCell(id, name, sub) {
  const wrap = document.createElement(id === 'original' ? 'div' : 'button');
  if (id !== 'original') {
    wrap.type = 'button';
    wrap.setAttribute('aria-pressed', 'false');
    wrap.setAttribute('aria-label', `Use ${name}: ${sub}`);
  }
  wrap.className = 'filter-cell';
  wrap.dataset.id = id;
  if (FILTER_DESCRIPTIONS[id]) wrap.dataset.desc = FILTER_DESCRIPTIONS[id];

  const cw = document.createElement('div');
  cw.className = 'filter-canvas-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'filter-canvas';
  canvas.id = `canvas-${id}`;

  const label = document.createElement('div');
  label.className = 'filter-label';
  label.innerHTML = `${filterIcon(id)}<span class="filter-label-text"><strong>${name}</strong><em>${sub}</em></span>`;

  if (id !== 'original') {
    const dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'cell-download';
    dl.setAttribute('aria-label', `Download ${name} PNG`);
    dl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M5 20h14"/></svg>';
    dl.addEventListener('click', (e) => {
      e.stopPropagation();
      exportFilter(id, { markCell: true });
    });
    label.appendChild(dl);
  }

  cw.appendChild(canvas);
  wrap.appendChild(cw);
  wrap.appendChild(label);
  return wrap;
}

function selectFilter(id) {
  document.querySelectorAll('.filter-cell').forEach(c => {
    c.classList.remove('active');
    if (c.hasAttribute('aria-pressed')) c.setAttribute('aria-pressed', 'false');
  });
  const cell = document.querySelector(`.filter-cell[data-id="${id}"]`);
  if (cell) {
    cell.classList.add('active');
    if (cell.hasAttribute('aria-pressed')) cell.setAttribute('aria-pressed', 'true');
  }
  state.active = id;
  renderSettings(id);
  openDrawer();
  syncDrawerPreview(id);
  setStudioStatus('');
  writeUrlState();
}

// ── Settings drawer open/close ────────────────────────────────
function openDrawer() {
  if (settingsBox) settingsBox.hidden = false;
  if (settingsScrim) settingsScrim.classList.add('open');
}
function closeDrawer() {
  if (settingsBox) settingsBox.hidden = true;
  if (settingsScrim) settingsScrim.classList.remove('open');
  document.querySelectorAll('.filter-cell.active').forEach(c => {
    c.classList.remove('active');
    if (c.hasAttribute('aria-pressed')) c.setAttribute('aria-pressed', 'false');
  });
  state.active = null;
  writeUrlState();
}

// Mirror the selected filter's grid render into the larger drawer preview.
function syncDrawerPreview(id) {
  const wrap = document.getElementById('settingsPreview');
  const srcCanvas = document.getElementById(`canvas-${id}`);
  if (!wrap || !srcCanvas) return;
  let pc = wrap.querySelector('canvas');
  if (!pc) { pc = document.createElement('canvas'); wrap.appendChild(pc); }
  pc.width = srcCanvas.width;
  pc.height = srcCanvas.height;
  pc.getContext('2d').drawImage(srcCanvas, 0, 0);
}

// ── Settings panel ────────────────────────────────────────────
function renderSettings(id) {
  const f = FILTERS.find(f => f.id === id);
  if (!f) { settingsCnt.innerHTML = ''; return; }
  const titleEl = document.getElementById('settingsTitle');
  if (titleEl) titleEl.innerHTML = `${f.name} <em>${f.sub}</em>`;
  const descEl = document.getElementById('settingsDesc');
  if (descEl) descEl.textContent = FILTER_DESCRIPTIONS[id] || '';

  settingsCnt.innerHTML = f.params.map(p => {
    const control = p.options
      ? `<select id="p-${id}-${p.id}">${p.options.map((option, value) =>
          `<option value="${value}"${value === state.settings[id][p.id] ? ' selected' : ''}>${option}</option>`
        ).join('')}</select>`
      : `<input type="range" id="p-${id}-${p.id}"
          min="${p.min}" max="${p.max}" step="${p.step}"
          value="${state.settings[id][p.id]}">`;
    const displayValue = p.options
      ? p.options[state.settings[id][p.id]]
      : state.settings[id][p.id];
    return `
    <div class="param-row">
      <label class="param-label" for="p-${id}-${p.id}">${p.label}</label>
      <div class="param-controls">
        ${control}
        <span class="param-val" id="pv-${id}-${p.id}">${displayValue}</span>
      </div>
    </div>
  `;
  }).join('');

  f.params.forEach(p => {
    const slider = document.getElementById(`p-${id}-${p.id}`);
    const valEl  = document.getElementById(`pv-${id}-${p.id}`);
    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      state.settings[id][p.id] = v;
      valEl.textContent = p.options ? p.options[v] : v;
      renderOne(id);
      syncDrawerPreview(id);
      scheduleSettingsSave();
      writeUrlState();
    });
  });
}

// ── Render pipeline ───────────────────────────────────────────
async function renderAll() {
  const generation = ++renderGeneration;
  setStudioStatus(`Rendering 0 of ${FILTERS.length} filters...`);
  renderOriginal();
  for (let i = 0; i < FILTERS.length; i++) {
    if (generation !== renderGeneration) return;
    renderOne(FILTERS[i].id);
    setStudioStatus(`Rendering ${i + 1} of ${FILTERS.length} filters...`);
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  setStudioStatus('All filters ready. Select one to adjust and download.');
}

function renderOriginal() {
  const canvas = document.getElementById('canvas-original');
  if (!canvas || !state.src) return;
  const { w, h } = thumbSize(state.src.width, state.src.height);
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(state.src, 0, 0, w, h);
}

function renderOne(id) {
  if (!state.src) return;
  const canvas = document.getElementById(`canvas-${id}`);
  if (!canvas) return;
  const { w, h } = thumbSize(state.src.width, state.src.height);
  canvas.width = w; canvas.height = h;

  const off = new OffscreenCanvas(w, h);
  const offCtx = off.getContext('2d');
  offCtx.drawImage(state.src, 0, 0, w, h);
  const src = offCtx.getImageData(0, 0, w, h);
  const s   = state.settings[id];

  let result;
  switch (id) {
    case 'color-halftone':  result = filterColorHalftone(src, w, h, s); break;
    case 'halftone-dot':    result = filterHalftoneDot(src, w, h, s); break;
    case 'halftone-circle': result = filterHalftoneCircle(src, w, h, s); break;
    case 'halftone-line':   result = filterHalftoneLine(src, w, h, s); break;
    case 'graphic-pen':     result = filterGraphicPen(src, w, h, s); break;
    case 'stamp':           result = filterStamp(src, w, h, s); break;
    case 'bitmap':          result = filterBitmap(src, w, h, s); break;
    case 'patchwork':       result = filterPatchwork(src, w, h, s); break;
    case 'mosaic':          result = filterMosaic(src, w, h, s); break;
    case 'row-stretch':     result = filterRowStretch(src, w, h, s); break;
    case 'path-blur':       result = filterPathBlur(src, w, h, s); break;
    case 'ascii':           result = filterASCII(src, w, h, s); break;
    case 'dithering':       result = filterDithering(src, w, h, s); break;
    case 'matrix-rain':     result = filterMatrixRain(src, w, h, s); break;
    case 'dots':            result = filterDots(src, w, h, s); break;
    case 'contour':         result = filterContour(src, w, h, s); break;
    case 'pixel-sort':      result = filterPixelSort(src, w, h, s); break;
    case 'blockify':        result = filterBlockify(src, w, h, s); break;
    case 'threshold':       result = filterThreshold(src, w, h, s); break;
    case 'edge-detect':     result = filterEdgeDetect(src, w, h, s); break;
    case 'crosshatch':      result = filterCrosshatch(src, w, h, s); break;
    case 'wave-lines':      result = filterWaveLines(src, w, h, s); break;
    case 'noise-field':     result = filterNoiseField(src, w, h, s); break;
    case 'voronoi':         result = filterVoronoi(src, w, h, s); break;
    case 'vhs':             result = filterVHS(src, w, h, s); break;
    case 'fractal-haze':    result = filterFractalHaze(src, w, h, s); break;
    case 'pixel-stretch':   result = filterPixelStretch(src, w, h, s); break;
    case 'sticker':         result = filterSticker(src, w, h, s); break;
  }
  if (result) canvas.getContext('2d').putImageData(result, 0, 0);
}

function thumbSize(sw, sh) {
  const MAX = 320;
  const r = Math.min(MAX / sw, MAX / sh, 1);
  return { w: Math.round(sw * r), h: Math.round(sh * r) };
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lum(r, g, b)     { return 0.299 * r + 0.587 * g + 0.114 * b; }
function lerp(a, b, t)    { return a + (b - a) * t; }

function blurData(data, w, h, radius) {
  const src = new Uint8ClampedArray(data);
  const tmp = new Uint8ClampedArray(data.length);
  const r = Math.max(1, Math.round(radius));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let R=0,G=0,B=0,A=0,n=0;
      for (let k=-r;k<=r;k++) {
        const xi = clamp(x+k,0,w-1);
        const i=(y*w+xi)*4;
        R+=src[i];G+=src[i+1];B+=src[i+2];A+=src[i+3];n++;
      }
      const i=(y*w+x)*4; tmp[i]=R/n;tmp[i+1]=G/n;tmp[i+2]=B/n;tmp[i+3]=A/n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let R=0,G=0,B=0,A=0,n=0;
      for (let k=-r;k<=r;k++) {
        const yi=clamp(y+k,0,h-1);
        const i=(yi*w+x)*4;
        R+=tmp[i];G+=tmp[i+1];B+=tmp[i+2];A+=tmp[i+3];n++;
      }
      const i=(y*w+x)*4; data[i]=R/n;data[i+1]=G/n;data[i+2]=B/n;data[i+3]=A/n;
    }
  }
}

// Simple value noise (2D)
function valueNoise(x, y, seed) {
  const hash = (n) => {
    let h = Math.imul(n ^ seed, 0x9e3779b9);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 0xffffffff;
  };
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const id = (xi, yi) => (xi & 0xffff) * 65537 + (yi & 0xffff);
  return lerp(
    lerp(hash(id(xi,yi)), hash(id(xi+1,yi)), u),
    lerp(hash(id(xi,yi+1)), hash(id(xi+1,yi+1)), u),
    v
  );
}

// Octave noise
function fractalNoise(x, y, octaves, scale, seed) {
  let v = 0, amp = 0.5, freq = 1 / scale, max = 0;
  for (let o = 0; o < octaves; o++) {
    v += valueNoise(x * freq, y * freq, seed + o * 137) * amp;
    max += amp; amp *= 0.5; freq *= 2;
  }
  return v / max;
}

// ══════════════════════════════════════════════════════════════
// ORIGINAL 11 FILTERS (refined)
// ══════════════════════════════════════════════════════════════

function filterColorHalftone(src, w, h, s) {
  const size   = s.size   || 6;
  const spread = s.spread || 36;
  const out = new ImageData(w, h);
  const d = out.data;
  for (let i = 0; i < d.length; i+=4) { d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255; }

  // CMY channels at spread-apart angles
  const baseAngles = [0, spread, spread * 2].map(a => (a + 15) * Math.PI / 180);
  const colors = [[0,255,255],[255,0,255],[255,255,0]];

  baseAngles.forEach((ang, ci) => {
    const cos = Math.cos(ang), sin = Math.sin(ang);
    for (let gy = -size*2; gy < h + size*2; gy += size) {
      for (let gx = -size*2; gx < w + size*2; gx += size) {
        const ix = Math.round(gx * cos - gy * sin);
        const iy = Math.round(gx * sin + gy * cos);
        let sum = 0, cnt = 0;
        for (let dy = -size; dy <= size; dy++) {
          for (let dx = -size; dx <= size; dx++) {
            const px = clamp(ix+dx,0,w-1), py = clamp(iy+dy,0,h-1);
            sum += src.data[(py*w+px)*4 + ci]; cnt++;
          }
        }
        const ink = 1 - (cnt ? sum/cnt : 0) / 255;
        const radius = Math.sqrt(clamp(ink,0,1)) * size * 0.88;
        if (radius < 0.5) continue;
        const [cr,cg,cb] = colors[ci];
        const cx2 = Math.round(gx * cos - gy * sin);
        const cy2 = Math.round(gx * sin + gy * cos);
        for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
          for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
            const px = cx2+dx, py = cy2+dy;
            if (px<0||py<0||px>=w||py>=h) continue;
            if (dx*dx+dy*dy > radius*radius) continue;
            const idx=(py*w+px)*4;
            d[idx]  =Math.round(d[idx]  *cr/255);
            d[idx+1]=Math.round(d[idx+1]*cg/255);
            d[idx+2]=Math.round(d[idx+2]*cb/255);
          }
        }
      }
    }
  });
  return out;
}

function filterHalftoneDot(src, w, h, s) {
  const size = s.size  || 10;
  const ang  = (s.angle || 45) * Math.PI / 180;
  const out = new ImageData(w, h);
  const d = out.data;
  for (let i=0;i<d.length;i+=4){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}
  const cos = Math.cos(ang), sin = Math.sin(ang);
  for (let gy = -size*2; gy < h+size*2; gy += size) {
    for (let gx = -size*2; gx < w+size*2; gx += size) {
      const cx = gx*cos - gy*sin, cy = gx*sin + gy*cos;
      const sx = clamp(Math.round(cx),0,w-1), sy = clamp(Math.round(cy),0,h-1);
      let sum=0,cnt=0;
      const sr=Math.max(1,Math.floor(size/2));
      for (let dy=-sr;dy<=sr;dy++) for (let dx=-sr;dx<=sr;dx++) {
        const i=((clamp(sy+dy,0,h-1))*w+clamp(sx+dx,0,w-1))*4;
        sum+=lum(src.data[i],src.data[i+1],src.data[i+2]);cnt++;
      }
      const radius=(1-(cnt?sum/cnt:0)/255)*size*0.74;
      if (radius<0.5) continue;
      const r2=radius*radius;
      for (let dy=-Math.ceil(radius);dy<=Math.ceil(radius);dy++) {
        for (let dx=-Math.ceil(radius);dx<=Math.ceil(radius);dx++) {
          const px=Math.round(cx)+dx,py=Math.round(cy)+dy;
          if(px<0||py<0||px>=w||py>=h||dx*dx+dy*dy>r2) continue;
          const idx=(py*w+px)*4; d[idx]=0;d[idx+1]=0;d[idx+2]=0;d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

function filterHalftoneCircle(src, w, h, s) {
  const size  = s.size      || 12;
  const thick = (s.thickness|| 45) / 100;
  const out = new ImageData(w, h);
  const d = out.data;
  for (let i=0;i<d.length;i+=4){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}
  for (let gy = 0; gy < h+size; gy += size) {
    for (let gx = 0; gx < w+size; gx += size) {
      const sx=clamp(gx,0,w-1),sy=clamp(gy,0,h-1);
      let sum=0,cnt=0;
      const sr=Math.max(1,Math.floor(size/2));
      for(let dy=-sr;dy<=sr;dy++) for(let dx=-sr;dx<=sr;dx++){
        const i=((clamp(sy+dy,0,h-1))*w+clamp(sx+dx,0,w-1))*4;
        sum+=lum(src.data[i],src.data[i+1],src.data[i+2]);cnt++;
      }
      const luma = cnt?sum/cnt:0;
      const outerR = (1-luma/255)*size*0.74;
      const innerR = outerR*(1-thick);
      if(outerR<0.8) continue;
      for(let dy=-Math.ceil(outerR);dy<=Math.ceil(outerR);dy++){
        for(let dx=-Math.ceil(outerR);dx<=Math.ceil(outerR);dx++){
          const px=gx+dx,py=gy+dy;
          if(px<0||py<0||px>=w||py>=h) continue;
          const dist=Math.sqrt(dx*dx+dy*dy);
          if(dist>outerR||dist<innerR) continue;
          const idx=(py*w+px)*4;d[idx]=0;d[idx+1]=0;d[idx+2]=0;d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

function filterHalftoneLine(src, w, h, s) {
  const lineH = Math.max(2, s.size  || 6);
  const ang   = (s.angle || 0) * Math.PI / 180;
  const out = new ImageData(w, h);
  const d = out.data;
  for(let i=0;i<d.length;i+=4){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}
  const cos=Math.cos(ang),sin=Math.sin(ang);
  const maxT = Math.max(w,h)+lineH*2;
  for(let band=-lineH; band<maxT+lineH; band+=lineH){
    let sum=0,cnt=0;
    for(let t=0;t<maxT;t+=3){
      const px=clamp(Math.round(t*cos-band*sin),0,w-1);
      const py=clamp(Math.round(t*sin+band*cos),0,h-1);
      const i=(py*w+px)*4; sum+=lum(src.data[i],src.data[i+1],src.data[i+2]); cnt++;
    }
    const luma=cnt?sum/cnt:0;
    const thick=Math.round((1-luma/255)*lineH*0.96);
    if(thick<1) continue;
    for(let t=0;t<maxT;t++){
      for(let dt=-Math.floor(thick/2);dt<=Math.ceil(thick/2);dt++){
        const px=Math.round(t*cos-(band+dt)*sin);
        const py=Math.round(t*sin+(band+dt)*cos);
        if(px<0||py<0||px>=w||py>=h) continue;
        const idx=(py*w+px)*4;d[idx]=0;d[idx+1]=0;d[idx+2]=0;d[idx+3]=255;
      }
    }
  }
  return out;
}

function filterGraphicPen(src, w, h, s) {
  const len     = Math.max(2, s.length  || 8);
  const density = (s.density || 50) / 100;
  const angle   = (s.angle   || 45) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const out = new ImageData(w, h);
  const d = out.data;
  for(let i=0;i<d.length;i+=4){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}
  const spacing = Math.max(1, Math.round(len*(1-density*0.5)));
  for(let y=-len;y<h+len;y+=spacing){
    for(let x=-len;x<w+len;x+=spacing){
      const sx=clamp(x,0,w-1),sy=clamp(y,0,h-1);
      const i=(sy*w+sx)*4;
      const luma=lum(src.data[i],src.data[i+1],src.data[i+2]);
      if(luma > 255*(1-density)) continue;
      const sLen=Math.round(len*(1-luma/255)*0.9+2);
      for(let t=0;t<sLen;t++){
        const px=Math.round(x+t*cos),py=Math.round(y+t*sin);
        if(px<0||py<0||px>=w||py>=h) continue;
        const idx=(py*w+px)*4;d[idx]=0;d[idx+1]=0;d[idx+2]=0;d[idx+3]=255;
      }
    }
  }
  return out;
}

function filterStamp(src, w, h, s) {
  const smooth    = s.smooth    || 4;
  const threshold = s.threshold || 128;
  const data = new Uint8ClampedArray(src.data);
  blurData(data, w, h, smooth*2);
  const out = new ImageData(w, h);
  const d = out.data;
  for(let i=0;i<w*h;i++){
    const idx=i*4;
    const l=lum(data[idx],data[idx+1],data[idx+2]);
    const ink=l<threshold?0:255;
    d[idx]=ink;d[idx+1]=ink;d[idx+2]=ink;d[idx+3]=255;
  }
  return out;
}

function filterBitmap(src, w, h, s) {
  const size      = s.size      || 20;
  const threshold = s.threshold || 128;
  const out = new ImageData(w, h);
  const d = out.data;
  for(let y=0;y<h;y+=size) for(let x=0;x<w;x+=size){
    let sum=0,cnt=0;
    for(let dy=0;dy<size&&y+dy<h;dy++) for(let dx=0;dx<size&&x+dx<w;dx++){
      const i=((y+dy)*w+(x+dx))*4;
      sum+=lum(src.data[i],src.data[i+1],src.data[i+2]);cnt++;
    }
    const ink=(cnt?sum/cnt:0)<threshold?0:255;
    for(let dy=0;dy<size&&y+dy<h;dy++) for(let dx=0;dx<size&&x+dx<w;dx++){
      const idx=((y+dy)*w+(x+dx))*4;
      d[idx]=ink;d[idx+1]=ink;d[idx+2]=ink;d[idx+3]=255;
    }
  }
  return out;
}

function filterPatchwork(src, w, h, s) {
  const size   = s.size   || 16;
  const relief = s.relief || 4;
  const out = new ImageData(w, h);
  const d = out.data;
  for(let y=0;y<h;y+=size) for(let x=0;x<w;x+=size){
    let R=0,G=0,B=0,cnt=0;
    for(let dy=0;dy<size&&y+dy<h;dy++) for(let dx=0;dx<size&&x+dx<w;dx++){
      const i=((y+dy)*w+(x+dx))*4;R+=src.data[i];G+=src.data[i+1];B+=src.data[i+2];cnt++;
    }
    const ar=cnt?R/cnt:0,ag=cnt?G/cnt:0,ab=cnt?B/cnt:0;
    for(let dy=0;dy<size&&y+dy<h;dy++) for(let dx=0;dx<size&&x+dx<w;dx++){
      const idx=((y+dy)*w+(x+dx))*4;
      let bright=0;
      if(dx<relief||dy<relief) bright=relief*7;
      else if(dx>=size-relief||dy>=size-relief) bright=-relief*7;
      d[idx]=clamp(ar+bright,0,255);d[idx+1]=clamp(ag+bright,0,255);
      d[idx+2]=clamp(ab+bright,0,255);d[idx+3]=255;
    }
  }
  return out;
}

function filterMosaic(src, w, h, s) {
  const size = Math.max(2,s.size||12);
  const out = new ImageData(w, h);
  const d = out.data;
  for(let y=0;y<h;y+=size) for(let x=0;x<w;x+=size){
    let R=0,G=0,B=0,cnt=0;
    for(let dy=0;dy<size&&y+dy<h;dy++) for(let dx=0;dx<size&&x+dx<w;dx++){
      const i=((y+dy)*w+(x+dx))*4;R+=src.data[i];G+=src.data[i+1];B+=src.data[i+2];cnt++;
    }
    const ar=cnt?R/cnt:0,ag=cnt?G/cnt:0,ab=cnt?B/cnt:0;
    for(let dy=0;dy<size&&y+dy<h;dy++) for(let dx=0;dx<size&&x+dx<w;dx++){
      const idx=((y+dy)*w+(x+dx))*4;
      d[idx]=ar;d[idx+1]=ag;d[idx+2]=ab;d[idx+3]=255;
    }
  }
  return out;
}

function filterRowStretch(src, w, h, s) {
  const pct    = (s.row  != null ? s.row  : 50) / 100;
  const blend  = (s.blend!= null ? s.blend: 0) / 100;
  const srcRow = clamp(Math.round(pct*(h-1)),0,h-1);
  const out = new ImageData(w, h);
  const d = out.data;
  const row = new Uint8ClampedArray(w*4);
  for(let x=0;x<w;x++){
    const si=(srcRow*w+x)*4;
    row[x*4]=src.data[si];row[x*4+1]=src.data[si+1];
    row[x*4+2]=src.data[si+2];row[x*4+3]=src.data[si+3];
  }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const di=(y*w+x)*4;
    const si2=(y*w+x)*4;
    d[di]  =lerp(row[x*4],  src.data[si2],  blend);
    d[di+1]=lerp(row[x*4+1],src.data[si2+1],blend);
    d[di+2]=lerp(row[x*4+2],src.data[si2+2],blend);
    d[di+3]=255;
  }
  return out;
}

function filterPathBlur(src, w, h, s) {
  const dist  = Math.max(2, s.distance||20);
  const grain = (s.grain||40)/100;
  const angle = (s.angle||0)*Math.PI/180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const blurred = new Uint8ClampedArray(src.data.length);
  const half = Math.floor(dist/2);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let R=0,G=0,B=0,cnt=0;
    for(let t=-half;t<=half;t++){
      const px=clamp(Math.round(x+t*cos),0,w-1);
      const py=clamp(Math.round(y+t*sin),0,h-1);
      const i=(py*w+px)*4;R+=src.data[i];G+=src.data[i+1];B+=src.data[i+2];cnt++;
    }
    const i=(y*w+x)*4;blurred[i]=R/cnt;blurred[i+1]=G/cnt;blurred[i+2]=B/cnt;blurred[i+3]=255;
  }
  const out = new ImageData(w, h);
  const d = out.data;
  for(let i=0;i<w*h;i++){
    const idx=i*4;
    const useOrig=Math.random()>grain;
    d[idx]  =useOrig?src.data[idx]  :blurred[idx];
    d[idx+1]=useOrig?src.data[idx+1]:blurred[idx+1];
    d[idx+2]=useOrig?src.data[idx+2]:blurred[idx+2];
    d[idx+3]=255;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════
// NEW 15 FILTERS
// ══════════════════════════════════════════════════════════════

// ── ASCII ─────────────────────────────────────────────────────
function filterASCII(src, w, h, s) {
  const cellSize = Math.max(4, s.cellSize || 9);
  const contrast = (s.contrast || 110) / 100;
  const color    = s.color     || 0;
  const chars = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'.split('');
  const nChars = chars.length;

  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.font = `bold ${cellSize}px monospace`;
  ctx.textBaseline = 'top';

  for (let y = 0; y < h; y += cellSize) {
    for (let x = 0; x < w; x += cellSize) {
      let R=0,G=0,B=0,cnt=0;
      for(let dy=0;dy<cellSize&&y+dy<h;dy++) for(let dx=0;dx<cellSize&&x+dx<w;dx++){
        const i=((y+dy)*w+(x+dx))*4;
        R+=src.data[i];G+=src.data[i+1];B+=src.data[i+2];cnt++;
      }
      const ar=cnt?R/cnt:0,ag=cnt?G/cnt:0,ab=cnt?B/cnt:0;
      const l = clamp(lum(ar,ag,ab)*contrast,0,255);
      const charIdx = Math.floor((l/255)*(nChars-1));
      const ch = chars[charIdx];
      if(color) ctx.fillStyle=`rgb(${Math.round(ar)},${Math.round(ag)},${Math.round(ab)})`;
      else ctx.fillStyle=`rgb(${Math.round(l)},${Math.round(l)},${Math.round(l)})`;
      ctx.fillText(ch, x, y);
    }
  }
  return ctx.getImageData(0, 0, w, h);
}

// ── Dithering (Floyd-Steinberg) ───────────────────────────────
function filterDithering(src, w, h, s) {
  const levels    = Math.max(2, s.levels    || 2);
  const strength  = (s.strength  || 100) / 100;
  const grayscale = s.grayscale  || 0;

  const quantize = (v, L) => Math.round(v*(L-1)/255)*Math.round(255/(L-1));

  const data = new Float32Array(src.data.length);
  for(let i=0;i<src.data.length;i++) data[i]=src.data[i];

  if (grayscale) {
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      const l=lum(data[i],data[i+1],data[i+2]);
      data[i]=data[i+1]=data[i+2]=l;
    }
  }

  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    const oldR=clamp(data[i],0,255),oldG=clamp(data[i+1],0,255),oldB=clamp(data[i+2],0,255);
    const newR=quantize(oldR,levels),newG=quantize(oldG,levels),newB=quantize(oldB,levels);
    const errR=(oldR-newR)*strength,errG=(oldG-newG)*strength,errB=(oldB-newB)*strength;
    data[i]=newR;data[i+1]=newG;data[i+2]=newB;
    const spread=[[1,0,7/16],[-1,1,3/16],[0,1,5/16],[1,1,1/16]];
    for(const [dx,dy,w2] of spread){
      const nx=x+dx,ny=y+dy;
      if(nx<0||nx>=w||ny<0||ny>=h) continue;
      const ni=(ny*w+nx)*4;
      data[ni]  +=errR*w2; data[ni+1]+=errG*w2; data[ni+2]+=errB*w2;
    }
  }

  const out = new ImageData(w, h);
  for(let i=0;i<w*h;i++){
    const idx=i*4;
    out.data[idx]=clamp(data[idx],0,255);
    out.data[idx+1]=clamp(data[idx+1],0,255);
    out.data[idx+2]=clamp(data[idx+2],0,255);
    out.data[idx+3]=255;
  }
  return out;
}

// ── Matrix Rain ───────────────────────────────────────────────
function filterMatrixRain(src, w, h, s) {
  const colW    = Math.max(6, s.columns || 12);
  const density = (s.density || 70) / 100;
  const fade    = s.fade     || 5;
  const glyphs  = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789!@#$%^&*'.split('');

  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext('2d');

  // Dark background from source image
  const tmp = new OffscreenCanvas(w, h);
  const tCtx = tmp.getContext('2d');
  tCtx.putImageData(src, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.28;
  ctx.drawImage(tmp, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, w, h);

  // Sample source to get average luminance per column for density
  ctx.font = `${colW - 1}px monospace`;
  ctx.textBaseline = 'top';

  const seed = 42;
  for (let col = 0; col < w; col += colW) {
    // Sample average brightness of this column
    let sum = 0, cnt = 0;
    for(let y2=0;y2<h;y2+=4){
      const x2=clamp(col+colW/2|0,0,w-1);
      const i=(y2*w+x2)*4;
      sum+=lum(src.data[i],src.data[i+1],src.data[i+2]);cnt++;
    }
    const avgL = cnt?sum/cnt:128;
    const colDensity = density * (avgL/255 * 0.7 + 0.3);

    // Draw glyphs downward with fade
    const startY = ((col * 137 + seed) % h) - h/2;
    for(let row=0;row<h;row+=colW){
      if(Math.random()>colDensity) continue;
      const y2 = startY + row;
      if(y2<0||y2>=h) continue;
      // Brightness falls off with depth
      const t = row/h;
      const bright = Math.round(255 * Math.pow(1-t, fade * 0.2));
      const isHead = row===0||Math.random()<0.05;
      if(isHead) ctx.fillStyle=`rgba(180,255,180,${bright/255})`;
      else ctx.fillStyle=`rgba(0,${bright},0,${bright/255})`;
      const g = glyphs[Math.floor(Math.random()*glyphs.length)];
      ctx.fillText(g, col, y2);
    }
  }

  return ctx.getImageData(0, 0, w, h);
}

// ── Dots ──────────────────────────────────────────────────────
function filterDots(src, w, h, s) {
  const spacing = s.spacing || 10;
  const minSize = s.minSize || 1;
  const maxSize = s.maxSize || 7;
  const out = new ImageData(w, h);
  const d = out.data;
  // White bg
  for(let i=0;i<d.length;i+=4){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}

  for(let y=spacing/2|0;y<h;y+=spacing){
    for(let x=spacing/2|0;x<w;x+=spacing){
      const i=(clamp(y,0,h-1)*w+clamp(x,0,w-1))*4;
      const R=src.data[i],G=src.data[i+1],B=src.data[i+2];
      const l=lum(R,G,B);
      const radius=lerp(maxSize,minSize,l/255);
      const r2=radius*radius;
      for(let dy=-Math.ceil(radius);dy<=Math.ceil(radius);dy++){
        for(let dx=-Math.ceil(radius);dx<=Math.ceil(radius);dx++){
          const px=x+dx,py=y+dy;
          if(px<0||py<0||px>=w||py>=h||dx*dx+dy*dy>r2) continue;
          const idx=(py*w+px)*4;
          d[idx]=R;d[idx+1]=G;d[idx+2]=B;d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

// ── Contour ───────────────────────────────────────────────────
function filterContour(src, w, h, s) {
  const levels    = Math.max(2, s.levels    || 10);
  const thickness = s.thickness || 1;
  const colorMode = s.color     || 0;

  // Build luminance map
  const lumaMap = new Float32Array(w*h);
  for(let i=0;i<w*h;i++){
    const idx=i*4;
    lumaMap[i]=lum(src.data[idx],src.data[idx+1],src.data[idx+2]);
  }

  const out = new ImageData(w, h);
  const d = out.data;
  for(let i=0;i<d.length;i+=4){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}

  const step = 255/levels;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const l = lumaMap[y*w+x];
    const band = Math.floor(l/step);
    // Check if neighbours cross a band boundary
    let isEdge = false;
    for(let dy=-thickness;dy<=thickness&&!isEdge;dy++){
      for(let dx=-thickness;dx<=thickness&&!isEdge;dx++){
        if(!dx&&!dy) continue;
        const nx=clamp(x+dx,0,w-1),ny=clamp(y+dy,0,h-1);
        if(Math.floor(lumaMap[ny*w+nx]/step)!==band) isEdge=true;
      }
    }
    if(!isEdge) continue;
    const idx=(y*w+x)*4;
    if(colorMode){
      const si=idx;
      d[idx]=src.data[si];d[idx+1]=src.data[si+1];d[idx+2]=src.data[si+2];
    } else {
      d[idx]=0;d[idx+1]=0;d[idx+2]=0;
    }
    d[idx+3]=255;
  }
  return out;
}

// ── Pixel Sort ────────────────────────────────────────────────
function filterPixelSort(src, w, h, s) {
  const lo  = s.threshold || 80;
  const hi  = s.upper     || 200;
  const dir = s.direction || 0; // 0=horizontal,1=vertical
  const data = new Uint8ClampedArray(src.data);

  if (!dir) {
    // Sort rows
    for(let y=0;y<h;y++){
      let x=0;
      while(x<w){
        // Find run start (pixel in threshold range)
        while(x<w){
          const i=(y*w+x)*4;
          const l=lum(data[i],data[i+1],data[i+2]);
          if(l>=lo&&l<=hi) break; x++;
        }
        const start=x;
        while(x<w){
          const i=(y*w+x)*4;
          const l=lum(data[i],data[i+1],data[i+2]);
          if(l<lo||l>hi) break; x++;
        }
        const end=x;
        if(end<=start+1) continue;
        // Extract, sort by luma, put back
        const run=[];
        for(let k=start;k<end;k++){
          const i=(y*w+k)*4;
          run.push([lum(data[i],data[i+1],data[i+2]),data[i],data[i+1],data[i+2]]);
        }
        run.sort((a,b)=>a[0]-b[0]);
        for(let k=0;k<run.length;k++){
          const i=(y*w+(start+k))*4;
          data[i]=run[k][1];data[i+1]=run[k][2];data[i+2]=run[k][3];
        }
      }
    }
  } else {
    // Sort columns
    for(let x=0;x<w;x++){
      let y=0;
      while(y<h){
        while(y<h){
          const i=(y*w+x)*4;
          const l=lum(data[i],data[i+1],data[i+2]);
          if(l>=lo&&l<=hi) break; y++;
        }
        const start=y;
        while(y<h){
          const i=(y*w+x)*4;
          const l=lum(data[i],data[i+1],data[i+2]);
          if(l<lo||l>hi) break; y++;
        }
        const end=y;
        if(end<=start+1) continue;
        const run=[];
        for(let k=start;k<end;k++){
          const i=(k*w+x)*4;
          run.push([lum(data[i],data[i+1],data[i+2]),data[i],data[i+1],data[i+2]]);
        }
        run.sort((a,b)=>a[0]-b[0]);
        for(let k=0;k<run.length;k++){
          const i=((start+k)*w+x)*4;
          data[i]=run[k][1];data[i+1]=run[k][2];data[i+2]=run[k][3];
        }
      }
    }
  }

  const out = new ImageData(w, h);
  out.data.set(data);
  return out;
}

// ── Blockify ──────────────────────────────────────────────────
function filterBlockify(src, w, h, s) {
  const size = s.size    || 24;
  const jitter= s.variance|| 6;
  const gap   = s.gap    || 2;
  const out = new ImageData(w, h);
  const d = out.data;
  // Background from blurred source
  const bg = new Uint8ClampedArray(src.data);
  blurData(bg, w, h, size * 0.4);
  out.data.set(bg);

  // Draw jittered blocks
  const cols = Math.ceil(w / size) + 2;
  const rows = Math.ceil(h / size) + 2;
  for(let row=0;row<rows;row++){
    for(let col=0;col<cols;col++){
      const bx = (col - 1) * size + (Math.random()-0.5)*jitter*2|0;
      const by = (row - 1) * size + (Math.random()-0.5)*jitter*2|0;
      const bw = size - gap;
      const bh = size - gap;
      // Sample center
      const sx=clamp(bx+bw/2|0,0,w-1),sy=clamp(by+bh/2|0,0,h-1);
      const i=(sy*w+sx)*4;
      let R=src.data[i],G=src.data[i+1],B=src.data[i+2];
      // Average 3x3 region
      let R2=0,G2=0,B2=0,cnt2=0;
      for(let dy=-size/2|0;dy<=size/2;dy+=4) for(let dx=-size/2|0;dx<=size/2;dx+=4){
        const px2=clamp(sx+dx,0,w-1),py2=clamp(sy+dy,0,h-1);
        const i2=(py2*w+px2)*4;R2+=src.data[i2];G2+=src.data[i2+1];B2+=src.data[i2+2];cnt2++;
      }
      if(cnt2){R=R2/cnt2|0;G=G2/cnt2|0;B=B2/cnt2|0;}
      for(let dy=0;dy<bh;dy++){
        for(let dx=0;dx<bw;dx++){
          const px=bx+dx,py=by+dy;
          if(px<0||py<0||px>=w||py>=h) continue;
          const idx=(py*w+px)*4;
          // Subtle top-left highlight
          const hl=(dx<2||dy<2)?18:(dx>=bw-2||dy>=bh-2)?-12:0;
          d[idx]=clamp(R+hl,0,255);d[idx+1]=clamp(G+hl,0,255);d[idx+2]=clamp(B+hl,0,255);d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

// ── Threshold / Posterize ─────────────────────────────────────
function filterThreshold(src, w, h, s) {
  const levels  = Math.max(2, s.levels  || 2);
  const smooth  = s.smooth  || 0;
  const channel = s.channel || 0; // 0=luma, 1=per-channel
  const step    = 255/(levels-1);
  const data = new Uint8ClampedArray(src.data);
  if(smooth) blurData(data, w, h, smooth);

  const out = new ImageData(w, h);
  const d = out.data;
  for(let i=0;i<w*h;i++){
    const idx=i*4;
    if(channel){
      d[idx]  =Math.round(data[idx]  /step)*step;
      d[idx+1]=Math.round(data[idx+1]/step)*step;
      d[idx+2]=Math.round(data[idx+2]/step)*step;
    } else {
      const l=lum(data[idx],data[idx+1],data[idx+2]);
      const q=Math.round(l/step)*step;
      const ratio=q/(l||1);
      d[idx]  =clamp(data[idx]  *ratio,0,255);
      d[idx+1]=clamp(data[idx+1]*ratio,0,255);
      d[idx+2]=clamp(data[idx+2]*ratio,0,255);
    }
    d[idx+3]=255;
  }
  return out;
}

// ── Edge Detection (Sobel) ────────────────────────────────────
function filterEdgeDetect(src, w, h, s) {
  const strength = s.strength || 3;
  const invert   = s.invert   || 1;
  const colorize = s.color    || 0;

  const lumas = new Float32Array(w*h);
  for(let i=0;i<w*h;i++){
    const idx=i*4;lumas[i]=lum(src.data[idx],src.data[idx+1],src.data[idx+2]);
  }

  const out = new ImageData(w, h);
  const d = out.data;
  const Kx=[-1,0,1,-2,0,2,-1,0,1];
  const Ky=[-1,-2,-1,0,0,0,1,2,1];

  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let gx=0,gy=0,k=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++,k++){
      const l=lumas[clamp(y+dy,0,h-1)*w+clamp(x+dx,0,w-1)];
      gx+=l*Kx[k]; gy+=l*Ky[k];
    }
    const mag=clamp(Math.sqrt(gx*gx+gy*gy)/255*strength*strength*4,0,255);
    const idx=(y*w+x)*4;
    if(colorize){
      const si=idx;
      const t=mag/255;
      d[idx]=clamp(src.data[si]*t*2,0,255);
      d[idx+1]=clamp(src.data[si+1]*t*2,0,255);
      d[idx+2]=clamp(src.data[si+2]*t*2,0,255);
    } else {
      const v=invert?255-mag:mag;
      d[idx]=v;d[idx+1]=v;d[idx+2]=v;
    }
    d[idx+3]=255;
  }
  return out;
}

// ── Crosshatch ────────────────────────────────────────────────
function filterCrosshatch(src, w, h, s) {
  const spacing   = s.spacing   || 7;
  const lineWidth = s.lineWidth || 1;
  const passes    = s.passes    || 3;
  const out = new ImageData(w, h);
  const d = out.data;
  for(let i=0;i<d.length;i+=4){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}

  const hatchAngles = [45, -45, 90, 0].slice(0, passes);

  for(const angleDeg of hatchAngles){
    const ang = angleDeg * Math.PI / 180;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const maxT = Math.max(w,h)*2;
    for(let band=-maxT;band<maxT;band+=spacing){
      for(let t=-maxT;t<maxT;t++){
        for(let lw=0;lw<lineWidth;lw++){
          const b=band+lw;
          const px=Math.round(t*cos-b*sin);
          const py=Math.round(t*sin+b*cos);
          if(px<0||py<0||px>=w||py>=h) continue;
          // Only draw if luminance is dark enough
          const si=(clamp(py,0,h-1)*w+clamp(px,0,w-1))*4;
          const l=lum(src.data[si],src.data[si+1],src.data[si+2]);
          // Threshold: darker areas get more hatch passes
          const passThreshold=255*(1-(hatchAngles.indexOf(angleDeg)+1)/passes);
          if(l>passThreshold) continue;
          const idx=(py*w+px)*4;
          d[idx]=0;d[idx+1]=0;d[idx+2]=0;d[idx+3]=255;
        }
      }
    }
  }
  return out;
}

// ── Wave Lines ────────────────────────────────────────────────
function filterWaveLines(src, w, h, s) {
  const amp     = s.amplitude || 12;
  const freq    = s.frequency || 5;
  const spacing = s.spacing   || 6;
  const out = new ImageData(w, h);
  const d = out.data;
  for(let i=0;i<d.length;i+=4){d[i]=0;d[i+1]=0;d[i+2]=0;d[i+3]=255;}

  for(let lineY=0;lineY<h;lineY+=spacing){
    for(let x=0;x<w;x++){
      const si=(clamp(lineY,0,h-1)*w+clamp(x,0,w-1))*4;
      const l=lum(src.data[si],src.data[si+1],src.data[si+2]);
      const wave=Math.sin((x/w)*Math.PI*2*freq + lineY*0.05)*(l/255)*amp;
      const py=Math.round(lineY+wave);
      if(py<0||py>=h) continue;
      const idx=(py*w+x)*4;
      const srcIdx=(clamp(lineY,0,h-1)*w+x)*4;
      d[idx]=src.data[srcIdx];
      d[idx+1]=src.data[srcIdx+1];
      d[idx+2]=src.data[srcIdx+2];
      d[idx+3]=255;
    }
  }
  return out;
}

// ── Noise Field ───────────────────────────────────────────────
function filterNoiseField(src, w, h, s) {
  const scale    = s.scale    || 40;
  const strength = (s.strength|| 60) / 100;
  const colorize = s.colorize || 0;
  const out = new ImageData(w, h);
  const d = out.data;

  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const n=fractalNoise(x, y, 4, scale, 1234);
    const ni=n*2-1; // -1..1
    const idx=(y*w+x)*4;
    const si=idx;
    if(colorize){
      const r=clamp(src.data[si]+ni*80*strength,0,255);
      const g=clamp(src.data[si+1]+fractalNoise(x,y,3,scale*1.3,5678)*2*80*strength-80*strength,0,255);
      const b=clamp(src.data[si+2]-ni*80*strength,0,255);
      d[idx]=r;d[idx+1]=g;d[idx+2]=b;
    } else {
      const bump=ni*128*strength;
      d[idx]  =clamp(src.data[si]  +bump,0,255);
      d[idx+1]=clamp(src.data[si+1]+bump,0,255);
      d[idx+2]=clamp(src.data[si+2]+bump,0,255);
    }
    d[idx+3]=255;
  }
  return out;
}

// ── Voronoi ───────────────────────────────────────────────────
function filterVoronoi(src, w, h, s) {
  const nPoints = Math.min(500, s.points || 80);
  const showEdges = s.edges  || 0;
  const edgeW    = s.edgeW   || 1;

  // Generate random seed points
  const pts = [];
  const rng = mulberry32(0xdeadbeef);
  for(let i=0;i<nPoints;i++){
    pts.push([rng()*w, rng()*h]);
  }

  // For each pixel, find nearest Voronoi site
  const siteOf = new Int16Array(w*h);
  const dist2  = new Float32Array(w*h).fill(Infinity);

  // Bucket the points into a grid for O(n) lookup
  const bSize = Math.max(20, (w*h/nPoints)|0);
  const bW = Math.ceil(w/bSize)+1, bH = Math.ceil(h/bSize)+1;
  const buckets = Array.from({length:bW*bH},()=>[]);
  pts.forEach((pt,i)=>{
    const bx=pt[0]/bSize|0,by=pt[1]/bSize|0;
    buckets[by*bW+bx].push(i);
  });

  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const idx=y*w+x;
    let minD=Infinity,minI=0;
    const bx=x/bSize|0,by=y/bSize|0;
    for(let db=-2;db<=2;db++) for(let da=-2;da<=2;da++){
      const bxi=bx+da,byi=by+db;
      if(bxi<0||byi<0||bxi>=bW||byi>=bH) continue;
      for(const pi of buckets[byi*bW+bxi]){
        const dx=pts[pi][0]-x,dy=pts[pi][1]-y;
        const d2=dx*dx+dy*dy;
        if(d2<minD){minD=d2;minI=pi;}
      }
    }
    siteOf[idx]=minI;
    dist2[idx]=minD;
  }

  // Sample source color at each Voronoi seed
  const cellColors = pts.map(([px,py])=>{
    const sx=clamp(Math.round(px),0,w-1),sy=clamp(Math.round(py),0,h-1);
    const i=(sy*w+sx)*4;
    return [src.data[i],src.data[i+1],src.data[i+2]];
  });

  const out = new ImageData(w, h);
  const d = out.data;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const idx=(y*w+x)*4;
    const cell=siteOf[y*w+x];
    const [R,G,B]=cellColors[cell];
    let isEdge=false;
    if(showEdges){
      for(let dy=-1;dy<=1&&!isEdge;dy++) for(let dx=-1;dx<=1&&!isEdge;dx++){
        const nx=clamp(x+dx,0,w-1),ny=clamp(y+dy,0,h-1);
        if(siteOf[ny*w+nx]!==cell) isEdge=true;
      }
    }
    if(isEdge){d[idx]=0;d[idx+1]=0;d[idx+2]=0;}
    else{d[idx]=R;d[idx+1]=G;d[idx+2]=B;}
    d[idx+3]=255;
  }
  return out;
}

function mulberry32(a){
  return()=>{
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/0x100000000;
  };
}

// ── VHS ───────────────────────────────────────────────────────
function filterVHS(src, w, h, s) {
  const chroma    = s.chroma    || 8;
  const scanlines = s.scanlines || 3;
  const noiseAmt  = (s.noise    || 18) / 100;
  const out = new ImageData(w, h);
  const d = out.data;

  for(let y=0;y<h;y++){
    // Horizontal jitter per row (tape tracking glitch)
    const jitter = Math.random()<0.04 ? (Math.random()-0.5)*chroma*3|0 : 0;
    for(let x=0;x<w;x++){
      const rx=clamp(x+chroma+jitter,0,w-1);
      const bx=clamp(x-chroma+jitter,0,w-1);
      const gx=clamp(x+jitter,0,w-1);
      const ri=(y*w+rx)*4, gi=(y*w+gx)*4, bi=(y*w+bx)*4;
      const idx=(y*w+x)*4;

      let r=src.data[ri],g=src.data[gi+1],b=src.data[bi+2];

      // Scan line dimming
      if(scanlines>0 && y%Math.max(2,scanlines)===0){
        r=r*0.72|0; g=g*0.72|0; b=b*0.72|0;
      }

      // Luminance noise
      if(noiseAmt>0){
        const n=(Math.random()-0.5)*255*noiseAmt;
        r=clamp(r+n,0,255); g=clamp(g+n,0,255); b=clamp(b+n,0,255);
      }

      d[idx]=r; d[idx+1]=g; d[idx+2]=b; d[idx+3]=255;
    }
  }

  // Add a couple of horizontal tracking glitch bands
  const nBands=Math.floor(Math.random()*3)+1;
  for(let b=0;b<nBands;b++){
    const bandY=Math.random()*h|0;
    const bandH=Math.random()*6+2|0;
    const shift=((Math.random()-0.5)*chroma*4)|0;
    for(let y2=bandY;y2<Math.min(h,bandY+bandH);y2++){
      for(let x2=0;x2<w;x2++){
        const srcX=clamp(x2+shift,0,w-1);
        const di=(y2*w+x2)*4, si=(y2*w+srcX)*4;
        d[di]=d[si];d[di+1]=d[si+1];d[di+2]=d[si+2];
      }
    }
  }

  return out;
}

// ── Fractal Haze ─────────────────────────────────────────────
function filterFractalHaze(src, w, h, s) {
  const intensity  = s.intensity  || 50;
  const threshold  = s.threshold  || 80;
  const direction  = s.direction  || 0; // 0=horizontal,1=vertical

  const data = new Uint8ClampedArray(src.data);

  if (!direction) {
    // Sort horizontal runs by luminance with wave displacement
    for(let y=0;y<h;y++){
      const row = new Array(w);
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4;
        row[x]=[lum(data[i],data[i+1],data[i+2]),data[i],data[i+1],data[i+2]];
      }
      // Only sort pixels above threshold
      const bright=row.filter(p=>p[0]>=threshold);
      const dark=row.filter(p=>p[0]<threshold);
      bright.sort((a,b)=>a[0]-b[0]);
      // Interleave with intensity
      const sortedRow=[];
      let bi=0,di=0;
      for(let x=0;x<w;x++){
        if(row[x][0]>=threshold) sortedRow.push(bright[bi++]);
        else sortedRow.push(dark[di++]);
      }
      // Blend sorted with original based on intensity
      const t=intensity/100;
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4;
        data[i]  =lerp(row[x][1],sortedRow[x][1],t)|0;
        data[i+1]=lerp(row[x][2],sortedRow[x][2],t)|0;
        data[i+2]=lerp(row[x][3],sortedRow[x][3],t)|0;
      }
    }
  } else {
    // Sort vertical runs
    for(let x=0;x<w;x++){
      const col=new Array(h);
      for(let y=0;y<h;y++){
        const i=(y*w+x)*4;
        col[y]=[lum(data[i],data[i+1],data[i+2]),data[i],data[i+1],data[i+2]];
      }
      const bright=col.filter(p=>p[0]>=threshold);
      const dark=col.filter(p=>p[0]<threshold);
      bright.sort((a,b)=>a[0]-b[0]);
      let bi=0,di=0;
      const sortedCol=col.map(p=>p[0]>=threshold?bright[bi++]:dark[di++]);
      const t=intensity/100;
      for(let y=0;y<h;y++){
        const i=(y*w+x)*4;
        data[i]  =lerp(col[y][1],sortedCol[y][1],t)|0;
        data[i+1]=lerp(col[y][2],sortedCol[y][2],t)|0;
        data[i+2]=lerp(col[y][3],sortedCol[y][3],t)|0;
      }
    }
  }

  const out = new ImageData(w, h);
  out.data.set(data);
  return out;
}

// ── Pixel Stretch ─────────────────────────────────────────────
function filterPixelStretch(src, w, h, s) {
  const lo      = s.threshold || 60;
  const hi      = s.upper     || 220;
  const maxLen  = s.maxLen    || 60;
  const dir     = s.direction || 0;   // 0=horizontal, 1=vertical
  const density = (s.density  || 50) / 100;

  const data = new Uint8ClampedArray(src.data);

  if (!dir) {
    // ── Horizontal stretch ───────────────────────────────────
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const i = (y * w + x) * 4;
        const l = lum(data[i], data[i + 1], data[i + 2]);

        // Enter a stretch run when pixel luma is in the trigger band
        if (l >= lo && l <= hi && Math.random() < density) {
          // How far this run extends — biased toward long streaks
          const runLen = Math.min(w - x, Math.ceil(Math.random() * maxLen));
          const sR = data[i], sG = data[i + 1], sB = data[i + 2];

          // Stretch: repeat source pixel value across the run,
          // gradually blending back toward the underlying pixel colour
          for (let k = 0; k < runLen; k++) {
            const t  = k / runLen;                   // 0 → 1 across run
            const fade = Math.pow(1 - t, 0.6);        // ease-out tail
            const px  = x + k;
            if (px >= w) break;
            const di  = (y * w + px) * 4;
            const dR  = src.data[di], dG = src.data[di + 1], dB = src.data[di + 2];
            data[di]     = lerp(dR, sR, fade) | 0;
            data[di + 1] = lerp(dG, sG, fade) | 0;
            data[di + 2] = lerp(dB, sB, fade) | 0;
          }
          x += runLen;
        } else {
          x++;
        }
      }
    }
  } else {
    // ── Vertical stretch ─────────────────────────────────────
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h) {
        const i = (y * w + x) * 4;
        const l = lum(data[i], data[i + 1], data[i + 2]);

        if (l >= lo && l <= hi && Math.random() < density) {
          const runLen = Math.min(h - y, Math.ceil(Math.random() * maxLen));
          const sR = data[i], sG = data[i + 1], sB = data[i + 2];

          for (let k = 0; k < runLen; k++) {
            const t    = k / runLen;
            const fade = Math.pow(1 - t, 0.6);
            const py   = y + k;
            if (py >= h) break;
            const di   = (py * w + x) * 4;
            const dR   = src.data[di], dG = src.data[di + 1], dB = src.data[di + 2];
            data[di]     = lerp(dR, sR, fade) | 0;
            data[di + 1] = lerp(dG, sG, fade) | 0;
            data[di + 2] = lerp(dB, sB, fade) | 0;
          }
          y += runLen;
        } else {
          y++;
        }
      }
    }
  }

  const out = new ImageData(w, h);
  out.data.set(data);
  return out;
}

// ── Sticker ───────────────────────────────────────────────────
function filterSticker(src, w, h, s) {
  const tolerance = s.tolerance || 35;
  const borderW   = Math.round(s.borderW   || 8);
  const borderHue = s.borderHue || 0;
  const bgType    = s.bg        || 1;

  // ── Step 1: flood-fill from corners to detect background ──
  const mask = new Uint8Array(w * h); // 0=bg, 1=subject

  // Collect corner colors
  const cornerIdxs = [0, (w-1), (h-1)*w, (h-1)*w+(w-1)];
  let bgR=0,bgG=0,bgB=0;
  for(const ci of cornerIdxs){
    bgR+=src.data[ci*4]; bgG+=src.data[ci*4+1]; bgB+=src.data[ci*4+2];
  }
  bgR/=4; bgG/=4; bgB/=4;

  const colorDiff=(i)=>{
    const r=src.data[i]-bgR, g=src.data[i+1]-bgG, b=src.data[i+2]-bgB;
    return Math.sqrt(r*r+g*g+b*b);
  };

  // BFS flood fill from all edges
  const inBg = new Uint8Array(w * h);
  const queue = [];
  const enq = (x,y)=>{
    const idx=y*w+x;
    if(inBg[idx]) return;
    inBg[idx]=1;
    if(colorDiff(idx*4)<tolerance*2.5) queue.push(idx);
  };
  for(let x=0;x<w;x++){ enq(x,0); enq(x,h-1); }
  for(let y=1;y<h-1;y++){ enq(0,y); enq(w-1,y); }

  let qi=0;
  while(qi<queue.length){
    const idx=queue[qi++];
    const x=idx%w, y=(idx/w)|0;
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=w||ny>=h) continue;
      const ni=ny*w+nx;
      if(inBg[ni]) continue;
      if(colorDiff(ni*4)<tolerance*2.5){ inBg[ni]=1; queue.push(ni); }
    }
  }
  // subject = pixels NOT in bg
  for(let i=0;i<w*h;i++) mask[i]=inBg[i]?0:1;

  // ── Step 2: dilate mask for border ────────────────────────
  const borderMask = borderW > 0 ? new Uint8Array(w * h) : null;
  if(borderMask){
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      if(mask[y*w+x]) continue; // already subject
      // Check if any pixel within borderW is subject
      let found=false;
      for(let dy=-borderW;dy<=borderW&&!found;dy++){
        for(let dx=-borderW;dx<=borderW&&!found;dx++){
          if(dx*dx+dy*dy>borderW*borderW) continue;
          const nx=clamp(x+dx,0,w-1),ny=clamp(y+dy,0,h-1);
          if(mask[ny*w+nx]) found=true;
        }
      }
      if(found) borderMask[y*w+x]=1;
    }
  }

  // ── Step 3: border color from hue ─────────────────────────
  const [bR,bG,bB] = borderW===0 ? [255,255,255] : hslToRgb(borderHue/360, 0.9, borderHue===0?1:0.65);

  // ── Step 4: generate background ───────────────────────────
  const bg = makeStickerBg(w, h, bgType);

  // ── Step 5: composite ─────────────────────────────────────
  const out = new ImageData(w, h);
  const d = out.data;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const idx=(y*w+x)*4;
    const m=mask[y*w+x];
    const bm=borderMask?borderMask[y*w+x]:0;
    if(m){
      d[idx]=src.data[idx]; d[idx+1]=src.data[idx+1];
      d[idx+2]=src.data[idx+2]; d[idx+3]=255;
    } else if(bm){
      d[idx]=bR; d[idx+1]=bG; d[idx+2]=bB; d[idx+3]=255;
    } else {
      d[idx]=bg[idx]; d[idx+1]=bg[idx+1]; d[idx+2]=bg[idx+2]; d[idx+3]=255;
    }
  }
  return out;
}

function hslToRgb(h, s, l) {
  let r,g,b;
  if(s===0){r=g=b=l;}
  else{
    const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
    const hue2rgb=(p,q,t)=>{
      if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;
      return p;
    };
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}

function makeStickerBg(w, h, type) {
  const d = new Uint8Array(w * h * 4);
  // 0=none(checkerboard), 1=cream paper, 2=blueprint, 3=kraft, 4=denim, 5=dot pattern, 6=noise grid

  const TYPES = {
    0: (x,y) => { // Checkerboard (transparent indicator)
      const on=((x/12|0)+(y/12|0))%2;
      const v=on?220:180; return [v,v,v];
    },
    1: (x,y) => { // Cream paper
      const n=valueNoise(x*0.08,y*0.08,111)*30;
      const n2=valueNoise(x*0.4,y*0.4,222)*8;
      return [clamp(248+n2-n*0.3,220,255), clamp(244+n2-n*0.5,210,255), clamp(228+n2-n,190,255)];
    },
    2: (x,y) => { // Blueprint
      const gx=(x%20===0||x%20===19)?1:0;
      const gy=(y%20===0||y%20===19)?1:0;
      const gl=(x%100===0||y%100===0)?1:0;
      const g=gx||gy?0.35:(gl?0.55:0);
      return [clamp(10+g*60,0,80), clamp(28+g*90,0,120), clamp(80+g*120,0,200)];
    },
    3: (x,y) => { // Kraft cardboard
      const n=valueNoise(x*0.15,y*0.05,333)*40;
      const n2=valueNoise(x*0.9,y*0.3,444)*10;
      return [clamp(180+n2-n*0.3,140,210), clamp(130+n2-n*0.5,90,160), clamp(80+n2-n*0.8,50,110)];
    },
    4: (x,y) => { // Denim weave
      const wx=(x*2+y*0.5)%8<4?1:0;
      const wy=(y*2+x*0.5)%8<4?1:0;
      const thread=wx^wy;
      const n=valueNoise(x*0.3,y*0.3,555)*12;
      return [clamp(60+thread*20+n,40,100), clamp(85+thread*25+n,60,130), clamp(130+thread*30+n,100,180)];
    },
    5: (x,y) => { // Dot pattern
      const cx=(x%14)-7, cy=(y%14)-7;
      const dot=Math.sqrt(cx*cx+cy*cy)<3?1:0;
      return dot?[60,60,60]:[245,245,245];
    },
    6: (x,y) => { // Graph paper
      const major=(x%40===0||y%40===0)?1:0;
      const minor=(x%8===0||y%8===0)?1:0;
      if(major) return [180,190,220];
      if(minor) return [210,220,235];
      return [248,250,255];
    },
  };

  const fn = TYPES[clamp(type,0,6)];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const [r,g,b]=fn(x,y);
    const i=(y*w+x)*4;
    d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3]=255;
  }
  return d;
}

// ══════════════════════════════════════════════════════════════
// WIRING
// ══════════════════════════════════════════════════════════════

// Map an id to its filter function (shared by export + batch export).
function applyFilterById(id, src, w, h, s) {
  switch (id) {
    case 'color-halftone':  return filterColorHalftone(src, w, h, s);
    case 'halftone-dot':    return filterHalftoneDot(src, w, h, s);
    case 'halftone-circle': return filterHalftoneCircle(src, w, h, s);
    case 'halftone-line':   return filterHalftoneLine(src, w, h, s);
    case 'graphic-pen':     return filterGraphicPen(src, w, h, s);
    case 'stamp':           return filterStamp(src, w, h, s);
    case 'bitmap':          return filterBitmap(src, w, h, s);
    case 'patchwork':       return filterPatchwork(src, w, h, s);
    case 'mosaic':          return filterMosaic(src, w, h, s);
    case 'row-stretch':     return filterRowStretch(src, w, h, s);
    case 'path-blur':       return filterPathBlur(src, w, h, s);
    case 'ascii':           return filterASCII(src, w, h, s);
    case 'dithering':       return filterDithering(src, w, h, s);
    case 'matrix-rain':     return filterMatrixRain(src, w, h, s);
    case 'dots':            return filterDots(src, w, h, s);
    case 'contour':         return filterContour(src, w, h, s);
    case 'pixel-sort':      return filterPixelSort(src, w, h, s);
    case 'blockify':        return filterBlockify(src, w, h, s);
    case 'threshold':       return filterThreshold(src, w, h, s);
    case 'edge-detect':     return filterEdgeDetect(src, w, h, s);
    case 'crosshatch':      return filterCrosshatch(src, w, h, s);
    case 'wave-lines':      return filterWaveLines(src, w, h, s);
    case 'noise-field':     return filterNoiseField(src, w, h, s);
    case 'voronoi':         return filterVoronoi(src, w, h, s);
    case 'vhs':             return filterVHS(src, w, h, s);
    case 'fractal-haze':    return filterFractalHaze(src, w, h, s);
    case 'pixel-stretch':   return filterPixelStretch(src, w, h, s);
    case 'sticker':         return filterSticker(src, w, h, s);
    default: return null;
  }
}

// Re-render a filter near source resolution. `maxDim` caps the longest edge;
// text filters are always capped because glyph cost scales sharply.
function renderFilterAtSourceRes(id, maxDim) {
  const fw0 = state.src.width, fh0 = state.src.height;
  const isTextFilter = id === 'ascii' || id === 'matrix-rain';
  const cap = isTextFilter ? Math.min(1200, maxDim || Infinity) : (maxDim || Infinity);
  const longest = Math.max(fw0, fh0);
  const scale = longest > cap ? cap / longest : 1;
  const w = Math.max(1, Math.round(fw0 * scale));
  const h = Math.max(1, Math.round(fh0 * scale));
  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext('2d');
  ctx.drawImage(state.src, 0, 0, w, h);
  const result = applyFilterById(id, ctx.getImageData(0, 0, w, h), w, h, state.settings[id]);
  if (!result) return null;
  ctx.putImageData(result, 0, 0);
  return off;
}

function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportFilter(id, opts = {}) {
  if (!id || !state.src) { showToast('Select a filter first.'); return; }
  if (state.src.width * state.src.height > 20000000) {
    showToast('This image is too large for a reliable browser export.');
    setStudioStatus('Export stopped: use an image under 20 megapixels.');
    return;
  }
  try {
    setStudioStatus('Rendering the PNG export...');
    const off = renderFilterAtSourceRes(id);
    if (!off) return;
    const blob = await off.convertToBlob({ type: 'image/png' });
    saveBlob(blob, `cloonk-${id}.png`);
    showToast('PNG downloaded.');
    setStudioStatus('Export complete.');
    if (opts.markCell) {
      const cell = document.querySelector(`.filter-cell[data-id="${id}"]`);
      if (cell) cell.classList.add('downloaded');
    }
  } catch (error) {
    console.error('Darkroom export failed:', error);
    showToast('Could not export this image.');
    setStudioStatus('Export failed. Try a smaller image.');
  }
}

// ── Batch export: every filter into one ZIP (store-only) ──────
function crc32(bytes) {
  let crc = ~0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}
function buildZip(files) {
  const enc = new TextEncoder();
  const u16 = n => [n & 255, (n >> 8) & 255];
  const u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const header = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0),
    ]);
    parts.push(header, nameBytes, f.data);
    central.push({ nameBytes, crc, size, offset });
    offset += header.length + nameBytes.length + size;
  }
  let centralSize = 0;
  for (const c of central) {
    const cd = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(c.crc), ...u32(c.size), ...u32(c.size),
      ...u16(c.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(c.offset),
    ]);
    parts.push(cd, c.nameBytes);
    centralSize += cd.length + c.nameBytes.length;
  }
  parts.push(new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]));
  return new Blob(parts, { type: 'application/zip' });
}

async function downloadAll() {
  if (!state.src) return;
  if (state.src.width * state.src.height > 20000000) {
    showToast('This image is too large to batch-export.');
    return;
  }
  const orig = downloadAllBtn.textContent;
  downloadAllBtn.disabled = true;
  const files = [];
  try {
    for (let i = 0; i < FILTERS.length; i++) {
      const id = FILTERS[i].id;
      downloadAllBtn.textContent = `Exporting ${i + 1}/${FILTERS.length}…`;
      setStudioStatus(`Exporting ${i + 1} of ${FILTERS.length}: ${FILTERS[i].name}…`);
      const off = renderFilterAtSourceRes(id, 1280);
      if (!off) continue;
      const blob = await off.convertToBlob({ type: 'image/png' });
      files.push({ name: `cloonk-${id}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      const cell = document.querySelector(`.filter-cell[data-id="${id}"]`);
      if (cell) cell.classList.add('downloaded');
      await new Promise(r => requestAnimationFrame(r));
    }
    saveBlob(buildZip(files), 'cloonk-darkroom.zip');
    showToast(`${files.length} filters exported.`);
    setStudioStatus(`Exported all ${files.length} filters as a ZIP.`);
  } catch (error) {
    console.error('Darkroom batch export failed:', error);
    showToast('Batch export failed.');
    setStudioStatus('Batch export failed. Try a smaller image.');
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = orig;
  }
}

if (downloadAllBtn) downloadAllBtn.addEventListener('click', downloadAll);
if (settingsDownload) settingsDownload.addEventListener('click', () => exportFilter(state.active, { markCell: true }));

const _closeBtn = document.getElementById('closeSettings');
if (_closeBtn) _closeBtn.addEventListener('click', closeDrawer);
if (settingsScrim) settingsScrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && settingsBox && !settingsBox.hidden) closeDrawer();
});

// ── Filter tooltip ────────────────────────────────────────────
(function() {
  if (window.DARKROOM_CATALOG) return;
  const tip = document.createElement('div');
  tip.id = 'filterTooltip';
  tip.className = 'filter-tooltip';
  document.body.appendChild(tip);

  let hideTimer;

  function showTip(el, id) {
    clearTimeout(hideTimer);
    const f = FILTERS.find(x => x.id === id);
    const desc = FILTER_DESCRIPTIONS[id];
    if (!f || !desc) return;
    tip.classList.remove('visible');
    tip.innerHTML = '<span class="filter-tooltip-name">' + f.name + ' <em>' + f.sub + '</em></span>' + desc;
    positionTip(el); // position while invisible so offsetWidth is correct
    requestAnimationFrame(() => tip.classList.add('visible'));
  }

  function positionTip(el) {
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth || 240;
    let left = r.left;
    if (left + tw > window.innerWidth - 12) left = window.innerWidth - tw - 12;
    if (left < 12) left = 12;
    let top = r.bottom + 8;
    if (top + 120 > window.innerHeight) top = r.top - 8 - (tip.offsetHeight || 80);
    tip.style.left = left + 'px';
    tip.style.top  = top + 'px';
  }

  function hideTip() {
    hideTimer = setTimeout(function() { tip.classList.remove('visible'); }, 80);
  }

  document.addEventListener('mouseover', function(e) {
    const cell = e.target.closest('.filter-cell[data-id]');
    if (cell && cell.dataset.id !== 'original') showTip(cell, cell.dataset.id);
    const item = e.target.closest('.filter-list-item[data-id]');
    if (item) showTip(item, item.dataset.id);
  });
  document.addEventListener('mouseout', function(e) {
    if (e.target.closest('.filter-cell') || e.target.closest('.filter-list-item')) hideTip();
  });
  document.addEventListener('click', function() { tip.classList.remove('visible'); });
  document.addEventListener('scroll', function() { tip.classList.remove('visible'); }, true);
})();

// ── Default source: the 🌱 sprout ─────────────────────────────
// Until the user uploads, the grid previews every filter on a sprout —
// the studio doubles as the live catalog. Upload replaces state.src.
function makeSproutSource(size = 320) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${Math.round(size * 0.72)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌱', size / 2, size / 2);
  return canvas;
}

async function loadDefaultSource() {
  state.src = makeSproutSource();
  state.isDefaultSource = true;
  if (emptyState) emptyState.hidden = true;
  if (grid) grid.hidden = false;
  if (window.refreshSourceLabel) window.refreshSourceLabel('Sample sprout', 0, 0, true);
  await renderAll();
  if (state.isDefaultSource) {
    setStudioStatus('Previewing every filter on 🌱 — drop or tap an image to run them on your own.');
  }
}

// ── Persistence: settings (localStorage) + source image (IndexedDB) ──
const SETTINGS_KEY = 'cloonk-darkroom-settings';
let settingsSaveTimer;
function scheduleSettingsSave() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch (e) {}
  }, 400);
}
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved) return;
    FILTERS.forEach(f => {
      if (!saved[f.id]) return;
      f.params.forEach(p => {
        const v = saved[f.id][p.id];
        if (typeof v === 'number') state.settings[f.id][p.id] = clamp(v, p.min, p.max);
      });
    });
  } catch (e) {}
}

const IDB_NAME = 'cloonk-darkroom', IDB_STORE = 'source';
function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no idb')); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── URL state: ?filter=<id>&<param>=<value> ───────────────────
function writeUrlState() {
  try {
    const params = new URLSearchParams();
    if (state.active) {
      params.set('filter', state.active);
      const s = state.settings[state.active] || {};
      Object.keys(s).forEach(k => params.set(k, s[k]));
    }
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  } catch (e) {}
}
function readUrlState() {
  try {
    const params = new URLSearchParams(location.search);
    const id = params.get('filter') || location.hash.replace('#', '');
    const f = FILTERS.find(x => x.id === id);
    if (!f) return null;
    f.params.forEach(p => {
      if (!params.has(p.id)) return;
      const v = Number(params.get(p.id));
      if (!Number.isNaN(v)) state.settings[id][p.id] = clamp(v, p.min, p.max);
    });
    return id;
  } catch (e) { return null; }
}

// ── Init ──────────────────────────────────────────────────────
// Guard: catalog.html sets window.DARKROOM_CATALOG=true to use filter
// functions without any UI wiring.
async function init() {
  buildGrid();
  loadSettings();
  const pendingId = readUrlState();
  try {
    const blob = await idbGet('image');
    if (blob) await loadSourceBlob(blob, (await idbGet('name')) || 'Saved image', false);
    else await loadDefaultSource();
  } catch (e) {
    await loadDefaultSource();
  }
  if (pendingId) selectFilter(pendingId);
}

if (!window.DARKROOM_CATALOG) { init(); }
