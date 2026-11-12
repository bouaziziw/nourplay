# Template DPA — Accord de sous-traitance des données

> Template conforme à l'article 28 du RGPD  
> À personnaliser et signer avec chaque sous-traitant avant la mise en production

---

## ACCORD DE SOUS-TRAITANCE DES DONNÉES PERSONNELLES (DPA)

### ENTRE

**Le Responsable de traitement :**  
NourPlay SAS  
Adresse : [à compléter]  
Représentée par : [à compléter]  
Ci-après dénommé « le Responsable »

**ET**

**Le Sous-traitant :**  
[Nom du sous-traitant]  
Adresse : [adresse du sous-traitant]  
Représenté par : [à compléter]  
Ci-après dénommé « le Sous-traitant »

---

### Article 1 — Objet

Le présent accord a pour objet de définir les conditions dans lesquelles le Sous-traitant s'engage à effectuer, pour le compte du Responsable, les opérations de traitement de données à caractère personnel décrites ci-après.

### Article 2 — Description du traitement

| Élément | Description |
|---------|-------------|
| **Nature du traitement** | [Décrite spécifiquement pour chaque sous-traitant] |
| **Finalité du traitement** | [Finalité spécifique] |
| **Durée du traitement** | Durée du contrat de service |
| **Catégories de données** | [Catégories spécifiques] |
| **Catégories de personnes** | Adultes (parents, enseignants) et/ou mineurs (0-15 ans, via profils) |

### Article 3 — Obligations du Sous-traitant

Le Sous-traitant s'engage à :

3.1. Traiter les données uniquement sur instruction documentée du Responsable.

3.2. Garantir la confidentialité des données traitées. Le Sous-traitant veille à ce que les personnes autorisées à traiter les données s'engagent à respecter la confidentialité.

3.3. Prendre toutes mesures de sécurité requises au titre de l'article 32 du RGPD, notamment :
- Le chiffrement des données en transit (TLS 1.2 minimum)
- Le chiffrement des données au repos
- Des moyens permettant de garantir la confidentialité, l'intégrité et la résilience des systèmes
- Des procédures de test et d'évaluation régulières de l'efficacité des mesures techniques et organisationnelles

3.4. Ne pas recruter de sous-traitant ultérieur sans l'autorisation écrite préalable du Responsable. En cas d'autorisation générale, le Sous-traitant informera le Responsable de tout ajout ou remplacement de sous-traitant ultérieur au moins 30 jours à l'avance.

3.5. Aider le Responsable, dans toute la mesure du possible, à s'acquitter de son obligation de donner suite aux demandes d'exercice des droits des personnes (accès, rectification, effacement, portabilité, opposition, limitation).

3.6. Aider le Responsable à garantir le respect des obligations prévues aux articles 32 à 36 du RGPD (sécurité, notification de violation, AIPD, consultation préalable).

3.7. Au choix du Responsable, supprimer ou restituer toutes les données à caractère personnel au terme de la prestation, et détruire les copies existantes, sauf obligation légale de conservation.

3.8. Mettre à la disposition du Responsable toutes les informations nécessaires pour démontrer le respect des obligations et permettre la réalisation d'audits.

### Article 4 — Notification des violations de données

Le Sous-traitant notifiera au Responsable toute violation de données à caractère personnel dans un délai de **24 heures** après en avoir pris connaissance, en fournissant :
- La nature de la violation
- Les catégories et le nombre approximatif de personnes concernées
- Les conséquences probables
- Les mesures prises ou proposées pour y remédier

### Article 5 — Transferts hors UE

[Si applicable] Les transferts de données vers des pays tiers sont encadrés par :
- Les Clauses Contractuelles Types (SCC) de la Commission européenne (décision 2021/914)
- [Le cas échéant] Le mécanisme de certification ou code de conduite approuvé

### Article 6 — Durée

Le présent accord entre en vigueur à la date de sa signature et reste en vigueur pendant toute la durée du contrat de service principal. Les obligations de confidentialité survivent à la résiliation du contrat.

### Article 7 — Droit applicable et juridiction

Le présent accord est régi par le droit français. Tout litige sera soumis aux tribunaux compétents de [ville à définir].

---

## Annexes par sous-traitant

### Annexe A — Google LLC (OAuth 2.0)

| Élément | Description |
|---------|-------------|
| **Service** | Google Sign-In (OAuth 2.0) |
| **Données transmises** | Identifiant Google, adresse email, nom (si autorisé) |
| **Finalité** | Authentification simplifiée |
| **Durée** | Durée d'utilisation du service |
| **Localisation** | États-Unis |
| **Garanties** | SCC, DPA Google Cloud |
| **DPA en ligne** | [Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum) |

### Annexe B — OpenAI Inc. (Modération IA)

| Élément | Description |
|---------|-------------|
| **Service** | API Chat Completions (`AI_MODERATION_MODEL`) |
| **Données transmises** | Titre, description, tags, contexte playlist, miniature et preuves visuelles/audio lorsqu'elles sont disponibles; elles peuvent contenir des données personnelles |
| **Finalité** | Classification du contenu pour la protection des mineurs |
| **Durée** | Selon les conditions contractuelles et paramètres du compte |
| **Localisation** | À confirmer selon la configuration du service |
| **Garanties** | DPA OpenAI et garanties de transfert applicables; confirmer les options de rétention avant production |
| **DPA en ligne** | [OpenAI DPA](https://openai.com/policies/data-processing-addendum) |

> **Note importante** : confirmer les options de rétention et les conditions du compte OpenAI avant d'envoyer des médias.

### Annexe C — Stripe Inc. (Paiements)

| Élément | Description |
|---------|-------------|
| **Service** | Stripe Checkout, Customer Portal, Billing |
| **Données transmises** | Adresse email, identifiant client Stripe |
| **Finalité** | Gestion des abonnements et paiements |
| **Durée** | Durée de l'abonnement + obligations comptables |
| **Localisation** | Irlande (UE) + États-Unis |
| **Garanties** | SCC, PCI DSS Level 1, DPA Stripe |
| **DPA en ligne** | [Stripe DPA](https://stripe.com/legal/dpa) |

> **Note** : NourPlay ne stocke aucune donnée de carte bancaire. Le paiement est intégralement délégué à Stripe.

### Annexe D — Cloudflare Inc. (Stockage R2)

| Élément | Description |
|---------|-------------|
| **Service** | Cloudflare R2 (stockage objet compatible S3) |
| **Données transmises** | Images d'avatar des profils |
| **Finalité** | Stockage des avatars utilisateurs |
| **Durée** | Durée du profil |
| **Localisation** | Région EU configurable |
| **Garanties** | SCC, DPA Cloudflare |
| **DPA en ligne** | [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) |

### Annexe E — Resend (Email transactionnel)

| Élément | Description |
|---------|-------------|
| **Service** | API d'envoi d'emails transactionnels |
| **Données transmises** | Adresse email du destinataire, contenu de l'email |
| **Finalité** | Vérification email, reset mot de passe, notifications, rappels |
| **Durée** | Durée de chaque envoi |
| **Localisation** | États-Unis |
| **Garanties** | SCC, DPA Resend |
| **DPA en ligne** | [Resend DPA](https://resend.com/legal/dpa) |

### Annexe F — Expo (Push Notifications)

| Élément | Description |
|---------|-------------|
| **Service** | Expo Push Notification Service |
| **Données transmises** | Token push device (identifiant technique), contenu de la notification |
| **Finalité** | Envoi de notifications push sur les appareils mobiles |
| **Durée** | Durée de chaque envoi |
| **Localisation** | États-Unis |
| **Garanties** | SCC |
| **DPA en ligne** | Contacter Expo directement |

> **Note** : les payloads de notification ne contiennent pas de données personnelles sensibles. Le token push est un identifiant technique de l'appareil.

---

## Checklist avant mise en production

- [ ] DPA signé avec Google (OAuth)
- [ ] DPA signé avec OpenAI (modération IA)
- [ ] DPA signé avec Stripe (paiements)
- [ ] DPA signé avec Cloudflare (stockage R2)
- [ ] DPA signé avec Resend (emails)
- [ ] DPA signé avec Expo (push notifications)
- [ ] Vérification que les SCC sont à jour pour chaque sous-traitant US
- [ ] Documentation des transferts hors UE dans le registre des traitements
- [ ] Mise à jour de la politique de confidentialité avec la liste des sous-traitants
