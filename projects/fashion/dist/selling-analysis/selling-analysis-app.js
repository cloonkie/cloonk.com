/* ============================================================================
   selling-analysis-app.ts  -  Sell-Through Diagnostic orchestration
   TypeScript source. Builds to dist/selling-analysis/selling-analysis-app.js.
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
        records: [], // canonical parsed rows
        enriched: [], // enriched (recomputed when params/themes change)
        viewRows: [], // current filtered rows
        optionalDims: [], // UPC-grain dims present in the file (if any)
        params: { promoThreshold: 0.20, agedYear: 2020, priceBands: [100, 150, 200, 250, 300], priceBandSource: 'auto' },
        themes: {}, // { collectionRelease: themeString }  (authored)
        filters: {}, // { field: Set(values) }
        fileName: null,
        foundFields: [],
        analyses: A.evaluateAnalyses({}),
        selectedAnalysis: 'integrity',
        chartType: {}, // { analysisId: chosen chart-type key }  (aesthetic pick)
    };
    // dimensions offered as filters (only render those present in data)
    const FILTER_DIMS = [
        ['retailer', 'Retailer'], ['location', 'Location'], ['brand', 'Brand'],
        ['door', 'Door'], ['week', 'Week'], ['size', 'Size'],
        ['brandCategory', 'Brand Category'], ['materialCode', 'Material'],
        ['frameMaterial', 'Frame Material'], ['frameShape', 'Frame Shape'], ['priceRange', 'Price Range'],
        ['newness', 'Newness'], ['theme', 'Theme'],
        ['lensColor', 'Lens Color'], ['frameColor', 'Frame Color'],
        ['templeColor', 'Temple Color'],
    ];
    /* ---- formatting helpers ------------------------------------------------ */
    const $ = (id) => document.getElementById(id);
    const fmtInt = n => n == null ? '–' : Math.round(n).toLocaleString();
    const fmt$ = n => n == null ? '–' : '$' + Math.round(n).toLocaleString();
    const fmtPct = n => n == null ? '–' : (n * 100).toFixed(1) + '%';
    const el = (tag, attrs, html) => {
        const e = document.createElement(tag);
        if (attrs)
            for (const k in attrs)
                e.setAttribute(k, String(attrs[k]));
        if (html != null)
            e.innerHTML = String(html);
        return e;
    };
    const setText = (node, value) => { if (node)
        node.textContent = String(value); };
    function table(headers, rows) {
        const t = el('table');
        const thead = el('thead');
        const htr = el('tr');
        headers.forEach(h => {
            const th = el('th');
            th.textContent = String(h);
            htr.appendChild(th);
        });
        thead.appendChild(htr);
        t.appendChild(thead);
        const tb = el('tbody');
        rows.forEach(r => {
            const tr = el('tr');
            r.forEach(c => {
                const td = el('td');
                td.textContent = String(c);
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
        if (!_tipEl) {
            _tipEl = document.createElement('div');
            _tipEl.className = 'chart-tip';
            document.body.appendChild(_tipEl);
        }
        return _tipEl;
    }
    function moveTip(x, y) {
        const t = tipNode(), pad = 14;
        let left = x + pad, top = y + pad;
        if (left + t.offsetWidth > window.innerWidth - 8)
            left = x - t.offsetWidth - pad;
        if (top + t.offsetHeight > window.innerHeight - 8)
            top = y - t.offsetHeight - pad;
        t.style.left = Math.max(4, left) + 'px';
        t.style.top = Math.max(4, top) + 'px';
    }
    document.addEventListener('mouseover', e => {
        const target = e.target instanceof Element ? e.target : null;
        const m = target?.closest('[data-tip]');
        if (!m)
            return;
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
    document.addEventListener('mousemove', e => { if (_tipEl && _tipEl.classList.contains('show'))
        moveTip(e.clientX, e.clientY); });
    document.addEventListener('mouseout', e => {
        const target = e.target instanceof Element ? e.target : null;
        const m = target?.closest('[data-tip]');
        if (m && _tipEl)
            _tipEl.classList.remove('show');
    });
    function chart(host, svg, label) {
        const wrap = el('div', { class: 'lens-chart' });
        if (label)
            wrap.appendChild(el('div', { class: 'lens-chart__cap' }, label));
        const holder = el('div', { class: 'lens-chart__svg' });
        holder.innerHTML = svg;
        wrap.appendChild(holder);
        host.appendChild(wrap);
    }
    /* ── Categorical palette — a broad colour range for breakdown charts. The
     * classes resolve to theme-aware colours in the stylesheet; PNG export
     * inlines the computed colour before rasterising so exports stay faithful. */
    const PALETTE = ['viz-c1', 'viz-c2', 'viz-c3', 'viz-c4', 'viz-c5', 'viz-c6',
        'viz-c7', 'viz-c8', 'viz-c9', 'viz-c10', 'viz-c11', 'viz-c12'];
    const catClass = i => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
    /* ── Numeric-axis helpers (shared) ─────────────────────────────────────── */
    // compact tick label: 950 · 1.2k · 3.4M · 2B
    const axNum = v => {
        const a = Math.abs(v);
        if (a >= 1e9)
            return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
        if (a >= 1e6)
            return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
        if (a >= 1e3)
            return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
        return String(Math.round(v));
    };
    const axPct = v => (v * 100).toFixed(0) + '%';
    // "nice" ticks from 0 to max over ~count intervals
    function axTicks(max, count) {
        count = count || 4;
        if (!(max > 0))
            return [0];
        const raw = max / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const n = raw / mag, step = (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
        const ticks = [];
        for (let v = 0; v <= max * 1.0001; v += step)
            ticks.push(v);
        return ticks;
    }
    // vertical gridlines + bottom value axis (for horizontal-value charts)
    function axisX(x0, x1, yTop, yBase, max, fmt) {
        fmt = fmt || axNum;
        let s = '';
        axTicks(max).forEach(t => {
            const x = x0 + (max ? t / max : 0) * (x1 - x0);
            s += `<line x1="${x.toFixed(1)}" y1="${yTop}" x2="${x.toFixed(1)}" y2="${yBase}" class="grid"/>`;
            s += `<text x="${x.toFixed(1)}" y="${yBase + 13}" text-anchor="middle" class="axis-lbl">${esc(fmt(t))}</text>`;
        });
        return s + `<line x1="${x0}" y1="${yBase}" x2="${x1}" y2="${yBase}" class="axis"/>`;
    }
    // horizontal gridlines + left value axis (for vertical-value charts)
    function axisY(xAxis, xRight, yTop, yBase, max, fmt) {
        fmt = fmt || axNum;
        let s = '';
        axTicks(max).forEach(t => {
            const y = yBase - (max ? t / max : 0) * (yBase - yTop);
            s += `<line x1="${xAxis}" y1="${y.toFixed(1)}" x2="${xRight}" y2="${y.toFixed(1)}" class="grid"/>`;
            s += `<text x="${(xAxis - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="axis-lbl">${esc(fmt(t))}</text>`;
        });
        return s + `<line x1="${xAxis}" y1="${yTop}" x2="${xAxis}" y2="${yBase}" class="axis"/>`;
    }
    /* ── Screenshot: rasterise a live chart SVG to a theme-accurate PNG ─────── *
     * The chart paints via CSS classes, so we copy each node's computed paint
     * onto a clone, lay a page-coloured background behind it, then draw the
     * serialised SVG into a 2× canvas and hand back a PNG blob.                 */
    const PNG_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
        'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size',
        'font-weight', 'text-anchor', 'dominant-baseline'];
    function chartToPng(svgEl, scale, done) {
        const srcNodes = svgEl.querySelectorAll('*');
        const clone = svgEl.cloneNode(true);
        const clNodes = clone.querySelectorAll('*');
        for (let i = 0; i < srcNodes.length; i++) {
            const cs = getComputedStyle(srcNodes[i]), t = clNodes[i];
            PNG_PROPS.forEach(prop => {
                const v = cs.getPropertyValue(prop);
                if (v && v !== 'normal' && v !== 'auto')
                    t.setAttribute(prop, v);
            });
        }
        const vb = (svgEl.getAttribute('viewBox') || '0 0 720 360').split(/\s+/).map(Number);
        const x0 = vb[0] || 0, y0 = vb[1] || 0, w = vb[2] || 720, h = vb[3] || 360;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', w);
        clone.setAttribute('height', h);
        const bg = getComputedStyle(document.body).backgroundColor || '#0a0a0a';
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x0);
        rect.setAttribute('y', y0);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('fill', bg);
        clone.insertBefore(rect, clone.firstChild);
        const xml = new XMLSerializer().serializeToString(clone);
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
        const s = scale || 2, img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * s);
            canvas.height = Math.round(h * s);
            const ctx = canvas.getContext('2d');
            ctx.scale(s, s);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(b => done(b), 'image/png');
        };
        img.onerror = () => done(null);
        img.src = url;
    }
    function downloadBlob(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }
    const slugify = s => String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'chart';
    const toast = msg => { try {
        if (window.SOA_TOAST)
            window.SOA_TOAST(msg);
    }
    catch (e) { } };
    const CAM_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    /* ── Plain-language interpretation callout ("In plain terms") ──────────── */
    function readout(host, lines, title) {
        const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
        if (!list.length)
            return;
        const box = el('div', { class: 'lens-readout' });
        box.appendChild(el('div', { class: 'lens-readout__tag' }, title || 'In plain terms'));
        const body = el('div', { class: 'lens-readout__body' });
        list.forEach(t => body.appendChild(el('p', null, t)));
        box.appendChild(body);
        host.appendChild(box);
    }
    /* Chart block with an aesthetic switcher. `builders` = [{ key, label, fn }],
     * where fn() returns an SVG string. The chosen type persists per analysis.
     * Every block carries a camera button that exports the live chart as PNG.   */
    function renderChartBlock(host, id, caption, builders) {
        if (!builders || !builders.length)
            return;
        let sel = state.chartType[id];
        if (!builders.some(b => b.key === sel))
            sel = builders[0].key;
        state.chartType[id] = sel;
        const wrap = el('div', { class: 'lens-chart' });
        const head = el('div', { class: 'lens-chart__head' });
        if (caption)
            head.appendChild(el('div', { class: 'lens-chart__cap' }, caption));
        const actions = el('div', { class: 'chart-actions' });
        if (builders.length > 1) {
            const tog = el('div', { class: 'chart-toggle', role: 'tablist' });
            builders.forEach(b => {
                const btn = el('button', {
                    type: 'button',
                    class: 'chart-toggle__btn' + (b.key === sel ? ' is-active' : ''),
                }, b.label);
                btn.addEventListener('click', () => {
                    if (state.chartType[id] === b.key)
                        return;
                    state.chartType[id] = b.key;
                    const fresh = el('div');
                    renderChartBlock(fresh, id, caption, builders);
                    wrap.replaceWith(fresh.firstChild);
                });
                tog.appendChild(btn);
            });
            actions.appendChild(tog);
        }
        // camera → export the currently shown chart as a theme-accurate PNG
        const cam = el('button', { type: 'button', class: 'chart-cam', title: 'Save chart as PNG', 'aria-label': 'Save chart as PNG' });
        cam.innerHTML = CAM_SVG;
        cam.addEventListener('click', () => {
            const svg = wrap.querySelector('.lens-chart__svg svg');
            if (!svg) {
                toast('Nothing to capture yet');
                return;
            }
            cam.classList.add('is-busy');
            chartToPng(svg, 2, blob => {
                cam.classList.remove('is-busy');
                if (!blob) {
                    toast('Could not render image');
                    return;
                }
                const name = slugify((state.fileName ? state.fileName.replace(/\.[^.]+$/, '') + '-' : '') + (caption || id)) + '.png';
                downloadBlob(blob, name);
                toast('Saved ' + name);
            });
        });
        actions.appendChild(cam);
        head.appendChild(actions);
        wrap.appendChild(head);
        const holder = el('div', { class: 'lens-chart__svg' });
        holder.innerHTML = (builders.find(b => b.key === sel) || builders[0]).fn();
        wrap.appendChild(holder);
        host.appendChild(wrap);
    }
    // horizontal bars — items: [{label, value, valLabel, color}] ; opts {cat, fmt}
    function svgBarsH(items, opts) {
        opts = opts || {};
        const W = 720, rowH = 30, labelW = 190, valW = 96, axisH = 20;
        const barX = labelW + 12, barW = W - barX - valW;
        const max = Math.max.apply(null, items.map(i => Math.abs(i.value) || 0).concat([1]));
        const plotH = Math.max(1, items.length) * rowH + 6, H = plotH + axisH;
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="13">`;
        s += axisX(barX, barX + barW, 0, plotH, max, opts.fmt);
        items.forEach((it, i) => {
            const y = i * rowH + 6, bh = rowH - 13;
            const w = Math.max(2, (Math.abs(it.value) || 0) / max * barW);
            const cls = it.color || (opts.cat ? catClass(i) : (it.value < 0 ? 'viz-warn' : 'viz-accent'));
            const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value));
            s += `<text x="0" y="${y + bh / 2}" dominant-baseline="central" class="lbl-strong">${esc(trunc(it.label, 24))}</text>`;
            s += `<rect x="${barX}" y="${y}" width="${w.toFixed(1)}" height="${bh}" class="${cls}" rx="2"${tip}/>`;
            s += `<text x="${W}" y="${y + bh / 2}" text-anchor="end" dominant-baseline="central">${esc(it.valLabel)}</text>`;
        });
        return s + '</svg>';
    }
    // descending Pareto bars + cumulative line — items sorted desc by value
    // left axis = bar value, right axis = cumulative %
    function svgPareto(items, opts) {
        opts = opts || {};
        const W = 720, H = 272, padT = 14, padB = 70, padL = 46, padR = 40;
        const n = Math.max(1, items.length), plotW = W - padL - padR, plotH = H - padT - padB;
        const max = Math.max.apply(null, items.map(i => i.value || 0).concat([1]));
        const step = plotW / n, bw = step * 0.66, yBase = padT + plotH;
        const total = items.reduce((a, i) => a + (i.value > 0 ? i.value : 0), 0) || 1;
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
        s += axisY(padL, W - padR, padT, yBase, max, opts.fmt); // left value axis
        s += `<line x1="${padL}" y1="${yBase}" x2="${W - padR}" y2="${yBase}" class="axis"/>`;
        [0, 0.25, 0.5, 0.75, 1].forEach(f => {
            const y = yBase - f * plotH;
            s += `<text x="${W - padR + 6}" y="${(y + 3).toFixed(1)}" class="axis-lbl">${(f * 100).toFixed(0)}%</text>`;
        });
        s += `<text x="${W - padR + 6}" y="${padT - 3}" class="axis-lbl">cum.</text>`;
        let cum = 0;
        const pts = [];
        items.forEach((it, i) => {
            const x = padL + i * step + (step - bw) / 2;
            const h = Math.max(1, (it.value || 0) / max * plotH);
            const op = Math.max(0.32, 0.95 - i / n * 0.66).toFixed(2);
            const cumPct = ((cum + (it.value > 0 ? it.value : 0)) / total * 100).toFixed(0);
            const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value), cumPct + '% cumulative');
            s += `<rect x="${x.toFixed(1)}" y="${(yBase - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" class="viz-warn" opacity="${op}"${tip}/>`;
            cum += it.value > 0 ? it.value : 0;
            const cx = padL + i * step + step / 2;
            pts.push(`${cx.toFixed(1)},${(yBase - cum / total * plotH).toFixed(1)}`);
            s += `<text x="${cx.toFixed(1)}" y="${yBase + 14}" text-anchor="end" transform="rotate(-42 ${cx.toFixed(1)} ${yBase + 14})">${esc(trunc(it.label, 20))}</text>`;
        });
        s += `<polyline points="${pts.join(' ')}" class="stroke-accent" stroke-width="1.5" opacity="0.9"/>`;
        return s + '</svg>';
    }
    // scatter quadrant — points: [{x, y, quad}] ; medians + xmax in same units
    // x axis = TY units, y axis = sell-through %
    function svgScatter(points, xMed, yMed, xMax) {
        const W = 720, H = 380, padL = 46, padR = 22, padT = 26, padB = 40;
        const plotW = W - padL - padR, plotH = H - padT - padB;
        const xm = xMax || 1, yBase = padT + plotH;
        const X = u => padL + Math.min(1, (u || 0) / xm) * plotW;
        const Y = st => padT + (1 - Math.max(0, Math.min(1, st || 0))) * plotH;
        const clsFor = q => q === 'Slow-bleeder' ? 'viz-warn' : q === 'Dog' ? 'viz-muted' : 'viz-accent';
        const opFor = q => q === 'Sleeper' ? '0.55' : q === 'Dog' ? '0.5' : '0.9';
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
        // value axes: sell-through % up the left, TY units along the bottom
        [0, 0.25, 0.5, 0.75, 1].forEach(f => {
            const y = padT + (1 - f) * plotH;
            s += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" class="grid"/>`;
            s += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="axis-lbl">${(f * 100).toFixed(0)}%</text>`;
        });
        axTicks(xm).forEach(t => s += `<text x="${X(t).toFixed(1)}" y="${yBase + 14}" text-anchor="middle" class="axis-lbl">${esc(axNum(t))}</text>`);
        s += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${yBase}" class="axis"/>`;
        s += `<line x1="${padL}" y1="${yBase}" x2="${padL + plotW}" y2="${yBase}" class="axis"/>`;
        // median split (dashed) — the quadrant boundaries
        s += `<line x1="${X(xMed).toFixed(1)}" y1="${padT}" x2="${X(xMed).toFixed(1)}" y2="${yBase}" class="axis" stroke-dasharray="4 3"/>`;
        s += `<line x1="${padL}" y1="${Y(yMed).toFixed(1)}" x2="${padL + plotW}" y2="${Y(yMed).toFixed(1)}" class="axis" stroke-dasharray="4 3"/>`;
        s += `<text x="${padL + plotW}" y="${padT + 2}" text-anchor="end" class="lbl-strong">Star</text>`;
        s += `<text x="${padL + 4}" y="${padT + 2}" class="lbl-strong">Sleeper</text>`;
        s += `<text x="${padL + plotW}" y="${yBase - 5}" text-anchor="end" class="lbl-strong">Slow-bleeder</text>`;
        s += `<text x="${padL + 4}" y="${yBase - 5}" class="lbl-strong">Dog</text>`;
        s += `<text x="${padL}" y="${padT - 11}" class="axis-lbl">↑ sell-through</text>`;
        s += `<text x="${padL + plotW}" y="${H - 3}" text-anchor="end" class="axis-lbl">TY units →</text>`;
        points.forEach(p => {
            const tip = p.tip ? ` data-tip="${escAttr(p.tip)}"` : '';
            s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.4" class="${clsFor(p.quad)}" opacity="${opFor(p.quad)}"${tip}/>`;
        });
        return s + '</svg>';
    }
    // diverging bars around a centre axis — items: [{label, value, valLabel}]
    function svgDiverging(items, opts) {
        opts = opts || {};
        const W = 720, rowH = 28, labelW = 150, valW = 92, axisH = 20;
        const fieldW = W - (labelW + 12) - valW, cx = labelW + 12 + fieldW / 2, half = fieldW / 2 - 4;
        const max = Math.max.apply(null, items.map(i => Math.abs(i.value) || 0).concat([1]));
        const plotH = Math.max(1, items.length) * rowH + 6, H = plotH + axisH;
        const fmt = opts.fmt || axNum;
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
        // symmetric value axis around the centre (gridlines + |value| ticks)
        const ticks = axTicks(max, 2);
        ticks.slice(1).reverse().map(t => -t).concat(ticks).forEach(t => {
            const x = cx + (t / max) * half;
            s += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${plotH}" class="grid"/>`;
            s += `<text x="${x.toFixed(1)}" y="${plotH + 13}" text-anchor="middle" class="axis-lbl">${esc(fmt(Math.abs(t)))}</text>`;
        });
        s += `<line x1="${cx}" y1="0" x2="${cx}" y2="${plotH}" class="axis"/>`;
        items.forEach((it, i) => {
            const y = i * rowH + 6, bh = rowH - 12;
            const w = (Math.abs(it.value) || 0) / max * half;
            const pos = (it.value || 0) >= 0;
            const x = pos ? cx : cx - w;
            const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value));
            const cls = it.color || (pos ? 'viz-accent' : 'viz-warn'); // per-item colour wins (e.g. mute insignificant)
            s += `<text x="0" y="${y + bh / 2}" dominant-baseline="central" class="lbl-strong">${esc(trunc(it.label, 22))}</text>`;
            s += `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(1, w).toFixed(1)}" height="${bh}" class="${cls}" rx="2"${tip}/>`;
            s += `<text x="${W}" y="${y + bh / 2}" text-anchor="end" dominant-baseline="central">${esc(it.valLabel)}</text>`;
        });
        return s + '</svg>';
    }
    // 100% stacked bars (full vs promo) — rows: [{label, promoPct, valLabel}]
    function svgStacked(items) {
        const W = 720, rowH = 30, labelW = 170, valW = 84, axisH = 20;
        const barX = labelW + 12, barW = W - barX - valW;
        const plotH = Math.max(1, items.length) * rowH + 6, H = plotH + axisH;
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
        // 0–100% axis (gridlines + tick labels) along the bottom
        [0, 0.25, 0.5, 0.75, 1].forEach(f => {
            const x = barX + f * barW;
            s += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${plotH}" class="grid"/>`;
            s += `<text x="${x.toFixed(1)}" y="${plotH + 13}" text-anchor="middle" class="axis-lbl">${(f * 100).toFixed(0)}%</text>`;
        });
        s += `<line x1="${barX}" y1="${plotH}" x2="${barX + barW}" y2="${plotH}" class="axis"/>`;
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
    // vertical columns — items: [{label, value, valLabel, color}] ; opts {cat, fmt}
    function svgColumn(items, opts) {
        opts = opts || {};
        const W = 720, H = 300, padT = 14, padB = 66, padL = 46, padR = 10;
        const n = Math.max(1, items.length), plotW = W - padL - padR, plotH = H - padT - padB;
        const max = Math.max.apply(null, items.map(i => Math.abs(i.value) || 0).concat([1]));
        const step = plotW / n, bw = Math.min(64, step * 0.64), yBase = padT + plotH;
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
        s += axisY(padL, W - padR, padT, yBase, max, opts.fmt);
        items.forEach((it, i) => {
            const x = padL + i * step + (step - bw) / 2;
            const h = Math.max(1, (Math.abs(it.value) || 0) / max * plotH);
            const cls = it.color || (opts.cat ? catClass(i) : (it.value < 0 ? 'viz-warn' : 'viz-accent'));
            const tip = TIP(it.label, it.valLabel != null ? it.valLabel : nfmt(it.value));
            s += `<rect x="${x.toFixed(1)}" y="${(yBase - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" class="${cls}" rx="2"${tip}/>`;
            s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(yBase - h - 4).toFixed(1)}" text-anchor="middle">${esc(it.valLabel)}</text>`;
            s += `<text x="${(x + bw / 2).toFixed(1)}" y="${yBase + 14}" text-anchor="end" transform="rotate(-40 ${(x + bw / 2).toFixed(1)} ${yBase + 14})">${esc(trunc(it.label, 16))}</text>`;
        });
        return s + '</svg>';
    }
    // pie / donut — items: [{label, value, valLabel, color}]
    function svgPie(items, donut) {
        const W = 720, H = 330, cx = 168, cy = H / 2, r = 132, ri = donut ? 66 : 0;
        const data = items.filter(i => (i.value || 0) > 0);
        const total = data.reduce((a, i) => a + i.value, 0) || 1;
        const palette = PALETTE;
        const opOf = (it, i) => '0.92';
        const arc = (R, a) => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
        if (!data.length)
            return s + `<text x="${cx}" y="${cy}" text-anchor="middle">no positive values</text></svg>`;
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
            }
            else {
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
    function svgLollipop(items, opts) {
        opts = opts || {};
        const W = 720, rowH = 28, labelW = 190, valW = 96, axisH = 20;
        const barX = labelW + 12, barW = W - barX - valW;
        const max = Math.max.apply(null, items.map(i => Math.abs(i.value) || 0).concat([1]));
        const plotH = Math.max(1, items.length) * rowH + 6, H = plotH + axisH;
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="13">`;
        s += axisX(barX, barX + barW, 0, plotH, max, opts.fmt);
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
        const palette = PALETTE;
        let s = `<svg viewBox="0 0 ${W} 112" preserveAspectRatio="xMinYMin meet" font-size="12">`;
        let x = 0;
        parts.forEach((p, i) => {
            const w = Math.max(0, p.value || 0) / total * W;
            const cls = p.color || palette[i % palette.length];
            const op = p.color && cls === 'viz-muted' ? '0.42' : (p.color ? '1' : '0.92');
            const tip = TIP(p.label, ((Math.max(0, p.value || 0) / total) * 100).toFixed(0) + '%', p.valLabel);
            s += `<rect x="${x.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" class="${cls}" opacity="${op}"${tip}/>`;
            if (w > 44)
                s += `<text x="${(x + w / 2).toFixed(1)}" y="${barY + barH / 2 + 4}" text-anchor="middle">${((Math.max(0, p.value || 0) / total) * 100).toFixed(0)}%</text>`;
            x += w;
        });
        // 0–100% axis beneath the bar
        [0, 0.25, 0.5, 0.75, 1].forEach(f => {
            const tx = f * W;
            s += `<line x1="${tx.toFixed(1)}" y1="${barY + barH}" x2="${tx.toFixed(1)}" y2="${barY + barH + 5}" class="axis"/>`;
            s += `<text x="${Math.min(W - 10, Math.max(10, tx)).toFixed(1)}" y="${barY + barH + 16}" text-anchor="middle" class="axis-lbl">${(f * 100).toFixed(0)}%</text>`;
        });
        let lx = 0;
        const ly = barY + barH + 40;
        parts.forEach((p, i) => {
            const cls = p.color || palette[i % palette.length];
            const op = p.color && cls === 'viz-muted' ? '0.42' : (p.color ? '1' : '0.92');
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
        series.forEach(s => s.values.forEach(v => { if (v != null && v > max)
            max = v; }));
        max = opts.max != null ? opts.max : (max || 1);
        const X = i => padL + (n <= 1 ? plotW / 2 : i / (n - 1) * plotW);
        const Y = v => padT + plotH - (v / max) * plotH;
        const yFmt = opts.fmt || (opts.max === 1 ? axPct : axNum);
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
        s += axisY(padL, W - padR, padT, padT + plotH, max, yFmt);
        s += `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="axis"/>`;
        const stepEvery = Math.ceil(n / 16);
        xLabels.forEach((lab, i) => {
            if (i % stepEvery)
                return;
            const x = X(i);
            s += `<text x="${x.toFixed(1)}" y="${padT + plotH + 14}" text-anchor="end" transform="rotate(-40 ${x.toFixed(1)} ${padT + plotH + 14})">${esc(trunc(lab, 14))}</text>`;
        });
        series.forEach(ser => {
            const cls = ser.cls || 'stroke-accent', vcls = cls.replace('stroke-', 'viz-');
            const pts = ser.values.map((v, i) => v == null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).filter(Boolean);
            if (pts.length)
                s += `<polyline points="${pts.join(' ')}" class="${cls}" stroke-width="2"${ser.dashed ? ' stroke-dasharray="4 3" opacity="0.85"' : ''}/>`;
            ser.values.forEach((v, i) => { if (v != null)
                s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" class="${vcls}"${TIP(ser.name + ' · ' + xLabels[i], nfmt(v))}/>`; });
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
        const xFmt = opts.xFmt || (xMax <= 1 && xMin >= 0 ? axPct : axNum);
        const yFmt = opts.yFmt || (yMax <= 1 && yMin >= 0 ? axPct : axNum);
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
        // numeric gridlines + ticks on both axes
        axTicks(xMax).forEach(t => {
            if (t < xMin)
                return;
            const x = X(t);
            s += `<line x1="${x.toFixed(1)}" y1="${pad}" x2="${x.toFixed(1)}" y2="${pad + plotH}" class="grid"/>`;
            s += `<text x="${x.toFixed(1)}" y="${pad + plotH + 13}" text-anchor="middle" class="axis-lbl">${esc(xFmt(t))}</text>`;
        });
        axTicks(yMax).forEach(t => {
            if (t < yMin)
                return;
            const y = Y(t);
            s += `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${W - pad}" y2="${y.toFixed(1)}" class="grid"/>`;
            s += `<text x="${pad - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="axis-lbl">${esc(yFmt(t))}</text>`;
        });
        s += `<line x1="${pad}" y1="${pad + plotH}" x2="${W - pad}" y2="${pad + plotH}" class="axis"/>`;
        s += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${pad + plotH}" class="axis"/>`;
        if (opts.xMed != null)
            s += `<line x1="${X(opts.xMed).toFixed(1)}" y1="${pad}" x2="${X(opts.xMed).toFixed(1)}" y2="${pad + plotH}" class="axis" stroke-dasharray="4 3"/>`;
        if (opts.yMed != null)
            s += `<line x1="${pad}" y1="${Y(opts.yMed).toFixed(1)}" x2="${W - pad}" y2="${Y(opts.yMed).toFixed(1)}" class="axis" stroke-dasharray="4 3"/>`;
        if (opts.trend) {
            const y0 = opts.trend.slope * xMin + opts.trend.intercept, y1 = opts.trend.slope * xMax + opts.trend.intercept;
            s += `<line x1="${X(xMin).toFixed(1)}" y1="${Y(y0).toFixed(1)}" x2="${X(xMax).toFixed(1)}" y2="${Y(y1).toFixed(1)}" class="stroke-accent" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>`;
        }
        points.forEach(p => { if (p.x != null && p.y != null)
            s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.r || 3.2}" class="${p.cls || 'viz-accent'}" opacity="${p.op || '0.85'}"${p.tip ? ` data-tip="${escAttr(p.tip)}"` : ''}/>`; });
        if (opts.xLabel)
            s += `<text x="${W - pad}" y="${H - 6}" text-anchor="end">${esc(opts.xLabel)} →</text>`;
        if (opts.yLabel)
            s += `<text x="${pad}" y="${pad - 12}">↑ ${esc(opts.yLabel)}</text>`;
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
            // ring scale label up the top spoke (0–100 normalized)
            s += `<text x="${(cx + 4).toFixed(1)}" y="${(cy - R * gr + 3).toFixed(1)}" class="axis-lbl">${(gr * 100).toFixed(0)}</text>`;
        });
        axesLabels.forEach((lab, i) => {
            const [x, y] = P(i, R);
            s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="axis"/>`;
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
        const gridB = padT + rowLabels.length * cell;
        const H = gridB + 34;
        let max = 0;
        matrix.forEach(r => r.forEach(v => { if (v > max)
            max = v; }));
        max = max || 1;
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
                if (v === 0)
                    s += `<rect x="${x.toFixed(1)}" y="${y}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" class="stroke-warn" stroke-dasharray="2 2" fill="none"${tip}/>`;
                else
                    s += `<rect x="${x.toFixed(1)}" y="${y}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" class="viz-accent" opacity="${(0.2 + 0.8 * v / max).toFixed(2)}"${tip}/>`;
            });
        });
        // legend: intensity scale (units sold) + the dashed-whitespace key
        const ly = gridB + 18;
        s += `<text x="${padL}" y="${ly + 9}" text-anchor="end" class="axis-lbl">fewer</text>`;
        [0.2, 0.4, 0.6, 0.8, 1].forEach((o, k) => s += `<rect x="${padL + 6 + k * 16}" y="${ly}" width="14" height="12" class="viz-accent" opacity="${o}"/>`);
        s += `<text x="${padL + 6 + 5 * 16 + 6}" y="${ly + 9}" class="axis-lbl">more units (max ${esc(nfmt(max))})</text>`;
        s += `<rect x="${padL + 6 + 5 * 16 + 150}" y="${ly}" width="12" height="12" class="stroke-warn" stroke-dasharray="2 2" fill="none"/>`;
        s += `<text x="${padL + 6 + 5 * 16 + 168}" y="${ly + 9}" class="axis-lbl">whitespace (sells elsewhere)</text>`;
        return s + '</svg>';
    }
    /* ── Force-directed layout (Fruchterman–Reingold) ──────────────────────── *
     * Deterministic: nodes seed on a circle by index, no randomness, so the same
     * data always lays out identically (stable re-renders + faithful PNG export).
     * Returns {x,y} per node in a [0..W]×[0..H] box.                            */
    function forceLayout(nodes, links, opts) {
        opts = opts || {};
        const W = opts.W || 1, H = opts.H || 1, iters = opts.iters || 300, n = nodes.length;
        const idx = {};
        nodes.forEach((nd, i) => { idx[nd.id] = i; });
        const pos = nodes.map((nd, i) => {
            const a = (i / Math.max(1, n)) * 2 * Math.PI;
            return { x: W / 2 + Math.cos(a) * W * 0.34, y: H / 2 + Math.sin(a) * H * 0.34 };
        });
        const k = opts.k || Math.sqrt((W * H) / Math.max(1, n)) * 0.85; // ideal edge length
        const maxV = Math.max.apply(null, links.map(l => l.value || 1).concat([1]));
        let temp = W * 0.12;
        const cool = temp / (iters + 1);
        for (let it = 0; it < iters; it++) {
            const disp = pos.map(() => ({ x: 0, y: 0 }));
            for (let i = 0; i < n; i++) { // repulsion (every pair)
                for (let j = i + 1; j < n; j++) {
                    let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
                    let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
                    const rep = (k * k) / d, ux = dx / d, uy = dy / d;
                    disp[i].x += ux * rep;
                    disp[i].y += uy * rep;
                    disp[j].x -= ux * rep;
                    disp[j].y -= uy * rep;
                }
            }
            links.forEach(l => {
                const a = idx[l.source], b = idx[l.target];
                if (a == null || b == null)
                    return;
                let dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y;
                let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const w = 0.35 + 0.65 * ((l.value || 1) / maxV);
                const att = (d * d) / k * w, ux = dx / d, uy = dy / d;
                disp[a].x -= ux * att;
                disp[a].y -= uy * att;
                disp[b].x += ux * att;
                disp[b].y += uy * att;
            });
            for (let i = 0; i < n; i++) { // gentle gravity keeps stragglers in frame
                disp[i].x += (W / 2 - pos[i].x) * 0.02;
                disp[i].y += (H / 2 - pos[i].y) * 0.02;
                let d = Math.sqrt(disp[i].x * disp[i].x + disp[i].y * disp[i].y) || 0.01;
                const lim = Math.min(d, temp);
                pos[i].x = Math.max(0, Math.min(W, pos[i].x + disp[i].x / d * lim));
                pos[i].y = Math.max(0, Math.min(H, pos[i].y + disp[i].y / d * lim));
            }
            temp -= cool;
        }
        return pos;
    }
    // affinity network — nodes: [{id,label,weight}] ; links: [{source,target,value,lift}]
    function svgNetwork(nodes, links) {
        const W = 720, H = 430, pad = 56;
        if (!nodes.length)
            return `<svg viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="axis-lbl">no network</text></svg>`;
        const iw = W - pad * 2, ih = H - pad * 2;
        const pos = forceLayout(nodes, links, { W: iw, H: ih, iters: 340, k: Math.sqrt(iw * ih / Math.max(1, nodes.length)) * 0.7 });
        // fit the laid-out cloud into the plot box, preserving aspect
        const xs = pos.map(p => p.x), ys = pos.map(p => p.y);
        const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
        const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
        const sc = Math.min((maxX - minX) ? iw / (maxX - minX) : 1, (maxY - minY) ? ih / (maxY - minY) : 1);
        const ox = pad + (iw - (maxX - minX) * sc) / 2, oy = pad + (ih - (maxY - minY) * sc) / 2;
        const PX = i => ox + (pos[i].x - minX) * sc, PY = i => oy + (pos[i].y - minY) * sc;
        const idx = {};
        nodes.forEach((nd, i) => { idx[nd.id] = i; });
        const maxW = Math.max.apply(null, nodes.map(nd => nd.weight || 1).concat([1]));
        const maxV = Math.max.apply(null, links.map(l => l.value || 1).concat([1]));
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="11">`;
        links.forEach(l => {
            const a = idx[l.source], b = idx[l.target];
            if (a == null || b == null)
                return;
            const f = (l.value || 1) / maxV;
            const tip = TIP(l.source + ' + ' + l.target, nfmt(l.value) + ' baskets together', l.lift != null ? 'lift ' + l.lift.toFixed(2) + '×' : null);
            s += `<line x1="${PX(a).toFixed(1)}" y1="${PY(a).toFixed(1)}" x2="${PX(b).toFixed(1)}" y2="${PY(b).toFixed(1)}" class="stroke-accent" stroke-width="${(1 + 5 * f).toFixed(1)}" stroke-linecap="round" opacity="${(0.22 + 0.55 * f).toFixed(2)}"${tip}/>`;
        });
        nodes.forEach((nd, i) => {
            const r = 5 + 17 * Math.sqrt((nd.weight || 1) / maxW);
            const tip = TIP(nd.label || nd.id, nfmt(nd.weight) + ' baskets');
            s += `<circle cx="${PX(i).toFixed(1)}" cy="${PY(i).toFixed(1)}" r="${r.toFixed(1)}" class="${catClass(i)}" opacity="0.92"${tip}/>`;
            s += `<text x="${PX(i).toFixed(1)}" y="${(PY(i) + r + 12).toFixed(1)}" text-anchor="middle" class="lbl-strong">${esc(trunc(nd.label || nd.id, 16))}</text>`;
        });
        return s + '</svg>';
    }
    // decision tree — root: {label,sub} ; branches: [{name,lines[],fill,stroke,tip}]
    function svgTree(root, branches) {
        const W = 720, rowH = 92, padT = 18, padB = 18;
        const n = Math.max(1, branches.length), H = padT + padB + n * rowH;
        const rootX = 150, rootCY = H / 2, rootW = 188, rootH = 64;
        const leafX = 392, leafW = W - leafX - 16, leafH = rowH - 22;
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" font-size="12">`;
        branches.forEach((b, i) => {
            const ly = padT + i * rowH + rowH / 2, midX = (rootX + rootW / 2 + leafX) / 2;
            s += `<path d="M ${rootX + rootW / 2} ${rootCY} C ${midX} ${rootCY}, ${midX} ${ly}, ${leafX} ${ly}" class="${b.stroke || 'stroke-muted'}" stroke-width="2" fill="none" opacity="0.55"/>`;
        });
        // root ("Today")
        s += `<rect x="${rootX - rootW / 2}" y="${rootCY - rootH / 2}" width="${rootW}" height="${rootH}" rx="9" class="viz-accent" opacity="0.14"/>`;
        s += `<rect x="${rootX - rootW / 2}" y="${rootCY - rootH / 2}" width="${rootW}" height="${rootH}" rx="9" class="stroke-accent" stroke-width="1.5" fill="none"/>`;
        s += `<text x="${rootX}" y="${rootCY - 6}" text-anchor="middle" class="lbl-strong" font-size="15">${esc(root.label)}</text>`;
        if (root.sub)
            s += `<text x="${rootX}" y="${rootCY + 14}" text-anchor="middle" class="axis-lbl">${esc(root.sub)}</text>`;
        branches.forEach((b, i) => {
            const ly = padT + i * rowH + (rowH - leafH) / 2, fill = b.fill || 'viz-muted';
            const tip = b.tip ? ` data-tip="${escAttr(b.tip)}"` : '';
            s += `<rect x="${leafX}" y="${ly}" width="${leafW}" height="${leafH}" rx="9" class="${fill}" opacity="0.13"${tip}/>`;
            s += `<rect x="${leafX}" y="${ly}" width="${leafW}" height="${leafH}" rx="9" class="${b.stroke || 'stroke-muted'}" stroke-width="1.5" fill="none"/>`;
            s += `<rect x="${leafX}" y="${ly}" width="6" height="${leafH}" rx="3" class="${fill}"/>`;
            s += `<text x="${leafX + 18}" y="${ly + 23}" class="lbl-strong" font-size="13">${esc(b.name)}</text>`;
            (b.lines || []).forEach((ln, k) => s += `<text x="${leafX + 18}" y="${ly + 42 + k * 16}" class="axis-lbl">${esc(ln)}</text>`);
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
        if (!state.analyses.some(a => a.id === id))
            return;
        state.selectedAnalysis = id;
        const select = $('projectSelect');
        if (select)
            select.value = id;
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
            if (!specificLens)
                renderGenericRead();
        }
        updateProjectStatus();
        updateTabsAvailability();
        if (!opts || opts.renderGuide !== false)
            renderAnalysisGuide();
    }
    function updateProjectStatus() {
        const host = $('projectStatus');
        if (!host)
            return;
        const meta = selectedMeta();
        if (!meta)
            return;
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
        if (!select)
            return;
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
        if (!host)
            return;
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
        if (!meta || meta.ready)
            return false;
        host.innerHTML = '';
        host.appendChild(el('div', { class: 'layer-needed' }, 'Layer needed'));
        host.appendChild(el('h4', null, `${meta.name} needs another data layer`));
        host.appendChild(el('p', null, meta.question));
        host.appendChild(el('p', { class: 'note' }, `Add ${meta.missing.map(A.fieldLabel).join(', ')} or remove this read from scope.`));
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
        for (const f of GROUP_PREF)
            if (scope.has(f) && A.distinct(state.records, f).length)
                return f;
        for (const f of meta.metrics.concat(meta.required))
            if (!NUMERIC.has(f) && A.distinct(state.records, f).length)
                return f;
        return null;
    }
    function pickValueField(meta) {
        const scope = new Set(meta.metrics.concat(meta.required));
        for (const f of VALUE_PREF)
            if (scope.has(f))
                return f;
        for (const f of meta.metrics)
            if (NUMERIC.has(f))
                return f;
        return 'tyUnits';
    }
    function renderGenericRead() {
        const host = $('lens-workbench');
        if (!host)
            return;
        const meta = selectedMeta();
        if (!meta)
            return;
        host.innerHTML = '';
        if (!meta.ready) {
            renderRequirementNotice(host, meta.id);
            return;
        }
        host.appendChild(el('p', null, meta.question));
        const rows = state.viewRows || [];
        if (!rows.length) {
            host.appendChild(el('p', { class: 'note' }, 'No rows in view — load a workbook or relax the filters.'));
            return;
        }
        const renderer = GENERIC_RENDERERS[meta.id];
        if (renderer) {
            try {
                renderer(host, rows, meta);
                return;
            }
            catch (err) {
                console.error('Read render failed, using generic breakdown:', err);
                host.innerHTML = '';
                host.appendChild(el('p', null, meta.question));
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
        const axFmt = isMoney(valueField) ? (v => '$' + axNum(v)) : axNum;
        renderChartBlock(host, meta.id, `${A.fieldLabel(valueField)} by ${A.fieldLabel(groupField)}`, [
            { key: 'bars', label: 'Bars', fn: () => svgBarsH(gItems, { cat: true, fmt: axFmt }) },
            { key: 'column', label: 'Columns', fn: () => svgColumn(gItems, { cat: true, fmt: axFmt }) },
            { key: 'pie', label: 'Pie', fn: () => svgPie(gItems, false) },
            { key: 'lollipop', label: 'Lollipop', fn: () => svgLollipop(gItems, { fmt: axFmt }) },
        ]);
        const topG = shown[0];
        readout(host, [
            `This groups every row by ${A.fieldLabel(groupField).toLowerCase()} and totals ${A.fieldLabel(valueField).toLowerCase()}. `
                + (topG ? `${topG.key} leads with ${fmtVal(topG.val)}. ` : '')
                + `The longest bars are where this metric concentrates — usually the first place to look.`,
        ]);
        host.appendChild(table([A.fieldLabel(groupField), 'Rows', 'TY units', 'TY retail $', 'TY on hand'], shown.map(a => [a.key, fmtInt(a.n), fmtInt(a.units), fmt$(a.rtl), fmtInt(a.oh)])));
    }
    /* ---- bespoke renderers: engine compute + tailored graph, per read ------ */
    const firstDim = fields => fields.find(f => A.distinct(state.records, f).length);
    function rProductivity(host, rows, meta) {
        const dim = firstDim(['brand', 'materialCode', 'priceRange', 'retailer']) || 'brand';
        const data = A.assortmentProductivity(rows, { groupBy: dim }).slice(0, 20);
        const items = data.map(d => ({ label: d.key, value: d.rtl, valLabel: fmt$(d.rtl) }));
        const perSku = data.slice().sort((a, b) => b.rtlPerSku - a.rtlPerSku).map(d => ({ label: d.key, value: d.rtlPerSku, valLabel: fmt$(d.rtlPerSku) }));
        const m$ = v => '$' + axNum(v);
        renderChartBlock(host, meta.id, `Retail $ by ${A.fieldLabel(dim)}`, [
            { key: 'bars', label: 'Bars', fn: () => svgBarsH(items, { cat: true, fmt: m$ }) },
            { key: 'column', label: 'Columns', fn: () => svgColumn(items, { cat: true, fmt: m$ }) },
            { key: 'persku', label: '$/SKU', fn: () => svgBarsH(perSku, { cat: true, fmt: m$ }) },
            { key: 'pie', label: 'Pie', fn: () => svgPie(items, false) },
        ]);
        host.appendChild(table([A.fieldLabel(dim), 'SKUs', 'TY units', 'TY retail $', '$/SKU', 'Cover'], data.map(d => [d.key, fmtInt(d.skus), fmtInt(d.units), fmt$(d.rtl), fmt$(d.rtlPerSku), d.cover == null ? '–' : d.cover.toFixed(1)])));
    }
    function rSizeCurve(host, rows, meta) {
        const data = A.sizeCurveAnalysis(rows);
        if (!data.length)
            return fallbackBreakdown(host, rows, meta);
        const xLabels = data.map(d => d.size);
        const series = [
            { name: 'Sell share', values: data.map(d => d.sellShare), cls: 'stroke-accent' },
        ];
        if (data.some(d => d.buyShare != null))
            series.push({ name: 'Buy share', values: data.map(d => d.buyShare), cls: 'stroke-muted', dashed: true });
        series.push({ name: 'On-hand share', values: data.map(d => d.ohShare), cls: 'stroke-warn', dashed: true });
        const barItems = data.map(d => ({ label: d.size, value: d.units, valLabel: fmtInt(d.units) }));
        renderChartBlock(host, meta.id, 'Demand by size (share of total)', [
            { key: 'line', label: 'Curve', fn: () => svgLine(xLabels, series, { max: 1 }) },
            { key: 'column', label: 'Columns', fn: () => svgColumn(barItems) },
        ]);
        host.appendChild(table(['Size', 'TY units', 'Sell %', 'Buy %', 'OH %'], data.map(d => [d.size, fmtInt(d.units), fmtPct(d.sellShare), d.buyShare == null ? '–' : fmtPct(d.buyShare), fmtPct(d.ohShare)])));
    }
    function rPriceArch(host, rows, meta) {
        const data = A.priceArchitectureAnalysis(rows);
        if (!data.length)
            return fallbackBreakdown(host, rows, meta);
        const items = data.map(d => ({ label: d.band, value: d.rtl, valLabel: fmt$(d.rtl) }));
        const m$ = v => '$' + axNum(v);
        const topBand = data.slice().sort((a, b) => b.rtl - a.rtl)[0], totalRtl = A.sum(data, d => d.rtl);
        readout(host, [
            `This shows where your sales dollars sit across price tiers. `
                + (topBand ? `The ${topBand.band} band does the heaviest lifting — ${fmt$(topBand.rtl)} of ${fmt$(totalRtl)}. ` : '')
                + `Short or missing bars are price points you're barely playing in — either a deliberate gap or an opening to fill.`,
        ]);
        renderChartBlock(host, meta.id, 'Retail $ by price band', [
            { key: 'column', label: 'Columns', fn: () => svgColumn(items, { cat: true, fmt: m$ }) },
            { key: 'bars', label: 'Bars', fn: () => svgBarsH(items, { cat: true, fmt: m$ }) },
            { key: 'pie', label: 'Pie', fn: () => svgPie(items, false) },
        ]);
        host.appendChild(table(['Price band', 'SKUs', 'TY units', 'TY retail $', 'AUR'], data.map(d => [d.band, fmtInt(d.skus), fmtInt(d.units), fmt$(d.rtl), d.aur == null ? '–' : fmt$(d.aur)])));
    }
    function rAging(host, rows, meta) {
        const data = A.inventoryAging(rows);
        if (!data.length)
            return fallbackBreakdown(host, rows, meta);
        const items = data.map(d => ({
            label: d.year, value: d.tiedRetail, valLabel: fmt$(d.tiedRetail),
            color: (d.year !== 'Unknown' && +d.year < state.params.agedYear) ? 'viz-warn' : 'viz-accent',
        }));
        const m$ = v => '$' + axNum(v);
        const oldTied = A.sum(data.filter(d => d.year !== 'Unknown' && +d.year < state.params.agedYear), d => d.tiedRetail);
        readout(host, [
            `Inventory is sorted by the year each collection launched. `
                + (oldTied > 0
                    ? `About ${fmt$(oldTied)} is locked in stock older than ${state.params.agedYear} (the highlighted bars) — the oldest goods and usually the first to clear out.`
                    : `Almost nothing predates ${state.params.agedYear}, so aged stock isn't a pressing problem right now.`),
        ]);
        renderChartBlock(host, meta.id, 'Retail $ tied by vintage year', [
            { key: 'column', label: 'Columns', fn: () => svgColumn(items, { fmt: m$ }) },
            { key: 'bars', label: 'Bars', fn: () => svgBarsH(items, { fmt: m$ }) },
        ]);
        host.appendChild(table(['Vintage', 'SKUs', 'On-hand', 'Tied retail $', 'Dead SKUs'], data.map(d => [d.year, fmtInt(d.skus), fmtInt(d.oh), fmt$(d.tiedRetail), fmtInt(d.dead)])));
    }
    function rMarkdown(host, rows, meta) {
        const m = A.markdownSensitivityAnalysis(rows);
        if (!m.n)
            return fallbackBreakdown(host, rows, meta);
        const pts = m.buckets.filter(b => b.rows > 0).map(b => ({ x: b.depth, y: b.avgUnits, cls: 'viz-accent',
            tip: [(b.depth * 100).toFixed(0) + '% depth', fmtInt(b.avgUnits) + ' avg units', fmtInt(b.rows) + ' rows'].join(' • ') }));
        const items = m.buckets.map(b => ({ label: (b.depth * 100).toFixed(0) + '%', value: b.avgUnits, valLabel: fmtInt(b.avgUnits) }));
        renderChartBlock(host, meta.id, 'Avg units vs discount depth', [
            { key: 'scatter', label: 'Scatter', fn: () => svgScatterXY(pts, { xMin: 0, xMax: 1, trend: m.fit, xLabel: 'discount depth', yLabel: 'avg units' }) },
            { key: 'column', label: 'Columns', fn: () => svgColumn(items) },
        ]);
        readout(host, [
            `Each dot pairs a discount level with how many units typically sold there. `
                + (m.fit.slope > 0.5
                    ? `The line slopes up, so deeper discounts really do shift more product`
                    : `The line is nearly flat, so cutting price further buys little extra volume`)
                + ` — about ${m.fit.slope.toFixed(1)} more units for every extra 100% of markdown depth.`,
        ]);
        host.appendChild(el('p', { class: 'note' }, `Response slope ≈ ${m.fit.slope.toFixed(1)} units per +100% depth across ${fmtInt(m.n)} priced rows.`));
        host.appendChild(table(['Depth band', 'Rows', 'Avg units', 'Avg ST%'], m.buckets.map(b => [`${(b.lo * 100).toFixed(0)}–${(b.hi * 100).toFixed(0)}%`, fmtInt(b.rows), fmtInt(b.avgUnits), b.avgST == null ? '–' : fmtPct(b.avgST)])));
    }
    function rForecast(host, rows, meta) {
        const f = A.demandForecast(rows, 8);
        if (!f.series.length)
            return fallbackBreakdown(host, rows, meta);
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
        readout(host, [
            `The solid line is what actually sold week by week; the dashed line carries the recent trend `
                + `${f.fit.slope >= 0 ? 'upward' : 'downward'} for the next ${f.proj.length} weeks (~${Math.abs(f.fit.slope).toFixed(1)} units/week). `
                + `Read it as direction of travel, not a guarantee — a promo or a stock-out would bend the real line.`,
        ]);
        host.appendChild(el('p', { class: 'note' }, `Trend ≈ ${f.fit.slope >= 0 ? '+' : ''}${f.fit.slope.toFixed(1)} units/week; next ${f.proj.length} weeks ≈ ${fmtInt(A.sum(f.proj, p => p.units))} units.`));
        host.appendChild(table(['Week', 'TY units'], f.series.map(s => [s.week, fmtInt(s.units)])));
    }
    function rAnomaly(host, rows, meta) {
        const a = A.anomalyDetection(rows);
        if (!a.points.length)
            return fallbackBreakdown(host, rows, meta);
        const pts = a.points.slice(0, 1200).map(p => ({ x: p.units, y: p.st == null ? 0 : p.st, cls: p.outlier ? 'viz-warn' : 'viz-muted', op: p.outlier ? '0.95' : '0.4', r: p.outlier ? 4.5 : 2.6,
            tip: [brandLabel(p.brand) + (p.outlier ? ' ⚠' : ''), fmtInt(p.units) + ' units', 'ST ' + (p.st == null ? '–' : fmtPct(p.st)), 'z ' + p.score.toFixed(1)].join(' • ') }));
        renderChartBlock(host, meta.id, 'Units × sell-through (outliers in yellow)', [
            { key: 'scatter', label: 'Scatter', fn: () => svgScatterXY(pts, { yMin: 0, yMax: 1, xLabel: 'TY units', yLabel: 'sell-through' }) },
        ]);
        host.appendChild(el('h4', null, `Top anomalies (${fmtInt(a.outliers.length)} flagged, z > 2.5)`));
        host.appendChild(table(['Brand', 'Retailer', 'Collection', 'TY units', 'ST%', 'AUR ratio', 'Score'], a.outliers.slice(0, 20).map(p => [brandLabel(p.brand), p.retailer, p.collection, fmtInt(p.units), p.st == null ? '–' : fmtPct(p.st), p.aurRatio == null ? '–' : fmtPct(p.aurRatio), p.score.toFixed(1)])));
    }
    function rScorecard(host, rows, meta) {
        const sc = A.retailerScorecard(rows);
        if (!sc.retailers.length)
            return fallbackBreakdown(host, rows, meta);
        const axes = sc.axes.map(a => a[1]);
        const palette = ['stroke-c1', 'stroke-c3', 'stroke-c4'];
        const series = sc.retailers.slice(0, 3).map((r, i) => ({ name: r.retailer, values: sc.axes.map(a => r.norm[a[0]]), cls: palette[i % palette.length] }));
        renderChartBlock(host, meta.id, 'Retailer profile across 5 axes (normalized)', [
            { key: 'radar', label: 'Radar', fn: () => svgRadar(axes, series) },
            { key: 'bars', label: 'Mix bars', fn: () => svgBarsH(sc.retailers.slice(0, 16).map(r => ({ label: r.retailer, value: r.rtl, valLabel: fmt$(r.rtl) }))) },
        ]);
        host.appendChild(table(['Retailer', 'TY retail $', '$/SKU', 'Full-price %', 'YoY', 'Inv. health'], sc.retailers.slice(0, 16).map(r => [r.retailer, fmt$(r.rtl), fmt$(r.rtlPerSku), r.fullPrice == null ? '–' : fmtPct(r.fullPrice), r.growth == null ? '–' : fmtPct(r.growth), r.invHealth == null ? '–' : fmtPct(r.invHealth)])));
    }
    function rLifecycle(host, rows, meta) {
        const data = A.collectionLifecycle(rows);
        if (!data.length)
            return fallbackBreakdown(host, rows, meta);
        const stageColor = { Launch: 'viz-accent', Growth: 'viz-accent', Mature: 'viz-muted', Decay: 'viz-warn', Exit: 'viz-warn' };
        const pts = data.filter(d => d.age != null).map(d => ({ x: d.age, y: d.st == null ? 0 : d.st, cls: stageColor[d.stage] || 'viz-muted', op: '0.85', r: 3.6,
            tip: [d.collection, d.age + 'y old', 'ST ' + (d.st == null ? '–' : fmtPct(d.st)), d.stage].join(' • ') }));
        const stages = ['Launch', 'Growth', 'Mature', 'Decay', 'Exit'];
        const counts = stages.map(st => { const c = data.filter(d => d.stage === st).length; return { label: st, value: c, valLabel: String(c), color: stageColor[st] }; });
        renderChartBlock(host, meta.id, 'Collections by age × sell-through (coloured by stage)', [
            { key: 'lifecycle', label: 'Lifecycle', fn: () => svgScatterXY(pts, { yMin: 0, yMax: 1, xLabel: 'years since release', yLabel: 'sell-through' }) },
            { key: 'stage', label: 'Stages', fn: () => svgColumn(counts) },
        ]);
        host.appendChild(table(['Collection', 'Age', 'TY units', 'LY units', 'Stage'], data.slice(0, 24).map(d => [d.collection, d.age == null ? '–' : d.age, fmtInt(d.units), fmtInt(d.ly), d.stage])));
    }
    function rDoors(host, rows, meta) {
        const dc = A.doorClustering(rows);
        if (!dc.points.length)
            return fallbackBreakdown(host, rows, meta);
        const cl = { 'High-vol · fast': 'viz-accent', 'Low-vol · fast': 'viz-accent', 'High-vol · slow': 'viz-warn', 'Low-vol · slow': 'viz-muted' };
        const pts = dc.points.map(p => ({ x: p.units, y: p.st == null ? 0 : p.st, cls: cl[p.cluster] || 'viz-muted', op: '0.85', r: 4,
            tip: [p.door, fmtInt(p.units) + ' units', 'ST ' + (p.st == null ? '–' : fmtPct(p.st)), p.cluster].join(' • ') }));
        const names = ['High-vol · fast', 'Low-vol · fast', 'High-vol · slow', 'Low-vol · slow'];
        const counts = names.map(c => { const n = dc.points.filter(p => p.cluster === c).length; return { label: c, value: n, valLabel: String(n), color: cl[c] }; });
        renderChartBlock(host, meta.id, 'Doors by volume × sell-through (coloured by cluster)', [
            { key: 'scatter', label: 'Scatter', fn: () => svgScatterXY(pts, { xMin: 0, yMin: 0, yMax: 1, xMed: dc.unitMed, yMed: dc.stMed, xLabel: 'TY units', yLabel: 'sell-through' }) },
            { key: 'cluster', label: 'Clusters', fn: () => svgColumn(counts) },
        ]);
        host.appendChild(table(['Door', 'TY units', 'Sell-through', 'AUR', 'Cluster'], dc.points.slice(0, 24).map(p => [p.door, fmtInt(p.units), p.st == null ? '–' : fmtPct(p.st), p.aur == null ? '–' : fmt$(p.aur), p.cluster])));
    }
    function rBasket(host, rows, meta) {
        // Brands "perform together" when they share a basket. On the usual sell-out grain
        // there's no basket id, so fall back to co-presence in the same door, then location,
        // then retailer. First dimension actually present that yields real pairs wins.
        const byPref = ['transactionId', 'door', 'location', 'retailer'];
        const present = byPref.filter(f => state.foundFields.indexOf(f) >= 0);
        let mb = null, usedBy = null;
        for (const by of present) {
            const cand = A.coPerformance(rows, { by, item: 'brand' });
            if (!mb) {
                mb = cand;
                usedBy = by;
            } // remember first available dim
            if (cand.pairs.length) {
                mb = cand;
                usedBy = by;
                break;
            } // …but prefer one with real pairs
        }
        if (!mb || !mb.pairs.length) {
            host.appendChild(el('p', { class: 'note' }, 'No brand co-occurrence found — needs at least two distinct brands sharing a basket, door, location, or retailer.'));
            return fallbackBreakdown(host, rows, meta);
        }
        const byLabel = { transactionId: 'basket', door: 'door', location: 'location', retailer: 'retailer' }[usedBy] || usedBy;
        const items = mb.pairs.slice(0, 16).map(p => ({ label: p.pair, value: p.count, valLabel: fmtInt(p.count) }));
        // affinity network — brand nodes (sized by # of groups they appear in) joined by co-occurrence links
        const links = mb.pairs.slice(0, 28).map(p => ({ source: p.a, target: p.b, value: p.count, lift: p.lift }));
        const nodeIds = new Set();
        links.forEach(l => { nodeIds.add(l.source); nodeIds.add(l.target); });
        const countByBrand = {};
        mb.brands.forEach(b => { countByBrand[b.brand] = b.count; });
        const nodes = Array.from(nodeIds)
            .map(id => ({ id, label: brandLabel(id), weight: countByBrand[id] || 1 }))
            .sort((a, b) => b.weight - a.weight);
        const builders = [];
        if (nodes.length >= 2 && links.length)
            builders.push({ key: 'network', label: 'Network', fn: () => svgNetwork(nodes, links) });
        builders.push({ key: 'bars', label: 'Bars', fn: () => svgBarsH(items, { cat: true }) });
        builders.push({ key: 'column', label: 'Columns', fn: () => svgColumn(items, { cat: true }) });
        renderChartBlock(host, meta.id, `Brand affinity — brands sharing a ${byLabel} (${fmtInt(mb.baskets)} ${byLabel}${mb.baskets === 1 ? '' : 's'})`, builders);
        const strongest = mb.pairs.filter(p => p.lift != null).slice().sort((a, b) => b.lift - a.lift)[0];
        readout(host, [
            usedBy === 'transactionId'
                ? `Each dot is a brand; a line joins two brands that turn up in the same basket, and the thicker the line the more often they sell together. Tight clusters are brands a shopper tends to buy in one trip — cross-merchandising and bundle opportunities.`
                : `This file has no basket/transaction id, so "together" means sharing the same ${byLabel}. Each dot is a brand; a line joins two brands carried in the same ${byLabel}, and thicker lines mean they co-occur in more ${byLabel}s — brands that travel together across the fleet.`,
            strongest
                ? `${strongest.pair} pair up the most relative to chance (lift ${strongest.lift.toFixed(1)}× — they co-occur ${strongest.lift >= 1 ? 'more' : 'less'} than independent ${usedBy === 'transactionId' ? 'buying' : 'assortment'} would predict).`
                : null,
        ]);
        host.appendChild(table(['Brand pair', `Shared ${byLabel}s`, 'Lift'], mb.pairs.slice(0, 20).map(p => [p.pair, fmtInt(p.count), p.lift == null ? '–' : p.lift.toFixed(2) + '×'])));
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
        host.appendChild(table(['Group', 'New gain', 'Old loss', 'Net', 'Risk'], data.slice(0, 20).map(d => [d.group, '+' + fmtInt(d.newGain), '−' + fmtInt(d.oldLoss), (d.net >= 0 ? '+' : '−') + fmtInt(Math.abs(d.net)), fmtPct(d.risk)])));
    }
    function rWhitespace(host, rows, meta) {
        const attr = firstDim(['priceRange', 'materialCode', 'frameMaterial', 'brandCategory']) || 'priceRange';
        const ws = A.whitespace(rows, { attr });
        if (!ws.attrs.length || !ws.retailers.length)
            return fallbackBreakdown(host, rows, meta);
        renderChartBlock(host, meta.id, `${A.fieldLabel(attr)} × Retailer — units (dashed = whitespace)`, [
            { key: 'heatmap', label: 'Heatmap', fn: () => svgHeatmap(ws.attrs, ws.retailers, ws.matrix) },
        ]);
        host.appendChild(el('h4', null, `Top whitespace gaps (${fmtInt(ws.gaps.length)})`));
        host.appendChild(table([A.fieldLabel(attr), 'Retailer', 'Sells elsewhere (units)'], ws.gaps.slice(0, 20).map(g => [g.attr, g.retailer, fmtInt(g.rowStrength)])));
    }
    function rReplen(host, rows, meta) {
        const data = A.replenishment(rows).slice(0, 20);
        if (!data.length)
            return fallbackBreakdown(host, rows, meta);
        const items = data.map(d => ({ label: String(d.sku), value: d.urgency, valLabel: (d.urgency * 100).toFixed(0) }));
        const scoreFmt = v => (v * 100).toFixed(0);
        renderChartBlock(host, meta.id, 'Chase-priority score (top SKUs)', [
            { key: 'bars', label: 'Bars', fn: () => svgBarsH(items, { fmt: scoreFmt }) },
            { key: 'lollipop', label: 'Lollipop', fn: () => svgLollipop(items, { fmt: scoreFmt }) },
        ]);
        host.appendChild(table(['SKU', 'Brand', 'TY units', 'On-hand', 'ST%', 'Cover', 'Score'], data.map(d => [String(d.sku), brandLabel(d.brand), fmtInt(d.units), fmtInt(d.oh), d.st == null ? '–' : fmtPct(d.st), d.cover == null ? '–' : d.cover.toFixed(1), (d.urgency * 100).toFixed(0)])));
    }
    function rScenario(host, rows, meta) {
        const sp = A.scenarioPlanner(rows, { markdown: state.params.promoThreshold, replenishPct: 0.20 });
        const unitItems = sp.scenarios.map(s => ({ label: s.name, value: s.units, valLabel: fmtInt(s.units), color: s.name === 'Hold' ? 'viz-muted' : 'viz-accent' }));
        const cashItems = sp.scenarios.map(s => ({ label: s.name, value: s.freedCash, valLabel: fmt$(s.freedCash) }));
        // decision tree branching from today into each action, tips annotated with the projection
        const baseUnits = (sp.scenarios.find(s => s.name === 'Hold') || {}).units || 0;
        const STYLE = {
            'Hold': { fill: 'viz-muted', stroke: 'stroke-muted' },
            'Markdown': { fill: 'viz-c2', stroke: 'stroke-c2' },
            'Replenish': { fill: 'viz-accent', stroke: 'stroke-accent' },
            'Exit dead': { fill: 'viz-warn', stroke: 'stroke-warn' },
        };
        const branches = sp.scenarios.map(s => {
            const dU = s.units - baseUnits, st = STYLE[s.name] || { fill: 'viz-muted', stroke: 'stroke-muted' };
            return {
                name: s.name, fill: st.fill, stroke: st.stroke,
                lines: [
                    `${fmtInt(s.units)} units (${dU >= 0 ? '+' : '−'}${fmtInt(Math.abs(dU))} vs hold)`,
                    `${fmt$(s.retail)} retail · ${s.freedCash >= 0 ? '+' : '−'}${fmt$(Math.abs(s.freedCash))} cash`,
                ],
                tip: [s.name, fmtInt(s.units) + ' proj units', fmt$(s.retail) + ' proj retail',
                    (s.freedCash >= 0 ? '+' : '−') + fmt$(Math.abs(s.freedCash)) + ' freed cash'].join(' • '),
            };
        });
        const treeRoot = { label: 'Today', sub: `${fmt$(sp.tiedRetail)} tied · ${fmt$(sp.deadTied)} dead` };
        renderChartBlock(host, meta.id, 'Decision tree — paths from today', [
            { key: 'tree', label: 'Tree', fn: () => svgTree(treeRoot, branches) },
            { key: 'units', label: 'Units', fn: () => svgColumn(unitItems) },
            { key: 'cash', label: 'Freed cash', fn: () => svgDiverging(cashItems) },
        ]);
        readout(host, [
            `This branches from where you are today into four moves and projects each one out. `
                + `Hold is the do-nothing baseline; Markdown trades margin for faster unit flow and frees cash from dead stock; `
                + `Replenish chases more demand but ties up more cash; Exit dead clears the ${fmt$(sp.deadTied)} stuck in non-selling stock.`,
        ]);
        host.appendChild(table(['Scenario', 'Proj. units', 'Proj. retail $', 'Freed cash'], sp.scenarios.map(s => [s.name, fmtInt(s.units), fmt$(s.retail), fmt$(s.freedCash)])));
        host.appendChild(el('p', { class: 'note' }, `Assumes markdown depth ${fmtPct(state.params.promoThreshold)} · ${fmtInt(sp.onHandRows)} on-hand rows · ${fmt$(sp.deadTied)} tied in dead stock.`));
    }
    /* ---- LENS 20: Attribute Drivers (multivariate OLS coefficient plot) ----- */
    function rAttributeDrivers(host, rows, meta) {
        const a = A.attributeDrivers(rows, {});
        if (a.insufficient || !a.terms.length) {
            host.appendChild(el('p', { class: 'note' }, 'Not enough attribute variation or selling rows to fit a driver model — needs ~10+ selling rows and at least one attribute with two or more values.'));
            return fallbackBreakdown(host, rows, meta);
        }
        const isST = a.target === 'st';
        // ST coefficients are in sell-through points; log(units) coefficients read as % change
        const toVal = c => isST ? c * 100 : (Math.exp(c) - 1) * 100;
        const suffix = isST ? 'pt' : '%';
        const sigColor = t => t.sig ? (t.coef >= 0 ? 'viz-accent' : 'viz-warn') : 'viz-muted';
        const diverge = a.terms.slice(0, 16).map(t => ({
            label: `${A.fieldLabel(t.dim)}: ${t.level}`,
            value: toVal(t.coef),
            valLabel: (toVal(t.coef) >= 0 ? '+' : '') + toVal(t.coef).toFixed(1) + suffix,
            color: sigColor(t),
        }));
        renderChartBlock(host, meta.id, `Attribute effect on ${isST ? 'sell-through' : 'unit velocity'} — vs baseline, holding other attributes fixed`, [
            { key: 'coef', label: 'Coefficients', fn: () => svgDiverging(diverge, { fmt: v => Math.round(v) + suffix }) },
        ]);
        const posTop = a.terms.find(t => t.sig && t.coef > 0);
        const negTop = a.terms.find(t => t.sig && t.coef < 0);
        readout(host, [
            `A regression isolates each attribute's own pull on ${isST ? 'sell-through' : 'units'} while holding the others constant, `
                + `so you see the attribute's effect rather than what it tends to be bundled with. The model explains ${fmtPct(a.r2)} of the variation (R²).`,
            (posTop || negTop)
                ? `${posTop ? `${A.fieldLabel(posTop.dim)} “${posTop.level}” lifts the most (${toVal(posTop.coef) >= 0 ? '+' : ''}${toVal(posTop.coef).toFixed(1)}${isST ? ' pts' : '%'} vs ${posTop.baseline}). ` : ''}`
                    + `${negTop ? `${A.fieldLabel(negTop.dim)} “${negTop.level}” drags the most (${toVal(negTop.coef).toFixed(1)}${isST ? ' pts' : '%'} vs ${negTop.baseline}). ` : ''}`
                    + `Grey bars aren't statistically distinguishable from their baseline (|t| < 1.96) — read them as “no clear effect yet.”`
                : `No single attribute level is statistically distinguishable from its baseline yet — more rows would sharpen the estimates.`,
        ]);
        host.appendChild(el('p', { class: 'note' }, `OLS · ${fmtInt(a.n)} rows · ${fmtInt(a.p)} terms · R² ${fmtPct(a.r2)} · adj-R² ${fmtPct(a.adjR2)}. `
            + `Baseline per attribute = its most common value. ${isST ? 'Coefficients are sell-through points.' : 'Units are modelled on a log scale, so effects read as % change.'}`));
        host.appendChild(table(['Attribute', 'Level vs baseline', isST ? 'Δ ST (pts)' : 'Δ units (%)', 't-stat', 'Signif.'], a.terms.slice(0, 24).map(t => [
            A.fieldLabel(t.dim), `${t.level} vs ${t.baseline}`,
            (toVal(t.coef) >= 0 ? '+' : '') + toVal(t.coef).toFixed(1), t.t.toFixed(1),
            t.sig ? '✓ p<.05' : '—'
        ])));
    }
    /* ---- LENS 21: Seasonality & Timing (monthly index + trend + consistency) - */
    function rSeasonality(host, rows, meta) {
        const s = A.seasonality(rows);
        if (s.insufficient) {
            host.appendChild(el('p', { class: 'note' }, 'Not enough dated rows to read seasonality — needs a parseable Week / Date spanning several months.'));
            return fallbackBreakdown(host, rows, meta);
        }
        const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const idxSeries = [{ name: 'Seasonal index', values: s.months.map(m => m.index), cls: 'stroke-accent' }];
        const idxMax = Math.max(1.2, Math.max.apply(null, s.months.map(m => m.index || 0)));
        const unitItems = s.months.map(m => ({ label: MON[m.month - 1], value: m.units, valLabel: fmtInt(m.units) }));
        const builders = [
            { key: 'index', label: 'Index', fn: () => svgLine(MON, idxSeries, { max: idxMax, fmt: v => v.toFixed(1) + '×' }) },
            { key: 'units', label: 'Units', fn: () => svgColumn(unitItems) },
        ];
        if (s.yearSeries && s.yearSeries.length >= 2) {
            const pal = ['stroke-c1', 'stroke-c3', 'stroke-c4', 'stroke-c5', 'stroke-c7'];
            const series = s.yearSeries.map((ys, i) => ({ name: String(ys.year), values: ys.units, cls: pal[i % pal.length] }));
            builders.push({ key: 'byyear', label: 'By year', fn: () => svgLine(MON, series, {}) });
        }
        renderChartBlock(host, meta.id, 'Demand by month — seasonal index (1.0× = an average month)', builders);
        const consPct = s.consistency == null ? null : Math.round(s.consistency * 100);
        const consWord = s.consistency == null ? '' : (s.consistency > 0.7 ? 'very consistent' : s.consistency > 0.4 ? 'moderately consistent' : 'erratic');
        readout(host, [
            s.peak
                ? `Demand peaks in ${MON[s.peak.month - 1]} (${(s.peak.index || 0).toFixed(1)}× an average month) and bottoms in ${s.trough ? MON[s.trough.month - 1] : '—'}. `
                    + `Use that to time buys and promotions ahead of the peak rather than into the trough.`
                : `Spread across the calendar without a sharp peak.`,
            s.years && s.years.length >= 2
                ? `Across ${s.years.length} years the monthly shape is ${consWord} (cross-year correlation ${consPct}%) — ${s.consistency > 0.4 ? 'a repeatable pattern you can plan against' : 'too noisy to lean on as a forecast'}.`
                : `Only one year of data here, so this is a within-year shape, not yet a proven repeat pattern.`,
        ]);
        host.appendChild(el('p', { class: 'note' }, `${fmtInt(s.n)} dated rows · trend ${s.trendSlope >= 0 ? '+' : ''}${fmtInt(s.trendSlope)} units/period`
            + (consPct != null ? ` · consistency ${consPct}%` : '') + '.'));
        host.appendChild(table(['Month', 'TY units', 'Seasonal index', 'Rows'], s.months.filter(m => m.n > 0).map(m => [MON[m.month - 1], fmtInt(m.units), m.index == null ? '–' : m.index.toFixed(2) + '×', fmtInt(m.n)])));
    }
    /* ---- LENS 22: Price Elasticity (log–log demand curve) + AUR realization -- */
    function rPriceElasticity(host, rows, meta) {
        const e = A.priceElasticity(rows);
        if (e.insufficient) {
            host.appendChild(el('p', { class: 'note' }, 'Not enough priced selling rows to estimate elasticity — needs ~8+ rows with positive units, retail $, and MSRP.'));
            return fallbackBreakdown(host, rows, meta);
        }
        const lpts = e.points.slice(0, 1500).map(p => ({
            x: Math.log(p.aur), y: Math.log(p.units), cls: p.promo ? 'viz-warn' : 'viz-accent', op: '0.6', r: 3,
            tip: [brandLabel(p.brand), 'AUR ' + fmt$(p.aur), fmtInt(p.units) + ' units', p.promo ? 'promo' : 'full-price'].join(' • '),
        }));
        const lx = lpts.map(p => p.x), ly = lpts.map(p => p.y);
        const xMin = Math.min.apply(null, lx), xMax = Math.max.apply(null, lx);
        const yMin = Math.min(0, Math.min.apply(null, ly)), yMax = Math.max.apply(null, ly);
        const real = e.points.filter(p => p.msrp > 0).slice(0, 1500).map(p => ({
            x: p.msrp, y: p.aur, cls: p.aurRatio > 1 ? 'viz-warn' : 'viz-accent', op: '0.55', r: 3,
            tip: [brandLabel(p.brand), 'MSRP ' + fmt$(p.msrp), 'AUR ' + fmt$(p.aur), fmtPct(p.aurRatio) + ' of MSRP'].join(' • '),
        }));
        const maxMsrp = Math.max.apply(null, e.points.map(p => p.msrp || 0).concat([1]));
        renderChartBlock(host, meta.id, 'Demand curve — units vs AUR (log–log; the slope IS the elasticity)', [
            { key: 'elasticity', label: 'Elasticity', fn: () => svgScatterXY(lpts, {
                    xMin, xMax, yMin, yMax, trend: e.lnFit, xLabel: 'ln(AUR)', yLabel: 'ln(units)',
                    xFmt: v => '$' + Math.round(Math.exp(v)), yFmt: v => fmtInt(Math.exp(v))
                }) },
            { key: 'realization', label: 'AUR vs MSRP', fn: () => svgScatterXY(real, {
                    xMin: 0, xMax: maxMsrp, yMin: 0, yMax: maxMsrp, trend: { slope: 1, intercept: 0 },
                    xLabel: 'MSRP', yLabel: 'AUR', xFmt: v => '$' + axNum(v), yFmt: v => '$' + axNum(v)
                }) },
        ]);
        const el_ = e.elasticity, elastic = Math.abs(el_) > 1;
        readout(host, [
            `Fitting a demand curve through every priced row: a 1% change in price (AUR) goes with about `
                + `${Math.abs(el_).toFixed(1)}% ${el_ < 0 ? 'fewer' : 'more'} units (elasticity ${el_.toFixed(2)}). `
                + (elastic
                    ? `Demand is elastic — price moves matter, so markdowns should shift real volume and premium pricing costs units.`
                    : `Demand is inelastic — units hold up as price rises, which supports premium pricing and means deeper markdowns buy little extra volume.`),
            `On the AUR-vs-MSRP view, points on the diagonal sell at full sticker; points below it are discounted. `
                + `Blended realization runs about ${fmtPct(e.medRealization)} of MSRP.`,
        ]);
        host.appendChild(el('p', { class: 'note' }, `Log–log OLS · ${fmtInt(e.n)} priced rows · R² ${fmtPct(e.r2)} · t ${e.tStat.toFixed(1)}. `
            + `Cross-sectional elasticity is descriptive, not causal — premium lines differ in more than price.`));
    }
    const GENERIC_RENDERERS = {
        productivity: rProductivity, sizeCurve: rSizeCurve, priceArchitecture: rPriceArch,
        exitPlanner: rAging, markdownSensitivity: rMarkdown, forecasting: rForecast,
        anomalyDetection: rAnomaly, retailerScorecard: rScorecard, collectionLifecycle: rLifecycle,
        doorClustering: rDoors, marketBasket: rBasket, cannibalization: rCannibal,
        whitespace: rWhitespace, replenishment: rReplen, scenarioPlanner: rScenario,
        attributeDrivers: rAttributeDrivers, seasonality: rSeasonality, priceElasticity: rPriceElasticity,
    };
    function renderAnalysisGuide() {
        const host = $('analysisGuide');
        if (!host)
            return;
        host.innerHTML = '';
        if (!state.fileName) {
            host.appendChild(el('p', { class: 'analysis-guide__empty' }, 'The ready reads will appear here after the file lands.'));
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
            card.appendChild(el('div', { class: 'analysis-card__top' }, `<span>${meta.priority}. ${meta.name}</span><b>${status}</b>`));
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
                const result = e.target?.result;
                if (!(result instanceof ArrayBuffer))
                    throw new Error('Workbook could not be read as binary data.');
                const wb = XLSX.read(new Uint8Array(result), { type: 'array' });
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
            }
            catch (err) {
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
        for (const k in state.filters)
            if (state.filters[k] && state.filters[k].size)
                f[k] = state.filters[k];
        return f;
    }
    function recomputeAndRender() {
        state.enriched = A.enrich(state.records, state.params, state.themes);
        const rows = A.applyFilters(state.enriched, activeFilters());
        state.viewRows = rows; // current filtered rows, for the generic read
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
            if (!vals.length)
                return;
            const det = el('details', { class: 'filter' });
            const sum = el('summary', null, `${label} <span class="cnt"></span>`);
            det.appendChild(sum);
            const box = el('div', { class: 'opts' });
            vals.forEach(v => {
                const id = `f_${field}_${btoa(unescape(encodeURIComponent(String(v)))).replace(/=/g, '')}`;
                const lab = el('label');
                const cb = el('input', { type: 'checkbox', value: String(v) });
                cb.addEventListener('change', () => {
                    if (!state.filters[field])
                        state.filters[field] = new Set();
                    if (cb.checked)
                        state.filters[field].add(v);
                    else
                        state.filters[field].delete(v);
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
        const host = $('lens-integrity');
        host.innerHTML = '';
        if (renderRequirementNotice(host, 'integrity'))
            return;
        host.appendChild(el('p', null, `${fmtInt(rep.totalRows)} rows in view · ${fmtInt(rep.noTySale)} have no TY sell-out `
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
        const issues = flagDefs.filter(r => r[1] > 0).length;
        readout(host, [
            `Think of this as a spell-check for the spreadsheet. ${fmtInt(rep.totalRows)} rows are loaded; `
                + `${fmtInt(rep.noTySale)} of them sold nothing this year — inventory just sitting on shelves.`,
            issues
                ? `${issues} kind${issues === 1 ? '' : 's'} of data problem turned up (things like a missing price or negative units). `
                    + `Each bad row is quietly left out of the numbers it would distort, so a single typo can't poison the whole report.`
                : `No data problems turned up — every row is clean enough to trust downstream.`,
        ]);
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
        host.appendChild(el('p', { class: 'note' }, 'Note: the Overview totals reflect the full unfiltered dataset; apply no filters to reconcile exactly.'));
    }
    /* ---- LENS 1: liquidation ---------------------------------------------- */
    function renderLiquidation(rows) {
        const host = $('lens-liquidation');
        host.innerHTML = '';
        if (renderRequirementNotice(host, 'liquidation'))
            return;
        const data = A.liquidationRadar(rows, { groupBy: ['brand', 'retailer'] });
        host.appendChild(el('p', null, 'Liquidation candidates ranked by retail value tied up in dead stock '
            + '(on-hand units with zero TY sell-out, valued at MSRP). '
            + '“Cover” = total on-hand ÷ TY units sold.'));
        const ranked = data.filter(d => d.tiedRetail > 0);
        const labelOf = d => d.group.split(' › ').map((p, i) => i === 0 ? brandLabel(p) : p).join(' › ');
        const totalTied = A.sum(ranked, d => d.tiedRetail), topTied = ranked[0];
        readout(host, [
            `Roughly ${fmt$(totalTied)} of inventory (counted at full sticker price) is stuck in stock that isn't selling this year — `
                + `cash you've already spent, sitting on shelves instead of in the till.`,
            topTied
                ? `The biggest single pocket is ${labelOf(topTied)} at ${fmt$(topTied.tiedRetail)}. On the Pareto view the tall left-hand bars are where clearing stock frees the most money fastest.`
                : `Nothing is meaningfully stuck right now — stock is turning over.`,
        ]);
        // live chart: tied retail $ ranked (pareto / bars / columns)
        const m$ = v => '$' + axNum(v);
        const liqItems = ranked.slice(0, 16).map(d => ({ label: labelOf(d), value: d.tiedRetail, valLabel: fmt$(d.tiedRetail) }));
        renderChartBlock(host, 'liquidation', 'Retail $ tied in dead stock', [
            { key: 'pareto', label: 'Pareto', fn: () => svgPareto(liqItems, { fmt: m$ }) },
            { key: 'bars', label: 'Bars', fn: () => svgBarsH(liqItems, { fmt: m$ }) },
            { key: 'column', label: 'Columns', fn: () => svgColumn(liqItems, { fmt: m$ }) },
        ]);
        const top = ranked.slice(0, 25).map(d => [
            d.group.split(' \u203a ').map((p, i) => i === 0 ? brandLabel(p) : p).join(' › '),
            fmtInt(d.deadRows), fmtInt(d.strandedUnits), fmt$(d.tiedRetail),
            fmtPct(d.deadOHShare), d.coverRatio == null ? '–' : d.coverRatio.toFixed(1),
        ]);
        host.appendChild(table(['Brand › Retailer', 'Dead SKUs', 'Stranded units', 'Tied retail $', 'Dead % of OH', 'Cover'], top));
    }
    /* ---- LENS 2: velocity matrix ------------------------------------------ */
    function renderVelocity(rows) {
        const host = $('lens-velocity');
        host.innerHTML = '';
        if (renderRequirementNotice(host, 'velocity'))
            return;
        const v = A.velocityMatrix(rows);
        host.appendChild(el('p', null, `${fmtInt(v.n)} selling SKU-rows classified on a median split `
            + `(ST% median ${fmtPct(v.stMed)}, volume median ${fmtInt(v.volMed)} units). `
            + `Quadrant = sell-through × volume.`));
        readout(host, [
            `Every item lands in one of four boxes based on how fast it sells (up) and how much it sells (right). `
                + `Top-right Stars (${fmtInt(v.counts.Star || 0)}) are proven winners — protect their stock. `
                + `Top-left Sleepers (${fmtInt(v.counts.Sleeper || 0)}) sell out quickly but you barely stock them — chase more units.`,
            `Bottom-right Slow-bleeders (${fmtInt(v.counts['Slow-bleeder'] || 0)}) are the markdown trap: lots of stock, weak sell-through. `
                + `Bottom-left Dogs (${fmtInt(v.counts.Dog || 0)}) are slow and small — the obvious candidates to exit.`,
        ]);
        // live chart: ST% (y) vs TY units (x) scatter, split on the medians
        if (v.points.length) {
            const unitsSorted = v.points.map(p => p.units).sort((a, b) => a - b);
            const xMax = unitsSorted[Math.min(unitsSorted.length - 1, Math.floor(unitsSorted.length * 0.95))] || 1;
            const pts = (v.points.length > 1500
                ? v.points.filter((_, i) => i % Math.ceil(v.points.length / 1500) === 0)
                : v.points).map(p => ({ x: p.units, y: p.st, quad: p.quad,
                tip: [brandLabel(p.brand) + (p.retailer ? ' @ ' + p.retailer : ''), fmtInt(p.units) + ' units', 'ST ' + fmtPct(p.st), p.quad].join(' • ') }));
            const quadColor = { Star: 'viz-accent', Sleeper: 'viz-accent', 'Slow-bleeder': 'viz-warn', Dog: 'viz-muted' };
            const quadItems = ['Star', 'Sleeper', 'Slow-bleeder', 'Dog'].map(q => ({ label: q, value: v.counts[q] || 0, valLabel: fmtInt(v.counts[q] || 0), color: quadColor[q] }));
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
        host.appendChild(table(['Brand', 'Retailer', 'Collection', 'Material', 'Price', 'ST%', 'TY units'], sleepers));
    }
    /* ---- LENS 3: momentum decomposition ----------------------------------- */
    function renderMomentum(rows) {
        const host = $('lens-momentum');
        host.innerHTML = '';
        if (renderRequirementNotice(host, 'momentum'))
            return;
        const m = A.momentum(rows).filter(b => b.tyUnits > 0 || b.lyUnits > 0).slice(0, 30);
        host.appendChild(el('p', null, 'YoY unit change decomposed per brand: New (collections with no LY sales) '
            + '− Dropped (LY collections gone this year) + Continuing (Δ on collections in both years).'));
        const net = A.sum(m, b => b.unitVar || 0);
        const up = m.filter(b => (b.unitVar || 0) > 0).length, down = m.filter(b => (b.unitVar || 0) < 0).length;
        readout(host, [
            `Versus last year, units are ${net >= 0 ? 'up' : 'down'} ${fmtInt(Math.abs(net))} overall — `
                + `${up} brand${up === 1 ? '' : 's'} grew and ${down} shrank. Bars to the right are gains, to the left are losses.`,
            `The point is to see where growth comes from: brand-new collections, business lost to dropped collections, or the core range you carried in both years. `
                + `Growth built on new launches is more fragile than growth from the core holding steady.`,
        ]);
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
        host.appendChild(table(['Brand', 'TY units', 'LY units', 'Δ units', 'Δ %', 'New', 'Dropped', 'Continuing'], rowsOut));
    }
    /* ---- LENS 4: full-price vs promo -------------------------------------- */
    function renderPromo(rows) {
        const host = $('lens-promo');
        host.innerHTML = '';
        if (renderRequirementNotice(host, 'promo'))
            return;
        const p = A.promoAnalysis(rows, { groupBy: ['brand'] });
        host.appendChild(el('p', null, `Promo = blended AUR more than ${fmtPct(state.params.promoThreshold)} below MSRP. `
            + `Because the data is YTD-aggregated, this is promo intensity per row, not a true unit split. `
            + `${fmtInt(p.validRows)} rows priced; ${fmtInt(p.aboveMsrpExcluded)} above-MSRP rows excluded. `
            + `Overall promo unit share: ${fmtPct(p.overall.promoUnitPct)}.`));
        const promoDependent = p.groups.filter(g => (g.promoUnitPct || 0) > 0.30).length;
        readout(host, [
            `About ${fmtPct(p.overall.promoUnitPct)} of units sold at a real discount (more than ${fmtPct(state.params.promoThreshold)} off the sticker); `
                + `the rest moved at or near full price — that's healthy, full-margin demand. The shaded slab in each bar is the discounted share.`,
            promoDependent
                ? `${promoDependent} brand${promoDependent === 1 ? '' : 's'} lean on markdowns for more than 30% of volume — they'd feel it most if promotions were pulled back.`
                : `No brand here is overly hooked on markdowns to move product.`,
        ]);
        // live chart: 100% stacked full-price vs promo, overall then per brand
        const stackItems = [{
                label: 'ALL BRANDS', promoPct: p.overall.promoUnitPct || 0,
                valLabel: fmtPct(p.overall.promoUnitPct) + ' promo',
            }].concat(p.groups.filter(g => g.totalUnits > 0)
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
            { key: 'bars', label: 'Per-brand', fn: () => svgBarsH(promoBars, { fmt: axPct }) },
        ]);
        const rowsOut = p.groups.filter(g => g.totalUnits > 0).slice(0, 30).map(g => [
            brandLabel(g.group), fmtInt(g.totalUnits),
            fmtPct(g.fullPriceUnitPct), fmtPct(g.promoUnitPct),
            fmtPct(g.promoRtlPct), fmtPct(g.medDiscountDepth),
            g.promoUnitPct > 0.30 ? '⚠ promo-dependent' : '',
        ]);
        host.appendChild(table(['Brand', 'TY units', 'Full-price %', 'Promo %', 'Promo $ %', 'Med. discount', 'Flag'], rowsOut));
    }
    /* ---- Theme authoring --------------------------------------------------- *
     * For the current collection-material grain, themes are keyed on
     * CollectionRelease. When a UPC-grain re-pull lands, switch the key to UPC.
     */
    function renderThemeAuthoring(rows) {
        const host = $('lens-theme');
        host.innerHTML = '';
        if (renderRequirementNotice(host, 'theme'))
            return;
        host.appendChild(el('p', null, 'Assign a marketing theme to each collection. Themes persist in the snapshot '
            + 'and activate a “Theme” filter + breakdowns once authored. '
            + (state.optionalDims.includes('theme')
                ? 'A Theme column was detected in the file and takes precedence.'
                : 'No Theme column in the file yet — author below.')));
        // once themes exist (authored or from a column), show how volume splits across them
        const themed = rows.filter(r => r.theme != null && r.theme !== '');
        if (themed.length) {
            const g = A.groupBy(themed, r => r.theme);
            const agg = [];
            g.forEach((rs, k) => agg.push({
                theme: String(k),
                units: A.sum(rs, r => (r.tyUnits > 0 ? r.tyUnits : 0)),
                rtl: A.sum(rs.filter(r => r._validSale), r => r.tyRtl),
                cols: new Set(rs.map(r => r.collection)).size,
            }));
            agg.sort((a, b) => b.units - a.units);
            const items = agg.map(a => ({ label: a.theme, value: a.units, valLabel: fmtInt(a.units) }));
            renderChartBlock(host, 'theme', 'TY units by theme', [
                { key: 'bars', label: 'Bars', fn: () => svgBarsH(items, { cat: true }) },
                { key: 'pie', label: 'Pie', fn: () => svgPie(items, true) },
                { key: 'column', label: 'Columns', fn: () => svgColumn(items, { cat: true }) },
            ]);
            readout(host, [
                `${agg.length} theme${agg.length === 1 ? '' : 's'} cover ${fmtInt(themed.length)} rows. `
                    + (agg[0] ? `${agg[0].theme} is the biggest story by volume — ${fmtInt(agg[0].units)} units across ${fmtInt(agg[0].cols)} collection${agg[0].cols === 1 ? '' : 's'}. ` : '')
                    + `Author or edit themes below; the split updates live and the Theme filter then propagates into every other read.`,
            ]);
            host.appendChild(table(['Theme', 'Collections', 'TY units', 'TY retail $'], agg.map(a => [a.theme, fmtInt(a.cols), fmtInt(a.units), fmt$(a.rtl)])));
            host.appendChild(el('h4', null, 'Author themes'));
        }
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
                if (val)
                    state.themes[col] = val;
                else
                    delete state.themes[col];
                buildFilterUI(); // refresh theme filter options
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
                const result = e.target?.result;
                if (typeof result !== 'string')
                    throw new Error('Snapshot could not be read as text.');
                const snap = JSON.parse(result);
                if (snap.params)
                    Object.assign(state.params, snap.params);
                if (snap.themes)
                    state.themes = Object.assign({}, snap.themes);
                $('promoThresh').value = Math.round(state.params.promoThreshold * 100);
                $('agedYear').value = state.params.agedYear;
                syncPriceBandInputs();
                updateHeaderStats();
                updateProjectStatus();
                renderAnalysisGuide();
                updateTabsAvailability();
                buildFilterUI();
                recomputeAndRender();
                $('status').textContent = `Snapshot loaded (${Object.keys(state.themes).length} themes).`;
            }
            catch (err) {
                $('status').textContent = 'Bad snapshot: ' + err.message;
            }
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
        if (opts && opts.keepThemes === false)
            state.themes = {};
        // wipe rendered output — emptying #kpis drops the has-data state via observer
        $('kpis').innerHTML = '';
        $('filters').innerHTML = '';
        document.querySelectorAll('.lens').forEach(l => { l.innerHTML = ''; });
        // reset the inputs
        const fileInput = $('file');
        if (fileInput)
            fileInput.value = '';
        const pasteBox = $('pasteBox');
        if (pasteBox)
            pasteBox.value = '';
        const pasteHint = $('pasteHint');
        if (pasteHint)
            pasteHint.textContent = '0 rows detected';
        updateHeaderStats();
        updateProjectStatus();
        renderAnalysisGuide();
        updateTabsAvailability();
        $('status').textContent = 'Load the YTD Sell-Out workbook to begin.';
        return hadData;
    }
    /* expose a small surface for the editorial shell (inline script) */
    window.SOA_APP = Object.assign(window.SOA_APP || {}, { clearData });
    /* mirror the price-band params into their inputs (init + snapshot import) */
    function syncPriceBandInputs() {
        const e = $('priceBandEdges');
        if (e)
            e.value = (state.params.priceBands || []).join(', ');
        const s = $('priceBandSource');
        if (s)
            s.value = state.params.priceBandSource || 'auto';
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
            if (state.records.length)
                recomputeAndRender();
        });
        $('agedYear').addEventListener('change', e => {
            const v = parseInt(e.target.value, 10);
            state.params.agedYear = isFinite(v) ? v : 2020;
            if (state.records.length)
                recomputeAndRender();
        });
        // price-range config: derive bands from MSRP, or use the file's column
        syncPriceBandInputs();
        const pbSource = $('priceBandSource');
        if (pbSource)
            pbSource.addEventListener('change', e => {
                state.params.priceBandSource = e.target.value || 'auto';
                if (state.records.length)
                    recomputeAndRender();
            });
        const pbEdges = $('priceBandEdges');
        if (pbEdges)
            pbEdges.addEventListener('change', e => {
                const edges = String(e.target.value).split(/[,\s]+/).map(s => parseFloat(s))
                    .filter(n => isFinite(n) && n > 0).sort((a, b) => a - b);
                if (edges.length)
                    state.params.priceBands = edges;
                e.target.value = state.params.priceBands.join(', '); // reflect the cleaned list
                if (state.records.length)
                    recomputeAndRender();
            });
        // tab switching
        document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
            selectAnalysis(lensId(t.dataset.target));
        }));
    }
    let themePending = 0;
    function applyTheme(next) {
        document.documentElement.setAttribute('data-theme', next);
        try {
            localStorage.setItem('cloonk-theme', next);
        }
        catch (e) { }
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
        }
        else {
            applyTheme(next);
            requestAnimationFrame(() => requestAnimationFrame(settle));
        }
    }
    window.toggleTheme = function () {
        swapTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    };
    window.addEventListener('storage', e => {
        if (e.key === 'cloonk-theme')
            swapTheme(e.newValue === 'light' ? 'light' : 'dark');
    });
    document.addEventListener('DOMContentLoaded', init);
})();
