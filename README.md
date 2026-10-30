# Gestion des courriers d'une agence — API Zendesk

Architecture 3 niveaux : Frontend (HTML/JS) -> Backend (Node/Express, passerelle BFF) -> API Zendesk.

## Prérequis
- Node.js 18 ou plus (https://nodejs.org)

## Lancement rapide (mode simulation, sans compte Zendesk)
1. Décompressez le dossier, ouvrez un terminal dedans :
   cd courriers-zendesk
2. Vérifiez que le fichier `.env` contient :
   ZENDESK_MODE=mock
   (s'il n'existe pas : copiez `.env.example` en `.env`)
3. Installez les dépendances :
   npm install
4. Démarrez :
   npm start
5. Ouvrez http://localhost:3000

Note : en simulation, les courriers sont en mémoire et disparaissent à l'arrêt du serveur.

## Passer au vrai Zendesk
1. Dans Zendesk : Centre d'administration -> Apps et intégrations -> API -> activer l'accès par jeton -> créer un jeton.
2. Dans `.env` : supprimez la ligne ZENDESK_MODE=mock puis renseignez
   ZENDESK_SUBDOMAIN (ex. monagence pour monagence.zendesk.com)
   ZENDESK_EMAIL (e-mail de l'agent propriétaire du jeton)
   ZENDESK_API_TOKEN (le jeton)
3. Relancez : npm start

## Test rapide de l'API
curl -X POST localhost:3000/api/courriers -H "Content-Type: application/json" -d '{"type":"entrant","objet":"Lettre de la mairie","contenu":"Convocation","priorite":"high"}'

## Routes de l'API interne
GET /api/courriers?type=&statut=&q=&page=   liste paginée
GET /api/courriers/:id                      détail + notes
POST /api/courriers                         création
PUT /api/courriers/:id                      statut / priorité
POST /api/courriers/:id/notes               ajout d'une note
DELETE /api/courriers/:id                   suppression
GET /api/stats                              compteurs
