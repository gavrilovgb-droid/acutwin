// status values:
//   'enabled'  — live for all users
//   'internal' — staging / team accounts only (feature-flagged)
//   'disabled' — not available, do not activate
export const SUPPORTED_LOCALES = {
  ru: { label: 'Русский',  status: 'enabled'  },
  en: { label: 'English',  status: 'internal' },
  zh: { label: '中文',      status: 'disabled' },
  es: { label: 'Español',  status: 'disabled' },
  ar: { label: 'العربية', status: 'disabled' },
};

export const DEFAULT_LOCALE  = 'ru';
export const FALLBACK_LOCALE = 'en';

export function isLocaleEnabled(locale) {
  return SUPPORTED_LOCALES[locale]?.status === 'enabled';
}

export function isLocaleInternal(locale) {
  return SUPPORTED_LOCALES[locale]?.status === 'internal';
}
