/*
 * showmaniac TV - links to official streaming services.
 * The detail screen shows a button for every service that has the show. The app of the service
 * is opened (or its page in the browser of the TV), the service plays the video in its own player.
 *
 * A service has the show if TMDB lists it as provider in the country of the settings
 * (data from JustWatch), or, for services with verify: true, if the page of the show exists.
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

  function offers(names, service) {
    return names.some(function (name) {
      return service.providers.some(function (provider) {
        return name.toLowerCase().indexOf(provider.toLowerCase()) === 0;
      });
    });
  }

  /** @return {Promise} link for the show, null if the service does not have it */
  function linkFor(show, service, names) {
    var listed = offers(names, service);

    if (!service.verify) { return Promise.resolve(listed ? fill(service.url, show) : null); }

    var url = fill(service.url, show);
    return cached('page:' + url, function () { return exists(url); }).then(function (found) {
      if (found) { return url; }
      return listed && service.searchUrl ? fill(service.searchUrl, show) : null;
    });
  }

  SM.services = {
    /** @return {Promise} [{ name, url, appId }] services that have the show */
    find: function (show) {
      if (!show || !show.name) { return Promise.resolve([]); }

      return providers(show).then(function (names) {
        return Promise.all(SM.settings.services.map(function (service) {
          return linkFor(show, service, names).then(function (url) {
            return url ? { name: service.name, url: url, appId: service.appId } : null;
          });
        }));
      }).then(function (list) {
        return list.filter(Boolean);
      });
    }
  };
})();
