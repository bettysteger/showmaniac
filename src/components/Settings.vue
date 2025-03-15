<script setup>
import { ref } from 'vue'

const pushSupported = 'Notification' in window;
const periodicSyncSupported = ref(false); //'navigator.serviceWorker' in window && 'periodicSync' in navigator.serviceWorker;

navigator.permissions.query({ name: 'periodic-background-sync' }).then((status) => {
  periodicSyncSupported.value = status.state === 'granted';
  console.log('periodicSyncSupported', periodicSyncSupported.value, status);
}).catch(() => {});

const notificationsEnabled = ref(localStorage.getItem('notificationsEnabled') || false)

async function toggleNotifications() {
  const registration = await navigator.serviceWorker.ready;

  if (notificationsEnabled.value) {
    registration.periodicSync.register('check-reminders', {
      minInterval: 24 * 60 * 60 * 1000, // Check once per day
    });
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        localStorage.setItem('notificationsEnabled', true)
        // new Notification('Notifications enabled!')
      }
    })
  } else {
    localStorage.removeItem('notificationsEnabled')
    registration.periodicSync.unregister('check-reminders');
  }
}
</script>

<template>
  <div v-if="pushSupported && periodicSyncSupported">
    <!-- <h2>Settings</h2> -->
    <p>&nbsp;</p>
    <div class="checkbox">
      <label for="notifications">
        <input type="checkbox" id="notifications" v-model="notificationsEnabled" @change="toggleNotifications">
        Get notified when a new episode is out
      </label>
    </div>
  </div>
</template>
