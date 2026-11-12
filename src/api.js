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
const typingRequests = new Map();
const loadingOverlay = () => {
  let node = document.getElementById('etuvendo-global-loading');
  if (!node) { node = document.createElement('div'); node.id = 'etuvendo-global-loading'; node.innerHTML = '<div class="global-loading-card"><div class="operation-spinner"></div><strong>Veuillez patienter…</strong><div class="progress-track"><span></span></div><small>Chargement en cours</small></div>'; document.body.appendChild(node); }
  return node;
};
const startLoading = message => { activeLoaders += 1; const node = loadingOverlay(); node.querySelector('strong').textContent = message; return progress => { const bar = node.querySelector('.progress-track span'); if (progress != null) { bar.style.width = `${progress}%`; node.querySelector('small').textContent = `${progress}%`; } else { bar.classList.add('indeterminate'); } }; };
const stopLoading = () => { activeLoaders = Math.max(0, activeLoaders - 1); if (!activeLoaders) document.getElementById('etuvendo-global-loading')?.remove(); };
const errorText = (data, status) => {
  const firstField = data?.errors ? Object.keys(data.errors)[0] : '';
  const raw = data?.message || data?.erreur || (firstField ? Object.values(data.errors).flat()[0] : 'Erreur API EtuVendo');
  const text = String(raw).toLowerCase();
  if (data?.code === 'OTP_EMAIL_SEND_FAILED') return 'Ton adresse email a été acceptée, mais le service EtuVendo n’a pas réussi à envoyer le code. Ce n’est pas une erreur d’adresse. Réessaie dans quelques minutes ; si le problème continue, contacte l’administrateur.';
  if (text.includes('envoyer le code') || text.includes('code de vérification')) return 'Le service EtuVendo n’a pas réussi à envoyer le code. Vérifie ta connexion et réessaie dans quelques minutes.';
  if (firstField === 'email' && (text.includes('already been taken') || text.includes('unique') || text.includes('déjà utilisé') || text.includes('has already'))) return 'Cette adresse email est déjà utilisée. Essaie de te connecter.';
  if (firstField === 'email' && (text.includes('valid') || text.includes('format'))) return 'Cette adresse email semble invalide. Vérifie son orthographe.';
  if (firstField === 'email' && (text.includes('required') || text.includes('obligatoire'))) return 'Saisis ton adresse email.';
  if (firstField === 'mot_de_passe' && (text.includes('at least') || text.includes('min') || text.includes('8'))) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (firstField === 'institution_id') return 'Choisis une institution valide dans la liste.';
  if (text.includes('already been taken') || text.includes('déjà utilisé') || text.includes('has already')) return 'Cette adresse email est déjà utilisée.';
  if (text.includes('invalid credentials') || text.includes('identifiants') || text.includes('unauthenticated') || (status === 401 && text.includes('password'))) return 'Adresse email ou mot de passe incorrect.';
  if (text.includes('password') && (text.includes('incorrect') || text.includes('wrong'))) return 'Mot de passe incorrect.';
  if (status === 422 && !data?.errors) return 'Les informations saisies sont invalides. Vérifie les champs.';
  if (status === 408 || status === 504) return 'Le serveur met trop de temps à répondre. Vérifie ta connexion et réessaie.';
  if (status === 429) return 'Trop de tentatives en peu de temps. Attends un instant avant de réessayer.';
  if (status === 503 && data?.code === 'OTP_EMAIL_SEND_FAILED') return 'Le service email est momentanément indisponible. Ton inscription n’a pas été finalisée ; réessaie dans quelques minutes.';
  if (status === 503 || status === 502) return 'Le serveur est temporairement indisponible. Réessaie dans quelques instants.';
  if (status === 413) return 'Le fichier est trop volumineux. La limite est de 16 Mo.';
  if (status >= 500) return 'Une erreur interne est survenue sur le serveur. Réessaie dans un instant.';
  return raw;
};
const notifyExpiredSession = status => {
  if (status === 401 && getToken()) window.dispatchEvent(new Event('etuvendo:session-expired'));
};
export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const token = getToken(); if (token) headers.Authorization = 'Bearer ' + token;
  const method = (options.method || 'GET').toUpperCase();
  const conversationCache = method === 'GET' && path.startsWith('/conversations/');
  const cacheable = method === 'GET' && (path === '/institutions' || path === '/annonces' || path.startsWith('/annonces?') || conversationCache);
  const cacheKey = 'etuvendo_cache:' + path;
  const cacheTtl = conversationCache ? 2000 : 30000;
  if (method !== 'GET' && path.startsWith('/conversations/')) {
    try { Object.keys(sessionStorage).filter(key => key.startsWith('etuvendo_cache:/conversations/')).forEach(key => sessionStorage.removeItem(key)); } catch {}
  }
  if (cacheable) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (cached && Date.now() - cached.time < cacheTtl) return cached.data;
    } catch {}
  }
  let body = options.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  // La saisie dans le chat peut déclencher plusieurs événements par seconde.
  // On garde au maximum un signal « en train d'écrire » toutes les 2 secondes.
  if (path.endsWith('/typing') && body) {
    try {
      const payload = JSON.parse(body);
      if (payload.ecrit === true) {
        const last = typingRequests.get(path) || 0;
        if (Date.now() - last < 2000) return { ok: true, ignore: true };
        typingRequests.set(path, Date.now());
      } else {
        typingRequests.delete(path);
      }
    } catch {}
  }
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
      xhr.onload = () => { let parsed = null; try { parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { parsed = null; } if (xhr.status < 200 || xhr.status >= 300) { notifyExpiredSession(xhr.status); reject(new Error(xhr.status === 401 ? 'Ton compte a été supprimé ou ta session a expiré.' : errorText(parsed, xhr.status))); } else resolve(parsed); };
      xhr.send(body);
      }); } finally { if (showLoading) stopLoading(); }
    return data;
  }
  try {
    const response = await fetch(API_BASE + path, { ...options, headers, body });
    const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) { notifyExpiredSession(response.status); throw new Error(response.status === 401 ? 'Ton compte a été supprimé ou ta session a expiré.' : errorText(data, response.status)); }
    if (cacheable) { try { sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data })); } catch {} }
    return data;
  } catch (error) {
    if (error instanceof TypeError || error?.name === 'NetworkError' || error?.name === 'AbortError') {
      throw new Error('Connexion impossible au serveur. Vérifie Internet puis réessaie. Si le réseau fonctionne, le serveur est peut-être en veille.');
    }
    throw error;
  } finally { if (showLoading) stopLoading(); }
}
