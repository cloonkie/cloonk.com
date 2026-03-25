/* scroll-carousel.js
   5-slot nav carousel:  Work · Resume · Info · Contact · Archive
   - Cards arranged on a cylinder (72° apart for 5 slots)
   - Wheel / drag rotates the ring horizontally
   - Mouse Y tilts ring (pitch)
   - The card at 180° (slot 2 or 3 depending on rotation) shows
     a mirrored version — backface-visibility:visible + scaleX(-1)
   - Images: drop webp into images/ folder, update src below
   - Aspect-ratio flexible: images use object-fit:cover
*/
(function () {

  /* ── Nav destination cards ─────────────────────────────── */
  const CARDS = [
    {
      label:    'Work',
      sub:      'Selected projects',
      href:     'projects.html',
      img:      'images/nav-work.webp',
      fallback: '#1a1a18',
    },
    {
      label:    'Resume',
      sub:      'Experience & education',
      href:     'resume.html',
      img:      'images/nav-resume.webp',
      fallback: '#0d0d0b',
    },
    {
      label:    'Info',
      sub:      'About Kevin',
      href:     'info.html',
      img:      'images/nav-info.webp',
      fallback: '#141412',
    },
    {
      label:    'Contact',
      sub:      'Get in touch',
      href:     'contact.html',
      img:      'images/nav-contact.webp',
      fallback: '#1a1a18',
    },
    {
      label:    'Archive',
      sub:      'Image dump',
      href:     'projects.html',
      img:      'images/nav-archive.webp',
      fallback: '#0d0d0b',
    },
  ];

  const N      = CARDS.length;   /* 5 */
  const STEP   = 360 / N;        /* 72° */
  const RADIUS = 480;
  const PERSP  = 1400;

  const ring  = document.getElementById('scroll-carousel-ring');
  const label = document.getElementById('scroll-carousel-label');
  const wrap  = document.getElementById('scroll-carousel-wrap');

  if (!ring) return;

  /* ── Build cards ── */
  CARDS.forEach((card, i) => {
    const rotY    = i * STEP;
    /* The "back" card — whichever faces 180° away from the viewer.
       For 5 cards at 72° each, slot 2 (144°) and slot 3 (216°) are
       furthest back. We make BOTH show mirrored to match the etienne
       effect where any card going around the back appears flipped.      */
    const isBack = (rotY >= 108 && rotY <= 252);

    const el = document.createElement('div');
    el.className = 'sc-card' + (isBack ? ' sc-card--mirror' : '');
    el.dataset.index = i;

    /* backface-visibility: mirror cards must stay visible */
    el.style.backfaceVisibility       = isBack ? 'hidden' : 'visible';
    el.style.webkitBackfaceVisibility = isBack ? 'hidden' : 'visible';
    el.style.transform = `rotateY(${rotY}deg) translateZ(${RADIUS}px)`;

    /* Mirror: flip the entire card face */
    const innerScale = isBack ? 'transform:scaleX(-1);' : '';

    el.innerHTML = `
      <a href="${card.href}" class="sc-card__link" draggable="false"
         style="${innerScale}">
        <img class="sc-card__img"
             src="${card.img}"
             alt="${card.label}"
             onerror="this.style.display='none';this.parentElement.querySelector('.sc-card__bg').style.display='block'" />
        <div class="sc-card__bg" style="display:none;width:100%;height:76%;background:${card.fallback};"></div>
        <div class="sc-card__body">
          <p class="sc-card__title">${card.label}</p>
          <p class="sc-card__sub">${card.sub}</p>
        </div>
      </a>`;

    ring.appendChild(el);
  });

  /* ── State ── */
  let targetAngle  = 0;
  let currentAngle = 0;
  let targetPitch  = 0;
  let currentPitch = 0;
  let lastActive   = -1;

  /* ── Wheel — both axes ── */
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    targetAngle += delta * 0.18;
  }, { passive: false });

  /* ── Touch swipe ── */
  let touchStartX = 0, touchStartAngle = 0;
  wrap.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartAngle = targetAngle;
  }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - touchStartX;
    targetAngle = touchStartAngle - dx * 0.4;
    e.preventDefault();
  }, { passive: false });

  /* ── Mouse drag ── */
  let mouseDown = false, mouseStartX = 0, mouseStartAngle = 0;
  wrap.addEventListener('mousedown', (e) => {
    mouseDown = true;
    mouseStartX = e.clientX;
    mouseStartAngle = targetAngle;
    wrap.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    targetAngle = mouseStartAngle - (e.clientX - mouseStartX) * 0.4;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
    wrap.style.cursor = 'grab';
  });

  /* ── Mouse Y → pitch ── */
  document.addEventListener('mousemove', (e) => {
    targetPitch = ((e.clientY - window.innerHeight / 2) / (window.innerHeight / 2)) * 10;
  }, { passive: true });

  /* ── Active card label ── */
  function updateLabel(angle) {
    const norm = (((-angle) % 360) + 360) % 360;
    const idx  = Math.round(norm / STEP) % N;
    if (idx !== lastActive) {
      lastActive = idx;
      if (label) label.textContent = CARDS[idx].label;
    }
  }

  /* ── Render loop ── */
  function lerp(a, b, t) { return a + (b - a) * t; }

  (function tick() {
    currentAngle = lerp(currentAngle, targetAngle, 0.07);
    currentPitch = lerp(currentPitch, targetPitch, 0.1);
    ring.style.transform = `rotateX(${-currentPitch}deg) rotateY(${currentAngle}deg)`;
    updateLabel(currentAngle);
    requestAnimationFrame(tick);
  })();

  if (label) label.textContent = CARDS[0].label;
  wrap.style.cursor = 'grab';

})();
