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
4. Connect to the TV in the **Device Manager** (IP address of the TV) 192.168.0.141
5. **File > Import > Tizen > Tizen Project**, select the `samsung-tv` folder (profile `tv-samsung`)
6. Right click on the project: **Run As > Tizen Web Application**

Or with one command, which builds, signs, installs and starts the app:

```sh
samsung-tv/tools/install.sh <ip of the tv> [certificate profile]
```

The certificate profile defaults to `Showmaniac`. If the transfer fails, run it again:
the TV only accepts one connection and sometimes drops it.

## Official streaming services

The detail screen shows a button for official services that have the show: Joyn, RTL+,
Netflix, Prime Video and Disney+ (`services` in `js/settings.js`). The button opens the app of the service on the TV,
without the app the link is opened in the browser of the TV. The episode is chosen there and
the service plays it with your account.

* Which service has a show comes from TMDB (watch providers of `country`, data by JustWatch)
* Joyn: the link goes to the page of the show, e.g. `https://www.joyn.at/serien/villa-der-versuchung`,
  built from the name. If it does not exist but TMDB lists Joyn, the Joyn search is opened
* RTL+, Netflix, Prime Video and Disney+: the addresses of shows contain IDs that are not known,
  the link is a search for the name. Whether the apps use it or only open their start page
  depends on the app. The RTL+ app ignores links and always shows its start page (tested)
* Results are cached on the TV for 7 days

## Player inside the app

With a player address the episode is shown in the player of the app instead of the browser:
fullscreen, started automatically, controlled with the remote.

Set `playerUrl` in `js/settings.js`, or `TV_PLAYER_URL` in `.env` to keep it out of git
(then run `node samsung-tv/tools/config.mjs`):

```
TV_PLAYER_URL=https://player.example.com/embed/{tmdb}/{season}/{episode}
```

Placeholders: `{tmdb}` `{imdb}` `{tvdb}` `{slug}` `{season}` `{episode}`.
The address has to be a page with a video player that allows to be embedded.

| Key | Video | Cursor |
| --- | --- | --- |
| OK | pause, play | click |
| Left, right | 10 seconds back, forward | move |
| Up, down | show the cursor | move |
| Rewind, fast forward | 1 minute back, forward | |
| Back | close the player | hide the cursor |

* The video is searched in the page and all pages embedded in it. Once it plays it is put in
  front of everything in fullscreen, the rest of the page is hidden (also preview images that
  cover the video). While the cursor is shown the whole page is visible again. Popups are blocked
* Videos are also found inside web components (shadow DOM)
* Short or muted looping videos count as previews: the longest playing video is shown. Once
  the episode plays it is kept, when another video is chosen the old one is released again
* If the video does not start by itself the player clicks into the middle of the video, or of
  the page while no video was found (`playerAutoClick`)
* If the video did not start after 12 seconds the cursor appears. When the video starts
  (e.g. after a click with the cursor) the player switches back to fullscreen
* An episode that was watched to 90% is marked as seen, otherwise the app asks

Tested on a Samsung QN85B (2022, Tizen 6.5) with a test page: streams (HLS) play in 1080p.
Addresses of video files or streams (`.mp4`, `.m3u8`) instead of a page do not work on that TV:
its video player can not look up host names when it is used by the app.

Test pages for development: set `SM.settings.playerUrl = '/tools/test/player.html'` (video in
an embedded frame) or `'/tools/test/in-page.html'` (video in the page, covered by preview images)
, `'/tools/test/shadow.html'` (video in a web component, starts only with its play button)
or `'/tools/test/preview.html'` (a looping preview plays first, the episode starts later)
in the console of the browser.

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
| `js/views/player.js` | player inside the app |
| `js/views/` | screens: home, detail, search, account |
