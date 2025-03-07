<script setup>
import { onMounted, ref } from 'vue'
const adBlocker = ref(false)

onMounted(() => {
  // Load AdSense script
  const script = document.createElement('script')
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9582229220927084'
  script.async = true
  script.crossorigin = 'anonymous'
  document.head.appendChild(script)

  // Initialize ad
  script.onload = () => {
    setTimeout(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
      adBlocker.value = !document.querySelector('.adsbygoogle').children.length
      } catch (e) {
        console.error('AdSense error:', e)
      }
    })
  }
})
</script>

<template>
  <div class="tvshow row banner">
    <div class="col-xs-12">
      <p><small>You found the only ad, so if you enjoy showmaniac, then please click:</small></p>
      <ins class="adsbygoogle"
          style="display:block"
          data-ad-client="ca-pub-9582229220927084"
          data-ad-slot="3557772459"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
      <div v-if="adBlocker"><h4>Whitelist <i>showmaniac.org</i></h4><p>in your AdBlocker Settings!</p></div>
    </div>
  </div>
</template>