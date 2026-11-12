# Phase 18-22 — Intégration Stripe + UI abonnement

## Objectif

Implémenter le parcours d'abonnement complet : intégration Stripe Checkout, gestion du Customer Portal, traitement des webhooks, et page d'abonnement côté web. Inclut la migration des champs Stripe dans le schéma et l'alignement Prisma.

## Ce qui a été fait

### 1. Migration `add_stripe_fields` (`packages/db/prisma/migrations/20260528000002_`)

```sql
ALTER TABLE "users"             ADD COLUMN "stripeCustomerId" TEXT UNIQUE;
ALTER TABLE "subscription_plans" ADD COLUMN "stripePriceId"  TEXT;
```

`stripeCustomerId` — lié un compte NourPlay à un Customer Stripe (créé au premier checkout).  
`stripePriceId` — renseigné manuellement par l'admin ou via le seed.

### 2. Migration d'alignement (`packages/db/prisma/migrations/20260528142537_`)

Normalisation de tous les champs `DateTime` de `TIMESTAMPTZ`/`TIMESTAMP(3)` pour l'uniformité avec le générateur Prisma. Ajout des contraintes de clé étrangère manquantes (categories, subscriptions, video_favorites).

### 3. Module Subscription NestJS (`packages/api/src/modules/subscription/`)

**`SubscriptionService`** implémente :

| Méthode | Description |
|---|---|
| `getPlans()` | Plans publics, mis en cache Redis 5 min |
| `getMySubscription(userId)` | Abonnement + plan de l'utilisateur |
| `createCheckoutSession(userId, email, dto)` | Crée (ou récupère) le Customer Stripe, crée une session Checkout, retourne l'URL de redirection |
| `createPortalSession(userId)` | Ouvre le Customer Portal Stripe (gestion CB, annulation) |
| `handleWebhook(rawBody, signature)` | Vérifie la signature Stripe, traite : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| `getUserPlanLimits(userId)` | Retourne `{ maxProfiles, maxPlaylists, planSlug }` — utilisé pour le gating (phase 27) |

**`SubscriptionController`** expose :

```
GET    /subscriptions/plans        — public, liste des plans
GET    /subscriptions/me           — abonnement courant (auth)
POST   /subscriptions/checkout     — rate-limited 5/min (auth)
POST   /subscriptions/portal       — rate-limited 10/min (auth)
POST   /subscriptions/webhook      — public, raw body, skip throttle
```

**Webhook** — `checkout.session.completed` :
1. Récupère `subscription.metadata.userId`
2. Upsert Subscription avec `status = ACTIVE`, `externalId = stripe_subscription_id`
3. Met à jour `user.stripeCustomerId`

**Webhook** — `customer.subscription.updated` : met à jour le statut Prisma depuis le statut Stripe.

**Webhook** — `customer.subscription.deleted` : passe le statut à `CANCELLED`, renseigne `cancelledAt`.

### 4. Config application (`packages/api/src/config/app.config.ts`)

Nouvelles clés de config :

```ts
stripe: {
  secretKey:     env('STRIPE_SECRET_KEY'),
  webhookSecret: env('STRIPE_WEBHOOK_SECRET'),
  publicKey:     env('NEXT_PUBLIC_STRIPE_PUBLIC_KEY'),
}
```

### 5. Page abonnement web (`apps/web/src/app/[locale]/(dashboard)/subscription/`)

Fonctionnalités :
- **Chargement des plans** depuis `GET /subscriptions/plans`.
- **Statut courant** : badge coloré (vert = actif, bleu = essai, jaune = paiement en retard).
- **Bouton « S'abonner »** : redirige vers Stripe Checkout.
- **Bouton « Gérer »** : ouvre le Customer Portal Stripe.
- **Affichage des features** : liste des fonctionnalités incluses dans le plan actuel.

Lien « Abonnement » ajouté dans le layout dashboard web et admin.

### 6. Client API web (`apps/web/src/lib/api.ts`)

Nouveaux types : `SubscriptionPlan`, `UserSubscription`.  
Nouvelles méthodes : `subscriptions.getPlans()`, `subscriptions.getMySubscription()`, `subscriptions.createCheckoutSession()`, `subscriptions.createPortalSession()`.

## Tests

- Webhook testé avec `stripe listen --forward-to localhost:4000/api/v1/subscriptions/webhook`.
- Checkout session créée correctement avec `success_url` et `cancel_url` pointant vers la page abonnement.
- Customer Portal accessible avec un compte Stripe test.

## Choix techniques

- **Raw body pour le webhook** : Stripe valide la signature HMAC sur le body exact reçu — le middleware `json()` de Express doit être bypassé pour ce endpoint. Configuré via `app.useBodyParser = false` + middleware conditionnel dans `main.ts`.
- **`onModuleInit`** pour initialiser le client Stripe : évite d'instancier Stripe dans le constructeur (les variables d'env ne sont pas encore résolues), respecte le cycle de vie NestJS.
- **`PLAN_LIMITS` statiques** dans le service : les limites (1 profil, 5 playlists pour le free) sont hardcodées — pas en DB pour éviter un JOIN supplémentaire sur chaque opération de création. Modifiable dans le code si les limites changent.
