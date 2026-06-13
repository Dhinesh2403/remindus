// src/environments/environment.staging.ts.example
// Copy this to environment.staging.ts and fill in your values
export const environment = {
  name: 'staging',
  production: false,
  staging: true,

  // Railway staging backend
  apiUrl: 'https://remindme-buddy-staging.up.railway.app/api',
  socketUrl: 'https://remindme-buddy-staging.up.railway.app',

  firebase: {
    apiKey: 'YOUR_FIREBASE_STAGING_KEY',
    authDomain: 'remindme-staging.firebaseapp.com',
    projectId: 'remindme-staging',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
    vapidKey: 'YOUR_STAGING_VAPID_KEY',
  },

  features: {
    whatsappIntegration: true,
    aiScheduling: true,
    smsReminders: true,
  },

  enableLogging: true,
  logLevel: 'warn',
};
