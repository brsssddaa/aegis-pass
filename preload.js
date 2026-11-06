const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aegis', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  copyText: (text) => ipcRenderer.send('clipboard-copy', text),

  readVault: () => ipcRenderer.invoke('vault-read-encrypted'),
  saveVault: (data) => ipcRenderer.invoke('vault-write-encrypted', data),

  readSettings: () => ipcRenderer.invoke('settings-read'),
  saveSettings: (settings) => ipcRenderer.invoke('settings-write', settings),

  openWallpapersFolder: () => ipcRenderer.invoke('wallpapers-open-folder'),
  listWallpapers: () => ipcRenderer.invoke('wallpapers-list'),
  selectAndAddWallpaper: () => ipcRenderer.invoke('wallpapers-select-file'),
  deleteWallpaper: (fileName) => ipcRenderer.invoke('wallpapers-delete-file', fileName),

  selectGameExe: () => ipcRenderer.invoke('games-select-exe'),
  getStorageInfo: () => ipcRenderer.invoke('storage-info'),
  openExternal: (url) => ipcRenderer.send('open-external-url', url),

  onMaximizedState: (callback) => {
    ipcRenderer.on('window-maximized-state', (event, state) => callback(state));
  }
});
