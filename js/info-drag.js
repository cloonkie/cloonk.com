/* info-drag.js — draggable polaroid on info page, no effects */
(function () {
  const img = document.querySelector('.info-hero');
  const col = document.querySelector('.info-photo-col');
  if (!img || !col) return;

  /* Centre the image in the column on load / resize */
  function centre() {
    const cw = col.offsetWidth;
    const ch = col.offsetHeight;
    const iw = img.offsetWidth;
    const ih = img.offsetHeight;
    img.style.left = Math.round((cw - iw) / 2) + 'px';
    img.style.top  = Math.round((ch - ih) / 2) + 'px';
  }

  /* Wait for image to load so we have real dimensions */
  if (img.complete) { centre(); }
  else { img.addEventListener('load', centre); }
  window.addEventListener('resize', centre);

  /* Drag */
  let dragging = false, ox = 0, oy = 0;

  img.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    ox = e.clientX - img.offsetLeft;
    oy = e.clientY - img.offsetTop;
    img.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    img.style.left = (e.clientX - ox) + 'px';
    img.style.top  = (e.clientY - oy) + 'px';
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    img.classList.remove('dragging');
  });

  /* Touch */
  img.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    ox = t.clientX - img.offsetLeft;
    oy = t.clientY - img.offsetTop;
  }, { passive: true });

  img.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    img.style.left = (t.clientX - ox) + 'px';
    img.style.top  = (t.clientY - oy) + 'px';
    e.preventDefault();
  }, { passive: false });
})();
