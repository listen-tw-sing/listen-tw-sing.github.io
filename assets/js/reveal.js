// Scroll reveal: content rises, photos develop, postcards drop onto the board, comic covers fan out.
// Elements entering together are staggered. Nothing is hidden without JS or under reduced motion.
(function () {
  var GROUPS = [
    ['.statement__text, .award__inner > *, .award__rows li, .songs__head, .songs__note, .section-title, .lede, .season__status, .season__intro p, .season__split > div > p, .map__legend, .support__inner > div, .reel__inner > *', 'rise'],
    ['.season__poster, .season__photo, .strip li, .collage li', 'photo'],
    ['.eps > li, .more__list li, .social li', 'rise'],
    ['.postcards__grid > li', 'pin'],
    ['.comic', 'fan'],
    ['.cx-about__text p, .track, .work__text > *, .specs > div, .buy__group', 'rise'],
    ['.work__spread, .cx-video__frame', 'photo'],
  ];

  var targets = [];
  GROUPS.forEach(function (g) {
    Array.prototype.forEach.call(document.querySelectorAll(g[0]), function (el) {
      if (el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-reveal', g[1]);
      targets.push(el);
    });
  });

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    var batch = entries.filter(function (e) { return e.isIntersecting; })
      .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left; });
    batch.forEach(function (e, i) {
      e.target.style.setProperty('--i', Math.min(i, 7));
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  targets.forEach(function (el) { io.observe(el); });
})();
