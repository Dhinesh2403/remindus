// src/environments/environment.prod.ts.example
// Copy this to environment.prod.ts and fill in your values
export const environment = {
  name: 'production',
  production: true,
  staging: false,

  // Railway production backend
  apiUrl: 'https://remindus-buddy-api.up.railway.app/api',
  socketUrl: 'https://remindus-buddy-api.up.railway.app',

  firebase: {
    apiKey: 'YOUR_FIREBASE_PROD_KEY',
    authDomain: 'remindus-buddy.firebaseapp.com',
    projectId: 'remindus-buddy',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
    vapidKey: 'YOUR_PRODUCTION_VAPID_KEY',
  },

  // Google Sign-In — OAuth Web client ID (same value the backend verifies against).
  googleClientId: 'YOUR_GOOGLE_WEB_CLIENT_ID',

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
