/*
 * showmaniac TV - helpers.
 * Plain ES5 without a build step on purpose: older Samsung TVs ship old Chromium versions.
 */
(function () {
  'use strict';

  var SM = window.SM = window.SM || {};
  SM.views = {};

  /**
   * Creates a DOM element. Text always goes through textContent, never innerHTML.
   * @example SM.h('div', { class: 'card', text: show.name })
   */
  SM.h = function (tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === undefined || value === null || value === false) { return; }
      if (key === 'class') {
        el.className = value;
      } else if (key === 'text') {
        el.textContent = value;
      } else if (key === 'onclick') {
        el.addEventListener('click', value);
      } else {
        el.setAttribute(key, value === true ? '' : value);
      }
    });
    (children || []).forEach(function (child) {
      if (child === undefined || child === null || child === false) { return; }
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return el;
  };

  var ICONS = {
    play: 'M8 5v14l11-7z',
    check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    up: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
    sync: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z'
  };

  SM.icon = function (name) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    var path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
  };

  SM.pad2 = function (number) {
    number = String(number);
    return number.length < 2 ? '0' + number : number;
  };

  /** Same episode notation as the web app: season 2 episode 1 => "02x01" */
  SM.episodeNo = function (season, number) {
    return SM.pad2(season) + 'x' + SM.pad2(number);
  };

  SM.parseEpisodeNo = function (episodeNo) {
    var parts = String(episodeNo).split('x');
    return { season: parseInt(parts[0], 10), episode: parseInt(parts[1], 10) };
  };

  SM.isDate = function (date) {
    if (!date) { return false; }
    return !isNaN(new Date(date).getTime());
  };

  SM.isFuture = function (date) {
    return SM.isDate(date) && new Date(date) > new Date();
  };

  /** "Sun 21 Jul, 21:00", the year is added when it is not the current one */
  SM.formatDate = function (date, withTime) {
    if (!SM.isDate(date)) { return date === 'ENDED' ? 'Ended' : 'TBA'; }
    date = new Date(date);

    var options = { weekday: 'short', day: 'numeric', month: 'short' };
    if (date.getFullYear() !== new Date().getFullYear()) { options.year = 'numeric'; }

    var text = date.toLocaleDateString(undefined, options);
    if (withTime) {
      text += ', ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return text;
  };

  /** Removes tags from API summaries and decodes entities without ever creating elements from them */
  SM.stripHtml = function (html) {
    if (!html) { return ''; }
    var textarea = document.createElement('textarea');
    textarea.innerHTML = String(html).replace(/<[^>]*>/g, ' ');
    return textarea.value.replace(/\s+/g, ' ').trim();
  };

  SM.https = function (url) {
    return url ? String(url).replace(/^http:/, 'https:') : url;
  };

  SM.poster = function (show) {
    return show && show.image ? SM.https(show.image.medium || show.image.original) : null;
  };

  SM.copy = function (value) {
    return JSON.parse(JSON.stringify(value));
  };

  SM.debounce = function (fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  };

  /** localStorage that never throws (full or disabled storage) */
  SM.storage = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full */ }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };
})();
