<script setup>
import { computed, ref } from 'vue'
import { useShowsStore } from '../stores/shows';
// import { usePopularStore } from '@/stores/popular'
import { storeToRefs } from 'pinia';
import ShowPast from '../components/ShowPast.vue';
import ShowFuture from '../components/ShowFuture.vue';

const { shows, unseen } = storeToRefs(useShowsStore())
const showFutureCol = ref(true)

// sort past shows by latestepisode.date
const pastShows = computed(() => [...shows.value].sort((a, b) => {
  console.log(new Date(a.latestepisode?.date) - new Date(b.latestepisode?.date))
  return new Date(b.latestepisode?.date) - new Date(a.latestepisode?.date);
}))
// sort future shows by nextepisode.date (tba should be at end)
const futureShows = computed(() => [...shows.value].sort((a, b) => {
  if (a.nextepisode?.date === 'tba' || a.nextepisode?.date == 'ENDED') return 1;
  if (b.nextepisode?.date === 'tba' || b.nextepisode?.date == 'ENDED') return -1;
  return new Date(a.nextepisode?.date) - new Date(b.nextepisode?.date);
}))
</script>
<template>
  <main v-if="shows.length" class="row">
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
  </main>
</template>
