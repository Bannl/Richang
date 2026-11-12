// Lance Vite (HMR) puis Electron pointant sur le serveur de dev.
import { spawn } from 'node:child_process';
import http from 'node:http';

const URL_DEV = 'http://localhost:5173';
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

const vite = spawn(npx, ['vite'], { stdio: 'inherit', shell: isWin });

function waitFor(url, tries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http.get(url, (res) => { res.resume(); resolve(); })
        .on('error', () => (n > 0 ? setTimeout(() => attempt(n - 1), 500) : reject(new Error('Vite ne repond pas'))));
    };
    attempt(tries);
  });
}

try {
  await waitFor(URL_DEV);
  const electron = spawn(npx, ['electron', '.'], {
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, VITE_DEV_SERVER_URL: URL_DEV },
  });
  electron.on('exit', () => { vite.kill(); process.exit(0); });
} catch (e) {
  console.error(e);
  vite.kill();
  process.exit(1);
}
