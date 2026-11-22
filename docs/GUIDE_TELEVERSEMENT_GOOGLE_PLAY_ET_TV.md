# Guide Ultime : Téléversement et Publication sur Google Play Console (Mobile & Google TV) — NourPlay

Ce document contient l'intégralité des instructions pas à pas, les textes pré-rédigés à copier-coller et la liste des ressources graphiques pour publier l'application **NourPlay** sur la **Google Play Console**, avec la compatibilité **Android Mobile et Google TV / Android TV**.

---

## 📦 1. Fichier de Production Compilé (.aab)

Le bundle de production Android est déjà compilé, signé avec votre clé de production cryptographique et prêt pour le Play Store :

* **Emplacement local sur votre ordinateur** :
  `D:\DEV\nourplay\apps\mobile\nourplay-production.aab` *(Poids : 53,6 Mo)*
* **Lien de téléchargement cloud direct (Expo EAS)** :
  [Télécharger nourplay-production.aab](https://expo.dev/artifacts/eas/KCOcVGqUyQP2cGV0xQ2VtWtv_bTFM9D5601kjdnImR0.aab)
* **Informations techniques du bundle** :
  * **Package Name** : `app.nourplay.mobile`
  * **Version** : `1.0.0`
  * **Version Code** : `3`
  * **SDK** : Expo SDK 58 / React Native 0.88.1
  * **Compatibilité** : Universelle (Smartphones, Tablettes, Box Android TV, Google TV, Chromecast avec Google TV)

---

## 🎨 2. Ressources Graphiques Prêtes à l'Emploi

Tous les fichiers visuels obligatoires ont été générés aux dimensions exactes exigées par Google. Vous les trouverez dans le dossier :
`D:\DEV\nourplay\apps\mobile\assets\`

| Élément | Fichier | Dimensions | Usage |
| :--- | :--- | :--- | :--- |
| **Icône de l'application** | `icon.png` | 512 x 512 px (PNG 32 bits) | Fiche du Store & Écran d'accueil |
| **Graphique de fonctionnalité** | `feature-graphic.png` | 1024 x 500 px (PNG/JPG sans transparence) | Bannière obligatoire du Play Store |
| **Bannière Android TV** | `tv-banner.png` | 320 x 180 px (PNG 16:9 obligatoire) | Carrousel Leanback Google TV |
| **Capture d'écran TV** | `screenshot-tv-1.png` | 1920 x 1080 px (PNG 16:9) | Fiche du Store (onglet Android TV) |
| **Capture Smartphone 1** | `screenshot-mobile-1.png` | 1080 x 1920 px (PNG 9:16) | Fiche du Store (Espace Enfant) |
| **Capture Smartphone 2** | `screenshot-mobile-2.png` | 1080 x 1920 px (PNG 9:16) | Fiche du Store (Contrôle Parental) |

---

## 🚀 3. Procédure Étape par Étape sur la Google Play Console

### Étape 1 : Création de l'application
1. Connectez-vous sur la [Google Play Console](https://play.google.com/console).
2. Cliquez sur le bouton bleu **Créer une application** (en haut à droite).
3. Renseignez :
   * **Nom de l'application** : `NourPlay - Streaming & Famille`
   * **Langue par défaut** : Français (France) – `fr-FR`
   * **Type d'application** : Application
   * **Gratuite ou payante** : Gratuite
4. Cochez les déclarations relatives aux règles de conformité et cliquez sur **Créer l'application**.

---

### Étape 2 : Remplir la Fiche principale du Play Store
Dans le menu de gauche, allez dans **Développer l'audience > Présence sur le Play Store > Fiche principale du Play Store** :

#### 1. Textes de présentation (Copier-coller) :
* **Nom de l'application** (30 car. max) :
  ```text
  NourPlay
  ```
* **Description courte** (80 car. max) :
  ```text
  Plateforme de streaming vidéo sécurisée et éducative pour enfants et familles.
  ```
* **Description complète** (4000 car. max) :
  ```text
  NourPlay est la plateforme de streaming conçue spécialement pour les enfants et les parents soucieux de la sécurité numérique.

  🌟 UN ESPACE 100% SÉCURISÉ POUR LES ENFANTS
  - Aucun algorithme toxique ni recommandation aléatoire.
  - Sélection rigoureuse de vidéos éducatives, bienveillantes et épanouissantes.
  - Aucune publicité intrusive ou non adaptée au jeune public.

  👶 PROFILS ENFANTS PERSONNALISÉS
  - Interface ludique et adaptée aux enfants.
  - Chaque enfant accède uniquement aux playlists autorisées pour son profil.

  🛡️ ESPACE PARENT PROTÉGÉ
  - Accès sécurisé par mot de passe et code PIN parental.
  - Gestion simplifiée des vidéos et playlists autorisées.
  - Minuteur de temps d'écran : définissez une durée maximale quotidienne avec arrêt automatique.
  - Historique de visionnage transparent pour suivre ce que vos enfants regardent.

  📺 COMPATIBLE GOOGLE TV & ANDROID TV
  - Profitez de NourPlay sur grand écran en famille.
  - Navigation ultra-fluide à la télécommande (flèches D-pad et validation).
  - Mode paysage natif et affichage optimisé pour le salon.

  Rejoignez NourPlay pour offrir à vos enfants le meilleur du divertissement vidéo en toute sérénité !
  ```

#### 2. Dépôt des visuels :
* Glissez-déposez `icon.png` dans la case **Icône de l'application**.
* Glissez-déposez `feature-graphic.png` dans la case **Graphique de fonctionnalité**.
* Glissez-déposez `screenshot-mobile-1.png` et `screenshot-mobile-2.png` dans la section **Captures d'écran du téléphone**.
* Glissez-déposez `screenshot-tv-1.png` dans la section **Captures d'écran pour Android TV**.
* Glissez-déposez `tv-banner.png` dans la case **Bannière pour Android TV** (320x180 px).
* Cliquez sur **Enregistrer** (en bas à droite).

---

### Étape 3 : Téléversement du bundle `.aab`
Dans le menu de gauche, allez sous la section **Version** :

1. Cliquez sur **Production** *(ou sur **Test interne** si votre compte demande un test restreint au préalable)*.
2. En haut à droite, cliquez sur le bouton bleu **Créer une version**.
3. **Clé de signature d'application (Play App Signing)** :
   * Si demandé, cliquez sur **Choisir la clé de signature** puis **Utiliser une clé générée par Google**.
4. **Fichiers App Bundle** :
   * Glissez-déposez le fichier `D:\DEV\nourplay\apps\mobile\nourplay-production.aab` dans la zone prévue (ou cliquez sur **Importer**).
   * Attendez que le téléversement atteigne 100 %. Google inspecte et valide automatiquement le bundle.
5. **Nom de la version** : `1.0.0`
6. **Notes de version** (copier-coller) :
   ```xml
   <fr-FR>
   Lancement officiel de NourPlay :
   - Streaming vidéo éducatif et sécurisé pour enfants et familles
   - Profils enfants personnalisés et contrôle du temps d'écran
   - Espace parent protégé par code PIN
   - Compatibilité complète Smartphones, Tablettes et Google TV / Android TV
   </fr-FR>
   ```
7. Cliquez sur **Enregistrer** (en bas à droite).

---

### Étape 4 : Activer la Distribution Android TV / Google TV
Pour que l'application soit téléchargeable directement depuis les téléviseurs et boîtiers TV :

1. Dans le menu de gauche, allez dans **Configuration > Formats d'appareils** (ou **Paramètres avancés > Catégories d'appareils**).
2. Cliquez sur l'onglet **Android TV**.
3. Cliquez sur **Participer / Activer**.
4. Validez les conditions requises :
   * ✅ Bannière Leanback 320x180 px fournie
   * ✅ Capture d'écran TV 16:9 fournie
   * ✅ Aucune dépendance matérielle au tactile (`touchscreen: false` intégré dans le code)
   * ✅ Pilotage possible à la télécommande

---

### Étape 5 : Déclarations Réglementaires (Contenu de l'application)
Dans le menu de gauche, tout en bas, allez dans **Règles > Contenu de l'application** et complétez chaque section :

#### 1. Politique de confidentialité :
* URL publique : `https://nourplay.com/privacy`

#### 2. Accès pour l'évaluation de l'application (Credentials de test) :
* Choisissez : *« Tout ou partie des fonctionnalités sont restreintes »*.
* Ajoutez des identifiants pour que les réviseurs de Google puissent tester :
  * **Nom de l'accès** : Accès Réviseur Google Play
  * **Email / Identifiant** : votre email de test (ex: `reviewer@nourplay.com`)
  * **Mot de passe** : votre mot de passe de test
  * **Code PIN Parent** : `1234`
  * **Instructions supplémentaires** : *« Connectez-vous pour accéder au sélecteur de profils enfants et à l'espace parent protégé par PIN. »*

#### 3. Annonces publicitaires :
* Répondez : **« Non, mon application ne contient pas d'annonces »**.

#### 4. Sécurité des données (Data Safety) :
* Les données sont-elles chiffrées en transit ? **Oui (toutes les connexions utilisent HTTPS)**.
* Proposez-vous aux utilisateurs un moyen de demander la suppression de leurs données ? **Oui (via l'écran Compte parent et par email)**.
* Types de données collectées :
  * **Adresse e-mail** (pour la création et gestion du compte utilisateur).
  * **Identifiants d'appareil** (tokens Expo pour l'envoi de notifications push facultatives).
  * Aucune donnée n'est vendue à des tiers.

#### 5. Public cible et contenu (Families Policy / COPPA) :
* **Tranches d'âge visées** : Cochez **5 ans et moins**, **6 à 8 ans**, et **9 à 12 ans**.
* Confirmez que l'application est conforme aux **règles relatives aux familles de Google Play** et à la **loi COPPA**.
* Confirmez que l'application ne diffuse pas de contenus inappropriés pour les mineurs.

#### 6. Questionnaire de classification du contenu (IARC) :
* Renseignez votre adresse email de contact.
* Sélectionnez la catégorie : **Divertissement / Streaming**.
* Répondez « Non » à toutes les questions relatives à la violence, au langage grossier, aux drogues et aux jeux d'argent.
* Vous obtiendrez la classification **PEGI 3 / Tout public**.

---

### Étape 6 : Vérifier et Soumettre pour Examen
1. Retournez dans **Version > Production** (ou **Test interne**).
2. Cliquez sur **Modifier la version** puis sur **Vérifier la version** *(Review release)*.
3. Vérifiez qu'aucune erreur rouge bloquante n'est présente.
4. Cliquez sur **Démarrer le déploiement en production** *(Start rollout to Production)*.

---

## ⏱️ 4. Délais et Validation par Google

* **Durée de révision** : L'examen par Google prend généralement entre **24 heures et 5 jours ouvrés** (les applications ciblant les enfants font l'objet d'une attention particulière par les équipes de modération).
* **Notification** : Vous recevrez un email de confirmation dès que l'application sera approuvée.
* **Résultat** : Votre application **NourPlay** sera téléchargeable simultanément sur le Google Play Store pour :
  * Smartphones et tablettes Android
  * Téléviseurs Google TV et boîtiers Android TV (Chromecast, Xiaomi TV Box, Nvidia Shield, Smart TVs Sony/TCL/Philips...).
