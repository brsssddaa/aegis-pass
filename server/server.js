const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const VaultSyncManager = require('./vault-sync');

const isInsideAsar = __dirname.includes('app.asar');
const userServerDir = path.join(os.homedir(), 'AppData', 'Roaming', 'aegis-pass', 'server');

let CONFIG_PATH = path.join(__dirname, 'config.json');
let BACKUPS_DIR = path.join(__dirname, 'backups');
let PUBLIC_DIR = path.join(__dirname, 'public');

if (isInsideAsar) {
  try {
    if (!fs.existsSync(userServerDir)) fs.mkdirSync(userServerDir, { recursive: true });
    CONFIG_PATH = path.join(userServerDir, 'config.json');
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.copyFileSync(path.join(__dirname, 'config.json'), CONFIG_PATH);
    }
    BACKUPS_DIR = path.join(userServerDir, 'backups');
  } catch (_) {}
}

try {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
} catch (_) {}

try {
  if (!isInsideAsar && !fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
} catch (_) {}

let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
} catch (_) {
  try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
  } catch (e) {
    config = { port: 8088, pin: '2026' };
  }
}

// Merge local secrets from config.local.json (ignored by git)
const localConfigPath = path.join(__dirname, 'config.local.json');
if (fs.existsSync(localConfigPath)) {
  try {
    const localCfg = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'));
    config = Object.assign(config, localCfg);
  } catch (_) {}
}

// Merge cloud environment variables (e.g. Render)
if (process.env.GOOGLE_CLIENT_ID) config.google_client_id = process.env.GOOGLE_CLIENT_ID;
if (process.env.GOOGLE_CLIENT_SECRET) config.google_client_secret = process.env.GOOGLE_CLIENT_SECRET;
if (!config.smtp) config.smtp = {};
if (process.env.SMTP_USER) config.smtp.user = process.env.SMTP_USER;
if (process.env.SMTP_PASS) config.smtp.pass = process.env.SMTP_PASS;

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
let latestGoogleAuth = null;

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
            if (config.google_client_id && json.aud && json.aud !== config.google_client_id) {
              return reject(new Error('Audience mismatch: Токен не принадлежит этому приложению'));
            }
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
  const smtpUser = process.env.SMTP_USER || smtpConfig.user;
  const smtpPass = process.env.SMTP_PASS || smtpConfig.pass;
  if (nodemailer && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: smtpConfig.service || 'gmail',
        host: smtpConfig.host || 'smtp.gmail.com',
        port: smtpConfig.port || 465,
        secure: smtpConfig.secure !== false,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      const htmlBody = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Код подтверждения Aegis Pass</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050811; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #050811; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #0c1220; border: 1px solid #1e293b; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
          
          <!-- Top Neon Cyan Gradient Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #00e5ff 0%, #3b82f6 50%, #8b5cf6 100%);"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center;">
              <!-- Shield Icon Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 16px auto;">
                <tr>
                  <td style="width: 54px; height: 54px; background: linear-gradient(135deg, rgba(0,229,255,0.15), rgba(139,92,246,0.15)); border: 1.5px solid #00e5ff; border-radius: 14px; text-align: center; vertical-align: middle;">
                    <span style="font-size: 26px; line-height: 54px;">🛡️</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">Aegis Pass Security</h1>
              <div style="display: inline-block; background: rgba(0, 229, 255, 0.1); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: #00e5ff; letter-spacing: 1px; text-transform: uppercase;">
                Двухфакторная авторизация
              </div>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 0 32px 10px 32px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                Здравствуйте! Вы запросили вход в защищённое Zero-Knowledge хранилище. Используйте одноразовый код для подтверждения:
              </p>
            </td>
          </tr>

          <!-- OTP Code Box (Hero element) -->
          <tr>
            <td style="padding: 16px 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #070c18; border: 1.5px solid #00e5ff; border-radius: 14px; box-shadow: 0 0 25px rgba(0,229,255,0.18);">
                <tr>
                  <td style="padding: 24px 16px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">
                      Одноразовый проверочный код
                    </div>
                    <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #00e5ff; font-family: 'Courier New', Courier, monospace; text-shadow: 0 0 14px rgba(0,229,255,0.4); margin: 4px 0;">
                      ${code}
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 10px;">
                      ⏱ Код действителен в течение <strong>5 минут</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Attributes Grid -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 16px;">
                <tr>
                  <td style="font-size: 12px; color: #94a3b8; padding: 4px 0;">
                    <span style="color: #00e5ff; font-weight: 600;">🔒 Архитектура:</span> Zero-Knowledge (ключи только у вас)
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #94a3b8; padding: 4px 0;">
                    <span style="color: #00e5ff; font-weight: 600;">🛡️ Шифрование:</span> Сквозное AES-256-GCM + PBKDF2
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #94a3b8; padding: 4px 0;">
                    <span style="color: #00e5ff; font-weight: 600;">💻 Клиент:</span> Aegis Pass Desktop (Windows)
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Warning Alert -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px 14px; font-size: 12px; color: #fca5a5; line-height: 1.5;">
                    <strong style="color: #ef4444;">Не запрашивали этот код?</strong><br>
                    Проигнорируйте это письмо и никому не сообщайте код. Никто, включая сотрудников поддержки, не имеет права запрашивать этот код у вас.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="border-top: 1px solid #1e293b; padding: 0;"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 28px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">
                © 2026 Aegis Pass • Защищённая система управления паролями
              </p>
              <p style="margin: 0; font-size: 10.5px; color: #475569;">
                Это автоматическое сервисное уведомление безопасности. Пожалуйста, не отвечайте на это письмо.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      await transporter.sendMail({
        from: `"Aegis Pass Security" <${smtpConfig.user}>`,
        to: email,
        subject: `🛡️ Код подтверждения Aegis Pass: ${code}`,
        text: `Ваш одноразовый код для входа в Aegis Pass: ${code}\nКод действует 5 минут. Никому не сообщайте этот код.`,
        html: htmlBody
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

  // 2b. Google OAuth 2.0 Web Callback (from system browser)
  if (pathname === '/api/auth/google/callback' && req.method === 'GET') {
    const code = parsedUrl.searchParams.get('code');
    const errParam = parsedUrl.searchParams.get('error');

    if (errParam || !code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <div style="background:#0d1117;color:#ff5555;padding:40px;text-align:center;font-family:sans-serif;">
          <h2>Ошибка авторизации Google: ${errParam || 'Код не передан'}</h2>
          <p>Закройте окно и попробуйте снова в приложении.</p>
        </div>
      `);
    }

    try {
      // Exchange authorization code for tokens
      const tokenBody = new URLSearchParams({
        code: code,
        client_id: config.google_client_id,
        client_secret: config.google_client_secret,
        redirect_uri: `http://${req.headers.host}/api/auth/google/callback`,
        grant_type: 'authorization_code'
      }).toString();

      const tokenRes = await new Promise((resolve, reject) => {
        const tr = https.request('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(tokenBody)
          }
        }, (resp) => {
          let d = '';
          resp.on('data', chunk => d += chunk);
          resp.on('end', () => {
            try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
          });
        });
        tr.on('error', reject);
        tr.write(tokenBody);
        tr.end();
      });

      if (!tokenRes.id_token) {
        throw new Error(tokenRes.error_description || tokenRes.error || 'Не удалось получить id_token от Google');
      }

      const googleUser = await verifyGoogleToken(tokenRes.id_token);
      const email = googleUser.email.toLowerCase();

      // Generate 6-digit OTP code for this user
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      pendingOtps.set(email, {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
      });

      const mailRes = await sendOtpEmail(email, otpCode);

      // Save latest google auth for polling by Electron
      latestGoogleAuth = {
        email: email,
        name: googleUser.name,
        picture: googleUser.picture,
        sub: googleUser.sub,
        devCode: mailRes.dev ? otpCode : undefined,
        timestamp: Date.now()
      };

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="utf-8">
          <title>Aegis Pass - Вход выполнен</title>
          <style>
            body { background: #080c11; color: #f0f6fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { background: #0d1117; border: 1px solid rgba(0,229,255,0.3); border-radius: 16px; padding: 36px 32px; text-align: center; max-width: 440px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
            .avatar { width: 68px; height: 68px; border-radius: 50%; margin-bottom: 16px; border: 2px solid #00e5ff; object-fit: cover; }
            h2 { color: #00e5ff; margin: 0 0 10px; font-size: 20px; }
            p { color: #8b949e; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
            .email { color: #ffffff; font-weight: 600; background: rgba(0,229,255,0.1); border: 1px solid rgba(0,229,255,0.25); padding: 4px 10px; border-radius: 6px; }
            .code-box { background: rgba(0,229,255,0.06); border: 1px dashed #00e5ff; border-radius: 8px; padding: 10px; font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
            .close-btn { background: #21262d; border: 1px solid #30363d; color: #f0f6fc; padding: 10px 22px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
            .close-btn:hover { background: #30363d; border-color: #8b949e; }
          </style>
        </head>
        <body>
          <div class="box">
            ${googleUser.picture ? `<img class="avatar" src="${googleUser.picture}" alt="Avatar">` : ''}
            <h2>✓ Google аккаунт выбран!</h2>
            <p>Вы вошли как <span class="email">${email}</span>.<br><br>Мы отправили 6-значный проверочный код на вашу почту.</p>
            ${mailRes.dev ? `<div class="code-box">[Dev Mode] Проверочный код: <b style="color:#00e5ff;font-size:16px;">${otpCode}</b></div>` : ''}
            <p style="font-size:12px;color:#6e7681;">Вернитесь в приложение <b>Aegis Pass</b>, чтобы ввести код.</p>
            <button class="close-btn" onclick="window.close()">Закрыть эту вкладку</button>
          </div>
          <script>setTimeout(() => window.close(), 5000);</script>
        </body>
        </html>
      `);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <div style="background:#0d1117;color:#ff5555;padding:40px;text-align:center;font-family:sans-serif;">
          <h2>Ошибка обмена токена Google: ${e.message}</h2>
          <p>Проверьте Client Secret и Redirect URI в Google Cloud Console.</p>
        </div>
      `);
    }
  }

  // 2b-2. Poll pending Google Auth from Electron
  if (pathname === '/api/auth/google/pending' && req.method === 'GET') {
    const data = latestGoogleAuth;
    if (parsedUrl.searchParams.get('clear') === '1') {
      latestGoogleAuth = null;
    }
    return sendJson(res, 200, {
      ok: true,
      pending: data
    });
  }

  // 2b-3. Direct Google ID Token Verification
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
  try {
    fs.appendFileSync(path.join(os.homedir(), 'AppData', 'Roaming', 'aegis-pass', 'server_init.log'), `[SERVER ERROR] ${err.message}\n`);
  } catch (_) {}
  if (err.code === 'EADDRINUSE') {
    console.log(`[SERVER] Port ${PORT} is already in use (Aegis Pass server is already running).`);
  } else {
    console.error('[SERVER] Server error:', err.message);
  }
});

server.listen(PORT, HOST, () => {
  try {
    fs.appendFileSync(path.join(os.homedir(), 'AppData', 'Roaming', 'aegis-pass', 'server_init.log'), `[SERVER LISTENING] http://${HOST}:${PORT}\n`);
  } catch (_) {}
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
