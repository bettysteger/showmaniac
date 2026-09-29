/*
 * showmaniac TV - player: shows a video in fullscreen and controls it with the remote.
 *
 * The address is either a page with a video player, which is embedded, or a video file/stream,
 * which is played in a video element. On the TV the app may look into embedded pages:
 * it searches the video in there, starts it and controls it with the keys of the remote.
 * If no video is found the page is controlled with a cursor.
 *
 * Measured on a Samsung QN85B (Tizen 6.5): embedded pages play streams fine. Video files and
 * streams played directly do not load, the video player of the TV can not look up host names
 * when it is used by the app. See README.
 *
 *   video mode:  OK = pause, left/right = 10 seconds, up/down = cursor, back = close
 *   cursor mode: arrows = move, OK = click, back = hide the cursor
 */
(function () {
  'use strict';

  var SM = window.SM;
  var h = SM.h;

  var MEDIA_FILE = /\.(mp4|m4v|mov|webm|m3u8|mpd)$/i;
  var SCAN_INTERVAL = 1000;
  var NO_VIDEO_AFTER = 12000; // switch to the cursor if the video did not start until then
  var GIVE_UP_AFTER = 25000;  // a video file that did not load until then will not load anymore
  var CLICK_AFTER = 4000;
  var MAX_DEPTH = 5;
  var WIDTH = 1920;
  var HEIGHT = 1080;

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) { seconds = 0; }
    seconds = Math.floor(seconds);

    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor(seconds % 3600 / 60);
    var text = SM.pad2(minutes) + ':' + SM.pad2(seconds % 60);
    return hours ? hours + ':' + text : text;
  }

  function cursorIcon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    var path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', '0 0 24 24');
    path.setAttribute('d', 'M4 2l16 9.5-7 1.6 4.3 7.6-2.9 1.6-4.3-7.7L4 20z');
    svg.appendChild(path);
    return svg;
  }

  function setScreenSaver(on) {
    try {
      var appcommon = window.webapis.appcommon;
      appcommon.setScreenSaver(on ? appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON : appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
    } catch (e) { /* not on a TV */ }
  }

  /** Calls fn for a window and all windows embedded in it, skips windows the app may not access */
  function walk(win, depth, fn) {
    if (!win || depth > MAX_DEPTH) { return; }

    var count = 0;
    try {
      fn(win, win.document);
      count = win.frames.length;
    } catch (e) {
      return;
    }
    for (var i = 0; i < count; i++) {
      var child = null;
      try { child = win.frames[i]; } catch (e) { /* no access */ }
      walk(child, depth + 1, fn);
    }
  }

  /** @param {Object} params { url, title, show, episodeNo } */
  SM.views.player = function (params) {
    var KEY = SM.app.KEY;
    var direct = MEDIA_FILE.test(params.url.split(/[?#]/)[0]); // only the path decides, not the parameters

    var media = direct ?
      h('video', { class: 'player-media', src: params.url, autoplay: true }) :
      h('iframe', { class: 'player-media', src: params.url, allow: 'autoplay; fullscreen; encrypted-media', allowfullscreen: true });

    var cursor = h('div', { class: 'player-cursor hidden' }, [cursorIcon()]);
    var time = h('div', { class: 'player-time' });
    var progress = h('div', { class: 'player-progress' });
    var hint = h('div', { class: 'player-hint' });
    var hud = h('div', { class: 'player-hud' }, [
      h('div', { class: 'player-title', text: params.title || '' }),
      h('div', { class: 'player-bar' }, [progress]),
      h('div', { class: 'player-info' }, [time, hint])
    ]);
    var el = h('div', { class: 'view view-player' }, [media, cursor, hud]);

    var video = direct ? media : null;
    var mode = 'video';
    var position = { x: WIDTH / 2, y: HEIGHT / 2 };
    var openedAt = Date.now();
    var started = false;      // the video has played at least once
    var pausedByUser = false;
    var clicks = 0;
    var watched = 0;          // part of the video that was watched, 0 to 1
    var lastMove = 0;
    var speed = 0;
    var scanTimer = null;
    var hudTimer = null;
    var closed = false;

    // ---- display ----

    function showHud(duration) {
      hud.classList.add('visible');
      clearTimeout(hudTimer);
      if (duration) {
        hudTimer = setTimeout(function () {
          if (mode === 'video' && video && !video.paused) { hud.classList.remove('visible'); }
        }, duration);
      }
    }

    function render() {
      var hasTime = video && isFinite(video.duration) && video.duration > 0;

      time.textContent = hasTime ? formatTime(video.currentTime) + ' / ' + formatTime(video.duration) : '';
      progress.style.width = hasTime ? (video.currentTime / video.duration * 100) + '%' : '0';

      if (mode === 'cursor') {
        hint.textContent = 'Arrows: move   OK: click   Back: ' + (video ? 'hide cursor' : 'close');
      } else if (!video) {
        hint.textContent = 'Loading ...   Up: cursor   Back: close';
      } else {
        hint.textContent = (video.paused ? 'OK: play' : 'OK: pause') + '   Left/Right: 10 seconds   Up: cursor   Back: close';
      }
    }

    function setMode(next) {
      mode = next;
      setIsolated(mode !== 'cursor'); // the cursor needs the whole page
      cursor.classList.toggle('hidden', mode !== 'cursor');
      render();
      showHud(mode === 'cursor' ? 0 : 4000);
      if (mode === 'cursor') { moveCursor(0, 0); }
    }

    // ---- embedded pages ----

    /** Keys pressed while an embedded page has the focus are handled by the app, popups are blocked */
    function prepare(win, doc) {
      if (win === window || doc.__showmaniac) { return; }
      doc.__showmaniac = true;

      doc.addEventListener('keydown', function (event) {
        if (closed) { return; }
        SM.app.onKeyDown(event);
        if (event.defaultPrevented) { event.stopPropagation(); }
      }, true);

      try { win.open = function () { return null; }; } catch (e) { /* ignore */ }
    }

    /*
     * The video fills the whole screen: in every page from the video up to the player the element
     * that leads to the video (the video itself, the frames around it) is fixed to the screen,
     * everything else is hidden. Overlays like preview images can not cover the video anymore.
     * Switched off while the cursor is shown, so the controls of the page can be used.
     */
    var ISOLATE_CSS =
      'html.__sm-isolate, html.__sm-isolate body { background: #000 !important; overflow: hidden !important; }' +
      'html.__sm-isolate body * { visibility: hidden !important; }' +
      'html.__sm-isolate .__sm-target { visibility: visible !important; position: fixed !important;' +
      ' left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important;' +
      ' width: 100vw !important; height: 100vh !important; min-width: 0 !important; min-height: 0 !important;' +
      ' max-width: none !important; max-height: none !important; margin: 0 !important; padding: 0 !important;' +
      ' border: 0 !important; transform: none !important; opacity: 1 !important; display: block !important;' +
      ' z-index: 2147483647 !important; background: #000 !important; object-fit: contain !important; }' +
      // position: fixed only covers the screen if no element around it is transformed
      'html.__sm-isolate .__sm-flat { transform: none !important; filter: none !important;' +
      ' perspective: none !important; contain: none !important; will-change: auto !important; }';

    var isolated = []; // documents that got the style
    var marked = [];   // elements with one of the classes __sm-target, __sm-flat

    function flattenAncestors(element) {
      var doc = element.ownerDocument;
      var win = doc.defaultView;

      for (var parent = element.parentElement; parent && parent !== doc.documentElement; parent = parent.parentElement) {
        var style = win.getComputedStyle(parent);
        if (style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none' ||
            (style.contain && style.contain !== 'none') || /transform|filter/.test(style.willChange || '')) {
          parent.classList.add('__sm-flat');
          marked.push(parent);
        }
      }
    }

    // inside shadow roots the video is fixed to the screen as long as its host is marked
    var SHADOW_CSS =
      '.__sm-target.__sm-on { position: fixed !important; left: 0 !important; top: 0 !important;' +
      ' width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important;' +
      ' margin: 0 !important; transform: none !important; opacity: 1 !important; visibility: visible !important;' +
      ' display: block !important; z-index: 2147483647 !important; background: #000 !important; object-fit: contain !important; }';

    var shadowTargets = []; // elements inside shadow roots that are switched with the class __sm-on

    function addStyle(root, id, css) {
      if (root.getElementById ? root.getElementById(id) : root.querySelector('#' + id)) { return; }
      var style = (root.ownerDocument || root).createElement('style');
      style.id = id;
      style.textContent = css;
      (root.head || root.documentElement || root).appendChild(style);
    }

    function mark(element) {
      var root = element.getRootNode ? element.getRootNode() : element.ownerDocument;

      // element inside a shadow root: style it there, then continue with its host
      if (root.host) {
        addStyle(root, '__sm-shadow', SHADOW_CSS);
        if (!element.classList.contains('__sm-target')) {
          element.classList.add('__sm-target');
          shadowTargets.push(element);
          marked.push(element);
        }
        return mark(root.host);
      }

      var doc = element.ownerDocument;
      addStyle(doc, '__sm-isolate', ISOLATE_CSS);
      if (!element.classList.contains('__sm-target')) {
        element.classList.add('__sm-target');
        marked.push(element);
        flattenAncestors(element);
      }
      if (isolated.indexOf(doc) === -1) { isolated.push(doc); }
    }

    /** Puts the video in front of everything, from the video up to the player of the app */
    function maximize(element) {
      var depth = 0;

      try {
        mark(element);
        var win = element.ownerDocument.defaultView;

        while (win && win !== window && win.frameElement && depth++ < MAX_DEPTH) {
          var frame = win.frameElement;
          if (frame === media) { break; }
          mark(frame);
          win = frame.ownerDocument.defaultView;
        }
      } catch (e) { /* a page on the way can not be accessed */ }

      setIsolated(mode !== 'cursor');
    }

    /** Removes all marks, used when another video is shown than before */
    function unmarkAll() {
      setIsolated(false);
      marked.forEach(function (element) {
        try { element.classList.remove('__sm-target', '__sm-flat', '__sm-on'); } catch (e) { /* page is gone */ }
      });
      marked = [];
      shadowTargets = [];
      isolated = [];
    }

    function setIsolated(on) {
      isolated.forEach(function (doc) {
        try { doc.documentElement.classList.toggle('__sm-isolate', on); } catch (e) { /* page is gone */ }
      });
      shadowTargets.forEach(function (element) {
        try { element.classList.toggle('__sm-on', on); } catch (e) { /* page is gone */ }
      });
    }

    /** All video elements of a document, also those inside shadow roots of web components */
    function videosIn(doc) {
      var videos = Array.prototype.slice.call(doc.querySelectorAll('video'));
      if (videos.length) { return videos; }

      // players built as web components hide the video in a shadow root
      (function search(root, depth) {
        if (depth > MAX_DEPTH) { return; }
        Array.prototype.forEach.call(root.querySelectorAll('*'), function (element) {
          if (!element.shadowRoot) { return; }
          videos = videos.concat(Array.prototype.slice.call(element.shadowRoot.querySelectorAll('video')));
          search(element.shadowRoot, depth + 1);
        });
      })(doc, 0);
      return videos;
    }

    /** Short clips that loop without sound are previews, not the episode */
    function isPreview(candidate) {
      var duration = candidate.duration;
      return (candidate.muted && candidate.loop) || (isFinite(duration) && duration > 0 && duration < 60);
    }

    /** The episode: long and playing, it is kept even if other videos start meanwhile */
    function isEpisode(candidate) {
      return !!candidate && candidate.isConnected !== false && !isPreview(candidate) && candidate.duration > 60;
    }

    function score(candidate) {
      var rect = candidate.getBoundingClientRect();
      var value = rect.width * rect.height + 1;
      if (candidate.duration > 60) { value *= 20; }
      if (isPreview(candidate)) { value *= 0.01; }
      if (!candidate.paused) { value *= 2; }
      if (candidate.videoWidth > 0) { value *= 2; } // has a picture
      return value;
    }

    function findVideo() {
      var best = null;
      var bestScore = 0;

      walk(media.contentWindow, 0, function (win, doc) {
        prepare(win, doc);

        videosIn(doc).forEach(function (candidate) {
          var value = score(candidate);
          if (value > bestScore) {
            best = candidate;
            bestScore = value;
          }
        });
      });
      return best;
    }

    /**
     * The element at a point of the screen, looks into embedded pages and shadow roots.
     * @return {Object|null} { win, target, x, y } with the point inside of that page
     */
    function targetAt(x, y) {
      var win = null;
      try { win = media.contentWindow; } catch (e) { return null; }
      var root = null;

      for (var depth = 0; depth <= MAX_DEPTH * 2; depth++) {
        var target;
        try { target = (root || win.document).elementFromPoint(x, y); } catch (e) { return null; }
        if (!target) { return null; }

        if (target.tagName === 'IFRAME' || target.tagName === 'FRAME') {
          var rect = target.getBoundingClientRect();
          x -= rect.left + target.clientLeft;
          y -= rect.top + target.clientTop;
          win = target.contentWindow;
          root = null;
          continue;
        }
        if (target.shadowRoot && target.shadowRoot !== root && target.shadowRoot.elementFromPoint) {
          var inner = target.shadowRoot.elementFromPoint(x, y);
          if (inner && inner !== target) {
            root = target.shadowRoot;
            continue;
          }
        }
        return { win: win, target: target, x: x, y: y };
      }
      return null;
    }

    function clickAt(x, y) {
      var hit = targetAt(x, y);
      if (!hit) { return false; }
      fire(hit.win, hit.target, hit.x, hit.y, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
      return true;
    }

    function fire(win, target, x, y, types) {
      types.forEach(function (type) {
        var Constructor = type.indexOf('pointer') === 0 ? win.PointerEvent : win.MouseEvent;
        if (!Constructor) { return; }
        try {
          target.dispatchEvent(new Constructor(type, { bubbles: true, cancelable: true, composed: true, view: win, clientX: x, clientY: y, button: 0 }));
        } catch (e) { /* ignore */ }
      });
    }

    // lets players show their controls when the cursor moves over them
    function hoverAt(x, y) {
      var hit = targetAt(x, y);
      if (hit) { fire(hit.win, hit.target, hit.x, hit.y, ['mousemove']); }
    }

    // ---- playback ----

    function play() {
      if (!video) { return; }
      pausedByUser = false;
      try {
        var result = video.play();
        if (result && result.catch) { result.catch(function () { /* the page did not allow it yet */ }); }
      } catch (e) { /* ignore */ }
    }

    /** Clicks the middle of the video, where most players have their play button */
    function clickVideo() {
      if (!video) { return clickAt(WIDTH / 2, HEIGHT / 2); }
      try {
        var rect = video.getBoundingClientRect();
        var x = rect.left + rect.width / 2;
        var y = rect.top + rect.height / 2;
        var root = video.getRootNode ? video.getRootNode() : video.ownerDocument;
        var target = (root.elementFromPoint ? root.elementFromPoint(x, y) : null) || video;
        fire(video.ownerDocument.defaultView, target, x, y, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
      } catch (e) { /* page is gone */ }
    }

    function togglePlay() {
      if (!video) { return direct ? null : clickAt(WIDTH / 2, HEIGHT / 2); }

      if (video.paused && !started && !direct) {
        // not started yet: the page may want a click on its play button first
        play();
        clickVideo();
      } else if (video.paused) {
        play();
      } else {
        pausedByUser = true;
        video.pause();
      }
      setTimeout(function () {
        render();
        showHud(4000);
      }, 100);
    }

    function seek(seconds) {
      if (!video || !isFinite(video.duration)) { return; }
      try {
        video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + seconds));
      } catch (e) { /* ignore */ }
      render();
      showHud(4000);
    }

    /**
     * Until the video plays: click where the play button usually is (the middle of the video,
     * the middle of the screen while no video was found), then show the cursor.
     */
    function waitForStart() {
      var waiting = Date.now() - openedAt;

      if (SM.settings.playerAutoClick && clicks < 2 && waiting > CLICK_AFTER * (clicks + 1)) {
        clicks++;
        clickVideo();
      }
      if (mode === 'video' && waiting > NO_VIDEO_AFTER) { setMode('cursor'); }
    }

    function check() {
      if (closed) { return; }

      if (!direct) {
        // once the episode plays it is kept, before that the best video is searched every time
        var keep = started && isEpisode(video);
        var found = keep ? video : findVideo();

        if (found !== video) {
          // another video than before: remove the marks of the old one and start over
          unmarkAll();
          video = found;
          started = false;
          if (video && mode === 'cursor') { setMode('video'); }
        }
      }

      if (video) {
        // a preview is never shown in fullscreen, the player keeps waiting for the episode
        if (!video.paused && video.currentTime > 0 && !isPreview(video)) {
          if (!started) {
            started = true;
            // the video was started with the cursor: show it in fullscreen now
            if (mode === 'cursor') { setMode('video'); }
            showHud(5000);
          }
          if (!direct) { maximize(video); }
        } else if (!started && !pausedByUser && !isPreview(video)) {
          play();
        }
        if (!started && !direct) { waitForStart(); }
        if (isFinite(video.duration) && video.duration > 0) {
          watched = Math.max(watched, video.currentTime / video.duration);
        }
        if (video.ended) { return close(); }
      } else if (!direct) {
        waitForStart();
      }

      if (direct && !started && Date.now() - openedAt > GIVE_UP_AFTER) {
        SM.ui.toast('The TV could not load this video.');
        return close();
      }
      render();
    }

    // ---- cursor ----

    function moveCursor(dx, dy) {
      var now = Date.now();
      speed = now - lastMove < 200 ? Math.min(speed + 8, 90) : 24; // faster while the key is held
      lastMove = now;

      position.x = Math.max(0, Math.min(WIDTH - 1, position.x + dx * speed));
      position.y = Math.max(0, Math.min(HEIGHT - 1, position.y + dy * speed));
      cursor.style.transform = 'translate3d(' + position.x + 'px, ' + position.y + 'px, 0)';
      hoverAt(position.x, position.y);
    }

    function close() {
      if (closed) { return; }
      SM.router.back();
    }

    function onKey(code) {
      if (mode === 'cursor') {
        switch (code) {
          case KEY.LEFT: moveCursor(-1, 0); return true;
          case KEY.RIGHT: moveCursor(1, 0); return true;
          case KEY.UP: moveCursor(0, -1); return true;
          case KEY.DOWN: moveCursor(0, 1); return true;
          case KEY.ENTER:
            clickAt(position.x, position.y);
            setTimeout(check, 500);
            return true;
          case KEY.BACK:
          case KEY.ESCAPE:
            if (video) {
              setMode('video');
            } else {
              close();
            }
            return true;
        }
      } else {
        switch (code) {
          case KEY.LEFT: seek(-10); return true;
          case KEY.RIGHT: seek(10); return true;
          case KEY.UP:
          case KEY.DOWN: setMode('cursor'); return true;
          case KEY.ENTER: togglePlay(); return true;
          case KEY.BACK:
          case KEY.ESCAPE: close(); return true;
        }
      }

      switch (code) {
        case KEY.PLAY:
        case KEY.PAUSE:
        case KEY.PLAY_PAUSE:
        case KEY.P: togglePlay(); return true;
        case KEY.REWIND: seek(-60); return true;
        case KEY.FAST_FORWARD: seek(60); return true;
        case KEY.STOP:
        case KEY.BACKSPACE: close(); return true;
      }
      return false;
    }

    return {
      el: el,
      topbar: false,

      init: function () {
        setScreenSaver(false);
        render();
        showHud(5000);
        scanTimer = setInterval(check, SCAN_INTERVAL);
      },

      defaultFocus: function () {
        return null;
      },

      onKey: onKey,

      destroy: function () {
        closed = true;
        clearInterval(scanTimer);
        clearTimeout(hudTimer);
        setScreenSaver(true);

        // stops the video and everything the page has loaded
        try {
          if (direct) {
            media.pause();
            media.removeAttribute('src');
            media.load();
          } else {
            media.src = 'about:blank';
          }
        } catch (e) { /* ignore */ }

        var seen = watched;
        setTimeout(function () {
          SM.player.finished(params.show, params.episodeNo, seen);
        }, 0);
      }
    };
  };
})();
