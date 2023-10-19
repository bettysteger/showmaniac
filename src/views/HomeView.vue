<script setup>
import { ref } from 'vue'
import { usePopularStore } from '@/stores/popular'
import { storeToRefs } from 'pinia';

const popularStore = usePopularStore()
const { popularShows } = storeToRefs(popularStore)

const shows = ref(JSON.parse(localStorage.getItem('showmaniac')) || [])

function add(show) {
  if (shows.value.find((s) => s.id === show.id)) return

  shows.value.push(show)
  localStorage.setItem('showmaniac', JSON.stringify(shows.value))
}

function search(query) {
  if(!query) return popularStore.query()

  return fetch(`https://api.tvmaze.com/search/shows?q=${query}`)
    .then((res) => res.json())
    .then((res) => res.map((r) => r.show))
}
</script>
<template>
  <main>

  </main>
</template>
