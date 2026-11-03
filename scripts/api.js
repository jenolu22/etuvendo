const apiHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) ? '127.0.0.1' : window.location.hostname;
export const API_BASE = localStorage.getItem('etuvendo_api_base') || `http://${apiHost}:8000/api`;

export function getToken() {
  return localStorage.getItem('etuvendo_token');
}

export function setSession(payload) {
  localStorage.setItem('etuvendo_token', payload.token);
  localStorage.setItem('etuvendo_user', JSON.stringify(payload.utilisateur));
}

export function clearSession() {
  localStorage.removeItem('etuvendo_token');
  localStorage.removeItem('etuvendo_user');
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('etuvendo_user') || 'null'); }
  catch { return null; }
}

function readableError(data) {
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    if (first) return translateValidation(first);
  }
  return translateValidation(data?.message || data?.erreur || 'Erreur API EtuVendo');
}

function translateValidation(message) {
  const dictionary = {
    'validation.unique': 'Cet email est déjà utilisé. Connecte-toi ou choisis une autre adresse.',
    'validation.required': 'Un champ obligatoire est manquant.',
    'validation.email': 'Adresse email invalide.',
    'validation.min.string': 'Le mot de passe doit contenir au moins 8 caractères.',
    'validation.exists': 'La valeur sélectionnée est introuvable.',
  };
  return dictionary[message] || message;
}

export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(readableError(data));
  }

  return data;
}


