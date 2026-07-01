// src/environments/environment.prod.ts  ← PRODUCTION
export const environment = {
  name: 'production',
  production: true,
  staging: false,

  // Railway production backend
  apiUrl: 'https://remindus-api.onrender.com/api',
  socketUrl: 'https://remindus-api.onrender.com',

  firebase: {
    apiKey: 'YOUR_FIREBASE_PROD_KEY',
    authDomain: 'remindme-buddy.firebaseapp.com',
    projectId: 'remindme-buddy',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
    vapidKey: 'YOUR_VAPID_KEY',
  },

  // Google Sign-In — OAuth Web client ID (same value the backend verifies against).
  googleClientId: '',

  // Play Store listing — used when sharing a friend code. TODO: replace with the
  // real listing URL once the app is published.
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.remindus.app',

  features: {
    whatsappIntegration: true,
    aiScheduling: true,
    smsReminders: true,
  },

  // App version — web fallback only (native uses @capacitor/app). Keep in sync
  // with android/app/build.gradle (versionName / versionCode) on every release.
  appVersion: '1.0.0',
  appBuild: 1,

  enableLogging: false,
  logLevel: 'error',
};
