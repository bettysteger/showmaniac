# showmaniac for Samsung TV

Your showmaniac list on the TV: browse your shows like on Netflix and open the play link of the
next episode directly on the TV.

Tizen web app, plain HTML/CSS/JS without a build step, so it also runs on older Samsung TVs
(2017 and newer).

## Features

* Home with rows of posters: to watch, coming up, watched, popular
* Show details with all seasons and episodes
* Play opens the play link of the next episode in the browser of the TV
* After watching, the app asks if the episode should be marked as seen
* Mark episodes as seen, catch up, track and remove shows
* Sign in with your showmaniac account (email and password) to sync with the web app.
  Without an account the list is stored on the TV.

## Remote control

| Key | Action |
| --- | --- |
| Arrows | move the focus |
| OK | open show, press button, open the keyboard in text fields |
| Back | previous screen, exit on home |
| Play | play the next episode of the focused show |

## Setup

The API keys are read from the `.env` of the web app and written to `js/config.js`
(ignored by git):

```sh
node samsung-tv/tools/config.mjs
```

* `VITE_TMDB_API_KEY` is needed for play links of shows that were not added in the web app
* `VITE_TRAKT_API_KEY` is needed for popular shows

## Development in the browser

```sh
node samsung-tv/tools/serve.mjs
```

Open http://localhost:5180 in Chrome. Keys: arrows, enter, escape (back), p (play).
Play links are opened in a new tab.

## Install on the TV

1. On the TV open **Apps**, press `1` `2` `3` `4` `5` on the remote, turn on **Developer mode**,
   enter the IP address of your computer and restart the TV
2. Install [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html)
   with the **TV Extensions** and the **Samsung Certificate Extension**
3. Create a Samsung certificate profile in the **Certificate Manager**
4. Connect to the TV in the **Device Manager** (IP address of the TV)
5. **File > Import > Tizen > Tizen Project**, select the `samsung-tv` folder (profile `tv-samsung`)
6. Right click on the project: **Run As > Tizen Web Application**

Or with the command line tools of Tizen Studio:

```sh
sdb connect <ip of the tv>
sdb devices                                   # shows the name of the TV
tizen package -t wgt -s <certificate profile> -- samsung-tv
tizen install -n showmaniac.wgt -t <name of the tv> -- samsung-tv
```

## How play links work

The play link is the same as in the web app (`watchUrl` in `src/components/ShowPast.vue`).
If the link changes, also change `playUrl` in `js/settings.js`.

The streaming page does not allow to be embedded into other pages, so it can not run inside of
the app. The app opens the link in the browser of the TV (`org.tizen.browser`), which can be
controlled with the remote and plays videos in fullscreen. Leaving the browser brings you back
to showmaniac.

## Files

| File | Content |
| --- | --- |
| `config.xml` | Tizen app settings and privileges |
| `js/settings.js` | play link, Firebase config |
| `js/store.js` | shows, sync with Firebase, same data format as `src/stores/shows.js` |
| `js/nav.js` | focus handling for the remote control |
| `js/player.js` | opens play links |
| `js/views/` | screens: home, detail, search, account |
