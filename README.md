# Planning famille

App familiale : agenda des rendez-vous, liste de courses (les enfants proposent, un parent valide) et listes de vœux pour les anniversaires et Noël (avec réservation secrète).

## Lancer en local

```bash
npm install
npm run dev
```

Sans config Firebase, l'app tourne en **mode test** : les données restent sur l'appareil. Pratique pour essayer, mais rien n'est partagé entre les téléphones.

## Brancher Firebase (pour partager entre tous)

1. Console Firebase : créer un projet (ou réutiliser celui de FamilyChat), puis ajouter une **application Web** et copier la config.
2. Copier `.env.example` en `.env` et remplir les 6 valeurs.
3. **Authentication** > Méthode de connexion > activer **Anonyme**.
4. **Firestore Database** > créer la base, puis onglet **Règles** et coller le contenu de `firestore.rules`.
5. Relancer `npm run dev`. Le premier lancement te fait créer le premier parent.

## Mettre en ligne gratuitement

`npm run build` crée le dossier `dist/`, à déposer sur Firebase Hosting, Netlify ou Vercel (tous gratuits pour ça). Il faut du **https** pour que les codes secrets soient bien protégés.

## Qui peut faire quoi

| | Parent | Enfant |
|---|---|---|
| Agenda | ajoute / supprime, lieu + qui emmène | consulte |
| Courses | ajoute direct, valide ou refuse, coche « acheté » | propose, suit le statut de ses demandes |
| Menus (sous Courses) | modifie les repas de la semaine | voit les menus, ajoute/propose les ingrédients aux courses |
| Corvées | crée/modifie/supprime, voit toute la famille | coche ses propres corvées |
| Vœux | gère toutes les listes | gère sa liste, réserve les cadeaux des autres |
| Famille | ajoute des membres (l'admin change les codes et les dates de naissance) | n'a pas accès |

Les anniversaires (jour + mois obligatoires, année facultative, réglables dans Famille par le parent admin) apparaissent automatiquement avec 🎂 dans l'agenda — ce ne sont pas des rendez-vous stockés, juste calculés à l'affichage.

À savoir : les droits parent/enfant et la réservation secrète sont gérés dans l'interface de l'app. C'est largement suffisant pour une app de famille, mais ce n'est pas une sécurité à toute épreuve face à quelqu'un qui saurait fouiller dans la base.

## Notifications push

Dans 🔔 Notifications, chacun choisit : la veille à 18h, 1h avant chaque rendez-vous, et/ou un résumé du matin (rendez-vous + corvées du jour, à l'heure de son choix). Les parents peuvent aussi cocher « Recevoir aussi les rappels des enfants ». La veille à 18h inclut automatiquement un rappel pour les parents si c'est l'anniversaire de quelqu'un le lendemain.

Tout est envoyé par `scripts/envoyer-rappels.js` (notifications push FCM, via `.github/workflows/rappels.yml`, toutes les 15 min) — il faut le secret GitHub `FIREBASE_SERVICE_ACCOUNT` (clé de compte de service JSON) et la variable `VITE_FIREBASE_VAPID_KEY` dans `.env` pour activer les notifications côté app.
