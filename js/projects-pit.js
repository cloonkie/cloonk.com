/* projects-pit.js
   Floating project-name pills that drift across the pit and bounce —
   off the walls and off each other — without ever overlapping.

   - Pills are built from the window.PROJECTS that live under /projects/.
   - Each pill links to its build folder; hover/focus pauses it and
     expands the pill into the project's blurb.
   - AABB collision resolution keeps every pair separated each frame;
     an expanded pill is anchored and others bounce off it.
   - Honors prefers-reduced-motion: lays out statically, no animation.
*/
(function () {

  var pit = document.getElementById('pit');
  if (!pit || !window.PROJECTS || !window.PROJECTS.length) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Build the pill elements ──
     Only projects that actually live as a folder under /projects/ —
     i.e. those whose `live` URL points inside this directory. */
  var data = window.PROJECTS.filter(function (p) {
    return p && p.live && p.live.indexOf('/projects/') !== -1;
  });
  if (!data.length) return;

  // Static fallback container for reduced-motion users
  var staticWrap = null;
  if (reduceMotion) {
    staticWrap = document.createElement('div');
    staticWrap.className = 'pit__inner-static';
    pit.appendChild(staticWrap);
  }

  var pills = [];

  data.forEach(function (p) {
    if (!p || !p.title) return;
    var a = document.createElement('a');
    a.className = 'float-pill';
    // Link to the build in this folder, as a path relative to projects/
    a.href = p.live.replace(/^https?:\/\/[^/]+\/projects\//, '');
    a.setAttribute('draggable', 'false');

    var row = document.createElement('span');
    row.className = 'float-pill__row';

    var name = document.createElement('span');
    name.className = 'float-pill__name';
    name.textContent = p.title;
    row.appendChild(name);

    if (p.year) {
      var yr = document.createElement('span');
      yr.className = 'float-pill__year';
      yr.textContent = p.year;
      row.appendChild(yr);
    }
    a.appendChild(row);

    if (p.short) {
      var blurb = document.createElement('span');
      blurb.className = 'float-pill__blurb';
      blurb.textContent = p.short;
      a.appendChild(blurb);
    }

    (staticWrap || pit).appendChild(a);

    var pl = { el: a, open: false };
    pills.push(pl);

    /* Hover / focus → pause drift and expand into the blurb.
       `open` freezes integration in the tick loop; velocity is kept
       so the pill resumes its drift the moment the pointer leaves. */
    function open()  { pl.open = true;  a.classList.add('is-open'); }
    function close() { pl.open = false; a.classList.remove('is-open'); }
    a.addEventListener('mouseenter', open);
    a.addEventListener('mouseleave', close);
    a.addEventListener('focus', open);
    a.addEventListener('blur', close);
  });

  if (reduceMotion) return; // static layout — nothing else to do

  /* ── Measure pills + seed positions/velocities ── */
  var W = 0, H = 0;

  function measure() {
    W = pit.clientWidth;
    H = pit.clientHeight;
    pills.forEach(function (pl) {
      var r = pl.el.getBoundingClientRect();
      pl.w = r.width;
      pl.h = r.height;
    });
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* Non-overlapping seed: try random spots, fall back to a loose grid sweep */
  function seed() {
    var placed = [];
    pills.forEach(function (pl) {
      var ok = false, x = 0, y = 0;
      for (var t = 0; t < 80 && !ok; t++) {
        x = rand(0, Math.max(0, W - pl.w));
        y = rand(0, Math.max(0, H - pl.h));
        ok = true;
        for (var j = 0; j < placed.length; j++) {
          var o = placed[j];
          if (x < o.x + o.w + 6 && x + pl.w + 6 > o.x &&
              y < o.y + o.h + 6 && y + pl.h + 6 > o.y) { ok = false; break; }
        }
      }
      pl.x = x;
      pl.y = y;

      var speed = rand(0.35, 0.85);
      var ang = rand(0, Math.PI * 2);
      pl.vx = Math.cos(ang) * speed;
      pl.vy = Math.sin(ang) * speed;

      placed.push(pl);
    });
  }

  measure();
  seed();

  /* ── Wall + pairwise collision ── */
  function walls(pl) {
    if (pl.x < 0)            { pl.x = 0;          pl.vx = Math.abs(pl.vx); }
    else if (pl.x + pl.w > W){ pl.x = W - pl.w;   pl.vx = -Math.abs(pl.vx); }
    if (pl.y < 0)            { pl.y = 0;          pl.vy = Math.abs(pl.vy); }
    else if (pl.y + pl.h > H){ pl.y = H - pl.h;   pl.vy = -Math.abs(pl.vy); }
  }

  /* Hold a pill inside the pit without bouncing it (used while expanded) */
  function clampInside(pl) {
    if (pl.w >= W) pl.x = 0;
    else if (pl.x < 0) pl.x = 0;
    else if (pl.x + pl.w > W) pl.x = W - pl.w;
    if (pl.h >= H) pl.y = 0;
    else if (pl.y < 0) pl.y = 0;
    else if (pl.y + pl.h > H) pl.y = H - pl.h;
  }

  /* Resolve every overlapping pair along its axis of least penetration.
     Two passes per frame keeps dense clusters from tunnelling.
     An expanded (open) pill is anchored: it never moves, so the other
     pill takes the full push and bounces off the larger expanded box. */
  function separate() {
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < pills.length; i++) {
        var a = pills[i];
        for (var j = i + 1; j < pills.length; j++) {
          var b = pills[j];
          if (a.open && b.open) continue; // both held — leave them be

          var ax2 = a.x + a.w, ay2 = a.y + a.h;
          var bx2 = b.x + b.w, by2 = b.y + b.h;
          if (a.x >= bx2 || b.x >= ax2 || a.y >= by2 || b.y >= ay2) continue;

          var overlapX = Math.min(ax2, bx2) - Math.max(a.x, b.x);
          var overlapY = Math.min(ay2, by2) - Math.max(a.y, b.y);

          if (overlapX < overlapY) {
            if (a.open)      { if (b.x < a.x) { b.x -= overlapX; b.vx = -Math.abs(b.vx); } else { b.x += overlapX; b.vx = Math.abs(b.vx); } }
            else if (b.open) { if (a.x < b.x) { a.x -= overlapX; a.vx = -Math.abs(a.vx); } else { a.x += overlapX; a.vx = Math.abs(a.vx); } }
            else {
              var pushX = overlapX / 2 + 0.5;
              if (a.x < b.x) { a.x -= pushX; b.x += pushX; }
              else           { a.x += pushX; b.x -= pushX; }
              var tvx = a.vx; a.vx = b.vx; b.vx = tvx; // swap x momentum
            }
          } else {
            if (a.open)      { if (b.y < a.y) { b.y -= overlapY; b.vy = -Math.abs(b.vy); } else { b.y += overlapY; b.vy = Math.abs(b.vy); } }
            else if (b.open) { if (a.y < b.y) { a.y -= overlapY; a.vy = -Math.abs(a.vy); } else { a.y += overlapY; a.vy = Math.abs(a.vy); } }
            else {
              var pushY = overlapY / 2 + 0.5;
              if (a.y < b.y) { a.y -= pushY; b.y += pushY; }
              else           { a.y += pushY; b.y -= pushY; }
              var tvy = a.vy; a.vy = b.vy; b.vy = tvy; // swap y momentum
            }
          }
        }
      }
    }
  }

  /* ── Render loop ── */
  function tick() {
    for (var i = 0; i < pills.length; i++) {
      var pl = pills[i];
      if (pl.open) {
        // Frozen + expanded: track the growing box, keep it on-screen.
        var r = pl.el.getBoundingClientRect();
        pl.w = r.width;
        pl.h = r.height;
        clampInside(pl);
        continue;
      }
      pl.x += pl.vx;
      pl.y += pl.vy;
      walls(pl);
    }
    separate();
    for (var k = 0; k < pills.length; k++) {
      var p2 = pills[k];
      if (p2.open) clampInside(p2);
      else walls(p2); // keep separation from pushing pills out of bounds
      p2.el.style.setProperty('--x', p2.x + 'px');
      p2.el.style.setProperty('--y', p2.y + 'px');
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ── Keep pills inside on resize ── */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      pills.forEach(function (pl) {
        if (pl.x + pl.w > W) pl.x = Math.max(0, W - pl.w);
        if (pl.y + pl.h > H) pl.y = Math.max(0, H - pl.h);
      });
    }, 150);
  });

})();
