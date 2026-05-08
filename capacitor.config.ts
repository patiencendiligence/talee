import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.talee.app',
  appName: 'Talee',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
