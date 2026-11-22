# Guide de Déploiement : Google Play Store (Android Mobile & Google TV) — NourPlay

Ce document détaille l'ensemble de la procédure pour compiler, tester et publier l'application mobile **NourPlay** sur le **Google Play Store**, avec une compatibilité complète pour les smartphones, tablettes et **Google TV / Android TV**.

---

## 1. Ce qui a été configuré dans le projet

Pour permettre à un **même Android App Bundle (.aab)** de cibler à la fois les téléphones et Google TV :

1. **Config Plugin Expo Android TV (`apps/mobile/plugins/withAndroidTV.js`)** :
   - Déclare `android.software.leanback` avec `android:required="false"` (indispensable pour un bundle universel Mobile + TV).
   - Déclare `android.hardware.touchscreen` avec `android:required="false"` (sans cela, le Google Play Store masque automatiquement l'application sur tous les téléviseurs et boîtiers TV car ils n'ont pas d'écran tactile).
   - Déclare `android.hardware.telephony`, `camera`, `microphone` avec `android:required="false"`.
   - Ajoute la catégorie `LEANBACK_LAUNCHER` à l'activité principale aux côtés de `LAUNCHER` pour qu'elle s'affiche sur l'écran d'accueil Google TV.
   - Ajoute la bannière Android TV `android:banner="@drawable/tv_banner"`.
   - Copie automatiquement l'asset de la bannière dans les ressources Android natives lors du build.

2. **Assets dédiés (`apps/mobile/assets/`)** :
   - `tv-banner.png` (320x180 px - ratio 16:9 obligatoire pour Google TV).
   - `icon.png` (512x512 px).
   - `adaptive-icon.png` (512x512 px avec fond `#1c90d8`).
   - `splash.png` (écran de démarrage).

3. **Orientation adaptative (`apps/mobile/app.json`)** :
   - Configuration sur `"orientation": "default"` afin que l'application reste en portrait sur téléphone et bascule automatiquement en paysage sur Google TV (Google TV interdit les applications forcées en mode portrait).

4. **Profils EAS Build (`apps/mobile/eas.json`)** :
   - Profil `preview` configuré en `apk` pour tester directement sur un téléviseur ou une box Android TV (via sideloading).
   - Profil `production` configuré en `app-bundle` (`.aab`) prêt pour le Google Play Store.

---

## 2. Procédure Étape par Étape

### Étape 1 : Prérequis administratifs Google Play Console

1. **Créer un compte développeur Google Play** :
   - Rendez-vous sur [Google Play Console](https://play.google.com/console/signup).
   - Connectez-vous avec l'adresse Google dédiée à NourPlay.
   - Réglez les frais d'inscription uniques de **25 USD** (valable à vie).
   - Choisissez le type de compte :
     - **Compte Personnel** : demande une vérification d'identité (carte d'identité/passeport).
     - **Compte Organisation** : demande un numéro D-U-N-S, justificatif de société et identité légale.
   - Remplissez les informations de contact développeur (nom, email public, site web : `https://nourplay.com`).

---

### Étape 2 : Construction de l'Android App Bundle (.aab) avec EAS Build

Expo Application Services (EAS) gère la compilation dans le cloud et la signature cryptographique de l'application.

1. **Installer et se connecter à EAS CLI** :
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Lier le projet mobile à votre compte Expo** (à faire une seule fois) :
   ```bash
   cd apps/mobile
   eas project:init
   ```

3. **Compiler le bundle de production (.aab)** :
   ```bash
   eas build --platform android --profile production
   ```
   - Lors de la première exécution, EAS vous demandera :
     - *« Would you like to generate a new Android Keystore? »* -> Répondez **Yes**. EAS générera et sauvegardera les clés de signature en toute sécurité.
   - À la fin du build, EAS fournit un lien direct pour télécharger le fichier `app.nourplay.mobile.aab`.

4. *(Optionnel mais recommandé)* **Générer un APK de test pour votre téléviseur** :
   ```bash
   eas build --platform android --profile preview
   ```
   Ce build produit un fichier `.apk` installable directement sur votre Chromecast avec Google TV ou box TV pour valider la navigation à la télécommande avant publication.

---

### Étape 3 : Création de l'application sur la Google Play Console

1. Dans la [Google Play Console](https://play.google.com/console), cliquez sur **Créer une application**.
2. Remplissez les champs initiaux :
   - **Nom de l'application** : `NourPlay - Streaming & Famille`
   - **Langue par défaut** : Français (fr-FR) (ou Arabe / Anglais selon votre choix)
   - **Type d'application** : Application
   - **Gratuite ou payante** : Gratuite (ou selon modèle)
   - Cochez les déclarations relatives aux règles de conformité et lois sur l'exportation des États-Unis.

---

### Étape 4 : Fiche principale du Google Play Store (Ressources visuelles)

Allez dans **Développer l'audience > Présence sur le Play Store > Fiche principale du Play Store** :

1. **Textes** :
   - **Nom de l'application** : `NourPlay`
   - **Description courte** (80 caractères max) :
     > Plateforme de streaming vidéo sécurisée et éducative pour les enfants et familles.
   - **Description complète** (4000 caractères max) :
     > Présentation détaillée des fonctionnalités : mode parent sécurisé par mot de passe/PIN, profils enfants séparés, minuteur d'écran, sélection soignée de vidéos sans algorithmes toxiques ni publicités intrusives.

2. **Ressources graphiques obligatoires** :
   - **Icône de l'application** : `apps/mobile/assets/icon.png` (512 x 512 px, PNG 32 bits, fond plein).
   - **Graphique de fonctionnalité** : Image de bannière Play Store (1024 x 500 px, JPEG ou PNG 24 bits sans transparence).
   - **Captures d'écran pour Téléphone** : Au moins 2 captures (format 9:16 ou 16:9, min 1080x1920).
   - **Captures d'écran pour Android TV** : **Obligatoire pour Google TV** : au moins 1 capture en 16:9 (1920x1080 recommandé, montrant l'interface TV ou la lecture vidéo).
   - **Bannière Android TV** : `apps/mobile/assets/tv-banner.png` (320 x 180 px, PNG obligatoire).

---

### Étape 5 : Déclarations de conformité et Politiques (Section critique pour NourPlay)

Dans le menu de gauche, allez dans **Règles > Contenu de l'application** et complétez chaque section :

1. **Politique de confidentialité (Privacy Policy)** :
   - Renseignez l'URL publique de la politique : `https://nourplay.com/privacy`.
2. **Accès pour l'évaluation de l'application (Credentials de test)** :
   - Étant donné que NourPlay dispose d'un écran de connexion, vous **devez** fournir des identifiants de test à Google pour qu'ils puissent tester l'application :
     - Identifiant / Email de test : `test-reviewer@nourplay.com`
     - Mot de passe : `<mot_de_passe_test>`
     - Code PIN parent : `1234`
     - Instructions courtes pour le réviseur.
3. **Sécurité des données (Data Safety)** :
   - Données collectées : Identifiants utilisateur (email/compte), identifiants d'appareil (tokens push Expo).
   - Chiffrement en transit : Oui (toutes les requêtes passent par HTTPS).
   - Suppression des données : Indiquer le mécanisme de suppression de compte (présent dans l'écran Compte parent).
4. **Questionnaire de classification du contenu (IARC)** :
   - Répondez au questionnaire en sélectionnant la catégorie « Divertissement / Streaming ».
   - Vous obtiendrez les classifications PEGI 3 / Everyone.
5. **Public cible et contenu (Families Policy / Politiques pour la famille)** :
   - **Très important** : Comme NourPlay intègre des profils enfants, sélectionnez les tranches d'âge ciblées (ex: 3-5 ans, 6-8 ans, 9-12 ans).
   - Confirmez le respect de la politique relative aux familles de Google Play et de la loi COPPA.
   - Précisez que l'application ne diffuse pas de publicités tierces non certifiées pour les enfants.

---

### Étape 6 : Activation de la prise en charge Android TV / Google TV

Pour que Google Play propose votre application sur Google TV et les téléviseurs :

1. Allez dans **Version > Paramètres avancés** (ou **Formats d'appareils** selon l'interface de la console).
2. Sélectionnez l'onglet **Android TV**.
3. Cliquez sur **Participer** ou **Activer la distribution sur Android TV**.
4. Validez les critères de qualité pour Android TV :
   - L'application dispose d'une bannière Leanback (320x180 px).
   - L'application ne requiert pas d'écran tactile.
   - L'interface se pilote avec une télécommande (D-pad).
   - Les captures d'écran TV (16:9) ont bien été renseignées sur la fiche du Store.

---

### Étape 7 : Test sur matériel réel (Google TV / Box TV)

Avant d'envoyer en production, testez l'APK `preview` sur votre téléviseur :

1. Activez le mode développeur sur Google TV :
   - **Paramètres > Système > À propos** > Cliquez 7 fois sur **Build de l'OS Android TV**.
2. Activez le **Débogage réseau** dans les options développeur.
3. Depuis votre ordinateur :
   ```bash
   adb connect <ADRESSE_IP_DE_VOTRE_TV>:5555
   adb install chemin/vers/nourplay-preview.apk
   ```
4. Vérifiez les points suivants avec la télécommande TV :
   - L'icône de l'application apparaît bien dans le carrousel des applications sur l'écran d'accueil Google TV.
   - Les boutons et listes de lecture sont navigables avec les flèches haut/bas/gauche/droite.
   - Le bouton central (Sélection) lance la lecture vidéo.
   - Le bouton « Retour » de la télécommande permet de revenir à l'écran précédent sans quitter inopinément l'application.

---

### Étape 8 : Déploiement et Publication

1. Dans la Google Play Console, allez dans **Version > Production** (ou **Test interne** pour valider auprès de testeurs désignés).
2. Cliquez sur **Créer une version**.
3. Importez le fichier `.aab` généré par `eas build`.
4. Renseignez les notes de version (ex: *« Première version officielle de NourPlay pour mobile et Google TV »*).
5. Cliquez sur **Enregistrer**, puis **Vérifier la version**.
6. Cliquez sur **Démarrer le déploiement en production** pour envoyer l'application en révision chez Google.
7. L'examen par les équipes de Google prend généralement entre **24 heures et 7 jours ouvrés**. Dès validation, l'application est téléchargeable sur le Google Play Store pour smartphones, tablettes et Google TV !
