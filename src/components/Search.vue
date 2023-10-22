<script setup>
import { ref } from 'vue'
import { useShowsStore } from '@/stores/shows';
import { usePopularStore } from '@/stores/popular'
import { storeToRefs } from 'pinia';

const newShow = ref('')
const focused = ref(false)
const loading = ref(false)
const showsStore = useShowsStore()
const popularStore = usePopularStore()
const { popularShows } = storeToRefs(popularStore)

const results = ref([])

let timeout;
function search() {
  if(!newShow.value) return

  loading.value = true
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    fetch(`https://api.tvmaze.com/search/shows?q=${newShow.value}`)
      .then((res) => res.json())
      .then((res) => {
        loading.value = false
        results.value = res.map((r) => r.show)
      })
  }, 400)
}

function loadPopular() {
  focused.value = true
  popularStore.query()
}

function onBlur() {
  setTimeout(() => {
    focused.value = false
  }, 500);
}
</script>
<template>
  <div class="form-group has-feedback search">
    <i class="fa fa-search"></i>
    <input type="search" v-model="newShow" placeholder="add TV show" class="form-control"
            @input="search" @focus="loadPopular" @blur="onBlur" />
    <span v-if="loading" class="form-control-feedback">
      <i class="fa fa-circle-o-notch fa-spin"></i>
    </span>
  </div>
  <div class="dropdown">
    <ul class="dropdown-menu" :class="{show: focused && (results.length || popularShows.length)}">
      <li v-for="result in (results.length ? results : popularShows)" :key="result.id">
        <a class="dropdown-item" @click.prevent="showsStore.add(result)" href
           :class="{popular: result.browsePopular}">
          <img :src="result.image?.medium || 'https://dummyimage.com/43x60/ffffff/ffffff.png'">
          {{ result.name }}<br>
          <small class="text-muted">
            {{ (result.network || result.webChannel).name }}
            <span v-if="(result.network || result.webChannel).country">
              ({{ (result.network || result.webChannel).country.code }})
            </span>
          </small>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dropdown-menu {
  border-radius: 2px;
  box-shadow: none;
  padding: 0;
  margin-top: 0px;
  margin-left: 12px;
  border-top: none;
}
.dropdown-menu > li > a {
  padding: 4px 12px;
  font-size: 16px;
  height: 68px;
  overflow: hidden;
}
.dropdown-menu > li > a strong {
  border-bottom: 1px solid var(--green);
}
.dropdown-menu > li > a img {
  height: 60px;
  margin-right: 10px;
  float: left;
}
.dropdown-menu > .active > a, .dropdown-menu > .active > a:hover, .dropdown-menu > .active > a:focus {
  background-color: var(--green);
}
.dropdown-menu > .active > a strong {
  border-color: #fff;
}
.dropdown-menu a.popular {
  background-color: #fff !important;
  color: var(--green);
  height: auto !important;
  text-align: center;
  padding: 12px;
}
.dropdown-menu a.popular img,
.dropdown-menu a.popular small {
  display: none;
}
.dropdown-menu a.popular span {
  margin-top: 0 !important;
}
.dropdown-menu a.popular:hover span, .dropdown-menu a.popular:focus span {
  text-decoration: underline;
}

.dropdown-menu {
  margin-left: 45px;
}
.dropdown-menu > li > a {
  font-size: 18px;
  height: 88px;
}
.dropdown-menu > li > a img {
  height: 80px;
}
.dropdown-menu > li > a span {
  margin-top: 8px;
  display: inline-block;
}
</style>
