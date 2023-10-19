<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <nav class="navbar navbar-inverse navbar-fixed-top">
    <div class="container">
      <!-- Brand and toggle get grouped for better mobile display -->
      <div class="navbar-header">
        <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar-collapse" aria-expanded="false">
          <span class="sr-only">Toggle navigation</span>
          <span class="icon-bar"></span>
          <span class="icon-bar"></span>
          <span class="icon-bar"></span>
        </button>
        <a class="navbar-brand" href="/"><img src="/images/logo.png" alt="showmaniac"></a>
      </div>
    </div>
  </nav>

  <RouterView />
</template>

<style scoped>

</style>
