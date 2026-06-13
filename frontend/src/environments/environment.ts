// src/environments/environment.ts  ← DEVELOPMENT
export const environment = {
  name: 'development',
  production: false,
  staging: false,

  // Local backend
  apiUrl: 'http://localhost:5000/api',
  socketUrl: 'http://localhost:5000',

  // Firebase (optional, for push notifications)
  firebase: {
    apiKey: 'YOUR_FIREBASE_DEV_KEY',
    authDomain: 'remindme-dev.firebaseapp.com',
    projectId: 'remindme-dev',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
    vapidKey: 'YOUR_VAPID_KEY',
  },

  // Feature flags
  features: {
    whatsappIntegration: true,   // Enabled locally for testing
    aiScheduling: true,
    smsReminders: true,
  },

  // Logging
  enableLogging: true,
  logLevel: 'debug',
};
