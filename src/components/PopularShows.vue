<script setup>
import { onMounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePopularStore } from '@/stores/popular'
import { useShowsStore } from '@/stores/shows'

const popularShowsStore = usePopularStore()
const showsStore = useShowsStore()
const { popularShows } = storeToRefs(popularShowsStore)
const { fetchPopularShows } = popularShowsStore
const page = ref(1)
const scrollContainer = ref(null)
const isLoading = ref(false)

// Compute if we can scroll more
const canScrollMore = computed(() => {
  if (!scrollContainer.value) return true
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value
  return scrollWidth - (scrollLeft + clientWidth) > 20
})

const handleScroll = async (e) => {
  const container = e.target
  const scrollPosition = container.scrollLeft + container.clientWidth
  const maxScroll = container.scrollWidth

  // If we're near the end (within 100px) and not currently loading
  if (maxScroll - scrollPosition < 100 && !isLoading.value) {
    isLoading.value = true
    page.value++
    await fetchPopularShows(page.value)
    isLoading.value = false
  }
}

onMounted(() => {
  if (popularShows.value.length === 0) {
    fetchPopularShows(1)
  }
})
</script>

<template>
  <div class="container-wrapper">
    <div
      ref="scrollContainer"
      class="scroll-container"
      @scroll="handleScroll"
    >
      <div class="shows-grid">
        <div v-for="rowIndex in 3" :key="rowIndex" class="show-row">
          <div v-for="show in popularShows.filter((_, i) => i % 3 === rowIndex - 1)"
               :key="show.id"
               class="show-card">
            <router-link :to="showsStore.modalLink(show)">
              <img :src="show.image.medium" :alt="show.name" loading="lazy">
              <div class="show-info">
                <h3>{{ show.name }}</h3>
              </div>
            </router-link>
          </div>
        </div>
      </div>
      <div v-if="isLoading" class="loading-indicator">
        Loading...
      </div>
    </div>

    <!-- Scroll Indicator -->
    <div
      v-if="canScrollMore"
      class="scroll-indicator"
      :class="{ 'loading': isLoading }"
    >
      <div class="scroll-indicator-content">
        <span class="arrow">›</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container {
  width: 100%;
}

.container-wrapper {
  position: relative;
  width: 100%;
}

.scroll-container {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  padding-right: 60px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.shows-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 150%;
}

.show-row {
  display: flex;
  gap: 0;
}

.show-card {
  flex: 0 0 25%;
  position: relative;
  transition: transform 0.3s ease;

  a {
    display: block;
    width: 100%;
    height: 100%;
    text-decoration: none;
  }

  &:hover {
    transform: scale(1.05);
    z-index: 1;

    .show-info {
      background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.9),
        rgba(0, 0, 0, 0.7) 60%,
        rgba(0, 0, 0, 0.3)
      );
    }

    img {
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }
  }

  img {
    width: 100%;
    aspect-ratio: 2/3;
    display: block;
    object-fit: cover;
    transition: box-shadow 0.3s ease;
  }

  .show-info {
    padding: 0.8rem;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.8),
      rgba(0, 0, 0, 0.6) 60%,
      transparent
    );
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    transition: background 0.3s ease;

    h3 {
      color: white;
      margin: 0;
      font-size: 1rem;
      font-weight: 500;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.loading-indicator {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.scroll-indicator {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 60px;
  pointer-events: none;
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 2s infinite;

  &.loading {
    animation: none;
    opacity: 0.3;
  }

  &-content {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .arrow {
    font-size: 24px;
    line-height: 1;
  }
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}
</style>
