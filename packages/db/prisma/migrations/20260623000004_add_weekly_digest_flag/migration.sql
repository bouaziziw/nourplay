-- AddColumn weekly_digest_enabled to users
ALTER TABLE "users" ADD COLUMN "weekly_digest_enabled" BOOLEAN NOT NULL DEFAULT true;
