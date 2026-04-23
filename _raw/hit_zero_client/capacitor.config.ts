import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hitzero.client',
  appName: 'Hit Zero',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#0B0D12',
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
    scheme: 'hitzero'
  },
  android: {
    allowMixedContent: false
  },
  server: {
    // In dev, point at Vite for instant reload on device.
    // Leave undefined in production so the bundled dist/ is served.
    androidScheme: 'https',
    iosScheme: 'hitzero',
    // url: 'http://192.168.1.50:5173',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0B0D12',
      androidSplashResourceName: 'splash'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B0D12',
      overlaysWebView: false
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK'
    }
  }
};

export default config;
