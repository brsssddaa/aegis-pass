const http = require('http');
const https = require('https');
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
const activeSessions = new Map(); // token -> { user, createdAt }

function generateToken(identity) {
  const secret = config.session_secret || 'aegis_default_secret_2026';
  return crypto.createHmac('sha256', secret).update(String(identity) + '_session').digest('hex');
}

function verifyToken(token) {
  if (!config.auth_enabled) return true;
  if (!token) return false;
  if (activeSessions.has(token)) return true;
  const expected = generateToken(SERVER_PIN);
  return token === expected;
}

function verifyGoogleToken(idToken) {
  return new Promise((resolve, reject) => {
    https.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.email && json.sub) {
            resolve(json);
          } else {
            reject(new Error(json.error_description || 'Invalid Google token'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (_) {}

const pendingOtps = new Map(); // email -> { code, expiresAt, attempts }

async function sendOtpEmail(email, code) {
  const smtpConfig = config.smtp || {};
  if (nodemailer && smtpConfig.user && smtpConfig.pass) {
    try {
      const transporter = nodemailer.createTransport({
        service: smtpConfig.service || 'gmail',
        host: smtpConfig.host || 'smtp.gmail.com',
        port: smtpConfig.port || 465,
        secure: smtpConfig.secure !== false,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        }
      });
      await transporter.sendMail({
        from: `"Aegis Pass Security" <${smtpConfig.user}>`,
        to: email,
        subject: `Код подтверждения Aegis Pass: ${code}`,
        text: `Ваш одноразовый код для входа в Aegis Pass: ${code}\nКод действует 5 минут. Никому не сообщайте этот код.`,
        html: `
          <div style="background: #0d1117; color: #f0f6fc; padding: 24px; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid rgba(0,229,255,0.3);">
            <h2 style="color: #00e5ff; margin-top: 0; letter-spacing: 0.5px;">Aegis Pass Security</h2>
            <p style="color: #94a3b8; font-size: 14px;">Одноразовый код для подтверждения входа в зашифрованное хранилище:</p>
            <div style="background: rgba(0,229,255,0.08); border: 2px dashed #00e5ff; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #ffffff; font-family: monospace;">${code}</span>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">Код действует 5 минут. Если вы не запрашивали вход, проигнорируйте письмо.</p>
          </div>
        `
      });
      console.log(`[AUTH] Sent real email OTP to ${email}`);
      return { sent: true };
    } catch (e) {
      console.error('[AUTH] SMTP send failed:', e.message);
    }
  }

  // Local/Dev fallback output
  console.log(`\n====================================================`);
  console.log(`  AEGIS PASS EMAIL OTP VERIFICATION CODE`);
  console.log(`====================================================`);
  console.log(`* To Email: ${email}`);
  console.log(`* OTP Code: [ ${code} ]`);
  console.log(`* Expires : 5 minutes`);
  console.log(`====================================================\n`);
  return { sent: false, dev: true };
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

  // 2b. Google Sign-In Verification
  if (pathname === '/api/auth/google' && req.method === 'POST') {
    try {
      const body = await readBodyJson(req);
      const idToken = body.id_token || body.credential;
      if (!idToken) {
        return sendJson(res, 400, { ok: false, error: 'Google ID token required' });
      }

      const googleUser = await verifyGoogleToken(idToken);
      const sessionToken = generateToken(googleUser.email);
      activeSessions.set(sessionToken, {
        email: googleUser.email,
        name: googleUser.name,
        sub: googleUser.sub,
        createdAt: Date.now()
      });

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `aegis_token=${sessionToken}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax`,
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify({
        ok: true,
        token: sessionToken,
        user: {
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture
        },
        message: 'Вход через Google успешен'
      }));
    } catch (err) {
      return sendJson(res, 401, { ok: false, error: 'Ошибка верификации Google: ' + err.message });
    }
  }

  // 2c. Request Google Email OTP (One-Time Password)
  if (pathname === '/api/auth/otp/request' && req.method === 'POST') {
    try {
      const body = await readBodyJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { ok: false, error: 'Введите корректный Google email' });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      pendingOtps.set(email, {
        code: code,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
      });

      const sendResult = await sendOtpEmail(email, code);

      return sendJson(res, 200, {
        ok: true,
        message: 'Код подтверждения отправлен на почту',
        email: email,
        expiresIn: 300,
        devCode: sendResult.dev ? code : undefined
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // 2d. Verify Google Email OTP
  if (pathname === '/api/auth/otp/verify' && req.method === 'POST') {
    try {
      const body = await readBodyJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      const code = String(body.code || '').trim();

      if (!email || !code) {
        return sendJson(res, 400, { ok: false, error: 'Email и код обязательны' });
      }

      const pending = pendingOtps.get(email);
      if (!pending) {
        return sendJson(res, 400, { ok: false, error: 'Код не запрашивался или срок действия истёк. Запросите код заново.' });
      }

      if (Date.now() > pending.expiresAt) {
        pendingOtps.delete(email);
        return sendJson(res, 400, { ok: false, error: 'Срок действия кода истёк. Запросите новый код.' });
      }

      if (pending.attempts >= 5) {
        pendingOtps.delete(email);
        return sendJson(res, 429, { ok: false, error: 'Слишком много неверных попыток. Запросите код заново.' });
      }

      if (pending.code !== code) {
        pending.attempts++;
        return sendJson(res, 401, {
          ok: false,
          error: `Неверный код. Осталось попыток: ${5 - pending.attempts}`
        });
      }

      pendingOtps.delete(email);
      const sessionToken = generateToken(email);
      activeSessions.set(sessionToken, {
        email: email,
        name: email.split('@')[0],
        createdAt: Date.now()
      });

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `aegis_token=${sessionToken}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax`,
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify({
        ok: true,
        token: sessionToken,
        user: {
          email: email,
          name: email.split('@')[0]
        },
        message: 'Успешная авторизация по коду из почты'
      }));
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // 3b. Zero-Knowledge Encrypted Vault Read
  if (pathname === '/api/vault/encrypted' && req.method === 'GET') {
    if (!isAuthenticated) {
      return sendJson(res, 401, { ok: false, error: 'Требуется авторизация' });
    }
    const result = syncManager.getEncryptedVault();
    return sendJson(res, 200, result);
  }

  // 4b. Zero-Knowledge Encrypted Vault Write / Sync
  if (pathname === '/api/vault/encrypted' && req.method === 'POST') {
    if (!isAuthenticated) {
      return sendJson(res, 401, { ok: false, error: 'Требуется авторизация' });
    }
    try {
      const body = await readBodyJson(req);
      const encryptedBlob = body.encryptedBlob || body;
      const deviceId = req.headers['x-device-id'] || body.deviceId || 'unknown';
      const deviceName = req.headers['x-device-name'] || body.deviceName || 'Client';

      const result = syncManager.updateEncryptedVault(encryptedBlob, deviceId, deviceName);
      return sendJson(res, 200, result);
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
