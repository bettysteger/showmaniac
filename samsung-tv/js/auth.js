/*
 * showmaniac TV - sign in with the showmaniac account (email and password) via the Firebase REST API.
 * The Firebase SDK is not used, it is too heavy for older TVs and needs a build step.
 */
(function () {
  'use strict';

  var SM = window.SM;
  var STORAGE_KEY = 'sm_auth';
  var session = SM.storage.get(STORAGE_KEY, null);
  var refreshing = null;

  var MESSAGES = {
    EMAIL_NOT_FOUND: 'No account found with this email',
    INVALID_PASSWORD: 'Incorrect password',
    INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect',
    INVALID_EMAIL: 'Please enter a valid email address',
    MISSING_PASSWORD: 'Please enter your password',
    USER_DISABLED: 'This account has been disabled',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts, please try again later'
  };

  function errorMessage(error) {
    var code = error && error.data && error.data.error && error.data.error.message;
    if (!code) { return 'Network error. Please check your internet connection'; }
    code = String(code).split(' ')[0];
    return MESSAGES[code] || 'Sign in failed (' + code + ')';
  }

  function save(data) {
    session = data;
    if (data) {
      SM.storage.set(STORAGE_KEY, data);
    } else {
      SM.storage.remove(STORAGE_KEY);
    }
    SM.auth.user = data ? { email: data.email, uid: data.uid } : null;
  }

  function refresh() {
    if (refreshing) { return refreshing; }

    refreshing = SM.api.request('https://securetoken.googleapis.com/v1/token?key=' + SM.settings.firebase.apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(session.refreshToken)
    }).then(function (json) {
      refreshing = null;
      save({
        email: session.email,
        uid: json.user_id,
        idToken: json.id_token,
        refreshToken: json.refresh_token,
        expiresAt: Date.now() + parseInt(json.expires_in, 10) * 1000
      });
      return session.idToken;
    }, function (error) {
      refreshing = null;
      // the account was deleted, disabled or the password changed: sign in again
      if (error.status === 400 || error.status === 401 || error.status === 403) { save(null); }
      throw error;
    });

    return refreshing;
  }

  SM.auth = {
    user: session ? { email: session.email, uid: session.uid } : null,

    isSignedIn: function () {
      return !!session;
    },

    /** @return {Promise} rejects with an Error whose message can be shown to the user */
    signIn: function (email, password) {
      var url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + SM.settings.firebase.apiKey;

      return SM.api.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
      }).then(function (json) {
        save({
          email: json.email,
          uid: json.localId,
          idToken: json.idToken,
          refreshToken: json.refreshToken,
          expiresAt: Date.now() + parseInt(json.expiresIn, 10) * 1000
        });
        return SM.auth.user;
      }, function (error) {
        throw new Error(errorMessage(error));
      });
    },

    signOut: function () {
      save(null);
    },

    /** @return {Promise} valid ID token, refreshed when it is about to expire */
    getToken: function () {
      if (!session) { return Promise.reject(new Error('Not signed in')); }
      if (session.expiresAt - Date.now() > 60000) { return Promise.resolve(session.idToken); }
      return refresh();
    }
  };
})();
