/*
 * showmaniac TV - search: TV shows (TVmaze) and movies (TMDB), popular ones are suggested before typing.
 * A show opens its details, a movie plays right away.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var h = SM.h;
  var PER_ROW = 7;

  /**
   * @param {Object} options {
   *   placeholder, noResults: 'No shows found for',
   *   search: function (query) => Promise of items, rejects with error.toast for an own message,
   *   popular: function () => items, loadPopular: function () => Promise,
   *   card: function (item, key) => element, onPlay: function (card) plays the focused card
   * }
   */
  function searchView(options) {
    var input = h('input', {
      class: 'input focusable',
      type: 'text',
      placeholder: options.placeholder,
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
      var items = results || options.popular();

      if (results) {
        title.textContent = results.length ? 'Results' : options.noResults + ' "' + input.value.trim() + '"';
      } else {
        title.textContent = items.length ? 'Popular' : '';
      }

      grid.textContent = '';
      for (var i = 0; i < items.length; i += PER_ROW) {
        var cards = items.slice(i, i + PER_ROW).map(function (item) {
          return options.card(item, 'result:' + item.id);
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
      options.search(query).then(function (items) {
        SM.ui.busy(-1);
        if (request !== latestSearch) { return; }
        results = items;
        update();
      }, function (error) {
        SM.ui.busy(-1);
        if (request === latestSearch) { SM.ui.toast(error.toast || 'Search failed. Please check the network connection.'); }
      });
    }, 500);

    input.addEventListener('input', search);

    return {
      el: el,
      topbar: true,

      init: function () {
        render();
        options.loadPopular().then(function () {
          if (!results) { update(); }
        });
      },

      defaultFocus: function () {
        return input;
      },

      onStoreChange: render,

      onPlay: function () {
        if (SM.nav.current) { options.onPlay(SM.nav.current); }
      }
    };
  }

  SM.views.search = function () {
    return searchView({
      placeholder: 'Search TV shows',
      noResults: 'No shows found for',
      search: SM.api.tvmaze.search,
      popular: function () {
        return SM.popular.shows.filter(function (show) { return !SM.store.get(show.id); });
      },
      loadPopular: SM.popular.load,
      card: SM.ui.card,
      onPlay: function (card) {
        if (card._show) { SM.player.playNext(SM.store.get(card._show.id) || card._show); }
      }
    });
  };

  var popularMovies = [];
  var popularMoviesLoaded = null;

  SM.views.movies = function () {
    return searchView({
      placeholder: 'Search movies',
      noResults: 'No movies found for',
      search: function (query) {
        if (!SM.player.canPlayMovies()) {
          var error = new Error('Movies can not be played');
          error.toast = 'Movies need a TMDB API key (VITE_TMDB_API_KEY) and a player address (moviePlayerUrl).';
          return Promise.reject(error);
        }
        return SM.api.tmdb.searchMovies(query);
      },
      popular: function () { return popularMovies; },
      loadPopular: function () {
        if (!SM.player.canPlayMovies()) { return Promise.resolve(); }
        // loaded once, a failed attempt is tried again on the next visit
        popularMoviesLoaded = popularMoviesLoaded || SM.api.tmdb.popularMovies().then(function (movies) {
          popularMovies = movies;
        }, function () {
          popularMoviesLoaded = null;
        });
        return popularMoviesLoaded;
      },
      card: SM.ui.movieCard,
      onPlay: function (card) {
        if (card._movie) { SM.player.playMovie(card._movie); }
      }
    });
  };
})();
