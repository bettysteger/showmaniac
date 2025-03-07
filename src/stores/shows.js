import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { auth, db } from '../firebase/config'
import { ref as dbRef, set, onValue } from 'firebase/database'
import { useLoading } from '../composables/useLoading'

const apiUrl = 'https://api.tvmaze.com/shows/';

export const useShowsStore = defineStore('shows', () => {
  const shows = ref(JSON.parse(localStorage.getItem('showmaniac')) || []);
  const loadedCount = ref(0);
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
          startLoading();
          shows.value = data;
          localStorage.setItem('showmaniac', JSON.stringify(shows.value));
          isSyncing = false;
          stopLoading();
        }
        isInitialSync = false;
      });
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
  function updateShows() {
    loadedCount.value = 0;
    if (shows.value.length > 0) {
      startLoading();
    }
    shows.value.forEach(async (show) => {
      await update(show)
      loadedCount.value++;
      if(loadedCount.value === shows.value.length) {
        updateStorage();
        stopLoading();
      }
    });
  }
  updateShows();

  function updateStorage() {
    if (isSyncing) return;

    localStorage.setItem('showmaniac', JSON.stringify(shows.value));

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
  }

  function remove(show) {
    shows.value = shows.value.filter((s) => s.id !== show.id);
    updateStorage();
  }

  // clicking on check circle: seen
  function toggleSeen(show) {
    show.seen = !show.seen;

    const episodeNo = show.latestepisode?.number;
    if (episodeNo) {
      if (show.seen) {
        show.lastSeen = episodeNo;
      } else {
        // show.getEpisodes(function () {
        //   var prevIndex = show.episodes.indexOf(episodeNo) - 1;
        //   show.lastSeen = show.episodes[prevIndex];
        //   updateStorage();
        // });
      }
    }
    updateStorage();
  }

  const unseen = computed(() => shows.value.filter((s) => !s.seen))

  async function getInfo(show) {
    show.loading = true;

    let data = await fetch(apiUrl + show.id + '?embed[]=previousepisode&embed[]=nextepisode')
    data = await data.json()
    Object.assign(show, data) // to not overwrite 'seen' or 'lastSeen'

    let beforeTba = show.latestepisode?.date === 'tba';
    updateEpisodeDates(show);
    if(show.lastSeen || beforeTba) {
      show.seen = show.latestepisode.number === show.lastSeen;
    }
    show.loading = false;
  }

  async function update(show) {
    if(show.nextepisode) {
      let nextDate = new Date(show.nextepisode.date);
      let inFuture = nextDate.getTime() === nextDate.getTime() && nextDate > new Date();
      // Don't load if show has ended or nextepisode date is in the future
      if(show.nextepisode.date === 'ENDED' || inFuture) {
        return Promise.resolve();
      }
    }

    return getInfo(show);
  }

  function modalLink(show) {
    if(!show.url) { return; }
    return '/tv'+show.url.replace(/https?:\/\/www\.tvmaze\.com\/shows/, '');
  }

  async function singlesearch(query) {
    const data = await fetch(`${apiUrl.replace('shows/', '')}singlesearch/shows?q=${encodeURIComponent(query)}`)
    return data.json()
  }

  return { shows, add, remove, toggleSeen, update, singlesearch, modalLink, unseen }
})


function updateEpisodeDates(show) {
  var latest = show.latestepisode = show._embedded?.previousepisode || {};
  var next = show.nextepisode = show._embedded?.nextepisode || {};
  delete show._embedded;
  delete show._links;
  delete show.externals;

  if(show.status === 'Ended') {
    next.date = 'ENDED';
  } else {
    next.date = parseDateTime(next);
  }
  latest.date = parseDateTime(latest);
}

function convertEpisodeNo(episode) {
  if(episode.number) {
    episode.season = episode.season.toString();
    episode.number = episode.number.toString();
    episode.number = (episode.season.length === 1 ? '0'+episode.season : episode.season) + 'x' + (episode.number.length === 1 ? '0'+episode.number : episode.number);
    return episode.number;
  }
}

function parseDateTime(episode) {
  convertEpisodeNo(episode);
  try {
    var datetime = new Date(episode.airstamp); // test time (hour)
    var isValidDate = datetime.getTime() === datetime.getTime();
    return isValidDate ? datetime : 'tba';
  } catch (e) {
    return 'tba';
  }
}