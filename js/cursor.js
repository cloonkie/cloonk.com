/* cursor.js — custom dot + pill cursor */
(function () {
  if (!window.matchMedia('(hover: hover)').matches) return;

  const dot   = document.createElement('div');
  const label = document.createElement('div');
  dot.className   = 'cursor-dot';
  label.className = 'cursor-label';
  document.body.appendChild(dot);
  document.body.appendChild(label);

  let mx = -100, my = -100;

  const HOVER_SEL = [
    '.nav__logo',
    'a[href]', 'button', '[role="button"]',
    '.wk-card', '.c3d-card', '.contact-sticker',
    '.contact-item', '.detail-gallery__item',
    '.detail-nav__link', '.nav-card',
    '.filter-btn', '.page-btn', '.tab-btn',
    '.detail-section-header',
    '.detail-artifact-select',
  ].join(', ');

  function getLabelText(el) {
    if (el.dataset.cursor) return el.dataset.cursor;

    /* Section header: expand / collapse */
    if (el.closest('.detail-section-header')) {
      var block = el.closest('.detail-section-block');
      return (block && block.classList.contains('is-open')) ? 'collapse' : 'expand';
    }

    /* Format switcher dropdown */
    if (el.classList.contains('detail-artifact-select') || el.closest('.detail-artifact-select')) return 'switch';

    /* External artifact link + PDF download */
    if (el.classList.contains('detail-artifact-extlink') || el.closest('.detail-artifact-extlink')) return 'open';
    if (el.classList.contains('detail-pdf-download') || el.closest('.detail-pdf-download')) return 'open';

    if (el.classList.contains('nav__logo') || el.closest('.nav__logo')) return 'home';
    const href = el.getAttribute('href') || '';
    if (href.startsWith('http') && !href.includes('cloonk.com')) return 'visit';
    if (el.classList.contains('filter-btn') || el.classList.contains('tab-btn') || el.classList.contains('page-btn')) return 'select';
    if (el.id === 'nav-theme-toggle') return 'switch';
    if (el.classList.contains('detail-back') || el.classList.contains('detail-nav__link')) return 'go';
    if (el.closest('.wk-card') || el.closest('.c3d-card') || el.closest('.nav-card')) return 'view';
    if (el.closest('.detail-gallery__item')) return 'expand';
    if (href.includes('.pdf') || el.classList.contains('resume-download')) return 'open';
    if (el.closest('.contact-sticker')) return 'reach';
    return 'view';
  }

  document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

  (function tick() {
    dot.style.transform   = `translate(calc(${mx}px - 50%), calc(${my}px - 50%))`;
    label.style.transform = `translate(calc(${mx}px - 50%), calc(${my}px - 50%))`;
    requestAnimationFrame(tick);
  })();

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest(HOVER_SEL);
    if (el) { label.textContent = getLabelText(el); document.body.classList.add('cursor-hover'); }
  }, { passive: true });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(HOVER_SEL)) document.body.classList.remove('cursor-hover');
  }, { passive: true });

  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = ''; });
})();