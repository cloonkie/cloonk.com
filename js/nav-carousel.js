/* nav-carousel.js — 5-slot homepage navigation carousel */
(function () {

  const pages = [
    {
      label: 'Work',
      sub:   'Selected Projects',
      href:  'projects.html',
      color: 'var(--accent)',
      img:   'https://static.wixstatic.com/media/d8d224_a709b5ff95df43fcb52bb577cdd4ecb9~mv2.png',
    },
    {
      label: 'Info',
      sub:   'About Kevin',
      href:  'info.html',
      color: '#f5f2ec',
      img:   '',
    },
    {
      label: 'Resume',
      sub:   'Experience & Education',
      href:  'resume.html',
      color: 'var(--accent)',
      img:   'https://static.wixstatic.com/media/d8d224_736e460068b542e2b44cdf22f412a487~mv2.png',
    },
    {
      label: 'Contact',
      sub:   'Get in touch',
      href:  'contact.html',
      color: '#f5f2ec',
      img:   '',
    },
    {
      label: 'Archive',
      sub:   'Image dump',
      href:  'contact.html',
      color: 'var(--accent)',
      img:   'https://static.wixstatic.com/media/d8d224_75bb282c899c41159e337c6533d5e3dd~mv2.png',
    },
  ];

  const wrap   = document.getElementById('carousel-wrap');
  const ring   = document.getElementById('carousel-ring');
  const dotsEl = document.getElementById('carousel-dots');
  const labelEl = document.getElementById('carousel-label');
  const hintEl  = document.getElementById('carousel-hint');

  if (!wrap || !ring) return;

  const N    = pages.length;
  const STEP = 360 / N;

  /* spread: use a fixed generous radius for 5 cards */
  function getRadius() {
    const card = ring.querySelector('.c3d-card');
    const w    = card ? card.offsetWidth : 380;
    /* multiplier >1 spreads cards apart beyond touching */
    return Math.round((w / 2) / Math.tan(Math.PI / N) * 1.5);
  }

  let angle    = 0;
  let velX     = 0;
  let rafId    = null;
  let active   = 0;
  let dragging = false;
  let startX   = 0;
  let startA   = 0;
  let lastX    = 0;
  let lastT    = 0;
  let hintGone = false;

  /* build cards */
  pages.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'c3d-card nav-card';
    card.dataset.index = i;

    const hasImg = p.img && p.img.length > 0;
    card.innerHTML = `
      <a href="${p.href}" class="c3d-card__link">
        <div class="c3d-card__img">
          ${hasImg
            ? `<img src="${p.img}" alt="${p.label}" onerror="this.style.display='none'" />`
            : `<div class="nav-card__fill" style="background:var(--border);width:100%;height:100%;"></div>`
          }
          <span class="c3d-card__tag" style="color:${p.color}">${p.sub}</span>
        </div>
        <div class="c3d-card__body">
          <p class="c3d-card__title" style="font-size:clamp(28px,4vw,44px)">${p.label}</p>
          <p class="c3d-card__sub">cloonk.com / ${p.label.toLowerCase()}</p>
        </div>
      </a>`;
    ring.appendChild(card);
  });

  function positionCards() {
    const r = getRadius();
    ring.querySelectorAll('.c3d-card').forEach((card, i) => {
      card.style.transform = `rotateY(${i * STEP}deg) translateZ(${r}px)`;
    });
  }

  /* dots */
  pages.forEach((p, i) => {
    const d = document.createElement('button');
    d.className = 'c3d-dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', p.label);
    d.addEventListener('click', () => snapTo(i));
    dotsEl.appendChild(d);
  });

  function render(snap) {
    ring.style.transition = snap
      ? 'transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)'
      : 'none';
    ring.style.transform = `rotateY(${angle}deg)`;

    const norm = ((-angle % 360) + 360) % 360;
    const idx  = Math.round(norm / STEP) % N;
    if (idx !== active) {
      active = idx;
      dotsEl.querySelectorAll('.c3d-dot').forEach((d, i) =>
        d.classList.toggle('active', i === active)
      );
      if (labelEl) labelEl.textContent = pages[active].label;
    }
  }

  function snapTo(idx) {
    cancelAnimationFrame(rafId);
    velX = 0;
    let target = -idx * STEP;
    while (target - angle >  180) target -= 360;
    while (angle - target >  180) target += 360;
    angle = target;
    render(true);
  }

  function snapNearest() {
    const raw = -angle / STEP;
    snapTo(((Math.round(raw) % N) + N) % N);
  }

  function inertiaLoop() {
    if (Math.abs(velX) < 0.01) { snapNearest(); return; }
    angle += velX;
    velX  *= 0.88;
    render(false);
    rafId = requestAnimationFrame(inertiaLoop);
  }

  function pointerDown(e) {
    cancelAnimationFrame(rafId);
    dragging = true;
    wrap.classList.add('dragging');
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startA = angle;
    lastX  = startX;
    lastT  = Date.now();
    velX   = 0;
    ring.style.transition = 'none';
    if (!hintGone && hintEl) { hintEl.style.opacity = '0'; hintGone = true; }
  }

  function pointerMove(e) {
    if (!dragging) return;
    const cx  = e.touches ? e.touches[0].clientX : e.clientX;
    const now = Date.now();
    const dt  = Math.max(now - lastT, 1);
    velX   = (cx - lastX) / dt * 0.6;
    lastX  = cx;
    lastT  = now;
    angle  = startA + (cx - startX) * 0.15;
    render(false);
  }

  function pointerUp() {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('dragging');
    rafId = requestAnimationFrame(inertiaLoop);
  }

  wrap.addEventListener('mousedown',  pointerDown);
  window.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup',   pointerUp);
  wrap.addEventListener('touchstart', pointerDown, { passive: true });
  window.addEventListener('touchmove', pointerMove, { passive: true });
  wrap.addEventListener('touchend',   pointerUp);

  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    cancelAnimationFrame(rafId);
    angle -= e.deltaY * 0.10;
    render(false);
    clearTimeout(wrap._wt);
    wrap._wt = setTimeout(snapNearest, 180);
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  snapTo(((active - 1) + N) % N);
    if (e.key === 'ArrowRight') snapTo((active + 1) % N);
  });

  positionCards();
  render(false);
  if (labelEl) labelEl.textContent = pages[0].label;

  window.addEventListener('resize', () => { positionCards(); render(false); });

})();
