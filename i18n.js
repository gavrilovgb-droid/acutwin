/**
 * i18n.js — AcuTwin i18n infrastructure (Phase 1: RU only, foundation)
 *
 * Usage:
 *   import { initI18n, t } from '/i18n.js';
 *   await initI18n();
 *   t('common:nav.schedule')  // → 'Расписание'
 *
 * Phase 1/2: FORCED_LOCALE = 'ru' — all prod users see Russian.
 * Phase 3 (Step 3): EN available on staging via ?locale=en or cookie i18n_locale=en.
 *   Only locales with status='internal' are accepted as overrides — EN is 'internal'.
 * Phase 4: set FORCED_LOCALE = null to enable per-user locale detection.
 */

import { DEFAULT_LOCALE, FALLBACK_LOCALE, SUPPORTED_LOCALES, isLocaleEnabled, isLocaleInternal } from '/config/locales.js';

const FORCED_LOCALE = 'ru'; // Phase 1: all prod users locked to Russian
// Step 3: internal users can override via ?locale=en (or i18n_locale cookie)
// FORCED_LOCALE still wins for everyone else — no accidental EN in prod

const NAMESPACES = [
  'common', 'auth', 'dashboard',
  'acupoints', 'sessions', 'subscription',
  'notifications', 'errors',
  'profile', 'schedule', 'atlas', 'admin',
  'book', 'clinic',
];

let _initialized = false;
let _initPromise = null; // singleton: concurrent calls share one init

// Resolves the locale to use.
// Step 3 staging override: ?locale=en or cookie i18n_locale=en bypasses FORCED_LOCALE
// ONLY for locales with status='internal'. Prod users always get FORCED_LOCALE.
function _getStagingOverride() {
  // 1. Query param: ?locale=en
  const qp = new URLSearchParams(window.location.search).get('locale');
  if (qp && isLocaleInternal(qp)) return qp;
  // 2. Cookie: i18n_locale=en
  const cookie = document.cookie.split(';').map(c => c.trim())
    .find(c => c.startsWith('i18n_locale='));
  if (cookie) {
    const val = cookie.split('=')[1];
    if (val && isLocaleInternal(val)) return val;
  }
  return null;
}

function resolveLocale() {
  const override = _getStagingOverride();
  if (override) return override;
  if (FORCED_LOCALE) return FORCED_LOCALE;
  // Phase 4 (FORCED_LOCALE=null): use saved preference
  const saved = sessionStorage.getItem('acutwin_locale');
  if (saved && SUPPORTED_LOCALES[saved]?.status === 'enabled') return saved;
  return DEFAULT_LOCALE;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      // Script tag exists but may still be loading — wait for its onload
      if (window[_globalFor(src)]) return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error(`i18n: failed to load ${src}`)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`i18n: failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function _globalFor(src) {
  if (src.includes('i18next-http-backend')) return 'i18nextHttpBackend';
  if (src.includes('i18next-detector')) return 'i18nextBrowserLanguageDetector';
  return 'i18next';
}

async function _doInit() {
  await loadScript('/vendor/i18next.min.js');
  await loadScript('/vendor/i18next-http-backend.min.js');
  await loadScript('/vendor/i18next-detector.min.js');

  const lng = resolveLocale();

  await window.i18next
    .use(window.i18nextHttpBackend)
    .use(window.i18nextBrowserLanguageDetector)
    .init({
      lng,
      fallbackLng: FALLBACK_LOCALE,
      ns: NAMESPACES,
      defaultNS: 'common',
      backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
      interpolation: { escapeValue: false },
      detection: { order: ['querystring', 'localStorage', 'navigator'] },
    });

  _initialized = true;
}

export function initI18n() {
  if (!_initPromise) _initPromise = _doInit();
  return _initPromise;
}

export function t(key, opts) {
  if (!window.i18next?.isInitialized) return key; // safe fallback before init
  return window.i18next.t(key, opts);
}

export function getLocale() {
  return window.i18next?.language || FORCED_LOCALE || DEFAULT_LOCALE;
}

// Сохраняет выбранную локаль: в cookie (для staging override) + sessionStorage (для Phase 4)
// Перезагружает страницу чтобы применить новую локаль.
export async function setLocale(locale, token) {
  document.cookie = `i18n_locale=${locale};path=/;max-age=31536000`;
  sessionStorage.setItem('acutwin_locale', locale);
  if (token) {
    await fetch('/api/me/locale', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ locale }),
    }).catch(() => {});
  }
  location.reload();
}
