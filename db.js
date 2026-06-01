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
const _updHash   = db.prepare('UPDATE users SET hash=? WHERE username=? COLLATE NOCASE');

module.exports.getUser      = u => _getUser.get(u) || null;
module.exports.updateUserHash = (username, hash) => _updHash.run(hash, username);
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
  INSERT INTO records (id,doctor,doctorName,date,time,patient,age,gender,reason,notes,points,meridians,type,outcome,nrs_before,nrs_after,treatment_type,stimulation,exposure,deqi)
  VALUES (@id,@doctor,@doctorName,@date,@time,@patient,@age,@gender,@reason,@notes,@points,@meridians,@type,@outcome,@nrs_before,@nrs_after,@treatment_type,@stimulation,@exposure,@deqi)
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
});
module.exports.deleteRecord   = id => _delRecord.run(id);
const _getRecord = db.prepare('SELECT * FROM records WHERE id=?');
module.exports.getRecord = id => parseRecord(_getRecord.get(id));
const _updOutcome = db.prepare('UPDATE records SET outcome=? WHERE id=?');
module.exports.updateOutcome  = (id, outcome) => _updOutcome.run(outcome, id);
const _updStatus  = db.prepare('UPDATE records SET status=? WHERE id=?');
module.exports.updateStatus   = (id, status)  => _updStatus.run(status, id);

// ── PATIENT STATUSES (курс лечения) ───────────────────────
const _getPatientStatus = db.prepare('SELECT status FROM patient_statuses WHERE patient=?');
const _setPatientStatus = db.prepare('INSERT OR REPLACE INTO patient_statuses (patient, status, updated_at) VALUES (?,?,datetime("now"))');
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
  return _getTenants.all().map(parseTenant)
    .find(t => (t.doctorLogins||[]).includes(username)) || null;
};
