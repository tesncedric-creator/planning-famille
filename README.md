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
| Agenda | ajoute / supprime | consulte |
| Courses | ajoute direct, valide ou refuse, coche « acheté » | propose, suit le statut de ses demandes |
| Vœux | gère toutes les listes | gère sa liste, réserve les cadeaux des autres |
| Famille | ajoute des membres, change les codes | n'a pas accès |

À savoir : les droits parent/enfant et la réservation secrète sont gérés dans l'interface de l'app. C'est largement suffisant pour une app de famille, mais ce n'est pas une sécurité à toute épreuve face à quelqu'un qui saurait fouiller dans la base.
