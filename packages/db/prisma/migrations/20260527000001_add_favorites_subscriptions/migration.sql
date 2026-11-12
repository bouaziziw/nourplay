-- Migration: add_favorites_subscriptions
-- Adds: video_favorites, subscription_plans, subscriptions
-- Adds enums: SubscriptionStatus, PlanInterval

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'CANCELLED',
  'PAST_DUE',
  'TRIALING',
  'EXPIRED'
);

CREATE TYPE "PlanInterval" AS ENUM (
  'MONTHLY',
  'YEARLY'
);

-- ─────────────────────────────────────────────────────────────
-- VideoFavorite — favoris par profil enfant
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "video_favorites" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "profileId"  UUID         NOT NULL,
  "videoId"    UUID         NOT NULL,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "video_favorites_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "video_favorites_profile_video_uk" UNIQUE ("profileId", "videoId"),
  CONSTRAINT "video_favorites_profileId_fkey"  FOREIGN KEY ("profileId")
    REFERENCES "child_profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "video_favorites_videoId_fkey"    FOREIGN KEY ("videoId")
    REFERENCES "videos" ("id") ON DELETE CASCADE
);

CREATE INDEX "video_favorites_profileId_idx" ON "video_favorites" ("profileId");

-- ─────────────────────────────────────────────────────────────
-- SubscriptionPlan — plans tarifaires (socle premium)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "subscription_plans" (
  "id"        UUID          NOT NULL DEFAULT gen_random_uuid(),
  "name"      TEXT          NOT NULL,
  "slug"      TEXT          NOT NULL,
  "priceEur"  INTEGER       NOT NULL DEFAULT 0,
  "interval"  "PlanInterval" NOT NULL DEFAULT 'MONTHLY',
  "features"  JSONB         NOT NULL,
  "isActive"  BOOLEAN       NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ   NOT NULL,

  CONSTRAINT "subscription_plans_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "subscription_plans_name_key" UNIQUE ("name"),
  CONSTRAINT "subscription_plans_slug_key" UNIQUE ("slug")
);

-- Plan gratuit par défaut
INSERT INTO "subscription_plans" ("id", "name", "slug", "priceEur", "interval", "features", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Free',
  'free',
  0,
  'MONTHLY',
  '["6 profils enfants", "Playlists illimitées", "Validation IA", "Partage restreint"]'::jsonb,
  now()
);

-- ─────────────────────────────────────────────────────────────
-- Subscription — abonnement par utilisateur
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "subscriptions" (
  "id"          UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "userId"      UUID                 NOT NULL,
  "planId"      UUID                 NOT NULL,
  "status"      "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "startedAt"   TIMESTAMPTZ          NOT NULL DEFAULT now(),
  "expiresAt"   TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "externalId"  TEXT,

  CONSTRAINT "subscriptions_pkey"    PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_userId_key" UNIQUE ("userId"),
  CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId")
    REFERENCES "subscription_plans" ("id")
);

CREATE INDEX "subscriptions_status_idx" ON "subscriptions" ("status");
