import { defineStore } from 'pinia'
import { useShowsStore } from './shows'

const API_KEY = '129254-Showmani-FP6DHHX4' // invalid, they must have revoked it

export const useRecommendationsStore = defineStore('recommendations', {
  state: () => ({
    recommendations: [],
    isLoading: false,
    error: null
  }),

  actions: {
    async fetchRecommendations(page = 1, limit = 12) {
      try {
        this.isLoading = true
        this.error = null

        // Get saved shows from localStorage
        const savedShows = JSON.parse(localStorage.getItem('showmaniac')) || []
        const savedShowIds = savedShows.map(show => show.id)
        const savedShowNames = savedShows.map(show => show.name)

        const response = await fetch(`https://tastedive.com/api/similar?type=show&q=${savedShowNames.join(',')}&info=1&limit=${limit}&k=${API_KEY}`, { mode: 'no-cors' })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const recommendations = await response.json()
        console.log(recommendations)

        // Clear existing shows if it's page 1
        if (page === 1) {
          this.recommendations = []
        }

        // Process each trending show
        for (const recommendation of recommendations) {
          const title = recommendation.name

          if (savedShowNames.includes(title)) {
            continue
          }

          try {
            const show = await useShowsStore().singlesearch(title)
            if (show.image?.medium && !savedShowIds.includes(show.id)) {
              show.image.medium = show.image.medium.replace('http:', 'https:')
              this.recommendations.push(show)
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