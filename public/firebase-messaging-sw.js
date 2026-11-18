// Service worker FCM — reçoit les notifications push pendant que l'app est fermée ou en arrière-plan.
// La config Firebase ci-dessous est publique (les mêmes valeurs sont déjà dans le bundle de l'app) :
// ce ne sont pas des secrets, juste l'identifiant du projet Firebase.
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDbX_UlSgWUPP79EDktiYqo9_uGUaNpWYM',
  authDomain: 'planning-famille-b4ea7.firebaseapp.com',
  projectId: 'planning-famille-b4ea7',
  storageBucket: 'planning-famille-b4ea7.firebasestorage.app',
  messagingSenderId: '414087216194',
  appId: '1:414087216194:web:dcc139379c6cb66ffe81db',
})

const messaging = firebase.messaging()

// Notification affichée quand l'app n'est pas au premier plan (cas normal pour un rappel de rendez-vous)
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Planning famille'
  const body = (payload.notification && payload.notification.body) || ''
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })
})
