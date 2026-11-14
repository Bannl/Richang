import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.richang.mobile',
  appName: '日常',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  ios: {
    // Le jeu passe sous l'encoche et l'indicateur d'accueil : les marges de securite sont gerees en CSS
    // (env(safe-area-inset-*), viewport-fit=cover dans index.html).
    contentInset: 'never',
    // iPad : page « mobile » plutot que le mode bureau de Safari, meme mise en page que sur Android.
    preferredContentMode: 'mobile',
    // Fond pendant le chargement (theme sombre de l'app).
    backgroundColor: '#14162a',
  },
};

export default config;
