import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/theme.css';
import '../styles/app.css';
import App from './App.jsx';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('EtuVendo : enregistrement hors ligne indisponible.', error);
    });
  });
}

createRoot(document.getElementById('app')).render(<App />);
