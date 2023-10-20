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
        console.log(results.value)
      })
  }, 400)
}

function loadPopular() {
  focused.value = true
  popularStore.query()
}
</script>
<template>
  <div class="form-group has-feedback search">
    <i class="fa fa-search"></i>
    <input type="search" v-model="newShow" placeholder="add TV show" class="form-control"
            @input="search" @focus="loadPopular" @blur="focused = false" />
    <span v-if="loading" class="form-control-feedback">
      <i class="fa fa-circle-o-notch fa-spin"></i>
    </span>
  </div>
  <div class="dropdown">
    <ul class="dropdown-menu" :class="{show: results.length || (focused && popularShows.length)}">
      <li v-for="result in results" :key="result.id">
        <a class="dropdown-item" @click.prevent="showsStore.add(result)" href>{{ result.name }}</a>
      </li>
      <li v-for="show in popularShows" :key="show.ids.trakt">
        <a class="dropdown-item" @click.prevent="showsStore.add(result)" href>{{ show.title }}</a>
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

  >li>a {
    padding: 4px 12px;
    font-size: 16px;
    height: 68px;
    overflow: hidden;

    strong {
      border-bottom: 1px solid var(--green);
    }

    img {
      height: 60px;
      margin-right: 10px;
      float: left;
    }
  }

  >.active>a {

    &,
    &:hover,
    &:focus {
      background-color: var(--green);
    }

    strong {
      border-color: #fff;
    }
  }

  a.popular {
    background-color: #fff !important;
    color: var(--green);
    height: auto !important;
    text-align: center;
    padding: 12px;

    img,
    small {
      display: none;
    }

    span {
      margin-top: 0 !important;
    }

    &:hover span,
    &:focus span {
      text-decoration: underline;
    }
  }
}

.dropdown-menu {
  margin-left: 45px;

  >li>a {
    font-size: 18px;
    height: 88px;

    img {
      height: 80px;
    }

    span {
      margin-top: 8px;
      display: inline-block;
    }
  }
}
</style>
