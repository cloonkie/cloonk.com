/* ============================================================================
   fashion-nav.js — shared mobile hamburger for the fashion tool headers.
   Toggles `body.nav-open`; per-page CSS turns `.header-actions` into a
   dropdown on small screens. Requires:
     - a burger button with id="navBurger"
     - the actions container with id="headerActions"
   ========================================================================== */
(function () {
  'use strict';
  function init() {
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
    // selecting any action closes the menu
    if (actions) actions.addEventListener('click', function (e) {
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
