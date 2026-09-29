/*
 * showmaniac TV - links to official streaming services.
 * The detail screen shows a button for every service that has the show. The app of the service
 * is opened (or its page in the browser of the TV), the service plays the video in its own player.
 *
 * A service has the show if TMDB lists it as provider in the country of the settings
 * (data from JustWatch), or, for services with verify: true, if the page of the show exists.
 * For services with clickout: true the real address of the show is taken from the watch page of
 * TMDB, which links to every service (through JustWatch).
 */
(function () {
  'use strict';

  var SM = window.SM;
  var CACHE_KEY = 'sm_services';
  var MAX_AGE = 7 * 24 * 60 * 60 * 1000; // services add and remove shows from time to time

  var cache = SM.storage.get(CACHE_KEY, {});
  var pending = {};

  /** "Germany's Next Topmodel" => "germanys-next-topmodel", "Füchse" => "fuechse" */
  function slug(name) {
    return String(name || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function fill(template, show) {
    return template
      .replace('{slug}', slug(show.name))
      .replace('{name}', encodeURIComponent(show.name));
  }

  /** Runs a lookup once per show and remembers the result on the TV */
  function cached(key, lookup) {
    var entry = cache[key];
    if (entry && Date.now() - entry.time < MAX_AGE) { return Promise.resolve(entry.value); }
    if (pending[key]) { return pending[key]; }

    pending[key] = lookup().then(function (value) {
      delete pending[key];
      cache[key] = { value: value, time: Date.now() };
      SM.storage.set(CACHE_KEY, cache);
      return value;
    }, function () {
      delete pending[key];
      return null; // network problem: try again next time
    });
    return pending[key];
  }

  /** @return {Promise} true if the page exists (HTTP 200) */
  function exists(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 15000;
      xhr.onload = function () { resolve(xhr.status >= 200 && xhr.status < 300); };
      xhr.onerror = xhr.ontimeout = function () { reject(new Error('Network error')); };
      xhr.send();
    });
  }

  /** @return {Promise} names of the providers that stream the show in the country, e.g. ["RTL+"] */
  function providers(show) {
    if (!show.tmdb || !SM.settings.tmdbApiKey) { return Promise.resolve([]); }

    return cached('providers:' + show.tmdb, function () {
      var url = 'https://api.themoviedb.org/3/tv/' + show.tmdb + '/watch/providers?api_key=' + SM.settings.tmdbApiKey;

      return SM.api.request(url).then(function (json) {
        var country = (json && json.results && json.results[SM.settings.country]) || {};
        var names = [];
        ['flatrate', 'free', 'ads'].forEach(function (type) {
          (country[type] || []).forEach(function (provider) { names.push(provider.provider_name); });
        });
        return names;
      });
    }).then(function (names) {
      return names || [];
    });
  }

  function matches(name, service) {
    return service.providers.some(function (provider) {
      return name.toLowerCase().indexOf(provider.toLowerCase()) === 0;
    });
  }

  function offers(names, service) {
    return names.some(function (name) { return matches(name, service); });
  }

  function get(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 15000;
      xhr.onload = function () { return xhr.status === 200 ? resolve(xhr.responseText) : reject(new Error(xhr.status)); };
      xhr.onerror = xhr.ontimeout = function () { reject(new Error('Network error')); };
      xhr.send();
    });
  }

  /**
   * Addresses of the show at the services, from the links of the TMDB watch page to JustWatch:
   * https://click.justwatch.com/a?cx=<base64 JSON with the provider>&r=<address at the service>
   * @return {Promise} { "Apple TV": "https://tv.apple.com/at/episode/...", ... }
   */
  function clickouts(show) {
    if (!show.tmdb) { return Promise.resolve({}); }

    return cached('clickouts:' + show.tmdb, function () {
      var url = 'https://www.themoviedb.org/tv/' + show.tmdb + '/watch?locale=' + SM.settings.country;

      return get(url).then(function (html) {
        var links = {};
        var pattern = /href="https:\/\/click\.justwatch\.com\/a\?([^"]+)"/g;
        var match;

        while ((match = pattern.exec(html))) {
          try {
            var params = {};
            match[1].replace(/&amp;/g, '&').split('&').forEach(function (pair) {
              var index = pair.indexOf('=');
              params[pair.slice(0, index)] = decodeURIComponent(pair.slice(index + 1));
            });
            var context = JSON.parse(atob(params.cx.replace(/-/g, '+').replace(/_/g, '/')));
            var provider = context.data[0].data.provider;
            if (provider && params.r && !links[provider]) { links[provider] = params.r; }
          } catch (e) { /* not a link to a service */ }
        }
        return links;
      });
    }).then(function (links) {
      return links || {};
    });
  }

  /**
   * Apple TV links to the first episode, with the ID of the show as parameter: the page of the
   * show is taken instead, e.g. https://tv.apple.com/at/show/ted-lasso/umc.cmc.vtoh0mn0xn7t3c643xqonfzy
   */
  function showPage(url, show) {
    var showId = url.match(/[?&]showId=([^&]+)/);
    var country = url.match(/^https:\/\/tv\.apple\.com\/([a-z]{2})\//);
    if (!showId || !country) { return url; }
    return 'https://tv.apple.com/' + country[1] + '/show/' + slug(show.name) + '/' + showId[1];
  }

  /**
   * Start data for the app of the service, placeholders are parameters of the address of the show:
   * 'contentId={gti}' with https://watch.amazon.de/detail?gti=amzn1... => 'contentId=amzn1...'
   * @return {String|null} null if a parameter is missing
   */
  function payloadFor(service, url) {
    if (!service.payload || !url) { return null; }
    var complete = true;
    var payload = service.payload.replace(/\{([a-zA-Z]+)\}/g, function (placeholder, name) {
      var value = url.match(new RegExp('[?&]' + name + '=([^&]+)'));
      if (!value) { complete = false; }
      return value ? decodeURIComponent(value[1]) : '';
    });
    return complete ? payload : null;
  }

  /** @return {Promise} address of the show at the service from TMDB, null if not found */
  function clickoutFor(show, service) {
    return clickouts(show).then(function (links) {
      for (var provider in links) {
        if (links.hasOwnProperty(provider) && matches(provider, service)) { return showPage(links[provider], show); }
      }
      return null;
    });
  }

  /** @return {Promise} link for the show, null if the service does not have it */
  function linkFor(show, service, names) {
    var listed = offers(names, service);

    if (service.clickout && listed) {
      return clickoutFor(show, service).then(function (url) {
        return url || fill(service.url, show);
      }, function () {
        return fill(service.url, show);
      });
    }
    if (!service.verify) { return Promise.resolve(listed ? fill(service.url, show) : null); }

    var url = fill(service.url, show);
    return cached('page:' + url, function () { return exists(url); }).then(function (found) {
      if (found) { return url; }
      return listed && service.searchUrl ? fill(service.searchUrl, show) : null;
    });
  }

  SM.services = {
    /** @return {Promise} [{ name, url, appId, payload }] services that have the show */
    find: function (show) {
      if (!show || !show.name) { return Promise.resolve([]); }

      return providers(show).then(function (names) {
        return Promise.all(SM.settings.services.map(function (service) {
          return linkFor(show, service, names).then(function (url) {
            return url ? { name: service.name, url: url, appId: service.appId, payload: payloadFor(service, url) } : null;
          });
        }));
      }).then(function (list) {
        return list.filter(Boolean);
      });
    }
  };
})();
