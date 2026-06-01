const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const db      = require('./db');

// Load .env if exists (production env vars)
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0) { const k = line.slice(0, eq).trim(); if (!process.env[k]) process.env[k] = line.slice(eq + 1).trim(); }
  });
} catch {}

const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID   || '';

const TG_METHOD_LABEL = { telegram: 'Telegram', max: 'MAX', phone: 'Телефон', card: 'Карта' };

function sendTgNotify(contactMethod, contact, ip) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  const label = TG_METHOD_LABEL[contactMethod] || contactMethod;
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const text = `🔔 Новая заявка на триал АкуПро\nМетод: ${label}\nКонтакт: ${contact}\nIP: ${ip || '—'}\nВремя: ${now}`;
  const body = JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TG_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.on('error', (e) => console.error('[TG notify error]', e.message));
  req.write(body);
  req.end();
}

const ROOT    = __dirname;
const PORT    = process.env.PORT || 5500;
// JWT_SECRET: из env → из файла → генерируем и сохраняем
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  const secretFile = path.join(ROOT, 'data', '.jwt_secret');
  try {
    SECRET = fs.readFileSync(secretFile, 'utf8').trim();
  } catch {
    SECRET = crypto.randomBytes(32).toString('hex');
    try { fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true }); fs.writeFileSync(secretFile, SECRET); } catch {}
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
  '.webp': 'image/webp',
};

// ── Helpers ────────────────────────────────────────────────
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1_000_000) reject(new Error('Too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Bad JSON')); } });
    req.on('error', reject);
  });
}

function verifyToken(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

function requireAuth(req, res) {
  const user = verifyToken(req);
  if (!user) { json(res, 401, { error: 'Не авторизован' }); return null; }
  return user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') { json(res, 403, { error: 'Недостаточно прав' }); return null; }
  return user;
}

// bcrypt (новые пароли) — cost 12
async function hashPwd(password) {
  return bcrypt.hash(password, 12);
}
async function checkPwd(password, storedHash) {
  // Поддержка старых SHA-256 хешей при миграции
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }
  // Legacy SHA-256 + hostname salt
  const legacyHash = (hostname) => crypto.createHash('sha256').update('acutwin::v1::' + hostname + password).digest('hex');
  return storedHash === legacyHash('localhost') || storedHash === legacyHash('acutwin.ru');
}

// ── Брутфорс-защита ────────────────────────────────────────
const _attempts = {};
function checkBrute(username) {
  const now = Date.now();
  const a = _attempts[username] || { count: 0, until: 0 };
  if (a.until > now) return Math.ceil((a.until - now) / 1000);
  return 0;
}
function recordFail(username) {
  const a = _attempts[username] || { count: 0, until: 0 };
  a.count++;
  if (a.count >= 5) { a.until = Date.now() + 60_000; a.count = 0; }
  _attempts[username] = a;
}
function clearFail(username) { delete _attempts[username]; }

// ── Rate limiting для записей (max 20 в минуту на пользователя) ───
const _recRateMap = {};
function checkRecordRate(username) {
  const now = Date.now();
  const r = _recRateMap[username] || { count: 0, window: now };
  if (now - r.window > 60_000) { r.count = 0; r.window = now; }
  r.count++;
  _recRateMap[username] = r;
  return r.count > 20;
}

// ── API Router ─────────────────────────────────────────────
async function handleAPI(method, endpoint, req, res) {

  // POST /api/trial-request
  if (method === 'POST' && endpoint === '/api/trial-request') {
    const { method: contactMethod, contact } = await readBody(req);
    const VALID_METHODS = ['telegram', 'max', 'phone', 'card'];
    if (!VALID_METHODS.includes(contactMethod) || !contact || !contact.trim())
      return json(res, 400, { error: 'Некорректные данные' });
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    try {
      db.addTrialRequest(contactMethod, contact.trim(), ip);
      sendTgNotify(contactMethod, contact.trim(), ip);
      return json(res, 200, { ok: true });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return json(res, 409, { error: 'Дубликат' });
      return json(res, 500, { error: 'Ошибка сервера' });
    }
  }

  // POST /api/login
  if (method === 'POST' && endpoint === '/api/login') {
    const { username, password, hostname } = await readBody(req);
    if (!username || !password) return json(res, 400, { error: 'Логин и пароль обязательны' });

    const wait = checkBrute(username.trim().toLowerCase());
    if (wait > 0) return json(res, 429, { error: `Слишком много попыток. Подождите ${wait} сек.` });

    const user = db.getUser(username.trim());
    if (!user) { recordFail(username.trim().toLowerCase()); return json(res, 401, { error: 'Пользователь не найден' }); }

    const ok = await checkPwd(password, user.hash);
    if (!ok) { recordFail(username.trim().toLowerCase()); return json(res, 401, { error: 'Неверный пароль' }); }
    clearFail(username.trim().toLowerCase());

    // Авто-миграция SHA-256 → bcrypt при первом успешном логине
    if (!user.hash.startsWith('$2')) {
      const newHash = await hashPwd(password);
      db.updateUserHash(user.username, newHash);
    }

    // Проверка арендатора
    const tenant = db.findTenantByDoctor(user.username);
    if (tenant && user.role === 'doctor') {
      if (tenant.status === 'expired')   return json(res, 403, { error: 'Срок действия подписки истёк.' });
      if (tenant.status === 'suspended') return json(res, 403, { error: 'Доступ приостановлен.' });
    }

    const clinicName = (tenant && user.role === 'doctor') ? (tenant.clinic || '') : '';
    const token = jwt.sign(
      { username: user.username, name: user.name, role: user.role, clinicName },
      SECRET,
      { expiresIn: '8h' }
    );
    return json(res, 200, { ok: true, token, user: { username: user.username, name: user.name, role: user.role } });
  }

  // GET /api/status — публичный, без авторизации
  if (method === 'GET' && endpoint === '/api/status') {
    return json(res, 200, { hasUsers: db.getUsers().length > 0 });
  }

  // GET /api/me
  if (method === 'GET' && endpoint === '/api/me') {
    const user = requireAuth(req, res); if (!user) return;
    return json(res, 200, { username: user.username, name: user.name, role: user.role });
  }

  // ── Records ─────────────────────────────────────────────

  // GET /api/records
  if (method === 'GET' && endpoint === '/api/records') {
    const user = requireAuth(req, res); if (!user) return;
    if (user.role === 'admin') return json(res, 200, db.getRecords());
    if (user.role === 'boss') {
      const tenant = db.findTenantByDoctor(user.username);
      return json(res, 200, tenant
        ? db.getRecordsByLogins(tenant.doctorLogins)
        : []);
    }
    return json(res, 200, db.getMyRecords(user.username));
  }

  // POST /api/records
  if (method === 'POST' && endpoint === '/api/records') {
    const user = requireAuth(req, res); if (!user) return;
    if (checkRecordRate(user.username)) return json(res, 429, { error: 'Слишком много запросов. Подождите минуту.' });
    const body = await readBody(req);
    const rec = {
      id:         body.id || crypto.randomUUID(),
      doctor:     user.username,
      doctorName: user.name,
      date:       body.date || new Date().toISOString().slice(0,10),
      time:       body.time || new Date().toTimeString().slice(0,5),
      patient:    String(body.patient || '').slice(0,200),
      age:        String(body.age || '').slice(0,10),
      gender:     String(body.gender || '').slice(0,5),
      reason:     String(body.reason || '').slice(0,500),
      notes:      String(body.notes || '').slice(0,1000),
      points:     Array.isArray(body.points) ? body.points : [],
      meridians:  Array.isArray(body.meridians) ? body.meridians : [],
      type:           String(body.type || 'Акупунктура').slice(0,50),
      outcome:        String(body.outcome || 'neutral').slice(0,20),
      nrs_before:     body.nrs_before     != null ? Number(body.nrs_before)     : null,
      nrs_after:      body.nrs_after      != null ? Number(body.nrs_after)      : null,
      treatment_type: body.treatment_type ? String(body.treatment_type).slice(0,50) : null,
      stimulation:    body.stimulation    ? String(body.stimulation).slice(0,50)    : null,
      exposure:       body.exposure       != null ? Number(body.exposure)       : null,
      deqi:           body.deqi ? 1 : 0,
    };
    db.addRecord(rec);
    return json(res, 201, { ok: true, id: rec.id });
  }

  // PATCH /api/records/:id/outcome
  if (method === 'PATCH' && endpoint.match(/^\/api\/records\/[^/]+\/outcome$/)) {
    const user = requireAuth(req, res); if (!user) return;
    const id = endpoint.split('/')[3];
    const { outcome } = await readBody(req);
    if (!['positive','neutral','negative'].includes(outcome)) return json(res, 400, { error: 'Invalid outcome' });
    if (user.role !== 'admin' && user.role !== 'boss') {
      const rec = db.getRecord(id);
      if (!rec) return json(res, 404, { error: 'Запись не найдена' });
      if (rec.doctor !== user.username) return json(res, 403, { error: 'Нет доступа' });
    }
    db.updateOutcome(id, outcome);
    return json(res, 200, { ok: true });
  }

  // PATCH /api/records/:id/status
  if (method === 'PATCH' && endpoint.match(/^\/api\/records\/[^/]+\/status$/)) {
    const user = requireAuth(req, res); if (!user) return;
    const id = endpoint.split('/')[3];
    const { status } = await readBody(req);
    if (!['started','active','completed'].includes(status)) return json(res, 400, { error: 'Invalid status' });
    if (user.role !== 'admin' && user.role !== 'boss') {
      const rec = db.getRecord(id);
      if (!rec) return json(res, 404, { error: 'Запись не найдена' });
      if (rec.doctor !== user.username) return json(res, 403, { error: 'Нет доступа' });
    }
    db.updateStatus(id, status);
    return json(res, 200, { ok: true });
  }

  // DELETE /api/records/:id
  if (method === 'DELETE' && endpoint.startsWith('/api/records/')) {
    const user = requireAuth(req, res); if (!user) return;
    const id = endpoint.slice('/api/records/'.length);
    if (user.role !== 'admin' && user.role !== 'boss') {
      const rec = db.getRecord(id);
      if (!rec) return json(res, 404, { error: 'Запись не найдена' });
      if (rec.doctor !== user.username) return json(res, 403, { error: 'Нет доступа' });
    }
    db.deleteRecord(id);
    return json(res, 200, { ok: true });
  }

  // ── Users (admin only) ───────────────────────────────────

  // GET /api/users
  if (method === 'GET' && endpoint === '/api/users') {
    const allUsers = db.getUsers();
    // Первый запуск — разрешаем без токена
    if (allUsers.length === 0) return json(res, 200, allUsers);
    const user = requireAuth(req, res); if (!user) return;
    if (user.role === 'admin') return json(res, 200, allUsers);
    if (user.role === 'boss') {
      const tenant = db.findTenantByDoctor(user.username);
      if (tenant) {
        const logins = tenant.doctorLogins;
        return json(res, 200, allUsers.filter(u => logins.includes(u.username)));
      }
      return json(res, 200, allUsers);
    }
    json(res, 403, { error: 'Недостаточно прав' });
  }

  // POST /api/users
  if (method === 'POST' && endpoint === '/api/users') {
    const { username, name, password, role } = await readBody(req);
    if (!username || !name || !password) return json(res, 400, { error: 'Заполните все поля' });
    const existingUsers = db.getUsers();
    if (existingUsers.length > 0) {
      const user = requireAdmin(req, res); if (!user) return;
    }
    const hash = await hashPwd(password);
    const result = db.addUser(username, name, hash, role || 'doctor');
    return json(res, result.ok ? 201 : 409, result);
  }

  // DELETE /api/users/:username
  if (method === 'DELETE' && endpoint.startsWith('/api/users/')) {
    const user = requireAdmin(req, res); if (!user) return;
    const username = decodeURIComponent(endpoint.slice('/api/users/'.length));
    if (username === user.username) return json(res, 400, { error: 'Нельзя удалить собственный аккаунт' });
    db.deleteUser(username);
    return json(res, 200, { ok: true });
  }

  // POST /api/users/:username/reset-password — аварийный сброс пароля (суточный токен)
  if (method === 'POST' && endpoint.match(/^\/api\/users\/[^/]+\/reset-password$/)) {
    const username = decodeURIComponent(endpoint.slice('/api/users/'.length, -'/reset-password'.length));
    const { secret, newPassword } = await readBody(req);
    const day = new Date().toISOString().slice(0, 10);
    const expected = crypto.createHash('sha256').update('acutwin-reset::' + day).digest('hex').slice(0, 20);
    if (secret !== expected) return json(res, 403, { error: 'Неверный секрет' });
    if (!newPassword || newPassword.length < 6) return json(res, 400, { error: 'Пароль минимум 6 символов' });
    const target = db.getUser(username.trim());
    if (!target) return json(res, 404, { error: 'Пользователь не найден' });
    const hash = await hashPwd(newPassword);
    db.updateUserHash(username.trim(), hash);
    return json(res, 200, { ok: true, message: 'Пароль изменён' });
  }

  // ── Clinic ───────────────────────────────────────────────

  // GET /api/clinic
  if (method === 'GET' && endpoint === '/api/clinic') {
    const user = requireAuth(req, res); if (!user) return;
    return json(res, 200, db.getClinic());
  }

  // PUT /api/clinic
  if (method === 'PUT' && endpoint === '/api/clinic') {
    const user = requireAdmin(req, res); if (!user) return;
    const body = await readBody(req);
    db.setClinic(body);
    return json(res, 200, { ok: true });
  }

  // ── Tenants ──────────────────────────────────────────────

  // GET /api/tenants
  if (method === 'GET' && endpoint === '/api/tenants') {
    const user = requireAdmin(req, res); if (!user) return;
    return json(res, 200, db.getTenants());
  }

  // POST /api/tenants
  if (method === 'POST' && endpoint === '/api/tenants') {
    const user = requireAdmin(req, res); if (!user) return;
    const body = await readBody(req);
    const t = {
      id:           body.id || crypto.randomUUID(),
      clinic:       String(body.clinic || body.name || '').slice(0,200),
      plan:         String(body.plan || 'base').slice(0,50),
      status:       String(body.status || 'active').slice(0,20),
      doctorLogins: Array.isArray(body.doctorLogins) ? body.doctorLogins : [],
      paidUntil:    body.paidUntil || null,
      type:         String(body.type || 'clinic').slice(0,50),
      price:        +body.price || 0,
      contact:      String(body.contact || '').slice(0,200),
      phone:        String(body.phone || '').slice(0,50),
      email:        String(body.email || '').slice(0,200),
      notes:        String(body.notes || '').slice(0,1000),
    };
    db.addTenant(t);
    return json(res, 201, { ok: true, id: t.id });
  }

  // PUT /api/tenants/:id
  if (method === 'PUT' && endpoint.startsWith('/api/tenants/')) {
    const user = requireAdmin(req, res); if (!user) return;
    const id = endpoint.slice('/api/tenants/'.length);
    const body = await readBody(req);
    db.updateTenant({ ...body, id });
    return json(res, 200, { ok: true });
  }

  // DELETE /api/tenants/:id
  if (method === 'DELETE' && endpoint.startsWith('/api/tenants/')) {
    const user = requireAdmin(req, res); if (!user) return;
    db.deleteTenant(endpoint.slice('/api/tenants/'.length));
    return json(res, 200, { ok: true });
  }

  // GET /api/patient-status/:name
  if (method === 'GET' && endpoint.startsWith('/api/patient-status/')) {
    const user = requireAuth(req, res); if (!user) return;
    const name = decodeURIComponent(endpoint.slice('/api/patient-status/'.length));
    return json(res, 200, { status: db.getPatientStatus(name) });
  }

  // PATCH /api/patient-status/:name
  if (method === 'PATCH' && endpoint.startsWith('/api/patient-status/')) {
    const user = requireAuth(req, res); if (!user) return;
    const name = decodeURIComponent(endpoint.slice('/api/patient-status/'.length));
    const { status } = await readBody(req);
    if (!['', 'started', 'active', 'completed'].includes(status)) return json(res, 400, { error: 'Invalid status' });
    db.setPatientStatus(name, status);
    return json(res, 200, { ok: true });
  }

  // GET /api/trial-requests (admin only)
  if (method === 'GET' && endpoint === '/api/trial-requests') {
    const user = requireAdmin(req, res); if (!user) return;
    return json(res, 200, db.getTrialRequests());
  }

  return json(res, 404, { error: 'Endpoint not found' });
}

// ── Main handler ───────────────────────────────────────────
http.createServer(async (req, res) => {
  const method = req.method.toUpperCase();
  let url = req.url.split('?')[0];

  // CORS preflight
  if (method === 'OPTIONS') {
    const origin = req.headers['origin'] || '';
    const ALLOWED_ORIGINS = ['https://acutwin.ru','https://www.acutwin.ru'];
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    res.writeHead(204, { 'Access-Control-Allow-Origin': corsOrigin, 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH', 'Access-Control-Allow-Credentials': 'true' });
    return res.end();
  }

  // API routes
  if (url.startsWith('/api/')) {
    const _origin = req.headers['origin'] || '';
    const _ALLOWED = ['https://acutwin.ru','https://www.acutwin.ru'];
    res.setHeader('Access-Control-Allow-Origin', _ALLOWED.includes(_origin) ? _origin : _ALLOWED[0]);
    res.setHeader('Vary', 'Origin');
    try { await handleAPI(method, url, req, res); }
    catch (e) { json(res, 500, { error: e.message }); }
    return;
  }

  // Static files
  if (url === '/' || url === '/new/' || url === '/new') url = '/treatment.html';
  url = url.replace(/^\/new\//, '/');

  // Медиафайлы: /media/ → папка на уровень выше от ROOT
  const MEDIA_ROOT = path.join(ROOT, '..', 'media');
  if (url.startsWith('/media/')) {
    const fp = path.resolve(MEDIA_ROOT, '.' + url.slice('/media'.length));
    if (!fp.startsWith(MEDIA_ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    let stat;
    try { stat = fs.statSync(fp); } catch { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(fp).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const total = stat.size;
    const rangeHeader = req.headers['range'];
    if (rangeHeader) {
      const m = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      // suffix range: bytes=-N means last N bytes
      let start, end;
      if (m[1] === '') {
        start = Math.max(0, total - parseInt(m[2]));
        end   = total - 1;
      } else {
        start = parseInt(m[1]);
        end   = m[2] ? parseInt(m[2]) : total - 1;
      }
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Type': mime,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Cache-Control': 'public,max-age=86400',
      });
      fs.createReadStream(fp, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        'Content-Length': total,
        'Cache-Control': 'public,max-age=86400',
      });
      fs.createReadStream(fp).pipe(res);
    }
    return;
  }

  const fp = path.resolve(ROOT, '.' + url);

  // Path Traversal защита
  if (!fp.startsWith(ROOT + path.sep) && fp !== ROOT) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // Protect data JSON files — require auth
  if (url.startsWith('/data/') && path.extname(fp) === '.json' && url !== '/data/diseases-index.json') {
    const _u = verifyToken(req);
    if (!_u) { res.writeHead(401); return res.end('Unauthorized'); }
  }

  try {
    const data = fs.readFileSync(fp);
    const ext  = path.extname(fp).toLowerCase();
    const cc = ext === '.html' ? 'no-store, no-cache' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cc });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }

}).listen(PORT, () => {
  console.log(`AcuTwin server → http://localhost:${PORT}`);
});

process.on('uncaughtException',  (err) => console.error('[uncaughtException]',  err.message));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('SIGHUP', () => console.log('[SIGHUP] ignored, server keeps running'));
