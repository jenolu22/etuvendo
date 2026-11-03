# Déploiement EtuVendo sur Vercel

## Configuration du projet

- Root Directory : `web`
- Framework : Vite
- Build Command : `npm run build`
- Output Directory : `dist`
- Install Command : `npm install`

## Variable Vercel

Créer la variable `VITE_API_URL` dans Preview et Production :

```text
https://api-votre-compte.alwaysdata.net
```

Le frontend ajoute automatiquement `/api` si nécessaire.

## Déploiement local

```bash
npm install
npm run build
npx vercel --prod
```

Ne téléverse jamais `.env`, `node_modules` ou `dist` dans le dépôt.
