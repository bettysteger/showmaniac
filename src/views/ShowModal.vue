<template>
  <div class="modal fade" :class="{'in show': show.id}">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <router-link class="close" to="/">&times;</router-link>
          <h1 class="modal-title">
            {{ show.name }} &nbsp;
          </h1>
          <small v-if="notInList" class="pull-right"><router-link @click="showsStore.add(show)" to="/">Track this show</router-link></small>
          <small>
            {{ show.schedule?.time }} {{ show.network?.name }} {{ show.webChannel?.name }}

            <span v-if="show.runtime">
              &nbsp;&nbsp;
              <i class="fa fa-clock-o" :class="{'half-clock':show.runtime<36, 'three-quarter-clock':show.runtime>35&&show.runtime<60}"></i>
              <i v-if="show.runtime > 60" class="fa fa-clock-o" :class="{'half-clock':show.runtime<100, 'three-quarter-clock':show.runtime>99&&show.runtime<111}"></i>
              {{ show.runtime }}min
            </span>
          </small>
        </div>
        <div class="modal-body">

          <img v-if="show.image?.medium" class="pull-right" :src="show.image.medium">

          <div v-html="show.summary"></div>

          <h3>Last aired</h3>
          <p>
            {{ formatDate(show.latestepisode?.date) }} &nbsp;
            <b>
              <a v-if="show.name" v-tooltip="'search this episode'" :href="`https://google.com/search?q=${parseName(show)} ${show.latestepisode?.number}`" target="_blank">{{ show.latestepisode?.number }}</a>
            </b>
            <!-- <a v-if="isDate(show.latestepisode?.date)" v-tooltip="'watch online'" :href="watchseries(show)" target="_blank"><i class="fa fa-fw fa-play-circle-o"></i></a> -->
          </p>

          <h3>Next airdate</h3>
          <p>
            {{ formatDate(show.nextepisode?.date) }} &nbsp;
            <b>{{ show.nextepisode?.number }}</b>
            <small v-if="show.nextepisode?.date === 'tba'">({{ show.status }})</small>
          </p>

          <div class="clearfix"></div>
        </div>
        <div v-if="notInList" class="modal-footer">
          <router-link @click="showsStore.add(show)" class="btn btn-lg btn-success" to="/">Track this show</router-link>
        </div>
      </div>
    </div>
  </div>
  <div v-if="show.id" class="modal-backdrop fade in"></div>
</template>
<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { formatDate, isDate } from '../components/formatDate.js';
import { useShowsStore } from '../stores/shows';

const showsStore = useShowsStore()
const route = useRoute()

const show = ref({})
const notInList = ref(false)

function parseName(show) {
  return show.name.replace(/[^ a-zA-Z0-9]/g, '');
}

function init() {
  let id = route.params.id
  if(!id) return closeModal()

  id = parseInt(id)
  show.value = showsStore.shows.find(show => show.id === id) || { id }
  notInList.value = !show.value.name;
  showsStore.update(show.value)
  openModal()
}
init();

watch(() => route.params.id, init)

function openModal() {
  document.body.classList.add('modal-open')
}
function closeModal() {
  document.body.classList.remove('modal-open')
  show.value = {}
}
</script>