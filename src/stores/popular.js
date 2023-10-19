import { ref } from 'vue'
import { defineStore } from 'pinia'

const headers = {
  'trakt-api-key': 'fa77a129a9f09b971f1be09c64b38c67c73e200d97d4248efb496b3f67e891d1',
  'trakt-api-version': 2
};

export const usePopularStore = defineStore('popular', () => {
  const popularShows = ref([])
  const currentPage = ref(1)

  function query() {
    return fetch(`https://api.trakt.tv/shows/trending?limit=12&page=${currentPage.value}`, { headers })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        popularShows.value = data.map((r) => r.show)
        return popularShows.value
      })
  }

  return { popularShows, currentPage, query }
})