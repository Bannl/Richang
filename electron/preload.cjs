const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('richangNative', {
  platform: 'electron',
  readState: () => ipcRenderer.invoke('state:read'),
  writeState: (json) => ipcRenderer.invoke('state:write', json),
  exportState: (json) => ipcRenderer.invoke('state:export', json),
  importState: () => ipcRenderer.invoke('state:import'),
});
