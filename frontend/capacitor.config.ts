// frontend/capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.remindus.app',
  appName: 'RemindUs',
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
      backgroundColor:       '#3D5AF1',
      androidSplashResourceName: 'splash',
      showSpinner:           false,
    },
    StatusBar: {
      style:            'LIGHT',   // light icons on blue — overridden dynamically per theme
      backgroundColor:  '#3D5AF1',
      overlaysWebView:  false,     // push content below the status bar
    },
    Keyboard: {
      resize:          'body',
      style:           'dark',
      resizeOnFullScreen: true,
    },
    // Google Sign-In. Fill in your OAuth Web client ID before native builds.
    // serverClientId must be the *Web* client ID so the ID token verifies on the server.
    GoogleAuth: {
      scopes:           ['profile', 'email'],
      serverClientId:   '812312433271-es68ea2h2jmtol3u5hajn3abmm07fv89.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
