<template>
  <div class="tvshow row">
    <div class="col-xs-10">
      <h4>{{ show.name }} &nbsp;<router-link :to="showsStore.modalLink(show)"><i class="fa fa-info-circle"></i></router-link></h4>
      <p>
        {{ formatDate(show.nextepisode?.date) }} &nbsp;
        <b>{{ show.nextepisode?.number }}</b>
        <small v-if="show.nextepisode?.date === 'tba'">({{ show.status }})</small>
      </p>
    </div>
    <div class="col-xs-2 text-right">
      <i @click="showsStore.remove(show)" title="remove show" class="fa fa-times-circle"></i><i v-if="show.loading" class="fa fa-circle-o-notch fa-spin"></i>
    </div>
  </div>
</template>
<script setup>
import { formatDate } from './formatDate.js';
import { useShowsStore } from '../stores/shows';

const showsStore = useShowsStore()

defineProps({
  show: {
    type: Object,
    required: true,
  },
})
</script>