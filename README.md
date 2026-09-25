# Avenirs · Espace parents

Prototype d'application web mobile destinée aux parents de l'association **Avenirs**.
Toutes les données (enfants, compétences, livres, sorties, allergies) sont lues et écrites
en direct dans la base Airtable **« Avenirs Application »**, qui reste la source de vérité.

## Fonctionnalités

| Écran | Contenu | Source Airtable |
|---|---|---|
| Connexion | Identifiant + mot de passe, session sécurisée de 7 jours | variables d'environnement |
| Accueil | Photo et prénom de chaque enfant | `Enfants` → Prénom, Photo |
| Profil | Photo, prénom, compétences acquises, compétences en cours, livre du moment (couverture, titre, auteur) | `Enfants` |
| Agenda | Sorties de l'enfant (image, titre, date, horaires, lieu) | `Événements` liés à l'enfant |
| Détail d'une sortie | Image agrandissable, résumé, allergies de l'enfant, bouton « Ajouter une allergie » | `Événements` |
| Allergies | Allergies déjà renseignées (retirables) + ajout par sélection rapide ou saisie libre | `Enfants` → Allergies (écriture) |

La barre d'onglets (Profil / Agenda / Allergies) garde le même enfant d'un écran à l'autre, et
le sélecteur en haut permet de changer d'enfant à tout moment.

## Architecture

```
public/            Interface (HTML/CSS/JS, aucune dépendance) — servie telle quelle
  index.html
  app.js           Application monopage (routes #/…)
  styles.css       Charte Avenirs : #C9DAF8, #FCE5CD, blanc, noir · Space Mono / Open Sans
  assets/          Logos extraits de la charte graphique, icônes
  images/          Copies des photos Airtable (enfants, couvertures, sorties)
api/               Fonctions serverless Vercel (Node) — seul endroit qui parle à Airtable
  login.js  logout.js  me.js
  children.js      GET liste / profil d'un enfant
  events.js        GET sorties d'un enfant / détail d'une sortie
  allergies.js     POST ajout / DELETE retrait d'une allergie
lib/
  schema.js        Identifiants des tables et champs Airtable
  airtable.js      Client Airtable (fetch natif)
  data.js          Transformation des données Airtable
  auth.js          Mot de passe (scrypt) + cookie de session signé (HMAC)
  http.js          Utilitaires HTTP, protection CSRF, gestion d'erreurs
scripts/
  hash-password.mjs  Génère l'empreinte du mot de passe + la clé de session
  dev-server.mjs     Serveur local (équivalent de Vercel)
```

Aucune dépendance npm : uniquement Node ≥ 20 (fetch et crypto natifs).

### Données Airtable utilisées

- **Enfants** : ID, Prénom, Photo, Compétences Acquises, Compétences en cours, Livre, Auteur,
  Image de couverture, Allergies, Evenement (lien).
- **Événements** : Titre, Date Début, Heure Début, Date Fin, Heure Fin, Lieu, Résumé, Image, Enfants (lien).
- Relation **Enfants ↔ Événements** (plusieurs à plusieurs) : l'agenda d'un enfant affiche
  uniquement les sorties liées à sa fiche ; le détail d'une sortie n'est accessible que si elle
  concerne l'enfant sélectionné.
- Les compétences sont saisies dans un texte séparé par des virgules (ou des retours à la ligne) ;
  les allergies sont stockées dans le champ texte « Allergies », séparées par des virgules.
- **Images** : les photos sont aussi embarquées dans le code (`public/images`). Pour chaque pièce
  jointe Airtable, si un fichier du même nom existe dans `public/images` (voir `lib/local-images.js`),
  l'app affiche cette copie (lien permanent) ; sinon elle affiche l'image hébergée par Airtable.
  C'est toujours Airtable qui décide quelle image va avec quel enfant ou quelle sortie.
- Les champs sont référencés par leur identifiant (`fld…`) : on peut les renommer dans Airtable
  sans casser l'application.

### Sécurité

- Le jeton Airtable n'existe que dans les variables d'environnement du serveur ; le navigateur
  n'appelle que `/api/*`. Rien de secret n'est versionné (`.env*` est ignoré par git).
- Mot de passe stocké sous forme d'empreinte **scrypt**, comparaison à temps constant,
  limitation des tentatives de connexion.
- Session : cookie `HttpOnly`, `Secure`, `SameSite=Lax`, signé HMAC-SHA256, expiration 7 jours.
- Toutes les routes `/api` (sauf connexion) exigent une session valide.
- Écritures protégées contre le CSRF (JSON obligatoire + vérification de l'origine).
- Identifiants d'enregistrements validés (`rec` + 14 caractères) avant toute formule Airtable.
- En-têtes de sécurité (CSP stricte, `X-Frame-Options`, HSTS…) définis dans `vercel.json`.
- Réponses API en `Cache-Control: no-store` (les liens d'images Airtable expirent au bout de
  quelques heures : ils sont redemandés à chaque affichage).

## Mise en ligne sur Vercel

1. **Créer un jeton Airtable** sur https://airtable.com/create/tokens :
   scopes `data.records:read` et `data.records:write`, accès limité à la base « Avenirs Application ».
2. **Générer l'empreinte du mot de passe et la clé de session** :
   ```bash
   npm run hash-password -- "Avenirs2026"
   ```
3. Sur https://vercel.com/new, importer le dépôt GitHub (Framework preset : **Other**, aucune commande de build).
4. Dans **Settings → Environment Variables**, ajouter :

   | Nom | Valeur |
   |---|---|
   | `AIRTABLE_TOKEN` | le jeton de l'étape 1 |
   | `AIRTABLE_BASE_ID` | `appea8c2vWQ77ud45` |
   | `PARENT_USERNAME` | `Yannick` |
   | `PARENT_PASSWORD_HASH` | valeur générée à l'étape 2 |
   | `SESSION_SECRET` | valeur générée à l'étape 2 |

5. Déployer (ou « Redeploy » après avoir ajouté les variables).

## Développement local

```bash
cp .env.example .env.local   # puis compléter les valeurs
npm run dev                  # http://localhost:3000
```

## Pistes d'évolution

- Table `Parents` dans Airtable (identifiant, empreinte, enfants liés) pour gérer plusieurs familles.
- Table `Allergènes` dans Airtable pour piloter la liste de sélection rapide.
- Séparer sorties à venir / passées dans l'agenda.
