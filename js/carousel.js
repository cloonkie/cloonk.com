/* carousel.js — 3D drag/swipe/scroll carousel for cloonk.com projects */
(function () {

  const projects = [
    { num:'01', title:'Peleton Ad Campaign',       tag:'Copy Writing', sub:'Marketing · 2023', img:'d8d224_a709b5ff95df43fcb52bb577cdd4ecb9~mv2.png',  cat:'marketing' },
    { num:'02', title:'Kenzo Product Elements',    tag:'Analysis',     sub:'Fashion · 2022',   img:'d8d224_156355c38f1f4ba6a05d7a48269cad3b~mv2.png',  cat:'fashion'   },
    { num:'03', title:'Fashion=Freedom',           tag:'Forecast',     sub:'Trend · 2021',     img:'d8d224_75bb282c899c41159e337c6533d5e3dd~mv2.png',  cat:'trend'     },
    { num:'04', title:"Tiffany's Store Plan",      tag:'Merchandising',sub:'Fashion · 2022',   img:'d8d224_736e460068b542e2b44cdf22f412a487~mv2.png',  cat:'fashion'   },
    { num:'05', title:"Tiffany's AR",              tag:'Analysis',     sub:'Marketing · 2022', img:'d8d224_14a347dab54840fa9dc310971c782632~mv2.png',  cat:'marketing' },
    { num:'06', title:"Tiffany's Lock Campaign",   tag:'Analysis',     sub:'Marketing · 2023', img:'d8d224_d2459f98e2ce45e79e887c0161db3947~mv2.png',  cat:'marketing' },
    { num:'07', title:'UNIQLO Assortment Refresh', tag:'Merchandising',sub:'Fashion · 2022',   img:'d8d224_4a2341b3da9449cc9c528e8d93f57546~mv2.png',  cat:'fashion'   },
    { num:'08', title:'SMISKI Campaign',           tag:'Copy Writing', sub:'Marketing · 2023', img:'d8d224_173663d6c04e44b2866239fc8a2c2927~mv2.png',  cat:'marketing' },
    { num:'09', title:'SOS — Save Our Society',    tag:'Forecast',     sub:'Trend · 2021',     img:'d8d224_053fecf62c96440d9cf999857c982855~mv2.png',  cat:'trend'     },
    { num:'10', title:'Race To Space',             tag:'Forecast',     sub:'Trend · 2021',     img:'d8d224_a018aa724b5c42c596bec974f9efb555~mv2.png',  cat:'trend'     },
    { num:'11', title:'PVH Corporation',           tag:'Analysis',     sub:'Fashion · 2021',   img:'d8d224_a1b431caeea04199bd9930e7f2aac1d6~mv2.png',  cat:'fashion'   },
    { num:'12', title:"CL — Kpop's Eye Candy",    tag:'Analysis',     sub:'Fashion · 2021',   img:'d8d224_3a26e6c619214cb1a9c63eb30e098541~mv2.png',  cat:'fashion'   },
    { num:'13', title:'Textile Dyes',              tag:'Science',      sub:'Fashion · 2021',   img:'d8d224_af0b3e171edc42629405911af4fe6b5c~mv2.png',  cat:'fashion'   },
    { num:'14', title:'Knit\u0026Wear',            tag:'Forecast',     sub:'Trend · 2021',     img:'d8d224_dec90d769a4647ec932de2601c47ebc3~mv2.png',  cat:'trend'     },
    { num:'15', title:'Kensie Merchandising',      tag:'Merchandising',sub:'Fashion · 2022',   img:'d8d224_1332514481f547d2a1924070620e0cca~mv2.png',  cat:'fashion'   },
    { num:'16', title:'McCormick Mixology',        tag:'Proposal',     sub:'Marketing · 2023', img:'d8d224_5853048f59724fee872d333d1001f963~mv2.png',  cat:'marketing' },
    { num:'17', title:'Work Pod Proposal',         tag:'Proposal',     sub:'Design · 2023',    img:'d8d224_4ed2de895673404da72ee25801aa738e~mv2.png',  cat:'design'    },
    { num:'18', title:'Heinz Brand Loyalty',       tag:'Proposal',     sub:'Marketing · 2023', img:'d8d224_e858f08eed994b09aab99718c9eed435~mv2.png',  cat:'marketing' },
  ];

  /* ── DOM refs ── */
  const wrap     = document.getElementById('carousel-wrap');
  const scene    = document.getElementById('carousel-scene');
  const ring     = document.getElementById('carousel-ring');
  const dotsEl   = document.getElementById('carousel-dots');
  const labelEl  = document.getElementById('carousel-label');
  const hintEl   = document.getElementById('carousel-hint');

  if (!wrap || !ring) return;

  /* ── Geometry — derive from actual rendered size ── */
  const CARD_W  = 300; /* fallback; overridden after first render */
  const N       = projects.length;
  const STEP    = 360 / N;

  function getRadius() {
    const card = ring.querySelector('.c3d-card');
    const w = card ? card.offsetWidth : CARD_W;
    /* 2.0× gives generous spacing between 18 cards */
    return Math.round((w / 2) / Math.tan(Math.PI / N) * 2.0);
  }

  /* ── State ── */
  let angle   = 0;   // current rotateY degrees (negative = forward)
  let velX    = 0;
  let rafId   = null;
  let active  = 0;
  let dragging = false;
  let startX  = 0;
  let startA  = 0;
  let lastX   = 0;
  let lastT   = 0;
  let hintGone = false;

  /* ── Build cards ── */
  projects.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'c3d-card';
    card.dataset.index = i;
    card.dataset.cat   = p.cat;
    const rotY = i * STEP;
    /* translateZ applied after DOM ready via positionCards() */
    card.style.transform = `rotateY(${rotY}deg) translateZ(0)`;

    const imgSrc = `https://static.wixstatic.com/media/${p.img}`;
    card.innerHTML = `
      <a href="#" class="c3d-card__link">
        <div class="c3d-card__img">
          <img src="${imgSrc}" alt="${p.title}" onerror="this.style.display='none'" />
          <span class="c3d-card__tag">${p.tag}</span>
          <span class="c3d-card__num">${p.num}</span>
        </div>
        <div class="c3d-card__body">
          <p class="c3d-card__title">${p.title}</p>
          <p class="c3d-card__sub">${p.sub}</p>
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

  /* ── Build dots ── */
  projects.forEach((_, i) => {
    const d = document.createElement('button');
    d.className = 'c3d-dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', `Go to project ${i + 1}`);
    d.addEventListener('click', () => snapTo(i));
    dotsEl.appendChild(d);
  });

  /* ── Render ── */
  function render(snap) {
    if (snap) {
      ring.style.transition = 'transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)';
    } else {
      ring.style.transition = 'none';
    }
    ring.style.transform = `rotateY(${angle}deg)`;

    /* which card is front-facing */
    const norm = ((-angle % 360) + 360) % 360;
    const idx  = Math.round(norm / STEP) % N;
    if (idx !== active) {
      active = idx;
      dotsEl.querySelectorAll('.c3d-dot').forEach((d, i) => {
        d.classList.toggle('active', i === active);
      });
      if (labelEl) {
        labelEl.textContent = projects[active].title;
      }
    }
  }

  /* ── Snap to nearest ── */
  function snapTo(idx) {
    cancelAnimationFrame(rafId);
    velX = 0;

    /* find shortest angular path */
    let target = -idx * STEP;
    while (target - angle > 180)  target -= 360;
    while (angle - target > 180)  target += 360;
    angle = target;
    render(true);
  }

  function snapNearest() {
    const raw = -angle / STEP;
    snapTo(((Math.round(raw) % N) + N) % N);
  }

  /* ── Inertia loop ── */
  function inertiaLoop() {
    if (Math.abs(velX) < 0.01) {
      snapNearest();
      return;
    }
    angle += velX;
    velX  *= 0.88;
    render(false);
    rafId = requestAnimationFrame(inertiaLoop);
  }

  /* ── Pointer events ── */
  function pointerDown(e) {
    cancelAnimationFrame(rafId);
    dragging = true;
    wrap.classList.add('dragging');
    startX  = e.touches ? e.touches[0].clientX : e.clientX;
    startA  = angle;
    lastX   = startX;
    lastT   = Date.now();
    velX    = 0;
    ring.style.transition = 'none';
    if (!hintGone && hintEl) {
      hintEl.style.opacity = '0';
      hintGone = true;
    }
  }

  function pointerMove(e) {
    if (!dragging) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const now = Date.now();
    const dt  = Math.max(now - lastT, 1);
    velX      = (cx - lastX) / dt * 0.6;
    lastX     = cx;
    lastT     = now;
    angle     = startA + (cx - startX) * 0.15;
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
  window.addEventListener('touchend',  pointerUp);

  /* ── Scroll wheel ── */
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    cancelAnimationFrame(rafId);
    angle -= e.deltaY * 0.10;
    render(false);
    clearTimeout(wrap._wt);
    wrap._wt = setTimeout(snapNearest, 180);
  }, { passive: false });

  /* ── Keyboard ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  snapTo(((active - 1) + N) % N);
    if (e.key === 'ArrowRight') snapTo((active + 1) % N);
  });

  /* ── Init ── */
  buildDots();
  positionCards();
  render(false);
  if (labelEl) labelEl.textContent = projects[0].title;

  /* ── Filter wiring (runs after cards exist in DOM) ── */
  const filterBar = document.getElementById('filter-bar');
  if (filterBar) {
    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.filter;
        ring.querySelectorAll('.c3d-card').forEach(card => {
          const match = f === 'all' || card.dataset.cat === f;
          card.style.visibility  = match ? 'visible' : 'hidden';
          card.style.pointerEvents = match ? '' : 'none';
          card.style.opacity     = match ? '1' : '0.15';
        });
      });
    });
  }

  /* reposition on resize (fluid card widths on index page) */
  window.addEventListener('resize', () => {
    positionCards();
    render(false);
  });

})();
