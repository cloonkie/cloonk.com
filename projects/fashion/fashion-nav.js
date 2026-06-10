/* ============================================================================
   fashion-nav.js — shared mobile hamburger for the fashion tool headers.
   Toggles `body.nav-open`; per-page CSS turns `.header-actions` into a
   dropdown on small screens. Requires:
     - a burger button with id="navBurger"
     - the actions container with id="headerActions"
   Also collapses the page's `.toolbar` behind a "Tools & filters" pill on
   mobile (styles live in fashion.css under .toolbar-collapse-toggle).
   ========================================================================== */
(function () {
  'use strict';

  /* On mobile the toolbar rows (view tabs, filters, mode switches) are the
     bulk of the header clutter — fold them behind a single disclosure pill.
     Desktop is untouched: the pill is display:none above the breakpoint and
     the toolbar only hides when body.has-toolbar-collapse is set here. */
  function initToolbarCollapse() {
    var toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toolbar-collapse-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span>Tools &amp; filters</span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
    toolbar.parentNode.insertBefore(btn, toolbar);
    document.body.classList.add('has-toolbar-collapse');

    btn.addEventListener('click', function () {
      var open = toolbar.classList.toggle('is-open');
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });

    // Some tools keep the toolbar hidden until data loads (inline
    // display:none on the line sheet, a stylesheet default on assortment
    // comparison) — mirror that state on the pill so it never promises a
    // toolbar that can't show. Measured with the marker class lifted so
    // none of our collapse/panel rules (both !important) color the probe:
    // what's left is the page's own inline + stylesheet verdict.
    function syncVisibility() {
      document.body.classList.remove('has-toolbar-collapse');
      var available = getComputedStyle(toolbar).display !== 'none';
      document.body.classList.add('has-toolbar-collapse');
      btn.style.display = available ? '' : 'none';
    }
    syncVisibility();
    if (window.MutationObserver) {
      new MutationObserver(syncVisibility)
        .observe(toolbar, { attributes: true, attributeFilter: ['style'] });
    }
  }

  function init() {
    initToolbarCollapse();
    var burger = document.getElementById('navBurger');
    if (!burger) return;
    var actions = document.getElementById('headerActions');
    function close() {
      document.body.classList.remove('nav-open');
      burger.setAttribute('aria-expanded', 'false');
    }
    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    // selecting any action closes the menu — except submenu triggers
    // (Configuration / Data style dropdowns) and <summary> toggles, which
    // open inside the panel and need it to stay up
    if (actions) actions.addEventListener('click', function (e) {
      if (e.target.closest('[aria-haspopup], summary')) return;
      if (e.target.closest('button, a')) close();
    });
    // click outside or Escape closes
    document.addEventListener('click', function (e) {
      if (document.body.classList.contains('nav-open') &&
          !e.target.closest('#headerActions') && !e.target.closest('#navBurger')) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
