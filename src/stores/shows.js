import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { auth, db } from '../firebase/config'
import { ref as dbRef, set, onValue } from 'firebase/database'
import { useLoading } from '../composables/useLoading'

const apiUrl = 'https://api.tvmaze.com/shows/';
const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY;

export const useShowsStore = defineStore('shows', () => {
  const shows = ref(JSON.parse(localStorage.getItem('showmaniac')) || []);
  const originalTitle = document.title
  const { startLoading, stopLoading } = useLoading();
  let dbUnsubscribe = null;
  let isInitialSync = true;
  let isSyncing = false;

  // Subscribe to Firebase when auth state changes
  auth.onAuthStateChanged((user) => {
    if (user) {
      const userShowsRef = dbRef(db, `users/${user.uid}/shows`);

      // First time login - upload local shows
      if (isInitialSync && shows.value.length > 0) {
        startLoading();
        set(userShowsRef, shows.value).finally(() => {
          stopLoading();
        });
      }

      // Subscribe to changes
      dbUnsubscribe = onValue(userShowsRef, (snapshot) => {
        const data = snapshot.val();
        if (data && !isSyncing) {
          isSyncing = true;
          shows.value = data;
          localStorage.setItem('showmaniac', JSON.stringify(shows.value));
          isSyncing = false;
          // After loading Firebase data, update shows with fresh API data
          updateShows();
        }
        isInitialSync = false;
      });

      if(window.mixpanel) {
        const providerData = user.providerData && user.providerData[0];
        window.mixpanel.identify(user.uid);
        window.mixpanel.people.set({
          '$email': providerData?.email || user.email,
          '$last_name': providerData?.displayName || user.email,
          showsLength: shows.value.length,
          toWatchLength: shows.value.filter((show) => !show.seen).length
        });
      }
    } else {
      // Unsubscribe when logged out
      if (dbUnsubscribe) {
        dbUnsubscribe();
        dbUnsubscribe = null;
      }
      isInitialSync = true;
    }
  });

  /**
   * Extends show objects with API info (nextepisode, previousepisode, etc.)
   */
  async function updateShows() {
    if (shows.value.length > 0) {
      startLoading();
    }

    // Run updates in parallel for better performance
    await Promise.all(
      shows.value.map(async (show) => {
        await update(show);
      })
    );

    updateStorage();
    stopLoading();
  }
  updateShows();

  function updateSiteTitle() {
    const unseenCount = unseen.value.length
    document.title = unseenCount ? `(${unseenCount}) ${originalTitle}` : originalTitle
  }

  function updateStorage() {
    if (isSyncing) return;

    localStorage.setItem('showmaniac', JSON.stringify(shows.value));
    updateSiteTitle();

    // Sync to Firebase if user is logged in
    const user = auth.currentUser;
    if (user) {
      isSyncing = true;
      startLoading();
      const userShowsRef = dbRef(db, `users/${user.uid}/shows`);
      set(userShowsRef, shows.value).finally(() => {
        isSyncing = false;
        stopLoading();
      });
    }
  }

  function add(show) {
    if (shows.value.find((s) => s.id === show.id)) return

    shows.value.push(show);
    update(show).then(updateStorage)
    window.mixpanel?.track('Add TV Show', {id: show.id, name: show.name});
  }

  function remove(show) {
    shows.value = shows.value.filter((s) => s.id !== show.id);
    updateStorage();
  }

  const unseen = computed(() => shows.value.filter((s) => !s.seen))

  async function getInfo(show) {
    show.loading = true;

    let data = await fetch(apiUrl + show.id + '?embed[]=previousepisode&embed[]=nextepisode')
    data = await data.json()

    let beforeTba = show.latestepisode?.date === 'tba';
    const beforeLatestId = show.latestepisode?.id;
    updateEpisodeDates(data);
    Object.assign(show, data) // to not overwrite 'seen' or 'lastSeen'

    if (isSpecial(show.latestepisode)) {
      // specials are not part of lastSeen: a new special is unseen, otherwise keep 'seen'
      if (show.latestepisode.id !== beforeLatestId) { show.seen = false; }
    } else if(show.lastSeen || beforeTba) {
      show.seen = show.latestepisode.number === show.lastSeen;
    }
    await resolveTmdbId(show);
    await resolveSpecialNo(show);
    show.loading = false;
  }

  /**
   * Looks up the TMDB ID (needed for streaming links) via the IMDb/TVDB IDs from TVmaze.
   * Runs once per show: the result is stored on the show (0 = no match) and persisted.
   */
  async function resolveTmdbId(show) {
    if (show.tmdb !== undefined || !tmdbApiKey) { return; }

    const lookups = [['imdb_id', show.imdb], ['tvdb_id', show.thetvdb]].filter(([, id]) => id);
    let failed = false;

    for (const [source, id] of lookups) {
      try {
        const response = await fetch(`https://api.themoviedb.org/3/find/${id}?external_source=${source}&api_key=${tmdbApiKey}`);
        const json = await response.json();
        const match = json.tv_results?.[0];
        if (match) {
          show.tmdb = match.id;
          return;
        }
      } catch {
        failed = true;
      }
    }

    // Only remember "no match" if every lookup actually answered; retry next time on network errors
    if (!failed) { show.tmdb = 0; }
  }

  /**
   * Looks up the TMDB number of a special that is the latest episode, e.g. "00x02": TMDB puts
   * specials in season 0 and streaming links need it. Matched by air date, then by name.
   * Stored as latestepisode.tmdbNo (null = no match).
   */
  async function resolveSpecialNo(show) {
    const latest = show.latestepisode;
    if (!isSpecial(latest) || latest.tmdbNo !== undefined || !show.tmdb || !tmdbApiKey) { return; }

    try {
      const response = await fetch(`https://api.themoviedb.org/3/tv/${show.tmdb}/season/0?api_key=${tmdbApiKey}`);
      const episodes = (await response.json()).episodes || [];
      const byName = (episode) => episode.name?.toLowerCase() === latest.name?.toLowerCase();
      const byDate = episodes.filter((episode) => latest.airdate && episode.air_date === latest.airdate);
      const match = byDate.length > 1 ? (byDate.find(byName) || byDate[0]) : byDate[0] || episodes.find(byName);
      latest.tmdbNo = match ? `00x${match.episode_number.toString().padStart(2, '0')}` : null;
    } catch {
      // network error: retry next time
    }
  }

  async function update(show) {
    const needsTmdbId = tmdbApiKey && show.tmdb === undefined;
    const needsSpecialNo = tmdbApiKey && show.tmdb && isSpecial(show.latestepisode) && show.latestepisode.tmdbNo === undefined;

    if(!needsTmdbId && !needsSpecialNo && show.nextepisode && show.latestepisode?.date) {
      let nextDate = new Date(show.nextepisode.date);
      let inFuture = nextDate.getTime() === nextDate.getTime() && nextDate > new Date();
      // Don't load if show has ended or nextepisode date is in the future
      if(show.nextepisode.date === 'ENDED' || inFuture) {
        return Promise.resolve();
      }
    }

    return getInfo(show);
  }

  async function getEpisodes(show) {
    const data = await fetch(`${apiUrl}${show.id}/episodes`)
    const json = await data.json()
    return json.map(convertEpisodeNo).filter(Boolean) // specials have no episode number
  }

  function modalLink(show) {
    if(!show.url) { return; }
    return '/tv'+show.url.replace(/https?:\/\/www\.tvmaze\.com\/shows/, '');
  }

  async function singlesearch(query) {
    const data = await fetch(`${apiUrl.replace('shows/', '')}singlesearch/shows?q=${encodeURIComponent(query)}`)
    return data.json()
  }

  return { shows, add, remove, update, singlesearch, getEpisodes, modalLink, unseen, updateStorage }
})

// Helpers

/** Specials (e.g. a Halloween episode) have an air date but no episode number */
export function isSpecial(episode) {
  return !!episode && !episode.number && !!episode.airstamp;
}

function updateEpisodeDates(show) {
  const latest = show.latestepisode = show._embedded?.previousepisode || {};
  const next = show.nextepisode = show._embedded?.nextepisode || {};
  // keep external IDs (used to resolve the TMDB ID), drop the rest to keep storage small
  // null instead of undefined: Firebase rejects undefined values
  show.imdb = show.externals?.imdb || null;
  show.thetvdb = show.externals?.thetvdb || null;
  ['_embedded', '_links', 'externals'].forEach((key) => delete show[key]);

  next.date = show.status === 'Ended' ? 'ENDED' : parseDateTime(next);
  latest.date = parseDateTime(latest);
}

function convertEpisodeNo(episode) {
  if (episode.number) {
    const season = episode.season.toString().padStart(2, '0');
    const number = episode.number.toString().padStart(2, '0');
    episode.number = `${season}x${number}`;
    return episode.number;
  }
}

function parseDateTime(episode) {
  convertEpisodeNo(episode);
  try {
    const datetime = new Date(episode.airstamp);
    return isNaN(datetime) ? 'tba' : datetime;
  } catch {
    return 'tba';
  }
}
