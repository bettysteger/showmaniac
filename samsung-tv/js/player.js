/*
 * showmaniac TV - opens the play link of an episode on the TV.
 *
 * The link is opened in the browser of the TV: it can be controlled with the remote (cursor)
 * and plays the video in fullscreen. The streaming page does not allow to be embedded into
 * another page (X-Frame-Options), so it can not run inside of this app.
 * When coming back the app asks if the episode should be marked as seen.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var PENDING_KEY = 'sm_pending';
  var PENDING_MAX_AGE = 12 * 60 * 60 * 1000;

  var player = SM.player = {};

  /**
   * Generates the play link. Requires the TMDB ID (show.tmdb).
   * @return {String|null} link, null if no TMDB ID is known
   */
  player.urlFor = function (show, episodeNo) {
    if (!show || !show.tmdb || !episodeNo) { return null; }

    var episode = SM.parseEpisodeNo(episodeNo);
    var slug = show.name.replace('&', 'and').replace(/[^ a-zA-Z0-9]/g, '').replace(/\s+/g, '-').toLowerCase();

    return SM.settings.playUrl
      .replace('{tmdb}', show.tmdb)
      .replace('{slug}', slug)
      .replace('{season}', episode.season)
      .replace('{episode}', episode.episode);
  };

  function launch(url) {
    return new Promise(function (resolve, reject) {
      if (!window.tizen || !window.tizen.application) {
        // development in a desktop browser
        return window.open(url, '_blank') ? resolve() : reject(new Error('Popup blocked'));
      }

      var control = new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', url);
      var appIds = SM.settings.browserAppIds.slice();

      (function tryNext() {
        if (!appIds.length) { return reject(new Error('No browser found')); }
        var appId = appIds.shift();

        try {
          window.tizen.application.launchAppControl(control, appId, resolve, tryNext);
        } catch (e) {
          tryNext();
        }
      })();
    });
  }

  /** Opens the episode on the TV, e.g. SM.player.play(show, '02x01') */
  player.play = function (show, episodeNo) {
    var url = player.urlFor(show, episodeNo);
    if (!url) {
      SM.ui.toast('There is no play link for ' + show.name + '.');
      return;
    }

    if (SM.store.get(show.id)) {
      SM.storage.set(PENDING_KEY, { id: show.id, name: show.name, episodeNo: episodeNo, time: Date.now() });
    }

    launch(url).catch(function () {
      if (window.tizen) {
        // last resort: open the page inside of the app, leave it with the exit key of the remote
        window.location.href = url;
      } else {
        SM.storage.remove(PENDING_KEY);
        SM.ui.toast('Could not open the play link.');
      }
    });
  };

  /** Plays the next episode to watch of a show, loads the episode list first */
  player.playNext = function (show) {
    if (!show.tmdb) { return player.play(show); }

    SM.ui.busy(1);
    SM.store.getEpisodes(show).then(function (episodes) {
      return SM.store.nextToWatch(show, episodes);
    }, function () {
      return show.latestepisode && show.latestepisode.number;
    }).then(function (episodeNo) {
      SM.ui.busy(-1);
      if (!episodeNo) { return SM.ui.toast('No episode of ' + show.name + ' has aired yet.'); }
      player.play(show, episodeNo);
    });
  };

  /** Asks if the episode that was opened before leaving the app was watched */
  player.askIfSeen = function () {
    var pending = SM.storage.get(PENDING_KEY, null);
    if (!pending) { return; }
    SM.storage.remove(PENDING_KEY);

    var show = SM.store.get(pending.id);
    if (!show || Date.now() - pending.time > PENDING_MAX_AGE) { return; }

    SM.ui.dialog({
      title: pending.name + ' ' + pending.episodeNo,
      message: 'Did you watch this episode?',
      buttons: [{
        label: 'Yes, mark as seen',
        icon: 'check',
        action: function () { SM.store.markSeen(show, pending.episodeNo); }
      }, {
        label: 'Not yet'
      }]
    });
  };
})();
