-- CreateTable
CREATE TABLE "watch_parties" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "host_id" UUID NOT NULL,
    "playlist_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_parties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "watch_parties_code_key" ON "watch_parties"("code");

-- CreateIndex
CREATE INDEX "watch_parties_host_id_idx" ON "watch_parties"("host_id");

-- AddForeignKey
ALTER TABLE "watch_parties" ADD CONSTRAINT "watch_parties_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_parties" ADD CONSTRAINT "watch_parties_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
