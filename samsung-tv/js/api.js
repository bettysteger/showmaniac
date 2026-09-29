/*
 * showmaniac TV - network access: TVmaze (show data), TMDB (IDs for play links, backdrops), Trakt (popular).
 */
(function () {
  'use strict';

  var SM = window.SM;
  var TVMAZE = 'https://api.tvmaze.com';

  /**
   * JSON request via XMLHttpRequest, which is what the Tizen access policy in config.xml covers.
   * @return {Promise} parsed response, rejects with err.status / err.data on HTTP errors
   */
  function request(url, options) {
    options = options || {};

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', url, true);
      xhr.timeout = options.timeout || 15000;

      Object.keys(options.headers || {}).forEach(function (name) {
        xhr.setRequestHeader(name, options.headers[name]);
      });

      xhr.onload = function () {
        var data = null;
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { data = null; }

        if (xhr.status >= 200 && xhr.status < 300) { return resolve(data); }

        var error = new Error('HTTP ' + xhr.status);
        error.status = xhr.status;
        error.data = data;
        reject(error);
      };
      xhr.onerror = function () { reject(new Error('Network error')); };
      xhr.ontimeout = function () { reject(new Error('Timeout')); };
      xhr.send(options.body || null);
    });
  }

  // TVmaze allows 20 calls per 10 seconds: limit parallel calls and retry when rate limited (429)
  var MAX_PARALLEL = 4;
  var running = 0;
  var waiting = [];

  function next() {
    if (running >= MAX_PARALLEL || !waiting.length) { return; }
    running++;
    var job = waiting.shift();

    attempt(job.url, 3).then(job.resolve, job.reject).then(function () {
      running--;
      next();
    });
  }

  function attempt(url, retries) {
    return request(url).catch(function (error) {
      if (error.status !== 429 || retries <= 0) { throw error; }
      return new Promise(function (resolve) { setTimeout(resolve, 3000); }).then(function () {
        return attempt(url, retries - 1);
      });
    });
  }

  function tvmaze(path) {
    return new Promise(function (resolve, reject) {
      waiting.push({ url: TVMAZE + path, resolve: resolve, reject: reject });
      next();
    });
  }

  SM.api = {
    request: request,

    tvmaze: {
      show: function (id) {
        return tvmaze('/shows/' + id + '?embed[]=previousepisode&embed[]=nextepisode');
      },
      episodes: function (id) {
        return tvmaze('/shows/' + id + '/episodes');
      },
      images: function (id) {
        return tvmaze('/shows/' + id + '/images');
      },
      search: function (query) {
        return tvmaze('/search/shows?q=' + encodeURIComponent(query)).then(function (results) {
          return (results || []).map(function (result) { return result.show; });
        });
      },
      singlesearch: function (query) {
        return tvmaze('/singlesearch/shows?q=' + encodeURIComponent(query));
      },
      lookup: function (imdbId) {
        return tvmaze('/lookup/shows?imdb=' + encodeURIComponent(imdbId));
      }
    },

    tmdb: {
      /** @return {Promise} TMDB ID, 0 if there is no match */
      find: function (source, id) {
        var url = 'https://api.themoviedb.org/3/find/' + encodeURIComponent(id) +
          '?external_source=' + source + '&api_key=' + SM.settings.tmdbApiKey;

        return request(url).then(function (json) {
          var match = json && json.tv_results && json.tv_results[0];
          return match ? match.id : 0;
        });
      },
      show: function (tmdbId) {
        return request('https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + SM.settings.tmdbApiKey);
      }
    },

    trakt: {
      trending: function (page, limit) {
        return request('https://api.trakt.tv/shows/trending?limit=' + limit + '&page=' + page, {
          headers: {
            'Content-Type': 'application/json',
            'trakt-api-key': SM.settings.traktApiKey,
            'trakt-api-version': '2'
          }
        });
      }
    }
  };

  /**
   * Wide background images for the billboard. TMDB is preferred because it offers TV friendly
   * sizes, TVmaze is the fallback. Results are remembered so every show is looked up only once.
   */
  var BACKDROPS_KEY = 'sm_backdrops';
  var backdrops = SM.storage.get(BACKDROPS_KEY, {});
  var pending = {};

  function remember(id, url) {
    var keys = Object.keys(backdrops);
    if (keys.length > 300) { backdrops = {}; }
    backdrops[id] = url || '';
    SM.storage.set(BACKDROPS_KEY, backdrops);
    return url || null;
  }

  function fromTmdb(show) {
    if (!show.tmdb || !SM.settings.tmdbApiKey) { return Promise.resolve(null); }

    return SM.api.tmdb.show(show.tmdb).then(function (json) {
      return json && json.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + json.backdrop_path : null;
    });
  }

  function fromTvmaze(show) {
    return SM.api.tvmaze.images(show.id).then(function (images) {
      var backgrounds = (images || []).filter(function (image) {
        return image.type === 'background' && image.resolutions && image.resolutions.original;
      });
      var best = backgrounds.filter(function (image) { return image.main; })[0] || backgrounds[0];
      return best ? SM.https(best.resolutions.original.url) : null;
    });
  }

  SM.images = {
    /** @return {Promise} URL of a wide image or null */
    backdrop: function (show) {
      if (!show || !show.id) { return Promise.resolve(null); }
      if (backdrops[show.id] !== undefined) { return Promise.resolve(backdrops[show.id] || null); }
      if (pending[show.id]) { return pending[show.id]; }

      pending[show.id] = fromTmdb(show)
        .catch(function () { return null; })
        .then(function (url) { return url || fromTvmaze(show); })
        .then(function (url) {
          delete pending[show.id];
          return remember(show.id, url);
        }, function () {
          delete pending[show.id];
          return null; // network problem: try again next time
        });

      return pending[show.id];
    }
  };
})();
