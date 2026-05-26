/**
 * auth.js — авторизация через сервер (JWT)
 * Обратно совместим: getSession() возвращает тот же формат {name, username, role}
 */
import { apiLogin, apiLogout, apiMe, getToken, clearToken, apiAddUser, apiGetUsers } from './api.js';

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
  // bfcache: браузер восстановил страницу кнопкой «назад» — проверяем токен
  window.addEventListener('pageshow', e => {
    if (e.persisted && !getToken()) {
      window.location.replace('login.html');
    }
  });
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
