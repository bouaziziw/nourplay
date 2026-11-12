CREATE TYPE "VideoRatingValue" AS ENUM ('THUMBS_UP', 'THUMBS_DOWN');

CREATE TABLE "video_ratings" (
  "profileId" UUID NOT NULL,
  "videoId" UUID NOT NULL,
  "rating" "VideoRatingValue" NOT NULL,
  "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "video_ratings_pkey" PRIMARY KEY ("profileId", "videoId"),
  CONSTRAINT "video_ratings_profileId_fkey" FOREIGN KEY ("profileId")
    REFERENCES "child_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "video_ratings_videoId_fkey" FOREIGN KEY ("videoId")
    REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "video_ratings_videoId_idx" ON "video_ratings" ("videoId");
