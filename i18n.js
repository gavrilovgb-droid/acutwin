/**
 * i18n.js — AcuTwin i18n infrastructure (Phase 1: RU only, foundation)
 *
 * Usage:
 *   import { initI18n, t } from '/i18n.js';
 *   await initI18n();
 *   t('common:nav.schedule')  // → 'Расписание'
 *
 * Phase 1 lock: FORCED_LOCALE = 'ru'
 * Phase 3: set FORCED_LOCALE = null to enable per-user locale detection.
 *          Only locales with status='enabled' or status='internal' (+ internal flag)
 *          will be accepted — see isLocaleAllowed() below.
 */

import { DEFAULT_LOCALE, FALLBACK_LOCALE, SUPPORTED_LOCALES, isLocaleEnabled } from '/config/locales.js';

const FORCED_LOCALE = 'ru'; // Phase 1: all prod users locked to Russian

const NAMESPACES = [
  'common', 'auth', 'dashboard',
  'acupoints', 'sessions', 'subscription',
  'notifications', 'errors',
];

let _initialized = false;

// Resolves the locale to use. Ignores any locale that isn't 'enabled' in prod.
// Internal locales require explicit opt-in (future: isInternalUser flag).
function resolveLocale(requested) {
  if (FORCED_LOCALE) return FORCED_LOCALE;
  if (requested && isLocaleEnabled(requested)) return requested;
  return DEFAULT_LOCALE; // always fall back to 'ru'
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`i18n: failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function initI18n() {
  if (_initialized) return;

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

export function t(key, opts) {
  if (!window.i18next?.isInitialized) return key; // safe fallback before init
  return window.i18next.t(key, opts);
}

export function getLocale() {
  return window.i18next?.language || FORCED_LOCALE || DEFAULT_LOCALE;
}
