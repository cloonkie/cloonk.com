/* ============================================================
   projects/fashion — shared behavior
   - TOOLS: the single manifest every fashion surface reads from
     (the archive here; the sibling popover inside each tool once
     they are retrofitted).
   - Renders the archive's file cards.
   - fashionToast(): shared toast, used by the tools post-retrofit.
   Theme stays on the cloonk nav.js / `cloonk-theme` key — not
   duplicated here.
   ============================================================ */
(function () {
  "use strict";

  /* ── The manifest ──────────────────────────────────────────
     Add a tool = add an entry. The archive rebuilds from this. */
  const TOOLS = [
    {
      file: "replenishment-linesheet/index.html",
      code: "DLS 001",
      category: "PRODUCT",
      chapter: "Product Review",
      name: "DIGI LINE SHEET",
      sub: "product review",
      purpose:
        "Load a replenishment line sheet, filter and search the assortment, " +
        "annotate SKUs, attach product photos, and export just the styles you keep.",
      eats: ".xlsx",
      outputs: ".xlsx",
      status: "Ready",
    },
    {
      file: "assortment-comparison/index.html",
      code: "AOR 002",
      category: "ANALYTICS",
      chapter: "Retailer Overlap",
      name: "Assortment Comparison",
      sub: "Retailer Overlap",
      purpose:
        "Compare retailer assortments by style, color, grid, brand, and units — " +
        "find the overlap and the gaps across books.",
      eats: ".xlsx / .csv",
      outputs: "live view",
      status: "Ready",
    },
    {
      file: "door-tracker/index.html",
      code: "DOOR 003",
      category: "DISTRIBUTION",
      chapter: "Door Distribution",
      name: "Door Tracker",
      sub: "Door Distribution",
      purpose:
        "Track brand × retailer door distribution. Manage per-door assignments and " +
        "drafts, browse stores on a live map, and review change history with restore points.",
      eats: ".xlsx / .csv / .json",
      outputs: ".xlsx / .json",
      status: "Ready",
    },
    {
      file: "sellout-standardizer/index.html",
      code: "STD 004",
      category: "OPERATIONS",
      chapter: "Report Normalization",
      name: "Retail Data Standardizer",
      sub: "Weekly Analytics",
      purpose:
        "Normalize weekly sell-out reports into one analytics-ready format. " +
        "Flatten WTD, MTD, YTD headers, map dimensions, preview, and export saved configurations.",
      eats: ".xlsx / .csv / paste",
      outputs: ".xlsx / .csv / .json",
      status: "Ready",
    },
    {
      file: "selling-analysis/index.html",
      code: "SAR 005",
      category: "ANALYTICS",
      chapter: "Selling Analysis",
      name: "Selling Analysis",
      sub: "Sell-Through Diagnostic",
      purpose:
        "Diagnose YTD sell-out workbooks across data integrity, liquidation risk, " +
        "velocity, momentum, promo dependence, and collection theme authoring.",
      eats: ".xlsx / .json",
      outputs: "live view / .json",
      status: "Ready",
    },
    {
      file: "upc-concat/index.html",
      code: "UPC 006",
      category: "OPERATIONS",
      chapter: "Schema Mapping",
      name: "UPC Concat",
      sub: "Schema Mapping",
      purpose:
        "Map product data across files into one canonical schema. Register sources, " +
        "define fields and formulas, join SKUs across files by identity, and resolve " +
        "concatenated descriptions.",
      eats: ".xlsx / .csv",
      outputs: ".xlsx / .csv / TSV",
      status: "Ready",
    },
    {
      file: "image-prep/index.html",
      code: "IMG 007",
      category: "ASSETS",
      chapter: "Image Production",
      name: "Image Prep",
      sub: "Resize · Recolor · Reformat",
      purpose:
        "Batch-resize images, set a background color behind transparency, and " +
        "reformat to PNG, JPEG, or WebP. Everything runs locally — nothing uploads.",
      eats: ".png / .jpg / .webp",
      outputs: ".png / .jpg / .webp",
      status: "Ready",
    },
  ];

  /* Tab offsets, so the folder tabs stagger across the drawer
     like a real hanging-file drawer. Cycles if more tools land. */
  const TAB_X = ["24px", "168px", "312px", "92px", "240px"];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));
  }

  function renderFiles() {
    const list = document.getElementById("files");
    if (!list) return;
    // Use-case diagrams are defined in the page (FASHION_VIZ), keyed by tool
    // file. The markup is authored by us, so it is injected as trusted HTML.
    const VIZ = (typeof window !== "undefined" && window.FASHION_VIZ) || {};
    list.innerHTML = TOOLS.map((t, i) => `
      <a class="file" href="${esc(t.file)}" data-cursor="open" style="--i:${i}; --tab-x:${TAB_X[i % TAB_X.length]};">
        <span class="file__tab file__tab--code">${esc(t.code)}</span>
        <span class="file__tab file__tab--category">${esc(t.category || "WORKFLOW")}</span>
        <span class="file__top">
          <span class="file__status">${esc(t.status)}</span>
        </span>
        <span class="file__name">${esc(t.name)}<span class="file__sub">${esc(t.sub)}</span></span>
        ${VIZ[t.file] ? `<span class="file__viz" aria-hidden="true">${VIZ[t.file]}</span>` : ""}
        <span class="file__purpose">${esc(t.purpose)}</span>
        <span class="file__foot">
          <span class="file__io"><span>Source</span><b>${esc(t.eats)}</b><span>Output</span><b>${esc(t.outputs)}</b></span>
          <span class="file__open">Withdraw record <span aria-hidden="true">&rarr;</span></span>
        </span>
      </a>`).join("");
  }

  /* Scroll-in reveal — each card animates in as it scrolls into the rail's
     view. The rail is the IntersectionObserver root, so it tracks horizontal
     scroll. Cards already in view on load reveal together (staggered); cards
     scrolled to later reveal as they arrive. Falls back to plain (visible)
     cards when IO is unavailable or motion is reduced. */
  function wireCardReveal() {
    const rail = document.getElementById("files");
    if (!rail) return;

    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;

    rail.classList.add("is-reveal");

    const io = new IntersectionObserver(
      (entries, obs) => {
        // Stagger whatever crossed into view in this tick (left-to-right).
        entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((entry, i) => {
            entry.target.style.animationDelay = i * 70 + "ms";
            entry.target.classList.add("is-revealed");
            obs.unobserve(entry.target);
          });
      },
      { root: rail, threshold: 0.18 }
    );

    rail.querySelectorAll(".file").forEach((card) => io.observe(card));
  }

  function wireHorizontalRail() {
    const rail = document.getElementById("files");
    if (!rail) return;

    rail.setAttribute("tabindex", "0");

    const reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const maxScroll = () => rail.scrollWidth - rail.clientWidth;

    /* The scroll offsets where each card sits flush with the rail's left
       edge — the same stops scroll-snap-align: start produces. Measured
       from the rail's direct children (li wrappers on the cabinet variant,
       bare .file anchors on the index) so it holds for any card width,
       gap, or markup. */
    function snapStops() {
      const max = maxScroll();
      const railLeft = rail.getBoundingClientRect().left;
      const base = rail.scrollLeft;
      const stops = [...rail.children].map((card) =>
        Math.max(0, Math.min(max, base + card.getBoundingClientRect().left - railLeft))
      );
      return stops.length ? stops : [0];
    }

    function nearestStopIndex(stops, x) {
      let best = 0;
      for (let i = 1; i < stops.length; i++) {
        if (Math.abs(stops[i] - x) < Math.abs(stops[best] - x)) best = i;
      }
      return best;
    }

    /* One eased glide loop drives all rail movement: each input (wheel
       notch, trackpad delta, key) moves `target`; the loop eases scrollLeft
       toward it with a frame-rate-independent exponential curve, so rapid
       inputs compose into one continuous motion instead of restarting.
       CSS snapping is suspended (.is-wheeling) while gliding — we settle
       onto a card stop ourselves, so re-enabling it never causes a jump. */
    let target = 0;
    let pos = 0; // float mirror of scrollLeft — the browser rounds
    // scrollLeft to whole px, which would stall the ease tail otherwise
    let animFrame = 0;
    let lastTick = 0;
    let settleTimer = 0;

    function tick(now) {
      const diff = target - pos;
      if (Math.abs(diff) < 0.5) {
        pos = target;
        rail.scrollLeft = target;
        animFrame = 0;
        rail.classList.remove("is-wheeling");
        return;
      }
      const dt = lastTick ? Math.min(now - lastTick, 64) : 16.7;
      lastTick = now;
      pos += diff * (1 - Math.exp(-dt / 150));
      rail.scrollLeft = pos;
      animFrame = requestAnimationFrame(tick);
    }

    function glideTo(x) {
      target = Math.max(0, Math.min(maxScroll(), x));
      if (reduceMotion) {
        rail.scrollLeft = target;
        return;
      }
      if (!animFrame) {
        pos = rail.scrollLeft;
        lastTick = 0;
        animFrame = requestAnimationFrame(tick);
      }
      rail.classList.add("is-wheeling");
    }

    // If the rail moved without us (scrollbar drag, touch), re-anchor the
    // glide target to wherever it actually is before applying new input.
    function syncTarget() {
      if (!animFrame) target = rail.scrollLeft;
    }

    // Bind to the window so a scroll anywhere on the page drives the rail —
    // the page itself doesn't scroll (100vh, overflow hidden), so vertical
    // wheel intent is redirected to horizontal rail movement.
    window.addEventListener("wheel", (event) => {
      const verticalIntent = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
      if (!verticalIntent || event.deltaY === 0) return;
      if (maxScroll() <= 0) return;

      event.preventDefault();
      syncTarget();
      clearTimeout(settleTimer);

      // A discrete mouse-wheel notch (large pixel delta, or line/page delta
      // modes) glides to the next/previous card stop — a raw ~100px nudge
      // is under the card pitch, so the snap would pull the rail straight
      // back and the wheel would feel dead.
      if (event.deltaMode !== 0 || Math.abs(event.deltaY) >= 80) {
        const stops = snapStops();
        const idx = nearestStopIndex(stops, target);
        const next = Math.max(0, Math.min(stops.length - 1, idx + Math.sign(event.deltaY)));
        glideTo(stops[next]);
        return;
      }

      // Fine trackpad deltas: proportional glide, settling onto the nearest
      // card once the gesture goes idle.
      glideTo(target + event.deltaY);
      settleTimer = setTimeout(() => {
        const stops = snapStops();
        glideTo(stops[nearestStopIndex(stops, target)]);
      }, 160);
    }, { passive: false });

    // A scrollbar drag or touch takes over immediately — stop gliding.
    rail.addEventListener("pointerdown", () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = 0;
      clearTimeout(settleTimer);
      rail.classList.remove("is-wheeling");
    });

    rail.addEventListener("keydown", (event) => {
      syncTarget();
      const stops = snapStops();
      const idx = nearestStopIndex(stops, target);
      let to;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          to = stops[Math.min(stops.length - 1, idx + 1)];
          break;
        case "ArrowLeft":
        case "ArrowUp":
          to = stops[Math.max(0, idx - 1)];
          break;
        case "PageDown":
          to = target + rail.clientWidth * 0.88;
          break;
        case "PageUp":
          to = target - rail.clientWidth * 0.88;
          break;
        case "Home":
          to = 0;
          break;
        case "End":
          to = maxScroll();
          break;
        default:
          return;
      }
      event.preventDefault();
      clearTimeout(settleTimer);
      glideTo(to);
    });
  }

  /* Shared toast — exposed for the tools once retrofitted. */
  let toastEl, toastTimer;
  window.fashionToast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "fashion-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
  };

  window.FASHION_TOOLS = TOOLS;

  function smoothThemeChange() {
    const html = document.documentElement;
    html.classList.add("theme-transition");
    clearTimeout(smoothThemeChange.timer);
    smoothThemeChange.timer = setTimeout(() => html.classList.remove("theme-transition"), 320);
  }

  function wireThemeTransition() {
    const toggle = document.getElementById("nav-theme-toggle");
    if (toggle) toggle.addEventListener("click", smoothThemeChange, { capture: true });
    window.addEventListener("storage", e => {
      if (e.key !== "cloonk-theme") return;
      smoothThemeChange();
    });
  }

  function init() {
    renderFiles();
    wireCardReveal();
    wireHorizontalRail();
    wireThemeTransition();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
