const { app, BrowserWindow, ipcMain, clipboard, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0c1017',
    icon: path.join(__dirname, 'src', 'assets', 'icons', 'icon.png'),
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized-state', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized-state', false);
    }
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

// Simple clipboard copy (auto-clear disabled as requested)
ipcMain.on('clipboard-copy', (event, text) => {
  if (typeof text === 'string') {
    clipboard.writeText(text);
  }
});

// Local Vault Storage (AppData / userData)
const getVaultPath = () => path.join(app.getPath('userData'), 'aegis_vault.json');
const getSettingsPath = () => path.join(app.getPath('userData'), 'aegis_settings.json');
const getWallpapersDir = () => {
  const dir = path.join(app.getPath('userData'), 'wallpapers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Seed default wallpaper into user wallpapers folder if available
function initDefaultWallpapers() {
  try {
    const wDir = getWallpapersDir();
    const sourceAnime = path.join(__dirname, 'src', 'assets', 'wallpaper_anime.jpg');
    const targetAnime = path.join(wDir, 'anime_companion.jpg');
    if (fs.existsSync(sourceAnime) && !fs.existsSync(targetAnime)) {
      fs.copyFileSync(sourceAnime, targetAnime);
    }
  } catch (e) {
    console.error('Failed to init wallpapers:', e);
  }
}

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

// Wallpapers Management IPC
ipcMain.handle('wallpapers-open-folder', async () => {
  const dir = getWallpapersDir();
  try {
    await shell.openPath(dir);
    return { ok: true, path: dir };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('wallpapers-list', async () => {
  const dir = getWallpapersDir();
  const validExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);
  const list = [];

  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (validExts.has(ext)) {
        const fullPath = path.join(dir, f);
        const name = path.parse(f).name.replace(/[-_]/g, ' ');
        // file url for electron webview
        const fileUrl = 'file:///' + fullPath.replace(/\\/g, '/');
        list.push({
          id: f,
          name: name,
          fileName: f,
          fullPath: fullPath,
          fileUrl: fileUrl
        });
      }
    }
  } catch (e) {
    console.error('Failed to list wallpapers:', e);
  }

  return list;
});

ipcMain.handle('wallpapers-select-file', async () => {
  if (!mainWindow) return { ok: false };
  try {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите изображение для обоев',
      properties: ['openFile'],
      filters: [
        { name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }
      ]
    });

    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const srcFile = res.filePaths[0];
    const fileName = path.basename(srcFile);
    const targetFile = path.join(getWallpapersDir(), fileName);
    fs.copyFileSync(srcFile, targetFile);

    return { ok: true, fileName: fileName };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.whenReady().then(() => {
  initDefaultWallpapers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
