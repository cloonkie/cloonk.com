/* scroll-carousel.js
   Nav carousel with viewport-responsive 3D ring.
   - Cards arranged on a cylinder (90° apart for 4 slots)
   - Wheel / drag / touch rotates the ring horizontally
   - Mouse Y tilts ring (pitch) — desktop only
   - RADIUS and PERSPECTIVE scale with viewport width
*/
(function () {

  /* ── Nav destination cards ── */
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
  ];

  const N    = CARDS.length;
  const STEP = 360 / N;

  const ring  = document.getElementById('scroll-carousel-ring');
  const label = document.getElementById('scroll-carousel-label');
  const wrap  = document.getElementById('scroll-carousel-wrap');
  const scene = document.getElementById('scroll-carousel-scene');

  if (!ring) return;

  /* ── Viewport-responsive radius & perspective ── */
  function getRadius() {
    var vw = window.innerWidth;
    if (vw <= 480)  return Math.max(vw * 0.42, 140);
    if (vw <= 768)  return Math.max(vw * 0.48, 200);
    if (vw <= 1024) return Math.max(vw * 0.42, 300);
    return Math.min(vw * 0.32, 480);
  }

  function getPersp() {
    var vw = window.innerWidth;
    if (vw <= 480)  return 600;
    if (vw <= 768)  return 800;
    if (vw <= 1024) return 1100;
    return 1400;
  }

  var RADIUS = getRadius();
  var PERSP  = getPersp();

  /* ── Build cards ── */
  CARDS.forEach(function (card, i) {
    var rotY   = i * STEP;
    var isBack = (rotY >= 108 && rotY <= 252);

    var el = document.createElement('div');
    el.className = 'sc-card' + (isBack ? ' sc-card--mirror' : '');
    el.dataset.index = i;

    el.style.backfaceVisibility       = isBack ? 'hidden' : 'visible';
    el.style.webkitBackfaceVisibility = isBack ? 'hidden' : 'visible';
    el.style.transform = 'rotateY(' + rotY + 'deg) translateZ(' + RADIUS + 'px)';

    var innerScale = isBack ? 'transform:scaleX(-1);' : '';

    el.innerHTML =
      '<a href="' + card.href + '" class="sc-card__link" draggable="false"'
      + ' style="' + innerScale + '">'
      + '<img class="sc-card__img"'
      + ' src="' + card.img + '"'
      + ' alt="' + card.label + '"'
      + ' onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.sc-card__bg\').style.display=\'block\'" />'
      + '<div class="sc-card__bg" style="display:none;width:100%;height:76%;background:' + card.fallback + ';"></div>'
      + '<div class="sc-card__body">'
      + '<p class="sc-card__title">' + card.label + '</p>'
      + '<p class="sc-card__sub">' + card.sub + '</p>'
      + '</div>'
      + '</a>';

    ring.appendChild(el);
  });

  var cardEls = ring.querySelectorAll('.sc-card');

  /* ── Reposition cards on resize ── */
  function repositionCards() {
    RADIUS = getRadius();
    PERSP  = getPersp();

    if (scene) scene.style.perspective = PERSP + 'px';

    cardEls.forEach(function (el, i) {
      var rotY = i * STEP;
      el.style.transform = 'rotateY(' + rotY + 'deg) translateZ(' + RADIUS + 'px)';
    });
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(repositionCards, 120);
  });

  /* Apply initial perspective */
  if (scene) scene.style.perspective = PERSP + 'px';

  /* ── State ── */
  var targetAngle  = 0;
  var currentAngle = 0;
  var targetPitch  = 0;
  var currentPitch = 0;
  var lastActive   = -1;

  /* ── Wheel — both axes ── */
  wrap.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    targetAngle += delta * 0.18;
  }, { passive: false });

  /* ── Touch swipe — improved with velocity ── */
  var touchStartX = 0, touchStartAngle = 0, touchLastX = 0, touchVelocity = 0;

  wrap.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
    touchLastX  = touchStartX;
    touchStartAngle = targetAngle;
    touchVelocity = 0;
  }, { passive: true });

  wrap.addEventListener('touchmove', function (e) {
    var x  = e.touches[0].clientX;
    var dx = x - touchStartX;
    touchVelocity = x - touchLastX;
    touchLastX = x;
    targetAngle = touchStartAngle - dx * 0.4;
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('touchend', function () {
    /* Flick momentum */
    targetAngle -= touchVelocity * 2;
  }, { passive: true });

  /* ── Mouse drag ── */
  var mouseDown = false, mouseStartX = 0, mouseStartAngle = 0;

  wrap.addEventListener('mousedown', function (e) {
    mouseDown = true;
    mouseStartX = e.clientX;
    mouseStartAngle = targetAngle;
    wrap.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', function (e) {
    if (!mouseDown) return;
    targetAngle = mouseStartAngle - (e.clientX - mouseStartX) * 0.4;
  });

  window.addEventListener('mouseup', function () {
    mouseDown = false;
    wrap.style.cursor = 'grab';
  });

  /* ── Mouse Y → pitch (desktop only, skip on touch) ── */
  var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice) {
    document.addEventListener('mousemove', function (e) {
      targetPitch = ((e.clientY - window.innerHeight / 2) / (window.innerHeight / 2)) * 10;
    }, { passive: true });
  }

  /* ── Active card label ── */
  function updateLabel(angle) {
    var norm = (((-angle) % 360) + 360) % 360;
    var idx  = Math.round(norm / STEP) % N;
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
    ring.style.transform = 'rotateX(' + (-currentPitch) + 'deg) rotateY(' + currentAngle + 'deg)';
    updateLabel(currentAngle);
    requestAnimationFrame(tick);
  })();

  if (label) label.textContent = CARDS[0].label;
  wrap.style.cursor = 'grab';

})();
