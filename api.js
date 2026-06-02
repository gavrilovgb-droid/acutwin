/**
 * api.js — клиентский слой для работы с сервером
 * Заменяет прямые обращения к localStorage
 */

const BASE = '';  // тот же origin

// ── Токен ──────────────────────────────────────────────────
export function getToken()         { return sessionStorage.getItem('acutwin_token'); }
export function setToken(t)        { sessionStorage.setItem('acutwin_token', t); }
export function clearToken()       { sessionStorage.removeItem('acutwin_token'); sessionStorage.removeItem('acutwin_session'); }

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' }
           : { 'Content-Type': 'application/json' };
}

async function req(method, url, body) {
  const opts = { method, headers: authHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + url, opts);
  if (res.status === 401) {
    clearToken();
    // На странице логина — не редиректим, возвращаем ответ чтобы показать реальную ошибку
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
      return null;
    }
  }
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// ── Auth ───────────────────────────────────────────────────
export async function apiLogin(username, password) {
  const r = await req('POST', '/api/login', { username, password, hostname: location.hostname });
  if (!r) return { ok: false, error: 'Ошибка сети' };
  if (r.ok) {
    setToken(r.data.token);
    // Совместимость: сохраняем сессию в старом формате для shared.js
    sessionStorage.setItem('acutwin_session', JSON.stringify(r.data.user));
  }
  return r.ok ? { ok: true, user: r.data.user } : { ok: false, error: r.data.error };
}

export async function apiMe() {
  const r = await req('GET', '/api/me');
  return r?.data || null;
}

export function apiLogout() {
  clearToken();
  localStorage.setItem('acutwin_logout_signal', Date.now());
  window.location.href = 'login.html';
}

// ── Records ────────────────────────────────────────────────
export async function apiGetRecords() {
  const r = await req('GET', '/api/records');
  return r?.data || [];
}

export async function apiAddRecord(record) {
  const r = await req('POST', '/api/records', record);
  return r?.data || { ok: false };
}

export async function apiDeleteRecord(id) {
  const r = await req('DELETE', `/api/records/${id}`);
  return r?.data || { ok: false };
}

// ── Users ──────────────────────────────────────────────────
export async function apiGetUsers() {
  const r = await req('GET', '/api/users');
  return r?.data || [];
}

export async function apiAddUser(username, name, password, role) {
  const r = await req('POST', '/api/users', { username, name, password, role, hostname: location.hostname });
  return r?.data || { ok: false };
}

export async function apiDeleteUser(username) {
  const r = await req('DELETE', `/api/users/${encodeURIComponent(username)}`);
  return r?.data || { ok: false };
}

// ── Clinic ─────────────────────────────────────────────────
export async function apiGetClinic() {
  const r = await req('GET', '/api/clinic');
  return r?.data || {};
}

export async function apiSetClinic(obj) {
  const r = await req('PUT', '/api/clinic', obj);
  return r?.data || { ok: false };
}

// ── Tenants ────────────────────────────────────────────────
export async function apiGetTenants() {
  const r = await req('GET', '/api/tenants');
  return r?.data || [];
}

export async function apiAddTenant(tenant) {
  const r = await req('POST', '/api/tenants', tenant);
  return r?.data || { ok: false };
}

export async function apiUpdateTenant(tenant) {
  const r = await req('PUT', `/api/tenants/${tenant.id}`, tenant);
  return r?.data || { ok: false };
}

export async function apiDeleteTenant(id) {
  const r = await req('DELETE', `/api/tenants/${id}`);
  return r?.data || { ok: false };
}

export async function apiGetTrialRequests() {
  const r = await req('GET', '/api/trial-requests');
  return r?.data || [];
}

export async function apiUpdateTrialStatus(id, status) {
  const r = await req('PATCH', `/api/trial-request/${id}`, { status });
  return r?.data || { ok: false };
}
