/*
 * showmaniac TV - start, screens and remote control keys.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var h = SM.h;

  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 10009, ESCAPE: 27, BACKSPACE: 8,
    PLAY: 415, PLAY_PAUSE: 10252, P: 80,
    IME_DONE: 65376, IME_CANCEL: 65385
  };
  var DIRECTIONS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
  var RESYNC_AFTER = 10 * 60 * 1000;

  var stage = document.getElementById('stage');
  var views = document.getElementById('views');
  var topbar = document.getElementById('topbar');
  var menu = document.getElementById('menu');
  var stack = [];

  function current() {
    return stack[stack.length - 1];
  }

  // ---- screens ----

  function activate(view) {
    view.el.classList.remove('hidden');
    topbar.classList.toggle('hidden', !view.topbar);
    topbar._navLast = null; // moving up to the menu starts at the active item

    Array.prototype.forEach.call(menu.children, function (item) {
      var active = item.getAttribute('data-key') === 'menu:' + view.name;
      item.classList.toggle('active', active);
      item.classList.toggle('nav-default', active);
    });
  }

  function open(name, params) {
    var previous = current();
    if (previous) {
      previous.focusKey = SM.nav.current && SM.nav.current.getAttribute('data-key');
      previous.el.classList.add('hidden');
    }

    var view = SM.views[name](params || {});
    view.name = name;
    stack.push(view);
    views.appendChild(view.el);

    activate(view);
    SM.ui.backdrop(null); // screens with a show set their own image
    view.init();
    SM.nav.focus(view.defaultFocus());
  }

  function close(view) {
    if (view.el.parentNode) { view.el.parentNode.removeChild(view.el); }
  }

  function exit() {
    try {
      window.tizen.application.getCurrentApplication().exit();
    } catch (e) {
      window.close();
    }
  }

  SM.router = {
    current: current,

    /** Opens a screen on top of the current one, the back key returns */
    go: open,

    /** Opens one of the main screens of the menu */
    root: function (name) {
      while (stack.length) { close(stack.pop()); }
      open(name);
    },

    back: function () {
      if (stack.length > 1) {
        close(stack.pop());

        var view = current();
        activate(view);
        SM.ui.backdrop(null);
        if (view.onStoreChange) { view.onStoreChange(); }
        SM.nav.current = null;
        SM.nav.focus(SM.nav.find(view.focusKey));
        return;
      }
      if (current().name !== 'home') { return SM.router.root('home'); }

      SM.ui.dialog({
        title: 'Exit showmaniac?',
        buttons: [{ label: 'Exit', action: exit }, { label: 'Stay' }]
      });
    }
  };

  // ---- hooks for the focus handling ----

  SM.app = {
    /** Elements the focus can move in: only the dialog while one is open */
    navRoots: function () {
      if (SM.ui.isDialogOpen()) { return [document.getElementById('dialog')]; }

      var view = current();
      if (!view) { return []; }
      return view.topbar ? [topbar, view.el] : [view.el];
    },

    defaultFocus: function () {
      if (SM.ui.isDialogOpen()) { return null; }
      var view = current();
      return view ? view.defaultFocus() : null;
    },

    onFocus: function (el) {
      var view = current();
      if (view && view.onFocus && view.el.contains(el)) { view.onFocus(el); }
    },

    updateMenu: function () {
      var items = [
        { name: 'home', label: 'Home' },
        { name: 'search', label: 'Search' },
        { name: 'account', label: SM.auth.isSignedIn() ? SM.auth.user.email : 'Sign in' }
      ];
      var focused = SM.nav.current && SM.nav.current.getAttribute('data-key');

      menu.textContent = '';
      items.forEach(function (item) {
        var key = 'menu:' + item.name;
        var active = current() && current().name === item.name;

        menu.appendChild(h('div', {
          class: 'menu-item focusable' + (active ? ' active nav-default' : '') + (key === focused ? ' focus' : ''),
          'data-key': key,
          text: item.label,
          onclick: function () { SM.router.root(item.name); }
        }));
      });

      if (focused && focused.indexOf('menu:') === 0) { SM.nav.current = SM.nav.find(focused); }
    }
  };

  // ---- remote control ----

  function onKeyDown(event) {
    var code = event.keyCode;

    if (SM.nav.isTyping()) {
      var input = document.activeElement;

      if (code === KEY.ENTER || code === KEY.IME_DONE) {
        event.preventDefault();
        input.blur();
        if (current().onInputDone) { current().onInputDone(input); }
        return;
      }
      if (code === KEY.IME_CANCEL || code === KEY.ESCAPE || code === KEY.BACK) {
        event.preventDefault();
        input.blur();
        return;
      }
      if (code !== KEY.UP && code !== KEY.DOWN) { return; } // typing and moving the cursor
      input.blur();
    }

    if (DIRECTIONS[code]) {
      event.preventDefault();
      return SM.nav.move(DIRECTIONS[code]);
    }

    switch (code) {
      case KEY.ENTER:
        event.preventDefault();
        SM.nav.activate();
        break;

      case KEY.BACK:
      case KEY.ESCAPE:
      case KEY.BACKSPACE:
        event.preventDefault();
        if (SM.ui.isDialogOpen()) {
          SM.ui.cancelDialog();
        } else {
          SM.router.back();
        }
        break;

      case KEY.PLAY:
      case KEY.PLAY_PAUSE:
      case KEY.P:
        if (!SM.ui.isDialogOpen() && current().onPlay) { current().onPlay(); }
        break;
    }
  }

  function registerKeys() {
    ['MediaPlay', 'MediaPlayPause'].forEach(function (name) {
      try { window.tizen.tvinputdevice.registerKey(name); } catch (e) { /* not on a TV */ }
    });
  }

  // the app is designed for 1920x1080, everything else is scaled
  function fit() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = scale && Math.abs(scale - 1) > 0.001 ? 'scale(' + scale + ')' : '';
  }

  function onVisible() {
    if (document.hidden) { return; }

    SM.player.askIfSeen();
    if (Date.now() - SM.store.lastSync > RESYNC_AFTER) { SM.store.sync(); }
  }

  // ---- start ----

  function start() {
    fit();
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisible);
    registerKeys();

    SM.store.load();
    SM.store.on(function () {
      if (!SM.auth.isSignedIn() && menu.lastChild && menu.lastChild.textContent !== 'Sign in') { SM.app.updateMenu(); }

      var view = current();
      if (view && view.onStoreChange) { SM.nav.preserve(view.onStoreChange); }
    });

    SM.app.updateMenu();
    SM.router.root('home');
    SM.player.askIfSeen();
    SM.store.sync();
  }

  start();
})();
