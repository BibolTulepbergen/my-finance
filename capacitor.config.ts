import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myfinance.app',
  appName: 'My Finance',
  webDir: 'dist/client',
  server: {
    // // url: 'https://my-finance.moldahasank.workers.dev' , // prod
    // url: 'https://my-finance-dev.moldahasank.workers.dev', // dev
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  }
};

export default config;
