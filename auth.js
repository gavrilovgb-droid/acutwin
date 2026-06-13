/**
 * auth.js — авторизация через сервер (JWT)
 * Обратно совместим: getSession() возвращает тот же формат {name, username, role}
 */
import { apiLogin, apiLogout, apiMe, getToken, clearToken, apiAddUser, apiGetUsers } from './api.js';
import { t } from '/i18n.js';

const SESSION_KEY = 'acutwin_session';

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

// Проверка токена на сервере — используется при загрузке страниц
export async function verifySession() {
  if (!getToken()) return null;
  const user = await apiMe();
  if (!user) return null;
  // Обновляем локальную копию сессии
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function login(username, password) {
  return apiLogin(username, password);
}

export function logout() {
  apiLogout();
}

export function isAdmin(session) {
  return session && session.role === 'admin';
}

// Декодирует JWT без проверки подписи (только для чтения exp)
function _parseJwtExp(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch { return null; }
}

export async function requireAuth() {
  const session = getSession();
  if (!session || !getToken()) {
    sessionStorage.removeItem('acutwin_session');
    window.location.href = 'login.html';
    return null;
  }
  // Кросс-вкладочный выход
  window.addEventListener('storage', e => {
    if (e.key === 'acutwin_logout_signal') {
      clearToken();
      window.location.href = 'login.html';
    }
  });
  // bfcache + visibilitychange: проверяем токен при любом возврате на страницу
  const _checkToken = () => { if (!getToken()) window.location.replace('login.html'); };
  window.addEventListener('pageshow', e => { if (e.persisted) _checkToken(); });
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') _checkToken(); });

  // Предупреждение за 5 минут до истечения JWT
  const exp = _parseJwtExp(getToken());
  if (exp) {
    const warnAt = exp - 5 * 60 * 1000;
    const delay  = warnAt - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        if (!getToken()) return;
        const bar = document.createElement('div');
        bar.id = 'jwt-warn-bar';
        bar.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);z-index:9999;background:#FF9500;color:#000;font-size:13px;font-weight:600;padding:10px 20px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.4);display:flex;align-items:center;gap:10px';
        bar.innerHTML = '<span>' + t('auth:sessionExpiring') + '</span><button onclick="this.closest(\'#jwt-warn-bar\').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;line-height:1">×</button>';
        document.body.appendChild(bar);
        setTimeout(() => bar.remove(), 60_000);
      }, delay);
    }
    // Авто-выход по истечению токена
    const logoutDelay = exp - Date.now();
    if (logoutDelay > 0) {
      setTimeout(() => {
        clearToken();
        window.location.replace('login.html');
      }, logoutDelay);
    }
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!session) return null;
  if (session.role !== 'admin') {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// ── Совместимость: регистрация через API ──────────────────
export async function register(name, username, password, role = 'doctor') {
  return apiAddUser(username, name, password, role);
}

// ── Совместимость: getUsers через API (только для admin) ──
export async function getUsers() {
  return apiGetUsers();
}
