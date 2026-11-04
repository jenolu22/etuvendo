const apiHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) ? '127.0.0.1' : window.location.hostname;
const localApi = 'http://' + apiHost + ':8000/api';
const configuredApi = (import.meta.env.VITE_API_URL || localStorage.getItem('etuvendo_api_base') || localApi).replace(/\/$/, '');
export const API_BASE = configuredApi.endsWith('/api') ? configuredApi : configuredApi + '/api';
export const getToken = () => localStorage.getItem('etuvendo_token');
export const getUser = () => { try { return JSON.parse(localStorage.getItem('etuvendo_user') || 'null'); } catch { return null; } };
export const setSession = p => { localStorage.setItem('etuvendo_token', p.token); localStorage.setItem('etuvendo_user', JSON.stringify(p.utilisateur)); };
export const clearSession = () => { localStorage.removeItem('etuvendo_token'); localStorage.removeItem('etuvendo_user'); };
const errorText = (data, status) => {
  const raw = data?.errors ? Object.values(data.errors).flat()[0] : (data?.message || data?.erreur || 'Erreur API EtuVendo');
  const text = String(raw).toLowerCase();
  if (text.includes('already been taken') || text.includes('déjà utilisé') || text.includes('has already')) return 'Cette adresse email est déjà utilisée.';
  if (text.includes('invalid credentials') || text.includes('identifiants') || text.includes('unauthenticated') || (status === 401 && text.includes('password'))) return 'Adresse email ou mot de passe incorrect.';
  if (text.includes('password') && (text.includes('incorrect') || text.includes('wrong'))) return 'Mot de passe incorrect.';
  if (status === 422 && !data?.errors) return 'Les informations saisies sont invalides. Vérifie les champs.';
  if (status === 413) return 'Le fichier est trop volumineux. La limite est de 16 Mo.';
  if (status >= 500) return 'Le serveur rencontre un problème. Réessaie dans un instant.';
  return raw;
};
export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const token = getToken(); if (token) headers.Authorization = 'Bearer ' + token;
  let body = options.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const progressCallback = options.onProgress || window.__etuvendoProgress;
  if (body instanceof FormData && progressCallback) {
    const data = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'POST', API_BASE + path);
      Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = event => { if (event.lengthComputable) progressCallback(Math.round((event.loaded / event.total) * 100)); };
      xhr.onerror = () => reject(new Error('Connexion impossible avec le serveur. Vérifie ta connexion internet.'));
      xhr.onload = () => { let parsed = null; try { parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { parsed = null; } if (xhr.status < 200 || xhr.status >= 300) reject(new Error(errorText(parsed, xhr.status))); else resolve(parsed); };
      xhr.send(body);
    });
    return data;
  }
  const response = await fetch(API_BASE + path, { ...options, headers, body });
  const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(errorText(data, response.status));
  return data;
}
