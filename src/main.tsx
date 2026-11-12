import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/nunito';
import './styles.css';
import './components.css';
import './game.css';
import './boards.css';
import './phone.css';
import './tutorial.css';

const root = createRoot(document.getElementById('root')!);
// Developpement seulement : galerie des portraits (?gallery), absente des versions installables.
if (import.meta.env.DEV && location.search.includes('gallery')) {
  import('./dev/Gallery').then(({ Gallery }) => root.render(<Gallery />));
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
