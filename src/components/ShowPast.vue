<template>
  <div class="tvshow row border-right" :class="{seen: show.seen}">
    <div class="col-xs-10">
      <h4>{{ show.name }}</h4>
      <p>
        {{ formatDate(show.latestepisode?.date) }} &nbsp;
        <b>
          <a uib-tooltip="search this episode" :href="`http://google.com/search?q=${parseName(show)} ${show.latestepisode?.number}`" target="_blank" rel="noopener">{{ show.latestepisode?.number }}</a>
        </b>
        <a v-if="isDate(show.latestepisode?.date)" uib-tooltip="watch online" :href="watchseries(show)" target="_blank" rel="noopener"><i class="fa fa-fw fa-play-circle-o"></i></a>
        <!-- <a ng-href="{{_.availability[show.id].amazon}}" target="_blank" ng-class="{freeForPrime:_.availability[show.id].freeForPrime, invisible:!_.availability[show.id].amazon}" uib-tooltip="watch via Amazon" ><i class="fa fa-fw fa-amazon"></i></a> -->
        &nbsp;
        <small v-if="show.lastSeen && !show.seen">
          <span v-if="!show.changeLastSeen" uib-tooltip="click to edit" ng-click="show.changeLastSeen=true; show.getEpisodes()">{{ show.lastSeen }}</span>

          <select v-if="show.changeLastSeen" ng-model="show.lastSeen" ng-options="e for e in show.episodes"
                  ng-change="show.seen = show.lastSeen == show.latestepisode?.number;show.changeLastSeen=false;_.updateStorage()"
                  ng-blur="show.changeLastSeen=false"></select> seen <a v-if="show.changeLastSeen" ng-click="show.lastSeen=null; show.changeLastSeen=false; _.updateStorage();">&times;</a>
        </small>
      </p>
    </div>
    <div class="col-xs-2 text-right" v-if="isDate(show.latestepisode?.date)">
      <i @click="showsStore.toggleSeen(show)" uib-tooltip="seen?" class="fa fa-check-circle" :class="{green:show.seen}"></i><i v-if="show.loading && isDate(show.nextepisode?.date)" class="fa fa-circle-o-notch fa-spin"></i>
      <!-- <br><i v-if="!show.seen" ng-click="_.catchUp(show)" uib-tooltip="catch up!" tooltip-placement="bottom" class="fa fa-arrow-circle-up"></i> -->
    </div>
  </div>
</template>
<script setup>
import { isDate, formatDate } from './formatDate.js';
import { useShowsStore } from '../stores/shows';
const showsStore = useShowsStore()

defineProps({
  show: {
    type: Object,
    required: true,
  },
})

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
 *   https://www1.watchseries.fm/series/big-little-lies-season-2-episode-1
 * @return {String}      link to watchseries-online
 */
function watchseries(show) {
  var episodeNo = nextEpisodeNo(show);
  var series = show.name.replace('&', 'and').replace(/[^ a-zA-Z0-9]/g, '').replace(/\s+/g, '-').toLowerCase();
  var season = parseInt(episodeNo.split('x')[0]);
  var episode = parseInt(episodeNo.split('x')[1]);

  return 'https://www1.watchseries.fm/series/' + series + '-season-' + season + '-episode-' + episode;
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
</script>