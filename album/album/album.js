/* 聽！台灣在唱歌 — style lab C. 相簿. Vanilla JS; transforms and opacity only. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var params = new URLSearchParams(location.search);
  var DEBUG = params.has('debug');
  var mqRM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var RM = mqRM.matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var data = JSON.parse($('#album-data').textContent);

  if (!RM && !DEBUG) html.classList.add('reveal-on');

  /* Is this keydown aimed at a text field? */
  function isTyping(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  /* Horizontal swipe helper: calls cb(-1|1). Ignores mostly-vertical gestures. */
  function onSwipe(el, cb, ignoreSel) {
    var sx = 0, sy = 0, id = null;
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || (ignoreSel && e.target.closest(ignoreSel))) return;
      id = e.pointerId; sx = e.clientX; sy = e.clientY;
    });
    el.addEventListener('pointerup', function (e) {
      if (e.pointerId !== id) return;
      id = null;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) cb(dx < 0 ? 1 : -1);
    });
    el.addEventListener('pointercancel', function () { id = null; });
  }

  /* =======================================================
     1. HERO SLIDESHOW
     ======================================================= */
  (function hero() {
    var root = $('.hero');
    if (!root) return;
    var slides = $$('.hero-slide', root);
    var segs = $$('.seg', root);
    var ui = $('.hero-ui', root);
    var playBtn = $('.hero-play', root);
    var countEl = $('.hero-count b', root);
    var live = $('.hero-live', root);
    var N = slides.length;
    var HOLD = 7000, FADE = 1600, KB_SCALE = 1.08;
    var idx = clamp(parseInt(params.get('slide') || '1', 10) - 1 || 0, 0, N - 1);
    var playing = !RM && !DEBUG;
    var suspended = false;          // off-screen or tab hidden
    var kbAnim = null, progAnim = null, leaveTimer = 0;

    ui.hidden = false;

    /* Ken Burns: scale about the faces' focus point, drifting the faces gently toward the middle.
       The translate is capped by the margin the scale opens on each side, so no edge ever shows
       and the focus point never moves more than a few percent. */
    function kenBurns(slide) {
      if (RM || DEBUG || !slide.animate) return null;
      var f = slide.dataset.focus.split(' ').map(Number), fx = f[0], fy = f[1];
      var sc = parseFloat(slide.dataset.kbs) || KB_SCALE, m = sc - 1;
      var tx = clamp((50 - fx) * 0.09, -(100 - fx) * m * 0.8, fx * m * 0.8);
      var ty = clamp((45 - fy) * 0.07, -(100 - fy) * m * 0.8, fy * m * 0.8);
      var near = 'translate3d(0,0,0) scale(1)';
      var far = 'translate3d(' + tx.toFixed(2) + '%,' + ty.toFixed(2) + '%,0) scale(' + sc + ')';
      var out = slide.dataset.kb === 'out';
      return $('.kb', slide).animate(
        [{ transform: out ? far : near }, { transform: out ? near : far }],
        { duration: HOLD + FADE + 1200, easing: 'cubic-bezier(.33,.0,.45,1)', fill: 'both' }
      );
    }

    function progress() {
      var fill = $('.seg-fill', segs[idx]);
      if (!fill.animate) return null;
      var a = fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: HOLD, easing: 'linear', fill: 'both' });
      a.onfinish = function () { if (playing) go(idx + 1, true); };
      return a;
    }

    function syncRunState() {
      var run = playing && !suspended;
      [kbAnim, progAnim].forEach(function (a) {
        if (!a) return;
        if (run) a.play(); else if (a.playState === 'running') a.pause();
      });
    }

    function render(prev, auto) {
      slides.forEach(function (s, i) {
        s.classList.toggle('is-active', i === idx);
        s.classList.toggle('is-leaving', i === prev && prev !== idx);
        s.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
      });
      clearTimeout(leaveTimer);
      if (prev != null && prev !== idx) {
        leaveTimer = setTimeout(function () {
          slides[prev].classList.remove('is-leaving');
          if (slides[prev] !== slides[idx]) $('.kb', slides[prev]).getAnimations && $('.kb', slides[prev]).getAnimations().forEach(function (a) { a.cancel(); });
        }, RM ? 320 : FADE + 50);
      }
      segs.forEach(function (b, i) {
        b.classList.toggle('is-done', i < idx);
        if (i === idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        var f = $('.seg-fill', b);
        if (i !== idx) { f.getAnimations && f.getAnimations().forEach(function (a) { a.cancel(); }); }
      });
      countEl.textContent = pad2(idx + 1);
      if (!auto) live.textContent = slides[idx].getAttribute('aria-label');

      if (progAnim) progAnim.cancel();
      kbAnim = kenBurns(slides[idx]);
      progAnim = progress();
      if (!playing && progAnim) {
        // paused: show the current segment as full, frozen
        progAnim.pause();
        progAnim.currentTime = DEBUG || RM ? HOLD - 1 : 0;
      }
      syncRunState();
    }

    function go(i, auto) {
      var prev = idx;
      idx = (i + N) % N;
      render(prev, auto);
    }

    function setPlaying(p) {
      playing = p;
      playBtn.setAttribute('aria-pressed', p ? 'false' : 'true');
      playBtn.setAttribute('aria-label', p ? '暫停輪播' : '播放輪播');
      if (p && progAnim && progAnim.playState === 'finished') { go(idx + 1, true); return; }
      if (p && progAnim && progAnim.currentTime > HOLD - 50) progAnim.currentTime = 0;
      syncRunState();
    }

    $('.hero-prev', root).addEventListener('click', function () { go(idx - 1); });
    $('.hero-next', root).addEventListener('click', function () { go(idx + 1); });
    playBtn.addEventListener('click', function () { setPlaying(!playing); });
    segs.forEach(function (b, i) { b.addEventListener('click', function () { go(i); }); });
    onSwipe(root, function (d) { go(idx + d); }, 'button, a');

    // arrow keys: when focus is inside the hero, or nowhere in particular while the hero is on screen
    var onScreen = true;
    document.addEventListener('keydown', function (e) {
      if (isTyping(e) || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var a = document.activeElement;
      var inside = root.contains(a);
      var idle = (!a || a === document.body || a === html) && onScreen;
      if (!inside && !idle) return;
      e.preventDefault();
      go(idx + (e.key === 'ArrowRight' ? 1 : -1));
    });

    // stop work when nobody can see it
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        onScreen = en[0].intersectionRatio > 0.35;
        suspended = !onScreen || document.hidden;
        syncRunState();
      }, { threshold: [0, 0.35, 0.6] }).observe(root);
    }
    document.addEventListener('visibilitychange', function () {
      suspended = document.hidden || !onScreen;
      syncRunState();
    });
    mqRM.addEventListener && mqRM.addEventListener('change', function (e) {
      RM = e.matches;
      if (RM) { setPlaying(false); if (kbAnim) kbAnim.cancel(); }
    });

    setPlaying(playing);
    render(null, true);
  })();

  /* =======================================================
     reveal on scroll
     ======================================================= */
  (function reveal() {
    var els = $$('.reveal');
    if (!html.classList.contains('reveal-on') || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* =======================================================
     3. FILMSTRIP (driven by the coverflow)
     ======================================================= */
  var film = (function filmstrip() {
    var root = $('.fs');
    var info = $('.film-info');
    var stage = $('.fs-stage', root);
    var shotsUl = $('.fs-shots', root);
    var shots = $$('.fs-shot', root);
    var thumbs = $$('.fs-thumb', root);
    var countEl = $('.fs-count b', root);
    var ep = 0, k = 0, swapTimer = 0;
    $('.fs-bar', root).hidden = false;
    $('.fs-strip', root).hidden = false;

    var walk = function (e) { return e.season === 'walk'; };
    function src(e, n, small) {
      return '../assets/img/' + (walk(e) ? 'walk' : 's1') + '/ep' + pad2(e.ep) + '-' + n + (small ? '-s' : '') + '.webp?v=p1025e';
    }
    function epLabel(e) { return (walk(e) ? '走唱 EP' : '第一季 EP') + pad2(e.ep); }

    // past the last photo the next episode opens at its first, and before the first the previous one at its
    // last; the coverflow follows, and EP18 and EP01 are neighbours (onEdge is set by the coverflow)
    var pending = null;
    function step(d, focusThumb) {
      if (pending != null) return;   // already on the way to the next episode
      var n = k + d;
      if ((n < 0 || n > 5) && film.onEdge) { pending = n < 0 ? 5 : 0; film.onEdge(n < 0 ? -1 : 1); return; }
      show(n, focusThumb);
    }

    function show(n, focusThumb) {
      k = (n + 6) % 6;
      shots.forEach(function (s, i) { s.classList.toggle('is-active', i === k); });
      thumbs.forEach(function (t, i) {
        if (i === k) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
        t.tabIndex = i === k ? 0 : -1;
      });
      countEl.textContent = k + 1;
      if (focusThumb) thumbs[k].focus({ preventScroll: true });
    }

    function fill(e) {
      $('.fi-ep', info).textContent = epLabel(e);
      $('.fi-place', info).textContent = e.region + '｜' + e.place;
      $('.fi-songs', info).textContent = e.songs.map(function (s) { return '〈' + s + '〉'; }).join('、');
      $('.fi-guest', info).textContent = e.guest || '—';
      $('.fi-guest', info).parentNode.hidden = !e.guest;   // 走唱系列沒有來賓
      $('.fi-tags', info).replaceChildren();
      e.highlights.forEach(function (t) {
        var li = document.createElement('li'); li.textContent = t; $('.fi-tags', info).appendChild(li);
      });
      var one = e.videos.length === 1, y0 = $('.fi-yt0'), y1 = $('.fi-yt1');   // the buttons sit under the thumbnails, outside .film-info
      y0.href = 'https://www.youtube.com/watch?v=' + e.videos[0].id;
      y0.lastChild.nodeValue = one ? '看這一集' : '看上集';
      y0.setAttribute('aria-label', '在 YouTube 看' + epLabel(e) + ' ' + e.place + (one ? '' : ' 上集'));
      y1.hidden = one;
      if (!one) {
        y1.href = 'https://www.youtube.com/watch?v=' + e.videos[1].id;
        y1.setAttribute('aria-label', '在 YouTube 看' + epLabel(e) + ' ' + e.place + ' 下集');
      }
      shots.forEach(function (s, i) {
        var img = $('img', s);
        img.src = src(e, i + 1);
        img.alt = epLabel(e) + ' ' + e.place + ' 外景照片 ' + (i + 1);
      });
      thumbs.forEach(function (t, i) { $('img', t).src = src(e, i + 1, true); });
    }

    function setEpisode(i) {
      if (i === ep) return;
      ep = i;
      var e = data[i];
      var first = pending == null ? 0 : pending; pending = null;
      if (RM || DEBUG) { fill(e); show(first); return; }
      clearTimeout(swapTimer);
      stage.classList.add('is-swapping');
      info.classList.add('is-swapping');
      swapTimer = setTimeout(function () {
        fill(e);
        show(first);
        var img = $('img', shots[first]);
        var done = function () { stage.classList.remove('is-swapping'); info.classList.remove('is-swapping'); };
        if (img.decode) img.decode().then(done, done); else done();
      }, 360);
    }

    $('.fs-prev', root).addEventListener('click', function () { step(-1); });
    $('.fs-next', root).addEventListener('click', function () { step(1); });
    thumbs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });
    $('.fs-thumbs', root).addEventListener('keydown', function (e) {
      var d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[e.key];
      if (e.key === 'Home') { e.preventDefault(); show(0, true); return; }
      if (e.key === 'End') { e.preventDefault(); show(5, true); return; }
      if (!d) return;
      e.preventDefault();
      step(d, true);
    });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    });
    onSwipe(stage, function (d) { step(d); });
    show(0);

    var start = clamp((parseInt(params.get('ep') || '1', 10) || 1) - 1, 0, data.length - 1);
    if (params.has('shot')) show(clamp(parseInt(params.get('shot'), 10) - 1, 0, 5));
    var film = { setEpisode: setEpisode, start: start, onEdge: null };
    return film;
  })();

  /* =======================================================
     2. COVERFLOW
     ======================================================= */
  (function coverflow() {
    var root = $('.cf');
    var track = $('.cf-track', root);
    var items = $$('.cf-item', root);
    var cards = $$('.cf-card', root);
    var countB = $('.cf-count b', root);
    var N = cards.length;
    var three = !RM;
    var pos = film.start, target = film.start, vel = 0;
    var raf = 0, last = 0, W = 400;
    var sel = film.start, pickTimer = 0;

    $('.cf-ui', root).hidden = false;
    if (three) root.classList.add('is-3d');

    function measure() { W = items[0].getBoundingClientRect().width || 400; }
    // the 3D ring wraps around: positions are unbounded, cards sit at the nearest copy
    function mod(n) { return ((n % N) + N) % N; }
    function wrapD(d) { return d - N * Math.round(d / N); }
    function nearest(i) { return three ? Math.round(target) + wrapD(i - mod(Math.round(target))) : i; }

    function setCurrent(i, focus) {
      sel = i;
      cards.forEach(function (c, j) {
        c.tabIndex = j === i ? 0 : -1;
        if (j === i) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      });
      countB.textContent = 'EP' + pad2(data[i].ep);
      if (focus) cards[i].focus({ preventScroll: true });
      clearTimeout(pickTimer);
      pickTimer = setTimeout(function () { film.setEpisode(i); }, three && !DEBUG ? 260 : 0);
    }

    function paint() {
      var step = W * 0.56, far = W * 0.2;
      for (var i = 0; i < N; i++) {
        var d = wrapD(i - pos), a = Math.abs(d), s = d < 0 ? -1 : 1;
        var n = Math.min(a, 1), f = Math.max(a - 1, 0);
        var x = s * (n * step + f * far);
        var z = -(n * 260 + f * 110);
        var ry = -s * n * 52;
        var it = items[i];
        it.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,' + z.toFixed(1) + 'px) rotateY(' + ry.toFixed(2) + 'deg)';
        it.style.zIndex = 100 - Math.round(a * 10);
        it.style.opacity = a > 4.2 ? Math.max(0, 1 - (a - 4.2) * 2).toFixed(3) : 1;
        it.style.visibility = a > 4.8 ? 'hidden' : 'visible';
        cards[i].style.setProperty('--dim', Math.min(a * 0.32, 0.72).toFixed(3));
        cards[i].style.setProperty('--meta', Math.max(0, 1 - a * 1.5).toFixed(3));
      }
    }

    function tick(t) {
      var dt = Math.min(48, t - (last || t)); last = t;
      // critically damped spring toward target
      var k = 1 - Math.exp(-dt / 95);
      pos += (target - pos) * k;
      if (Math.abs(target - pos) < 0.0005) { pos = target; paint(); raf = 0; last = 0; return; }
      paint();
      raf = requestAnimationFrame(tick);
    }
    function animate() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }

    function go(v, focus) {
      var i;
      if (three) {
        target = v; i = mod(v);
        if (DEBUG) { pos = v; paint(); } else animate();
      } else {
        i = clamp(v, 0, N - 1);
        items[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
      }
      setCurrent(i, focus);
    }

    // keyboard (roving tabindex)
    track.addEventListener('keydown', function (e) {
      var i = nearest(sel);
      if (e.key === 'ArrowRight') i++;
      else if (e.key === 'ArrowLeft') i--;
      else if (e.key === 'Home') i = nearest(0);
      else if (e.key === 'End') i = nearest(N - 1);
      else return;
      e.preventDefault();
      go(i, true);
    });
    film.onEdge = function (d) { go(three ? nearest(sel) + d : (sel + d + N) % N); };
    $('.cf-prev', root).addEventListener('click', function () { go(nearest(sel) - 1); });
    $('.cf-next', root).addEventListener('click', function () { go(nearest(sel) + 1); });

    // click: a side card comes to centre; the centre card opens its photos below
    var dragMoved = false;
    cards.forEach(function (c, i) {
      c.addEventListener('click', function (e) {
        if (dragMoved) { e.preventDefault(); return; }
        if (i === sel) {
          $('#film').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
        } else go(nearest(i));
      });
    });

    if (!three) {
      // flat scroll-snap row: keep the selection in step with what is centred
      setCurrent(sel);
      items[sel].scrollIntoView({ block: 'nearest', inline: 'center' });
      return;
    }

    // drag / swipe
    var dragging = false, sx = 0, sy = 0, startPos = 0, pid = null, samples = [], decided = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; startPos = pos;
      dragging = true; decided = false; dragMoved = false; samples = [[e.clientX, e.timeStamp]];
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pid) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        decided = true;
        if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; } // vertical: let the page scroll
        dragMoved = true;
        track.setPointerCapture(pid);
        root.classList.add('is-dragging');
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }
      var p = startPos - dx / (W * 0.56);
      pos = p; target = p;
      paint();
      samples.push([e.clientX, e.timeStamp]);
      if (samples.length > 6) samples.shift();
    });
    function release(e) {
      if (e.pointerId !== pid) return;
      pid = null;
      if (!dragging) return;
      dragging = false;
      root.classList.remove('is-dragging');
      if (!dragMoved) return;
      var a = samples[0], b = samples[samples.length - 1];
      var v = (b[1] - a[1]) > 0 ? (b[0] - a[0]) / (b[1] - a[1]) : 0; // px/ms
      var flick = -v * 220 / (W * 0.56);
      go(Math.round(pos + clamp(flick, -3, 3)));
      setTimeout(function () { dragMoved = false; }, 0);
    }
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);

    // horizontal wheel / trackpad swipe only; vertical scrolling is left alone
    var wheelAcc = 0, wheelLock = 0;
    track.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (e.timeStamp < wheelLock) return;
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) > 40) {
        go(nearest(sel) + (wheelAcc > 0 ? 1 : -1));
        wheelAcc = 0; wheelLock = e.timeStamp + 280;
      }
    }, { passive: false });

    window.addEventListener('resize', function () { measure(); paint(); });
    measure();
    paint();
    setCurrent(sel);
  })();

  /* =======================================================
     4. POSTCARDS
     ======================================================= */
  (function postcards() {
    var section = $('.postcards');
    var table = $('.table', section);
    var cards = $$('.pc', table);
    var tidyBtn = $('.pc-tidy', section);
    var nextBtn = $('.pc-next', section);
    var live = $('.pc-live', section);
    var N = cards.length;
    var W = 0, H = 0, cw = 0, ch = 0;
    var tidy = params.has('tidy');
    var zTop = N + 1;
    var raf = 0, last = 0;
    $('.pc-tools', section).hidden = false;

    // seeded random, so the pile is the same each visit
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    var st = cards.map(function (el, i) {
      el.style.zIndex = i + 1;
      return { el: el, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, lift: 0, liftT: 0, tw: null, z: i + 1, held: false };
    });

    function layout() {
      W = table.clientWidth;
      cw = cards[0].offsetWidth; ch = cards[0].offsetHeight;
      var g = gridSpots();
      var gridH = g.h;
      var pileH = W < 640 ? Math.max(640, ch * 4.6) : Math.max(560, ch * 3.3);
      H = Math.max(gridH, pileH);
      table.style.setProperty('--table-h', H + 'px');
    }
    function gridSpots() {
      var gap = W < 640 ? 12 : 22;
      var cols = Math.max(1, Math.min(N, Math.floor((W + gap) / (cw + gap))));
      if (cols > 5 && N === 10) cols = 5;
      var rows = Math.ceil(N / cols);
      var totalW = cols * cw + (cols - 1) * gap;
      var x0 = (W - totalW) / 2;
      var spots = [];
      for (var i = 0; i < N; i++) {
        var c = i % cols, r = Math.floor(i / cols);
        var inRow = r === rows - 1 ? N - r * cols : cols; // centre a short last row
        spots.push({ x: x0 + (cols - inRow) * (cw + gap) / 2 + c * (cw + gap), y: 8 + r * (ch + gap), r: 0 });
      }
      return { spots: spots, h: 16 + rows * ch + (rows - 1) * gap };
    }
    function pileSpots() {
      // a loose pile around the middle of the table: a jittered grid squeezed toward the centre,
      // so cards overlap but every one still shows most of its photo
      seed = 7;
      var cols = W < 640 ? 2 : 4, rows = Math.ceil(N / cols);
      var spreadX = W < 640 ? 1 : 0.8, spreadY = W < 640 ? 0.95 : 0.86;
      var cellW = (W - cw) * spreadX / Math.max(1, cols - 1), cellH = (H - ch) * spreadY / Math.max(1, rows - 1);
      var x0 = (W - cw) * (1 - spreadX) / 2, y0 = (H - ch) * (1 - spreadY) / 2;
      var order = [5, 0, 10, 3, 9, 1, 6, 11, 2, 7, 4, 8];
      return st.map(function (_, i) {
        var o = order[i % order.length] % (cols * rows);
        var c = o % cols, r = Math.floor(o / cols);
        if (cols * rows > N && r === rows - 1) c += (cols * rows - N) / 2; // centre a short last row
        var x = clamp(x0 + c * cellW + (rnd() - 0.5) * cellW * 0.5, 0, W - cw);
        var y = clamp(y0 + r * cellH + (rnd() - 0.5) * cellH * 0.45, 0, H - ch);
        return { x: x, y: y, r: (rnd() - 0.5) * 30 };
      });
    }

    function draw(s) {
      var sc = 1 + s.lift * 0.06;
      s.el.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px,0) rotate(' + s.r.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
    }
    function toTop(s) {
      s.z = ++zTop; s.el.style.zIndex = s.z;
    }

    var easeOutBack = function (t) { var c = 1.3; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
    function tweenTo(spots, stagger, dur) {
      var now = performance.now();
      st.forEach(function (s, i) {
        var p = spots[i];
        s.vx = s.vy = s.vr = 0;
        if (RM || DEBUG) { s.x = p.x; s.y = p.y; s.r = p.r; s.tw = null; draw(s); return; }
        s.tw = { x0: s.x, y0: s.y, r0: s.r, x1: p.x, y1: p.y, r1: p.r, t0: now + i * stagger, d: dur };
      });
      run();
    }

    function step(t) {
      var dt = Math.min(40, t - (last || t)); last = t;
      var f = dt / 16.67, busy = false;
      st.forEach(function (s) {
        // lift eases toward its target
        if (Math.abs(s.liftT - s.lift) > 0.002) { s.lift += (s.liftT - s.lift) * (1 - Math.pow(0.78, f)); busy = true; }
        else s.lift = s.liftT;
        if (s.tw) {
          var k = clamp((t - s.tw.t0) / s.tw.d, 0, 1), e = easeOutBack(k);
          s.x = s.tw.x0 + (s.tw.x1 - s.tw.x0) * e;
          s.y = s.tw.y0 + (s.tw.y1 - s.tw.y0) * e;
          s.r = s.tw.r0 + (s.tw.r1 - s.tw.r0) * Math.min(1, e);
          if (k >= 1) s.tw = null; else busy = true;
        } else if (!s.held && (Math.abs(s.vx) > 0.02 || Math.abs(s.vy) > 0.02 || Math.abs(s.vr) > 0.01)) {
          // toss with friction and soft walls
          s.x += s.vx * f; s.y += s.vy * f; s.r = clamp(s.r + s.vr * f, -28, 28);
          var fr = Math.pow(0.9, f);
          s.vx *= fr; s.vy *= fr; s.vr *= Math.pow(0.86, f);
          if (s.x < 0) { s.x = 0; s.vx = -s.vx * 0.35; }
          if (s.x > W - cw) { s.x = W - cw; s.vx = -s.vx * 0.35; }
          if (s.y < 0) { s.y = 0; s.vy = -s.vy * 0.35; }
          if (s.y > H - ch) { s.y = H - ch; s.vy = -s.vy * 0.35; }
          busy = true;
        }
        draw(s);
      });
      if (busy || st.some(function (s) { return s.held; })) raf = requestAnimationFrame(step);
      else { raf = 0; last = 0; }
    }
    function run() { if (!raf) { last = 0; raf = requestAnimationFrame(step); } }

    function setTidy(v, announce) {
      tidy = v;
      tidyBtn.textContent = v ? '再撒開' : '整理一下';
      tidyBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
      if (v) {
        // neat grid in DOM order
        st.forEach(function (s, i) { s.z = i + 1; s.el.style.zIndex = s.z; });
        zTop = N + 1;
        tweenTo(gridSpots().spots, 40, 820);
      } else tweenTo(pileSpots(), 30, 760);
      if (announce) live.textContent = v ? '明信片已排整齊' : '明信片已撒開';
    }

    // pointer drag
    cards.forEach(function (el, i) {
      var s = st[i], pid = null, ox = 0, oy = 0, sx = 0, sy = 0, base = 0, samples = [], active = false;
      el.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        pid = e.pointerId; sx = e.clientX; sy = e.clientY; active = false;
        if (e.pointerType === 'mouse') begin(e);
      });
      function begin(e) {
        active = true;
        el.setPointerCapture(pid);
        var rect = table.getBoundingClientRect();
        ox = e.clientX - rect.left - s.x; oy = e.clientY - rect.top - s.y;
        s.tw = null; s.vx = s.vy = s.vr = 0; s.held = true; base = s.r;
        s.liftT = 1; el.classList.add('is-lifted');
        toTop(s); samples = [[e.clientX, e.clientY, e.timeStamp]];
        run();
      }
      el.addEventListener('pointermove', function (e) {
        if (e.pointerId !== pid) return;
        if (!active) {
          // touch / pen: a mostly horizontal start picks the card up; vertical lets the page scroll
          var dx = e.clientX - sx, dy = e.clientY - sy;
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          if (Math.abs(dx) > Math.abs(dy)) begin(e); else { pid = null; return; }
        }
        var rect = table.getBoundingClientRect();
        s.x = clamp(e.clientX - rect.left - ox, -cw * 0.25, W - cw * 0.75);
        s.y = clamp(e.clientY - rect.top - oy, -ch * 0.25, H - ch * 0.75);
        samples.push([e.clientX, e.clientY, e.timeStamp]);
        if (samples.length > 5) samples.shift();
        var a = samples[0], b = samples[samples.length - 1], dtm = Math.max(1, b[2] - a[2]);
        s.r = base + clamp((b[0] - a[0]) / dtm * 5, -10, 10); // tilt with the pull
      });
      function end(e) {
        if (e.pointerId !== pid) return;
        pid = null;
        if (!active) return;
        active = false; s.held = false; s.liftT = 0; el.classList.remove('is-lifted');
        var a = samples[0], b = samples[samples.length - 1], dtm = Math.max(1, b[2] - a[2]);
        if (b[2] - e.timeStamp < -80) { s.vx = s.vy = 0; } // held still before letting go
        else { s.vx = clamp((b[0] - a[0]) / dtm * 16.67, -40, 40); s.vy = clamp((b[1] - a[1]) / dtm * 16.67, -40, 40); }
        s.vr = clamp(s.vx * 0.04, -1.2, 1.2);
        if (RM) { s.vx = s.vy = s.vr = 0; }
        s.x = clamp(s.x, 0, W - cw); s.y = clamp(s.y, 0, H - ch);
        if (tidy) { tidy = false; tidyBtn.textContent = '整理一下'; tidyBtn.setAttribute('aria-pressed', 'false'); }
        run();
      }
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', function (e) { if (active) end(e); });

      // keyboard
      el.addEventListener('keydown', function (e) {
        var stepPx = e.shiftKey ? 60 : 20;
        var mv = { ArrowLeft: [-stepPx, 0], ArrowRight: [stepPx, 0], ArrowUp: [0, -stepPx], ArrowDown: [0, stepPx] }[e.key];
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toTop(s); pulse(s);
          live.textContent = el.getAttribute('aria-label').replace('明信片：', '') + '，在最上面';
        } else if (mv) {
          e.preventDefault();
          toTop(s);
          s.tw = null;
          s.x = clamp(s.x + mv[0], 0, W - cw); s.y = clamp(s.y + mv[1], 0, H - ch);
          draw(s);
        }
      });
      el.addEventListener('focus', function () { toTop(s); });
    });

    function pulse(s) {
      if (RM || DEBUG) return;
      s.liftT = 1; run();
      setTimeout(function () { s.liftT = 0; run(); }, 260);
    }

    tidyBtn.addEventListener('click', function () { setTidy(!tidy, true); });
    nextBtn.addEventListener('click', function () {
      // the bottom card of the pile comes up
      var bottom = st.slice().sort(function (a, b) { return a.z - b.z; })[0];
      toTop(bottom); pulse(bottom);
      live.textContent = bottom.el.getAttribute('aria-label').replace('明信片：', '') + '，在最上面';
    });

    var rw = 0;
    window.addEventListener('resize', function () {
      if (table.clientWidth === rw) return;
      var oldW = W, oldH = H;
      rw = table.clientWidth;
      layout();
      if (tidy) { st.forEach(function (s, i) { var p = gridSpots().spots[i]; s.x = p.x; s.y = p.y; s.r = 0; s.tw = null; draw(s); }); }
      else st.forEach(function (s) {
        s.x = clamp(s.x * (W - cw) / Math.max(1, oldW - cw), 0, W - cw);
        s.y = clamp(s.y * (H - ch) / Math.max(1, oldH - ch), 0, H - ch);
        s.tw = null; draw(s);
      });
    });

    // first deal: cards slide out of a stack in the middle when the table comes into view
    function init() {
      layout(); rw = table.clientWidth;
      var target = tidy ? gridSpots().spots : pileSpots();
      if (RM || DEBUG || !('IntersectionObserver' in window)) {
        st.forEach(function (s, i) { s.x = target[i].x; s.y = target[i].y; s.r = target[i].r; draw(s); });
        if (tidy) { tidyBtn.textContent = '再撒開'; tidyBtn.setAttribute('aria-pressed', 'true'); }
        table.classList.add('is-ready');
        return;
      }
      st.forEach(function (s, i) { s.x = (W - cw) / 2; s.y = (H - ch) / 2 + 30; s.r = (i - N / 2) * 1.5; draw(s); });
      table.classList.add('is-ready');
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        tweenTo(target, 70, 900);
      }, { threshold: 0.25 });
      io.observe(table);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();
  })();

  /* =======================================================
     5. MARQUEE pause button
     ======================================================= */
  (function marquee() {
    var root = $('.mq'), vp = $('.mq-viewport', root), track = $('.mq-track', root);
    var ui = $('.mq-ui', root), btn = $('.mq-toggle', root);
    $$('.mq-dup a', root).forEach(function (a) { a.tabIndex = -1; });
    ui.hidden = false;
    var SPEED = 0.03;                 // px per ms when drifting
    var SLOW = 0.35;                  // under a mouse pointer it keeps drifting, slower, so a card is easy to click
    var IDLE = 2500;                  // after a swipe, drag or arrow, wait this long before drifting again
    var paused = false, hovered = false, inView = true, holdUntil = 0, pos = 0, last = 0, raf = 0;
    var half = function () { return track.scrollWidth / 2; };
    var step = function () { var it = $('.mq-item', root); return it ? it.getBoundingClientRect().width + 22 : 280; };
    function hold() { holdUntil = performance.now() + IDLE; }
    // the band [lo, lo + h) must leave room on both sides inside the two copies (2h wide, minus the viewport)
    function low() { return Math.max(1, (half() - vp.clientWidth) / 2); }
    // the second copy of the list makes the strip endless: past either end, jump by one copy
    function wrap() {
      if (RM) return;
      var h = half(), lo = low();
      if (vp.scrollLeft >= lo + h) { vp.scrollLeft -= h; pos -= h; }
      else if (vp.scrollLeft < lo) { vp.scrollLeft += h; pos += h; }
    }
    function tick(t) {
      var dt = Math.min(64, t - (last || t)); last = t;
      var drifting = !RM && !DEBUG && !paused && inView && !dragging && t > holdUntil;
      if (drifting) {
        // keep the position as a float: many screens round scrollLeft to whole pixels, and a step under
        // one pixel read back from scrollLeft would never move
        if (Math.abs(vp.scrollLeft - pos) > 2) pos = vp.scrollLeft;   // someone scrolled it meanwhile
        pos += SPEED * (hovered ? SLOW : 1) * dt;
        vp.scrollLeft = pos;
        wrap();
      } else pos = vp.scrollLeft;
      raf = requestAnimationFrame(tick);
    }
    vp.addEventListener('scroll', wrap, { passive: true });
    // a sideways swipe (trackpad, shift+wheel) takes over; scrolling the page up or down over the strip does not
    vp.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) hold(); }, { passive: true });
    vp.addEventListener('touchstart', hold, { passive: true });
    vp.addEventListener('touchmove', hold, { passive: true });
    vp.addEventListener('keydown', function (e) { if (/^Arrow|^Page|^Home|^End/.test(e.key)) hold(); });
    root.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hovered = true; });
    root.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hovered = false; });

    // mouse drag (touch already scrolls natively); a drag never opens the link under it
    var dragging = false, sx = 0, sl = 0, moved = false;
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true; moved = false; sx = e.clientX; sl = vp.scrollLeft; hold();
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) { moved = true; vp.classList.add('is-dragging'); }
      if (moved) { vp.scrollLeft = sl - dx; e.preventDefault(); }
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false; hold();
      setTimeout(function () { vp.classList.remove('is-dragging'); }, 0);
    });
    vp.addEventListener('click', function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);
    vp.addEventListener('dragstart', function (e) { e.preventDefault(); });

    $('.mq-prev', root).addEventListener('click', function () { hold(); vp.scrollBy({ left: -step(), behavior: RM ? 'auto' : 'smooth' }); });
    $('.mq-next', root).addEventListener('click', function () { hold(); vp.scrollBy({ left: step(), behavior: RM ? 'auto' : 'smooth' }); });
    if (RM) btn.hidden = true;
    btn.addEventListener('click', function () {
      paused = !paused;
      root.classList.toggle('is-paused', paused);
      btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      btn.setAttribute('aria-label', paused ? '繼續捲動' : '暫停捲動');
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }).observe(root);
    // start on the second copy, so there is a whole list to swipe back through before the jump
    if (!RM) { pos = low() + 1; vp.scrollLeft = pos; }
    raf = requestAnimationFrame(tick);
  })();

  /* =======================================================
     6. SEASON TWO DECK
     ======================================================= */
  (function deck() {
    var root = $('.deck');
    if (!root) return;   // 第二季劇照播出前不放
    var list = $('.deck-list', root);
    var prints = $$('.print', root);
    var cap = $('.deck-cap');
    var countB = $('.deck-count b');
    var N = prints.length;
    var order = prints.map(function (_, i) { return i; });
    var rot = [-3.5, 4, -6.5, 2.5];
    var off = [[0, 0], [14, -10], [-16, 8], [8, 14]];
    var busy = false;
    $('.deck-ui').hidden = false;
    root.tabIndex = 0;

    function slot(el, k, extra) {
      var o = off[k] || [0, 0];
      el.style.transform = 'translate3d(' + o[0] + 'px,' + o[1] + 'px,0) rotate(' + rot[k] + 'deg)' + (extra || '');
      el.style.zIndex = N - k;
    }
    function render() {
      order.forEach(function (pi, k) {
        slot(prints[pi], k);
        prints[pi].setAttribute('aria-hidden', k === 0 ? 'false' : 'true');
      });
      var top = prints[order[0]];
      countB.textContent = order[0] + 1;
      cap.classList.add('is-swapping');
      setTimeout(function () { cap.textContent = $('img', top).alt; cap.classList.remove('is-swapping'); }, RM ? 0 : 180);
    }

    function next() {
      if (busy) return;
      var top = prints[order[0]];
      if (RM || DEBUG) { order.push(order.shift()); render(); return; }
      busy = true;
      top.classList.add('is-flying');
      top.style.transform = 'translate3d(68%,-4%,0) rotate(14deg)';
      setTimeout(function () {
        top.classList.remove('is-flying');
        order.push(order.shift());
        render();
        setTimeout(function () { busy = false; }, 200);
      }, 380);
    }
    function prev() {
      if (busy) return;
      var back = prints[order[N - 1]];
      if (RM || DEBUG) { order.unshift(order.pop()); render(); return; }
      busy = true;
      back.classList.add('is-flying');
      back.style.transform = 'translate3d(-68%,-4%,0) rotate(-14deg)';
      setTimeout(function () {
        back.classList.remove('is-flying');
        back.style.zIndex = N + 1;
        order.unshift(order.pop());
        render();
        setTimeout(function () { busy = false; }, 200);
      }, 380);
    }

    $('.deck-next').addEventListener('click', next);
    $('.deck-prev').addEventListener('click', prev);
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
    });

    // drag the top print sideways to throw it to the back; a tap also flips
    var pid = null, sx = 0, sy = 0, moved = false, decided = false;
    list.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || busy) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false; decided = false;
    });
    list.addEventListener('pointermove', function (e) {
      if (e.pointerId !== pid) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        decided = true;
        if (Math.abs(dy) > Math.abs(dx)) { pid = null; return; }
        moved = true; list.setPointerCapture(pid);
        prints[order[0]].classList.add('is-dragging');
      }
      slot(prints[order[0]], 0, ' translate3d(' + dx + 'px,0,0) rotate(' + (dx * 0.04).toFixed(2) + 'deg)');
    });
    function up(e) {
      if (e.pointerId !== pid) return;
      pid = null;
      var top = prints[order[0]];
      top.classList.remove('is-dragging');
      var dx = e.clientX - sx;
      if (!moved) { if (e.type === 'pointerup') next(); return; }
      if (dx > 70) next();
      else if (dx < -70) { order.push(order.shift()); render(); }
      else slot(top, 0);
    }
    list.addEventListener('pointerup', up);
    list.addEventListener('pointercancel', up);

    render();
  })();
})();
/* ?debug&at=<id>[&dy=px]: jump to a section for screenshots */
if (/[?&]at=/.test(location.search)) setTimeout(function () {
  var q = new URLSearchParams(location.search), el = document.getElementById(q.get('at'));
  document.documentElement.style.scrollBehavior = 'auto';
  if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + (parseInt(q.get('dy') || '0', 10)));
}, 400);
