<script setup>
import { computed, ref } from 'vue'
import { useShowsStore } from '../stores/shows';
import { storeToRefs } from 'pinia';
import ShowPast from '../components/ShowPast.vue';
import ShowFuture from '../components/ShowFuture.vue';
import PopularShows from '../components/PopularShows.vue';
import AdBanner from '../components/AdBanner.vue';

const { shows, unseen } = storeToRefs(useShowsStore())
const filterOutSeen = ref(localStorage.getItem('filterOutSeen') || false)
const showFutureCol = ref(true)
const showPopular = ref(false)
const query = ref('')

function filterQuery(show) {
  return query.value.length ? show.name.toLowerCase().includes(query.value.toLowerCase()) : true
}

// sort past shows by latestepisode.date
const pastShows = computed(() => [...shows.value].filter(filterQuery).filter(show => {
  return unseen.value.length ? (!filterOutSeen.value || !show.seen) : true
}).sort((a, b) => {
  return new Date(b.latestepisode?.date) - new Date(a.latestepisode?.date);
}))
// sort future shows by nextepisode.date (tba should be at end)
const futureShows = computed(() => [...shows.value].filter(filterQuery).sort((a, b) => {
  const order = (status) => {
    if (status === 'ENDED') return 2;  // ENDED goes last
    if (status === 'tba') return 1;    // TBA goes before ENDED
    return 0;  // Sort by date if neither
  };

  const aOrder = order(a.nextepisode?.date);
  const bOrder = order(b.nextepisode?.date);

  if (aOrder !== bOrder) return aOrder - bOrder;

  // If both are neither "tba" nor "ENDED", sort by date
  return new Date(a.nextepisode?.date) - new Date(b.nextepisode?.date);
}))

function toggleFilterOutSeen() {
  filterOutSeen.value = !filterOutSeen.value
  if(filterOutSeen.value) {
    localStorage.setItem('filterOutSeen', true)
  } else {
    localStorage.removeItem('filterOutSeen')
  }
  window.mixpanel?.track('Check seenFilter', { filterOutSeen: filterOutSeen.value })
}
</script>
<template>
  <main v-if="shows.length" class="container">

    <div class="row"><div class="col-md-8"><div class="row">
      <div class="col-sm-6">

        <h3>
          <span v-if="unseen.length">
            {{ unseen.length }} to watch
            <i v-if="unseen.length && unseen.length < shows.length"
                v-tooltip="filterOutSeen ? 'Show all' : 'Hide seen'"
                @click="toggleFilterOutSeen" class="fa fa-toggle-on pull-right"
                :class="filterOutSeen ? 'green' : 'fa-flip-horizontal'"></i>
          </span>
          <span v-else>All watched</span>
        </h3>

      </div>
      <div v-if="shows.length > 1" class="col-sm-6 text-right hidden-xs">
        <div class="form-inline">
          <div class="form-group has-feedback search">
            <input type="search" v-model="query" placeholder="filter added shows" class="form-control" />
            <i class="fa fa-search"></i>
          </div>
        </div>
      </div>
    </div></div></div>

    <div class="row">
      <!-- Main column -->
      <div class="col-md-8">
        <div class="row">
          <div class="col-sm-6">
            <div class="greenbg row">
              <h2>
                <i v-if="!unseen.length" class="fa fa-trophy pull-right" v-tooltip="'WOW! You\'ve seen every episode'"></i>
                past
              </h2>
            </div>
            <ShowPast v-for="(show, i) in pastShows" :key="show.id" v-model="pastShows[i]" />

            <AdBanner v-if="filterOutSeen" />
          </div>
          <div class="col-sm-6">
            <div class="greenbg row">
              <h2><i @click="showFutureCol=!showFutureCol" class="fa pull-right visible-xs-block" :class="'fa-chevron-'+(showFutureCol ? 'up' : 'down')"></i>future</h2>
            </div>
            <div v-if="showFutureCol">
              <ShowFuture v-for="show in futureShows" :key="show.id" :show="show" />
            </div>
          </div>
        </div>
      </div>
      <!-- Popular shows -->
      <div class="col-md-4">
        <div class="greenbg row">
          <h2 @click="showPopular=!showPopular" role="button">
            <i class="fa pull-right" :class="'fa-chevron-'+(showPopular ? 'up' : 'down')"></i>
            popular
          </h2>
        </div>
        <div v-if="showPopular" class="row">
          <PopularShows />
        </div>

      </div>
    </div>
  </main>
  <RouterView />
</template>
