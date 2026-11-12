-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "parental_approval_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "parental_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parental_approval_requests_profileId_videoId_key" ON "parental_approval_requests"("profileId", "videoId");

-- CreateIndex
CREATE INDEX "parental_approval_requests_profileId_status_idx" ON "parental_approval_requests"("profileId", "status");

-- AddForeignKey
ALTER TABLE "parental_approval_requests" ADD CONSTRAINT "parental_approval_requests_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parental_approval_requests" ADD CONSTRAINT "parental_approval_requests_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
