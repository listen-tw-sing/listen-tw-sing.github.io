// Songs: the run-on song list lights up song by song as it scrolls through the viewport,
// and 先聽一首 plays the full-songs playlist in place. Without JS, or under reduced motion,
// every song is simply lit and the play button's link below it still works.
(function () {
  var list = document.querySelector('.songs__list');
  if (list && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var items = list.children, n = items.length, lit = -2, ticking = false;
    list.classList.add('is-dim');
    var update = function () {
      ticking = false;
      var r = list.getBoundingClientRect(), vh = window.innerHeight;
      // 0 as the list's top passes 85% down the viewport, 1 once its bottom is 40% up
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.45);
      var k = Math.max(-1, Math.min(n - 1, Math.floor(p * n)));
      if (k === lit) return;
      for (var i = 0; i < n; i++) items[i].classList.toggle('is-lit', i <= k);
      lit = k;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    // a song reached by keyboard is lit at once
    list.addEventListener('focusin', function (e) { var li = e.target.closest('li'); if (li) li.classList.add('is-lit'); });
    update();
  }

  var play = document.querySelector('.reel__play');
  if (play) {
    play.addEventListener('click', function () {
      var reel = play.closest('.reel'), f = document.createElement('iframe');
      f.className = 'reel__frame';
      f.title = '完整歌曲播放清單';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.src = 'https://www.youtube-nocookie.com/embed/videoseries?list=' + encodeURIComponent(play.dataset.list) + '&autoplay=1&rel=0';
      reel.appendChild(f);
      reel.classList.add('is-playing');
      f.focus();
    });
  }
})();
