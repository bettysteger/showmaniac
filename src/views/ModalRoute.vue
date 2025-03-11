<template>
  <div class="modal fade" :class="{'in show': open}" aria-modal="true" tabindex="-1" role="dialog" @click="closeOnBackdrop">
    <div class="modal-dialog" :class="{['modal-' + size]: size}">
      <div class="modal-content">
        <RouterView @closeModal="onHide" />
      </div>
    </div>
  </div>
  <div v-if="open" class="modal-backdrop fade in"></div>
</template>
<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

defineProps({ size: String });

const route = useRoute();
const router = useRouter();
const open = ref(false);

function onHide() {
  // goes to the parent route
  let prev = { path: route.matched[route.matched.length - 3].path, query: route.query };
  router.push(prev);
}

function closeOnBackdrop(e) {
  if (e.target.classList.contains('modal')) {
    onHide();
  }
}

onMounted(() => {
  open.value = true;
  document.body.classList.add('modal-open');
})
onUnmounted(() => {
  open.value = false;
  document.body.classList.remove('modal-open');
})
</script>
<style>
.modal, .modal-dialog {
  z-index: 1050;
}
</style>
