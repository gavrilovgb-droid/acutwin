/**
 * db.js — инициализация SQLite и все операции с данными
 */
const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'acutwin.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Включаем WAL для лучшей производительности при параллельных чтениях
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Миграции — добавляем новые поля если их нет
try { db.exec("ALTER TABLE records ADD COLUMN status TEXT NOT NULL DEFAULT 'started'"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN nrs_before INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN nrs_after INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN treatment_type TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN needle_type TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN stimulation TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN exposure INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN deqi INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN progress INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN soap_s TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN soap_o TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN soap_a TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE records ADD COLUMN soap_p TEXT"); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS trial_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  method     TEXT NOT NULL,
  contact    TEXT NOT NULL,
  ip         TEXT,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(method, contact)
)`); } catch(e) {}

try { db.exec(`CREATE TABLE IF NOT EXISTS patient_statuses (
  patient    TEXT PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`); } catch(e) {}

try { db.exec(`CREATE TABLE IF NOT EXISTS appointments (
  id              TEXT PRIMARY KEY,
  doctor          TEXT NOT NULL,
  doctorName      TEXT NOT NULL,
  patient         TEXT NOT NULL,
  patient_phone   TEXT,
  patient_email   TEXT,
  patient_telegram TEXT,
  start_at        TEXT NOT NULL,
  duration_min    INTEGER NOT NULL DEFAULT 60,
  service         TEXT,
  price           INTEGER,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled',
  record_id       TEXT,
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
)`); } catch(e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_appt_doctor_start ON appointments(doctor, start_at)'); } catch(e) {}
try { db.exec("ALTER TABLE appointments ADD COLUMN reminder_sent_at TEXT"); } catch(e) {}

// Расширения для публичной записи (slug, профиль врача, реквизиты клиники)
['slug TEXT', 'specialty TEXT', 'photo TEXT', 'bio TEXT', 'price_default INTEGER',
 'snils TEXT', 'medical_license TEXT', 'email TEXT'].forEach(col => {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch(e) {}
});
['slug TEXT', 'address TEXT', 'tenant_phone TEXT', 'website TEXT', 'logo TEXT',
 'org_inn TEXT', 'org_kpp TEXT', 'org_ogrn TEXT', 'region_code TEXT'].forEach(col => {
  try { db.exec(`ALTER TABLE tenants ADD COLUMN ${col}`); } catch(e) {}
});
// Расширения для appointments под госсектор (заполняется позже, не блокирует)
['service_type TEXT', 'patient_oms TEXT', 'utm_source TEXT', 'utm_medium TEXT'].forEach(col => {
  try { db.exec(`ALTER TABLE appointments ADD COLUMN ${col}`); } catch(e) {}
});
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_slug ON users(slug) WHERE slug IS NOT NULL'); } catch(e) {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug) WHERE slug IS NOT NULL'); } catch(e) {}

// Telegram-бот для пациентов
try { db.exec("ALTER TABLE appointments ADD COLUMN tg_chat_id TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE appointments ADD COLUMN tg_token TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE appointments ADD COLUMN tg_reminder_1h_at TEXT"); } catch(e) {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_appt_tg_token ON appointments(tg_token) WHERE tg_token IS NOT NULL'); } catch(e) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_appt_unique_slot ON appointments(doctor, start_at) WHERE status != 'cancelled'"); } catch(e) {}

// i18n: user language preference
try { db.exec("ALTER TABLE users ADD COLUMN preferred_locale TEXT NOT NULL DEFAULT 'ru'"); } catch(e) {}

// Sprint 7: billing audit log — migrate to new schema if old columns present
try {
  const cols = db.prepare("PRAGMA table_info(billing_audit)").all().map(c => c.name);
  if (cols.length && (cols.includes('meta') || cols.includes('actor'))) {
    db.exec('DROP TABLE billing_audit');
  }
} catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS billing_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL,
  admin_user TEXT NOT NULL,
  action     TEXT NOT NULL,
  tenant_id  TEXT NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  extra      TEXT
)`); } catch(e) {}

// ── Создаём таблицы ────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name      TEXT    NOT NULL,
    hash      TEXT    NOT NULL,
    role      TEXT    NOT NULL DEFAULT 'doctor',
    created_at TEXT   NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS records (
    id         TEXT    PRIMARY KEY,
    doctor     TEXT    NOT NULL,
    doctorName TEXT    NOT NULL,
    date       TEXT    NOT NULL,
    time       TEXT    NOT NULL,
    patient    TEXT    NOT NULL,
    age        TEXT,
    gender     TEXT,
    reason     TEXT,
    notes      TEXT,
    points     TEXT    NOT NULL DEFAULT '[]',
    meridians  TEXT    NOT NULL DEFAULT '[]',
    type       TEXT    NOT NULL DEFAULT 'Акупунктура',
    outcome    TEXT    NOT NULL DEFAULT 'neutral',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clinic (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id           TEXT PRIMARY KEY,
    clinic       TEXT NOT NULL,
    plan         TEXT NOT NULL DEFAULT 'base',
    status       TEXT NOT NULL DEFAULT 'active',
    doctorLogins TEXT NOT NULL DEFAULT '[]',
    paidUntil    TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── USERS ──────────────────────────────────────────────────
const _getUser   = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
const _getUsers  = db.prepare('SELECT id,username,name,role,created_at FROM users');
const _addUser   = db.prepare('INSERT INTO users (username,name,hash,role) VALUES (?,?,?,?)');
const _delUser   = db.prepare('DELETE FROM users WHERE username = ? COLLATE NOCASE');
const _updHash        = db.prepare('UPDATE users SET hash=? WHERE username=? COLLATE NOCASE');
const _getUserByEmail = db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE');
const _setUserEmail   = db.prepare('UPDATE users SET email=? WHERE username=? COLLATE NOCASE');

// Транслитерация русских символов для URL slug
const TRANSLIT = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
function makeSlug(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/[а-яё]/g, c => TRANSLIT[c] || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
module.exports.makeSlug = makeSlug;

// Бэкфилл slug-ов для существующих записей
const _allUsersForSlug   = db.prepare("SELECT id, username, name FROM users WHERE slug IS NULL OR slug=''");
const _allTenantsForSlug = db.prepare("SELECT id, clinic FROM tenants WHERE slug IS NULL OR slug=''");
const _setUserSlug   = db.prepare('UPDATE users SET slug=? WHERE id=?');
const _setTenantSlug = db.prepare('UPDATE tenants SET slug=? WHERE id=?');
const _slugExistsUser   = db.prepare('SELECT 1 FROM users WHERE slug=? AND id != ?');
const _slugExistsTenant = db.prepare('SELECT 1 FROM tenants WHERE slug=? AND id != ?');
function uniqSlug(base, exists, currentId) {
  let s = base || 'x';
  let n = 1;
  while (exists.get(s, currentId)) { n++; s = `${base}-${n}`; }
  return s;
}
try {
  for (const u of _allUsersForSlug.all()) {
    const base = makeSlug(u.name) || makeSlug(u.username) || ('u' + u.id);
    _setUserSlug.run(uniqSlug(base, _slugExistsUser, u.id), u.id);
  }
  for (const t of _allTenantsForSlug.all()) {
    const base = makeSlug(t.clinic) || ('c' + t.id.slice(0,8));
    _setTenantSlug.run(uniqSlug(base, _slugExistsTenant, t.id), t.id);
  }
} catch(e) { console.error('[slug backfill]', e.message); }

// Резолв врача/клиники по slug
const _userBySlug   = db.prepare('SELECT * FROM users WHERE slug=?');
const _tenantBySlug = db.prepare('SELECT * FROM tenants WHERE slug=?');
module.exports.getUserBySlug    = s => _userBySlug.get(s) || null;
module.exports.getTenantBySlug  = s => parseTenant(_tenantBySlug.get(s)) || null;
module.exports.getDoctorsByTenant = tenantId => {
  const t = _getTenant.get(tenantId);
  if (!t) return [];
  const logins = JSON.parse(t.doctorLogins || '[]');
  return logins.map(login => _getUser.get(login)).filter(Boolean);
};

const _updUserProfile = db.prepare(`
  UPDATE users SET slug=@slug, specialty=@specialty, photo=@photo, bio=@bio, price_default=@price_default
  WHERE username=@username COLLATE NOCASE
`);
const _updTenantProfile = db.prepare(`
  UPDATE tenants SET slug=@slug, address=@address, tenant_phone=@tenant_phone, website=@website, logo=@logo
  WHERE id=@id
`);
const _slugExistsUserExcept   = db.prepare('SELECT 1 FROM users   WHERE slug=? AND username != ? COLLATE NOCASE');
const _slugExistsTenantExcept = db.prepare('SELECT 1 FROM tenants WHERE slug=? AND id != ?');

module.exports.updateUserProfile = (username, p) => {
  _updUserProfile.run({
    username,
    slug: p.slug || null,
    specialty: p.specialty || null,
    photo: p.photo || null,
    bio: p.bio || null,
    price_default: p.price_default != null ? Number(p.price_default) : null,
  });
};
module.exports.updateTenantProfile = (id, p) => {
  _updTenantProfile.run({
    id,
    slug: p.slug || null,
    address: p.address || null,
    tenant_phone: p.tenant_phone || null,
    website: p.website || null,
    logo: p.logo || null,
  });
};
module.exports.isUserSlugTaken   = (slug, exceptUsername) => !!_slugExistsUserExcept.get(slug, exceptUsername);
module.exports.isTenantSlugTaken = (slug, exceptId) => !!_slugExistsTenantExcept.get(slug, exceptId);

module.exports.getUser      = u => _getUser.get(u) || null;
module.exports.updateUserHash  = (username, hash)  => _updHash.run(hash, username);
module.exports.getUserByEmail  = email             => _getUserByEmail.get(email) || null;
module.exports.setUserEmail    = (username, email) => _setUserEmail.run(email, username);
module.exports.getUsers   = () => _getUsers.all();
module.exports.addUser    = (username, name, hash, role='doctor') => {
  try { _addUser.run(username.trim(), name.trim(), hash, role); return { ok: true }; }
  catch (e) { return { ok: false, error: 'Логин уже занят' }; }
};
module.exports.deleteUser = u => _delUser.run(u);

// ── RECORDS ────────────────────────────────────────────────
const _getRecords      = db.prepare('SELECT * FROM records ORDER BY date DESC, time DESC');
const _getMyRecords    = db.prepare('SELECT * FROM records WHERE doctor=? ORDER BY date DESC, time DESC');
const _addRecord       = db.prepare(`
  INSERT INTO records (id,doctor,doctorName,date,time,patient,age,gender,reason,notes,points,meridians,type,outcome,nrs_before,nrs_after,treatment_type,stimulation,exposure,deqi,progress,soap_s,soap_o,soap_a,soap_p)
  VALUES (@id,@doctor,@doctorName,@date,@time,@patient,@age,@gender,@reason,@notes,@points,@meridians,@type,@outcome,@nrs_before,@nrs_after,@treatment_type,@stimulation,@exposure,@deqi,@progress,@soap_s,@soap_o,@soap_a,@soap_p)
`);
const _delRecord       = db.prepare('DELETE FROM records WHERE id=?');

function parseRecord(r) {
  if (!r) return null;
  return { ...r, points: JSON.parse(r.points||'[]'), meridians: JSON.parse(r.meridians||'[]') };
}

module.exports.getRecords         = () => _getRecords.all().map(parseRecord);
module.exports.getMyRecords       = doctor => _getMyRecords.all(doctor).map(parseRecord);
module.exports.getRecordsByLogins = logins => {
  if (!logins || logins.length === 0) return [];
  return _getRecords.all().map(parseRecord).filter(r => logins.includes(r.doctor));
};
module.exports.addRecord    = rec => _addRecord.run({
  ...rec,
  points:         JSON.stringify(rec.points    || []),
  meridians:      JSON.stringify(rec.meridians || []),
  nrs_before:     rec.nrs_before     ?? null,
  nrs_after:      rec.nrs_after      ?? null,
  treatment_type: rec.treatment_type || null,
  stimulation:    rec.stimulation    || null,
  exposure:       rec.exposure       ?? null,
  deqi:           rec.deqi           ? 1 : 0,
  progress:       rec.progress       ?? null,
  soap_s:         rec.soap_s         || null,
  soap_o:         rec.soap_o         || null,
  soap_a:         rec.soap_a         || null,
  soap_p:         rec.soap_p         || null,
});
module.exports.deleteRecord   = id => _delRecord.run(id);
const _getRecsByPatientDoctor = db.prepare('SELECT id FROM records WHERE patient=? AND doctor=? AND date=? LIMIT 5');
module.exports.getRecordsByPatientDoctor = (patient, doctor, date) => _getRecsByPatientDoctor.all(patient, doctor, date);
const _getRecord = db.prepare('SELECT * FROM records WHERE id=?');
module.exports.getRecord = id => parseRecord(_getRecord.get(id));
const _updOutcome = db.prepare('UPDATE records SET outcome=? WHERE id=?');
module.exports.updateOutcome  = (id, outcome) => _updOutcome.run(outcome, id);
const _updStatus  = db.prepare('UPDATE records SET status=? WHERE id=?');
module.exports.updateStatus   = (id, status)  => _updStatus.run(status, id);

// ── PATIENT STATUSES (курс лечения) ───────────────────────
const _getPatientStatus = db.prepare('SELECT status FROM patient_statuses WHERE patient=?');
const _setPatientStatus = db.prepare("INSERT OR REPLACE INTO patient_statuses (patient, status, updated_at) VALUES (?,?,datetime('now'))");
module.exports.getPatientStatus = name => (_getPatientStatus.get(name) || {}).status || '';
module.exports.setPatientStatus = (name, status) => _setPatientStatus.run(name, status);

// ── CLINIC ─────────────────────────────────────────────────
const _getClinic  = db.prepare('SELECT key,value FROM clinic');
const _setClinic  = db.prepare('INSERT OR REPLACE INTO clinic (key,value) VALUES (?,?)');

module.exports.getClinic = () => {
  const rows = _getClinic.all();
  return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
};
module.exports.setClinic = obj => {
  const tx = db.transaction(data => {
    for (const [k, v] of Object.entries(data)) _setClinic.run(k, String(v));
  });
  tx(obj);
};

// ── TENANTS ────────────────────────────────────────────────
// Добавляем новые колонки если их ещё нет (миграция)
['type TEXT DEFAULT "clinic"','price INTEGER DEFAULT 0','contact TEXT DEFAULT ""',
 'phone TEXT DEFAULT ""','email TEXT DEFAULT ""','notes TEXT DEFAULT ""',
 'payments TEXT DEFAULT "[]"'].forEach(col => {
  try { db.prepare(`ALTER TABLE tenants ADD COLUMN ${col}`).run(); } catch {}
});
// Trial-поля
['trial_start TEXT', 'trial_weeks INTEGER', 'trial_end TEXT'].forEach(col => {
  try { db.prepare(`ALTER TABLE tenants ADD COLUMN ${col}`).run(); } catch {}
});
// Переименование планов: solo→practik, clinic→clinic_s, base→demo, free→demo
try { db.prepare("UPDATE tenants SET plan='practik' WHERE plan='solo'").run(); } catch {}
try { db.prepare("UPDATE tenants SET plan='clinic_s' WHERE plan='clinic'").run(); } catch {}
try { db.prepare("UPDATE tenants SET plan='demo' WHERE plan IN ('base','free','basic')").run(); } catch {}

const _getTenants = db.prepare('SELECT * FROM tenants');
const _getTenant  = db.prepare('SELECT * FROM tenants WHERE id=?');
const _addTenant  = db.prepare(`
  INSERT INTO tenants (id,clinic,plan,status,doctorLogins,paidUntil,type,price,contact,phone,email,notes,payments)
  VALUES (@id,@clinic,@plan,@status,@doctorLogins,@paidUntil,@type,@price,@contact,@phone,@email,@notes,@payments)
`);
const _updTenant  = db.prepare(`
  UPDATE tenants SET clinic=@clinic,plan=@plan,status=@status,doctorLogins=@doctorLogins,paidUntil=@paidUntil,
    type=@type,price=@price,contact=@contact,phone=@phone,email=@email,notes=@notes,payments=@payments
  WHERE id=@id
`);
const _delTenant  = db.prepare('DELETE FROM tenants WHERE id=?');

function parseTenant(t) {
  if (!t) return null;
  return { ...t,
    doctorLogins: JSON.parse(t.doctorLogins||'[]'),
    payments:     JSON.parse(t.payments||'[]'),
  };
}

module.exports.getTenants  = () => _getTenants.all().map(parseTenant);
module.exports.getTenant   = id => parseTenant(_getTenant.get(id));
module.exports.addTenant   = t => _addTenant.run({ ...t,
  doctorLogins: JSON.stringify(t.doctorLogins||[]),
  payments:     JSON.stringify(t.payments||[]),
  type: t.type||'clinic', price: t.price||0,
  contact: t.contact||'', phone: t.phone||'', email: t.email||'', notes: t.notes||'',
});
module.exports.updateTenant= t => _updTenant.run({ ...t,
  doctorLogins: JSON.stringify(t.doctorLogins||[]),
  payments:     JSON.stringify(t.payments||[]),
  type: t.type||'clinic', price: t.price||0,
  contact: t.contact||'', phone: t.phone||'', email: t.email||'', notes: t.notes||'',
});
module.exports.deleteTenant= id => _delTenant.run(id);
module.exports.findTenantByDoctor = username => {
  const matches = _getTenants.all().map(parseTenant)
    .filter(t => (t.doctorLogins||[]).includes(username));
  if (!matches.length) return null;
  // Если врач в нескольких тенантах — вернуть наиболее привилегированный
  const order = { active: 3, trial: 2, suspended: 1, expired: 0 };
  return matches.sort((a, b) => {
    const sa = order[a.status] ?? 0, sb = order[b.status] ?? 0;
    if (sa !== sb) return sb - sa;
    return (b.paidUntil || '') > (a.paidUntil || '') ? 1 : -1;
  })[0];
};

try { db.exec("ALTER TABLE trial_requests ADD COLUMN email TEXT"); } catch(e) {}

// ── APPOINTMENTS ───────────────────────────────────────────
const _addAppt = db.prepare(`
  INSERT INTO appointments (id,doctor,doctorName,patient,patient_phone,patient_email,patient_telegram,start_at,duration_min,service,price,notes,status,created_by,utm_source,utm_medium)
  VALUES (@id,@doctor,@doctorName,@patient,@patient_phone,@patient_email,@patient_telegram,@start_at,@duration_min,@service,@price,@notes,@status,@created_by,@utm_source,@utm_medium)
`);
const _updAppt = db.prepare(`
  UPDATE appointments SET patient=@patient,patient_phone=@patient_phone,patient_email=@patient_email,patient_telegram=@patient_telegram,
    start_at=@start_at,duration_min=@duration_min,service=@service,price=@price,notes=@notes,status=@status,doctor=@doctor,doctorName=@doctorName
  WHERE id=@id
`);
const _delAppt = db.prepare('DELETE FROM appointments WHERE id=?');
const _getAppt = db.prepare('SELECT * FROM appointments WHERE id=?');
const _getApptsByDoctor = db.prepare('SELECT * FROM appointments WHERE doctor=? AND start_at>=? AND start_at<? ORDER BY start_at');
const _getApptsRange    = db.prepare('SELECT * FROM appointments WHERE start_at>=? AND start_at<? ORDER BY start_at');
const _setApptStatus    = db.prepare('UPDATE appointments SET status=? WHERE id=?');
const _setApptRecord    = db.prepare('UPDATE appointments SET record_id=?, status=? WHERE id=?');
const _checkConflict = db.prepare(`
  SELECT id FROM appointments
  WHERE doctor=? AND status!='cancelled' AND id != ?
    AND start_at < ?
    AND datetime(start_at, '+' || duration_min || ' minutes') > ?
  LIMIT 1
`);

module.exports.addAppointment    = a => _addAppt.run({
  id: a.id, doctor: a.doctor, doctorName: a.doctorName, patient: a.patient,
  patient_phone: a.patient_phone || null, patient_email: a.patient_email || null, patient_telegram: a.patient_telegram || null,
  start_at: a.start_at, duration_min: a.duration_min || 60,
  service: a.service || null, price: a.price ?? null, notes: a.notes || null,
  status: a.status || 'scheduled', created_by: a.created_by || null,
  utm_source: a.utm_source || null, utm_medium: a.utm_medium || null,
});
module.exports.updateAppointment = a => _updAppt.run({
  id: a.id, doctor: a.doctor, doctorName: a.doctorName, patient: a.patient,
  patient_phone: a.patient_phone || null, patient_email: a.patient_email || null, patient_telegram: a.patient_telegram || null,
  start_at: a.start_at, duration_min: a.duration_min || 60,
  service: a.service || null, price: a.price ?? null, notes: a.notes || null,
  status: a.status || 'scheduled'
});
module.exports.deleteAppointment      = id => _delAppt.run(id);
module.exports.getAppointment         = id => _getAppt.get(id);
module.exports.getAppointmentsDoctor  = (doctor, fromISO, toISO) => _getApptsByDoctor.all(doctor, fromISO, toISO);
module.exports.getAppointmentsRange   = (fromISO, toISO) => _getApptsRange.all(fromISO, toISO);
module.exports.setAppointmentStatus   = (id, status) => _setApptStatus.run(status, id);
module.exports.linkAppointmentRecord  = (id, recordId) => _setApptRecord.run(recordId, 'done', id);
const _getApptsForReminder = db.prepare(`
  SELECT * FROM appointments
  WHERE status='scheduled' AND patient_email IS NOT NULL AND patient_email != ''
    AND reminder_sent_at IS NULL
    AND start_at >= ? AND start_at < ?
`);
const _markReminderSent = db.prepare("UPDATE appointments SET reminder_sent_at = datetime('now') WHERE id=?");
module.exports.getAppointmentsForReminder = (fromISO, toISO) => _getApptsForReminder.all(fromISO, toISO);
module.exports.markReminderSent          = id => _markReminderSent.run(id);

module.exports.findApptConflict = (doctor, startISO, durationMin, exceptId='') => {
  // startISO формат 'YYYY-MM-DD HH:MM:SS' (локальное время). endISO считаем через datetime() в SQL.
  // Чтобы не лочиться на UTC, используем SQLite datetime для конвертации:
  const endRow = db.prepare("SELECT datetime(?, '+' || ? || ' minutes') AS e").get(startISO, durationMin);
  return _checkConflict.get(doctor, exceptId, endRow.e, startISO);
};

// ── TRIAL REQUESTS ─────────────────────────────────────────
const _addTrialRequest = db.prepare(
  "INSERT INTO trial_requests (method, contact, ip, email) VALUES (?, ?, ?, ?)"
);
module.exports.addTrialRequest = (method, contact, ip, email) => _addTrialRequest.run(method, contact, ip, email || null);

const _getTrialRequests   = db.prepare("SELECT * FROM trial_requests ORDER BY created_at DESC");
const _updateTrialStatus  = db.prepare("UPDATE trial_requests SET status=? WHERE id=?");
module.exports.getTrialRequests  = () => _getTrialRequests.all();
module.exports.updateTrialStatus = (id, status) => _updateTrialStatus.run(status, id);

// ── TELEGRAM PATIENT BOT ───────────────────────────────────
const _setApptTgToken  = db.prepare("UPDATE appointments SET tg_token=? WHERE id=?");
const _getApptByToken  = db.prepare("SELECT * FROM appointments WHERE tg_token=?");
const _linkTgChat      = db.prepare("UPDATE appointments SET tg_chat_id=?, tg_token=NULL WHERE tg_token=?");
const _getApptsTgRemind1h = db.prepare(`
  SELECT * FROM appointments
  WHERE status='scheduled' AND tg_chat_id IS NOT NULL
    AND tg_reminder_1h_at IS NULL
    AND start_at >= ? AND start_at < ?
`);
const _markTgRemind1h  = db.prepare("UPDATE appointments SET tg_reminder_1h_at=datetime('now') WHERE id=?");
const _getApptsTgRemind24h = db.prepare(`
  SELECT * FROM appointments
  WHERE status='scheduled' AND tg_chat_id IS NOT NULL
    AND reminder_sent_at IS NULL
    AND start_at >= ? AND start_at < ?
`);
module.exports.setApptTgToken        = (id, token) => _setApptTgToken.run(token, id);
module.exports.getApptByTgToken      = token => _getApptByToken.get(token);
module.exports.linkPatientTelegram   = (token, chatId) => _linkTgChat.run(chatId, token);
module.exports.getApptsForTgRemind1h = (fromISO, toISO) => _getApptsTgRemind1h.all(fromISO, toISO);
module.exports.markTgRemind1h        = id => _markTgRemind1h.run(id);
module.exports.getApptsForTgRemind24h = (fromISO, toISO) => _getApptsTgRemind24h.all(fromISO, toISO);

// ── TRIAL ──────────────────────────────────────────────────
const PAID_PLANS = new Set(['practik', 'clinic_s', 'clinic_m', 'clinic_pro']);

// trial_end = DATE at 20:59:59 UTC = 23:59:59 MSK
function computeTrialEnd(trialStart, trialWeeks) {
  const d = new Date(trialStart + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(trialWeeks) * 7);
  return d.toISOString().slice(0, 10) + ' 20:59:59';
}

function getTrialStatus(tenant) {
  if (!tenant || tenant.plan === 'demo') return { status: 'demo', blocked: false, grace: false };
  if (PAID_PLANS.has(tenant.plan)) return { status: 'paid', blocked: false, grace: false };
  if (tenant.plan !== 'trial') return { status: 'unknown', blocked: false, grace: false };
  if (!tenant.trial_end) return { status: 'trial_active', blocked: false, grace: false, daysLeft: null };

  const now = new Date();
  const trialEnd = new Date(tenant.trial_end.replace(' ', 'T') + 'Z');
  const graceEnd = new Date(trialEnd.getTime() + 24 * 3600 * 1000);
  const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / 86400000));

  if (now <= trialEnd) return { status: 'trial_active', blocked: false, grace: false, daysLeft, trialEnd: trialEnd.toISOString() };
  if (now <= graceEnd) return { status: 'trial_grace', blocked: false, grace: true, daysLeft: 0, trialEnd: trialEnd.toISOString() };
  return { status: 'trial_expired', blocked: true, grace: false, daysLeft: 0, trialEnd: trialEnd.toISOString() };
}

const _setTenantTrial = db.prepare(
  "UPDATE tenants SET trial_start=@ts, trial_weeks=@tw, trial_end=@te, plan='trial' WHERE id=@id"
);
const _setTenantPlan    = db.prepare("UPDATE tenants SET plan=? WHERE id=?");
const _clearTenantTrial = db.prepare("UPDATE tenants SET trial_start=NULL, trial_weeks=NULL, trial_end=NULL WHERE id=?");
const _setTrialEnd      = db.prepare("UPDATE tenants SET trial_end=?, plan='trial' WHERE id=?");
const _logAudit = db.prepare(
  "INSERT INTO billing_audit (ts, admin_user, action, tenant_id, old_value, new_value, extra) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

function _auditLog(adminUser, action, tenantId, oldValue, newValue, extra) {
  _logAudit.run(
    new Date().toISOString(), adminUser, action, tenantId,
    oldValue ?? null, newValue ?? null,
    extra != null ? JSON.stringify(extra) : null
  );
}

module.exports.computeTrialEnd = computeTrialEnd;
module.exports.getTrialStatus  = getTrialStatus;

module.exports.logBillingAudit = (adminUser, action, tenantId, oldValue = null, newValue = null, extra = null) => {
  _auditLog(adminUser, action, tenantId, oldValue, newValue, extra);
};

module.exports.getBillingAudit = ({ tenantId = null, limit = 100 } = {}) => {
  const lim = Math.min(500, Math.max(1, parseInt(limit) || 100));
  if (tenantId) {
    return db.prepare("SELECT * FROM billing_audit WHERE tenant_id=? ORDER BY ts DESC LIMIT ?").all(tenantId, lim);
  }
  return db.prepare("SELECT * FROM billing_audit ORDER BY ts DESC LIMIT ?").all(lim);
};

module.exports.setTenantTrial = (id, trialStart, trialWeeks, actor = 'system') => {
  const te = computeTrialEnd(trialStart, trialWeeks);
  _setTenantTrial.run({ id, ts: trialStart, tw: Number(trialWeeks), te });
  _auditLog(actor, 'activate_trial', id, null, te, { weeks: Number(trialWeeks) });
  return te;
};

module.exports.extendTenantTrial = (id, extraWeeks, actor = 'system') => {
  const t = parseTenant(_getTenant.get(id));
  if (!t) return null;
  const oldTrialEnd = t.trial_end || null;
  const now = new Date();
  let fromDate;
  if (t.trial_end) {
    const te = new Date(t.trial_end.replace(' ', 'T') + 'Z');
    fromDate = now > te ? now.toISOString().slice(0, 10) : t.trial_end.slice(0, 10);
  } else {
    fromDate = now.toISOString().slice(0, 10);
  }
  const newEnd = computeTrialEnd(fromDate, extraWeeks);
  _setTrialEnd.run(newEnd, id);
  _auditLog(actor, 'extend_trial', id, oldTrialEnd, newEnd, { weeks: Number(extraWeeks) });
  return newEnd;
};

module.exports.setTenantPlan = (id, plan, actor = 'system') => {
  const current = _getTenant.get(id);
  const oldPlan = current?.plan ?? null;
  _setTenantPlan.run(plan, id);
  _clearTenantTrial.run(id);
  _auditLog(actor, 'change_plan', id, oldPlan, plan, null);
};

// Clinic stats: записи и записи на приём по врачам за период
module.exports.getClinicStats = (doctorLogins, fromISO) => {
  if (!doctorLogins || doctorLogins.length === 0) return [];
  return doctorLogins.map(login => {
    const user = _getUser.get(login);
    if (!user) return null;
    const recCount = db.prepare('SELECT COUNT(*) AS c FROM records WHERE doctor=? AND created_at>=?').get(login, fromISO);
    const apptCount = db.prepare("SELECT COUNT(*) AS c FROM appointments WHERE doctor=? AND start_at>=? AND status!='cancelled'").get(login, fromISO);
    return { username: login, name: user.name, recordCount: recCount.c, apptCount: apptCount.c };
  }).filter(Boolean);
};
