// 試閱頁: a sample page opens full size in a dialog. The book reads right to left, so "next"
// sits on the left, ← turns forward, and a swipe to the right turns forward, as in a printed manga.
// Without JS each thumbnail is a plain link to the full page.
(function () {
  var dialog = document.querySelector('.reader');
  var links = Array.prototype.slice.call(document.querySelectorAll('.work__page'));
  if (!dialog || !links.length || !dialog.showModal) return;

  var img = dialog.querySelector('.reader__img');
  var count = dialog.querySelector('.reader__count');
  var index = 0, opener = null;

  function song(a) { return a.closest('.work').querySelector('.work__song').textContent; }
  function siblings(a) { return Array.prototype.slice.call(a.closest('.work__pages').querySelectorAll('.work__page')); }

  function show(i) {
    index = (i + links.length) % links.length;
    var a = links[index], set = siblings(a);
    img.src = a.getAttribute('href');
    img.alt = a.querySelector('img').alt;
    count.textContent = song(a) + '　' + (set.indexOf(a) + 1) + ' / ' + set.length;
    // warm the next page so turning forward never waits
    new Image().src = links[(index + 1) % links.length].getAttribute('href');
  }

  links.forEach(function (a, i) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      opener = a;
      show(i);
      dialog.showModal();
    });
  });

  dialog.querySelector('.reader__btn--next').addEventListener('click', function () { show(index + 1); });
  dialog.querySelector('.reader__btn--prev').addEventListener('click', function () { show(index - 1); });
  dialog.querySelector('.reader__close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (ev) { if (ev.target === dialog) dialog.close(); });
  dialog.addEventListener('close', function () { if (opener) opener.focus(); });
  dialog.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); show(index + 1); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); show(index - 1); }
  });

  var x0 = null;
  dialog.addEventListener('touchstart', function (ev) { x0 = ev.touches[0].clientX; }, { passive: true });
  dialog.addEventListener('touchend', function (ev) {
    if (x0 === null) return;
    var dx = ev.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 48) show(index + (dx > 0 ? 1 : -1));
  });
})();
