/* cursor.js — custom dot + pill cursor */
(function () {
  /* Bail only on primarily-touch devices. (hover: hover) was too strict — on
     hybrid laptops with both mouse + touchscreen, that media query sometimes
     reports false even when a mouse is in use, killing the custom cursor. */
  if (window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(any-pointer: fine)').matches) return;

  const dot   = document.createElement('div');
  const label = document.createElement('div');
  const pen   = document.createElement('div');
  dot.className   = 'cursor-dot';
  label.className = 'cursor-label';
  pen.className   = 'cursor-pen-icon';
  pen.innerHTML   = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
  document.body.appendChild(dot);
  document.body.appendChild(label);
  document.body.appendChild(pen);

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
    '[data-cursor-toggle]',
    '.toggle-pill',
    /* Fashion toolbox: line-sheet SKU cards are selectable. */
    '.card[data-id]',
  ].join(', ');

  /* Pen-mode targets: editable note areas. */
  const PEN_SEL = '.card-notes, textarea[data-cursor="pen"], [data-cursor="pen"]';
  const CONTRAST_SEL = [
    '[data-cursor-contrast]',
    '.fashion-decision',
    '.fashion-decision-backdrop',
    '.btn-accent',
  ].join(', ');

  function updateCursorContrast(target) {
    const el = target && target.closest ? target : document.elementFromPoint(mx, my);
    document.body.classList.toggle('cursor-contrast', !!(el && el.closest(CONTRAST_SEL)));
  }

  function syncCursorState(target) {
    const el = target && target.closest ? target : document.elementFromPoint(mx, my);
    updateCursorContrast(el);

    if (el && el.closest(PEN_SEL)) {
      document.body.classList.add('cursor-pen');
      document.body.classList.remove('cursor-hover');
      return;
    }
    document.body.classList.remove('cursor-pen');

    const hoverEl = el && el.closest(HOVER_SEL);
    if (!hoverEl) {
      document.body.classList.remove('cursor-hover');
      return;
    }

    const text = getLabelText(hoverEl);
    if (text === null) {
      document.body.classList.remove('cursor-hover');
      return;
    }
    label.textContent = text;
    document.body.classList.add('cursor-hover');
  }

  /* Returns the label text, or `null` to suppress the pill entirely
     (used for `data-cursor=""` opt-outs like Select All / Deselect All). */
  function getLabelText(el) {
    const toggle = el.closest('[data-cursor-toggle]');
    if (toggle) return toggle.getAttribute('aria-pressed') === 'true' ? 'off' : 'on';

    if ('cursor' in el.dataset) {
      const v = el.dataset.cursor;
      return v === '' ? null : v;
    }

    /* Selectable SKU cards — label reflects current state. */
    const card = el.closest('.card[data-id]');
    if (card) return card.classList.contains('selected') ? 'deselect' : 'select';

    /* Fashion tool chrome — applies across every page under /projects/fashion/. */
    if (el.classList.contains('theme-toggle') || el.closest('.theme-toggle')) return 'switch';
    if (el.classList.contains('info-btn') || el.closest('.info-btn')) return 'info';
    if ((el.classList.contains('logo') || el.closest('.logo')) && el.closest('header.header')) return 'home';
    if (el.classList.contains('mode-btn') || el.closest('.mode-btn')) return 'switch';
    if (el.classList.contains('view-tab') || el.closest('.view-tab')) return 'switch';
    if (el.classList.contains('menu-item') || el.closest('.menu-item')) return 'select';

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

  window.refreshCloonkCursorLabel = function (target) {
    if (document.body.classList.contains('cursor-pen')) return;
    const el = target && target.closest ? target.closest(HOVER_SEL) : document.elementFromPoint(mx, my)?.closest(HOVER_SEL);
    if (!el) return;
    const text = getLabelText(el);
    if (text === null) {
      document.body.classList.remove('cursor-hover');
      return;
    }
    label.textContent = text;
    document.body.classList.add('cursor-hover');
  };

  window.refreshCloonkCursorState = function (target) {
    dot.style.opacity = '';
    syncCursorState(target);
  };

  document.addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.opacity = '';
    syncCursorState(e.target);
  }, { passive: true, capture: true });

  document.addEventListener('wheel', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.opacity = '';
    syncCursorState(e.target);
  }, { passive: true, capture: true });

  (function tick() {
    const t = `translate(calc(${mx}px - 50%), calc(${my}px - 50%))`;
    dot.style.transform   = t;
    label.style.transform = t;
    pen.style.transform   = t;
    requestAnimationFrame(tick);
  })();

  document.addEventListener('mouseover', (e) => {
    syncCursorState(e.target);
    /* Pen mode wins over hover-label — note textareas show the pen icon. */
    if (e.target.closest(PEN_SEL)) {
      document.body.classList.add('cursor-pen');
      document.body.classList.remove('cursor-hover');
      return;
    }
    const el = e.target.closest(HOVER_SEL);
    if (!el) return;
    const text = getLabelText(el);
    if (text === null) {
      /* Explicit data-cursor="" opt-out — keep the default dot, no label. */
      document.body.classList.remove('cursor-hover');
      return;
    }
    label.textContent = text;
    document.body.classList.add('cursor-hover');
  }, { passive: true });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(PEN_SEL)) document.body.classList.remove('cursor-pen');
    if (e.target.closest(HOVER_SEL)) document.body.classList.remove('cursor-hover');
    syncCursorState();
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    document.body.classList.remove('cursor-contrast');
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity = '';
    syncCursorState();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      dot.style.opacity = '';
      syncCursorState();
    }
  });

  /* Active click — collapse to the plain dot for the duration of the press.
     The pen + label are suppressed so a select/deselect click reads as a
     clean snap rather than a flickering label swap. Pointer events let one
     handler cover mouse + touch + pen. */
  document.addEventListener('pointerdown', () => {
    document.body.classList.add('cursor-clicking');
  }, { passive: true });
  const _endClick = () => document.body.classList.remove('cursor-clicking');
  document.addEventListener('pointerup', _endClick, { passive: true });
  document.addEventListener('pointercancel', _endClick, { passive: true });
})();
