<template>
  <div class="tvshow row">
    <div class="col-xs-10">
      <h4>{{ show.name }} &nbsp;<a ng-href="{{::show.modalLink()}}"><i class="fa fa-info-circle"></i></a></h4>
      <p>
        {{ formatDate(show.nextepisode?.date) }} &nbsp;
        <b>{{ show.nextepisode?.number }}</b>
        <small v-if="show.nextepisode?.date === 'tba'">({{ show.status }})</small>
      </p>
    </div>
    <div class="col-xs-2 text-right">
      <i @click="useShowsStore().remove(show)" title="remove show" class="fa fa-times-circle"></i><i v-if="show.loading" class="fa fa-circle-o-notch fa-spin"></i>
    </div>
  </div>
</template>
<script setup>
import { formatDate } from './formatDate.js';
import { useShowsStore } from '../stores/shows';

defineProps({
  show: {
    type: Object,
    required: true,
  },
})
</script>