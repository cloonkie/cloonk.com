/* contact-drag.js — draggable contact stickers, no jump */
(function () {
  if (!window.matchMedia('(hover: hover)').matches) return;

  const canvas   = document.getElementById('contact-canvas');
  const stickers = document.querySelectorAll('.contact-sticker');
  if (!stickers.length || !canvas) return;

  /* Convert % positions to px on first interaction */
  function initPx(sticker) {
    if (sticker.dataset.pxInit) return;
    const r = sticker.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    sticker.style.left = (r.left - cr.left) + 'px';
    sticker.style.top  = (r.top  - cr.top)  + 'px';
    sticker.dataset.pxInit = '1';
  }

  stickers.forEach(sticker => {
    let startX, startY, startLeft, startTop, dragDist, isDragging;
    const THRESHOLD = 6;

    sticker.addEventListener('mousedown', (e) => {
      e.preventDefault();
      initPx(sticker);

      startX    = e.clientX;
      startY    = e.clientY;
      startLeft = parseFloat(sticker.style.left);
      startTop  = parseFloat(sticker.style.top);
      dragDist  = 0;
      isDragging = false;

      document.querySelectorAll('.contact-sticker').forEach(s => s.style.zIndex = 1);
      sticker.style.zIndex = 10;

      function onMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        dragDist = Math.sqrt(dx*dx + dy*dy);
        if (dragDist > THRESHOLD) {
          isDragging = true;
          sticker.classList.add('is-dragging');
          sticker.style.left = (startLeft + dx) + 'px';
          sticker.style.top  = (startTop  + dy) + 'px';
        }
      }

      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        sticker.classList.remove('is-dragging');
        if (dragDist <= THRESHOLD) {
          const href = sticker.dataset.href;
          if (href) {
            if (href.startsWith('mailto')) window.location.href = href;
            else window.open(href, '_blank', 'noopener');
          }
        }
        isDragging = false;
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    /* Touch */
    sticker.addEventListener('touchstart', (e) => {
      initPx(sticker);
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      startLeft = parseFloat(sticker.style.left);
      startTop  = parseFloat(sticker.style.top);
      dragDist = 0; isDragging = false;
      sticker.style.zIndex = 10;
    }, { passive: true });

    sticker.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      dragDist = Math.sqrt(dx*dx + dy*dy);
      if (dragDist > THRESHOLD) {
        isDragging = true;
        sticker.classList.add('is-dragging');
        sticker.style.left = (startLeft + dx) + 'px';
        sticker.style.top  = (startTop  + dy) + 'px';
        e.preventDefault();
      }
    }, { passive: false });

    sticker.addEventListener('touchend', () => {
      sticker.classList.remove('is-dragging');
      if (dragDist <= THRESHOLD) {
        const href = sticker.dataset.href;
        if (href) window.location.href = href;
      }
      isDragging = false;
    });
  });
})();
