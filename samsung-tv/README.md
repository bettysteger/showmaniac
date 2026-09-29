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
The address is either a page with a video player that allows to be embedded, or a video file
or stream (`.mp4`, `.m4v`, `.mov`, `.webm`, `.m3u8`, `.mpd`). Video files and streams are played
by the video player of the TV (Samsung AVPlay), in a desktop browser by a video element.

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
Video files and streams with AVPlay on that TV: an HLS stream with an IP address
(`http://192.168.0.32:5181/test.m3u8`) plays, seeks and pauses. With a host name (also one that
points to the same IP address, and public HTTPS streams) AVPlay never loads anything, it stays
idle without an error: the video player of the TV can not look up host names when it is used by
the app. After 25 seconds the player closes with a message.

### Stream of the page in the player of the TV

On the TV the stream of an embedded page is handed to AVPlay once the episode plays in the page
(`playerNativeStreams`): the player takes the address of the video (for players with hls.js,
which play a `blob:` address, the first `.m3u8` the page loaded), pauses and hides the page and
starts AVPlay at the same position, with the best quality and through the stream proxy with the
page as Referer. When AVPlay plays, the page is closed. If AVPlay reports an error or did not
start after 15 seconds, the page plays on.

* Only when AVPlay can load the address: it has an IP address, or `proxyUrl` is set
* Streams that need cookies of the page do not work in AVPlay, then the page plays on
* DASH (`.mpd`) is not taken, the proxy does not rewrite it

Tested on the QN85B with `tools/test/hls.html` (hls.js, mux test stream) and the proxy on
Home Assistant: 8 of 10 switches played (the last 4 with the best quality from the start),
about 2 to 3 seconds of buffering after the switch. Twice AVPlay did not start (once an error,
once it did not finish preparing), then the page played on.

### Stream proxy

Because of this, video files and streams with a host name are loaded through a proxy on a
computer in the home network, the TV gets them from its IP address:

```sh
node samsung-tv/tools/proxy.mjs
```

It prints its address, set it in `.env` and install the app again:

```
TV_PROXY_URL=http://192.168.0.32:5181
```

The player then plays `https://host/video.m3u8` as
`http://192.168.0.32:5181/stream?url=https%3A%2F%2Fhost%2Fvideo.m3u8`. HLS playlists are
rewritten so segments, keys and quality levels also go through the proxy, range requests are
passed on for seeking in video files. `&referer=<address>` sends a Referer for streams that
want one. Addresses with an IP address are played directly. Every request is logged with status,
type and size, so the log shows whether a server delivered a video or e.g. an error page.

HLS streams in fMP4 (`#EXT-X-MAP`, segments like `.m4s`) are repackaged to MPEG-TS with ffmpeg
(`-c copy`, nothing is encoded again). Measured on the QN85B with test streams:

| Stream | AVPlay |
| --- | --- |
| MPEG-TS | plays |
| fMP4, video only, file type `mp42` (Apple) | plays |
| fMP4, file type `iso5`/`iso6` (ffmpeg) | `PLAYER_ERROR_NOT_SUPPORTED_FILE` |
| fMP4, video and audio in one file | never finishes preparing, no error |
| each fMP4 above, repackaged to MPEG-TS by the proxy | plays, seeking works |

A repackaged segment can only be sent when it is downloaded completely, so the proxy prepares
the next 20 segments (`PREFETCH`, about 2 minutes, up to 150 MB of memory) while the TV plays one.
They are downloaded in order, at most 2 at once (`MAX_DOWNLOADS`); the segment the TV waits for
starts at once. With a real streaming server 6 downloads at once delivered almost nothing for
20 seconds, and the segment the TV needed next came fifth. Without that the TV waits for every
segment when the server is not much faster than the video. Test on the QN85B with a server that
delivers 0.8 MB/s per connection (a segment takes 5.9 s to load and plays 6 s): without
prefetching the video started after 14 s and fell behind, with it after 8 s and without stalls.
The log shows how long every download and repackaging took, how long the server took to answer,
how fast it sent and how many downloads ran at once, and every 10 seconds the speed of all downloads together: if the total does not grow with
more downloads at once, the server or the network is the limit and more prefetching does not
help. A 1080p stream with 5 MB per 6 seconds needs about 0.8 MB/s.
Every request of the TV and every report shows how much video is ready after the segment the TV
asked for last (`ready ahead of the TV: 84 s (14 segments)`): if it keeps shrinking while the TV
plays, the server is slower than the video on average and a bigger buffer only delays the stall.

Without ffmpeg (`FFMPEG=<path>` to use another one) fMP4 is passed on unchanged. Playlists with
byte ranges are not repackaged. The Home Assistant add-on contains ffmpeg.

Tested on the QN85B: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` through the proxy
plays in 1080p, seeks and pauses. The proxy can be used by everyone in the home network, do not
make its port reachable from the internet.

#### As a Home Assistant add-on

So the proxy runs all the time without a computer, it can run on Home Assistant OS
(tested setup: Raspberry Pi 4) as a local add-on (`tools/homeassistant/showmaniac_proxy`):

1. Install the **Samba share** add-on in Home Assistant and start it
2. On the Mac: Finder, **Go > Connect to Server**, `smb://<ip of home assistant>`, open `addons`
3. `samsung-tv/tools/homeassistant/install.sh` copies the add-on to `/Volumes/addons`
4. In Home Assistant: **Settings > Add-ons > Add-on store**, menu **Check for updates**,
   install and start **showmaniac stream proxy** under **Local add-ons**
5. `TV_PROXY_URL=http://<ip of home assistant>:5181` in `.env`, install the app again

After a change of `tools/proxy.mjs` run `install.sh` again, raise `version` in `config.yaml`
and update the add-on in Home Assistant.

Test pages for development: set `SM.settings.playerUrl = '/tools/test/player.html'` (video in
an embedded frame) or `'/tools/test/in-page.html'` (video in the page, covered by preview images)
, `'/tools/test/shadow.html'` (video in a web component, starts only with its play button)
, `'/tools/test/hls.html'` (hls.js player, on the TV its stream is handed to AVPlay)
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
| `tools/proxy.mjs` | stream proxy for the player |
| `tools/homeassistant/` | the stream proxy as a Home Assistant add-on |
| `js/views/` | screens: home, detail, search, account |
