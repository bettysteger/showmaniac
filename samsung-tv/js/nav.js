/*
 * showmaniac TV - focus handling for the remote control.
 *
 * Every screen is a list of rows stacked from top to bottom:
 *   <div data-nav-row> <div class="focusable"> ... </div> </div>
 * Left/right moves inside a row, up/down moves to the row above/below.
 * Rows remember their last focused element, rows with data-nav-mode="nearest" (grids)
 * pick the element closest to the current one instead.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var EDGE = 96; // space kept between the focused element and the screen edge

  var nav = SM.nav = { current: null };

  function toArray(list) {
    return Array.prototype.slice.call(list);
  }

  function isVisible(el) {
    return el.getClientRects().length > 0;
  }

  function items(row) {
    return toArray(row.querySelectorAll('.focusable')).filter(function (el) {
      return isVisible(el) && !el.hasAttribute('disabled');
    });
  }

  function rows() {
    var result = [];
    SM.app.navRoots().forEach(function (root) {
      var list = toArray(root.querySelectorAll('[data-nav-row]'));
      if (root.hasAttribute('data-nav-row')) { list.unshift(root); }

      list.forEach(function (row) {
        if (isVisible(row) && items(row).length) { result.push(row); }
      });
    });
    return result;
  }

  function rowOf(el) {
    return el.closest('[data-nav-row]');
  }

  function centerX(el) {
    var rect = el.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }

  function nearest(from, candidates) {
    var x = centerX(from);
    var best = null;
    var bestDistance = Infinity;

    candidates.forEach(function (candidate) {
      var distance = Math.abs(centerX(candidate) - x);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    });
    return best;
  }

  function pick(row, from) {
    var list = items(row);
    var remembered = row._navLast;

    if (row.getAttribute('data-nav-mode') !== 'nearest' && remembered && list.indexOf(remembered) !== -1) {
      return remembered;
    }
    var preferred = row.querySelector('.focusable.nav-default');
    if (preferred && list.indexOf(preferred) !== -1) { return preferred; }

    return from ? nearest(from, list) : list[0];
  }

  // layout position inside an ancestor, not affected by transforms
  function offsetWithin(el, ancestor, property) {
    var offset = 0;
    while (el && el !== ancestor) {
      offset += el[property];
      el = el.offsetParent;
    }
    return offset;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function scrollHorizontally(el) {
    var track = el.closest('.row-track');
    if (!track) { return; }

    var viewport = track.parentNode;
    var list = toArray(track.children);
    var last = list[list.length - 1];
    var width = viewport.clientWidth;
    var left = offsetWithin(el, track, 'offsetLeft');
    var x = track._x || 0;

    if (left - x < EDGE) {
      x = left - EDGE;
    } else if (left + el.offsetWidth - x > width - EDGE) {
      x = left + el.offsetWidth - (width - EDGE);
    }
    x = clamp(x, 0, Math.max(0, last.offsetLeft + last.offsetWidth + EDGE - width));

    track._x = x;
    track.style.transform = 'translate3d(' + (-x) + 'px, 0, 0)';
  }

  function scrollVertically(el, row) {
    var content = el.closest('.view-scroll');
    if (!content) { return; }

    var viewport = content.parentNode;
    var height = viewport.clientHeight;
    var y = content._y || 0;

    if (row.hasAttribute('data-scroll-top')) {
      y = 0;
    } else {
      var top = offsetWithin(row, content, 'offsetTop');
      var marginTop = parseInt(content.getAttribute('data-margin-top') || 0, 10);
      var marginBottom = parseInt(content.getAttribute('data-margin-bottom') || 0, 10);

      if (content.getAttribute('data-scroll') === 'align') {
        y = top - marginTop; // the focused row always sits at the same place
      } else if (top - y < marginTop) {
        y = top - marginTop;
      } else if (top + row.offsetHeight - y > height - marginBottom) {
        y = top + row.offsetHeight - (height - marginBottom);
      }
    }
    y = clamp(y, 0, Math.max(0, content.offsetHeight - height));

    content._y = y;
    content.style.transform = 'translate3d(0, ' + (-y) + 'px, 0)';
  }

  nav.isTyping = function () {
    var active = document.activeElement;
    return !!active && active.tagName === 'INPUT';
  };

  /** @return {Boolean} true if an element got the focus */
  nav.focus = function (el) {
    if (!el || !document.body.contains(el)) {
      var all = rows();
      if (all.length) { all[0]._navLast = null; } // start at the active menu item
      el = SM.app.defaultFocus() || (all.length ? pick(all[0]) : null);
    }
    if (!el) { return false; }

    if (nav.current && nav.current !== el) {
      nav.current.classList.remove('focus');
      if (nav.current.tagName === 'INPUT') { nav.current.blur(); }
    }
    nav.current = el;
    el.classList.add('focus');

    var row = rowOf(el);
    if (row) {
      row._navLast = el;
      scrollHorizontally(el);
      scrollVertically(el, row);
    }
    SM.app.onFocus(el);
    return true;
  };

  /** @return {Element|null} focusable element with the given data-key on the current screen */
  nav.find = function (key) {
    if (!key) { return null; }
    var found = null;
    SM.app.navRoots().some(function (root) {
      found = root.querySelector('[data-key="' + key + '"]');
      return !!found;
    });
    return found;
  };

  /**
   * Runs a function that renders (parts of) the screen again and keeps the focus on the
   * same element, elements are recognized by their data-key attribute.
   */
  nav.preserve = function (render) {
    var key = nav.current && nav.current.getAttribute('data-key');
    render();

    if (nav.current && document.body.contains(nav.current)) { return nav.refresh(); }
    nav.current = null;
    nav.focus(nav.find(key));
  };

  /** Puts the scroll positions back in place, e.g. after a screen was rendered again */
  nav.refresh = function () {
    if (nav.current && document.body.contains(nav.current)) { nav.focus(nav.current); }
  };

  /** @param {String} direction left, right, up or down */
  nav.move = function (direction) {
    var current = nav.current;
    var all = rows();
    if (!all.length) { return; }

    var row = current && document.body.contains(current) && isVisible(current) ? rowOf(current) : null;
    var index = all.indexOf(row);
    if (index === -1) { return nav.focus(null); }

    if (direction === 'left' || direction === 'right') {
      var list = items(row);
      var target = list[list.indexOf(current) + (direction === 'right' ? 1 : -1)];
      if (target) { nav.focus(target); }
      return;
    }

    var nextRow = all[index + (direction === 'down' ? 1 : -1)];
    if (nextRow) { nav.focus(pick(nextRow, current)); }
  };

  /** OK button: opens the keyboard on inputs, clicks everything else */
  nav.activate = function () {
    var current = nav.current;
    if (!current || !document.body.contains(current)) { return; }

    if (current.tagName === 'INPUT') {
      current.focus();
    } else {
      current.click();
    }
  };

  // mouse support (USB/Bluetooth mouse on the TV, development in the browser)
  // mousemove instead of mouseover: only react when the pointer itself was moved
  document.addEventListener('mousemove', function (event) {
    var el = event.target.closest ? event.target.closest('.focusable') : null;
    if (!el || el === nav.current || el.hasAttribute('disabled')) { return; }

    var roots = SM.app.navRoots();
    var inside = roots.some(function (root) { return root.contains(el); });
    if (!inside) { return; }

    if (nav.current) {
      nav.current.classList.remove('focus');
      if (nav.current.tagName === 'INPUT' && el.tagName !== 'INPUT') { nav.current.blur(); }
    }
    nav.current = el;
    el.classList.add('focus');
    var row = rowOf(el);
    if (row) { row._navLast = el; }
    SM.app.onFocus(el);
  });
})();
