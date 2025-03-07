<script setup>
import { computed, ref } from 'vue'
import { useShowsStore } from '../stores/shows';
import { storeToRefs } from 'pinia';
import ShowPast from '../components/ShowPast.vue';
import ShowFuture from '../components/ShowFuture.vue';
import PopularShows from '../components/PopularShows.vue';

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
  if (a.nextepisode?.date === 'tba' || a.nextepisode?.date == 'ENDED') return 1;
  if (b.nextepisode?.date === 'tba' || b.nextepisode?.date == 'ENDED') return -1;
  return new Date(a.nextepisode?.date) - new Date(b.nextepisode?.date);
}))

function toggleFilterOutSeen() {
  filterOutSeen.value = !filterOutSeen.value
  if(filterOutSeen.value) {
    localStorage.setItem('filterOutSeen', true)
  } else {
    localStorage.removeItem('filterOutSeen')
  }
}
</script>
<template>
  <main v-if="shows.length" class="container">

    <div class="row"><div class="col-md-8"><div class="row">
      <div class="col-sm-6">

        <h3>
          <span v-if="unseen.length">
            {{ unseen.length }} to watch
            <i :title="filterOutSeen ? 'Show all' : 'Hide seen'"
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
                <i v-if="!unseen.length" class="fa fa-trophy pull-right" title="WOW! You've seen every episode"></i>
                past
              </h2>
            </div>
            <ShowPast v-for="show in pastShows" :key="show.id" :show="show" />
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
</template>
