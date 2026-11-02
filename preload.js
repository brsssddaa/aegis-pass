const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aegis', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  copySecure: (data) => ipcRenderer.send('clipboard-copy-secure', data),
  
  readVault: () => ipcRenderer.invoke('vault-read-encrypted'),
  saveVault: (data) => ipcRenderer.invoke('vault-write-encrypted', data),
  
  readSettings: () => ipcRenderer.invoke('settings-read'),
  saveSettings: (settings) => ipcRenderer.invoke('settings-write', settings),
  
  onMaximizedState: (callback) => {
    ipcRenderer.on('window-maximized-state', (event, state) => callback(state));
  },
  onClipboardCleared: (callback) => {
    ipcRenderer.on('clipboard-cleared', () => callback());
  }
});
