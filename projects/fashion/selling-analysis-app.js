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
    chartType: {},          // { analysisId: chosen chart-type key }  (aesthetic pick)
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

  /* ---- SVG chart helpers — live graphs that mirror the preview vizzes ----- *
   * All charts render into a fixed user-space viewBox and scale to width.
   * Colours come from CSS classes (viz-accent/viz-warn/viz-muted/stroke-*) so
   * they follow the theme.                                                    */
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const trunc = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  // ---- interactive tooltip plumbing: build a ` data-tip="…"` attribute --------
  const SEP = ' • ';
  const escAttr = s => esc(s).replace(/"/g, '&quot;');
  const nfmt = v => typeof v === 'number' ? Math.round(v).toLocaleString() : v;
  const TIP = (...parts) => {
    const t = parts.filter(p => p != null && p !== '').join(SEP);
    return t ? ` data-tip="${escAttr(t)}"` : '';
  };
  // shared hover tooltip — first segment is the bold label, rest are detail lines
  let _tipEl;
  function tipNode() {
    if (!_tipEl) { _tipEl = document.createElement('div'); _tipEl.className = 'chart-tip'; document.body.appendChild(_tipEl); }
    return _tipEl;
  }
  function moveTip(x, y) {
    const t = tipNode(), pad = 14;
    let left = x + pad, top = y + pad;
    if (left + t.offsetWidth > window.innerWidth - 8) left = x - t.offsetWidth - pad;
    if (top + t.offsetHeight > window.innerHeight - 8) top = y - t.offsetHeight - pad;
    t.style.left = Math.max(4, left) + 'px';
    t.style.top = Math.max(4, top) + 'px';
  }
  document.addEventListener('mouseover', e => {
    const m = e.target.closest && e.target.closest('[data-tip]');
    if (!m) return;
    const t = tipNode();
    t.innerHTML = '';
    String(m.getAttribute('data-tip')).split(SEP).forEach((part, i) => {
      const node = document.createElement(i === 0 ? 'strong' : 'span');
      node.textContent = part;
      t.appendChild(node);
    });
    t.classList.add('show');
    moveTip(e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', e => { if (_tipEl && _tipEl.classList.contains('show')) moveTip(e.clientX, e.clientY); });
  document.addEventListener('mouseout', e => {
    const m = e.target.closest && e.target.closest('[data-tip]');
    if (m && _tipEl) _tipEl.classList.remove('show');
  });
  function chart(host, svg, label) {
    const wrap = el('div', { class: 'lens-chart' });
    if (label) wrap.appendChild(el('div', { class: 'lens-chart__cap' }, label));
    const holder = el('div', { class: 'lens-chart__svg' });
    holder.innerHTML = svg;
    wrap.appendChild(holder);
    host.appendChild(wrap);
  }

  /* Chart block with an aesthetic switcher. `builders` = [{ key, label, fn }],
   * where fn() returns an SVG string. The chosen type persists per analysis. */
  function renderChartBlock(host, id, caption, builders) {
    if (!builders || !builders.length) return;
    let sel = state.chartType[id];
    if (!builders.some(b => b.key === sel)) sel = builders[0].key;
    state.chartType[id] = sel;
    const wrap = el('div', { class: 'lens-chart' });
    const head = el('div', { class: 'lens-chart__head' });
    if (caption) head.appendChild(el('div', { class: 'lens-chart__cap' }, caption));
    if (builders.length > 1) {
      const tog = el('div', { class: 'chart-toggle', role: 'tablist' });
      builders.forEach(b => {
        const btn = el('button', {
          type: 'button',
          class: 'chart-toggle__btn' + (b.key === sel ? ' is-active' : ''),
        }, b.label);
        btn.addEventListener('click', () => {
          if (state.chartType[id] === b.key) return;
          state.chartType[id] = b.key;
          const fresh = el('div');
          renderChartBlock(fresh, id, caption, builders);
          wrap.replaceWith(fresh.firstChild);
        });
        tog.appendChild(btn);
      });
      head.appendChild(tog);
    }
    wrap.appendChild(head);
    const holder = el('div', { class: 'lens-chart__svg' });
    holder.innerHTML = (builders.find(b => b.key === sel) || builders[0]).fn();
    wrap.appendChild(holder);
    host.appendChild(wrap);
  }

  // horizontal bars — items: [{label, value, valLabel, color}]
  function svgBarsH(items) {
    const W = 720, rowH = 30, labelW = 190, valW = 96;
    const barX = labelW + 12, barW = W - barX - valW;
    const max = Math.max.apply(null, items.map(i => Math.abs(i.value) || 0).concat([1]));
    const H = Math.max(1, items.length) * rowH + 6;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="13">`;
    items.forEach((it, i) => {
      const y = i * rowH + 6, bh = rowH - 13;
      const w = Math.max(2, (Math.abs(it.value) || 0) / max * barW);
      const cls = it.color || (it.value < 0 ? 'viz-warn' : 'viz-accent');
      const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value));
      s += `<text x="0" y="${y + bh / 2}" dominant-baseline="central" class="lbl-strong">${esc(trunc(it.label, 24))}</text>`;
      s += `<rect x="${barX}" y="${y}" width="${w.toFixed(1)}" height="${bh}" class="${cls}" rx="2"${tip}/>`;
      s += `<text x="${W}" y="${y + bh / 2}" text-anchor="end" dominant-baseline="central">${esc(it.valLabel)}</text>`;
    });
    return s + '</svg>';
  }

  // descending Pareto bars + cumulative line — items sorted desc by value
  function svgPareto(items) {
    const W = 720, H = 250, padT = 12, padB = 70, padX = 6;
    const n = Math.max(1, items.length), plotW = W - padX * 2, plotH = H - padT - padB;
    const max = Math.max.apply(null, items.map(i => i.value || 0).concat([1]));
    const step = plotW / n, bw = step * 0.66;
    const total = items.reduce((a, i) => a + (i.value > 0 ? i.value : 0), 0) || 1;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
    let cum = 0; const pts = [];
    items.forEach((it, i) => {
      const x = padX + i * step + (step - bw) / 2;
      const h = Math.max(1, (it.value || 0) / max * plotH);
      const op = Math.max(0.25, 0.92 - i / n * 0.7).toFixed(2);
      const cumPct = ((cum + (it.value > 0 ? it.value : 0)) / total * 100).toFixed(0);
      const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value), cumPct + '% cumulative');
      s += `<rect x="${x.toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" class="viz-warn" opacity="${op}"${tip}/>`;
      cum += it.value > 0 ? it.value : 0;
      pts.push(`${(padX + i * step + step / 2).toFixed(1)},${(padT + plotH - cum / total * plotH).toFixed(1)}`);
      s += `<text x="${(padX + i * step + step / 2).toFixed(1)}" y="${H - padB + 12}" text-anchor="end" transform="rotate(-42 ${(padX + i * step + step / 2).toFixed(1)} ${H - padB + 12})">${esc(trunc(it.label, 20))}</text>`;
    });
    s += `<polyline points="${pts.join(' ')}" class="stroke-accent" stroke-width="1.5" opacity="0.85"/>`;
    return s + '</svg>';
  }

  // scatter quadrant — points: [{x, y, quad}] ; medians + xmax in same units
  function svgScatter(points, xMed, yMed, xMax) {
    const W = 720, H = 380, pad = 34;
    const plotW = W - pad * 2, plotH = H - pad * 2;
    const xm = xMax || 1;
    const X = u => pad + Math.min(1, (u || 0) / xm) * plotW;
    const Y = st => pad + (1 - Math.max(0, Math.min(1, st || 0))) * plotH;
    const clsFor = q => q === 'Slow-bleeder' ? 'viz-warn' : q === 'Dog' ? 'viz-muted' : 'viz-accent';
    const opFor = q => q === 'Sleeper' ? '0.5' : q === 'Dog' ? '0.5' : '0.9';
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
    s += `<line x1="${X(xMed).toFixed(1)}" y1="${pad}" x2="${X(xMed).toFixed(1)}" y2="${H - pad}" class="axis"/>`;
    s += `<line x1="${pad}" y1="${Y(yMed).toFixed(1)}" x2="${W - pad}" y2="${Y(yMed).toFixed(1)}" class="axis"/>`;
    s += `<text x="${W - pad}" y="${pad + 2}" text-anchor="end" class="lbl-strong">Star</text>`;
    s += `<text x="${pad}" y="${pad + 2}" class="lbl-strong">Sleeper</text>`;
    s += `<text x="${W - pad}" y="${H - pad + 14}" text-anchor="end" class="lbl-strong">Slow-bleeder</text>`;
    s += `<text x="${pad}" y="${H - pad + 14}" class="lbl-strong">Dog</text>`;
    s += `<text x="${pad}" y="${pad - 12}">↑ sell-through</text>`;
    points.forEach(p => {
      const tip = p.tip ? ` data-tip="${escAttr(p.tip)}"` : '';
      s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.4" class="${clsFor(p.quad)}" opacity="${opFor(p.quad)}"${tip}/>`;
    });
    return s + '</svg>';
  }

  // diverging bars around a centre axis — items: [{label, value, valLabel}]
  function svgDiverging(items) {
    const W = 720, rowH = 28, labelW = 150, valW = 92;
    const fieldW = W - (labelW + 12) - valW, cx = labelW + 12 + fieldW / 2, half = fieldW / 2 - 4;
    const max = Math.max.apply(null, items.map(i => Math.abs(i.value) || 0).concat([1]));
    const H = Math.max(1, items.length) * rowH + 6;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
    s += `<line x1="${cx}" y1="2" x2="${cx}" y2="${H - 2}" class="axis"/>`;
    items.forEach((it, i) => {
      const y = i * rowH + 6, bh = rowH - 12;
      const w = (Math.abs(it.value) || 0) / max * half;
      const pos = (it.value || 0) >= 0;
      const x = pos ? cx : cx - w;
      const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value));
      s += `<text x="0" y="${y + bh / 2}" dominant-baseline="central" class="lbl-strong">${esc(trunc(it.label, 22))}</text>`;
      s += `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(1, w).toFixed(1)}" height="${bh}" class="${pos ? 'viz-accent' : 'viz-warn'}" rx="2"${tip}/>`;
      s += `<text x="${W}" y="${y + bh / 2}" text-anchor="end" dominant-baseline="central">${esc(it.valLabel)}</text>`;
    });
    return s + '</svg>';
  }

  // 100% stacked bars (full vs promo) — rows: [{label, promoPct, valLabel}]
  function svgStacked(items) {
    const W = 720, rowH = 30, labelW = 170, valW = 84;
    const barX = labelW + 12, barW = W - barX - valW;
    const H = Math.max(1, items.length) * rowH + 6;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
    items.forEach((it, i) => {
      const y = i * rowH + 6, bh = rowH - 13;
      const pw = Math.max(0, Math.min(1, it.promoPct || 0)) * barW;
      const tip = TIP(it.label, it.valLabel != null ? it.valLabel : '');
      s += `<text x="0" y="${y + bh / 2}" dominant-baseline="central" class="lbl-strong">${esc(trunc(it.label, 20))}</text>`;
      s += `<rect x="${barX}" y="${y}" width="${barW}" height="${bh}" class="viz-muted" opacity="0.4"${tip}/>`;
      s += `<rect x="${(barX + barW - pw).toFixed(1)}" y="${y}" width="${pw.toFixed(1)}" height="${bh}" class="viz-warn"${tip}/>`;
      s += `<text x="${W}" y="${y + bh / 2}" text-anchor="end" dominant-baseline="central">${esc(it.valLabel)}</text>`;
    });
    return s + '</svg>';
  }

  // vertical columns — items: [{label, value, valLabel, color}]
  function svgColumn(items) {
    const W = 720, H = 300, padT = 14, padB = 66, padX = 8;
    const n = Math.max(1, items.length), plotW = W - padX * 2, plotH = H - padT - padB;
    const max = Math.max.apply(null, items.map(i => Math.abs(i.value) || 0).concat([1]));
    const step = plotW / n, bw = Math.min(64, step * 0.64);
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
    s += `<line x1="${padX}" y1="${padT + plotH}" x2="${W - padX}" y2="${padT + plotH}" class="axis"/>`;
    items.forEach((it, i) => {
      const x = padX + i * step + (step - bw) / 2;
      const h = Math.max(1, (Math.abs(it.value) || 0) / max * plotH);
      const cls = it.color || (it.value < 0 ? 'viz-warn' : 'viz-accent');
      const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value));
      s += `<rect x="${x.toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" class="${cls}" rx="2"${tip}/>`;
      s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(padT + plotH - h - 4).toFixed(1)}" text-anchor="middle">${esc(it.valLabel)}</text>`;
      s += `<text x="${(x + bw / 2).toFixed(1)}" y="${padT + plotH + 14}" text-anchor="end" transform="rotate(-40 ${(x + bw / 2).toFixed(1)} ${padT + plotH + 14})">${esc(trunc(it.label, 16))}</text>`;
    });
    return s + '</svg>';
  }

  // pie / donut — items: [{label, value, valLabel, color}]
  function svgPie(items, donut) {
    const W = 720, H = 330, cx = 168, cy = H / 2, r = 132, ri = donut ? 66 : 0;
    const data = items.filter(i => (i.value || 0) > 0);
    const total = data.reduce((a, i) => a + i.value, 0) || 1;
    const palette = ['viz-accent', 'viz-warn', 'viz-muted'];
    const opOf = (it, i) => it.color ? '1' : (i === 0 ? '0.9' : Math.max(0.3, 0.72 - i * 0.12).toFixed(2));
    const arc = (R, a) => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
    if (!data.length) return s + `<text x="${cx}" y="${cy}" text-anchor="middle">no positive values</text></svg>`;
    // single-slice (≈100%) would draw a degenerate arc — render a full disc
    if (data.length === 1 || data[0].value / total >= 0.9999) {
      const only = data[0], cls = only.color || palette[0];
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" class="${cls}" opacity="${only.color ? '1' : '0.9'}"/>`;
      s += `<rect x="336" y="${cy - 6}" width="13" height="13" class="${cls}" opacity="${only.color ? '1' : '0.9'}"/>`;
      s += `<text x="355" y="${cy + 5}" class="lbl-strong">${esc(trunc(only.label, 26))} · 100%</text>`;
      return s + '</svg>';
    }
    let a0 = -Math.PI / 2;
    data.forEach((it, i) => {
      const a1 = a0 + (it.value / total) * 2 * Math.PI;
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const [x0, y0] = arc(r, a0), [x1, y1] = arc(r, a1);
      const cls = it.color || palette[i % palette.length], op = opOf(it, i);
      const tip = TIP(it.label, ((it.value / total) * 100).toFixed(0) + '%', it.valLabel);
      if (donut) {
        const [xi0, yi0] = arc(ri, a0), [xi1, yi1] = arc(ri, a1);
        s += `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L ${xi1.toFixed(1)} ${yi1.toFixed(1)} A ${ri} ${ri} 0 ${large} 0 ${xi0.toFixed(1)} ${yi0.toFixed(1)} Z" class="${cls}" opacity="${op}"${tip}/>`;
      } else {
        s += `<path d="M ${cx} ${cy} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" class="${cls}" opacity="${op}"${tip}/>`;
      }
      a0 = a1;
    });
    let lx = 336, ly = cy - data.length * 11;
    data.forEach((it, i) => {
      const cls = it.color || palette[i % palette.length], op = opOf(it, i);
      const pct = ((it.value / total) * 100).toFixed(0);
      s += `<rect x="${lx}" y="${ly}" width="13" height="13" class="${cls}" opacity="${op}"/>`;
      s += `<text x="${lx + 19}" y="${ly + 11}" class="lbl-strong">${esc(trunc(it.label, 26))} · ${pct}%${it.valLabel ? ' (' + esc(it.valLabel) + ')' : ''}</text>`;
      ly += 23;
    });
    return s + '</svg>';
  }

  // lollipop — horizontal stems with a dot at the value
  function svgLollipop(items) {
    const W = 720, rowH = 28, labelW = 190, valW = 96;
    const barX = labelW + 12, barW = W - barX - valW;
    const max = Math.max.apply(null, items.map(i => Math.abs(i.value) || 0).concat([1]));
    const H = Math.max(1, items.length) * rowH + 6;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="13">`;
    items.forEach((it, i) => {
      const y = i * rowH + rowH / 2;
      const w = Math.max(2, (Math.abs(it.value) || 0) / max * barW);
      const neg = (it.value || 0) < 0;
      const cls = it.color || (neg ? 'viz-warn' : 'viz-accent');
      const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value));
      s += `<text x="0" y="${y}" dominant-baseline="central" class="lbl-strong">${esc(trunc(it.label, 24))}</text>`;
      s += `<line x1="${barX}" y1="${y}" x2="${(barX + w).toFixed(1)}" y2="${y}" class="${neg ? 'stroke-warn' : 'stroke-accent'}" stroke-width="2" opacity="0.5"/>`;
      s += `<circle cx="${(barX + w).toFixed(1)}" cy="${y}" r="5" class="${cls}"${tip}/>`;
      s += `<text x="${W}" y="${y}" text-anchor="end" dominant-baseline="central">${esc(it.valLabel)}</text>`;
    });
    return s + '</svg>';
  }

  // single 100% stacked bar from parts — parts: [{label, value, color}]
  function svgStacked100(parts) {
    const W = 720, barY = 12, barH = 38;
    const total = parts.reduce((a, p) => a + Math.max(0, p.value || 0), 0) || 1;
    const palette = ['viz-muted', 'viz-warn', 'viz-accent'];
    let s = `<svg viewBox="0 0 ${W} 92" preserveAspectRatio="xMinYMin meet" font-size="12">`;
    let x = 0;
    parts.forEach((p, i) => {
      const w = Math.max(0, p.value || 0) / total * W;
      const cls = p.color || palette[i % palette.length];
      const op = p.color ? '1' : (cls === 'viz-muted' ? '0.42' : '1');
      const tip = TIP(p.label, ((Math.max(0, p.value || 0) / total) * 100).toFixed(0) + '%', p.valLabel);
      s += `<rect x="${x.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" class="${cls}" opacity="${op}"${tip}/>`;
      if (w > 44) s += `<text x="${(x + w / 2).toFixed(1)}" y="${barY + barH / 2 + 4}" text-anchor="middle">${((Math.max(0, p.value || 0) / total) * 100).toFixed(0)}%</text>`;
      x += w;
    });
    let lx = 0; const ly = barY + barH + 22;
    parts.forEach((p, i) => {
      const cls = p.color || palette[i % palette.length];
      const op = p.color ? '1' : (cls === 'viz-muted' ? '0.42' : '1');
      s += `<rect x="${lx}" y="${ly - 11}" width="13" height="13" class="${cls}" opacity="${op}"/>`;
      const lab = esc(p.label);
      s += `<text x="${lx + 19}" y="${ly}" class="lbl-strong">${lab}</text>`;
      lx += 56 + lab.length * 7;
    });
    return s + '</svg>';
  }

  // line(s) over ordered x labels — series: [{name, values[], cls, dashed}]
  function svgLine(xLabels, series, opts) {
    opts = opts || {};
    const W = 720, H = 300, padL = 30, padR = 14, padT = 16, padB = 58;
    const plotW = W - padL - padR, plotH = H - padT - padB, n = Math.max(1, xLabels.length);
    let max = 0;
    series.forEach(s => s.values.forEach(v => { if (v != null && v > max) max = v; }));
    max = opts.max != null ? opts.max : (max || 1);
    const X = i => padL + (n <= 1 ? plotW / 2 : i / (n - 1) * plotW);
    const Y = v => padT + plotH - (v / max) * plotH;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
    s += `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="axis"/>`;
    const stepEvery = Math.ceil(n / 16);
    xLabels.forEach((lab, i) => {
      if (i % stepEvery) return;
      const x = X(i);
      s += `<text x="${x.toFixed(1)}" y="${padT + plotH + 14}" text-anchor="end" transform="rotate(-40 ${x.toFixed(1)} ${padT + plotH + 14})">${esc(trunc(lab, 14))}</text>`;
    });
    series.forEach(ser => {
      const cls = ser.cls || 'stroke-accent', vcls = cls.replace('stroke-', 'viz-');
      const pts = ser.values.map((v, i) => v == null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).filter(Boolean);
      if (pts.length) s += `<polyline points="${pts.join(' ')}" class="${cls}" stroke-width="2"${ser.dashed ? ' stroke-dasharray="4 3" opacity="0.85"' : ''}/>`;
      ser.values.forEach((v, i) => { if (v != null) s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" class="${vcls}"${TIP(ser.name + ' · ' + xLabels[i], nfmt(v))}/>`; });
    });
    let lx = padL;
    series.forEach(ser => {
      const vcls = (ser.cls || 'stroke-accent').replace('stroke-', 'viz-');
      s += `<rect x="${lx}" y="2" width="11" height="11" class="${vcls}"/><text x="${lx + 16}" y="11" class="lbl-strong">${esc(ser.name)}</text>`;
      lx += 30 + esc(ser.name).length * 7;
    });
    return s + '</svg>';
  }

  // scatter on arbitrary x/y — points: [{x, y, cls, op, r}] ; opts: axes/medians/trend
  function svgScatterXY(points, opts) {
    opts = opts || {};
    const W = 720, H = 360, pad = 38;
    const plotW = W - pad * 2, plotH = H - pad * 2;
    const xs = points.map(p => p.x).filter(v => v != null), ys = points.map(p => p.y).filter(v => v != null);
    const xMax = opts.xMax != null ? opts.xMax : ((xs.length ? Math.max.apply(null, xs) : 1) || 1);
    const xMin = opts.xMin != null ? opts.xMin : Math.min(0, xs.length ? Math.min.apply(null, xs) : 0);
    const yMax = opts.yMax != null ? opts.yMax : ((ys.length ? Math.max.apply(null, ys) : 1) || 1);
    const yMin = opts.yMin != null ? opts.yMin : Math.min(0, ys.length ? Math.min.apply(null, ys) : 0);
    const X = v => pad + (xMax === xMin ? 0.5 : (v - xMin) / (xMax - xMin)) * plotW;
    const Y = v => pad + plotH - (yMax === yMin ? 0.5 : (v - yMin) / (yMax - yMin)) * plotH;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
    s += `<line x1="${pad}" y1="${pad + plotH}" x2="${W - pad}" y2="${pad + plotH}" class="axis"/>`;
    s += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${pad + plotH}" class="axis"/>`;
    if (opts.xMed != null) s += `<line x1="${X(opts.xMed).toFixed(1)}" y1="${pad}" x2="${X(opts.xMed).toFixed(1)}" y2="${pad + plotH}" class="axis"/>`;
    if (opts.yMed != null) s += `<line x1="${pad}" y1="${Y(opts.yMed).toFixed(1)}" x2="${W - pad}" y2="${Y(opts.yMed).toFixed(1)}" class="axis"/>`;
    if (opts.trend) {
      const y0 = opts.trend.slope * xMin + opts.trend.intercept, y1 = opts.trend.slope * xMax + opts.trend.intercept;
      s += `<line x1="${X(xMin).toFixed(1)}" y1="${Y(y0).toFixed(1)}" x2="${X(xMax).toFixed(1)}" y2="${Y(y1).toFixed(1)}" class="stroke-accent" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>`;
    }
    points.forEach(p => { if (p.x != null && p.y != null) s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.r || 3.2}" class="${p.cls || 'viz-accent'}" opacity="${p.op || '0.85'}"${p.tip ? ` data-tip="${escAttr(p.tip)}"` : ''}/>`; });
    if (opts.xLabel) s += `<text x="${W - pad}" y="${H - 6}" text-anchor="end">${esc(opts.xLabel)} →</text>`;
    if (opts.yLabel) s += `<text x="${pad}" y="${pad - 12}">↑ ${esc(opts.yLabel)}</text>`;
    return s + '</svg>';
  }

  // radar / spider — axes: [labels] ; series: [{name, values[0..1], cls}]
  function svgRadar(axesLabels, series) {
    const W = 720, H = 380, cx = 250, cy = H / 2, R = 150, n = Math.max(1, axesLabels.length);
    const ang = i => -Math.PI / 2 + i / n * 2 * Math.PI;
    const P = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
    [0.25, 0.5, 0.75, 1].forEach(gr => {
      const pts = axesLabels.map((_, i) => { const [x, y] = P(i, R * gr); return `${x.toFixed(1)},${y.toFixed(1)}`; });
      s += `<polygon points="${pts.join(' ')}" class="axis" fill="none"/>`;
    });
    axesLabels.forEach((lab, i) => {
      const [x, y] = P(i, R); s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="axis"/>`;
      const [lx, ly] = P(i, R + 16), c = Math.cos(ang(i));
      s += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle'}" class="lbl-strong">${esc(lab)}</text>`;
    });
    series.forEach(ser => {
      const cls = ser.cls || 'stroke-accent', vcls = cls.replace('stroke-', 'viz-');
      const pts = ser.values.map((v, i) => { const [x, y] = P(i, R * Math.max(0, Math.min(1, v || 0))); return `${x.toFixed(1)},${y.toFixed(1)}`; });
      s += `<polygon points="${pts.join(' ')}" class="${cls}" stroke-width="2" fill="none" opacity="0.9"/>`;
      ser.values.forEach((v, i) => { const [x, y] = P(i, R * Math.max(0, Math.min(1, v || 0))); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="${vcls}"${TIP(ser.name + ' · ' + axesLabels[i], (Math.max(0, Math.min(1, v || 0)) * 100).toFixed(0) + '/100')}/>`; });
    });
    let ly = cy - series.length * 11;
    series.forEach(ser => {
      const vcls = (ser.cls || 'stroke-accent').replace('stroke-', 'viz-');
      s += `<rect x="470" y="${ly}" width="12" height="12" class="${vcls}"/><text x="488" y="${ly + 11}" class="lbl-strong">${esc(trunc(ser.name, 22))}</text>`;
      ly += 22;
    });
    return s + '</svg>';
  }

  // heatmap grid — matrix[row][col] ; empty cells drawn as dashed whitespace
  function svgHeatmap(rowLabels, colLabels, matrix) {
    const W = 720, padL = 132, padT = 72;
    const cell = Math.max(18, Math.min(42, (W - padL) / Math.max(1, colLabels.length)));
    const H = padT + rowLabels.length * cell + 10;
    let max = 0; matrix.forEach(r => r.forEach(v => { if (v > max) max = v; })); max = max || 1;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="10">`;
    colLabels.forEach((c, ci) => {
      const x = padL + ci * cell + cell / 2;
      s += `<text x="${x.toFixed(1)}" y="${padT - 6}" text-anchor="start" transform="rotate(-50 ${x.toFixed(1)} ${padT - 6})" class="lbl-strong">${esc(trunc(c, 16))}</text>`;
    });
    rowLabels.forEach((rl, ri) => {
      const y = padT + ri * cell;
      s += `<text x="${padL - 6}" y="${(y + cell / 2 + 3).toFixed(1)}" text-anchor="end" class="lbl-strong">${esc(trunc(rl, 16))}</text>`;
      colLabels.forEach((c, ci) => {
        const v = matrix[ri][ci] || 0, x = padL + ci * cell;
        const tip = TIP(rl + ' × ' + c, v === 0 ? 'whitespace — sells elsewhere' : nfmt(v) + ' units');
        if (v === 0) s += `<rect x="${x.toFixed(1)}" y="${y}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" class="stroke-warn" stroke-dasharray="2 2" fill="none"${tip}/>`;
        else s += `<rect x="${x.toFixed(1)}" y="${y}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" class="viz-accent" opacity="${(0.2 + 0.8 * v / max).toFixed(2)}"${tip}/>`;
      });
    });
    return s + '</svg>';
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

  /* ---- generic data-driven read (for analyses without a dedicated lens) --- *
   * Builds a real breakdown chart + table from the loaded rows: it groups by
   * the read's most meaningful dimension and aggregates its primary metric.   */
  const NUMERIC = new Set(['msrp', 'buyUnits', 'tyUnits', 'tyRtl', 'tyOH', 'tyST',
                           'lyUnits', 'lyRtl', 'lyOH', 'lyST', 'margin', 'doorCount']);
  // dimensions worth grouping on, best first; id-like fields (upc, transactionId) avoided
  const GROUP_PREF = ['priceRange', 'brand', 'retailer', 'collection', 'door', 'size',
                      'materialCode', 'frameMaterial', 'location', 'newness',
                      'brandCategory', 'theme', 'style', 'week'];
  const VALUE_PREF = ['tyRtl', 'tyUnits', 'tyOH', 'margin', 'lyUnits'];
  const isMoney = f => f === 'tyRtl' || f === 'lyRtl' || f === 'margin';

  function pickGroupField(meta) {
    const scope = new Set(meta.metrics.concat(meta.required));
    for (const f of GROUP_PREF) if (scope.has(f) && A.distinct(state.records, f).length) return f;
    for (const f of meta.metrics.concat(meta.required))
      if (!NUMERIC.has(f) && A.distinct(state.records, f).length) return f;
    return null;
  }
  function pickValueField(meta) {
    const scope = new Set(meta.metrics.concat(meta.required));
    for (const f of VALUE_PREF) if (scope.has(f)) return f;
    for (const f of meta.metrics) if (NUMERIC.has(f)) return f;
    return 'tyUnits';
  }

  function renderGenericRead() {
    const host = $('lens-workbench');
    if (!host) return;
    const meta = selectedMeta();
    if (!meta) return;
    host.innerHTML = '';
    if (!meta.ready) { renderRequirementNotice(host, meta.id); return; }
    host.appendChild(el('p', null, meta.question));
    const rows = state.viewRows || [];
    if (!rows.length) {
      host.appendChild(el('p', { class: 'note' }, 'No rows in view — load a workbook or relax the filters.'));
      return;
    }
    const renderer = GENERIC_RENDERERS[meta.id];
    if (renderer) {
      try { renderer(host, rows, meta); return; }
      catch (err) {
        console.error('Read render failed, using generic breakdown:', err);
        host.innerHTML = ''; host.appendChild(el('p', null, meta.question));
      }
    }
    fallbackBreakdown(host, rows, meta);
  }

  // Generic breakdown — group by the read's main dimension, chart the primary metric
  function fallbackBreakdown(host, rows, meta) {
    const groupField = pickGroupField(meta), valueField = pickValueField(meta);
    if (!groupField) {
      host.appendChild(el('p', { class: 'note' }, 'Not enough dimensional data to chart this read. Layers present:'));
      host.appendChild(table(['Layer', 'Use'], meta.metrics.map(field => [
        A.fieldLabel(field), meta.availableMetrics.includes(field) ? 'Keep' : 'Optional add',
      ])));
      return;
    }
    const g = A.groupBy(rows, r => (r[groupField] == null || r[groupField] === '') ? '—' : r[groupField]);
    const agg = [];
    g.forEach((rs, k) => agg.push({
      key: String(k), val: A.sum(rs, r => r[valueField]), n: rs.length,
      units: A.sum(rs, r => (r.tyUnits != null && r.tyUnits > 0) ? r.tyUnits : 0),
      rtl: A.sum(rs, r => r.tyRtl), oh: A.sum(rs, r => r.tyOH),
    }));
    agg.sort((a, b) => (Math.abs(b.val) || 0) - (Math.abs(a.val) || 0));
    const shown = agg.slice(0, 24), fmtVal = v => isMoney(valueField) ? fmt$(v) : fmtInt(v);
    const gItems = shown.map(a => ({ label: a.key, value: a.val, valLabel: fmtVal(a.val) }));
    renderChartBlock(host, meta.id, `${A.fieldLabel(valueField)} by ${A.fieldLabel(groupField)}`, [
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(gItems) },
      { key: 'column', label: 'Columns', fn: () => svgColumn(gItems) },
      { key: 'pie', label: 'Pie', fn: () => svgPie(gItems, false) },
      { key: 'lollipop', label: 'Lollipop', fn: () => svgLollipop(gItems) },
    ]);
    host.appendChild(table(
      [A.fieldLabel(groupField), 'Rows', 'TY units', 'TY retail $', 'TY on hand'],
      shown.map(a => [a.key, fmtInt(a.n), fmtInt(a.units), fmt$(a.rtl), fmtInt(a.oh)])));
  }

  /* ---- bespoke renderers: engine compute + tailored graph, per read ------ */
  const firstDim = fields => fields.find(f => A.distinct(state.records, f).length);

  function rProductivity(host, rows, meta) {
    const dim = firstDim(['brand', 'materialCode', 'priceRange', 'retailer']) || 'brand';
    const data = A.assortmentProductivity(rows, { groupBy: dim }).slice(0, 20);
    const items = data.map(d => ({ label: d.key, value: d.rtl, valLabel: fmt$(d.rtl) }));
    const perSku = data.slice().sort((a, b) => b.rtlPerSku - a.rtlPerSku).map(d => ({ label: d.key, value: d.rtlPerSku, valLabel: fmt$(d.rtlPerSku) }));
    renderChartBlock(host, meta.id, `Retail $ by ${A.fieldLabel(dim)}`, [
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(items) },
      { key: 'column', label: 'Columns', fn: () => svgColumn(items) },
      { key: 'persku', label: '$/SKU', fn: () => svgBarsH(perSku) },
      { key: 'pie', label: 'Pie', fn: () => svgPie(items, false) },
    ]);
    host.appendChild(table([A.fieldLabel(dim), 'SKUs', 'TY units', 'TY retail $', '$/SKU', 'Cover'],
      data.map(d => [d.key, fmtInt(d.skus), fmtInt(d.units), fmt$(d.rtl), fmt$(d.rtlPerSku), d.cover == null ? '–' : d.cover.toFixed(1)])));
  }

  function rSizeCurve(host, rows, meta) {
    const data = A.sizeCurveAnalysis(rows);
    if (!data.length) return fallbackBreakdown(host, rows, meta);
    const xLabels = data.map(d => d.size);
    const series = [{ name: 'Sell share', values: data.map(d => d.sellShare), cls: 'stroke-accent' }];
    if (data.some(d => d.buyShare != null)) series.push({ name: 'Buy share', values: data.map(d => d.buyShare), cls: 'stroke-muted', dashed: true });
    series.push({ name: 'On-hand share', values: data.map(d => d.ohShare), cls: 'stroke-warn', dashed: true });
    const barItems = data.map(d => ({ label: d.size, value: d.units, valLabel: fmtInt(d.units) }));
    renderChartBlock(host, meta.id, 'Demand by size (share of total)', [
      { key: 'line', label: 'Curve', fn: () => svgLine(xLabels, series, { max: 1 }) },
      { key: 'column', label: 'Columns', fn: () => svgColumn(barItems) },
    ]);
    host.appendChild(table(['Size', 'TY units', 'Sell %', 'Buy %', 'OH %'],
      data.map(d => [d.size, fmtInt(d.units), fmtPct(d.sellShare), d.buyShare == null ? '–' : fmtPct(d.buyShare), fmtPct(d.ohShare)])));
  }

  function rPriceArch(host, rows, meta) {
    const data = A.priceArchitectureAnalysis(rows);
    if (!data.length) return fallbackBreakdown(host, rows, meta);
    const items = data.map(d => ({ label: d.band, value: d.rtl, valLabel: fmt$(d.rtl) }));
    renderChartBlock(host, meta.id, 'Retail $ by price band', [
      { key: 'column', label: 'Columns', fn: () => svgColumn(items) },
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(items) },
      { key: 'pie', label: 'Pie', fn: () => svgPie(items, false) },
    ]);
    host.appendChild(table(['Price band', 'SKUs', 'TY units', 'TY retail $', 'AUR'],
      data.map(d => [d.band, fmtInt(d.skus), fmtInt(d.units), fmt$(d.rtl), d.aur == null ? '–' : fmt$(d.aur)])));
  }

  function rAging(host, rows, meta) {
    const data = A.inventoryAging(rows);
    if (!data.length) return fallbackBreakdown(host, rows, meta);
    const items = data.map(d => ({
      label: d.year, value: d.tiedRetail, valLabel: fmt$(d.tiedRetail),
      color: (d.year !== 'Unknown' && +d.year < state.params.agedYear) ? 'viz-warn' : 'viz-accent',
    }));
    renderChartBlock(host, meta.id, 'Retail $ tied by vintage year', [
      { key: 'column', label: 'Columns', fn: () => svgColumn(items) },
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(items) },
    ]);
    host.appendChild(table(['Vintage', 'SKUs', 'On-hand', 'Tied retail $', 'Dead SKUs'],
      data.map(d => [d.year, fmtInt(d.skus), fmtInt(d.oh), fmt$(d.tiedRetail), fmtInt(d.dead)])));
  }

  function rMarkdown(host, rows, meta) {
    const m = A.markdownSensitivityAnalysis(rows);
    if (!m.n) return fallbackBreakdown(host, rows, meta);
    const pts = m.buckets.filter(b => b.rows > 0).map(b => ({ x: b.depth, y: b.avgUnits, cls: 'viz-accent',
      tip: [(b.depth * 100).toFixed(0) + '% depth', fmtInt(b.avgUnits) + ' avg units', fmtInt(b.rows) + ' rows'].join(' • ') }));
    const items = m.buckets.map(b => ({ label: (b.depth * 100).toFixed(0) + '%', value: b.avgUnits, valLabel: fmtInt(b.avgUnits) }));
    renderChartBlock(host, meta.id, 'Avg units vs discount depth', [
      { key: 'scatter', label: 'Scatter', fn: () => svgScatterXY(pts, { xMin: 0, xMax: 1, trend: m.fit, xLabel: 'discount depth', yLabel: 'avg units' }) },
      { key: 'column', label: 'Columns', fn: () => svgColumn(items) },
    ]);
    host.appendChild(el('p', { class: 'note' }, `Response slope ≈ ${m.fit.slope.toFixed(1)} units per +100% depth across ${fmtInt(m.n)} priced rows.`));
    host.appendChild(table(['Depth band', 'Rows', 'Avg units', 'Avg ST%'],
      m.buckets.map(b => [`${(b.lo * 100).toFixed(0)}–${(b.hi * 100).toFixed(0)}%`, fmtInt(b.rows), fmtInt(b.avgUnits), b.avgST == null ? '–' : fmtPct(b.avgST)])));
  }

  function rForecast(host, rows, meta) {
    const f = A.demandForecast(rows, 8);
    if (!f.series.length) return fallbackBreakdown(host, rows, meta);
    const xLabels = f.series.map(s => s.week).concat(f.proj.map(p => '+' + p.step));
    const actual = f.series.map(s => s.units).concat(f.proj.map(() => null));
    const projected = f.series.map(() => null);
    projected[f.series.length - 1] = f.series[f.series.length - 1].units;
    f.proj.forEach((p, i) => projected[f.series.length + i] = p.units);
    renderChartBlock(host, meta.id, 'Units by week with projection', [
      { key: 'line', label: 'Line', fn: () => svgLine(xLabels, [
        { name: 'Actual', values: actual, cls: 'stroke-muted' },
        { name: 'Projected', values: projected, cls: 'stroke-accent', dashed: true },
      ], {}) },
    ]);
    host.appendChild(el('p', { class: 'note' }, `Trend ≈ ${f.fit.slope >= 0 ? '+' : ''}${f.fit.slope.toFixed(1)} units/week; next ${f.proj.length} weeks ≈ ${fmtInt(A.sum(f.proj, p => p.units))} units.`));
    host.appendChild(table(['Week', 'TY units'], f.series.map(s => [s.week, fmtInt(s.units)])));
  }

  function rAnomaly(host, rows, meta) {
    const a = A.anomalyDetection(rows);
    if (!a.points.length) return fallbackBreakdown(host, rows, meta);
    const pts = a.points.slice(0, 1200).map(p => ({ x: p.units, y: p.st == null ? 0 : p.st, cls: p.outlier ? 'viz-warn' : 'viz-muted', op: p.outlier ? '0.95' : '0.4', r: p.outlier ? 4.5 : 2.6,
      tip: [brandLabel(p.brand) + (p.outlier ? ' ⚠' : ''), fmtInt(p.units) + ' units', 'ST ' + (p.st == null ? '–' : fmtPct(p.st)), 'z ' + p.score.toFixed(1)].join(' • ') }));
    renderChartBlock(host, meta.id, 'Units × sell-through (outliers in yellow)', [
      { key: 'scatter', label: 'Scatter', fn: () => svgScatterXY(pts, { yMin: 0, yMax: 1, xLabel: 'TY units', yLabel: 'sell-through' }) },
    ]);
    host.appendChild(el('h4', null, `Top anomalies (${fmtInt(a.outliers.length)} flagged, z > 2.5)`));
    host.appendChild(table(['Brand', 'Retailer', 'Collection', 'TY units', 'ST%', 'AUR ratio', 'Score'],
      a.outliers.slice(0, 20).map(p => [brandLabel(p.brand), p.retailer, p.collection, fmtInt(p.units), p.st == null ? '–' : fmtPct(p.st), p.aurRatio == null ? '–' : fmtPct(p.aurRatio), p.score.toFixed(1)])));
  }

  function rScorecard(host, rows, meta) {
    const sc = A.retailerScorecard(rows);
    if (!sc.retailers.length) return fallbackBreakdown(host, rows, meta);
    const axes = sc.axes.map(a => a[1]);
    const palette = ['stroke-accent', 'stroke-warn', 'stroke-muted'];
    const series = sc.retailers.slice(0, 3).map((r, i) => ({ name: r.retailer, values: sc.axes.map(a => r.norm[a[0]]), cls: palette[i % palette.length] }));
    renderChartBlock(host, meta.id, 'Retailer profile across 5 axes (normalized)', [
      { key: 'radar', label: 'Radar', fn: () => svgRadar(axes, series) },
      { key: 'bars', label: 'Mix bars', fn: () => svgBarsH(sc.retailers.slice(0, 16).map(r => ({ label: r.retailer, value: r.rtl, valLabel: fmt$(r.rtl) }))) },
    ]);
    host.appendChild(table(['Retailer', 'TY retail $', '$/SKU', 'Full-price %', 'YoY', 'Inv. health'],
      sc.retailers.slice(0, 16).map(r => [r.retailer, fmt$(r.rtl), fmt$(r.rtlPerSku), r.fullPrice == null ? '–' : fmtPct(r.fullPrice), r.growth == null ? '–' : fmtPct(r.growth), r.invHealth == null ? '–' : fmtPct(r.invHealth)])));
  }

  function rLifecycle(host, rows, meta) {
    const data = A.collectionLifecycle(rows);
    if (!data.length) return fallbackBreakdown(host, rows, meta);
    const stageColor = { Launch: 'viz-accent', Growth: 'viz-accent', Mature: 'viz-muted', Decay: 'viz-warn', Exit: 'viz-warn' };
    const pts = data.filter(d => d.age != null).map(d => ({ x: d.age, y: d.st == null ? 0 : d.st, cls: stageColor[d.stage] || 'viz-muted', op: '0.85', r: 3.6,
      tip: [d.collection, d.age + 'y old', 'ST ' + (d.st == null ? '–' : fmtPct(d.st)), d.stage].join(' • ') }));
    const stages = ['Launch', 'Growth', 'Mature', 'Decay', 'Exit'];
    const counts = stages.map(st => { const c = data.filter(d => d.stage === st).length; return { label: st, value: c, valLabel: String(c), color: stageColor[st] }; });
    renderChartBlock(host, meta.id, 'Collections by age × sell-through (coloured by stage)', [
      { key: 'lifecycle', label: 'Lifecycle', fn: () => svgScatterXY(pts, { yMin: 0, yMax: 1, xLabel: 'years since release', yLabel: 'sell-through' }) },
      { key: 'stage', label: 'Stages', fn: () => svgColumn(counts) },
    ]);
    host.appendChild(table(['Collection', 'Age', 'TY units', 'LY units', 'Stage'],
      data.slice(0, 24).map(d => [d.collection, d.age == null ? '–' : d.age, fmtInt(d.units), fmtInt(d.ly), d.stage])));
  }

  function rDoors(host, rows, meta) {
    const dc = A.doorClustering(rows);
    if (!dc.points.length) return fallbackBreakdown(host, rows, meta);
    const cl = { 'High-vol · fast': 'viz-accent', 'Low-vol · fast': 'viz-accent', 'High-vol · slow': 'viz-warn', 'Low-vol · slow': 'viz-muted' };
    const pts = dc.points.map(p => ({ x: p.units, y: p.st == null ? 0 : p.st, cls: cl[p.cluster] || 'viz-muted', op: '0.85', r: 4,
      tip: [p.door, fmtInt(p.units) + ' units', 'ST ' + (p.st == null ? '–' : fmtPct(p.st)), p.cluster].join(' • ') }));
    const names = ['High-vol · fast', 'Low-vol · fast', 'High-vol · slow', 'Low-vol · slow'];
    const counts = names.map(c => { const n = dc.points.filter(p => p.cluster === c).length; return { label: c, value: n, valLabel: String(n), color: cl[c] }; });
    renderChartBlock(host, meta.id, 'Doors by volume × sell-through (coloured by cluster)', [
      { key: 'scatter', label: 'Scatter', fn: () => svgScatterXY(pts, { xMin: 0, yMin: 0, yMax: 1, xMed: dc.unitMed, yMed: dc.stMed, xLabel: 'TY units', yLabel: 'sell-through' }) },
      { key: 'cluster', label: 'Clusters', fn: () => svgColumn(counts) },
    ]);
    host.appendChild(table(['Door', 'TY units', 'Sell-through', 'AUR', 'Cluster'],
      dc.points.slice(0, 24).map(p => [p.door, fmtInt(p.units), p.st == null ? '–' : fmtPct(p.st), p.aur == null ? '–' : fmt$(p.aur), p.cluster])));
  }

  function rBasket(host, rows, meta) {
    const mb = A.marketBasket(rows);
    if (!mb.pairs.length) {
      host.appendChild(el('p', { class: 'note' }, 'No multi-brand baskets found — needs a Transaction/Basket ID with several brands per basket.'));
      return fallbackBreakdown(host, rows, meta);
    }
    const items = mb.pairs.slice(0, 16).map(p => ({ label: p.pair, value: p.count, valLabel: fmtInt(p.count) }));
    renderChartBlock(host, meta.id, `Top brand pairs across ${fmtInt(mb.baskets)} baskets`, [
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(items) },
      { key: 'column', label: 'Columns', fn: () => svgColumn(items) },
    ]);
    host.appendChild(table(['Brand pair', 'Baskets together'], mb.pairs.slice(0, 20).map(p => [p.pair, fmtInt(p.count)])));
  }

  function rCannibal(host, rows, meta) {
    const data = A.cannibalization(rows);
    if (!data.length) {
      host.appendChild(el('p', { class: 'note' }, 'No new-vs-declining overlap detected within similar product groups.'));
      return fallbackBreakdown(host, rows, meta);
    }
    const diverge = data.slice(0, 12).map(d => ({ label: d.group, value: d.net, valLabel: (d.net >= 0 ? '+' : '−') + fmtInt(Math.abs(d.net)) }));
    const loss = data.slice(0, 16).map(d => ({ label: d.group, value: d.oldLoss, valLabel: fmtInt(d.oldLoss), color: 'viz-warn' }));
    renderChartBlock(host, meta.id, 'New gain vs old loss by similar-product group', [
      { key: 'diverging', label: 'Net', fn: () => svgDiverging(diverge) },
      { key: 'loss', label: 'Old loss', fn: () => svgBarsH(loss) },
    ]);
    host.appendChild(table(['Group', 'New gain', 'Old loss', 'Net', 'Risk'],
      data.slice(0, 20).map(d => [d.group, '+' + fmtInt(d.newGain), '−' + fmtInt(d.oldLoss), (d.net >= 0 ? '+' : '−') + fmtInt(Math.abs(d.net)), fmtPct(d.risk)])));
  }

  function rWhitespace(host, rows, meta) {
    const attr = firstDim(['priceRange', 'materialCode', 'frameMaterial', 'brandCategory']) || 'priceRange';
    const ws = A.whitespace(rows, { attr });
    if (!ws.attrs.length || !ws.retailers.length) return fallbackBreakdown(host, rows, meta);
    renderChartBlock(host, meta.id, `${A.fieldLabel(attr)} × Retailer — units (dashed = whitespace)`, [
      { key: 'heatmap', label: 'Heatmap', fn: () => svgHeatmap(ws.attrs, ws.retailers, ws.matrix) },
    ]);
    host.appendChild(el('h4', null, `Top whitespace gaps (${fmtInt(ws.gaps.length)})`));
    host.appendChild(table([A.fieldLabel(attr), 'Retailer', 'Sells elsewhere (units)'],
      ws.gaps.slice(0, 20).map(g => [g.attr, g.retailer, fmtInt(g.rowStrength)])));
  }

  function rReplen(host, rows, meta) {
    const data = A.replenishment(rows).slice(0, 20);
    if (!data.length) return fallbackBreakdown(host, rows, meta);
    const items = data.map(d => ({ label: String(d.sku), value: d.urgency, valLabel: (d.urgency * 100).toFixed(0) }));
    renderChartBlock(host, meta.id, 'Chase-priority score (top SKUs)', [
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(items) },
      { key: 'lollipop', label: 'Lollipop', fn: () => svgLollipop(items) },
    ]);
    host.appendChild(table(['SKU', 'Brand', 'TY units', 'On-hand', 'ST%', 'Cover', 'Score'],
      data.map(d => [String(d.sku), brandLabel(d.brand), fmtInt(d.units), fmtInt(d.oh), d.st == null ? '–' : fmtPct(d.st), d.cover == null ? '–' : d.cover.toFixed(1), (d.urgency * 100).toFixed(0)])));
  }

  function rScenario(host, rows, meta) {
    const sp = A.scenarioPlanner(rows, { markdown: state.params.promoThreshold, replenishPct: 0.20 });
    const unitItems = sp.scenarios.map(s => ({ label: s.name, value: s.units, valLabel: fmtInt(s.units), color: s.name === 'Hold' ? 'viz-muted' : 'viz-accent' }));
    const cashItems = sp.scenarios.map(s => ({ label: s.name, value: s.freedCash, valLabel: fmt$(s.freedCash) }));
    renderChartBlock(host, meta.id, 'Projected outcomes by action', [
      { key: 'units', label: 'Units', fn: () => svgColumn(unitItems) },
      { key: 'cash', label: 'Freed cash', fn: () => svgDiverging(cashItems) },
    ]);
    host.appendChild(table(['Scenario', 'Proj. units', 'Proj. retail $', 'Freed cash'],
      sp.scenarios.map(s => [s.name, fmtInt(s.units), fmt$(s.retail), fmt$(s.freedCash)])));
    host.appendChild(el('p', { class: 'note' }, `Assumes markdown depth ${fmtPct(state.params.promoThreshold)} · ${fmtInt(sp.onHandRows)} on-hand rows · ${fmt$(sp.deadTied)} tied in dead stock.`));
  }

  const GENERIC_RENDERERS = {
    productivity: rProductivity, sizeCurve: rSizeCurve, priceArchitecture: rPriceArch,
    exitPlanner: rAging, markdownSensitivity: rMarkdown, forecasting: rForecast,
    anomalyDetection: rAnomaly, retailerScorecard: rScorecard, collectionLifecycle: rLifecycle,
    doorClustering: rDoors, marketBasket: rBasket, cannibalization: rCannibal,
    whitespace: rWhitespace, replenishment: rReplen, scenarioPlanner: rScenario,
  };

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
    state.viewRows = rows;        // current filtered rows, for the generic read
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
    const flagDefs = [
      ['MSRP missing/zero', fl.msrp_invalid || 0, 'AUR, promo, markdown'],
      ['Negative units', fl.neg_units || 0, 'sales totals, velocity'],
      ['Negative retail $', fl.neg_retail || 0, 'AUR, promo'],
      ['Negative on-hand', fl.neg_oh || 0, 'inventory health'],
      ['ST% out of range', fl.st_out_of_range || 0, 'velocity matrix'],
      ['AUR above MSRP', fl.aur_above_msrp || 0, 'promo penetration'],
    ];
    // live chart: rows per integrity flag (bars / columns / lollipop)
    const flagItems = flagDefs
      .map(r => ({ label: r[0], value: r[1], valLabel: fmtInt(r[1]), color: 'viz-warn' }))
      .sort((a, b) => b.value - a.value);
    renderChartBlock(host, 'integrity', 'Rows flagged, by integrity issue', [
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(flagItems) },
      { key: 'column', label: 'Columns', fn: () => svgColumn(flagItems) },
      { key: 'lollipop', label: 'Lollipop', fn: () => svgLollipop(flagItems) },
    ]);
    const flagRows = flagDefs.map(r => [r[0], fmtInt(r[1]), r[2]]);
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
    const ranked = data.filter(d => d.tiedRetail > 0);
    const labelOf = d => d.group.split(' › ').map((p, i) => i === 0 ? brandLabel(p) : p).join(' › ');
    // live chart: tied retail $ ranked (pareto / bars / columns)
    const liqItems = ranked.slice(0, 16).map(d => ({ label: labelOf(d), value: d.tiedRetail, valLabel: fmt$(d.tiedRetail) }));
    renderChartBlock(host, 'liquidation', 'Retail $ tied in dead stock', [
      { key: 'pareto', label: 'Pareto', fn: () => svgPareto(liqItems) },
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(liqItems) },
      { key: 'column', label: 'Columns', fn: () => svgColumn(liqItems) },
    ]);
    const top = ranked.slice(0, 25).map(d => [
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
    // live chart: ST% (y) vs TY units (x) scatter, split on the medians
    if (v.points.length) {
      const unitsSorted = v.points.map(p => p.units).sort((a, b) => a - b);
      const xMax = unitsSorted[Math.min(unitsSorted.length - 1, Math.floor(unitsSorted.length * 0.95))] || 1;
      const pts = (v.points.length > 1500
        ? v.points.filter((_, i) => i % Math.ceil(v.points.length / 1500) === 0)
        : v.points).map(p => ({ x: p.units, y: p.st, quad: p.quad,
          tip: [brandLabel(p.brand) + (p.retailer ? ' @ ' + p.retailer : ''), fmtInt(p.units) + ' units', 'ST ' + fmtPct(p.st), p.quad].join(' • ') }));
      const quadColor = { Star: 'viz-accent', Sleeper: 'viz-accent', 'Slow-bleeder': 'viz-warn', Dog: 'viz-muted' };
      const quadItems = ['Star', 'Sleeper', 'Slow-bleeder', 'Dog'].map(q =>
        ({ label: q, value: v.counts[q] || 0, valLabel: fmtInt(v.counts[q] || 0), color: quadColor[q] }));
      renderChartBlock(host, 'velocity', 'Sell-through × volume', [
        { key: 'scatter', label: 'Scatter', fn: () => svgScatter(pts, v.volMed, v.stMed, xMax) },
        { key: 'quadrant', label: 'Quadrant', fn: () => svgColumn(quadItems) },
        { key: 'pie', label: 'Pie', fn: () => svgPie(quadItems, true) },
      ]);
    }
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
    // live chart: net YoY unit change per brand, diverging around zero
    const diverge = m.slice()
      .sort((a, b) => Math.abs(b.unitVar) - Math.abs(a.unitVar)).slice(0, 16)
      .map(b => ({
        label: brandLabel(b.brand), value: b.unitVar,
        valLabel: (b.unitVar >= 0 ? '+' : '−') + fmtInt(Math.abs(b.unitVar)),
      }));
    renderChartBlock(host, 'momentum', 'Net YoY unit change by brand (gain ▸ accent · loss ◂ warn)', [
      { key: 'diverging', label: 'Diverging', fn: () => svgDiverging(diverge) },
      { key: 'bars', label: 'Bars', fn: () => svgBarsH(diverge) },
      { key: 'lollipop', label: 'Lollipop', fn: () => svgLollipop(diverge) },
    ]);
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
    // live chart: 100% stacked full-price vs promo, overall then per brand
    const stackItems = [{
      label: 'ALL BRANDS', promoPct: p.overall.promoUnitPct || 0,
      valLabel: fmtPct(p.overall.promoUnitPct) + ' promo',
    }].concat(
      p.groups.filter(g => g.totalUnits > 0)
        .sort((a, b) => (b.promoUnitPct || 0) - (a.promoUnitPct || 0)).slice(0, 14)
        .map(g => ({ label: brandLabel(g.group), promoPct: g.promoUnitPct || 0, valLabel: fmtPct(g.promoUnitPct) })));
    const overallFull = Math.max(0, (p.overall.units || 0) - (p.overall.promoUnits || 0));
    const pieParts = [
      { label: 'Full-price', value: overallFull, valLabel: fmtInt(overallFull), color: 'viz-muted' },
      { label: 'Promo', value: p.overall.promoUnits || 0, valLabel: fmtInt(p.overall.promoUnits || 0), color: 'viz-warn' },
    ];
    const promoBars = stackItems.map(it => ({ label: it.label, value: it.promoPct, valLabel: fmtPct(it.promoPct), color: 'viz-warn' }));
    renderChartBlock(host, 'promo', 'Full-price vs promo unit share', [
      { key: 'stacked', label: 'Stacked', fn: () => svgStacked(stackItems) },
      { key: 'pie', label: 'Pie', fn: () => svgPie(pieParts, true) },
      { key: 'donut100', label: 'Bar', fn: () => svgStacked100(pieParts) },
      { key: 'bars', label: 'Per-brand', fn: () => svgBarsH(promoBars) },
    ]);
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

  /* ---- clear loaded data / start fresh ----------------------------------- *
   * Drops the parsed workbook, filters, and rendered output so a new file can
   * be loaded. Keeps params (promo threshold / aged year) and authored themes
   * as configuration; pass { keepThemes:false } to wipe those too. */
  function clearData(opts) {
    const hadData = state.records.length > 0 || !!state.fileName;
    state.records = [];
    state.enriched = [];
    state.optionalDims = [];
    state.foundFields = [];
    state.filters = {};
    state.fileName = null;
    state.analyses = A.evaluateAnalyses({});
    if (opts && opts.keepThemes === false) state.themes = {};
    // wipe rendered output — emptying #kpis drops the has-data state via observer
    $('kpis').innerHTML = '';
    $('filters').innerHTML = '';
    document.querySelectorAll('.lens').forEach(l => { l.innerHTML = ''; });
    // reset the inputs
    const fileInput = $('file'); if (fileInput) fileInput.value = '';
    const pasteBox = $('pasteBox'); if (pasteBox) pasteBox.value = '';
    const pasteHint = $('pasteHint'); if (pasteHint) pasteHint.textContent = '0 rows detected';
    updateHeaderStats();
    updateProjectStatus();
    renderAnalysisGuide();
    updateTabsAvailability();
    $('status').textContent = 'Load the YTD Sell-Out workbook to begin.';
    return hadData;
  }

  /* expose a small surface for the editorial shell (inline script) */
  window.SOA_APP = Object.assign(window.SOA_APP || {}, { clearData });

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
