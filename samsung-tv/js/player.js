/*
 * showmaniac TV - opens the play link of an episode on the TV.
 *
 * With a player address in the settings (playerUrl) the episode is shown in the player of
 * the app (views/player.js). Without, the play link is opened in the browser of the TV:
 * the streaming page does not allow to be embedded into another page (X-Frame-Options).
 * When coming back the app asks if the episode should be marked as seen.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var PENDING_KEY = 'sm_pending';
  var PENDING_MAX_AGE = 12 * 60 * 60 * 1000;
  var PROGRESS_KEY = 'sm_progress';
  var PROGRESS_MIN = 5 * 60;                     // seconds, less is not worth resuming
  var PROGRESS_MAX_AGE = 60 * 24 * 60 * 60 * 1000;
  var PROGRESS_MAX_COUNT = 50;

  var player = SM.player = {};

  // ---- position to resume an episode, for {progress} in the player address ----

  function progressKey(show, episodeNo) {
    return show.id + ':' + episodeNo;
  }

  /** @return {Number} seconds where the episode was left, 0 if none */
  function progressOf(show, episodeNo) {
    var entry = SM.storage.get(PROGRESS_KEY, {})[progressKey(show, episodeNo)];
    return entry && Date.now() - entry.time < PROGRESS_MAX_AGE ? entry.seconds : 0;
  }

  /** Remembers the position, or forgets it after the first minutes or when the episode was watched */
  function saveProgress(show, episodeNo, seconds, watched) {
    var all = SM.storage.get(PROGRESS_KEY, {});
    var key = progressKey(show, episodeNo);
    delete all[key];

    if (seconds >= PROGRESS_MIN && watched < 0.9) {
      all[key] = { seconds: Math.floor(seconds), time: Date.now() };
    }

    // the newest entries are kept
    var keys = Object.keys(all).filter(function (k) { return Date.now() - all[k].time < PROGRESS_MAX_AGE; });
    keys.sort(function (a, b) { return all[b].time - all[a].time; });
    var kept = {};
    keys.slice(0, PROGRESS_MAX_COUNT).forEach(function (k) { kept[k] = all[k]; });
    SM.storage.set(PROGRESS_KEY, kept);
  }

  function formatTime(seconds) {
    var hours = Math.floor(seconds / 3600);
    var text = SM.pad2(Math.floor(seconds % 3600 / 60)) + ':' + SM.pad2(seconds % 60);
    return hours ? hours + ':' + text : text;
  }

  function slug(show) {
    return String(show.name || '').replace('&', 'and').replace(/[^ a-zA-Z0-9]/g, '').replace(/\s+/g, '-').toLowerCase();
  }

  /**
   * Fills the placeholders of a link template.
   * @return {String|null} link, null if an ID that the template needs is not known
   */
  function fill(template, show, episodeNo) {
    if (!template || !show || !episodeNo) { return null; }

    var episode = SM.parseEpisodeNo(episodeNo);
    var values = {
      tmdb: show.tmdb,
      imdb: show.imdb,
      tvdb: show.thetvdb,
      slug: slug(show),
      season: episode.season,
      episode: episode.episode,
      progress: progressOf(show, episodeNo) // 0 starts at the beginning
    };
    var complete = true;

    var url = template.replace(/\{([a-z]+)\}/g, function (placeholder, name) {
      var value = values[name];
      if (value === undefined || value === null || value === '') { complete = false; }
      return encodeURIComponent(value);
    });
    return complete ? url : null;
  }

  /**
   * Generates the play link for the browser. Requires the TMDB ID (show.tmdb).
   * @return {String|null} link, null if no TMDB ID is known
   */
  player.urlFor = function (show, episodeNo) {
    return fill(SM.settings.playUrl, show, episodeNo);
  };

  /** @return {String|null} address for the player of the app, null if none is set */
  player.playerUrlFor = function (show, episodeNo) {
    return fill(SM.settings.playerUrl, show, episodeNo);
  };

  /** @return {Boolean} true if episodes of the show can be played */
  player.canPlay = function (show) {
    return !!(player.playerUrlFor(show, '01x01') || player.urlFor(show, '01x01'));
  };

  /** @return {Boolean} true if the app is installed on the TV */
  function isInstalled(appId) {
    try {
      return !!window.tizen.application.getAppInfo(appId);
    } catch (e) {
      return false;
    }
  }

  /**
   * Opens a link in an app of the TV, the first app that is installed and accepts it wins.
   * @param {Array} appIds defaults to the browser of the TV
   * @param {Object} [payloads] start data for single apps instead of the link, { appId: 'contentId=...' }
   */
  function launch(url, appIds, payloads) {
    return new Promise(function (resolve, reject) {
      if (!window.tizen || !window.tizen.application) {
        // development in a desktop browser
        return window.open(url, '_blank') ? resolve() : reject(new Error('Popup blocked'));
      }

      // PAYLOAD is how many Samsung TV apps receive deep links
      function controlFor(appId) {
        var payload = payloads && payloads[appId];
        return new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', payload ? null : url, null, null,
          [new window.tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: payload || url })])]);
      }
      appIds = (appIds || SM.settings.browserAppIds).filter(function (appId) {
        return appId === null || isInstalled(appId);
      });

      (function tryNext() {
        if (!appIds.length) { return reject(new Error('No browser found')); }
        var appId = appIds.shift();

        try {
          window.tizen.application.launchAppControl(controlFor(appId), appId, resolve, tryNext);
        } catch (e) {
          tryNext();
        }
      })();
    });
  }

  function remember(show, episodeNo) {
    if (SM.store.get(show.id)) {
      SM.storage.set(PENDING_KEY, { id: show.id, name: show.name, episodeNo: episodeNo, time: Date.now() });
    }
  }

  /**
   * Opens the episode on the TV, e.g. SM.player.play(show, '02x01')
   * @param {Object} [options] { early: true } the episode has not aired according to the air date
   */
  player.play = function (show, episodeNo, options) {
    var inApp = player.playerUrlFor(show, episodeNo);
    var url = inApp || player.urlFor(show, episodeNo);

    if (!url) {
      SM.ui.toast('There is no play link for ' + show.name + '.');
      return;
    }
    remember(show, episodeNo);

    if (inApp) {
      var progress = progressOf(show, episodeNo);
      if (progress && SM.settings.playerUrl.indexOf('{progress}') !== -1) { SM.ui.toast('Resuming at ' + formatTime(progress)); }
      SM.router.go('player', { url: inApp, show: show, episodeNo: episodeNo, title: show.name + ' ' + episodeNo, early: !!(options && options.early) });
      return;
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

  /**
   * Called when the player of the app was closed.
   * @param {Number} watched part of the video that was watched, 0 to 1
   * @param {Boolean} [failed] no stream was found, the app does not ask if the episode was watched
   * @param {Number} [position] seconds where the episode was left
   */
  player.finished = function (show, episodeNo, watched, failed, position) {
    var tracked = show && SM.store.get(show.id);

    if (failed) {
      SM.storage.remove(PENDING_KEY);
      return;
    }
    if (show && show.id) { saveProgress(show, episodeNo, position || 0, watched); }
    if (tracked && watched >= 0.9) {
      SM.storage.remove(PENDING_KEY);
      SM.store.markSeen(tracked, episodeNo);
      SM.ui.toast(show.name + ' ' + episodeNo + ' marked as seen');
      return;
    }
    player.askIfSeen();
  };

  /**
   * Opens an official streaming service: its app on the TV, otherwise its page in the browser.
   * The next episode is remembered, so the app can ask if it was watched.
   */
  player.openService = function (show, episodeNo, service) {
    var url = service.url;
    if (episodeNo) { remember(show, episodeNo); }

    // the app of the service, the browser of the TV as fallback
    var appIds = (service.appId ? [service.appId] : []).concat(SM.settings.browserAppIds);
    var payloads = {};
    if (service.appId && service.payload) { payloads[service.appId] = service.payload; }

    launch(url, appIds, payloads).catch(function () {
      SM.storage.remove(PENDING_KEY);
      SM.ui.toast('Could not open ' + url);
    });
  };

  /** Plays the next episode to watch of a show, loads the episode list first */
  player.playNext = function (show) {
    if (!player.canPlay(show)) { return player.play(show); }

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
