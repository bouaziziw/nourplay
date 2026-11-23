"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useAuth } from "../../../../hooks/useAuth";
import { useChildSession } from "../../../../hooks/useChildSession";
import { useOfflinePlaylists } from "../../../../hooks/useOfflinePlaylists";
import {
  api,
  PlaylistSummary,
  VideoFavorite,
  VideoSummary,
} from "../../../../lib/api";
import { RemoteImage } from "../../../../components/RemoteImage";
import { AddToPlaylistModal } from "../../../../components/AddToPlaylistModal";
import { getPlaylistTheme } from "../../../../lib/channelTheme";

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

const FILTER_PILLS = [
  { id: "all", label: "Toutes les chaînes", emoji: "⭐" },
  { id: "stories", label: "Histoires & Contes", emoji: "🌙" },
  { id: "animals", label: "Animaux & Nature", emoji: "🦁" },
  { id: "fun", label: "Chansons & Fête", emoji: "🎵" },
  { id: "learn", label: "Éveil & Découverte", emoji: "🔤" },
  { id: "favorites", label: "Mes Favoris", emoji: "❤️" },
  { id: "offline", label: "Hors ligne", emoji: "💾" },
];

export default function ChildPlaylistsPage() {
  const locale = useLocale();
  const { token } = useAuth();
  const { session } = useChildSession();
  const { saved: offlinePlaylists } = useOfflinePlaylists();

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [favorites, setFavorites] = useState<VideoFavorite[]>([]);
  const [inProgress, setInProgress] = useState<InProgressItem[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [favoritePending, setFavoritePending] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);
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
        if (active) {
          setError(
            "Impossible de charger vos chaînes et favoris. Réessayez dans un instant."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, session?.profileId]);

  const toggleFavorite = async (video: VideoSummary) => {
    if (!token || !session?.profileId || favoritePending) return;
    const existing = favorites.some((f) => f.videoId === video.id);
    const previous = favorites;
    setFavoritePending(video.id);
    setError("");

    if (existing) {
      setFavorites(previous.filter((f) => f.videoId !== video.id));
    }
    try {
      if (existing) {
        await api.favorites.remove(token, session.profileId, video.id);
      } else {
        const favorite = await api.favorites.add(
          token,
          session.profileId,
          video.id
        );
        setFavorites((curr) => [
          ...curr.filter((item) => item.videoId !== video.id),
          favorite,
        ]);
      }
    } catch {
      setFavorites(previous);
      setError("Impossible de mettre à jour vos favoris.");
    } finally {
      setFavoritePending(null);
    }
  };

  // Filtered Playlists
  const filteredPlaylists = useMemo(() => {
    if (activeFilter === "favorites") return [];
    if (activeFilter === "offline") return [];
    if (activeFilter === "all") return playlists;

    return playlists.filter((pl) => {
      const theme = getPlaylistTheme(pl.name, pl.description);
      if (activeFilter === "stories")
        return theme.emoji === "🌙" || theme.category === "stories";
      if (activeFilter === "animals")
        return theme.emoji === "🦁" || theme.category === "animals";
      if (activeFilter === "fun")
        return (
          theme.emoji === "🎵" ||
          theme.emoji === "🎨" ||
          theme.category === "fun"
        );
      if (activeFilter === "learn")
        return (
          theme.emoji === "🔤" ||
          theme.emoji === "🚀" ||
          theme.category === "learn"
        );
      return false;
    });
  }, [playlists, activeFilter]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1c90d8] border-t-transparent shadow-lg" />
        <p className="text-base font-bold text-sky-800 animate-pulse">
          Chargement de ton univers... 🎈
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Playful Welcome Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-3xl sm:text-4xl shadow-inner border border-white/30">
              🎈
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1 text-xs font-black tracking-wider uppercase backdrop-blur-sm">
                <span>🌟</span>
                <span>Espace Découverte</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-4xl font-extrabold tracking-tight drop-shadow-sm">
                Coucou {session?.displayName || "toi"} !
              </h1>
              <p className="mt-1 text-sm sm:text-base font-medium text-sky-100 max-w-xl">
                Choisis une chaîne pour regarder tes histoires, dessins animés et découvertes préférés !
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="rounded-2xl bg-white/20 px-4 py-2 backdrop-blur-md border border-white/30 text-center">
              <span className="block text-2xl font-black">
                {playlists.length}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-100">
                Chaînes
              </span>
            </div>
            <div className="rounded-2xl bg-white/20 px-4 py-2 backdrop-blur-md border border-white/30 text-center">
              <span className="block text-2xl font-black">
                {favorites.length}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-pink-100">
                Favoris
              </span>
            </div>
          </div>
        </div>

        {/* Fun background decorative bubbles */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-10 h-32 w-32 rounded-full bg-sky-300/20 blur-lg pointer-events-none" />
      </section>

      {/* Kid-Friendly Category Filter Pills */}
      <nav aria-label="Catégories de chaînes" className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar">
        {FILTER_PILLS.map((pill) => {
          const isActive = activeFilter === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setActiveFilter(pill.id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-all duration-200 active:scale-95 shadow-sm ${
                isActive
                  ? "bg-[#1c90d8] text-white shadow-sky-200 shadow-md scale-105"
                  : "bg-white/80 text-gray-700 hover:bg-white hover:text-sky-700 border border-gray-100"
              }`}
            >
              <span className="text-base">{pill.emoji}</span>
              <span>{pill.label}</span>
              {pill.id === "favorites" && favorites.length > 0 && (
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-black ${
                    isActive ? "bg-white/30 text-white" : "bg-pink-100 text-pink-700"
                  }`}
                >
                  {favorites.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm"
        >
          {error}
        </div>
      )}

      {/* Continue Watching Section ("À reprendre") */}
      {inProgress.length > 0 && activeFilter !== "offline" && (
        <section aria-label="Reprendre le visionnage" className="rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur-md border border-white/80">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <h2 className="text-lg font-extrabold text-gray-900">
                Continuer à regarder
              </h2>
            </div>
            <Link
              href={`/${locale}/child/history`}
              className="text-xs font-bold text-[#1c90d8] hover:underline"
            >
              Tout mon historique ›
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar">
            {inProgress.map(({ video, positionSec }) => {
              const progress = video.durationSec
                ? Math.min(
                    100,
                    Math.round((positionSec / video.durationSec) * 100)
                  )
                : 0;
              return (
                <Link
                  key={video.id}
                  href={`/${locale}/child/watch/${video.id}`}
                  className="group relative w-56 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md hover:-translate-y-1"
                >
                  <div
                    className="relative w-full bg-gray-200 overflow-hidden"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {video.thumbnailUrl ? (
                      <RemoteImage
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-sky-100 to-indigo-100 text-3xl">
                        🎬
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1c90d8] shadow-lg">
                        ▶
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
                      <div
                        className="h-full bg-sky-400"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs font-bold leading-snug text-gray-800 group-hover:text-[#1c90d8]">
                      {video.title}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* VIEW 1: FAVORITES TAB */}
      {activeFilter === "favorites" && (
        <section aria-label="Mes vidéos favorites" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                Mes Vidéos Préférées ❤️
              </h2>
              <p className="text-xs font-medium text-gray-500">
                Toutes les vidéos que tu as aimées
              </p>
            </div>
            <span className="rounded-xl bg-pink-50 px-3 py-1 text-xs font-extrabold text-pink-700">
              {favorites.length} vidéo{favorites.length !== 1 ? "s" : ""}
            </span>
          </div>

          {favorites.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-pink-200 bg-white/70 p-12 text-center shadow-sm">
              <span className="text-5xl">💖</span>
              <h3 className="mt-3 text-lg font-extrabold text-gray-800">
                {"Tu n'as pas encore de favoris !"}
              </h3>
              <p className="mt-1 text-sm font-medium text-gray-500 max-w-sm mx-auto">
                {"Quand une vidéo te plaît, clique sur le cœur ❤️ pour la retrouver ici en un clin d'œil."}
              </p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#1c90d8] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#1472ad]"
              >
                <span>Découvrir des vidéos ⭐</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {favorites.map(({ video }) => (
                <article
                  key={video.id}
                  className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-xl hover:-translate-y-1 border border-gray-100 flex flex-col"
                >
                  <Link
                    href={`/${locale}/child/watch/${video.id}`}
                    className="relative block w-full overflow-hidden bg-gray-100"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {video.thumbnailUrl ? (
                      <RemoteImage
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-100 to-rose-100 text-3xl">
                        🎬
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1c90d8] shadow-xl">
                        <span className="ml-0.5 text-base font-black">▶</span>
                      </div>
                    </div>
                    {video.durationSec && (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">
                        {formatDuration(video.durationSec)}
                      </span>
                    )}
                  </Link>
                  <div className="p-3.5 flex flex-col flex-1 justify-between gap-3">
                    <Link
                      href={`/${locale}/child/watch/${video.id}`}
                      className="line-clamp-2 text-sm font-bold leading-snug text-gray-900 group-hover:text-[#1c90d8]"
                    >
                      {video.title}
                    </Link>
                    <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
                      <button
                        onClick={() => toggleFavorite(video)}
                        className="flex items-center gap-1.5 rounded-xl bg-pink-50 px-3 py-1.5 text-xs font-bold text-pink-600 hover:bg-pink-100 transition"
                      >
                        <span>❤️</span>
                        <span>Retirer</span>
                      </button>
                      <Link
                        href={`/${locale}/child/watch/${video.id}`}
                        className="flex items-center gap-1 rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-bold text-[#1c90d8] hover:bg-sky-100 transition"
                      >
                        <span>Regarder</span>
                        <span>›</span>
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* VIEW 2: OFFLINE TAB */}
      {activeFilter === "offline" && (
        <section aria-label="Chaînes hors ligne" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                Disponible Hors Ligne 💾
              </h2>
              <p className="text-xs font-medium text-gray-500">
                Playlists enregistrées pour voyager sans connexion
              </p>
            </div>
            <span className="rounded-xl bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
              {offlinePlaylists.length} playlist{offlinePlaylists.length !== 1 ? "s" : ""}
            </span>
          </div>

          {offlinePlaylists.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-emerald-200 bg-white/70 p-12 text-center shadow-sm">
              <span className="text-5xl">✈️</span>
              <h3 className="mt-3 text-lg font-extrabold text-gray-800">
                Aucune playlist hors ligne enregistrée
              </h3>
              <p className="mt-1 text-sm font-medium text-gray-500 max-w-sm mx-auto">
                Tu peux enregistrer tes playlists préférées pour les regarder en avion, en voiture ou sans wifi !
              </p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#1c90d8] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#1472ad]"
              >
                <span>Explorer les chaînes ⭐</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {offlinePlaylists.map((pl) => (
                <Link
                  key={pl.id}
                  href={`/${locale}/child/playlists/${pl.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl border border-gray-100"
                >
                  <div
                    className="relative w-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center"
                    style={{ aspectRatio: "16/9" }}
                  >
                    <span className="text-5xl">💾</span>
                    <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-emerald-800 shadow">
                      ✈️ Hors-ligne
                    </span>
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                      🎬 {pl.videos.length} vidéo{pl.videos.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-extrabold text-gray-900 group-hover:text-emerald-700">
                      {pl.name}
                    </h3>
                    {pl.description && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                        {pl.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* VIEW 3: CHANNELS & PLAYLISTS GRID (MAIN CHILD VIEW) */}
      {activeFilter !== "favorites" && activeFilter !== "offline" && (
        <section aria-label="Nos chaînes vidéos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                Toutes nos Chaînes 📺
              </h2>
              <p className="text-xs font-medium text-gray-500">
                Clique sur une chaîne pour voir tous ses épisodes
              </p>
            </div>
            <span className="rounded-xl bg-sky-50 px-3 py-1 text-xs font-extrabold text-[#1c90d8]">
              {filteredPlaylists.length} chaîne{filteredPlaylists.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filteredPlaylists.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-sky-200 bg-white/70 p-12 text-center shadow-sm">
              <span className="text-5xl">🎨</span>
              <h3 className="mt-3 text-lg font-extrabold text-gray-800">
                Pas encore de chaîne dans cette catégorie !
              </h3>
              <p className="mt-1 text-sm font-medium text-gray-500 max-w-sm mx-auto">
                {"Demande à ton parent d'ajouter de nouvelles playlists dans ton profil."}
              </p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#1c90d8] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#1472ad]"
              >
                <span>Voir toutes les chaînes ⭐</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPlaylists.map((pl) => {
                const theme = getPlaylistTheme(pl.name, pl.description);
                const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl;
                const videoCount = pl._count.playlistVideos;

                return (
                  <Link
                    key={pl.id}
                    href={`/${locale}/child/playlists/${pl.id}`}
                    className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl border border-gray-100"
                  >
                    {/* 16:9 Channel Cover */}
                    <div
                      className="relative w-full overflow-hidden"
                      style={{
                        aspectRatio: "16/9",
                        background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                      }}
                    >
                      {firstThumb ? (
                        <RemoteImage
                          src={firstThumb}
                          alt={pl.name}
                          fill
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white">
                          <span className="text-5xl drop-shadow-md">
                            {theme.emoji}
                          </span>
                          <span className="text-2xl opacity-75">
                            {theme.illustration}
                          </span>
                        </div>
                      )}

                      {/* Dark overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-70 transition-opacity group-hover:opacity-85" />

                      {/* Floating Channel Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-gray-900 shadow-md backdrop-blur-md">
                        <span>{theme.emoji}</span>
                        <span className="truncate max-w-[130px]">
                          {theme.channelLabel}
                        </span>
                      </div>

                      {/* Video Count Pill */}
                      <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md">
                        🎬 {videoCount} vidéo{videoCount !== 1 ? "s" : ""}
                      </div>

                      {/* Glowing Big Play Circle Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-105">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-[#1c90d8] shadow-2xl">
                          <span className="ml-1 text-xl font-black">▶</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                      <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-gray-900 line-clamp-1 group-hover:text-[#1c90d8] transition-colors">
                          {pl.name}
                        </h3>
                        {pl.description ? (
                          <p className="mt-1 text-xs font-medium text-gray-500 line-clamp-2 leading-relaxed">
                            {pl.description}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs font-medium text-gray-400 italic">
                            Chaîne jeunesse adaptée aux enfants
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100">
                        <span
                          className="inline-flex items-center gap-1 text-xs font-extrabold"
                          style={{ color: theme.accentColor }}
                        >
                          <span>Explorer la chaîne</span>
                          <span className="text-sm">›</span>
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-[#1c90d8] transition group-hover:bg-[#1c90d8] group-hover:text-white">
                          ▶
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Add To Playlist Modal */}
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
