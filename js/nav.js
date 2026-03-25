/* nav.js — shared across all cloonk.com pages */

(function () {
  /* ── Theme Toggle ── */
  const STORAGE_KEY = 'cloonk-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  /* Apply saved theme immediately (anti-flash already ran inline,
     but we still need to set it for the toggle state) */
  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');

  /* Wire toggle — runs at script parse time, after the DOM node exists */
  function wireToggle() {
    const toggle = document.getElementById('nav-theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'light' ? 'dark' : 'light');
    });
  }

  /* If DOM already ready (script at bottom of body), wire now.
     Otherwise wait for DOMContentLoaded. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireToggle);
  } else {
    wireToggle();
  }

  /* ── Live clock ── */
  function updateClock() {
    const el = document.getElementById('nav-clock');
    if (!el) return;
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = `${h}:${m}:${s} ${ampm}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  /* ── Active nav link ── */
  const path = window.location.pathname.replace(/\/$/, '') || '/index';
  document.querySelectorAll('.nav__links a, .nav__mobile-menu a').forEach(a => {
    const href = a.getAttribute('href').replace(/\/$/, '') || '/index';
    if (path.endsWith(href) || (href === '/index' && (path === '' || path === '/'))) {
      a.classList.add('active');
    }
  });

  /* ── Hamburger ── */
  const burger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const open = burger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        burger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }
})();
