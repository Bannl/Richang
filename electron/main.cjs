// Processus principal Electron (Windows). Sert le build Vite via le protocole privilegie app://
// et expose un stockage fichier JSON pour la progression.
const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const DIST = path.join(__dirname, '..', 'dist');
const stateFile = () => path.join(app.getPath('userData'), 'progress.json');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname);
    if (rel === '' || rel === '/') rel = '/index.html';
    let file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
    try {
      const st = await fs.stat(file);
      if (st.isDirectory()) file = path.join(DIST, 'index.html');
    } catch {
      file = path.join(DIST, 'index.html');
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

async function readState() {
  const file = stateFile();
  try {
    return await fs.readFile(file, 'utf8');
  } catch (e) {
    if (!e || e.code !== 'ENOENT') throw e;
  }
  // Recuperation : un .tmp orphelin (ecriture interrompue) vaut mieux que rien.
  try {
    const json = await fs.readFile(file + '.tmp', 'utf8');
    JSON.parse(json);
    return json;
  } catch {
    return null;
  }
}

// Ecriture sure : fichier temporaire puis renommage ; si le renommage echoue (EXDEV sur certains
// dossiers AppData rediriges), on copie puis on supprime le temporaire.
async function writeState(json) {
  const file = stateFile();
  const tmp = file + '.tmp';
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(tmp, json, 'utf8');
  try {
    await fs.rename(tmp, file);
  } catch {
    await fs.copyFile(tmp, file);
    await fs.unlink(tmp).catch(() => {});
  }
  const check = await fs.readFile(file, 'utf8');
  if (check !== json) throw new Error('Relecture differente apres ecriture');
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    title: 'Richang',
    autoHideMenuBar: true,
    backgroundColor: '#f7f6f2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.argv.includes('--smoke')) {
    win.webContents.on('did-finish-load', async () => {
      const info = await win.webContents.executeJavaScript('({ title: document.title, root: document.getElementById("root").children.length })');
      // Persistance : ecriture puis relecture d'un fichier temoin dans userData.
      let persist = false;
      try {
        const probe = path.join(app.getPath('userData'), 'smoke-probe.json');
        const tmp = probe + '.tmp';
        await fs.writeFile(tmp, '{"ok":1}', 'utf8');
        try { await fs.rename(tmp, probe); } catch { await fs.copyFile(tmp, probe); await fs.unlink(tmp).catch(() => {}); }
        persist = (await fs.readFile(probe, 'utf8')) === '{"ok":1}';
        await fs.unlink(probe).catch(() => {});
      } catch (e) { console.log('SMOKE persist error ' + e.message); }
      console.log('SMOKE ' + JSON.stringify({ ...info, persist }));
      app.exit(info.root > 0 && persist ? 0 : 2);
    });
    win.webContents.on('did-fail-load', (_e, code, desc) => { console.log('SMOKE FAIL ' + code + ' ' + desc); app.exit(3); });
  }
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadURL('app://richang/index.html');
  return win;
}

app.whenReady().then(() => {
  registerAppProtocol();
  ipcMain.handle('state:read', () => readState());
  ipcMain.handle('state:write', (_e, json) => writeState(String(json)));
  ipcMain.handle('state:export', async (_e, json) => {
    const r = await dialog.showSaveDialog({
      defaultPath: 'richang-progression.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return false;
    await fs.writeFile(r.filePath, String(json), 'utf8');
    return true;
  });
  ipcMain.handle('state:import', async () => {
    const r = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return fs.readFile(r.filePaths[0], 'utf8');
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
