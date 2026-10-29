/* D. 刊物 — quiet enhancements only. The page is complete without this file. */
(function () {
  'use strict';
  var root = document.documentElement;
  var motion = root.classList.contains('js-motion');

  /* 1. Photos fade and settle in as they enter. */
  if (motion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
  }

  /* 2. Caption column: mark the plate currently in view (not motion — works with reduced motion too). */
  var plates = Array.prototype.slice.call(document.querySelectorAll('.plate'));
  var caps = document.querySelectorAll('.captions li');
  if (plates.length && caps.length && 'IntersectionObserver' in window) {
    var seen = new Map();
    var mark = function () {
      var best = -1, bestRatio = 0;
      plates.forEach(function (p, i) { var r = seen.get(p) || 0; if (r > bestRatio) { bestRatio = r; best = i; } });
      caps.forEach(function (c, i) { c.classList.toggle('is-current', i === best); });
    };
    var capIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0); });
      mark();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    plates.forEach(function (p) { capIo.observe(p); });
  }

  /* 3. One slow parallax: the lead plate drifts a few pixels against the page. Whole figure moves, never cropped. */
  var lead = document.querySelector('[data-parallax]');
  if (motion && lead) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var r = lead.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      if (r.bottom < -100 || r.top > vh + 100) return;
      var t = (r.top + r.height / 2 - vh / 2) / vh;        /* -1 … 1 across the viewport */
      var y = Math.max(-1, Math.min(1, t)) * 22;
      lead.style.translate = '0 ' + y.toFixed(1) + 'px';
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
})();
