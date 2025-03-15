self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkReminders());
  }
});

self.addEventListener('message', (event) => {
  if (event.data.action === 'reminderDate') {
    const reminderDate = new Date(event.data.date);
    const today = new Date();

    console.log('Checking reminders...', reminderDate, today, reminderDate < today);

    if (reminderDate < today) {
      self.registration.showNotification('Reminder', {
        body: `New episode is out of ${event.data.show}!`,
        icon: '/android-chrome-192x192.png',
      });
    }
  }
});

async function checkReminders() {

  // Fetch saved date from localStorage
  await self.registration.getNotifications().then(() => {
    return new Promise((resolve) => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ action: 'getReminderDate' });
        });
      });

      // Wait a moment to let the client respond
      setTimeout(resolve, 500);
    });
  });
}
