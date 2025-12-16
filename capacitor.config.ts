import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myfinance.app',
  appName: 'My Finance',
  webDir: 'dist/client',
  server: {
    url: 'http://192.168.1.100:5173',
    cleartext: false,
  },
  android: {
    allowMixedContent: true,
  }
};

export default config;
