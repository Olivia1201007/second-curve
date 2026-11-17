import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.secondcurve.app',
  appName: '第二曲线AI',
  webDir: 'out',
  backgroundColor: '#fbfaf8',
  loggingBehavior: 'none',
  android: { backgroundColor: '#fbfaf8', webContentsDebuggingEnabled: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#fbfaf8', showSpinner: false },
  },
};

export default config;
