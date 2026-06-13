// TypeScript source. Builds to dist/image-prep.js.
// Image processing state and browser contracts are typed below.
(function () {
  "use strict";

  type ImageResult = {
    blob: Blob;
    url: string;
    name: string;
    w: number;
    h: number;
    size: number;
    type: string;
  };

  type ImageItem = {
    id: number;
    file: File;
    name: string;
    url: string;
    img: HTMLImageElement | null;
    w: number;
    h: number;
    ok: boolean;
    error: string;
    result?: ImageResult | null;
  };

  /* ── State ──────────────────────────────────────────────── */
  let seq = 0;
  const items: ImageItem[] = [];
  const settings = {
    resize: "none",
    percent: 100,
    fitW: 1600, fitH: 1600, fitNoUp: true,
    exW: 1080, exH: 1080, exFit: "contain",
    bg: "transparent", bgColor: "#ffffff",
    format: "original", quality: 0.9,
    suffix: "", appendDims: false,
  };
  const PRESET_COLORS = ["#ffffff", "#000000", "#f5f2ec", "#0a0a0a", "#e8e4dc", "#d9d4c8", "#1b1b18", "#cfd8dc"];

  const $ = (id) => document.getElementById(id);
  const els = {
    fileInput: $("fileInput"), dropzone: $("dropzone"),
    queue: $("queue"), queueEmpty: $("queueEmpty"), sourcesSub: $("sourcesSub"),
    processBtn: $("processBtn"), clearBtn: $("clearBtn"),
    progressWrap: $("progressWrap"), progressFill: $("progressFill"), progressLabel: $("progressLabel"),
    resultsBar: $("resultsBar"), resultsStats: $("resultsStats"),
    resultsGrid: $("resultsGrid"), resultsEmpty: $("resultsEmpty"), outputSub: $("outputSub"),
    downloadAllBtn: $("downloadAllBtn"),
    toast: $("toast"),
  };

  /* ── Helpers ────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));
  }
  function fmtBytes(n) {
    if (n == null) return "—";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }
  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 3000);
  }
  const extFor = (type) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[type] || "png");
  const labelFor = (type) => ({ "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP" }[type] || "PNG");

  /* ── File intake ────────────────────────────────────────── */
  function addFiles(fileList) {
    const incoming = (Array.from(fileList || []) as File[]).filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) { toast("No images found in that drop."); return; }
    let pending = incoming.length;
    incoming.forEach((file) => {
      const id = ++seq;
      const url = URL.createObjectURL(file);
      const item: ImageItem = { id, file, name: file.name, url, img: null, w: 0, h: 0, ok: false, error: "" };
      items.push(item);
      const img = new Image();
      img.onload = () => {
        item.w = img.naturalWidth; item.h = img.naturalHeight;
        if (!item.w || !item.h) { item.ok = false; item.error = "No intrinsic size"; }
        else { item.img = img; item.ok = true; }
        if (--pending === 0) { renderQueue(); scheduleProcess(); }
        else renderQueue();
      };
      img.onerror = () => {
        item.ok = false; item.error = "Could not decode";
        if (--pending === 0) { renderQueue(); scheduleProcess(); }
        else renderQueue();
      };
      img.src = url;
    });
    renderQueue();
  }

  function removeItem(id) {
    const i = items.findIndex((it) => it.id === id);
    if (i === -1) return;
    const [it] = items.splice(i, 1);
    if (it.url) URL.revokeObjectURL(it.url);
    if (it.result && it.result.url) URL.revokeObjectURL(it.result.url);
    renderQueue();
    if (items.length) scheduleProcess();
    else renderResults([]);
  }

  function clearAll() {
    items.forEach((it) => {
      if (it.url) URL.revokeObjectURL(it.url);
      if (it.result && it.result.url) URL.revokeObjectURL(it.result.url);
    });
    items.length = 0;
    renderQueue();
    renderResults([]);
  }

  function renderQueue() {
    const has = items.length > 0;
    els.queueEmpty.style.display = has ? "none" : "";
    els.clearBtn.disabled = !has;
    els.processBtn.disabled = !items.some((it) => it.ok);
    els.sourcesSub.textContent = has ? `${items.length} image${items.length === 1 ? "" : "s"}` : "0 images";
    els.queue.innerHTML = items.map((it) => {
      const dims = it.ok ? `${it.w} × ${it.h} px` : (it.error || "loading…");
      return `<div class="queue-item${it.ok ? "" : (it.error ? " bad" : "")}">
        <img class="q-thumb" src="${esc(it.url)}" alt="">
        <div class="q-meta">
          <div class="q-name" title="${esc(it.name)}">${esc(it.name)}</div>
          <div class="q-sub">${esc(dims)} · ${esc(fmtBytes(it.file.size))}</div>
        </div>
        <button class="q-remove" data-remove="${it.id}" aria-label="Remove ${esc(it.name)}">&times;</button>
      </div>`;
    }).join("");
    updateJpegNote();
  }

  /* ── Geometry ───────────────────────────────────────────── */
  function computeTarget(nw, nh) {
    const s = settings;
    if (s.resize === "percent") {
      const k = s.percent / 100;
      const w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
      return { cw: w, ch: h, dw: w, dh: h, dx: 0, dy: 0 };
    }
    if (s.resize === "fit") {
      const mw = s.fitW > 0 ? s.fitW : Infinity;
      const mh = s.fitH > 0 ? s.fitH : Infinity;
      let scale = Math.min(mw / nw, mh / nh);
      if (!isFinite(scale)) scale = 1;
      if (s.fitNoUp) scale = Math.min(scale, 1);
      const w = Math.max(1, Math.round(nw * scale)), h = Math.max(1, Math.round(nh * scale));
      return { cw: w, ch: h, dw: w, dh: h, dx: 0, dy: 0 };
    }
    if (s.resize === "exact") {
      const cw = Math.max(1, s.exW || nw), ch = Math.max(1, s.exH || nh);
      if (s.exFit === "stretch") return { cw, ch, dw: cw, dh: ch, dx: 0, dy: 0 };
      const scale = s.exFit === "cover" ? Math.max(cw / nw, ch / nh) : Math.min(cw / nw, ch / nh);
      const dw = Math.round(nw * scale), dh = Math.round(nh * scale);
      return { cw, ch, dw, dh, dx: Math.round((cw - dw) / 2), dy: Math.round((ch - dh) / 2) };
    }
    return { cw: nw, ch: nh, dw: nw, dh: nh, dx: 0, dy: 0 };
  }

  function outputType(file) {
    if (settings.format === "original") {
      return ["image/png", "image/jpeg", "image/webp"].includes(file.type) ? file.type : "image/png";
    }
    return settings.format;
  }

  function effectiveBg(type) {
    if (settings.bg === "color") return settings.bgColor;
    if (type === "image/jpeg") return "#ffffff";   // JPEG can't be transparent
    return null;                                    // keep transparent
  }

  /* ── Processing ─────────────────────────────────────────── */
  let processToken = 0;
  let processTimer;
  function scheduleProcess() {
    clearTimeout(processTimer);
    processTimer = setTimeout(processAll, 220);
  }

  async function processAll() {
    const ready = items.filter((it) => it.ok);
    if (!ready.length) { renderResults([]); return; }
    const token = ++processToken;
    els.progressWrap.classList.add("show");
    els.processBtn.disabled = true;

    let done = 0;
    for (const it of ready) {
      if (token !== processToken) return;   // superseded by a newer run
      try {
        it.result = await renderOne(it);
      } catch (e) {
        it.result = null; it.error = "Encode failed";
      }
      done++;
      const pct = Math.round((done / ready.length) * 100);
      els.progressFill.style.width = pct + "%";
      els.progressLabel.textContent = `Processing ${done} / ${ready.length}`;
      // Yield so the progress bar paints between images.
      await new Promise((r) => setTimeout(r, 0));
    }
    if (token !== processToken) return;
    els.progressWrap.classList.remove("show");
    els.progressFill.style.width = "0%";
    els.processBtn.disabled = false;
    renderResults(ready);
  }

  function renderOne(it: ImageItem): Promise<ImageResult> {
    return new Promise<ImageResult>((resolve, reject) => {
      const t = computeTarget(it.w, it.h);
      const type = outputType(it.file);
      const canvas = document.createElement("canvas");
      canvas.width = t.cw; canvas.height = t.ch;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const bg = effectiveBg(type);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, t.cw, t.ch); }
      ctx.drawImage(it.img, t.dx, t.dy, t.dw, t.dh);

      const quality = (type === "image/jpeg" || type === "image/webp") ? settings.quality : undefined;
      const finish = (blob) => {
        if (!blob) { reject(new Error("toBlob null")); return; }
        if (it.result && it.result.url) URL.revokeObjectURL(it.result.url);
        resolve({
          blob, url: URL.createObjectURL(blob),
          w: t.cw, h: t.ch, size: blob.size, type,
          name: outName(it.name, type, t.cw, t.ch),
        });
      };
      if (canvas.toBlob) canvas.toBlob(finish, type, quality);
      else {
        // Fallback for very old engines.
        try {
          const data = canvas.toDataURL(type, quality);
          const bin = atob(data.split(",")[1]);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          finish(new Blob([arr], { type }));
        } catch (e) { reject(e); }
      }
    });
  }

  function outName(name, type, w, h) {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const suffix = settings.suffix || "";
    const dims = settings.appendDims ? `_${w}x${h}` : "";
    return `${base}${suffix}${dims}.${extFor(type)}`;
  }

  /* ── Results render ─────────────────────────────────────── */
  function renderResults(ready) {
    const done = ready.filter((it) => it.result);
    const has = done.length > 0;
    els.resultsEmpty.style.display = has ? "none" : "";
    els.resultsBar.hidden = !has;
    els.downloadAllBtn.disabled = !has;
    els.outputSub.textContent = has ? `${done.length} ready` : "No run yet";

    if (has) {
      const srcTotal = done.reduce((a, it) => a + it.file.size, 0);
      const outTotal = done.reduce((a, it) => a + it.result.size, 0);
      const delta = srcTotal ? Math.round((1 - outTotal / srcTotal) * 100) : 0;
      const deltaTxt = delta >= 0 ? `−${delta}%` : `+${-delta}%`;
      els.resultsStats.innerHTML =
        `<span class="badge ok"><b>${done.length}</b> images</span>` +
        `<span class="badge">source <b>${fmtBytes(srcTotal)}</b></span>` +
        `<span class="badge">output <b>${fmtBytes(outTotal)}</b></span>` +
        `<span class="badge">${deltaTxt} total</span>`;
    }

    els.resultsGrid.innerHTML = done.map((it) => {
      const r = it.result;
      const sizeDelta = it.file.size ? Math.round((1 - r.size / it.file.size) * 100) : 0;
      const deltaCls = sizeDelta >= 0 ? "save-down" : "save-up";
      const deltaTxt = sizeDelta >= 0 ? `${sizeDelta}% smaller` : `${-sizeDelta}% larger`;
      const resized = (r.w !== it.w || r.h !== it.h);
      return `<div class="result-card">
        <div class="result-preview"><img src="${esc(r.url)}" alt="${esc(r.name)}"></div>
        <div class="result-info">
          <div class="r-name" title="${esc(r.name)}">${esc(r.name)}</div>
          <div class="r-stats">
            ${it.w} × ${it.h} ${resized ? `<span class="arrow">→</span> ${r.w} × ${r.h}` : `<span class="dim">(unchanged)</span>`}<br>
            ${labelFor(r.type)} · ${fmtBytes(r.size)} <span class="${deltaCls}">(${deltaTxt})</span>
          </div>
          <button class="btn btn-sm" data-dl="${it.id}">Download</button>
        </div>
      </div>`;
    }).join("");
  }

  function download(it) {
    if (!it || !it.result) return;
    const a = document.createElement("a");
    a.href = it.result.url;
    a.download = it.result.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadAll() {
    const done = items.filter((it) => it.result);
    if (!done.length) return;
    for (const it of done) {
      download(it);
      await new Promise((r) => setTimeout(r, 220)); // stagger so browsers don't drop saves
    }
    toast(`Downloading ${done.length} image${done.length === 1 ? "" : "s"}…`);
  }

  /* ── Settings wiring ────────────────────────────────────── */
  function segmented(id, key, onChange) {
    const root = $(id);
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-val]");
      if (!btn) return;
      root.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
      settings[key] = btn.dataset.val;
      if (onChange) onChange(btn.dataset.val);
      scheduleProcess();
    });
  }

  function showResizePanels(mode) {
    document.querySelectorAll<HTMLElement>("[data-rz]").forEach((el) => { el.hidden = el.dataset.rz !== mode; });
  }
  function showBgPanels(mode) {
    document.querySelectorAll<HTMLElement>("[data-bg]").forEach((el) => { el.hidden = el.dataset.bg !== mode; });
    updateJpegNote();
  }
  function showFmtPanels(fmt) {
    const q = document.querySelector<HTMLElement>('[data-fmt="quality"]');
    if (q) q.hidden = !(fmt === "image/jpeg" || fmt === "image/webp");
    updateJpegNote();
  }
  function updateJpegNote() {
    const note = $("bgJpegNote");
    const jpeg = settings.format === "image/jpeg" ||
      (settings.format === "original" && items.some((it) => it.ok && it.file.type === "image/jpeg"));
    note.hidden = !(jpeg && settings.bg === "transparent");
  }

  function syncSwatch() {
    $("swatchFill").style.background = settings.bgColor;
  }

  function initSettings() {
    segmented("resizeMode", "resize", showResizePanels);
    segmented("bgMode", "bg", showBgPanels);
    segmented("fmtMode", "format", showFmtPanels);

    $("pctRange").addEventListener("input", (e) => {
      settings.percent = +e.target.value; $("pctVal").textContent = e.target.value; scheduleProcess();
    });
    const numBind = (id, key) => $(id).addEventListener("input", (e) => {
      settings[key] = e.target.value === "" ? 0 : Math.max(0, Math.round(+e.target.value || 0));
      scheduleProcess();
    });
    numBind("fitW", "fitW"); numBind("fitH", "fitH");
    numBind("exW", "exW"); numBind("exH", "exH");
    $("fitNoUp").addEventListener("change", (e) => { settings.fitNoUp = e.target.checked; scheduleProcess(); });
    $("exFit").addEventListener("change", (e) => { settings.exFit = e.target.value; scheduleProcess(); });

    $("qRange").addEventListener("input", (e) => {
      settings.quality = (+e.target.value) / 100; $("qVal").textContent = e.target.value; scheduleProcess();
    });
    $("suffix").addEventListener("input", (e) => { settings.suffix = e.target.value; scheduleProcess(); });
    $("appendDims").addEventListener("change", (e) => { settings.appendDims = e.target.checked; scheduleProcess(); });

    // Color picker ↔ hex text two-way bind
    const color = $("bgColor"), hex = $("bgHex");
    const setColor = (v) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
      settings.bgColor = v.toLowerCase();
      color.value = settings.bgColor; hex.value = settings.bgColor;
      syncSwatch(); scheduleProcess();
    };
    color.addEventListener("input", (e) => setColor(e.target.value));
    hex.addEventListener("change", (e) => setColor(e.target.value.trim()));

    // Preset swatches
    $("presetSwatches").innerHTML = PRESET_COLORS.map((c) =>
      `<button type="button" data-color="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join("");
    $("presetSwatches").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-color]"); if (!b) return;
      setColor(b.dataset.color);
    });

    syncSwatch();
  }

  /* ── Sticky offset — pin the settings bar just below the header ── */
  function measureHeader() {
    const header = document.querySelector<HTMLElement>(".header");
    if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }

  /* ── Theme ──────────────────────────────────────────────── */
  function applyTheme(next) {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("cloonk-theme", next); } catch (e) {}
  }
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition === "function" && !reduce) {
      document.startViewTransition(() => applyTheme(next));
    } else applyTheme(next);
  }
  window.addEventListener("storage", (e) => {
    if (e.key === "cloonk-theme") applyTheme(e.newValue === "light" ? "light" : "dark");
  });

  /* ── Info modal ─────────────────────────────────────────── */
  function initInfoModal() {
    const overlay = $("infoModal");
    const close = () => overlay.classList.remove("open");
    const activate = (key) => {
      document.querySelectorAll(".info-modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === key));
      document.querySelectorAll(".info-modal-pane").forEach((p) => p.classList.toggle("active", p.id === "modal-tab-" + key));
    };
    $("infoBtn").addEventListener("click", () => overlay.classList.add("open"));
    overlay.querySelector("[data-close-modal]").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    document.querySelectorAll(".info-modal-tab").forEach((tab) =>
      tab.addEventListener("click", () => activate(tab.dataset.tab)));
  }

  /* ── Wiring ─────────────────────────────────────────────── */
  function init() {
    // Intake
    els.fileInput.addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
    const pick = () => els.fileInput.click();
    $("addBtn").addEventListener("click", pick);
    $("addBtn2").addEventListener("click", pick);
    els.clearBtn.addEventListener("click", clearAll);

    // Dropzone (whole window accepts drops too)
    ["dragenter", "dragover"].forEach((ev) =>
      els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.add("dragging"); }));
    ["dragleave", "dragend", "drop"].forEach((ev) =>
      els.dropzone.addEventListener(ev, () => els.dropzone.classList.remove("dragging")));
    els.dropzone.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => {
      if (e.target.closest(".dropzone")) return; // handled above
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });

    // Queue + results delegation
    els.queue.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove]");
      if (rm) removeItem(+rm.dataset.remove);
    });
    els.resultsGrid.addEventListener("click", (e) => {
      const dl = e.target.closest("[data-dl]");
      if (dl) download(items.find((it) => it.id === +dl.dataset.dl));
    });
    els.processBtn.addEventListener("click", () => { clearTimeout(processTimer); processAll(); });
    els.downloadAllBtn.addEventListener("click", downloadAll);

    $("themeToggle").addEventListener("click", toggleTheme);

    initSettings();
    initInfoModal();
    measureHeader();
    window.addEventListener("resize", measureHeader);
    renderQueue();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
