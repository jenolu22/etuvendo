const apiHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) ? '127.0.0.1' : window.location.hostname;
const localApi = 'http://' + apiHost + ':8000/api';
const productionApi = 'https://etuvendo-backend.onrender.com/api';
const environmentApi = import.meta.env.VITE_API_URL;
const savedApi = localStorage.getItem('etuvendo_api_base');
const defaultApi = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? localApi : productionApi;
const configuredApi = ((environmentApi && !environmentApi.includes('api-votre-compte') ? environmentApi : '') || savedApi || defaultApi).replace(/\/$/, '');
export const API_BASE = configuredApi.endsWith('/api') ? configuredApi : configuredApi + '/api';
export const getToken = () => localStorage.getItem('etuvendo_token');
export const getUser = () => { try { return JSON.parse(localStorage.getItem('etuvendo_user') || 'null'); } catch { return null; } };
export const setSession = p => { localStorage.setItem('etuvendo_token', p.token); localStorage.setItem('etuvendo_user', JSON.stringify(p.utilisateur)); };
export const clearSession = () => { localStorage.removeItem('etuvendo_token'); localStorage.removeItem('etuvendo_user'); };
let activeLoaders = 0;
const loadingOverlay = () => {
  let node = document.getElementById('etuvendo-global-loading');
  if (!node) { node = document.createElement('div'); node.id = 'etuvendo-global-loading'; node.innerHTML = '<div class="global-loading-card"><div class="operation-spinner"></div><strong>Veuillez patienter…</strong><div class="progress-track"><span></span></div><small>Chargement en cours</small></div>'; document.body.appendChild(node); }
  return node;
};
const startLoading = message => { activeLoaders += 1; const node = loadingOverlay(); node.querySelector('strong').textContent = message; return progress => { const bar = node.querySelector('.progress-track span'); if (progress != null) { bar.style.width = `${progress}%`; node.querySelector('small').textContent = `${progress}%`; } else { bar.classList.add('indeterminate'); } }; };
const stopLoading = () => { activeLoaders = Math.max(0, activeLoaders - 1); if (!activeLoaders) document.getElementById('etuvendo-global-loading')?.remove(); };
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
  const showLoading = body instanceof FormData || /^\/auth\/(connexion|inscription)/.test(path);
  const updateLoading = showLoading ? startLoading(body instanceof FormData ? 'Envoi en cours…' : 'Veuillez patienter…') : () => {};
  if (showLoading && !(body instanceof FormData)) updateLoading();
  if (body instanceof FormData && progressCallback) {
    let data;
    try { data = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'POST', API_BASE + path);
      xhr.setRequestHeader('Accept', 'application/json');
      const authToken = getToken();
      if (authToken) xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.upload.onprogress = event => { if (event.lengthComputable) { const percent = Math.round((event.loaded / event.total) * 100); progressCallback(percent); updateLoading(percent); } };
      xhr.onerror = () => reject(new Error('Connexion impossible avec le serveur. Vérifie ta connexion internet.'));
      xhr.onload = () => { let parsed = null; try { parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { parsed = null; } if (xhr.status < 200 || xhr.status >= 300) reject(new Error(xhr.status === 401 ? 'Ta session a expiré. Reconnecte-toi avant de publier.' : errorText(parsed, xhr.status))); else resolve(parsed); };
      xhr.send(body);
      }); } finally { if (showLoading) stopLoading(); }
    return data;
  }
  try {
    const response = await fetch(API_BASE + path, { ...options, headers, body });
    const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) throw new Error(errorText(data, response.status));
    return data;
  } finally { if (showLoading) stopLoading(); }
}
