const { app, BrowserWindow, ipcMain, clipboard, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let clipboardClearTimer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 700,
    minWidth: 880,
    minHeight: 580,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#07090d',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-state', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-state', false);
  });
}

// Window control IPC
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Secure clipboard copy with auto-clear timer
ipcMain.on('clipboard-copy-secure', (event, { text, clearSeconds }) => {
  clipboard.writeText(text);

  if (clipboardClearTimer) {
    clearTimeout(clipboardClearTimer);
  }

  const seconds = clearSeconds || 30;
  clipboardClearTimer = setTimeout(() => {
    if (clipboard.readText() === text) {
      clipboard.clear();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clipboard-cleared');
      }
    }
  }, seconds * 1000);
});

// Local Encrypted Vault Storage (AppData / userData)
const getVaultPath = () => path.join(app.getPath('userData'), 'aegis_vault.enc');
const getSettingsPath = () => path.join(app.getPath('userData'), 'aegis_settings.json');

ipcMain.handle('vault-read-encrypted', async () => {
  try {
    const p = getVaultPath();
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  } catch (err) {
    console.error('Failed to read vault file:', err);
  }
  return null;
});

ipcMain.handle('vault-write-encrypted', async (event, data) => {
  try {
    const p = getVaultPath();
    fs.writeFileSync(p, data, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings-read', async () => {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (e) {}
  return null;
});

ipcMain.handle('settings-write', async (event, settings) => {
  try {
    const p = getSettingsPath();
    fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
