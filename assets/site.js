(function () {
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function preload(src) {
    var img = new Image();
    img.src = src;
    return img.decode ? img.decode().then(function () { return img; }, function () { return img; })
      : new Promise(function (done) { img.onload = img.onerror = function () { done(img); }; });
  }

  /* Opening: a short run of hard cuts that lands on the final frame, once per visit */
  var opening = document.querySelector('.opening');
  if (opening) {
    var seen = false;
    try { seen = sessionStorage.getItem('opening-seen') === '1'; } catch (e) {}

    var finish = function () { root.classList.add('ready'); };
    var frames = (opening.getAttribute('data-frames') || '').split(',').filter(Boolean);

    if (reduced || seen || !frames.length) {
      finish();
    } else {
      var timedOut = new Promise(function (done) { setTimeout(function () { done(null); }, 1100); });
      Promise.race([Promise.all(frames.map(preload)), timedOut]).then(function (imgs) {
        if (!imgs || window.scrollY > 40) { finish(); return; }
        try { sessionStorage.setItem('opening-seen', '1'); } catch (e) {}
        var cut = document.createElement('img');
        cut.className = 'cut';
        cut.alt = '';
        opening.appendChild(cut);
        var i = 0;
        (function next() {
          if (i === imgs.length) { cut.remove(); finish(); return; }
          cut.src = imgs[i++].src;
          /* 360ms keeps the cuts under three changes a second */
          setTimeout(next, 360);
        })();
      });
    }

    /* The small name in the header appears once the big one has scrolled away */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        root.classList.toggle('at-top', entries[0].isIntersecting);
      }, { threshold: 0.5 }).observe(opening);
    }
  }

  /* Stage: the four main works share one screen, the tabs move between them */
  var track = document.querySelector('.stage-track');
  if (track) {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.stage-tabs button'));
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var slide = document.getElementById(tab.getAttribute('data-target'));
        track.scrollTo({ left: slide.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
      });
    });
    if ('IntersectionObserver' in window) {
      var seenBy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          tabs.forEach(function (tab) {
            if (tab.getAttribute('data-target') === entry.target.id) tab.setAttribute('aria-current', 'true');
            else tab.removeAttribute('aria-current');
          });
        });
      }, { root: track, threshold: 0.6 });
      track.querySelectorAll('.slide').forEach(function (slide) { seenBy.observe(slide); });
    }
  }

  /* Videos open inside the site. Without this script the links still work. */
  function embedFor(href) {
    var m;
    if ((m = href.match(/vimeo\.com\/(\d+)(?:\/(\w+))?/))) {
      return { src: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1&dnt=1' + (m[2] ? '&h=' + m[2] : ''), site: 'Vimeo' };
    }
    if ((m = href.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/))) {
      return { src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0', site: 'YouTube' };
    }
    if ((m = href.match(/instagram\.com\/(reel|p)\/([\w-]+)/))) {
      return { src: 'https://www.instagram.com/' + m[1] + '/' + m[2] + '/embed/', site: 'Instagram', tall: true };
    }
    return null;
  }

  var player = document.querySelector('.player');
  if (player && player.showModal) {
    var stage = player.querySelector('.player-stage');
    var out = player.querySelector('.player-out');

    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a.square, a.slide');
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
      var embed = embedFor(link.href);
      if (!embed) return;
      event.preventDefault();
      var heading = link.querySelector('h2, h3');
      var frame = document.createElement('iframe');
      frame.src = embed.src;
      frame.title = heading.textContent;
      frame.className = embed.tall ? 'tall' : 'wide';
      frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      frame.allowFullscreen = true;
      stage.appendChild(frame);
      player.querySelector('.player-title').textContent = heading.textContent;
      out.href = link.href;
      out.textContent = 'Watch on ' + embed.site;
      player.showModal();
    });

    /* Closing removes the video, which stops the sound */
    player.addEventListener('close', function () { stage.textContent = ''; });
    player.addEventListener('click', function (event) {
      if (event.target === player || event.target === stage) player.close();
    });
  }

  /* Full-screen works: moving the pointer across the frame cuts through its stills */
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover && !reduced) {
    document.querySelectorAll('[data-stills]').forEach(function (frame) {
      var cover = frame.querySelector('img');
      var entries = JSON.parse(frame.getAttribute('data-stills'));
      var loaded = null;
      var layer = null;
      var current = -1;

      frame.addEventListener('pointerenter', function () {
        if (loaded) return;
        loaded = entries.map(function (entry) {
          var img = new Image();
          img.src = entry[0];
          return img;
        });
        layer = document.createElement('img');
        layer.alt = '';
        layer.hidden = true;
        cover.after(layer);
      });

      frame.addEventListener('pointermove', function (event) {
        if (!loaded) return;
        var box = frame.getBoundingClientRect();
        var count = entries.length + 1;
        var index = Math.min(count - 1, Math.floor((event.clientX - box.left) / box.width * count)) - 1;
        if (index === current) return;
        if (index < 0) {
          current = index;
          layer.hidden = true;
        } else if (loaded[index].complete && loaded[index].naturalWidth) {
          current = index;
          layer.src = loaded[index].src;
          layer.style.objectPosition = entries[index][1] || '';
          layer.hidden = false;
        }
      });

      frame.addEventListener('pointerleave', function () {
        current = -1;
        if (layer) layer.hidden = true;
      });
    });
  }
})();
