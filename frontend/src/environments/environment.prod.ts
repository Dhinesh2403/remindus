// src/environments/environment.prod.ts  ← PRODUCTION
export const environment = {
  name: 'production',
  production: true,
  staging: false,
  apiUrl: 'https://remindus.onrender.com/api',
  socketUrl: 'https://remindus.onrender.com',
  googleClientId: '812312433271-es68ea2h2jmtol3u5hajn3abmm07fv89.apps.googleusercontent.com',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.remindus.app',
  features: {
    whatsappIntegration: true,
    aiScheduling: true,
    smsReminders: true,
  },
  appVersion: '1.0.0',
  appBuild: 1,
  enableLogging: false,
  logLevel: 'error',
};
