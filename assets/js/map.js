// Song map: the route draws itself in broadcast order, a clicked pin ripples like sound,
// and the episode panel turns like a songbook page. The chips hide or show a series.
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var data = JSON.parse(document.getElementById('episodes').textContent);
  var panel = document.querySelector('.panel');
  var svg = document.querySelector('.map__svg');
  var pins = Array.prototype.slice.call(document.querySelectorAll('.pin'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var SEASON = { s1: '第一季', walk: '人生舞台走唱系列' };
  var byKey = {};
  data.forEach(function (e) { byKey[e.season + '-' + e.ep] = e; });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function pinOf(key) { return pins.filter(function (p) { return p.getAttribute('data-key') === key; })[0]; }
  function centre(p) { var c = p.querySelector('circle'); return [+c.getAttribute('cx'), +c.getAttribute('cy')]; }

  var rippleLayer = svgEl('g', { 'class': 'ripples', 'aria-hidden': 'true' });
  var halo = svgEl('circle', { r: 9, 'class': 'halo' });

  /* ---------- route: one hand-drawn line per series, in broadcast order ---------- */
  // Catmull-Rom through the points, as cubic Béziers
  function smoothPath(pts) {
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.5 / 3;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) * t).toFixed(1) +
        ' ' + (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) * t).toFixed(1) +
        ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }

  var defs = svgEl('defs', {});
  var routeLayer = svgEl('g', { 'class': 'route' });
  svg.insertBefore(defs, svg.querySelector('.pin'));
  svg.insertBefore(routeLayer, svg.querySelector('.pin'));
  svg.appendChild(rippleLayer);

  var routes = [];
  var start = 0;
  [['s1', 1, 10], ['walk', 11, 18]].forEach(function (r) {
    var keys = [];
    for (var n = r[1]; n <= r[2]; n++) keys.push(r[0] + '-' + n);
    var pts = keys.map(function (k) { return centre(pinOf(k)); });
    var d = smoothPath(pts);
    var probe = svgEl('path', { d: d });
    routeLayer.appendChild(probe);
    var total = probe.getTotalLength();
    // length along the route at each pin, so each pin pops as the line reaches it
    var at = pts.map(function (_, i) {
      if (i === 0) return 0;
      var part = svgEl('path', { d: smoothPath(pts.slice(0, i + 1)) });
      routeLayer.appendChild(part);
      var len = part.getTotalLength();
      routeLayer.removeChild(part);
      return len;
    });
    routeLayer.removeChild(probe);

    var id = 'reveal-' + r[0];
    var mask = svgEl('mask', { id: id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 600, height: 800 });
    var ink = svgEl('path', { d: d, 'class': 'route__ink', 'stroke-dasharray': total, 'stroke-dashoffset': total });
    mask.appendChild(ink);
    defs.appendChild(mask);
    var line = svgEl('path', { d: d, 'class': 'route__line route__line--' + r[0], mask: 'url(#' + id + ')' });
    routeLayer.appendChild(line);

    var dur = 1400 + total * 1.2; // ms; longer route, longer draw
    routes.push({ season: r[0], ink: ink, line: line, total: total, dur: dur, start: start, keys: keys, at: at });
    start += dur;
  });

  function hidePins() {
    pins.forEach(function (p) { p.classList.add('is-waiting'); p.classList.remove('is-popped'); });
    halo.style.opacity = '0';
    routes.forEach(function (r) {
      r.ink.style.transition = 'none';
      r.ink.style.strokeDashoffset = r.total;
    });
  }
  function playRoute() {
    if (reduce) { showAll(); return; }
    hidePins();
    setTimeout(function () { halo.style.opacity = ''; }, start);
    void svg.getBoundingClientRect(); // commit the reset before animating
    routes.forEach(function (r) {
      r.ink.style.transition = 'stroke-dashoffset ' + r.dur + 'ms cubic-bezier(.45,.05,.35,1) ' + r.start + 'ms';
      r.ink.style.strokeDashoffset = 0;
      r.keys.forEach(function (k, i) {
        // timed on linear length; the eased line runs slightly ahead mid-route
        var t = r.start + (r.at[i] / r.total) * r.dur;
        setTimeout(function () {
          var p = pinOf(k);
          p.classList.remove('is-waiting');
          p.classList.add('is-popped');
        }, t);
      });
    });
  }
  function showAll() {
    pins.forEach(function (p) { p.classList.remove('is-waiting'); });
    halo.style.opacity = '';
    routes.forEach(function (r) { r.ink.style.transition = 'none'; r.ink.style.strokeDashoffset = 0; });
  }

  if (!reduce && 'IntersectionObserver' in window) {
    hidePins();
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); playRoute(); }
    }, { threshold: 0.35 });
    io.observe(svg);
  }

  /* ---------- sound ripple from the chosen pin ---------- */

  function ripple(p, season) {
    var c = centre(p);
    halo.setAttribute('cx', c[0]); halo.setAttribute('cy', c[1]);
    halo.setAttribute('class', 'halo halo--' + season);
    p.parentNode.insertBefore(halo, p);
    if (reduce) return;
    for (var i = 0; i < 3; i++) {
      var ring = svgEl('circle', { cx: c[0], cy: c[1], r: 9, 'class': 'ring ring--' + season });
      ring.style.animationDelay = (i * 280) + 'ms';
      rippleLayer.appendChild(ring);
      ring.addEventListener('animationend', function () { this.remove(); });
    }
  }

  /* ---------- the chosen place's name beside its pin (on a phone the panel is a screen further down) ---------- */
  var tag = svgEl('g', { 'class': 'pin-label', 'aria-hidden': 'true' });
  var tagBox = svgEl('rect', { rx: 8, height: 38 });
  var tagText = svgEl('text', { 'dominant-baseline': 'central' });
  tag.appendChild(tagBox); tag.appendChild(tagText);
  function label(p, e) {
    var c = centre(p), GAP = 18, PAD = 12;
    tagText.textContent = e.place;
    tag.setAttribute('class', 'pin-label pin-label--' + e.season);
    svg.appendChild(tag);                       // last child: above the pins and ripples
    var w = tagText.getComputedTextLength() + PAD * 2;
    var vb = svg.viewBox.baseVal;
    var right = c[0] + GAP + w <= vb.width - 6;  // right of the pin unless that runs off the map
    var x = right ? c[0] + GAP : c[0] - GAP - w;
    var y = Math.max(4, Math.min(vb.height - 42, c[1] - 19));
    tagBox.setAttribute('x', x); tagBox.setAttribute('y', y); tagBox.setAttribute('width', w);
    tagText.setAttribute('x', x + PAD); tagText.setAttribute('y', y + 19);
    tag.classList.remove('is-in'); void tag.getBoundingClientRect(); tag.classList.add('is-in');
  }

  /* ---------- the episode's six photos: one large, the rest as thumbnails that swap in ---------- */
  // the map has its own six per episode (assets/img/map/), none of them used in the album
  var IMG_V = 'm4';
  var COUNT = {};   // photos per episode when not six
  function photo(e, k, small) {
    return 'assets/img/map/ep' + pad(e.ep) + '-' + k + (small ? '-s' : '') + '.webp?v=' + IMG_V;
  }
  function photos(e) {
    var place = e.region === e.place ? e.region : e.region + e.place;
    var box = el('div', 'panel__photos');
    var big = el('img', 'panel__photo');
    big.width = 1400; big.height = 788; big.src = photo(e, 1); big.alt = place + '外景照片 1';
    box.appendChild(big);
    var strip = el('div', 'panel__thumbs');
    var n = COUNT[e.ep] || 6;
    for (var k = 1; k <= n; k++) (function (k) {
      var b = el('button', 'panel__thumb'); b.type = 'button';
      b.setAttribute('aria-label', '看第 ' + k + ' 張');
      if (k === 1) b.setAttribute('aria-current', 'true');
      var im = el('img'); im.src = photo(e, k, true); im.alt = ''; im.width = 560; im.height = 315; im.loading = 'lazy';
      b.appendChild(im);
      b.addEventListener('click', function () {
        big.src = photo(e, k); big.alt = place + '外景照片 ' + k;
        strip.querySelectorAll('.panel__thumb').forEach(function (t) { t.removeAttribute('aria-current'); });
        b.setAttribute('aria-current', 'true');
      });
      strip.appendChild(b);
    })(k);
    box.appendChild(strip);
    return box;
  }

  /* ---------- songbook page turn ---------- */
  function fill(e) {
    panel.textContent = '';
    panel.appendChild(el('p', 'panel__season panel__season--' + e.season, SEASON[e.season] + '　EP' + pad(e.ep)));
    panel.appendChild(el('h3', 'panel__place', e.region === e.place ? e.region : e.region + '　' + e.place));
    panel.appendChild(photos(e));
    var ul = el('ul', 'panel__songs');
    e.songs.forEach(function (s, i) {
      var li = el('li', null, '〈' + s + '〉');
      li.style.setProperty('--i', i);
      ul.appendChild(li);
    });
    panel.appendChild(ul);
    if (e.guest) panel.appendChild(el('p', 'panel__guest', '來賓　' + e.guest));
    if (e.highlights) panel.appendChild(el('p', 'panel__blurb', e.highlights));
    var p = el('p', 'ep__watch');
    e.videos.forEach(function (v) {
      var a = el('a', 'btn btn--small', v.part ? '看' + v.part + '集' : '看這一集');
      a.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.id);
      p.appendChild(a);
    });
    if (panel.dataset.album) {
      var al = el('a', 'panel__album', '看這一集的外景相簿');
      al.href = panel.dataset.album + '?ep=' + e.ep + '#film';
      p.appendChild(al);
    }
    panel.appendChild(p);
  }

  var current = null;
  function select(key, animate) {
    var e = byKey[key];
    if (!e || key === current) return;
    current = key;
    pins.forEach(function (p) {
      var on = p.getAttribute('data-key') === key;
      p.classList.toggle('is-active', on);
      if (on) {
        var focused = document.activeElement === p;
        p.parentNode.appendChild(p);
        if (focused) p.focus();
        ripple(p, e.season);
        label(p, e);
      }
    });
    if (animate && !reduce && document.startViewTransition) {
      document.startViewTransition(function () { fill(e); panel.classList.add('is-turned'); })
        .ready.catch(function () {}); // a skipped transition still runs the update
    } else {
      fill(e);
      if (animate && !reduce) panel.classList.add('is-turned');
    }
  }

  pins.forEach(function (p) {
    p.addEventListener('click', function (ev) {
      ev.preventDefault();
      select(p.getAttribute('data-key'), true);
    });
  });

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var on = c.getAttribute('aria-pressed') !== 'true';
      c.setAttribute('aria-pressed', String(on));
      var season = c.getAttribute('data-season');
      pins.forEach(function (p) {
        if (p.classList.contains('pin--' + season)) p.classList.toggle('is-hidden', !on);
      });
      routes.forEach(function (r) { if (r.season === season) r.line.classList.toggle('is-hidden', !on); });
    });
  });

  select(panel.getAttribute('data-default'), false);
})();
