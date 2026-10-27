// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js');

// Initialize Firebase in the service worker
// Note: This should match your firebaseConfig from your app
const firebaseConfig = {
  apiKey: "AIzaSyDmUJHxOffiaPyHDMlmH9uh5Vum-ITcbok",
  authDomain: "avira-inventory.firebaseapp.com",
  projectId: "avira-inventory",
  storageBucket: "avira-inventory.firebasestorage.app",
  messagingSenderId: "76104222398",
  appId: "1:76104222398:web:c306afcc988604cc86c0ef"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/firebase-logo.png',
    badge: '/firebase-badge.png',
    click_action: payload.data?.click_action || '/',
    tag: payload.data?.issue_id || 'default',
    requireInteraction: false,
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw] Notification click event:', event);
  event.notification.close();

  // Extract the click action from the notification data
  const clickAction = event.notification.data.click_action;
  const issueId = event.notification.data.issue_id;

  // Construct the target URL
  let targetUrl = '/';
  if (issueId && clickAction === 'open_issue') {
    targetUrl = `/issues/${issueId}`;
  } else if (clickAction) {
    targetUrl = clickAction;
  }

  // Open the target URL in a new window or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window/tab with the target origin
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(targetUrl) || client.url.includes('/')) {
          return client.focus().then(() => {
            // Send a message to the client to navigate to the issue
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              issue_id: issueId,
              click_action: clickAction
            });
          });
        }
      }
      // If no matching window, open a new one
      return clients.openWindow(targetUrl);
    })
  );
});
