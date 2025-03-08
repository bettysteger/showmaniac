<template>
  <div class="tvshow row border-right" :class="{seen: show.seen}">
    <div class="col-xs-10">
      <h4>{{ show.name }}</h4>
      <p>
        {{ formatDate(show.latestepisode?.date) }} &nbsp;
        <b>
          <a v-tooltip="'search this episode'" :href="`http://google.com/search?q=${parseName(show)} ${show.latestepisode?.number}`" target="_blank" rel="noopener">{{ show.latestepisode?.number }}</a>
        </b>
        <a v-if="isDate(show.latestepisode?.date)" v-tooltip="'watch online'" :href="watchseries(show)" target="_blank" rel="noopener"><i class="fa fa-fw fa-play-circle-o"></i></a>
        <!-- <a ng-href="{{_.availability[show.id].amazon}}" target="_blank" ng-class="{freeForPrime:_.availability[show.id].freeForPrime, invisible:!_.availability[show.id].amazon}" v-tooltip="'watch via Amazon'" ><i class="fa fa-fw fa-amazon"></i></a> -->
        &nbsp;
        <small v-if="show.lastSeen && !show.seen">
          <span v-if="!changeLastSeen" v-tooltip="'click to edit'" @click="changeLastSeen=true; getEpisodes()">{{ show.lastSeen }}</span>

          <select v-else v-model="show.lastSeen" @change="handleEpisodeChange" @blur="changeLastSeen = false">
            <option v-for="episode in episodes" :key="episode" :value="episode">{{ episode }}</option>
          </select> seen <a v-if="changeLastSeen" @click.prevent="clearLastSeen" href>&times;</a>
        </small>
      </p>
    </div>
    <div class="col-xs-2 text-right" v-if="isDate(show.latestepisode?.date)">
      <i @click="toggleSeen" v-tooltip="'seen?'" class="fa fa-check-circle" :class="{green:show.seen}"></i><i v-if="show.loading && isDate(show.nextepisode?.date)" class="fa fa-circle-o-notch fa-spin"></i>
      <!-- <br><i v-if="!show.seen" ng-click="_.catchUp(show)" v-tooltip="catch up!" tooltip-placement="bottom" class="fa fa-arrow-circle-up"></i> -->
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { isDate, formatDate } from './formatDate.js';
import { useShowsStore } from '../stores/shows';
import { vTooltip } from '../directives/tooltip';

const showsStore = useShowsStore()

const show = defineModel({ type: Object, required: true })

const changeLastSeen = ref(false)
const episodes = ref([])

/**
 * Removes all special chars, all except numbers, letters and spaces.
 * "Shameless (US)" => "Shameless US"
 * @example
 *   <a href="https://www.google.com/search?q={{show.parseName()}}">
 * @return {String}      name without special chars
 */
function parseName(show) {
  return show.name.replace(/[^ a-zA-Z0-9]/g, '');
}

/**
 * Generates watchseries Link
 * @example
 *   https://www.watchseries1.video/tv-series/big-little-lies-season-2-episode-1
 * @return {String}      link to watchseries-online
 */
function watchseries(show) {
  var episodeNo = nextEpisodeNo(show);
  var series = show.name.replace('&', 'and').replace(/[^ a-zA-Z0-9]/g, '').replace(/\s+/g, '-').toLowerCase();
  var season = parseInt(episodeNo.split('x')[0]);
  var episode = parseInt(episodeNo.split('x')[1]);

  return 'https://www.watchseries1.video/tv-series/' + series + '-season-' + season + '-episode-' + episode;
}

function nextEpisodeNo(show) {
  if (!show.seen && show.episodes?.length) {

    var nextIndex = show.lastSeen ? show.episodes.indexOf(show.lastSeen) + 1 : 0;
    nextIndex = show.episodes[nextIndex] ? nextIndex : show.episodes.length - 1;

    return show.episodes[nextIndex];
  } else {
    return show.latestepisode?.number;
  }
}

// clicking on check circle: seen
async function toggleSeen() {
  show.value.seen = !show.value.seen;

  const episodeNo = show.value.latestepisode?.number;
  if (episodeNo) {
    if (show.value.seen) {
      show.value.lastSeen = episodeNo;
    } else {
      await getEpisodes();
      const prevIndex = episodes.value.indexOf(episodeNo) - 1;
      show.value.lastSeen = episodes.value[prevIndex];
    }
  }
  showsStore.updateStorage();
}

async function getEpisodes() {
  if (episodes.value.length) { return; }

  episodes.value = await showsStore.getEpisodes(show.value);
}

function handleEpisodeChange() {
  show.value.seen = show.value.lastSeen == show.value.latestepisode?.number;
  changeLastSeen.value = false;
  showsStore.updateStorage();
}

function clearLastSeen() {
  delete show.value.lastSeen;
  changeLastSeen.value = false;
  showsStore.updateStorage();
}
</script>
