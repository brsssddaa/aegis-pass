const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const VaultSyncManager = require('./vault-sync');

const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const BACKUPS_DIR = path.join(__dirname, 'backups');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const syncManager = new VaultSyncManager(config, BACKUPS_DIR);

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          name: name,
          address: net.address,
          isTailscale: net.address.startsWith('100.')
        });
      }
    }
  }
  return addresses;
}

// Generate simple HMAC token for sessions
const SERVER_PIN = process.env.AEGIS_PIN || config.server_pin || '2026';

function generateToken(pin) {
  const secret = config.session_secret || 'aegis_default_secret_2026';
  return crypto.createHmac('sha256', secret).update(String(pin) + '_session').digest('hex');
}

function verifyToken(token) {
  if (!config.auth_enabled) return true;
  if (!token) return false;
  const expected = generateToken(SERVER_PIN);
  return token === expected;
}

function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(c => {
    const parts = c.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        resolve(json);
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id, X-Device-Name',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id, X-Device-Name',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  // Auth Extraction
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || parseCookies(req)['aegis_token'] || parsedUrl.searchParams.get('token');
  const isAuthenticated = verifyToken(token);

  // --------------------------------------------------------------------------
  // API ROUTES
  // --------------------------------------------------------------------------

  // 1. Server Status
  if (pathname === '/api/status' && req.method === 'GET') {
    const stats = syncManager.getStats();
    const networks = getNetworkAddresses();
    return sendJson(res, 200, {
      ok: true,
      app: config.app_name,
      version: config.version,
      authRequired: Boolean(config.auth_enabled),
      isAuthenticated: isAuthenticated,
      stats: stats,
      network: {
        port: config.port,
        interfaces: networks
      }
    });
  }

  // 2. Authentication Login / Verify PIN
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBodyJson(req);
      const pin = String(body.pin || '').trim();
      const expectedPin = String(SERVER_PIN).trim();

      if (pin === expectedPin) {
        const sessionToken = generateToken(pin);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `aegis_token=${sessionToken}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax`,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          ok: true,
          token: sessionToken,
          message: 'Авторизация успешна'
        }));
        return;
      } else {
        return sendJson(res, 401, { ok: false, error: 'Неверный PIN-код доступа' });
      }
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  // 3. Vault Read
  if (pathname === '/api/vault' && req.method === 'GET') {
    if (!isAuthenticated) {
      return sendJson(res, 401, { ok: false, error: 'Требуется авторизация (PIN-код)' });
    }
    const vault = syncManager.getVault();
    return sendJson(res, 200, vault);
  }

  // 4. Vault Write / Sync
  if (pathname === '/api/vault' && req.method === 'POST') {
    if (!isAuthenticated) {
      return sendJson(res, 401, { ok: false, error: 'Требуется авторизация (PIN-код)' });
    }
    try {
      const body = await readBodyJson(req);
      const items = Array.isArray(body) ? body : (body.items || []);
      const deviceId = req.headers['x-device-id'] || body.deviceId || 'web';
      const deviceName = req.headers['x-device-name'] || body.deviceName || 'Web/Mobile';

      const result = syncManager.updateVault(items, deviceId, deviceName);
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  // 5. SSE Realtime Sync Stream
  if (pathname === '/api/sync/events' && req.method === 'GET') {
    if (!isAuthenticated) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Unauthorized');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const deviceId = req.headers['x-device-id'] || parsedUrl.searchParams.get('deviceId') || 'device_' + Date.now();
    const deviceName = req.headers['x-device-name'] || parsedUrl.searchParams.get('deviceName') || 'Mobile Client';

    syncManager.addSseClient(res, req, deviceId, deviceName);
    return;
  }

  // 6. Backups List
  if (pathname === '/api/backups' && req.method === 'GET') {
    if (!isAuthenticated) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const backups = syncManager.listBackups();
    return sendJson(res, 200, { ok: true, backups });
  }

  // 7. Restore Backup
  if (pathname === '/api/backups/restore' && req.method === 'POST') {
    if (!isAuthenticated) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const body = await readBodyJson(req);
      const filename = body.filename;
      if (!filename) return sendJson(res, 400, { ok: false, error: 'Имя файла не указано' });
      const result = syncManager.restoreBackup(filename);
      return sendJson(res, 200, { ok: true, restored: result });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  // 8. Export Vault as JSON file download
  if (pathname === '/api/export' && req.method === 'GET') {
    if (!isAuthenticated) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const vault = syncManager.getVault();
    const dateStr = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="aegis_vault_backup_${dateStr}.json"`
    });
    res.end(JSON.stringify(vault.items, null, 2));
    return;
  }

  // --------------------------------------------------------------------------
  // STATIC ASSET SERVING (PUBLIC WEB VAULT)
  // --------------------------------------------------------------------------

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // If file doesn't exist in server/public, check if it's an asset in aegis-pass/src/
  if (!fs.existsSync(filePath)) {
    const fallbackPath = path.join(__dirname, '..', 'src', pathname.replace(/^\//, ''));
    if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
      filePath = fallbackPath;
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback to index.html for SPA routing
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

const PORT = process.env.PORT || config.port || 8088;
const HOST = process.env.HOST || config.host || '0.0.0.0';

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[SERVER] Port ${PORT} is already in use (Aegis Pass server is already running).`);
  } else {
    console.error('[SERVER] Server error:', err.message);
  }
});

server.listen(PORT, HOST, () => {
  const addrs = getNetworkAddresses();
  console.log('====================================================');
  console.log(`  AEGIS PASS SYNC SERVER v${config.version}`);
  console.log('====================================================');
  console.log(`* Local:      http://127.0.0.1:${PORT}`);
  addrs.forEach(a => {
    console.log(`* ${a.name.padEnd(10)}: http://${a.address}:${PORT} ${a.isTailscale ? '(Tailscale Phone)' : ''}`);
  });
  console.log(`* Vault Path: ${syncManager.vaultPath}`);
  console.log(`* Server PIN: ${SERVER_PIN}`);
  console.log('====================================================');
});

module.exports = { server, syncManager, config };
