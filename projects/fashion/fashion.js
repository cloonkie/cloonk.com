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
      file: "replenishment-linesheet.html",
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
      file: "assortment-comparison.html",
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
      file: "retailer-door-tracker.html",
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
      file: "sellout-standardizer.html",
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
      file: "selling-analysis.html",
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
      file: "upc-concat.html",
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
    list.innerHTML = TOOLS.map((t, i) => `
      <a class="file" href="${esc(t.file)}" data-cursor="open" style="--i:${i}; --tab-x:${TAB_X[i % TAB_X.length]};">
        <span class="file__tab file__tab--code">${esc(t.code)}</span>
        <span class="file__tab file__tab--category">${esc(t.category || "WORKFLOW")}</span>
        <span class="file__top">
          <span class="file__chapter">${esc(t.chapter || t.sub)}</span>
          <span class="file__status">${esc(t.status)}</span>
        </span>
        <span class="file__name">${esc(t.name)}<span class="file__sub">${esc(t.sub)}</span></span>
        <span class="file__purpose">${esc(t.purpose)}</span>
        <span class="file__foot">
          <span class="file__io"><span>Source</span><b>${esc(t.eats)}</b><span>Output</span><b>${esc(t.outputs)}</b></span>
          <span class="file__open">Withdraw record <span aria-hidden="true">&rarr;</span></span>
        </span>
      </a>`).join("");
  }

  function wireHorizontalRail() {
    const rail = document.getElementById("files");
    if (!rail) return;

    rail.setAttribute("tabindex", "0");

    function moveRail(event) {
      const verticalIntent = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
      if (!verticalIntent || event.deltaY === 0) return;

      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 0) return;

      const next = Math.max(0, Math.min(maxScroll, rail.scrollLeft + event.deltaY));
      if (next === rail.scrollLeft) return;

      event.preventDefault();
      rail.scrollLeft = next;
    }

    window.addEventListener("wheel", moveRail, { passive: false });

    rail.addEventListener("keydown", (event) => {
      const card = rail.querySelector(".file");
      const step = card ? card.getBoundingClientRect().width + 24 : 360;
      const keys = {
        ArrowDown: step,
        ArrowRight: step,
        PageDown: rail.clientWidth * 0.88,
        ArrowUp: -step,
        ArrowLeft: -step,
        PageUp: rail.clientWidth * -0.88,
        Home: -rail.scrollWidth,
        End: rail.scrollWidth,
      };
      if (!(event.key in keys)) return;
      event.preventDefault();
      rail.scrollBy({ left: keys[event.key], behavior: "smooth" });
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
    wireHorizontalRail();
    wireThemeTransition();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
