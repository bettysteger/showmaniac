/*
 * showmaniac TV - search TV shows (TVmaze), popular shows are suggested before typing.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var h = SM.h;
  var PER_ROW = 7;

  SM.views.search = function () {
    var input = h('input', {
      class: 'input focusable',
      type: 'text',
      placeholder: 'Search TV shows',
      autocomplete: 'off',
      spellcheck: 'false',
      'data-key': 'search:input'
    });
    var title = h('h2', { class: 'row-title' });
    var grid = h('div', { class: 'grid' });
    var scroll = h('div', { class: 'view-scroll', 'data-margin-top': 140, 'data-margin-bottom': 40 }, [
      h('div', { class: 'form-row', 'data-nav-row': true, 'data-scroll-top': true }, [input]),
      title,
      grid
    ]);
    var el = h('div', { class: 'view view-search' }, [scroll]);

    var results = null; // null = nothing searched yet
    var latestSearch = 0;

    function render() {
      var shows = results || SM.popular.shows.filter(function (show) { return !SM.store.get(show.id); });

      if (results) {
        title.textContent = results.length ? 'Results' : 'No shows found for "' + input.value.trim() + '"';
      } else {
        title.textContent = shows.length ? 'Popular' : '';
      }

      grid.textContent = '';
      for (var i = 0; i < shows.length; i += PER_ROW) {
        var cards = shows.slice(i, i + PER_ROW).map(function (show) {
          return SM.ui.card(show, 'result:' + show.id);
        });
        grid.appendChild(h('div', { class: 'grid-row', 'data-nav-row': true, 'data-nav-mode': 'nearest' }, cards));
      }
    }

    function update() {
      if (document.body.contains(el)) { SM.nav.preserve(render); }
    }

    var search = SM.debounce(function () {
      var query = input.value.trim();
      var request = ++latestSearch;

      if (!query) {
        results = null;
        return update();
      }

      SM.ui.busy(1);
      SM.api.tvmaze.search(query).then(function (shows) {
        SM.ui.busy(-1);
        if (request !== latestSearch) { return; }
        results = shows;
        update();
      }, function () {
        SM.ui.busy(-1);
        if (request === latestSearch) { SM.ui.toast('Search failed. Please check the network connection.'); }
      });
    }, 500);

    input.addEventListener('input', search);

    return {
      el: el,
      topbar: true,

      init: function () {
        render();
        SM.popular.load().then(function () {
          if (!results) { update(); }
        });
      },

      defaultFocus: function () {
        return input;
      },

      onStoreChange: render,

      onPlay: function () {
        var current = SM.nav.current;
        if (current && current._show) { SM.player.playNext(SM.store.get(current._show.id) || current._show); }
      }
    };
  };
})();
