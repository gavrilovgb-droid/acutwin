const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const QRCode  = require('qrcode');
const db      = require('./db');

// Load .env if exists (production env vars)
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0) { const k = line.slice(0, eq).trim(); if (!process.env[k]) process.env[k] = line.slice(eq + 1).trim(); }
  });
} catch {}

const {
  sendPatientTg, registerPatientTgWebhook,
  sendTgNotify, sendTgBookingNotify,
  PATIENT_TG_TOKEN, PATIENT_TG_BOT_NAME,
} = require('./tg');
const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID   || '';

async function sendCredentialsMail(to, login, password) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9f9f9;border-radius:12px">
      <h2 style="color:#0a0a0a;margin-bottom:8px">Добро пожаловать в AcuTwin</h2>
      <p style="color:#555;margin-bottom:24px">Ваш пробный доступ активирован. Войдите по ссылке ниже:</p>
      <a href="https://acutwin.ru" style="display:inline-block;background:#00c2cc;color:#000;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:28px">Открыть AcuTwin</a>
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:20px">
        <div style="margin-bottom:12px">
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Логин</div>
          <div style="font-family:monospace;font-size:20px;font-weight:700;color:#0a0a0a">${login}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Пароль</div>
          <div style="font-family:monospace;font-size:20px;font-weight:700;color:#0a0a0a">${password}</div>
        </div>
      </div>
      <p style="font-size:12px;color:#999">Если вы не запрашивали доступ — просто проигнорируйте это письмо.</p>
    </div>`;

  const body = JSON.stringify({
    from:    'AcuTwin <info@acutwin.ru>',
    to,
    subject: 'Ваши данные для входа в AcuTwin',
    html,
  });

  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`Resend ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Email-напоминания за день до приёма ───────────────────
async function sendReminderEmail(appt, clinicName) {
  if (!process.env.RESEND_API_KEY) return;
  const dt = new Date(appt.start_at.replace(' ','T'));
  const dateStr = dt.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f9f9;border-radius:12px;color:#111">
      <h2 style="color:#0a0a0a;margin:0 0 14px">Напоминание о приёме</h2>
      <p style="color:#444;margin:0 0 24px;font-size:15px;line-height:1.5">Здравствуйте, ${escapeHtml(appt.patient)}!<br>Напоминаем о вашей записи на приём.</p>
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:10px;padding:18px;margin-bottom:18px">
        <div style="margin-bottom:10px"><span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Врач</span><br><span style="font-size:17px;font-weight:700">${escapeHtml(appt.doctorName)}</span></div>
        ${clinicName ? `<div style="margin-bottom:10px"><span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Клиника</span><br><span style="font-size:15px">${escapeHtml(clinicName)}</span></div>` : ''}
        <div style="margin-bottom:10px"><span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Когда</span><br><span style="font-size:16px;font-weight:600">${escapeHtml(dateStr)} в ${escapeHtml(timeStr)}</span></div>
        ${appt.notes ? `<div><span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Жалобы</span><br><span style="font-size:14px">${escapeHtml(appt.notes)}</span></div>` : ''}
      </div>
      <p style="font-size:13px;color:#666;line-height:1.5">Если не сможете прийти — свяжитесь с врачом${appt.patient_phone ? ' или клиникой' : ''} заранее, чтобы освободить место для других пациентов.</p>
      <p style="font-size:11px;color:#999;margin-top:24px">Это автоматическое напоминание от платформы <a href="https://acutwin.ru" style="color:#0A84FF;text-decoration:none">AcuTwin</a></p>
    </div>`;
  const body = JSON.stringify({
    from: 'AcuTwin <info@acutwin.ru>',
    to: appt.patient_email,
    subject: `Напоминание: завтра приём у ${appt.doctorName} в ${timeStr}`,
    html
  });
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`Resend ${res.statusCode}: ${data}`));
      });
    });
    r.on('error', reject);
    r.write(body); r.end();
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function normalizeUrl(s, maxLen) {
  let v = String(s || '').trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  return v.slice(0, maxLen);
}

const fmtLocal = d => {
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

async function runDailyReminders() {
  // Email: за день до приёма (окно: завтра 00:00 – послезавтра 00:00)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0);
  const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate()+1);
  const list = db.getAppointmentsForReminder(fmtLocal(tomorrow), fmtLocal(dayAfter));
  console.log(`[Reminders] email tomorrow: ${list.length} pending`);
  for (const a of list) {
    try {
      const tenant = db.findTenantByDoctor(a.doctor);
      await sendReminderEmail(a, tenant ? tenant.clinic : '');
      db.markReminderSent(a.id);
      console.log(`[Reminders] email sent: ${a.patient} <${a.patient_email}>`);
    } catch (e) { console.error(`[Reminders] email fail ${a.id}: ${e.message}`); }
  }

  // Telegram за 24ч: те же записи завтра, у которых есть tg_chat_id
  if (PATIENT_TG_TOKEN) {
    const tgList = db.getApptsForTgRemind24h(fmtLocal(tomorrow), fmtLocal(dayAfter));
    console.log(`[Reminders] tg 24h: ${tgList.length} pending`);
    for (const a of tgList) {
      try {
        const d = new Date(a.start_at.replace(' ', 'T'));
        const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const dateStr = d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
        await sendPatientTg(a.tg_chat_id,
          `🔔 <b>Напоминание о приёме</b>\n\n` +
          `Завтра, ${dateStr} в <b>${timeStr}</b>\n` +
          `Врач: ${a.doctorName}\n` +
          (a.service ? `Услуга: ${a.service}\n` : '') +
          `\nЕсли не можете прийти — сообщите врачу заранее.`
        );
        db.markReminderSent(a.id); // тот же флаг — чтобы не дублировать
        console.log(`[Reminders] tg 24h sent: ${a.patient} chat=${a.tg_chat_id}`);
      } catch (e) { console.error(`[Reminders] tg 24h fail ${a.id}: ${e.message}`); }
    }
  }
}

// За 1 час до приёма — Telegram
async function runHourlyTgReminders() {
  if (!PATIENT_TG_TOKEN) return;
  const now = new Date();
  const in1h = new Date(now.getTime() + 60*60*1000);
  const in1h10 = new Date(now.getTime() + 70*60*1000); // окно 10 минут
  const list = db.getApptsForTgRemind1h(fmtLocal(in1h), fmtLocal(in1h10));
  for (const a of list) {
    try {
      const d = new Date(a.start_at.replace(' ','T'));
      const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      await sendPatientTg(a.tg_chat_id,
        `⏰ <b>Приём через 1 час</b>\n\n` +
        `Сегодня в <b>${timeStr}</b> — приём у ${a.doctorName}.\n` +
        `Не забудьте прийти вовремя!`
      );
      db.markTgRemind1h(a.id);
      console.log(`[Reminders] tg 1h sent: ${a.patient}`);
    } catch (e) { console.error(`[Reminders] tg 1h fail ${a.id}: ${e.message}`); }
  }
}

// Планировщик: каждую минуту проверяем
let _reminderLastRun = null;
function scheduleReminders() {
  setInterval(() => {
    const now = new Date();
    const stamp = now.toISOString().slice(0,10);
    // Ежедневно в 10:00 — email + tg за 24ч
    if (now.getHours() === 10 && now.getMinutes() < 5 && _reminderLastRun !== stamp) {
      _reminderLastRun = stamp;
      runDailyReminders().catch(e => console.error('[Reminders] crash:', e.message));
    }
    // Каждую минуту — tg за 1ч
    runHourlyTgReminders().catch(e => console.error('[Reminders] 1h crash:', e.message));
  }, 60_000);
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
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf':  'application/pdf',
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

// ── Trial status helper ────────────────────────────────────────────
function getUserTrialStatus(user) {
  if (user.role === 'admin' || user.role === 'boss') return { status: 'admin', blocked: false, grace: false };
  const tenant = db.findTenantByDoctor(user.username);
  return db.getTrialStatus(tenant);
}

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

// ── Антиспам для публичных эндпоинтов ───────────────────
const _publicRateMap = {};
function checkPublicRate(ip, limit=5, windowMs=60_000) {
  const now = Date.now();
  const r = _publicRateMap[ip] || { count: 0, window: now };
  if (now - r.window > windowMs) { r.count = 0; r.window = now; }
  r.count++;
  _publicRateMap[ip] = r;
  return r.count > limit;
}

// ── API Router ─────────────────────────────────────────────
async function handleAPI(method, endpoint, req, res) {

  // ── Public booking ──────────────────────────────────────

  // GET /api/public/doctor/:slug|:username — публичная информация о враче (по slug или login)
  if (method === 'GET' && endpoint.match(/^\/api\/public\/doctor\/[^/]+$/)) {
    const id = decodeURIComponent(endpoint.split('/')[4]);
    let u = db.getUserBySlug(id) || db.getUser(id);
    if (!u || u.role !== 'doctor') return json(res, 404, { error: 'Врач не найден' });
    const tenant = db.findTenantByDoctor(u.username);
    return json(res, 200, {
      username: u.username,
      slug: u.slug,
      name: u.name,
      specialty: u.specialty || null,
      photo: u.photo || null,
      bio: u.bio || null,
      price_default: u.price_default || null,
      clinic: tenant ? { slug: tenant.slug, name: tenant.clinic, address: tenant.address, phone: tenant.tenant_phone, logo: tenant.logo } : null
    });
  }

  // GET /api/public/clinic/:slug — публичная информация о клинике + список врачей
  if (method === 'GET' && endpoint.match(/^\/api\/public\/clinic\/[^/]+$/)) {
    const slug = decodeURIComponent(endpoint.split('/')[4]);
    const t = db.getTenantBySlug(slug);
    if (!t) return json(res, 404, { error: 'Клиника не найдена' });
    const doctors = (t.doctorLogins || []).map(login => {
      const u = db.getUser(login);
      if (!u || u.role !== 'doctor') return null;
      return {
        username: u.username, slug: u.slug, name: u.name,
        specialty: u.specialty || null, photo: u.photo || null,
        bio: u.bio || null, price_default: u.price_default || null,
      };
    }).filter(Boolean);
    return json(res, 200, {
      slug: t.slug,
      name: t.clinic,
      address: t.address || null,
      phone: t.tenant_phone || null,
      website: t.website || null,
      logo: t.logo || null,
      doctors,
    });
  }

  // GET /api/public/slots?doctor=USER&from=ISO&to=ISO
  if (method === 'GET' && endpoint.startsWith('/api/public/slots')) {
    const qs = req.url.split('?')[1] || '';
    const params = new URLSearchParams(qs);
    const doctor = params.get('doctor');
    const from   = params.get('from');
    const to     = params.get('to');
    if (!doctor || !from || !to) return json(res, 400, { error: 'doctor/from/to required' });
    const u = db.getUserBySlug(doctor) || db.getUser(doctor);
    if (!u || u.role !== 'doctor') return json(res, 404, { error: 'Врач не найден' });
    // Только занятые интервалы, без персданных
    const appts = db.getAppointmentsDoctor(u.username, from, to)
      .filter(a => a.status !== 'cancelled')
      .map(a => ({ start_at: a.start_at, duration_min: a.duration_min }));
    return json(res, 200, appts);
  }

  // POST /api/public/book — заявка на приём
  if (method === 'POST' && endpoint === '/api/public/book') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (checkPublicRate(ip, 5, 60_000)) return json(res, 429, { error: 'Слишком частые запросы. Подождите минуту.' });
    const body = await readBody(req);
    const { doctor, start_at, duration_min, patient, patient_phone, patient_email, reason, utm_source, utm_medium } = body;
    if (!doctor || !start_at || !patient || !patient_phone) return json(res, 400, { error: 'Заполните ФИО, телефон и выберите время' });
    if (String(patient).trim().length < 3) return json(res, 400, { error: 'Введите ФИО полностью' });
    if (String(patient_phone).trim().length < 6) return json(res, 400, { error: 'Некорректный телефон' });
    const u = db.getUserBySlug(doctor) || db.getUser(doctor);
    if (!u || u.role !== 'doctor') return json(res, 404, { error: 'Врач не найден' });
    const dur = Math.max(15, Math.min(240, parseInt(duration_min) || 60));
    const conflict = db.findApptConflict(u.username, start_at, dur);
    if (conflict) return json(res, 409, { error: 'Это время только что заняли. Выберите другое.' });
    const id = crypto.randomUUID();
    const apptData = {
      id, doctor: u.username, doctorName: u.name,
      patient: String(patient).slice(0,200).trim(),
      patient_phone: String(patient_phone).slice(0,30).trim(),
      patient_email: patient_email ? String(patient_email).slice(0,100).trim() : null,
      patient_telegram: null,
      start_at,
      duration_min: dur,
      service: null, price: null,
      notes: reason ? String(reason).slice(0,500).trim() : null,
      status: 'pending',
      created_by: 'public',
      utm_source: utm_source ? String(utm_source).slice(0,100) : null,
      utm_medium: utm_medium ? String(utm_medium).slice(0,100) : null,
    };
    try {
      db.addAppointment(apptData);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return json(res, 409, { error: 'Это время только что заняли. Выберите другое.' });
      throw e;
    }
    const tenant = db.findTenantByDoctor(u.username);
    sendTgBookingNotify(apptData, u.name, tenant ? tenant.clinic : '');
    return json(res, 201, { ok: true, id });
  }

  // POST /api/trial-request
  if (method === 'POST' && endpoint === '/api/trial-request') {
    const { method: contactMethod, contact, email } = await readBody(req);
    const VALID_METHODS = ['telegram', 'max', 'phone', 'card', 'email'];
    if (!contact || !contact.trim())
      return json(res, 400, { error: 'Некорректные данные' });
    if (!email || !email.trim() || !email.includes('@'))
      return json(res, 400, { error: 'Укажите email' });
    const safeMethod = VALID_METHODS.includes(contactMethod) ? contactMethod : 'email';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    try {
      db.addTrialRequest(safeMethod, contact.trim(), ip, email.trim());
      sendTgNotify(safeMethod, contact.trim(), ip, email.trim());
      return json(res, 200, { ok: true });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return json(res, 409, { error: 'Дубликат' });
      return json(res, 500, { error: 'Ошибка сервера' });
    }
  }

  // POST /api/send-credentials
  if (method === 'POST' && endpoint === '/api/send-credentials') {
    const user = requireAdmin(req, res); if (!user) return;
    const { email, login, password } = await readBody(req);
    if (!email || !login || !password) return json(res, 400, { error: 'Нет данных' });
    try {
      await sendCredentialsMail(email, login, password);
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error('[mail error]', e.message);
      return json(res, 500, { error: 'Не удалось отправить письмо: ' + e.message });
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
      const today = new Date().toISOString().slice(0, 10);
      if (tenant.paidUntil && tenant.paidUntil < today) {
        db.updateTenant({ ...tenant, status: 'expired' });
        return json(res, 403, { error: 'Срок пробного доступа истёк.' });
      }
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

  // GET /api/health — алиас /api/status для мониторинга (UptimeRobot)
  if (method === 'GET' && endpoint === '/api/health') {
    return json(res, 200, { status: 'ok', hasUsers: db.getUsers().length > 0 });
  }

  // GET /api/me
  if (method === 'GET' && endpoint === '/api/me') {
    const user = requireAuth(req, res); if (!user) return;
    return json(res, 200, { username: user.username, name: user.name, role: user.role });
  }

  // GET /api/trial-status — статус trial для текущего пользователя
  if (method === 'GET' && endpoint === '/api/trial-status') {
    const user = requireAuth(req, res); if (!user) return;
    const ts = getUserTrialStatus(user);
    const tenant = (user.role !== 'admin' && user.role !== 'boss') ? db.findTenantByDoctor(user.username) : null;
    return json(res, 200, {
      ...ts,
      plan: tenant ? (tenant.plan || 'demo') : (user.role === 'admin' || user.role === 'boss' ? user.role : 'demo'),
      trialStart: tenant?.trial_start || null,
      trialWeeks: tenant?.trial_weeks || null,
    });
  }

  // ── Billing (admin only) ─────────────────────────────────

  // GET /api/billing/tenants
  if (method === 'GET' && endpoint === '/api/billing/tenants') {
    const user = requireAuth(req, res); if (!user) return;
    if (user.role !== 'admin' && user.role !== 'boss') return json(res, 403, { error: 'forbidden' });
    const tenants = db.getTenants();
    return json(res, 200, tenants.map(t => ({ ...t, trialStatus: db.getTrialStatus(t) })));
  }

  // PATCH /api/billing/tenants/:id
  if (method === 'PATCH' && endpoint.startsWith('/api/billing/tenants/')) {
    const user = requireAuth(req, res); if (!user) return;
    if (user.role !== 'admin' && user.role !== 'boss') return json(res, 403, { error: 'forbidden' });
    const id = endpoint.split('/').pop();
    const body = await readBody(req);
    const { action, weeks, plan } = body;
    if (action === 'activate_trial') {
      if (!weeks || weeks < 1 || weeks > 4) return json(res, 400, { error: 'weeks must be 1-4' });
      const today = new Date().toISOString().slice(0, 10);
      const trialEnd = db.setTenantTrial(id, today, weeks);
      return json(res, 200, { ok: true, trialEnd });
    }
    if (action === 'extend_trial') {
      if (!weeks || weeks < 1 || weeks > 4) return json(res, 400, { error: 'weeks must be 1-4' });
      const newEnd = db.extendTenantTrial(id, weeks);
      return json(res, 200, { ok: true, trialEnd: newEnd });
    }
    if (action === 'set_plan') {
      const allowed = ['demo', 'trial', 'practik', 'clinic_s', 'clinic_m', 'clinic_pro'];
      if (!allowed.includes(plan)) return json(res, 400, { error: 'invalid plan' });
      if (plan === 'trial') {
        if (!weeks || weeks < 1 || weeks > 4) return json(res, 400, { error: 'weeks required for trial' });
        const today = new Date().toISOString().slice(0, 10);
        const trialEnd = db.setTenantTrial(id, today, weeks);
        return json(res, 200, { ok: true, trialEnd });
      }
      db.setTenantPlan(id, plan);
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: 'unknown action' });
  }

  // ── Clinic Stats (manager/admin) ──────────────────────────

  // GET /api/clinic-stats?weeks=1|2|3|4
  if (method === 'GET' && endpoint === '/api/clinic-stats') {
    const user = requireAuth(req, res); if (!user) return;
    const qs = new URLSearchParams(req.url.split('?')[1] || '');
    const weeks = Math.min(4, Math.max(1, parseInt(qs.get('weeks') || '1', 10)));
    const fromDate = new Date();
    fromDate.setUTCDate(fromDate.getUTCDate() - weeks * 7);
    const fromISO = fromDate.toISOString().slice(0, 10) + ' 00:00:00';

    let tenantId;
    if (user.role === 'admin' || user.role === 'boss') {
      tenantId = qs.get('tenant') || null;
    } else if (user.role === 'manager') {
      const tenant = db.findTenantByDoctor(user.username);
      tenantId = tenant ? tenant.id : null;
    } else {
      return json(res, 403, { error: 'forbidden' });
    }

    const tenants = tenantId
      ? [db.getTenant(tenantId)].filter(Boolean)
      : db.getTenants();

    const result = tenants.map(t => {
      const logins = t.doctorLogins || [];
      const doctors = db.getClinicStats(logins, fromISO);
      const trialStatus = db.getTrialStatus(t);
      return {
        tenantId: t.id, tenantName: t.clinic, plan: t.plan, trialStatus,
        period: { weeks, from: fromISO.slice(0, 10) },
        doctors,
        totals: {
          recordCount: doctors.reduce((s, d) => s + d.recordCount, 0),
          apptCount: doctors.reduce((s, d) => s + d.apptCount, 0),
        },
      };
    });
    return json(res, 200, result);
  }

  // ── Records ─────────────────────────────────────────────

  // GET /api/records
  if (method === 'GET' && endpoint.split('?')[0] === '/api/records') {
    const user = requireAuth(req, res); if (!user) return;
    const qs = new URLSearchParams(endpoint.split('?')[1] || '');
    const qDoctor  = qs.get('doctor')  || '';
    const qPatient = qs.get('patient') || '';
    const qFrom    = qs.get('from')    || '';
    const qTo      = qs.get('to')      || '';
    const qStatus  = qs.get('status')  || '';
    const qSort    = qs.get('sort')    || 'desc';
    let records;
    if (user.role === 'admin') records = db.getRecords();
    else if (user.role === 'boss') {
      const tenant = db.findTenantByDoctor(user.username);
      records = tenant ? db.getRecordsByLogins(tenant.doctorLogins) : [];
    } else {
      records = db.getMyRecords(user.username);
    }
    if (qDoctor)  records = records.filter(r => r.doctor  === qDoctor);
    if (qPatient) records = records.filter(r => r.patient === qPatient);
    if (qFrom)    records = records.filter(r => r.date >= qFrom);
    if (qTo)      records = records.filter(r => r.date <= qTo);
    if (qStatus)  records = records.filter(r => r.status  === qStatus);
    if (qSort === 'asc') records = records.slice().reverse();
    return json(res, 200, records);
  }

  // POST /api/records
  if (method === 'POST' && endpoint === '/api/records') {
    const user = requireAuth(req, res); if (!user) return;
    const _tenantPlan = db.findTenantByDoctor(user.username)?.plan;
    if (_tenantPlan !== 'demo' && checkRecordRate(user.username)) return json(res, 429, { error: 'Слишком много запросов. Подождите минуту.' });
    const body = await readBody(req);
    const ts = getUserTrialStatus(user);
    if (ts.blocked) return json(res, 402, { error: 'trial_expired' });
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
      progress:       body.progress != null ? Number(body.progress) : null,
      soap_s:         body.soap_s ? String(body.soap_s).slice(0,2000) : null,
      soap_o:         body.soap_o ? String(body.soap_o).slice(0,2000) : null,
      soap_a:         body.soap_a ? String(body.soap_a).slice(0,2000) : null,
      soap_p:         body.soap_p ? String(body.soap_p).slice(0,2000) : null,
    };
    db.addRecord(rec);
    // Связь с записью расписания: автозавершение приёма
    if (body.appointmentId) {
      try {
        const appt = db.getAppointment(String(body.appointmentId));
        if (appt && (user.role === 'admin' || user.role === 'boss' || appt.doctor === user.username)) {
          db.linkAppointmentRecord(appt.id, rec.id);
        }
      } catch (e) {}
    }
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

  // ── Appointments ────────────────────────────────────────

  // GET /api/appointments?from=ISO&to=ISO[&doctor=username]
  if (method === 'GET' && endpoint.startsWith('/api/appointments') && !endpoint.match(/^\/api\/appointments\/[^/]+/)) {
    const user = requireAuth(req, res); if (!user) return;
    const qs = (req.url.split('?')[1] || '');
    const params = new URLSearchParams(qs);
    const from = params.get('from');
    const to   = params.get('to');
    const filterDoctor = params.get('doctor');
    if (!from || !to) return json(res, 400, { error: 'from/to required (ISO)' });
    let rows;
    if (user.role === 'admin') {
      rows = filterDoctor ? db.getAppointmentsDoctor(filterDoctor, from, to) : db.getAppointmentsRange(from, to);
    } else if (user.role === 'boss') {
      const tenant = db.findTenantByDoctor(user.username);
      const logins = tenant ? tenant.doctorLogins : [user.username];
      if (filterDoctor && logins.includes(filterDoctor)) {
        rows = db.getAppointmentsDoctor(filterDoctor, from, to);
      } else {
        rows = db.getAppointmentsRange(from, to).filter(a => logins.includes(a.doctor));
      }
    } else {
      rows = db.getAppointmentsDoctor(user.username, from, to);
    }
    return json(res, 200, rows);
  }

  // POST /api/appointments
  if (method === 'POST' && endpoint === '/api/appointments') {
    const user = requireAuth(req, res); if (!user) return;
    const body = await readBody(req);
    if (!body.patient || !body.start_at) return json(res, 400, { error: 'patient и start_at обязательны' });
    const doctorUsername = (user.role === 'admin' || user.role === 'boss') && body.doctor ? body.doctor : user.username;
    const doctorName = body.doctorName || user.name;
    const duration = Math.max(15, Math.min(240, parseInt(body.duration_min) || 60));
    const conflict = db.findApptConflict(doctorUsername, body.start_at, duration);
    if (conflict) return json(res, 409, { error: 'Время занято другим приёмом' });
    const id = body.id || crypto.randomUUID();
    try {
      db.addAppointment({
        id, doctor: doctorUsername, doctorName,
        patient: String(body.patient).slice(0,200),
        patient_phone: body.patient_phone ? String(body.patient_phone).slice(0,30) : null,
        patient_email: body.patient_email ? String(body.patient_email).slice(0,100) : null,
        patient_telegram: body.patient_telegram ? String(body.patient_telegram).slice(0,50) : null,
        start_at: body.start_at,
        duration_min: duration,
        service: body.service ? String(body.service).slice(0,100) : null,
        price: body.price != null ? Number(body.price) : null,
        notes: body.notes ? String(body.notes).slice(0,1000) : null,
        status: body.status || 'scheduled',
        created_by: user.username
      });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE constraint')) {
        return json(res, 409, { error: 'SLOT_TAKEN' });
      }
      throw e;
    }
    return json(res, 201, { ok: true, id });
  }

  // PUT /api/appointments/:id
  if (method === 'PUT' && endpoint.match(/^\/api\/appointments\/[^/]+$/)) {
    const user = requireAuth(req, res); if (!user) return;
    const id = endpoint.split('/')[3];
    const cur = db.getAppointment(id);
    if (!cur) return json(res, 404, { error: 'Запись не найдена' });
    if (user.role !== 'admin' && user.role !== 'boss' && cur.doctor !== user.username) return json(res, 403, { error: 'Нет доступа' });
    const body = await readBody(req);
    const doctorUsername = (user.role === 'admin' || user.role === 'boss') && body.doctor ? body.doctor : cur.doctor;
    const doctorName = body.doctorName || cur.doctorName;
    const duration = Math.max(15, Math.min(240, parseInt(body.duration_min) || cur.duration_min));
    const startAt = body.start_at || cur.start_at;
    const conflict = db.findApptConflict(doctorUsername, startAt, duration, id);
    if (conflict) return json(res, 409, { error: 'Время занято другим приёмом' });
    db.updateAppointment({
      id, doctor: doctorUsername, doctorName,
      patient: body.patient != null ? String(body.patient).slice(0,200) : cur.patient,
      patient_phone: body.patient_phone != null ? String(body.patient_phone).slice(0,30) : cur.patient_phone,
      patient_email: body.patient_email != null ? String(body.patient_email).slice(0,100) : cur.patient_email,
      patient_telegram: body.patient_telegram != null ? String(body.patient_telegram).slice(0,50) : cur.patient_telegram,
      start_at: startAt,
      duration_min: duration,
      service: body.service != null ? String(body.service).slice(0,100) : cur.service,
      price: body.price !== undefined ? (body.price != null ? Number(body.price) : null) : cur.price,
      notes: body.notes != null ? String(body.notes).slice(0,1000) : cur.notes,
      status: body.status || cur.status
    });
    return json(res, 200, { ok: true });
  }

  // PATCH /api/appointments/:id/status
  if (method === 'PATCH' && endpoint.match(/^\/api\/appointments\/[^/]+\/status$/)) {
    const user = requireAuth(req, res); if (!user) return;
    const id = endpoint.split('/')[3];
    const { status } = await readBody(req);
    if (!['scheduled','pending','done','cancelled'].includes(status)) return json(res, 400, { error: 'Invalid status' });
    const cur = db.getAppointment(id);
    if (!cur) return json(res, 404, { error: 'Не найдено' });
    if (user.role !== 'admin' && user.role !== 'boss' && cur.doctor !== user.username) return json(res, 403, { error: 'Нет доступа' });
    db.setAppointmentStatus(id, status);
    return json(res, 200, { ok: true });
  }

  // DELETE /api/appointments/:id
  if (method === 'DELETE' && endpoint.match(/^\/api\/appointments\/[^/]+$/)) {
    const user = requireAuth(req, res); if (!user) return;
    const id = endpoint.split('/')[3];
    const cur = db.getAppointment(id);
    if (!cur) return json(res, 404, { error: 'Не найдено' });
    if (user.role !== 'admin' && user.role !== 'boss' && cur.doctor !== user.username) return json(res, 403, { error: 'Нет доступа' });
    db.deleteAppointment(id);
    return json(res, 200, { ok: true });
  }

  // ── Profile ─────────────────────────────────────────────

  // GET /api/profile — мой профиль + моя клиника
  if (method === 'GET' && endpoint === '/api/profile') {
    const user = requireAuth(req, res); if (!user) return;
    const u = db.getUser(user.username);
    if (!u) return json(res, 404, { error: 'Пользователь не найден' });
    const tenant = db.findTenantByDoctor(user.username);
    const canEditClinic = user.role === 'admin' || user.role === 'boss';
    return json(res, 200, {
      doctor: {
        username: u.username, name: u.name, role: u.role,
        slug: u.slug, specialty: u.specialty, photo: u.photo, bio: u.bio,
        price_default: u.price_default,
      },
      clinic: tenant ? {
        id: tenant.id, name: tenant.clinic, slug: tenant.slug,
        address: tenant.address, phone: tenant.tenant_phone,
        website: tenant.website, logo: tenant.logo,
        canEdit: canEditClinic,
      } : null,
    });
  }

  // PUT /api/profile/doctor
  if (method === 'PUT' && endpoint === '/api/profile/doctor') {
    const user = requireAuth(req, res); if (!user) return;
    const body = await readBody(req);
    const slug = body.slug ? String(body.slug).trim().toLowerCase() : null;
    if (slug && !/^[a-z0-9-]{2,60}$/.test(slug)) return json(res, 400, { error: 'Slug: только латиница, цифры, дефис (2–60 символов)' });
    if (slug && db.isUserSlugTaken(slug, user.username)) return json(res, 409, { error: 'Этот slug уже занят' });
    db.updateUserProfile(user.username, {
      slug,
      specialty: body.specialty ? String(body.specialty).slice(0,100) : null,
      photo:     body.photo     ? normalizeUrl(body.photo, 500) : null,
      bio:       body.bio       ? String(body.bio).slice(0,2000)      : null,
      price_default: body.price_default != null && body.price_default !== '' ? Math.max(0, Math.min(1000000, Number(body.price_default))) : null,
    });
    return json(res, 200, { ok: true });
  }

  // PUT /api/profile/clinic
  if (method === 'PUT' && endpoint === '/api/profile/clinic') {
    const user = requireAuth(req, res); if (!user) return;
    if (user.role !== 'admin' && user.role !== 'boss') return json(res, 403, { error: 'Только админ или руководитель клиники' });
    const tenant = db.findTenantByDoctor(user.username);
    if (!tenant && user.role !== 'admin') return json(res, 404, { error: 'Клиника не найдена' });
    const body = await readBody(req);
    const targetId = user.role === 'admin' && body.id ? body.id : (tenant ? tenant.id : null);
    if (!targetId) return json(res, 400, { error: 'Не указана клиника' });
    const slug = body.slug ? String(body.slug).trim().toLowerCase() : null;
    if (slug && !/^[a-z0-9-]{2,60}$/.test(slug)) return json(res, 400, { error: 'Slug: только латиница, цифры, дефис (2–60 символов)' });
    if (slug && db.isTenantSlugTaken(slug, targetId)) return json(res, 409, { error: 'Этот slug уже занят' });
    db.updateTenantProfile(targetId, {
      slug,
      address:      body.address      ? String(body.address).slice(0,300)      : null,
      tenant_phone: body.tenant_phone ? String(body.tenant_phone).slice(0,50)  : null,
      website:      body.website      ? normalizeUrl(body.website, 200) : null,
      logo:         body.logo         ? normalizeUrl(body.logo, 500) : null,
    });
    return json(res, 200, { ok: true });
  }

  // POST /api/appointments/run-reminders — ручной запуск рассылки (admin)
  if (method === 'POST' && endpoint === '/api/appointments/run-reminders') {
    const user = requireAdmin(req, res); if (!user) return;
    runDailyReminders().catch(e => console.error('[Reminders] manual crash:', e.message));
    return json(res, 200, { ok: true, msg: 'Запущено в фоне, смотри логи' });
  }

  // GET /api/public/tg-bot-name — имя бота для пациентов (публичный)
  if (method === 'GET' && endpoint === '/api/public/tg-bot-name') {
    return json(res, 200, { bot_name: PATIENT_TG_BOT_NAME || null });
  }

  // GET /api/qr?slug=<doctor-slug> — QR-код для виджета записи (WGT-07)
  if (method === 'GET' && endpoint.startsWith('/api/qr')) {
    const qrQs = new URLSearchParams(req.url.split('?')[1] || '');
    const slug = qrQs.get('slug');
    if (!slug) return json(res, 400, { error: 'slug required' });
    const bookUrl = 'https://acutwin.ru/book.html?doctor=' + encodeURIComponent(slug);
    try {
      const png = await QRCode.toBuffer(bookUrl, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      return res.end(png);
    } catch (e) {
      return json(res, 500, { error: 'QR generation failed' });
    }
  }

  // POST /api/public/appt-tg-token — генерация deep-link токена для записи (публичный)
  if (method === 'POST' && endpoint === '/api/public/appt-tg-token') {
    const body = await readBody(req);
    const { appt_id } = body;
    if (!appt_id) return json(res, 400, { error: 'appt_id required' });
    const appt = db.getAppointment(appt_id);
    if (!appt) return json(res, 404, { error: 'Not found' });
    const token = crypto.randomBytes(12).toString('hex');
    db.setApptTgToken(appt_id, token);
    return json(res, 200, { token });
  }

  // POST /tg-patient — webhook от Telegram (бот для пациентов)
  if (method === 'POST' && endpoint === '/tg-patient') {
    const update = await readBody(req);
    res.writeHead(200); res.end('ok');
    try {
      const msg = update.message;
      if (!msg || !msg.text) return;
      const chatId = String(msg.chat.id);
      const text = msg.text.trim();
      if (text.startsWith('/start')) {
        const token = text.split(' ')[1] || '';
        if (token) {
          const appt = db.getApptByTgToken(token);
          if (appt) {
            db.linkPatientTelegram(token, chatId);
            const d = new Date(appt.start_at.replace(' ','T'));
            const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            const dateStr = d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
            await sendPatientTg(chatId,
              `✅ <b>Напоминания подключены!</b>\n\n` +
              `Ваш приём: ${dateStr} в <b>${timeStr}</b>\n` +
              `Врач: ${appt.doctorName}\n\n` +
              `Я напомню вам за 24 часа и за 1 час до приёма.`
            );
            console.log(`[PatientBot] linked chat=${chatId} appt=${appt.id}`);
          } else {
            await sendPatientTg(chatId, '❌ Ссылка устарела или уже использована. Запишитесь заново.');
          }
        } else {
          await sendPatientTg(chatId, '👋 Привет! Я бот AcuTwin для напоминаний о приёмах.\n\nЧтобы подключить напоминания, перейдите по ссылке из страницы записи к врачу.');
        }
      }
    } catch(e) { console.error('[PatientBot] webhook err:', e.message); }
    return;
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

    // Если врач добавлен в эту клинику — убрать его из других тенантов
    const existing = db.getTenant(id);
    const newLogins = body.doctorLogins || [];
    const oldLogins = existing?.doctorLogins || [];
    const added = newLogins.filter(l => !oldLogins.includes(l));
    if (added.length > 0) {
      for (const t of db.getTenants().filter(t => t.id !== id)) {
        const filtered = (t.doctorLogins || []).filter(l => !added.includes(l));
        if (filtered.length !== (t.doctorLogins || []).length)
          db.updateTenant({ ...t, doctorLogins: filtered });
      }
    }

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

  // PATCH /api/trial-request/:id (admin only)
  if (method === 'PATCH' && /^\/api\/trial-request\/\d+$/.test(endpoint)) {
    const user = requireAdmin(req, res); if (!user) return;
    const id = parseInt(endpoint.split('/').pop(), 10);
    const VALID = ['new', 'contacted', 'granted'];
    const { status } = await readBody(req);
    if (!VALID.includes(status)) return json(res, 400, { error: 'Недопустимый статус' });
    db.updateTrialStatus(id, status);
    return json(res, 200, { ok: true });
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

  // Telegram patient bot webhook (POST /tg-patient)
  if (method === 'POST' && url === '/tg-patient') {
    try { await handleAPI(method, url, req, res); }
    catch (e) { res.writeHead(200); res.end('ok'); }
    return;
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

  // Красивые публичные URL → внутренние страницы
  // /c/<slug>          → clinic.html?slug=<slug>
  // /d/<slug>          → book.html?doctor=<slug>
  // /c/<slug>/d/<dr>   → book.html?doctor=<dr>&clinic=<slug>
  const mCD = url.match(/^\/c\/([^/]+)\/d\/([^/]+)\/?$/);
  const mC  = url.match(/^\/c\/([^/]+)\/?$/);
  const mD  = url.match(/^\/d\/([^/]+)\/?$/);
  if (mCD) {
    res.writeHead(302, { Location: `/book.html?doctor=${encodeURIComponent(mCD[2])}&clinic=${encodeURIComponent(mCD[1])}` });
    return res.end();
  }
  if (mC) {
    res.writeHead(302, { Location: `/clinic.html?slug=${encodeURIComponent(mC[1])}` });
    return res.end();
  }
  if (mD) {
    res.writeHead(302, { Location: `/book.html?doctor=${encodeURIComponent(mD[1])}` });
    return res.end();
  }

  // Static files
  if (url === '/' || url === '/new/' || url === '/new') url = '/treatment.html';
  url = url.replace(/^\/new\//, '/');

  // Медиафайлы: /media/ → папка на уровень выше от ROOT
  const MEDIA_ROOT = path.join(ROOT, '..', 'media');
  if (url.startsWith('/media/')) {
    const decodedUrl = decodeURIComponent(url);
    const fp = path.resolve(MEDIA_ROOT, '.' + decodedUrl.slice('/media'.length));
    if (!fp.startsWith(MEDIA_ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    let stat;
    try { stat = fs.statSync(fp); } catch { res.writeHead(404); return res.end('Not found'); }
    if (stat.isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(fp).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const total = stat.size;
    const rangeHeader = req.headers['range'];
    const onStreamErr = (e) => { console.error('[stream error]', e.message); if (!res.headersSent) { res.writeHead(500); res.end(); } };
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
      fs.createReadStream(fp, { start, end }).on('error', onStreamErr).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        'Content-Length': total,
        'Cache-Control': 'public,max-age=86400',
      });
      fs.createReadStream(fp).on('error', onStreamErr).pipe(res);
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
  scheduleReminders();
  console.log('[Reminders] scheduled daily at 10:00');
  if (PATIENT_TG_TOKEN) {
    registerPatientTgWebhook('https://acutwin.ru');
    console.log('[PatientBot] webhook registered → https://acutwin.ru/tg-patient');
  }
});

process.on('uncaughtException',  (err) => console.error('[uncaughtException]',  err.message));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('SIGHUP', () => console.log('[SIGHUP] ignored, server keeps running'));
