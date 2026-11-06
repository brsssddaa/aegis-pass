const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class VaultSyncManager {
  constructor(config, backupsDir) {
    this.config = config;
    let vPath = process.env.VAULT_PATH || config.vault_path;
    if (process.platform !== 'win32' && (vPath.includes(':') || !path.isAbsolute(vPath))) {
      vPath = path.join(__dirname, '..', 'data', 'aegis_vault.json');
    }
    this.vaultPath = path.resolve(vPath);
    this.backupsDir = backupsDir;
    this.version = 1;
    this.lastModified = Date.now();
    this.sseClients = new Set();
    this.connectedDevices = new Map(); // id -> { name, ip, connectedAt, lastSeen }

    this._ensureVaultFile();
  }

  getEncryptedVaultPath() {
    return path.join(path.dirname(this.vaultPath), 'aegis_vault_zero_knowledge.json');
  }

  getEncryptedVault() {
    try {
      const p = this.getEncryptedVaultPath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return {
          ok: true,
          encrypted: true,
          version: this.version,
          lastModified: this.lastModified,
          data: JSON.parse(raw)
        };
      }
    } catch (e) {
      console.error('[VAULT-ZK] Read error:', e.message);
    }
    return { ok: false, error: 'Зашифрованное хранилище ещё не создано' };
  }

  updateEncryptedVault(encryptedBlob, deviceId = 'unknown', deviceName = 'Client') {
    const p = this.getEncryptedVaultPath();
    const tempPath = p + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(encryptedBlob, null, 2), 'utf-8');
    fs.renameSync(tempPath, p);

    this.version++;
    this.lastModified = Date.now();

    this._broadcastEncryptedUpdate(encryptedBlob, deviceId, deviceName);

    return {
      ok: true,
      encrypted: true,
      version: this.version,
      lastModified: this.lastModified
    };
  }

  _broadcastEncryptedUpdate(encryptedBlob, senderId, senderName) {
    const msg = `event: vault_encrypted_update\ndata: ${JSON.stringify({
      version: this.version,
      lastModified: this.lastModified,
      encryptedBlob: encryptedBlob,
      senderId: senderId,
      senderName: senderName
    })}\n\n`;

    for (const client of this.sseClients) {
      if (client.deviceId !== senderId) {
        try {
          client.res.write(msg);
        } catch (_) {
          this.sseClients.delete(client);
        }
      }
    }
  }

  _ensureVaultFile() {
    try {
      const dir = path.dirname(this.vaultPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.vaultPath)) {
        const initial = [];
        fs.writeFileSync(this.vaultPath, JSON.stringify(initial, null, 2), 'utf-8');
      } else {
        const stats = fs.statSync(this.vaultPath);
        this.lastModified = stats.mtimeMs;
      }
    } catch (e) {
      console.error('[VAULT] Error ensuring vault file:', e.message);
    }
  }

  getVault() {
    try {
      if (fs.existsSync(this.vaultPath)) {
        const raw = fs.readFileSync(this.vaultPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
        return {
          ok: true,
          version: this.version,
          lastModified: this.lastModified,
          itemsCount: items.length,
          items: items
        };
      }
    } catch (e) {
      console.error('[VAULT] Read error:', e.message);
    }
    return {
      ok: true,
      version: this.version,
      lastModified: this.lastModified,
      itemsCount: 0,
      items: []
    };
  }

  updateVault(newItems, deviceId = 'unknown', deviceName = 'Client') {
    if (!Array.isArray(newItems)) {
      throw new Error('Vault items must be an array');
    }

    // 1. Create timestamped backup of current vault
    this._createBackup();

    // 2. Write new items atomically
    const tempPath = this.vaultPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(newItems, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.vaultPath);

    this.version++;
    this.lastModified = Date.now();

    // 3. Broadcast to all SSE clients except the originating device
    this._broadcastUpdate(newItems, deviceId, deviceName);

    return {
      ok: true,
      version: this.version,
      lastModified: this.lastModified,
      itemsCount: newItems.length
    };
  }

  _createBackup() {
    try {
      if (!fs.existsSync(this.vaultPath)) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupsDir, `vault_backup_${stamp}_v${this.version}.json`);
      fs.copyFileSync(this.vaultPath, backupPath);

      // Rotate backups if exceeding limit
      const maxBackups = this.config.max_backups || 20;
      const files = fs.readdirSync(this.backupsDir)
        .filter(f => f.startsWith('vault_backup_') && f.endsWith('.json'))
        .sort();

      while (files.length > maxBackups) {
        const oldest = files.shift();
        try { fs.unlinkSync(path.join(this.backupsDir, oldest)); } catch (_) {}
      }
    } catch (e) {
      console.error('[VAULT] Backup creation failed:', e.message);
    }
  }

  listBackups() {
    try {
      if (!fs.existsSync(this.backupsDir)) return [];
      const files = fs.readdirSync(this.backupsDir)
        .filter(f => f.startsWith('vault_backup_') && f.endsWith('.json'))
        .map(f => {
          const fp = path.join(this.backupsDir, f);
          const stats = fs.statSync(fp);
          return {
            filename: f,
            sizeBytes: stats.size,
            sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
            createdAt: stats.mtimeMs,
            dateFormatted: new Date(stats.mtimeMs).toLocaleString('ru-RU')
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      return files;
    } catch (e) {
      return [];
    }
  }

  restoreBackup(filename) {
    const safeName = path.basename(filename);
    const sourcePath = path.join(this.backupsDir, safeName);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Backup file "${safeName}" not found`);
    }

    // Backup current before restoring
    this._createBackup();

    fs.copyFileSync(sourcePath, this.vaultPath);
    this.version++;
    this.lastModified = Date.now();

    const restored = this.getVault();
    this._broadcastUpdate(restored.items, 'system', 'Backup Restore');
    return restored;
  }

  // SSE client management
  addSseClient(res, req, deviceId = 'unknown', deviceName = 'Device') {
    const client = {
      res,
      deviceId,
      deviceName,
      ip: req.socket.remoteAddress || '127.0.0.1',
      connectedAt: Date.now()
    };

    this.sseClients.add(client);
    this.connectedDevices.set(deviceId, {
      id: deviceId,
      name: deviceName,
      ip: client.ip,
      connectedAt: client.connectedAt,
      lastSeen: Date.now()
    });

    req.on('close', () => {
      this.sseClients.delete(client);
      const dev = this.connectedDevices.get(deviceId);
      if (dev) dev.lastSeen = Date.now();
    });

    // Send initial status event
    const initData = JSON.stringify({
      event: 'connected',
      version: this.version,
      lastModified: this.lastModified,
      itemsCount: this.getVault().itemsCount
    });
    res.write(`data: ${initData}\n\n`);
  }

  _broadcastUpdate(items, sourceDeviceId, sourceDeviceName) {
    const payload = JSON.stringify({
      event: 'vault_updated',
      version: this.version,
      lastModified: this.lastModified,
      itemsCount: items.length,
      items: items,
      sourceDeviceId,
      sourceDeviceName
    });

    for (const client of this.sseClients) {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (_) {
        this.sseClients.delete(client);
      }
    }
  }

  getStats() {
    const vault = this.getVault();
    return {
      version: this.version,
      lastModified: this.lastModified,
      itemsCount: vault.itemsCount,
      connectedClientsCount: this.sseClients.size,
      connectedDevices: Array.from(this.connectedDevices.values())
    };
  }
}

module.exports = VaultSyncManager;
