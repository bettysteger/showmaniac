/*
 * showmaniac TV - one show: play the next episode, mark episodes as seen, browse all episodes.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var h = SM.h;

  function button(key, icon, label, onclick, active) {
    return h('div', {
      class: 'button focusable' + (active ? ' active' : ''),
      'data-key': key,
      onclick: onclick
    }, [icon ? SM.icon(icon) : null, h('span', { text: label })]);
  }

  var SPECIALS = 'specials'; // key of the specials tab

  /** @param {Object} params { show } a tracked show or a show from search/popular */
  SM.views.detail = function (params) {
    var id = params.show.id;
    var show = SM.store.get(id) || params.show;
    var episodes = null; // null while loading
    var specials = []; // episodes without a number, e.g. a Halloween special
    var services = []; // official streaming services with a page for the show
    var failed = false;
    var season = null; // season number or SPECIALS

    var head = h('div', { class: 'detail-head' });
    var actions = h('div', { class: 'row-track' });
    var seasons = h('div', { class: 'row-track' });
    var list = h('div', { class: 'episodes' });

    var scroll = h('div', { class: 'view-scroll', 'data-margin-top': 150, 'data-margin-bottom': 60 }, [
      head,
      h('div', { class: 'row detail-actions', 'data-nav-row': true, 'data-scroll-top': true }, [
        h('div', { class: 'row-viewport' }, [actions])
      ]),
      h('div', { class: 'row detail-seasons', 'data-nav-row': true }, [
        h('div', { class: 'row-viewport' }, [seasons])
      ]),
      list
    ]);
    var el = h('div', { class: 'view view-detail' }, [scroll]);

    function isTracked() {
      return !!SM.store.get(id);
    }

    function latestNo() {
      return show.latestepisode && show.latestepisode.number;
    }

    function nextNo() {
      return episodes ? SM.store.nextToWatch(show, episodes) : latestNo();
    }

    function play() {
      if (episodes) { return SM.player.play(show, nextNo()); }
      SM.player.playNext(show);
    }

    function confirmRemove() {
      SM.ui.dialog({
        title: 'Remove ' + show.name + '?',
        message: 'The show is removed from your list on all your devices.',
        buttons: [{
          label: 'Remove',
          icon: 'close',
          action: function () {
            SM.store.remove(show);
            SM.router.back();
          }
        }, {
          label: 'Cancel'
        }]
      });
    }

    function renderHead() {
      head.textContent = '';
      SM.ui.showInfo(show, 4).forEach(function (child) {
        if (child) { head.appendChild(child); }
      });
      if (show.tmdb === 0 && !SM.player.canPlay(show)) {
        head.appendChild(h('p', { class: 'hint', text: 'There is no play link for this show.' }));
      }
    }

    function renderActions() {
      var tracked = isTracked();
      var next = nextNo();
      var latest = latestNo();
      var hasAired = SM.isDate(show.latestepisode && show.latestepisode.date);

      actions.textContent = '';

      if (SM.player.canPlay(show) && hasAired) {
        actions.appendChild(button('action:play', 'play', next ? 'Play ' + next : 'Play', play));
      }
      services.forEach(function (service) {
        actions.appendChild(button('action:service:' + service.name, 'play', service.name, function () {
          SM.player.openService(show, hasAired ? next : null, service);
        }));
      });
      if (tracked && hasAired && !show.seen && episodes && next && next !== latest) {
        actions.appendChild(button('action:catchup', 'up', 'Mark ' + next + ' as seen', function () {
          SM.store.markSeen(show, next);
        }));
      }
      if (tracked && hasAired) {
        actions.appendChild(button('action:seen', 'check', show.seen ? 'Seen' : 'Mark all as seen', function () {
          SM.store.toggleSeen(show);
        }, show.seen));
      }
      if (tracked) {
        actions.appendChild(button('action:track', 'close', 'Remove', confirmRemove));
      } else {
        actions.appendChild(button('action:track', 'plus', 'Track this show', function () {
          SM.store.add(show).catch(function () {
            SM.ui.toast('Could not add the show. Please check the network connection.');
          });
        }));
      }
    }

    function seasonNumbers() {
      var numbers = [];
      (episodes || []).forEach(function (episode) {
        if (numbers.indexOf(episode.season) === -1) { numbers.push(episode.season); }
      });
      return numbers;
    }

    function renderSeasons() {
      seasons.textContent = '';
      seasonNumbers().forEach(function (number) {
        var tab = h('div', {
          class: 'tab focusable' + (number === season ? ' active nav-default' : ''),
          'data-key': 'season:' + number,
          text: 'Season ' + number,
          onclick: function () {
            // jump to the next episode to watch if it is part of this season
            var target = list.querySelector('[data-key="episode:' + nextNo() + '"]') || list.querySelector('.focusable');
            if (target) { SM.nav.focus(target); }
          }
        });
        tab._season = number;
        seasons.appendChild(tab);
      });

      if (specials.length) {
        var tab = h('div', {
          class: 'tab focusable' + (season === SPECIALS ? ' active nav-default' : ''),
          'data-key': 'season:' + SPECIALS,
          text: 'Specials',
          onclick: function () {
            var target = list.querySelector('.focusable');
            if (target) { SM.nav.focus(target); }
          }
        });
        tab._season = SPECIALS;
        seasons.appendChild(tab);
      }
    }

    function seenUntil(numbers) {
      if (!isTracked()) { return -1; }
      if (show.seen) {
        var index = numbers.indexOf(latestNo());
        return index === -1 ? numbers.length - 1 : index;
      }
      return show.lastSeen ? numbers.indexOf(show.lastSeen) : -1;
    }

    /**
     * The first episode that has not aired, right after an aired one: air dates are sometimes wrong
     * (the episode is already out), so it can be played. The player gives up if no stream loads.
     */
    function isNextUpcoming(episode) {
      var index = episodes ? episodes.indexOf(episode) : -1;
      return index > 0 && !episode.aired && episodes[index - 1].aired;
    }

    function openEpisode(episode) {
      var airs = SM.isDate(episode.airstamp) ? 'Airs on ' + SM.formatDate(episode.airstamp, true) : 'Not aired yet';
      var early = !episode.aired;
      if (early && !isNextUpcoming(episode)) { return SM.ui.toast(airs); }

      var buttons = [];
      if (SM.player.canPlay(show)) {
        buttons.push({
          label: 'Play',
          icon: 'play',
          action: function () { SM.player.play(show, episode.no, { early: early }); }
        });
      }
      if (isTracked()) {
        buttons.push({
          label: 'Seen up to here',
          icon: 'check',
          action: function () { SM.store.markSeen(show, episode.no); }
        });
      }
      buttons.push({ label: 'Cancel' });

      SM.ui.dialog({
        title: show.name + ' ' + episode.no,
        message: early ? airs + ', it may already be available.' : episode.name,
        buttons: buttons
      });
    }

    function renderEpisodes() {
      list.textContent = '';

      if (!episodes) {
        list.appendChild(h('p', {
          class: 'hint',
          text: failed ? 'Could not load the episodes. Please check the network connection.' : 'Loading episodes ...'
        }));
        return;
      }

      if (season === SPECIALS) { return renderSpecials(); }

      var numbers = episodes.map(function (episode) { return episode.no; });
      var seenIndex = seenUntil(numbers);

      episodes.forEach(function (episode, index) {
        if (episode.season !== season) { return; }

        var date = SM.isDate(episode.airstamp) ? SM.formatDate(episode.airstamp, !episode.aired) : 'TBA';
        var item = h('div', {
          class: 'episode focusable' + (episode.aired || isNextUpcoming(episode) ? '' : ' upcoming') + (index <= seenIndex ? ' seen' : ''),
          'data-key': 'episode:' + episode.no,
          onclick: function () { openEpisode(episode); }
        }, [
          h('div', { class: 'episode-image' }, [episode.image ? h('img', { src: episode.image, alt: '' }) : null]),
          h('div', { class: 'episode-text' }, [
            h('div', { class: 'episode-title' }, [
              h('b', { text: episode.no }),
              h('span', { text: episode.name || '' }),
              index <= seenIndex ? SM.icon('check') : null
            ]),
            h('div', { class: 'episode-date', text: [date, episode.runtime && episode.runtime + ' min'].filter(Boolean).join('  ·  ') }),
            h('p', { class: 'summary lines-2', text: episode.summary })
          ])
        ]);

        list.appendChild(h('div', { class: 'episode-row', 'data-nav-row': true }, [item]));
      });
    }

    /** Newest first: the special that just aired is the one you are looking for */
    function renderSpecials() {
      specials.slice().reverse().forEach(function (special, index) {
        var date = SM.isDate(special.airstamp) ? SM.formatDate(special.airstamp, !special.aired) : 'TBA';
        var item = h('div', {
          class: 'episode focusable' + (special.aired ? '' : ' upcoming'),
          'data-key': 'special:' + index + ':' + (special.airdate || ''),
          onclick: function () { openSpecial(special); }
        }, [
          h('div', { class: 'episode-image' }, [special.image ? h('img', { src: special.image, alt: '' }) : null]),
          h('div', { class: 'episode-text' }, [
            h('div', { class: 'episode-title' }, [
              h('b', { text: 'Special' }),
              h('span', { text: special.name || '' })
            ]),
            h('div', { class: 'episode-date', text: [date, special.runtime && special.runtime + ' min'].filter(Boolean).join('  ·  ') }),
            h('p', { class: 'summary lines-2', text: special.summary })
          ])
        ]);

        list.appendChild(h('div', { class: 'episode-row', 'data-nav-row': true }, [item]));
      });
    }

    /** Specials are played with their TMDB number (season 0) and are not part of the seen tracking */
    function openSpecial(special) {
      var title = show.name + ' Special: ' + (special.name || '');
      if (!special.aired) {
        return SM.ui.toast(SM.isDate(special.airstamp) ? 'Airs on ' + SM.formatDate(special.airstamp, true) : 'Not aired yet');
      }

      var buttons = [];
      if (SM.player.canPlay(show)) {
        buttons.push({
          label: 'Play',
          icon: 'play',
          action: function () {
            SM.ui.busy(1);
            SM.store.specialNo(show, special).then(function (episodeNo) {
              SM.ui.busy(-1);
              if (!episodeNo) { return SM.ui.toast('There is no play link for this special.'); }
              SM.player.play(show, episodeNo, { title: title, special: true });
            }, function () {
              SM.ui.busy(-1);
              SM.ui.toast('Could not load the special. Please check the network connection.');
            });
          }
        });
      }
      services.forEach(function (service) {
        buttons.push({
          label: service.name,
          icon: 'play',
          action: function () { SM.player.openService(show, null, service); }
        });
      });
      buttons.push({ label: 'Cancel' });

      SM.ui.dialog({ title: title, message: special.summary || '', buttons: buttons });
    }

    function render() {
      renderHead();
      renderActions();
      renderSeasons();
      renderEpisodes();
    }

    function selectSeason(number) {
      if (number === season) { return; }
      season = number;

      Array.prototype.forEach.call(seasons.children, function (tab) {
        tab.classList.toggle('active', tab._season === season);
      });
      renderEpisodes();
    }

    function loadEpisodes() {
      Promise.all([SM.store.getEpisodes(show), SM.store.getSpecials(show)]).then(function (results) {
        episodes = results[0];
        specials = results[1];

        var next = nextNo();
        var all = seasonNumbers();
        season = next ? SM.parseEpisodeNo(next).season : all[all.length - 1];
        if (all.indexOf(season) === -1) { season = all.length ? all[all.length - 1] : SPECIALS; }
      }, function () {
        failed = true;
      }).then(function () {
        if (document.body.contains(el)) { SM.nav.preserve(render); }
      });
    }

    function loadServices() {
      SM.services.find(show).then(function (found) {
        if (!document.body.contains(el)) { return; }
        services = found;
        SM.nav.preserve(renderActions);
      });
    }

    return {
      el: el,
      topbar: false,

      init: function () {
        render();
        SM.ui.backdrop(show);
        loadEpisodes();

        loadServices();

        if (!isTracked()) {
          // shows from search and popular come without episode dates and play link
          SM.store.prepare(show).then(function (prepared) {
            if (isTracked() || !document.body.contains(el)) { return; }
            show = prepared;
            SM.nav.preserve(render);
            SM.ui.backdrop(show);
            loadServices(); // the TMDB ID is known now
          }, function () { /* keep what we have */ });
        }
      },

      defaultFocus: function () {
        return actions.querySelector('.focusable');
      },

      onFocus: function (focused) {
        if (focused._season !== undefined) { selectSeason(focused._season); }
      },

      onStoreChange: function () {
        show = SM.store.get(id) || show;
        render();
      },

      onPlay: play
    };
  };
})();
