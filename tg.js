/**
 * tg.js — Telegram-интеграция AcuTwin
 *
 * Два бота:
 *  1. Врачебный (TELEGRAM_BOT_TOKEN) — уведомления владельцу/администратору
 *  2. Пациентский (@AcuTwinRemindBot, PATIENT_TG_BOT_TOKEN) — напоминания пациентам
 */
const https = require('https');

const TG_TOKEN         = process.env.TELEGRAM_BOT_TOKEN   || '';
const TG_CHAT_ID       = process.env.TELEGRAM_CHAT_ID     || '';
const PATIENT_TG_TOKEN = process.env.PATIENT_TG_BOT_TOKEN || '';
const PATIENT_TG_BOT_NAME = process.env.PATIENT_TG_BOT_NAME || '';

const TG_METHOD_LABEL = { telegram: 'Telegram', max: 'MAX', phone: 'Телефон', card: 'Карта' }; /* i18n-ok */

// ── Низкоуровневый HTTP POST к Telegram Bot API ────────────
function tgApiPost(token, path, payload) {
  return new Promise(resolve => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${path}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (!json.ok) {
            console.error(`[TG] API error on ${path}: code=${json.error_code} desc="${json.description}"`);
          }
        } catch { /* non-JSON response */ }
        resolve();
      });
    });
    req.on('error', e => {
      console.error(`[TG] Network error on ${path}: code=${e.code || '?'} msg=${e.message || '(empty)'}`);
      resolve();
    });
    req.write(body);
    req.end();
  });
}

// ── Пациентский бот ────────────────────────────────────────

/**
 * Отправить сообщение пациенту (HTML-разметка).
 * @param {string} chatId  — Telegram chat_id пациента
 * @param {string} text    — текст сообщения (поддерживает <b>, <i>, \n)
 */
async function sendPatientTg(chatId, text) {
  if (!PATIENT_TG_TOKEN || !chatId) return;
  await tgApiPost(PATIENT_TG_TOKEN, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}

/**
 * Зарегистрировать webhook бота для пациентов при старте сервера.
 * @param {string} baseUrl — публичный URL сервера (напр. https://acutwin.ru)
 */
function registerPatientTgWebhook(baseUrl) {
  if (!PATIENT_TG_TOKEN || !baseUrl) return;
  const webhookUrl = `${baseUrl}/tg-patient`;
  https.request({
    hostname: 'api.telegram.org',
    path: `/bot${PATIENT_TG_TOKEN}/setWebhook`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(d);
        if (json.ok) console.log('[PatientBot] webhook registered →', webhookUrl);
        else console.error('[PatientBot] webhook failed:', json.description);
      } catch { console.log('[PatientBot] webhook response:', d); }
    });
  }).on('error', e => console.error('[PatientBot] webhook err:', e.message))
    .end(JSON.stringify({ url: webhookUrl }));
}

// ── Врачебный бот ──────────────────────────────────────────

/**
 * Уведомление владельцу о новой заявке на пробный доступ.
 */
function sendTgNotify(contactMethod, contact, ip, email) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  const label = TG_METHOD_LABEL[contactMethod] || contactMethod;
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const text = `🔔 Новая заявка на триал АкуПро\nEmail: ${email || '—'}\nМетод: ${label}\nКонтакт: ${contact}\nIP: ${ip || '—'}\nВремя: ${now}`; /* i18n-ok */
  tgApiPost(TG_TOKEN, 'sendMessage', { chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' });
}

/**
 * Уведомление врачу о новой онлайн-записи пациента.
 */
function sendTgBookingNotify(appt, doctorName, clinicName) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  const when = new Date(appt.start_at.replace(' ', 'T')).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const text =
    `🩺 Новая заявка на приём\n` + /* i18n-ok */
    `Врач: ${doctorName}${clinicName ? ' · ' + clinicName : ''}\n` + /* i18n-ok */
    `Когда: ${when}\n` + /* i18n-ok */
    `Пациент: ${appt.patient}\n` + /* i18n-ok */
    `Телефон: ${appt.patient_phone || '—'}\n` + /* i18n-ok */
    `Email: ${appt.patient_email || '—'}\n` +
    `Жалобы: ${appt.notes || '—'}`; /* i18n-ok */
  tgApiPost(TG_TOKEN, 'sendMessage', { chat_id: TG_CHAT_ID, text });
}

module.exports = {
  sendPatientTg,
  registerPatientTgWebhook,
  sendTgNotify,
  sendTgBookingNotify,
  PATIENT_TG_TOKEN,
  PATIENT_TG_BOT_NAME,
};
