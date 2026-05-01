importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBMfx6CvJVENtDc1heba4WkV0Q-mCEiZKU",
  authDomain: "gen-lang-client-0045594701.firebaseapp.com",
  projectId: "gen-lang-client-0045594701",
  storageBucket: "gen-lang-client-0045594701.firebasestorage.app",
  messagingSenderId: "128731892129",
  appId: "1:128731892129:web:62f3829e1a158a7d88a3e0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
