<script setup>
import { onMounted, ref, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePopularStore } from '../stores/popular';
import { useShowsStore } from '../stores/shows';

const route = useRoute();
const popularStore = usePopularStore();
const showsStore = useShowsStore();
const page = ref(parseInt(route.params.page) || 1);

// Intersection Observer for infinite scroll
const observer = ref(null);
const loadingTrigger = ref(null);

function handleIntersect(entries) {
  const entry = entries[0];
  if (entry.isIntersecting && !popularStore.isLoading) {
    loadMoreShows();
  }
}

async function loadMoreShows() {
  page.value++;
  await popularStore.fetchPopularShows(page.value);
}

onMounted(async () => {
  // Initial load
  await popularStore.fetchPopularShows(page.value);

  // Setup intersection observer
  observer.value = new IntersectionObserver(handleIntersect, {
    root: null,
    threshold: 0.1,
  });

  if (loadingTrigger.value) {
    observer.value.observe(loadingTrigger.value);
  }
});

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
});
</script>

<template>
  <div class="popular-shows">
    <h2>Popular Shows</h2>
    <div class="shows-grid">
      <div v-for="show in popularStore.popularShows"
           :key="show.id"
           class="show-card"
           @click="$router.push(showsStore.modalLink(show))">
        <img :src="show.image?.medium" :alt="show.name" loading="lazy">
        <div class="show-info">
          <h3>{{ show.name }}</h3>
          <div class="rating" v-if="show.rating?.average">
            ★ {{ show.rating.average }}
          </div>
        </div>
      </div>
    </div>
    <!-- Loading trigger element -->
    <div ref="loadingTrigger" class="loading-trigger">
      <div v-if="popularStore.isLoading" class="loading">
        Loading...
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popular-shows {
  padding: 20px;

  .shows-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .show-card {
    cursor: pointer;
    transition: transform 0.2s;
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    img {
      width: 100%;
      height: 250px;
      object-fit: cover;
      display: block;
    }

    .show-info {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 10px;
      background: linear-gradient(transparent, rgba(0,0,0,0.8));
      color: white;

      h3 {
        margin: 0;
        font-size: 1rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .rating {
        font-size: 0.9rem;
        color: #ffd700;
      }
    }
  }

  .loading {
    text-align: center;
    margin-top: 20px;
    font-size: 1.2rem;
  }

  .loading-trigger {
    height: 20px;
    margin: 20px 0;
  }

  @media (max-width: 768px) {
    .shows-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }

    .show-card img {
      height: 200px;
    }
  }
}
</style>