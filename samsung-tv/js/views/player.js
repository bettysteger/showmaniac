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
  var NO_VIDEO_AFTER = 12000; // switch to the cursor if no video was found until then
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

    /** Embedded pages that contain the video fill the whole screen */
    function maximize(element) {
      var doc = element.ownerDocument;
      var win = doc.defaultView;
      var depth = 0;

      while (win && win !== window && win.frameElement && depth++ < MAX_DEPTH) {
        var frame = win.frameElement;
        if (frame === media) { break; }

        if (!frame.__showmaniac) {
          frame.__showmaniac = true;
          frame.style.cssText += ';position:fixed !important;left:0 !important;top:0 !important;' +
            'width:100% !important;height:100% !important;max-width:none !important;max-height:none !important;' +
            'border:0 !important;margin:0 !important;z-index:2147483647 !important;background:#000 !important;';
        }
        win = frame.ownerDocument.defaultView;
      }
    }

    function findVideo() {
      var best = null;
      var bestScore = 0;

      walk(media.contentWindow, 0, function (win, doc) {
        prepare(win, doc);

        Array.prototype.forEach.call(doc.querySelectorAll('video'), function (candidate) {
          var rect = candidate.getBoundingClientRect();
          var score = rect.width * rect.height + 1;
          if (candidate.duration > 60) { score *= 4; }
          if (!candidate.paused) { score *= 2; }

          if (score > bestScore) {
            best = candidate;
            bestScore = score;
          }
        });
      });
      return best;
    }

    function clickAt(x, y) {
      var win = null;
      try { win = media.contentWindow; } catch (e) { return false; }

      for (var depth = 0; depth <= MAX_DEPTH; depth++) {
        var target;
        try { target = win.document.elementFromPoint(x, y); } catch (e) { return false; }
        if (!target) { return false; }

        if (target.tagName === 'IFRAME' || target.tagName === 'FRAME') {
          var rect = target.getBoundingClientRect();
          x -= rect.left + target.clientLeft;
          y -= rect.top + target.clientTop;
          win = target.contentWindow;
          continue;
        }
        fire(win, target, x, y, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
        return true;
      }
      return false;
    }

    function fire(win, target, x, y, types) {
      types.forEach(function (type) {
        var Constructor = type.indexOf('pointer') === 0 ? win.PointerEvent : win.MouseEvent;
        if (!Constructor) { return; }
        try {
          target.dispatchEvent(new Constructor(type, { bubbles: true, cancelable: true, view: win, clientX: x, clientY: y, button: 0 }));
        } catch (e) { /* ignore */ }
      });
    }

    // lets players show their controls when the cursor moves over them
    function hoverAt(x, y) {
      try {
        var win = media.contentWindow;
        for (var depth = 0; depth <= MAX_DEPTH; depth++) {
          var target = win.document.elementFromPoint(x, y);
          if (!target) { return; }
          if (target.tagName !== 'IFRAME' && target.tagName !== 'FRAME') { return fire(win, target, x, y, ['mousemove']); }

          var rect = target.getBoundingClientRect();
          x -= rect.left + target.clientLeft;
          y -= rect.top + target.clientTop;
          win = target.contentWindow;
        }
      } catch (e) { /* no access */ }
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

    function togglePlay() {
      if (!video) { return direct ? null : clickAt(WIDTH / 2, HEIGHT / 2); }

      if (video.paused) {
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

    function check() {
      if (closed) { return; }

      if (!direct) {
        var found = findVideo();
        if (found !== video) {
          video = found;
          if (video && mode === 'cursor' && !started) { setMode('video'); }
        }
      }

      if (video) {
        if (!video.paused && video.currentTime > 0) {
          if (!started) {
            started = true;
            showHud(5000);
          }
          if (!direct) { maximize(video); }
        } else if (!started && !pausedByUser) {
          play();
        }
        if (isFinite(video.duration) && video.duration > 0) {
          watched = Math.max(watched, video.currentTime / video.duration);
        }
        if (video.ended) { return close(); }
      } else if (!direct) {
        var waiting = Date.now() - openedAt;

        // many players only create the video after a click on their preview image
        if (SM.settings.playerAutoClick && clicks < 2 && waiting > CLICK_AFTER * (clicks + 1)) {
          clicks++;
          clickAt(WIDTH / 2, HEIGHT / 2);
        }
        if (mode === 'video' && waiting > NO_VIDEO_AFTER) { setMode('cursor'); }
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
