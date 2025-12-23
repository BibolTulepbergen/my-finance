import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myfinance.app',
  appName: 'My Finance',
  webDir: 'dist/client',
  server: {
    // url: 'my-finance.moldahasank.workers.dev' , // prod
    url: 'my-finance-dev.moldahasank.workers.dev', // dev
    cleartext: false,
  },
  android: {
    allowMixedContent: true,
  }
};

export default config;
