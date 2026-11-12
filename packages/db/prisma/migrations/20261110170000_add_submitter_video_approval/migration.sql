ALTER TABLE "videos" ADD COLUMN "submitterApprovedAt" TIMESTAMP(3);

UPDATE "videos"
SET "submitterApprovedAt" = "createdAt"
WHERE "validationStatus" = 'PENDING';
