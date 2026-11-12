import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Dev uniquement : avec ?rafpoly=1, requestAnimationFrame continue dans un onglet masque
// (les animations Hanzi Writer, testees en navigateur cache, s'arreteraient sinon).
const rafPolyfillForHiddenTabs = (): Plugin => ({
  name: 'raf-polyfill-hidden-tabs',
  apply: 'serve',
  transformIndexHtml(html) {
    return {
      html,
      tags: [{
        tag: 'script',
        injectTo: 'head-prepend',
        children: "if (new URLSearchParams(location.search).has('rafpoly')) { window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); }; window.cancelAnimationFrame = clearTimeout; }",
      }],
    };
  },
});

// base './' : chemins relatifs valables sous Electron (app://), Capacitor (https://localhost) et en dev.
export default defineConfig({
  plugins: [react(), rafPolyfillForHiddenTabs()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    // Ne pas surveiller les sorties de build : des handles ouverts sur release/ bloquent electron-builder (EPERM).
    // (pas de motif 'data' : il masquerait aussi src/data/ et figerait les donnees generees)
    watch: { ignored: ['**/release/**', '**/android/**', '**/.cache/**', '**/dist/**'] },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
