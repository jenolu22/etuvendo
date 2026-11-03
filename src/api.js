const apiHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) ? '127.0.0.1' : window.location.hostname;
const localApi = 'http://' + apiHost + ':8000/api';
const configuredApi = (import.meta.env.VITE_API_URL || localStorage.getItem('etuvendo_api_base') || localApi).replace(/\/$/, '');
export const API_BASE = configuredApi.endsWith('/api') ? configuredApi : configuredApi + '/api';
export const getToken = () => localStorage.getItem('etuvendo_token');
export const getUser = () => { try { return JSON.parse(localStorage.getItem('etuvendo_user') || 'null'); } catch { return null; } };
export const setSession = p => { localStorage.setItem('etuvendo_token', p.token); localStorage.setItem('etuvendo_user', JSON.stringify(p.utilisateur)); };
export const clearSession = () => { localStorage.removeItem('etuvendo_token'); localStorage.removeItem('etuvendo_user'); };
const errorText = data => {
  if (data?.errors) { const first = Object.values(data.errors).flat()[0]; if (first) return first; }
  return data?.message || data?.erreur || 'Erreur API EtuVendo';
};
export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const token = getToken(); if (token) headers.Authorization = 'Bearer ' + token;
  let body = options.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const response = await fetch(API_BASE + path, { ...options, headers, body });
  const text = await response.text(); const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(errorText(data));
  return data;
}
