CREATE TABLE "video_progress" (
  "profileId" UUID NOT NULL,
  "videoId" UUID NOT NULL,
  "positionSec" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "video_progress_pkey" PRIMARY KEY ("profileId", "videoId"),
  CONSTRAINT "video_progress_profileId_fkey" FOREIGN KEY ("profileId")
    REFERENCES "child_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "video_progress_videoId_fkey" FOREIGN KEY ("videoId")
    REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
