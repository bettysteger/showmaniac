import { defineStore } from 'pinia'
import { useShowsStore } from './shows'

const headers = {
  'trakt-api-key': 'fa77a129a9f09b971f1be09c64b38c67c73e200d97d4248efb496b3f67e891d1',
  'trakt-api-version': 2
};

export const usePopularStore = defineStore('popularShows', {
  state: () => ({
    popularShows: [],
    isLoading: false,
    error: null
  }),

  actions: {
    async fetchPopularShows(page = 1, limit = 12) {
      try {
        this.isLoading = true
        this.error = null

        // Get saved shows from localStorage
        const savedShows = JSON.parse(localStorage.getItem('showmaniac')) || []
        const savedShowIds = savedShows.map(show => show.id)
        const savedShowNames = savedShows.map(show => show.name)

        const response = await fetch(`https://api.trakt.tv/shows/trending?limit=${limit}&page=${page}`, { headers })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const trendingShows = await response.json()

        // Clear existing shows if it's page 1
        if (page === 1) {
          this.popularShows = []
        }

        // Process each trending show
        for (const trendingObj of trendingShows) {
          const title = trendingObj.show.title

          if (savedShowNames.includes(title)) {
            continue
          }

          try {
            const show = await useShowsStore().singlesearch(title)
            if (show.image?.medium && !savedShowIds.includes(show.id)) {
              show.image.medium = show.image.medium.replace('http:', 'https:')
              this.popularShows.push(show)
            }
          } catch (err) {
            console.error(`Error fetching details for show: ${title}`, err)
          }
        }

      } catch (err) {
        this.error = err
        console.error('Error fetching popular shows:', err)
      } finally {
        this.isLoading = false
      }
    }
  }
})