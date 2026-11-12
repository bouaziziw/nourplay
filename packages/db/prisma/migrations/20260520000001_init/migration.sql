-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARENT', 'TEACHER', 'MODERATOR', 'ADMIN');
CREATE TYPE "AgeGroup" AS ENUM ('AGE_0_3', 'AGE_4_6', 'AGE_7_9', 'AGE_10_12', 'AGE_13_15');
CREATE TYPE "PlaylistVisibility" AS ENUM ('PRIVATE', 'SHARED_LINK', 'SHARED_USERS');
CREATE TYPE "PlaylistAccessRole" AS ENUM ('VIEWER', 'EDITOR');
CREATE TYPE "VideoValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW');
CREATE TYPE "AgeRating" AS ENUM ('ALL', 'AGE_4_PLUS', 'AGE_7_PLUS', 'AGE_10_PLUS', 'AGE_13_PLUS');
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'COOKIE_ANALYTICS', 'COOKIE_FUNCTIONAL', 'PARENTAL_CONSENT');
CREATE TYPE "BlockType" AS ENUM ('CHANNEL_WHITELIST', 'CHANNEL_BLACKLIST', 'KEYWORD_BLACKLIST', 'KEYWORD_WHITELIST');
CREATE TYPE "GdprRequestType" AS ENUM ('EXPORT', 'DELETE', 'RECTIFICATION');
CREATE TYPE "GdprRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PARENT',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMPTZ,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "googleId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateTable: child_profiles
CREATE TABLE "child_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "birthYear" INT,
    "ageGroup" "AgeGroup" NOT NULL,
    "avatarKey" TEXT,
    "pinHash" TEXT NOT NULL,
    "viewingSchedule" JSONB,
    "dailyLimitMin" INT,
    "sessionLimitMin" INT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    CONSTRAINT "child_profiles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "child_profiles_userId_idx" ON "child_profiles"("userId");

-- CreateTable: refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateTable: video_sources
CREATE TABLE "video_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "embedAllowed" BOOLEAN NOT NULL DEFAULT false,
    "cguVersion" TEXT,
    "cguCheckedAt" TIMESTAMPTZ,
    "embedPolicy" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "video_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "video_sources_name_key" ON "video_sources"("name");
CREATE UNIQUE INDEX "video_sources_slug_key" ON "video_sources"("slug");

-- CreateTable: videos
CREATE TABLE "videos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "embedUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationSec" INT,
    "thumbnailUrl" TEXT,
    "language" TEXT,
    "ageRating" "AgeRating" NOT NULL DEFAULT 'ALL',
    "validationStatus" "VideoValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationScore" DOUBLE PRECISION,
    "validationLog" JSONB,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "submittedById" UUID,
    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "videos_sourceId_externalId_key" ON "videos"("sourceId", "externalId");
CREATE INDEX "videos_validationStatus_idx" ON "videos"("validationStatus");
CREATE INDEX "videos_language_idx" ON "videos"("language");
CREATE INDEX "videos_ageRating_idx" ON "videos"("ageRating");

-- CreateTable: tags
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tags_name_locale_key" ON "tags"("name", "locale");

-- CreateTable: video_tags
CREATE TABLE "video_tags" (
    "videoId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    CONSTRAINT "video_tags_pkey" PRIMARY KEY ("videoId", "tagId")
);

-- CreateTable: playlists
CREATE TABLE "playlists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "PlaylistVisibility" NOT NULL DEFAULT 'PRIVATE',
    "targetAgeGroup" "AgeGroup"[],
    "languages" TEXT[],
    "shareToken" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "playlists_shareToken_key" ON "playlists"("shareToken");
CREATE INDEX "playlists_ownerId_idx" ON "playlists"("ownerId");
CREATE INDEX "playlists_visibility_idx" ON "playlists"("visibility");

-- CreateTable: playlist_videos
CREATE TABLE "playlist_videos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playlistId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "position" INT NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" UUID,
    CONSTRAINT "playlist_videos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "playlist_videos_playlistId_videoId_key" ON "playlist_videos"("playlistId", "videoId");
CREATE INDEX "playlist_videos_playlistId_position_idx" ON "playlist_videos"("playlistId", "position");

-- CreateTable: playlist_accesses
CREATE TABLE "playlist_accesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playlistId" UUID NOT NULL,
    "grantedTo" UUID NOT NULL,
    "role" "PlaylistAccessRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playlist_accesses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "playlist_accesses_playlistId_grantedTo_key" ON "playlist_accesses"("playlistId", "grantedTo");

-- CreateTable: categories
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playlistId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_playlistId_slug_key" ON "categories"("playlistId", "slug");

-- CreateTable: watch_history
CREATE TABLE "watch_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "watchedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationWatchedSec" INT NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "watch_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "watch_history_profileId_watchedAt_idx" ON "watch_history"("profileId", "watchedAt");

-- CreateTable: user_blocks
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "profileId" UUID,
    "type" "BlockType" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_blocks_userId_idx" ON "user_blocks"("userId");

-- CreateTable: consent_records
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "consentedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMPTZ,
    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consent_records_userId_type_idx" ON "consent_records"("userId", "type");

-- CreateTable: gdpr_requests
CREATE TABLE "gdpr_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" "GdprRequestType" NOT NULL,
    "status" "GdprRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ,
    "exportUrl" TEXT,
    "notes" TEXT,
    CONSTRAINT "gdpr_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "gdpr_requests_userId_idx" ON "gdpr_requests"("userId");
CREATE INDEX "gdpr_requests_status_idx" ON "gdpr_requests"("status");

-- CreateTable: video_reports
CREATE TABLE "video_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "videoId" UUID NOT NULL,
    "reportedBy" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "video_reports_videoId_resolved_idx" ON "video_reports"("videoId", "resolved");

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actorId" UUID,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_occurredAt_idx" ON "audit_logs"("occurredAt");

-- AddForeignKey
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "videos" ADD CONSTRAINT "videos_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "video_sources"("id") ON UPDATE CASCADE;
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_accesses" ADD CONSTRAINT "playlist_accesses_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_accesses" ADD CONSTRAINT "playlist_accesses_grantedTo_fkey" FOREIGN KEY ("grantedTo") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON UPDATE CASCADE;
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_reports" ADD CONSTRAINT "video_reports_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_reports" ADD CONSTRAINT "video_reports_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
