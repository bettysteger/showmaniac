/*
 * showmaniac TV - small UI pieces: toast, dialog, busy indicator and the background image.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var h = SM.h;
  var ui = SM.ui = {};

  // ---- busy indicator ----

  var busyCount = 0;

  ui.busy = function (delta) {
    busyCount = Math.max(0, busyCount + delta);
    document.getElementById('busy').classList.toggle('hidden', busyCount === 0);
  };

  // ---- toast ----

  var toastTimer;

  ui.toast = function (message) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.classList.remove('hidden');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 4000);
  };

  // ---- dialog ----

  var dialog = null;

  /**
   * @param {Object} options { title, message, buttons: [{ label, icon, action }], onCancel }
   *                         the first button gets the focus, the back key cancels
   */
  ui.dialog = function (options) {
    if (dialog) { ui.closeDialog(); }

    var el = document.getElementById('dialog');
    var buttons = options.buttons.map(function (button) {
      return h('div', {
        class: 'button focusable',
        onclick: function () {
          ui.closeDialog();
          if (button.action) { button.action(); }
        }
      }, [button.icon ? SM.icon(button.icon) : null, h('span', { text: button.label })]);
    });

    el.textContent = '';
    el.appendChild(h('div', { class: 'dialog-box' }, [
      h('h2', { text: options.title }),
      options.message ? h('p', { text: options.message }) : null,
      h('div', { class: 'dialog-buttons', 'data-nav-row': true }, buttons)
    ]));
    el.classList.remove('hidden');

    dialog = {
      previous: SM.nav.current,
      previousKey: SM.nav.current && SM.nav.current.getAttribute('data-key'),
      onCancel: options.onCancel
    };
    SM.nav.focus(buttons[0]);
  };

  ui.isDialogOpen = function () {
    return !!dialog;
  };

  ui.closeDialog = function () {
    if (!dialog) { return; }

    var previous = dialog.previous;
    var previousKey = dialog.previousKey;
    dialog = null;
    document.getElementById('dialog').classList.add('hidden');

    // the screen behind the dialog may have been rendered again meanwhile
    var stillThere = previous && document.body.contains(previous);
    SM.nav.focus(stillThere ? previous : SM.nav.find(previousKey));
  };

  ui.cancelDialog = function () {
    if (!dialog) { return; }

    var onCancel = dialog.onCancel;
    ui.closeDialog();
    if (onCancel) { onCancel(); }
  };

  // ---- poster card ----

  /**
   * @param {Object} show
   * @param {String} key   unique on the screen, used to keep the focus when rendering again
   * @param {String} label optional text on the poster, e.g. the episode number
   */
  ui.card = function (show, key, label) {
    var poster = SM.poster(show);
    var tracked = SM.store.get(show.id);

    var card = h('div', {
      class: 'card focusable',
      'data-key': key,
      onclick: function () { SM.router.go('detail', { show: show }); }
    }, [
      poster ? h('img', { src: poster, alt: '' }) : h('div', { class: 'card-name', text: show.name }),
      label ? h('div', { class: 'card-label', text: label }) : null,
      tracked && tracked.seen ? h('div', { class: 'card-seen' }, [SM.icon('check')]) : null
    ]);

    card._show = show;
    return card;
  };

  // ---- background image ----

  var layers = null;
  var front = 0;
  var currentImage = null;
  var wanted = 0;

  function paint(url, blurred) {
    var key = url + (blurred ? '#blur' : '');
    if (key === currentImage) { return; }
    currentImage = key;

    layers = layers || document.querySelectorAll('#backdrop .bg-layer');
    front = 1 - front;

    var show = layers[front];
    var hide = layers[1 - front];

    show.style.backgroundImage = url ? 'url("' + url.replace(/"/g, '%22') + '")' : 'none';
    show.classList.toggle('blurred', !!blurred);
    show.classList.add('visible');
    hide.classList.remove('visible');
  }

  function load(url, blurred, request) {
    var image = new Image();
    image.onload = function () {
      if (request === wanted) { paint(url, blurred); }
    };
    image.src = url;
  }

  var update = SM.debounce(function (show, request) {
    SM.images.backdrop(show).then(function (url) {
      if (request !== wanted) { return; }

      var poster = show.image ? SM.https(show.image.original || show.image.medium) : null;
      if (url) {
        load(url, false, request);
      } else if (poster) {
        load(poster, true, request);
      } else {
        paint(null);
      }
    });
  }, 350);

  /** Shows a wide image of the show behind the screen, waits until the focus rests on a show */
  ui.backdrop = function (show) {
    wanted++;
    if (!show) { return paint(null); }
    update(show, wanted);
  };
})();
