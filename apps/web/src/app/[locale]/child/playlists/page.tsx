"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useAuth } from "../../../../hooks/useAuth";
import { useChildSession } from "../../../../hooks/useChildSession";
import { useOfflinePlaylists } from "../../../../hooks/useOfflinePlaylists";
import {
  api,
  PlaylistDetail,
  PlaylistSummary,
  VideoFavorite,
  VideoSummary,
} from "../../../../lib/api";
import { RemoteImage } from "../../../../components/RemoteImage";
import { AddToPlaylistModal } from "../../../../components/AddToPlaylistModal";

type InProgressItem = {
  positionSec: number;
  video: Pick<VideoSummary, "id" | "title" | "thumbnailUrl" | "durationSec">;
};

type SelectedVideo = Pick<VideoSummary, "id" | "title">;

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes
    ? `${minutes} min${remainder ? ` ${remainder} s` : ""}`
    : `${seconds} s`;
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "heart" | "playlist" | "menu" | "close" | "arrow";
  className?: string;
}) {
  if (name === "heart") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0116.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  if (name === "playlist") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 6h12M4 11h12M4 16h7m6-1v6m-3-3h6M19 4v5m-2.5-2.5h5"
        />
      </svg>
    );
  }
  if (name === "menu") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    );
  }
  if (name === "close") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function ChildPlaylistsPage() {
  const locale = useLocale();
  const { token } = useAuth();
  const { session } = useChildSession();
  const { saved: offlinePlaylists } = useOfflinePlaylists();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [favorites, setFavorites] = useState<VideoFavorite[]>([]);
  const [inProgress, setInProgress] = useState<InProgressItem[]>([]);
  const [selectedId, setSelectedId] = useState("favorites");
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [favoritePending, setFavoritePending] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(
    null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !session?.profileId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api.playlists.list(token),
      api.favorites.list(token, session.profileId),
      api.users
        .getInProgress(token, session.profileId)
        .catch(() => [] as InProgressItem[]),
    ])
      .then(([nextPlaylists, nextFavorites, nextInProgress]) => {
        if (!active) return;
        setPlaylists(nextPlaylists);
        setFavorites(nextFavorites);
        setInProgress(nextInProgress);
      })
      .catch(() => {
        if (active)
          setError(
            "Impossible de charger vos playlists et favoris. Réessayez dans un instant.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, session?.profileId]);

  useEffect(() => {
    setContentLoading(false);
    if (selectedId === "favorites") {
      setPlaylist(null);
      return;
    }

    const offlineId = selectedId.startsWith("offline:")
      ? selectedId.slice("offline:".length)
      : null;
    const offlinePlaylist = offlineId
      ? offlinePlaylists.find((item) => item.id === offlineId)
      : null;
    if (offlinePlaylist) {
      setPlaylist({
        id: offlinePlaylist.id,
        name: offlinePlaylist.name,
        description: offlinePlaylist.description,
        visibility: "PRIVATE",
        targetAgeGroup: [],
        languages: [],
        scheduledPublishAt: null,
        createdAt: offlinePlaylist.savedAt,
        playlistVideos: offlinePlaylist.videos.map((video, index) => ({
          id: `${offlinePlaylist.id}-${video.id}`,
          position: index + 1,
          video,
        })),
      });
      return;
    }

    if (!token || !selectedId) return;
    let active = true;
    setContentLoading(true);
    setError("");
    api.playlists
      .getById(token, selectedId, session?.profileId)
      .then((result) => {
        if (active) setPlaylist(result);
      })
      .catch(() => {
        if (active) {
          setPlaylist(null);
          setError("Impossible de charger cette playlist.");
        }
      })
      .finally(() => {
        if (active) setContentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, token, session?.profileId, offlinePlaylists]);

  const videos = useMemo(() => {
    if (selectedId === "favorites") {
      return favorites.map((favorite) => ({
        video: favorite.video,
        position: null as number | null,
      }));
    }
    return [...(playlist?.playlistVideos ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ video: item.video, position: item.position }));
  }, [favorites, playlist, selectedId]);

  const currentTitle =
    selectedId === "favorites"
      ? "Mes favoris"
      : (playlist?.name ??
        playlists.find((item) => item.id === selectedId)?.name ??
        offlinePlaylists.find((item) => `offline:${item.id}` === selectedId)
          ?.name ??
        "Playlist");

  const selectItem = (id: string) => {
    setSelectedId(id);
    setSidebarOpen(false);
    setError("");
  };

  const toggleFavorite = async (video: VideoSummary) => {
    if (!token || !session?.profileId || favoritePending) return;
    const existing = favorites.some(
      (favorite) => favorite.videoId === video.id,
    );
    const previous = favorites;
    setFavoritePending(video.id);
    setError("");
    if (existing) {
      setFavorites(
        previous.filter((favorite) => favorite.videoId !== video.id),
      );
    }
    try {
      if (existing) {
        await api.favorites.remove(token, session.profileId, video.id);
      } else {
        const favorite = await api.favorites.add(
          token,
          session.profileId,
          video.id,
        );
        setFavorites((current) => [
          ...current.filter((item) => item.videoId !== video.id),
          favorite,
        ]);
      }
    } catch {
      setFavorites(previous);
      setError("Impossible de mettre à jour vos favoris. Veuillez réessayer.");
    } finally {
      setFavoritePending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-expanded={sidebarOpen}
          aria-controls="playlist-sidebar"
          aria-label={
            sidebarOpen
              ? "Fermer le menu des playlists"
              : "Ouvrir le menu des playlists"
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white bg-white text-gray-700 shadow-sm transition hover:bg-indigo-50 lg:hidden"
        >
          <Icon name={sidebarOpen ? "close" : "menu"} />
        </button>
        <div>
          <p className="text-sm font-medium text-indigo-600">
            Votre espace vidéo
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Playlists
          </h1>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="relative flex min-h-[32rem] gap-5">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-gray-950/30 backdrop-blur-[1px] lg:hidden"
          />
        )}
        <aside
          id="playlist-sidebar"
          className={`${
            sidebarOpen
              ? "fixed inset-y-0 left-0 z-40 w-[min(20rem,85vw)] overflow-y-auto rounded-r-3xl"
              : "hidden"
          } lg:relative lg:block lg:w-64 lg:shrink-0 lg:overflow-visible lg:rounded-3xl`}
        >
          <div className="h-full rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
              Bibliothèque
            </p>
            <nav aria-label="Playlists et favoris" className="space-y-1">
              <button
                type="button"
                onClick={() => selectItem("favorites")}
                aria-current={selectedId === "favorites" ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  selectedId === "favorites"
                    ? "bg-pink-50 font-semibold text-pink-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${selectedId === "favorites" ? "bg-white text-pink-500" : "bg-pink-50 text-pink-400"}`}
                >
                  <Icon name="heart" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">Favoris</span>
                <span className="text-xs text-gray-400">
                  {favorites.length}
                </span>
              </button>

              <div className="px-3 pb-1 pt-5 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                Mes playlists
              </div>
              {playlists.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => selectItem(item.id)}
                  aria-current={selectedId === item.id ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    selectedId === item.id
                      ? "bg-indigo-50 font-semibold text-indigo-700 shadow-sm"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selectedId === item.id ? "bg-white text-indigo-600" : "bg-indigo-50 text-indigo-400"}`}
                  >
                    <Icon name="playlist" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {item._count.playlistVideos}
                  </span>
                </button>
              ))}
              {offlinePlaylists.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-5 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                    Disponibles hors ligne
                  </div>
                  {offlinePlaylists.map((item) => {
                    const id = `offline:${item.id}`;
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => selectItem(id)}
                        aria-current={selectedId === id ? "page" : undefined}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          selectedId === id
                            ? "bg-indigo-50 font-semibold text-indigo-700 shadow-sm"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {item.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {item.videos.length}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
              {playlists.length === 0 && offlinePlaylists.length === 0 && (
                <p className="px-3 py-3 text-sm leading-6 text-gray-400">
                  Aucune playlist pour le moment.
                </p>
              )}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1 rounded-3xl border border-white/80 bg-white/65 p-4 shadow-sm backdrop-blur-xl sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-3 border-b border-gray-100 pb-5">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">
                {selectedId === "favorites"
                  ? "À revoir encore"
                  : "Votre sélection"}
              </p>
              <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
                {currentTitle}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {videos.length} vidéo{videos.length !== 1 ? "s" : ""}
              </p>
            </div>
            <span className="hidden rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 sm:inline-flex">
              NourPlay
            </span>
          </div>

          {inProgress.length > 0 && selectedId === "favorites" && (
            <section aria-label="Reprendre le visionnage" className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  À reprendre
                </h3>
                <Link
                  href={`/${locale}/child/history`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Tout voir
                </Link>
              </div>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {inProgress.map(({ video, positionSec }) => {
                  const progress = video.durationSec
                    ? Math.min(
                        100,
                        Math.round((positionSec / video.durationSec) * 100),
                      )
                    : 0;
                  return (
                    <Link
                      key={video.id}
                      href={`/${locale}/child/watch/${video.id}`}
                      className="group w-44 shrink-0"
                    >
                      <div
                        className="relative overflow-hidden rounded-xl bg-gray-100 shadow-sm"
                        style={{ aspectRatio: "16/9" }}
                      >
                        {video.thumbnailUrl ? (
                          <RemoteImage
                            src={video.thumbnailUrl}
                            alt={video.title}
                            fill
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">
                            🎥
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-gray-700">
                        {video.title}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {contentLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 px-5 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
                {selectedId === "favorites" ? "♡" : "♪"}
              </div>
              <h3 className="font-semibold text-gray-800">
                {selectedId === "favorites"
                  ? "Pas encore de favoris"
                  : "Cette playlist est vide"}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-gray-500">
                {selectedId === "favorites"
                  ? "Ajoutez vos vidéos préférées en un clic et retrouvez-les ici."
                  : "Les vidéos de cette playlist apparaîtront ici."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map(({ video, position }) => {
                const isFavorite = favorites.some(
                  (favorite) => favorite.videoId === video.id,
                );
                return (
                  <article
                    key={`${selectedId}-${video.id}`}
                    className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <Link
                      href={`/${locale}/child/watch/${video.id}${selectedId === "favorites" ? "" : `?playlist=${playlist?.id ?? selectedId}`}`}
                      className="relative block overflow-hidden bg-gray-100"
                      style={{ aspectRatio: "16/9" }}
                    >
                      {video.thumbnailUrl ? (
                        <RemoteImage
                          src={video.thumbnailUrl}
                          alt={video.title}
                          fill
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 text-4xl">
                          🎥
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15">
                        <span className="flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-white/95 text-indigo-600 opacity-0 shadow-lg transition duration-200 group-hover:scale-100 group-hover:opacity-100">
                          <svg
                            className="ml-1 h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </div>
                      {video.durationSec && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-gray-950/75 px-2 py-1 text-[11px] font-medium text-white">
                          {formatDuration(video.durationSec)}
                        </span>
                      )}
                      {position !== null && (
                        <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-xs font-bold text-indigo-700 shadow-sm">
                          {position}
                        </span>
                      )}
                    </Link>
                    <div className="p-3.5">
                      <Link
                        href={`/${locale}/child/watch/${video.id}${selectedId === "favorites" ? "" : `?playlist=${playlist?.id ?? selectedId}`}`}
                        className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-gray-900 hover:text-indigo-700"
                      >
                        {video.title}
                      </Link>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(video)}
                          disabled={favoritePending === video.id}
                          aria-label={
                            isFavorite
                              ? "Retirer des favoris"
                              : "Ajouter aux favoris"
                          }
                          aria-pressed={isFavorite}
                          className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${
                            isFavorite
                              ? "bg-pink-50 text-pink-600 hover:bg-pink-100"
                              : "bg-gray-50 text-gray-600 hover:bg-pink-50 hover:text-pink-600"
                          }`}
                        >
                          <Icon name="heart" className="h-4 w-4" />
                          <span>{isFavorite ? "En favori" : "Favori"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedVideo({
                              id: video.id,
                              title: video.title,
                            })
                          }
                          aria-label={`Ajouter ${video.title} à une playlist`}
                          className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-50 px-2.5 py-2 text-xs font-semibold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-100"
                        >
                          <Icon name="playlist" className="h-4 w-4" />
                          <span>Playlist</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {selectedVideo && token && (
        <AddToPlaylistModal
          videoId={selectedVideo.id}
          videoTitle={selectedVideo.title}
          token={token}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
