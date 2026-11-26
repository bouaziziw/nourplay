# 📱 Guide Maître Pas-à-Pas : Publication de NourPlay sur Google Play Console
*(Android Mobile & Google TV / Android TV)*

Ce document est votre guide officiel pas-à-pas pour publier l'application mobile et TV **NourPlay** sur la **Google Play Console**.  
Chaque étape vous indique **où cliquer**, **quoi saisir (textes prêts à copier-coller)**, et **quels fichiers déposer**.

---

## 📑 Sommaire
- [1. Informations Clés du Projet & Fichiers Prêts](#1-informations-clés-du-projet--fichiers-prêts)
- [2. Étape 1 : Création de l'Application sur la Console](#2-étape-1--création-de-lapplication-sur-la-console)
- [3. Étape 2 : Fiche Principale du Play Store (Textes & Visuels)](#3-étape-2--fiche-principale-du-play-store-textes--visuels)
- [4. Étape 3 : Déclarations Réglementaires (Contenu de l'Application)](#4-étape-3--déclarations-réglementaires-contenu-de-lapplication)
  - [4.1. Règles de confidentialité](#41-règles-de-confidentialité)
  - [4.2. Accès pour l'évaluation (Credentials de test)](#42-accès-pour-lévaluation-credentials-de-test)
  - [4.3. Annonces publicitaires](#43-annonces-publicitaires)
  - [4.4. Questionnaire de classification IARC](#44-questionnaire-de-classification-iarc)
  - [4.5. Public cible et Familles (COPPA)](#45-public-cible-et-familles-coppa)
  - [4.6. Sécurité des données (Data Safety)](#46-sécurité-des-données-data-safety)
  - [4.7. Applications d'actualités, financières et gouvernementales](#47-applications-dactualités-financières-et-gouvernementales)
- [5. Étape 4 : Activer le format Android TV / Google TV](#5-étape-4--activer-le-format-android-tv--google-tv)
- [6. Étape 5 : Téléversement du Fichier .AAB](#6-étape-5--téléversement-du-fichier-aab)
- [7. Étape 6 : La Phase de Test (20 Testeurs pendant 14 Jours)](#7-étape-6--la-phase-de-test-20-testeurs-pendant-14-jours)
- [8. Étape 7 : Déploiement en Production et Validation Google](#8-étape-7--déploiement-en-production-et-validation-google)
- [9. Checklist Finale Anti-Rejet](#9-checklist-finale-anti-rejet)

---

## 1. Informations Clés du Projet & Fichiers Prêts

| Paramètre | Valeur pour NourPlay |
| :--- | :--- |
| **Package ID / Identifiant** | `app.nourplay.mobile` |
| **Nom de l'application** | `NourPlay` (ou `NourPlay - Streaming & Famille`) |
| **Type** | Application (Catégorie : Divertissement / Famille) |
| **Prix** | Gratuite |
| **Bundle Android (.aab)** | `apps/mobile/nourplay-production-v4.aab` (53,6 Mo) |
| **Dossier des visuels** | `apps/mobile/assets/` |
| **URL Politique de Confidentialité** | `https://nour-play.app/fr/legal/privacy` |
| **URL Support / Contact** | `contact@nour-play.app` ou `https://nour-play.app` |

---

## 2. Étape 1 : Création de l'Application sur la Console

1. Connectez-vous à la [Google Play Console](https://play.google.com/console).
2. Cliquez sur le bouton bleu **« Créer une application »** en haut à droite.
3. Remplissez le formulaire initial :
   - **Nom de l'application** : `NourPlay`
   - **Langue par défaut** : `Français (France) - fr-FR`
   - **Type d'application** : Cochez **Application** (et non Jeu)
   - **Gratuite ou payante** : Cochez **Gratuite**
4. **Déclarations** :
   - Cochez la case *« Confirmer le respect des Règles relatives au programme pour les développeurs »*.
   - Cochez la case *« Accepter les lois américaines sur l'exportation »*.
5. Cliquez sur le bouton **« Créer une application »** en bas à droite.

---

## 3. Étape 2 : Fiche Principale du Play Store (Textes & Visuels)

Dans le menu de gauche, allez dans **Développer l'audience** > **Présence sur le Play Store** > **Fiche principale du Play Store**.

### A. Champs Textuels à Copier-Coller

#### 1. Nom de l'application (max. 30 caractères) :
```text
NourPlay
```

#### 2. Description courte (max. 80 caractères) :
```text
Plateforme de streaming vidéo sécurisée et éducative pour enfants et familles.
```

#### 3. Description complète (max. 4 000 caractères) :
```text
NourPlay est la plateforme de streaming vidéo pensée et conçue spécialement pour les enfants et les parents soucieux de la sécurité numérique.

Offrez à vos enfants un divertissement enrichissant et sans danger, loin des contenus inadaptés et des algorithmes incontrôlés.

🌟 UN ESPACE 100% SÉCURISÉ POUR LES ENFANTS
- Aucun algorithme toxique ni recommandation aléatoire.
- Sélection rigoureuse de vidéos éducatives, bienveillantes et épanouissantes.
- Aucune publicité intrusive ou non adaptée au jeune public.

👶 PROFILS ENFANTS PERSONNALISÉS
- Interface ludique, intuitive et entièrement adaptée aux plus jeunes.
- Chaque enfant accède uniquement aux playlists autorisées pour sa tranche d'âge.

🛡️ ESPACE PARENT PROTÉGÉ
- Accès sécurisé par mot de passe et code PIN parental.
- Gestion simplifiée des vidéos et playlists autorisées.
- Minuteur de temps d'écran : définissez une durée maximale quotidienne avec arrêt automatique.
- Historique de visionnage transparent pour suivre ce que vos enfants regardent en toute sérénité.

📺 COMPATIBLE GOOGLE TV & ANDROID TV
- Profitez de NourPlay sur grand écran en famille.
- Navigation ultra-fluide à la télécommande (flèches directionnelles et bouton validation).
- Mode paysage natif et affichage optimisé pour le salon.

Rejoignez NourPlay dès aujourd'hui et offrez à vos enfants le meilleur du divertissement vidéo familial !
```

---

### B. Dépôt des Éléments Graphiques

Tous les fichiers sont déjà présents et prêts dans le projet au chemin :  
`apps/mobile/assets/`

| Zone sur la Play Console | Fichier à glisser-déposer | Spécifications |
| :--- | :--- | :--- |
| **Icône de l'application** | `apps/mobile/assets/icon.png` | 512 x 512 px, PNG 32 bits |
| **Graphique des fonctionnalités (Bannière)** | `apps/mobile/assets/feature-graphic.png` | 1024 x 500 px, PNG/JPG sans transparence |
| **Captures d'écran pour téléphone** | Déposer les 2 fichiers :<br>1. `apps/mobile/assets/screenshot-mobile-1.png`<br>2. `apps/mobile/assets/screenshot-mobile-2.png` | Format 9:16 (1080 x 1920 px) |
| **Captures d'écran pour Android TV** | Déposer :<br>`apps/mobile/assets/screenshot-tv-1.png` | Format 16:9 (1920 x 1080 px) |
| **Bannière pour Android TV** | Déposer :<br>`apps/mobile/assets/tv-banner.png` | Format 16:9 (320 x 180 px) |

Cliquez sur **« Enregistrer »** en bas à droite.

---

## 4. Étape 3 : Déclarations Réglementaires (Contenu de l'Application)

Dans le menu de gauche, descendez jusqu'à **Règles et programmes** > **Contenu de l'application**.  
Vous devez obligatoirement valider **chaque section** ci-dessous :

---

### 4.1. Règles de confidentialité
- **Lien à renseigner** :
  ```text
  https://nour-play.app/fr/legal/privacy
  ```
- Cliquez sur **Enregistrer**.

---

### 4.2. Accès pour l'évaluation (Credentials de test pour Google)
Google doit pouvoir tester l'espace membre et l'espace parent.
1. Sélectionnez : **« Tout ou partie des fonctionnalités sont restreintes »**.
2. Cliquez sur **« Ajouter des instructions »** :
   - **Nom de l'accès** : `Évaluateur Google Play`
   - **Nom d'utilisateur / E-mail** : Créez un compte test sur votre plateforme (ex: `reviewer-playstore@nour-play.app`)
   - **Mot de passe** : Le mot de passe associé
   - **Code PIN Parent** : `1234`
   - **Remarques / Instructions supplémentaires** :
     ```text
     Identifiants pour accéder à l'accueil parent et aux profils enfants. Le code PIN parental par défaut est 1234. L'application ne requiert aucun matériel spécifique en dehors d'une connexion Internet.
     ```
3. Cochez la case de confirmation et cliquez sur **Enregistrer**.

---

### 4.3. Annonces publicitaires
- Question : *Votre application contient-elle des annonces ?*
- Sélectionnez : **« Non, mon application ne contient pas d'annonces »**.
- Cliquez sur **Enregistrer**.

---

### 4.4. Questionnaire de classification IARC
1. Cliquez sur **Commencer le questionnaire**.
2. **Adresse e-mail** : Saisissez votre e-mail de contact (ex: `contact@nour-play.app`).
3. **Catégorie** : Choisissez **Divertissement** ou **Tous les autres types d'applications**.
4. Réponses aux questions :
   - Violence : **Non**
   - Sexualité / Nudité : **Non**
   - Langage ordurier : **Non**
   - Substances contrôlées / Drogues / Alcool : **Non**
   - Jeux d'argent : **Non**
   - Échange de messages sans modération : **Non**
   - Partage de la position géographique physique avec autrui : **Non**
   - Achat d'articles numériques (sans passer par Google) : **Non**
5. Cliquez sur **Enregistrer** > **Suivant** > **Envoyer**.
   *(Votre application obtiendra la note **PEGI 3 / Tout public**).*

---

### 4.5. Public cible et Familles (COPPA)
*Étant une application familiale et éducative pour enfants, suivez ces choix avec précision :*

1. **Tranches d'âge ciblées** :
   - Cochez :
     - ☑️ **5 ans et moins**
     - ☑️ **6 à 8 ans**
     - ☑️ **9 à 12 ans**
     - ☑️ **13 ans et plus** (parents)
2. Cliquez sur **Suivant**.
3. **Attrait pour les enfants** :
   - Si demandé : *L'application est-elle conçue spécialement pour les enfants ?* Répondez **Oui**.
4. **Règles relatives aux familles** :
   - Confirmez le respect des règles Google Play pour les familles et la loi COPPA.
   - Confirmez que le SDK utilisé ne collecte aucune donnée personnelle d'enfants sans consentement parental.
5. Cliquez sur **Enregistrer**.

---

### 4.6. Sécurité des données (Data Safety)
*Google compare vos réponses aux bibliothèques présentes dans le code de l'application.*

1. **Collecte et partage de données** :
   - Votre application collecte-t-elle ou partage-t-elle des données utilisateur requises ? -> **Oui**.
   - Toutes les données collectées sont-elles chiffrées en transit ? -> **Oui** (protocole HTTPS / TLS).
   - Proposez-vous un moyen pour que l'utilisateur demande la suppression de ses données ? -> **Oui** (URL : `https://nour-play.app/fr/legal/privacy` ou via l'espace profil).
2. **Types de données collectées** :
   - **Informations personnelles** :
     - ☑️ **Adresse e-mail** (pour l'authentification et gestion du compte parent).  
       *Préciser : Collectée = Oui, Partagée = Non, Traitement temporaire = Non, Obligatoire = Oui, Finalité = Fonctionnalité de l'application / Gestion du compte.*
   - **Identifiants de l'appareil ou autres identifiants** :
     - ☑️ **Identifiant de l'appareil** (pour les tokens de notification push Expo).  
       *Préciser : Collectée = Oui, Partagée = Non, Obligatoire = Non (facultatif), Finalité = Fonctionnalité de l'application.*
   - **Toutes les autres catégories** (Emplacement, Données financières, Santé, Photos/Vidéos, SMS, Contacts) : **Ne rien cocher (Non collectées)**.
3. Cliquez sur **Enregistrer** et confirmez le résumé.

---

### 4.7. Déclarations Complémentaires
Vérifiez dans la même page que :
- **Applications d'actualités** : Répondre **Non**.
- **Applications d'alerte COVID-19** : Répondre **Non**.
- **Fonctionnalités financières** : Répondre **Mon application ne fournit aucune fonctionnalité financière**.
- **Applications gouvernementales** : Répondre **Non**.

---

## 5. Étape 4 : Activer le format Android TV / Google TV

Pour que NourPlay apparaisse et s'installe sur les Smart TV, box Android TV et Chromecast avec Google TV :

1. Dans le menu de gauche, allez dans **Configuration** > **Formats d'appareils** (ou **Paramètres avancés** selon votre version de la console).
2. Cliquez sur l'onglet **Android TV**.
3. Cliquez sur **« Activer / Participer »**.
4. Google vérifie la conformité suivante (déjà configurée dans le projet) :
   - ✅ Bannière Android TV 16:9 (`tv-banner.png`, 320x180 px)
   - ✅ Capture d'écran TV 16:9 (`screenshot-tv-1.png`, 1920x1080 px)
   - ✅ Déclaration `android.software.leanback` et `android.hardware.touchscreen=false` intégrées au build.

---

## 6. Étape 5 : Téléversement du Fichier .AAB

### Quel fichier utiliser ?
Le bundle optimisé se trouve à cet emplacement sur votre machine :
```text
D:\DEV\nourplay\apps\mobile\nourplay-production-v4.aab
```

*(Si vous souhaitez recompiler une nouvelle version dans le futur, la commande est :)*
```bash
pnpm --filter @nourplay/mobile build:prod
```

### Procédure de téléversement :
1. Dans le menu de gauche, allez dans **Tests** > **Test fermé** (ou **Production** si votre compte est un compte entreprise déjà débloqué).
2. Cliquez sur **Créer une version**.
3. **Signature de l'application (Play App Signing)** :
   - Cliquez sur **« Choisir la clé de signature »** > **« Utiliser une clé générée par Google »** (recommandé).
4. **Fichiers App Bundle** :
   - Glissez-déposez le fichier `nourplay-production-v4.aab` dans l'encadré.
   - Attendez la fin de la vérification (100%). Google affiche alors le versionCode (ex: `4`) et la taille de téléchargement optimisée.
5. **Nom de la version** : `1.0.0 (v4)`
6. **Notes de version (Ce qui change dans cette version)** :  
   Copiez-collez le texte suivant :
   ```xml
   <fr-FR>
   Lancement officiel de NourPlay :
   - Plateforme de streaming vidéo sécurisée et éducative pour enfants et familles.
   - Profils enfants personnalisés et gestion du temps d'écran parental.
   - Protection de l'espace parent par code PIN sécurisé.
   - Expérience optimisée sur smartphones, tablettes et téléviseurs Google TV / Android TV.
   </fr-FR>
   ```
7. Cliquez sur **Enregistrer** puis sur **Vérifier la version**.

---

## 7. Étape 6 : La Phase de Test (Obligation des 20 Testeurs pendant 14 Jours)

> ⚠️ **Important pour les comptes personnels récents (post 13/11/2023)** :  
> Google exige qu'au moins **20 testeurs** soient inscrits à un **Test fermé (Closed Testing)** et gardent l'application installée pendant **14 jours consécutifs** avant que le bouton de mise en production ne soit débloqué.

### Comment configurer le test fermé :
1. Dans le menu de gauche, cliquez sur **Tests** > **Test fermé**.
2. Dans l'onglet **Testeurs** :
   - Cliquez sur **Créer une liste d'adresses e-mail**.
   - Nommez la liste (ex: `Testeurs NourPlay`).
   - Saisissez les 20+ adresses Gmail de vos proches/collègues/testeurs.
   - Cliquez sur **Enregistrer les modifications**.
3. Associez cette liste à votre piste de test fermé.
4. Récupérez le lien d'invitation :
   - Descendez à la section **« Comment les testeurs rejoignent votre test »**.
   - Copiez le **Lien Web** (ex: `https://play.google.com/apps/testing/app.nourplay.mobile`) ou le **Lien Android**.
5. Envoyez ce lien à vos 20 testeurs :
   - Ils doivent cliquer sur **Accepter l'invitation**.
   - Télécharger l'application depuis le Play Store sur leur téléphone Android.
   - Ouvrir l'application et la garder installée pendant les 14 jours.
6. Au 14ème jour, l'indicateur sur le tableau de bord de la console passe au vert. Un bouton **« Demander l'accès à la production »** devient cliquable.

---

## 8. Étape 7 : Déploiement en Production et Validation Google

Une fois l'accès à la production débloqué (ou immédiatement si compte Organisation) :

1. Dans le menu de gauche, allez dans **Mise en production** > **Production**.
2. Cliquez sur **Créer une version**.
3. Sélectionnez le bundle `nourplay-production-v4.aab` (ou promouvez la version test fermé existante en un clic).
4. Allez dans l'onglet **Pays et régions** :
   - Cliquez sur **Ajouter des pays/régions**.
   - Sélectionnez tous les pays visés (ex: France, Belgique, Suisse, Canada, Monde entier).
5. Cliquez sur **Vérifier la version**.
6. Assurez-vous qu'il n'y a **aucune erreur bloquante rouge** (les avertissements jaunes informatifs sont tolérés).
7. Cliquez sur le bouton bleu final : **« Démarrer le déploiement en production »** *(Start rollout to Production)*.

### Délais d'examen :
- L'équipe de modération de Google inspecte l'application.
- Pour une première version avec public enfant (Programme Famille), le délai moyen est de **3 à 7 jours ouvrés**.
- Vous recevrez un e-mail dès la validation. L'application apparaîtra publiquement dans la recherche Google Play sous quelques heures après approbation.

---

## 9. Checklist Finale Anti-Rejet

Avant de cliquer sur le bouton final, vérifiez ces 5 points capitaux :

- [ ] **Compte de test fonctionnel** : L'identifiant et mot de passe saisis dans *Contenu de l'application > Accès pour l'évaluation* permettent bien de se connecter sans bloquer l'évaluateur.
- [ ] **Lien Politique de Confidentialité actif** : La page `https://nour-play.app/fr/legal/privacy` est consultable publiquement sur internet sans mot de passe.
- [ ] **Data Safety cohérente** : Vous avez bien déclaré la collecte de l'adresse e-mail et des tokens push, sans déclarer de fausses collectes inutiles.
- [ ] **Code PIN Parent documenté** : Le code PIN par défaut `1234` est mentionné dans les remarques à destination de Google.
- [ ] **Pas de permissions interdites** : Le fichier `AndroidManifest.xml` ne contient aucune permission sensible non déclarée (ex: SMS, géolocalisation d'arrière-plan).
