// Empaquette l'app Windows avec electron-builder, caches places dans le projet (evite l'erreur EXDEV du cache %LOCALAPPDATA%).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cache = path.join(root, '.cache');
mkdirSync(path.join(cache, 'electron-builder'), { recursive: true });
mkdirSync(path.join(cache, 'electron'), { recursive: true });
const env = {
  ...process.env,
  ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE || path.join(cache, 'electron-builder'),
  ELECTRON_CACHE: process.env.ELECTRON_CACHE || path.join(cache, 'electron'),
};
const isWin = process.platform === 'win32';
const r = spawnSync(isWin ? 'npx.cmd' : 'npx', ['electron-builder', '--win', ...process.argv.slice(2)], { stdio: 'inherit', env, shell: isWin });
process.exit(r.status ?? 1);
