<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useShowsStore } from '../stores/shows';

const route = useRoute();
const router = useRouter();
const showsStore = useShowsStore();

onMounted(async () => {
  const query = route.query.q;
  if (!query || typeof query !== 'string') {
    router.push('/');
    return;
  }

  const show = await showsStore.singlesearch(query);
  router.push(showsStore.modalLink(show));
});
</script>

<template>
  <div>Searching...</div>
</template>