/*
 * showmaniac TV - sign in with the showmaniac account to sync the shows with the web app.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var h = SM.h;

  SM.views.account = function () {
    var scroll = h('div', { class: 'view-scroll' });
    var el = h('div', { class: 'view view-account' }, [scroll]);
    var email = null;
    var password = null;
    var error = null;
    var signingIn = false;

    function field(type, placeholder, key) {
      return h('input', {
        class: 'input focusable',
        type: type,
        placeholder: placeholder,
        autocomplete: 'off',
        spellcheck: 'false',
        'data-key': key
      });
    }

    function row(children) {
      return h('div', { class: 'form-row', 'data-nav-row': true }, children);
    }

    function button(key, icon, label, onclick) {
      return h('div', { class: 'button focusable', 'data-key': key, onclick: onclick }, [
        icon ? SM.icon(icon) : null,
        h('span', { text: label })
      ]);
    }

    function signIn() {
      if (signingIn) { return; }
      error.textContent = '';

      if (!email.value.trim() || !password.value) {
        error.textContent = 'Please fill in all fields';
        return;
      }

      signingIn = true;
      SM.ui.busy(1);

      SM.auth.signIn(email.value.trim(), password.value).then(function () {
        signingIn = false;
        SM.ui.busy(-1);
        SM.ui.toast('Signed in, loading your shows ...');
        SM.app.updateMenu();
        SM.router.root('home');
        SM.store.sync();
      }, function (err) {
        signingIn = false;
        SM.ui.busy(-1);
        error.textContent = err.message;
      });
    }

    function signOut() {
      SM.auth.signOut();
      SM.app.updateMenu();
      render();
      SM.nav.focus(null);
    }

    function render() {
      scroll.textContent = '';

      if (SM.auth.isSignedIn()) {
        scroll.appendChild(h('h1', { text: 'Account' }));
        scroll.appendChild(h('p', { text: 'Signed in as ' + SM.auth.user.email }));
        scroll.appendChild(h('p', {
          class: 'hint',
          text: SM.store.shows.length + ' shows. Changes are synced with showmaniac on your other devices.'
        }));
        scroll.appendChild(row([
          button('account:sync', 'sync', 'Sync now', function () {
            SM.store.sync().then(function () { SM.ui.toast('Your shows are up to date.'); });
          }),
          button('account:signout', 'close', 'Sign out', signOut)
        ]));
        return;
      }

      email = field('email', 'Email', 'account:email');
      password = field('password', 'Password', 'account:password');
      error = h('p', { class: 'error' });

      scroll.appendChild(h('h1', { text: 'Sign in' }));
      scroll.appendChild(h('p', {
        class: 'hint',
        text: 'Use the email and password of your showmaniac account to see your shows on this TV.'
      }));
      scroll.appendChild(row([email]));
      scroll.appendChild(row([password]));
      scroll.appendChild(error);
      scroll.appendChild(row([button('account:signin', 'check', 'Sign in', signIn)]));
    }

    return {
      el: el,
      topbar: true,

      init: render,

      defaultFocus: function () {
        return el.querySelector('.focusable');
      },

      // the keyboard of the TV was closed with "done"
      onInputDone: function (input) {
        if (input === email) { SM.nav.focus(password); }
        if (input === password) { SM.nav.focus(el.querySelector('[data-key="account:signin"]')); }
      },

      onStoreChange: function () {
        if (SM.auth.isSignedIn()) { render(); }
      }
    };
  };
})();
