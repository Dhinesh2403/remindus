// frontend/capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.remindmebuddy.app',
  appName: 'RemindMe',
  webDir:  'www',

  server: {
    // Remove this block for production builds — only used during live reload
    androidScheme: 'https',
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration:    2000,
      backgroundColor:       '#7C3AED',
      androidSplashResourceName: 'splash',
      showSpinner:           false,
    },
    StatusBar: {
      style:            'LIGHT',   // light icons on purple — overridden dynamically per theme
      backgroundColor:  '#7C3AED',
      overlaysWebView:  false,     // push content below the status bar
    },
    Keyboard: {
      resize:          'body',
      style:           'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
