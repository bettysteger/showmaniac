/*
 * showmaniac TV - home: rows of posters, the top of the screen shows the focused show.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var h = SM.h;

  function time(date) {
    return SM.isDate(date) ? new Date(date).getTime() : 0;
  }

  function latest(show) {
    return show.latestepisode || {};
  }

  function upcoming(show) {
    return show.nextepisode || {};
  }

  function byLatest(a, b) {
    return time(latest(b).date) - time(latest(a).date);
  }

  function byNext(a, b) {
    return time(upcoming(a).date) - time(upcoming(b).date);
  }

  function buildRows() {
    var shows = SM.store.shows;
    var names = shows.map(function (show) { return show.name; });

    var toWatch = shows.filter(function (show) { return !show.seen && SM.isDate(latest(show).date); }).sort(byLatest);
    var comingUp = shows.filter(function (show) { return SM.isFuture(upcoming(show).date); }).sort(byNext);
    var caughtUp = shows.filter(function (show) { return show.seen; }).sort(byLatest);
    var notAired = shows.filter(function (show) { return !show.seen && !SM.isDate(latest(show).date); });
    var popular = SM.popular.shows.filter(function (show) {
      return !SM.store.get(show.id) && names.indexOf(show.name) === -1;
    });

    return [{
      id: 'watch',
      title: toWatch.length + ' to watch',
      shows: toWatch,
      label: function (show) { return latest(show).number; }
    }, {
      id: 'next',
      title: 'Coming up',
      shows: comingUp,
      label: function (show) { return SM.formatDate(upcoming(show).date); }
    }, {
      id: 'seen',
      title: toWatch.length ? 'Watched' : 'All watched',
      shows: caughtUp
    }, {
      id: 'waiting',
      title: 'Not aired yet',
      shows: notAired
    }, {
      id: 'popular',
      title: 'Popular',
      shows: popular
    }].filter(function (row) {
      return row.shows.length;
    });
  }

  function metaLine(show) {
    var channel = show.network || show.webChannel;
    return [
      channel && channel.name,
      show.premiered && String(show.premiered).slice(0, 4),
      show.runtime && show.runtime + ' min',
      show.rating && show.rating.average && '★ ' + show.rating.average
    ].filter(Boolean).join('  ·  ');
  }

  function episodeLine(title, episode) {
    if (!episode || !episode.date) { return null; }
    var text = SM.isDate(episode.date) ? [episode.number, SM.formatDate(episode.date, true)].filter(Boolean).join('  ·  ') : SM.formatDate(episode.date);

    return h('div', { class: 'info-line' }, [
      h('span', { class: 'info-title', text: title }),
      h('span', { text: text })
    ]);
  }

  /** Title, state and episode dates of a show, used on top of home and on the detail screen */
  SM.ui.showInfo = function (show, summaryLines) {
    var tracked = SM.store.get(show.id);
    var state = null;

    if (tracked && SM.isDate(latest(tracked).date)) {
      state = tracked.seen ?
        h('span', { class: 'pill pill-seen' }, [SM.icon('check'), h('span', { text: 'Seen' })]) :
        h('span', { class: 'pill', text: tracked.lastSeen ? 'Last seen ' + tracked.lastSeen : 'New episode' });
    }

    return [
      h('h1', { text: show.name }),
      h('div', { class: 'meta' }, [state, h('span', { text: metaLine(show) })]),
      episodeLine('Latest', show.latestepisode),
      episodeLine('Next', show.nextepisode),
      h('p', { class: 'summary lines-' + summaryLines, text: SM.stripHtml(show.summary) })
    ];
  };

  SM.views.home = function () {
    var billboard = h('div', { class: 'billboard' });
    var scroll = h('div', { class: 'view-scroll', 'data-scroll': 'align' });
    var el = h('div', { class: 'view view-home' }, [billboard, h('div', { class: 'rows' }, [scroll])]);
    var shown = null;

    function showBillboard(show) {
      shown = show;
      billboard.textContent = '';

      if (!show) {
        SM.ui.backdrop(null);
        billboard.appendChild(h('h1', { text: 'Welcome to showmaniac' }));
        billboard.appendChild(h('p', {
          class: 'summary',
          text: SM.auth.isSignedIn() ?
            'Your list is empty. Use Search to add your favorite TV shows.' :
            'Sign in to load your shows, or use Search to add shows on this TV.'
        }));
        return;
      }

      SM.ui.showInfo(show, 3).forEach(function (child) {
        if (child) { billboard.appendChild(child); }
      });
      SM.ui.backdrop(show);
    }

    function render() {
      var positions = {};
      Array.prototype.forEach.call(scroll.querySelectorAll('.row-track'), function (track) {
        positions[track.getAttribute('data-row')] = track._x || 0;
      });

      var rows = buildRows();
      scroll.textContent = '';

      rows.forEach(function (row) {
        var track = h('div', { class: 'row-track', 'data-row': row.id }, row.shows.map(function (show) {
          return SM.ui.card(show, row.id + ':' + show.id, row.label ? row.label(show) : null);
        }));

        track._x = positions[row.id] || 0;
        track.style.transform = 'translate3d(' + (-track._x) + 'px, 0, 0)';

        scroll.appendChild(h('div', { class: 'row', 'data-nav-row': true }, [
          h('h2', { class: 'row-title', text: row.title }),
          h('div', { class: 'row-viewport' }, [track])
        ]));
      });

      // the show on top may have changed or is gone
      var current = shown && (SM.store.get(shown.id) || shown);
      if (!current && rows.length) { current = rows[0].shows[0]; }
      showBillboard(rows.length ? current : null);
    }

    function isActive() {
      var current = SM.router.current();
      return !!current && current.el === el && !SM.ui.isDialogOpen();
    }

    // renders again, the first shows that arrive (sync, popular) get the focus
    function update() {
      var wasEmpty = !scroll.firstChild;
      render();
      if (wasEmpty && scroll.firstChild && isActive()) { SM.nav.focus(el.querySelector('.card')); }
    }

    function focusedShow() {
      var current = SM.nav.current;
      return current && el.contains(current) ? current._show : null;
    }

    return {
      el: el,
      topbar: true,

      init: function () {
        render();

        SM.popular.load().then(function () {
          if (SM.popular.shows.length && document.body.contains(el)) { SM.nav.preserve(update); }
        });
      },

      defaultFocus: function () {
        return el.querySelector('.card');
      },

      onFocus: function (focused) {
        if (focused._show && focused._show !== shown) { showBillboard(focused._show); }
      },

      onStoreChange: update,

      onPlay: function () {
        var show = focusedShow();
        if (show) { SM.player.playNext(SM.store.get(show.id) || show); }
      }
    };
  };
})();
