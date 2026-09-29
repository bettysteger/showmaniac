/*
 * showmaniac TV - the tracked shows.
 * Uses the same data format as src/stores/shows.js of the web app, so the list can be synced
 * through Firebase (users/<uid>/shows) and edited on both sides.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var STORAGE_KEY = 'showmaniac';
  var listeners = [];
  var episodeCache = {};
  var queue = Promise.resolve(); // remote operations run one after another

  var store = SM.store = { shows: [], lastSync: 0 };

  function emit() {
    listeners.forEach(function (listener) { listener(); });
  }

  function busy(delta) {
    if (SM.ui) { SM.ui.busy(delta); }
  }

  function find(list, id) {
    return list.filter(function (show) { return show.id === id; })[0];
  }

  /** Firebase returns arrays with gaps as objects and empty lists as null */
  function toList(data) {
    if (!data) { return []; }
    if (!Array.isArray(data)) {
      data = Object.keys(data).sort(function (a, b) { return a - b; }).map(function (key) { return data[key]; });
    }
    return data.filter(function (show) { return show && show.id; });
  }

  function clean(list) {
    return SM.copy(list).map(function (show) {
      delete show.loading;
      return show;
    });
  }

  function saveLocal() {
    SM.storage.set(STORAGE_KEY, clean(store.shows));
  }

  // ---- Firebase Realtime Database (REST) ----

  function remoteUrl(token) {
    return SM.settings.firebase.databaseURL + '/users/' + encodeURIComponent(SM.auth.user.uid) +
      '/shows.json?auth=' + encodeURIComponent(token);
  }

  function pull() {
    return SM.auth.getToken().then(function (token) {
      return SM.api.request(remoteUrl(token));
    }).then(toList);
  }

  function push(list) {
    return SM.auth.getToken().then(function (token) {
      return SM.api.request(remoteUrl(token), { method: 'PUT', body: JSON.stringify(clean(list)) });
    });
  }

  // ---- TVmaze data, ported from the web app ----

  function convertEpisodeNo(episode) {
    if (episode.number) {
      episode.number = SM.episodeNo(episode.season, episode.number);
    }
  }

  function parseDateTime(episode) {
    convertEpisodeNo(episode);
    var date = new Date(episode.airstamp);
    return isNaN(date.getTime()) ? 'tba' : date.toISOString();
  }

  function updateEpisodeDates(show) {
    var embedded = show._embedded || {};
    var latest = show.latestepisode = embedded.previousepisode || {};
    var next = show.nextepisode = embedded.nextepisode || {};

    // keep external IDs (used to resolve the TMDB ID), drop the rest to keep storage small
    show.imdb = (show.externals && show.externals.imdb) || undefined;
    show.thetvdb = (show.externals && show.externals.thetvdb) || undefined;
    ['_embedded', '_links', 'externals'].forEach(function (key) { delete show[key]; });

    next.date = show.status === 'Ended' ? 'ENDED' : parseDateTime(next);
    latest.date = parseDateTime(latest);
  }

  /**
   * Looks up the TMDB ID (needed for play links) via the IMDb/TVDB IDs from TVmaze.
   * Runs once per show: the result is stored on the show (0 = no match).
   */
  function resolveTmdbId(show) {
    if (show.tmdb !== undefined || !SM.settings.tmdbApiKey) { return Promise.resolve(); }

    var lookups = [['imdb_id', show.imdb], ['tvdb_id', show.thetvdb]].filter(function (lookup) { return lookup[1]; });
    var failed = false;

    function tryNext() {
      var lookup = lookups.shift();
      if (!lookup) {
        // only remember "no match" if every lookup actually answered
        if (!failed) { show.tmdb = 0; }
        return Promise.resolve();
      }
      return SM.api.tmdb.find(lookup[0], lookup[1]).then(function (id) {
        if (id) {
          show.tmdb = id;
          return;
        }
        return tryNext();
      }, function () {
        failed = true;
        return tryNext();
      });
    }

    return tryNext();
  }

  function getInfo(show) {
    return SM.api.tvmaze.show(show.id).then(function (data) {
      var beforeTba = show.latestepisode && show.latestepisode.date === 'tba';
      updateEpisodeDates(data);
      Object.assign(show, data); // to not overwrite 'seen' or 'lastSeen'

      if (show.lastSeen || beforeTba) {
        show.seen = show.latestepisode.number === show.lastSeen;
      }
      return resolveTmdbId(show);
    }).then(function () {
      return show;
    });
  }

  function needsUpdate(show) {
    var needsTmdbId = SM.settings.tmdbApiKey && show.tmdb === undefined;

    if (!needsTmdbId && show.nextepisode && show.latestepisode && show.latestepisode.date) {
      // don't load if the show has ended or the next episode is in the future
      if (show.nextepisode.date === 'ENDED' || SM.isFuture(show.nextepisode.date)) { return false; }
    }
    return true;
  }

  /** @return {Promise} true if any show changed */
  function updateShows() {
    var changed = false;

    return Promise.all(store.shows.filter(needsUpdate).map(function (show) {
      var before = JSON.stringify(show);
      return getInfo(show).then(function () {
        if (JSON.stringify(show) !== before) { changed = true; }
      }, function () { /* keep the old data of this show */ });
    })).then(function () {
      return changed;
    });
  }

  // ---- changes ----

  /**
   * Applies a change right away and, when signed in, to the latest list from Firebase.
   * That way changes made in the web app meanwhile are not overwritten.
   * @param {Function} apply receives a list of shows and returns the changed list
   */
  function commit(apply) {
    var snapshot = clean(store.shows);
    store.shows = apply(store.shows);
    saveLocal();
    emit();

    if (!SM.auth.isSignedIn()) { return Promise.resolve(); }

    queue = queue.then(function () {
      busy(1);
      return pull().then(function (remote) {
        var list = apply(remote.length ? remote : SM.copy(snapshot));
        return push(list).then(function () {
          store.shows = list;
          saveLocal();
          emit();
        });
      }).then(function () {
        busy(-1);
      }, function () {
        busy(-1);
        store.shows = snapshot;
        saveLocal();
        emit();
        SM.ui.toast('Could not save the change. Please check the network connection.');
      });
    });

    return queue;
  }

  function setFields(id, fields) {
    return commit(function (list) {
      var show = find(list, id);
      if (show) {
        Object.keys(fields).forEach(function (key) {
          if (fields[key] === null || fields[key] === undefined) {
            delete show[key];
          } else {
            show[key] = fields[key];
          }
        });
      }
      return list;
    });
  }

  function latestNo(show) {
    return show.latestepisode && show.latestepisode.number;
  }

  // ---- public ----

  store.on = function (listener) {
    listeners.push(listener);
  };

  store.load = function () {
    store.shows = toList(SM.storage.get(STORAGE_KEY, []));
  };

  store.get = function (id) {
    return find(store.shows, id);
  };

  /**
   * Loads the list of the signed in user and refreshes outdated episode info.
   * Without an account the list only lives on this TV.
   */
  store.sync = function () {
    queue = queue.then(function () {
      busy(1);

      var start = !SM.auth.isSignedIn() ? Promise.resolve(false) : pull().then(function (remote) {
        if (remote.length) {
          store.shows = remote;
          saveLocal();
          emit();
          return false;
        }
        // first sign in with an empty account: upload the shows added on this TV
        return store.shows.length > 0;
      });

      return start.then(function (upload) {
        return updateShows().then(function (changed) {
          if (changed) {
            saveLocal();
            emit();
          }
          if ((changed || upload) && SM.auth.isSignedIn()) { return push(store.shows); }
        });
      }).then(function () {
        store.lastSync = Date.now();
        busy(-1);
      }, function (error) {
        busy(-1);
        if (!SM.auth.isSignedIn() && SM.auth.user === null && error && error.status) {
          SM.ui.toast('Your session has expired, please sign in again.');
        }
        emit();
      });
    });

    return queue;
  };

  /**
   * Loads episode info for a show that is not in the list yet (search results, popular shows).
   * @return {Promise} copy of the show with latestepisode, nextepisode and tmdb
   */
  store.prepare = function (show) {
    return getInfo(SM.copy(show));
  };

  store.add = function (show) {
    var ready = show.latestepisode ? Promise.resolve(SM.copy(show)) : store.prepare(show);

    return ready.then(function (prepared) {
      return commit(function (list) {
        if (!find(list, prepared.id)) { list.push(SM.copy(prepared)); }
        return list;
      });
    });
  };

  store.remove = function (show) {
    return commit(function (list) {
      return list.filter(function (item) { return item.id !== show.id; });
    });
  };

  /**
   * Episodes with a number (no specials), oldest first.
   * @return {Promise} [{ no: '02x01', season, number, name, airstamp, aired, image, summary, runtime }]
   */
  store.getEpisodes = function (show) {
    var cached = episodeCache[show.id];
    if (cached && Date.now() - cached.time < 60 * 60 * 1000) { return cached.promise; }

    var promise = SM.api.tvmaze.episodes(show.id).then(function (list) {
      var now = Date.now();

      return (list || []).filter(function (episode) {
        return episode.number;
      }).map(function (episode) {
        return {
          no: SM.episodeNo(episode.season, episode.number),
          season: episode.season,
          number: episode.number,
          name: episode.name,
          airstamp: episode.airstamp,
          aired: SM.isDate(episode.airstamp) && new Date(episode.airstamp).getTime() <= now,
          image: episode.image ? SM.https(episode.image.medium) : null,
          summary: SM.stripHtml(episode.summary),
          runtime: episode.runtime
        };
      });
    });

    episodeCache[show.id] = { time: Date.now(), promise: promise };
    promise.catch(function () { delete episodeCache[show.id]; });
    return promise;
  };

  /**
   * The episode the play button starts, same rule as the web app: the one after the last seen
   * episode, the first one if nothing was seen yet, the latest one if everything was seen.
   * @return {String|undefined} e.g. "02x01"
   */
  store.nextToWatch = function (show, episodes) {
    var aired = (episodes || []).filter(function (episode) { return episode.aired; })
      .map(function (episode) { return episode.no; });

    if (!show.seen && aired.length) {
      var index = show.lastSeen ? aired.indexOf(show.lastSeen) + 1 : 0;
      if (!aired[index]) { index = aired.length - 1; }
      return aired[index];
    }
    return latestNo(show) || aired[aired.length - 1];
  };

  /** Marks the latest episode as seen or not seen */
  store.toggleSeen = function (show) {
    var latest = latestNo(show);

    if (show.seen || !latest) {
      if (!latest) { return setFields(show.id, { seen: !show.seen }); }

      // not seen anymore: the episode before the latest one becomes the last seen
      return store.getEpisodes(show).then(function (episodes) {
        var numbers = episodes.map(function (episode) { return episode.no; });
        return numbers[numbers.indexOf(latest) - 1];
      }, function () {
        return undefined;
      }).then(function (previous) {
        return setFields(show.id, { seen: false, lastSeen: previous });
      });
    }
    return setFields(show.id, { seen: true, lastSeen: latest });
  };

  /** Marks every episode up to the given one as seen */
  store.markSeen = function (show, episodeNo) {
    return setFields(show.id, { lastSeen: episodeNo, seen: episodeNo === latestNo(show) });
  };

  /** Moves the last seen episode one episode forward */
  store.catchUp = function (show) {
    if (show.seen) { return Promise.resolve(); }

    return store.getEpisodes(show).then(function (episodes) {
      var episodeNo = store.nextToWatch(show, episodes);
      if (episodeNo) { return store.markSeen(show, episodeNo); }
    });
  };

  // ---- popular shows (Trakt trending) ----

  var popularLoading = null;

  SM.popular = {
    shows: [],

    /** @return {Promise} resolves when SM.popular.shows is filled, never rejects */
    load: function () {
      if (!SM.settings.traktApiKey) { return Promise.resolve(); }
      if (popularLoading) { return popularLoading; }

      popularLoading = SM.api.trakt.trending(1, 20).then(function (trending) {
        return Promise.all((trending || []).map(function (entry) {
          var ids = entry.show.ids || {};
          var bySearch = function () { return SM.api.tvmaze.singlesearch(entry.show.title); };
          var lookup = ids.imdb ? SM.api.tvmaze.lookup(ids.imdb).catch(bySearch) : bySearch();

          return lookup.then(function (show) {
            if (show && ids.tmdb) { show.tmdb = ids.tmdb; }
            return show;
          }, function () {
            return null;
          });
        }));
      }).then(function (shows) {
        var ids = {};
        SM.popular.shows = shows.filter(function (show) {
          if (!show || !SM.poster(show) || ids[show.id]) { return false; }
          ids[show.id] = true;
          return true;
        });
      }, function () {
        popularLoading = null; // try again next time
      });

      return popularLoading;
    }
  };
})();
