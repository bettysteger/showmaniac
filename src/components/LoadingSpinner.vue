<script setup>
import { useLoading } from '../composables/useLoading'

const { isLoading } = useLoading()
</script>

<template>
  <div class="loading-corner" :class="{ loading: isLoading }"></div>
</template>

<style>
.loading-corner {
  --spinner-size-large: 80px;
  --spinner-size-small: 40px;
  --spinner-border-width: 5px;
  --spinner-color: var(--green);
  --spinner-border-color: #fff;
  --spinner-border-color-transparent: rgba(255, 255, 255, 0.7);
}
</style>

<style lang="scss" scoped>
/*
  Effect 10: Corner indicator (CSS Class: .la-anim-10)
  from http://tympanus.net/Development/CreativeLoadingEffects/
  Loading circle idea from http://codepen.io/Metty/details/lgJck
*/
.loading-corner {
  position: fixed;
  top: 0;
  right: 0;
  width: 300px;
  height: 300px;
  background: var(--spinner-color);
  transition: transform 0.3s;
  transform: translateX(100%) translateY(-100%) rotate(45deg);
  pointer-events: none;
  z-index: 100001;

  &.loading {
    transform: translateX(50%) translateY(-50%) rotate(45deg);
  }

  &::before,
  &::after {
    position: absolute;
    bottom: 20px;
    left: 50%;
    display: block;
    border: var(--spinner-border-width) solid var(--spinner-border-color);
    border-radius: 50%;
    content: '';
  }

  &::before {
    margin-left: -45px;
    width: var(--spinner-size-large);
    height: var(--spinner-size-large);
    border-right-color: var(--spinner-border-color-transparent);
    border-left-color: var(--spinner-border-color-transparent);
    animation: rotation 3s linear infinite;
  }

  &::after {
    bottom: 40px;
    margin-left: -25px;
    width: var(--spinner-size-small);
    height: var(--spinner-size-small);
    border-top-color: var(--spinner-border-color-transparent);
    border-bottom-color: var(--spinner-border-color-transparent);
    animation: rotation 1s linear infinite;
  }
}

@keyframes rotation {
  0% { transform: rotate(0deg); }
  50% { transform: rotate(180deg); }
  100% { transform: rotate(360deg); }
}
</style>