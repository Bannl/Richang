import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.richang.mobile',
  appName: '日常',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
