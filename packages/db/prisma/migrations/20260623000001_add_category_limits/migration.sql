-- CreateTable
CREATE TABLE "profile_category_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "dailyLimitMin" INTEGER NOT NULL,

    CONSTRAINT "profile_category_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_category_limits_profileId_tagId_key" ON "profile_category_limits"("profileId", "tagId");

-- AddForeignKey
ALTER TABLE "profile_category_limits" ADD CONSTRAINT "profile_category_limits_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_category_limits" ADD CONSTRAINT "profile_category_limits_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
