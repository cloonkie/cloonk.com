/* ============================================================
   projects/fashion — shared behavior
   - TOOLS: the single manifest every fashion surface reads from
     (the cabinet here; the sibling popover inside each tool once
     they are retrofitted).
   - Renders the cabinet's files and wires the spring-open drawer.
   - fashionToast(): shared toast, used by the tools post-retrofit.
   Theme stays on the cloonk nav.js / `cloonk-theme` key — not
   duplicated here.
   ============================================================ */
(function () {
  "use strict";

  /* ── The manifest ──────────────────────────────────────────
     Add a tool = add an entry. The cabinet rebuilds from this. */
  const TOOLS = [
    {
      file: "replenishment-linesheet.html",
      code: "RP-01",
      name: "RP Line Sheet",
      sub: "Replenishment Review",
      purpose:
        "Load a replenishment line sheet, filter and search the assortment, " +
        "annotate SKUs, attach product photos, and export just the styles you keep.",
      eats: ".xlsx",
      outputs: ".xlsx",
      status: "Ready",
    },
    {
      file: "assortment-comparison.html",
      code: "AC-02",
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
      code: "DT-03",
      name: "Door Tracker",
      sub: "DS Distribution",
      purpose:
        "Track brand × retailer door distribution. Manage per-door assignments and " +
        "drafts, browse stores on a live map, and review change history with restore points.",
      eats: ".xlsx / .csv / .json",
      outputs: ".xlsx / .json",
      status: "Ready",
    },
    {
      file: "sellout-standardizer.html",
      code: "SO-04",
      name: "Sell-Out Standardizer",
      sub: "Weekly Analytics",
      purpose:
        "Normalize weekly sell-out reports into one analytics-ready format. " +
        "Flatten WTD, MTD, YTD headers, map dimensions, preview, and export saved configs.",
      eats: ".xlsx / .csv / paste",
      outputs: ".xlsx / .csv / .json",
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
      <li>
        <a class="file" href="${esc(t.file)}" data-cursor="open" style="--i:${i}; --tab-x:${TAB_X[i % TAB_X.length]};">
          <span class="file__tab">${esc(t.code)}</span>
          <span class="file__top">
            <span class="file__name">${esc(t.name)}<span class="file__sub">${esc(t.sub)}</span></span>
            <span class="file__status">${esc(t.status)}</span>
          </span>
          <span class="file__purpose">${esc(t.purpose)}</span>
          <span class="file__foot">
            <span class="file__io"><b>${esc(t.eats)}</b><span class="arrow">&rarr;</span><b>${esc(t.outputs)}</b></span>
            <span class="file__open">Open file <span aria-hidden="true">&rarr;</span></span>
          </span>
        </a>
      </li>`).join("");
  }

  function wireCabinet() {
    const cabinet = document.getElementById("cabinet");
    const face = document.getElementById("cabinetFace");
    const hint = document.getElementById("cabinetHint");
    if (!cabinet || !face) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function setOpen(open) {
      cabinet.classList.toggle("is-open", open);
      cabinet.classList.toggle("is-closed", !open);
      face.setAttribute("aria-expanded", String(open));
      if (hint) hint.textContent = open ? "Close ↑" : "Pull to open ↓";
    }

    face.addEventListener("click", () =>
      setOpen(!cabinet.classList.contains("is-open"))
    );

    /* Auto-open so the tools are never hidden behind a click —
       a beat after load for the spring, or instantly if the
       visitor prefers reduced motion. */
    if (reduce) {
      setOpen(true);
    } else {
      setTimeout(() => setOpen(true), 560);
    }
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

  function init() {
    renderFiles();
    wireCabinet();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
