<script setup>
import { ref } from 'vue'
import { useShowsStore } from '@/stores/shows';
import { usePopularStore } from '@/stores/popular'
import { storeToRefs } from 'pinia';

defineProps(['size'])

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
  if (popularShows.value.length === 0) {
    popularStore.fetchPopularShows()
  }
}

function onBlur() {
  setTimeout(() => {
    focused.value = false
  }, 500);
}
</script>
<template>
  <div class="form-group has-feedback search">
    <i class="fa fa-search" :class="{'fa-2x': size === 'lg'}"></i>
    <input type="search" v-model="newShow" placeholder="add TV show" class="form-control"
            :class="{'input-lg': size === 'lg'}"
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
      <!-- <li>
        <a class="dropdown-item popular" @click.prevent="popularStore.showPopular = true" href>Browse Popular</a>
      </li> -->
    </ul>
  </div>
</template>

<style lang="scss" scoped>
.dropdown-menu {
  border-radius: 2px;
  box-shadow: none;
  padding: 0;
  margin-top: 0;
  margin-left: 45px;
  border-top: none;
  width: 100%;
  max-width: calc(100vw - 60px);

  > li > a {
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

    span {
      margin-top: 8px;
      display: inline-block;
    }
  }

  > .active > a {
    &, &:hover, &:focus {
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

    img, small {
      display: none;
    }

    span {
      margin-top: 0 !important;
    }

    &:hover span, &:focus span {
      text-decoration: underline;
    }
  }
}
</style>
