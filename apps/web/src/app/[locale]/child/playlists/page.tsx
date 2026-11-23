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
import { unpackPlaylistDescription } from "../../../../lib/playlistCategory";
import { useTvNavigation } from "../../../../hooks/useTvNavigation";

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
  const { isTv } = useTvNavigation();

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

  // TV & Desktop Featured Content
  const featuredPlaylist = useMemo(() => {
    if (playlists.length === 0) return null;
    return (
      playlists.find((p) => p.playlistVideos && p.playlistVideos.length > 0) ||
      playlists[0]
    );
  }, [playlists]);

  const featuredVideo = featuredPlaylist?.playlistVideos?.[0]?.video;
  const featuredWatchUrl =
    featuredVideo && featuredPlaylist
      ? `/${locale}/child/watch/${featuredVideo.id}?playlistId=${featuredPlaylist.id}`
      : featuredPlaylist
      ? `/${locale}/child/playlists/${featuredPlaylist.id}`
      : `/${locale}/child/playlists`;

  const featuredDesc = featuredPlaylist
    ? unpackPlaylistDescription(featuredPlaylist.description, featuredPlaylist.name).cleanDescription
    : "";

  const featuredFirstThumb = featuredPlaylist?.playlistVideos?.[0]?.video?.thumbnailUrl;

  const discoverVideos = useMemo(() => {
    const list: {
      video: { id: string; title: string; thumbnailUrl: string | null };
      playlistId: string;
      playlistName: string;
    }[] = [];
    for (const pl of playlists) {
      for (const pv of pl.playlistVideos || []) {
        if (pv.video && !list.some((item) => item.video.id === pv.video.id)) {
          list.push({ video: pv.video, playlistId: pl.id, playlistName: pl.name });
        }
      }
    }
    return list.slice(0, 12);
  }, [playlists]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1c90d8] border-t-transparent shadow-lg" />
        <p className="text-base font-bold text-sky-400 animate-pulse">
          Chargement de ton univers... 🎈
        </p>
      </div>
    );
  }

  // ── TV MODE DISPLAY (MATCHING MOCKUPS screenshot-tv-1.png, 1000017388.png, 1000017389.png) ──
  if (isTv) {
    return (
      <div className="space-y-10 pb-16">
        {/* ── 1. Grand Hero Banner : Sélection du Jour (screenshot-tv-1.png & 1000017388.png) ── */}
        <section
          aria-label="Sélection du Jour"
          className="relative overflow-hidden rounded-3xl bg-[#16325c] p-8 sm:p-12 text-white shadow-2xl border border-white/10"
        >
          <div className="relative z-10 max-w-3xl space-y-4">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight drop-shadow-md text-white">
              {featuredPlaylist?.name
                ? `Sélection du Jour : ${featuredPlaylist.name}`
                : "Sélection du Jour : Les Histoires Éducatives"}
            </h1>

            <p className="text-base sm:text-lg text-sky-100/90 leading-relaxed font-medium max-w-2xl">
              {featuredDesc ||
                "Contenu vérifié et validé sans risque pour les enfants. Durée adaptée et sans publicité."}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                href={featuredWatchUrl}
                data-tv-focus="primary"
                tabIndex={0}
                className="tv-btn inline-flex items-center justify-center gap-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base sm:text-lg px-8 py-4 shadow-2xl transition-all active:scale-95 focus:scale-105 focus:ring-4 focus:ring-amber-300"
              >
                <span className="text-xl">▶</span>
                <span>Lire la vidéo</span>
              </Link>

              {featuredPlaylist && (
                <Link
                  href={`/${locale}/child/playlists/${featuredPlaylist.id}`}
                  tabIndex={0}
                  className="tv-btn inline-flex items-center justify-center gap-2 rounded-xl bg-[#23354d]/80 hover:bg-[#2d4361] text-white font-bold text-sm sm:text-base px-6 py-4 border border-white/20 transition-all active:scale-95 focus:scale-105 focus:ring-2 focus:ring-sky-400"
                >
                  <span>ⓘ</span>
                  <span>Plus d&apos;infos</span>
                </Link>
              )}
            </div>
          </div>

          {/* Ambient background glow & cover */}
          {featuredFirstThumb && (
            <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none overflow-hidden hidden md:block">
              <RemoteImage
                src={featuredFirstThumb}
                alt={featuredPlaylist?.name || "Sélection"}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#16325c] via-[#16325c]/80 to-transparent" />
            </div>
          )}
        </section>

        {/* ── 2. Playlists pour Enfants (Directly matching screenshot-tv-1.png) ── */}
        <section aria-label="Playlists pour Enfants" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Playlists pour Enfants
            </h2>
            <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-sky-300 border border-white/10">
              {playlists.length} chaînes
            </span>
          </div>

          <div className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1">
            {playlists.map((pl) => {
              const theme = getPlaylistTheme(pl.name, pl.description);
              const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl;
              const videoCount = pl._count.playlistVideos;

              return (
                <Link
                  key={pl.id}
                  href={`/${locale}/child/playlists/${pl.id}`}
                  tabIndex={0}
                  className="group relative w-72 sm:w-80 shrink-0 flex flex-col focus:outline-none"
                >
                  {/* 16:9 Blue / Thumbnail Card (exact match to screenshot-tv-1.png) */}
                  <div
                    className="relative w-full overflow-hidden rounded-2xl border border-white/15 shadow-xl transition-all duration-200 group-hover:scale-105 group-focus:scale-105 group-focus:ring-4 group-focus:ring-sky-400"
                    style={{
                      aspectRatio: "16/9",
                      background: `linear-gradient(135deg, ${theme.gradient[0] || "#0284c7"}, ${theme.gradient[1] || "#0369a1"})`,
                    }}
                  >
                    {firstThumb && (
                      <RemoteImage
                        src={firstThumb}
                        alt={pl.name}
                        fill
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108 opacity-80"
                      />
                    )}

                    {/* Gradient shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />

                    {/* Centered White Play Triangle (signature element of screenshot-tv-1.png) */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border border-white/40 text-white shadow-lg transition-transform group-hover:scale-110 group-focus:scale-110">
                        <span className="ml-0.5 text-lg">▶</span>
                      </div>
                    </div>

                    {/* Episode count badge */}
                    <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white border border-white/10 backdrop-blur-md">
                      🎬 {videoCount}
                    </div>
                  </div>

                  {/* Title directly BELOW the card (matching screenshot-tv-1.png) */}
                  <div className="pt-3 px-1">
                    <h3 className="text-base sm:text-lg font-bold text-white line-clamp-1 group-hover:text-sky-300 transition-colors">
                      {pl.name}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── 3. Tout votre divertissement : Filtres Catégories (1000017388.png) ── */}
        <section aria-label="Tout votre divertissement" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Tout votre divertissement
            </h2>
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1">
            {FILTER_PILLS.map((pill, idx) => {
              const isActive = activeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setActiveFilter(pill.id)}
                  tabIndex={0}
                  className={`px-6 py-3.5 rounded-2xl text-sm sm:text-base font-black transition-all whitespace-nowrap focus:outline-none focus:ring-4 focus:ring-sky-400 focus:scale-105 active:scale-95 shadow-md flex items-center gap-2.5 ${
                    isActive
                      ? idx === 0
                        ? "bg-[#e50914] text-white shadow-red-500/20"
                        : "bg-[#0284c7] text-white shadow-sky-500/20"
                      : "bg-[#1e293b]/80 hover:bg-[#28384f] text-gray-200 border border-white/10"
                  }`}
                >
                  <span>{pill.emoji}</span>
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 4. Carrousel Horizontal : Continuer à regarder ── */}
        {inProgress.length > 0 && (
          <section aria-label="Continuer à regarder" className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-2xl font-black text-white">
                Continuer à regarder ⏱️
              </h2>
            </div>

            <div className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth py-3 px-1">
              {inProgress.map(({ video, positionSec }) => {
                const progress = video.durationSec
                  ? Math.min(100, Math.round((positionSec / video.durationSec) * 100))
                  : 0;
                return (
                  <Link
                    key={video.id}
                    href={`/${locale}/child/watch/${video.id}`}
                    tabIndex={0}
                    className="group relative w-64 shrink-0 overflow-hidden rounded-2xl bg-slate-900 border border-white/10 shadow-lg transition-all active:scale-95 focus:scale-105 focus:ring-4 focus:ring-sky-400"
                  >
                    <div className="relative w-full overflow-hidden bg-gray-800" style={{ aspectRatio: "16/9" }}>
                      {video.thumbnailUrl ? (
                        <RemoteImage
                          src={video.thumbnailUrl}
                          alt={video.title}
                          fill
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">🎬</div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
                        <div className="h-full bg-sky-400" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-bold text-white group-hover:text-sky-300">
                        {video.title}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 5. Carrousel Horizontal : À découvrir ce soir (1000017389.png) ── */}
        {discoverVideos.length > 0 && (
          <section aria-label="À découvrir ce soir" className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  À découvrir ce soir 🌙
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 font-medium">
                  Vidéos sélectionnées avec soin pour un moment calme et enrichissant
                </p>
              </div>
            </div>

            <div className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth py-3 px-1">
              {discoverVideos.map(({ video, playlistId, playlistName }) => (
                <Link
                  key={video.id}
                  href={`/${locale}/child/watch/${video.id}?playlistId=${playlistId}`}
                  tabIndex={0}
                  className="group relative w-64 sm:w-72 shrink-0 flex flex-col overflow-hidden rounded-2xl bg-slate-900 border border-white/10 shadow-lg transition-all active:scale-95 focus:scale-105 focus:ring-4 focus:ring-sky-400"
                >
                  <div className="relative w-full overflow-hidden bg-gray-800" style={{ aspectRatio: "16/9" }}>
                    {video.thumbnailUrl ? (
                      <RemoteImage
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-sky-950 text-3xl">🎬</div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity bg-black/30">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-950 font-black shadow-xl">
                        ▶
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-900">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                      {playlistName}
                    </span>
                    <p className="line-clamp-1 text-xs sm:text-sm font-bold text-white group-hover:text-sky-300">
                      {video.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── WEB DESKTOP & MOBILE WEB DISPLAY (MATCHING MOCKUPS) ──
  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. Hero Banner : Sélection du Jour (Directly matching screenshot-tv-1.png & 1000017388.png) ── */}
      <section
        aria-label="Sélection du Jour"
        className="relative overflow-hidden rounded-3xl bg-[#16325c] p-6 sm:p-10 md:p-12 text-white shadow-2xl border border-white/10"
      >
        <div className="relative z-10 max-w-3xl space-y-4">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white drop-shadow-md">
            {featuredPlaylist?.name
              ? `Sélection du Jour : ${featuredPlaylist.name}`
              : "Sélection du Jour : Les Histoires Éducatives"}
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-sky-100/90 leading-relaxed font-medium max-w-2xl">
            {featuredDesc ||
              "Contenu vérifié et validé sans risque pour les enfants. Durée adaptée et sans publicité."}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href={featuredWatchUrl}
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base md:text-lg px-6 sm:px-8 py-3.5 sm:py-4 shadow-xl transition-all active:scale-95 hover:scale-105"
            >
              <span className="text-lg sm:text-xl">▶</span>
              <span>Lire la vidéo</span>
            </Link>

            {featuredPlaylist && (
              <Link
                href={`/${locale}/child/playlists/${featuredPlaylist.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#23354d]/80 hover:bg-[#2d4361] text-white font-bold text-xs sm:text-sm md:text-base px-5 sm:px-6 py-3.5 sm:py-4 border border-white/20 transition-all active:scale-95 hover:scale-105"
              >
                <span>ⓘ</span>
                <span>Plus d&apos;infos</span>
              </Link>
            )}
          </div>
        </div>

        {/* Ambient background thumbnail glow */}
        {featuredFirstThumb && (
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none overflow-hidden hidden md:block">
            <RemoteImage
              src={featuredFirstThumb}
              alt={featuredPlaylist?.name || "Sélection"}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#16325c] via-[#16325c]/80 to-transparent" />
          </div>
        )}
      </section>

      {/* ── 2. Playlists pour Enfants (Directly matching screenshot-tv-1.png) ── */}
      {activeFilter === "all" && (
        <section aria-label="Playlists pour Enfants" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Playlists pour Enfants
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 font-medium mt-0.5">
                Choisis une chaîne pour regarder tes histoires, dessins animés et découvertes
              </p>
            </div>
            <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-sky-300 border border-white/10">
              {playlists.length} chaînes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-1">
            {playlists.map((pl) => {
              const theme = getPlaylistTheme(pl.name, pl.description);
              const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl;
              const videoCount = pl._count.playlistVideos;

              return (
                <Link
                  key={pl.id}
                  href={`/${locale}/child/playlists/${pl.id}`}
                  className="group flex flex-col focus:outline-none"
                >
                  {/* 16:9 Blue / Thumbnail Card (matching screenshot-tv-1.png) */}
                  <div
                    className="relative w-full overflow-hidden rounded-2xl border border-white/15 shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-sky-500/10 group-focus:scale-105 group-focus:ring-4 group-focus:ring-sky-400"
                    style={{
                      aspectRatio: "16/9",
                      background: `linear-gradient(135deg, ${theme.gradient[0] || "#0284c7"}, ${theme.gradient[1] || "#0369a1"})`,
                    }}
                  >
                    {firstThumb && (
                      <RemoteImage
                        src={firstThumb}
                        alt={pl.name}
                        fill
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108 opacity-80"
                      />
                    )}

                    {/* Gradient shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />

                    {/* Centered White Play Triangle (signature element of screenshot-tv-1.png) */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border border-white/40 text-white shadow-lg transition-transform group-hover:scale-110">
                        <span className="ml-0.5 text-lg">▶</span>
                      </div>
                    </div>

                    {/* Video Count Tag */}
                    <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white border border-white/10 backdrop-blur-md">
                      🎬 {videoCount}
                    </div>
                  </div>

                  {/* Title directly BELOW the card (matching screenshot-tv-1.png) */}
                  <div className="pt-3 px-1">
                    <h3 className="text-base font-bold text-white line-clamp-1 group-hover:text-sky-300 transition-colors">
                      {pl.name}
                    </h3>
                    <p className="text-xs text-sky-400 font-medium mt-0.5">
                      🎬 {videoCount} épisode{videoCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 3. Tout votre divertissement : Filtres Catégories (1000017388.png) ── */}
      <section aria-label="Tout votre divertissement" className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Tout votre divertissement
          </h2>
        </div>

        <nav aria-label="Catégories" className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 px-1">
          {FILTER_PILLS.map((pill, idx) => {
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-2xl px-5 py-3 text-xs sm:text-sm font-black transition-all active:scale-95 shadow-md ${
                  isActive
                    ? idx === 0
                      ? "bg-[#e50914] text-white shadow-red-500/25 scale-105"
                      : "bg-[#0284c7] text-white shadow-sky-500/25 scale-105"
                    : "bg-[#1e293b]/90 text-gray-200 hover:bg-[#28384f] hover:text-white border border-white/10"
                }`}
              >
                <span>{pill.emoji}</span>
                <span>{pill.label}</span>
                {pill.id === "favorites" && favorites.length > 0 && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-black ${
                      isActive ? "bg-white/30 text-white" : "bg-pink-500/30 text-pink-300"
                    }`}
                  >
                    {favorites.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </section>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-950/50 p-4 text-sm font-semibold text-red-200 shadow-sm"
        >
          {error}
        </div>
      )}

      {/* ── 4. Carrousel Horizontal : Continuer à regarder ── */}
      {inProgress.length > 0 && activeFilter !== "offline" && (
        <section aria-label="Reprendre le visionnage" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Continuer à regarder ⏱️
            </h2>
            <Link
              href={`/${locale}/child/history`}
              className="text-xs font-bold text-sky-400 hover:underline"
            >
              Tout mon historique ›
            </Link>
          </div>

          <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1">
            {inProgress.map(({ video, positionSec }) => {
              const progress = video.durationSec
                ? Math.min(100, Math.round((positionSec / video.durationSec) * 100))
                : 0;
              return (
                <Link
                  key={video.id}
                  href={`/${locale}/child/watch/${video.id}`}
                  className="group relative w-60 sm:w-64 shrink-0 overflow-hidden rounded-2xl bg-slate-900 border border-white/10 shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                  <div className="relative w-full overflow-hidden bg-gray-800" style={{ aspectRatio: "16/9" }}>
                    {video.thumbnailUrl ? (
                      <RemoteImage
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">🎬</div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 font-black shadow-lg">
                        ▶
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
                      <div className="h-full bg-sky-400" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900">
                    <p className="line-clamp-2 text-xs font-bold text-white group-hover:text-sky-300">
                      {video.title}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 5. Carrousel Horizontal : À découvrir ce soir (1000017389.png) ── */}
      {discoverVideos.length > 0 && activeFilter === "all" && (
        <section aria-label="À découvrir ce soir" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                À découvrir ce soir 🌙
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 font-medium">
                Vidéos sélectionnées avec soin pour un moment calme et enrichissant
              </p>
            </div>
          </div>

          <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1">
            {discoverVideos.map(({ video, playlistId, playlistName }) => (
              <Link
                key={video.id}
                href={`/${locale}/child/watch/${video.id}?playlistId=${playlistId}`}
                className="group relative w-60 sm:w-72 shrink-0 flex flex-col overflow-hidden rounded-2xl bg-slate-900 border border-white/10 shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <div className="relative w-full overflow-hidden bg-gray-800" style={{ aspectRatio: "16/9" }}>
                  {video.thumbnailUrl ? (
                    <RemoteImage
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-sky-950 text-3xl">🎬</div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950 font-black shadow-xl">
                      ▶
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-slate-900">
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                    {playlistName}
                  </span>
                  <p className="line-clamp-1 text-xs sm:text-sm font-bold text-white group-hover:text-sky-300">
                    {video.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 6. VIEW: FAVORITES TAB ── */}
      {activeFilter === "favorites" && (
        <section aria-label="Mes vidéos favorites" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Mes Vidéos Préférées ❤️
            </h2>
            <span className="rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 px-3 py-1 text-xs font-black">
              {favorites.length} vidéo{favorites.length !== 1 ? "s" : ""}
            </span>
          </div>

          {favorites.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center shadow-lg">
              <span className="text-5xl">💖</span>
              <h3 className="mt-3 text-lg font-black text-white">
                {"Tu n'as pas encore de favoris !"}
              </h3>
              <p className="mt-1 text-sm text-gray-400 max-w-sm mx-auto">
                {"Quand une vidéo te plaît, clique sur le cœur ❤️ pour la retrouver ici en un clin d'œil."}
              </p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 shadow-md hover:bg-amber-300 transition"
              >
                <span>Découvrir des vidéos ⭐</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-1">
              {favorites.map(({ video }) => (
                <article
                  key={video.id}
                  className="group relative overflow-hidden rounded-2xl bg-slate-900 border border-white/10 shadow-lg flex flex-col transition hover:scale-105"
                >
                  <Link
                    href={`/${locale}/child/watch/${video.id}`}
                    className="relative block w-full overflow-hidden bg-gray-800"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {video.thumbnailUrl ? (
                      <RemoteImage
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">🎬</div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 font-black shadow-lg">
                        ▶
                      </span>
                    </div>
                    {video.durationSec && (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-bold text-white">
                        {formatDuration(video.durationSec)}
                      </span>
                    )}
                  </Link>
                  <div className="p-3.5 flex flex-col flex-1 justify-between gap-3 bg-slate-900">
                    <Link
                      href={`/${locale}/child/watch/${video.id}`}
                      className="line-clamp-2 text-sm font-bold text-white group-hover:text-sky-300"
                    >
                      {video.title}
                    </Link>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={() => toggleFavorite(video)}
                        className="flex items-center gap-1.5 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 px-3 py-1.5 text-xs font-bold hover:bg-pink-500/30 transition"
                      >
                        <span>❤️ Retirer</span>
                      </button>
                      <Link
                        href={`/${locale}/child/watch/${video.id}`}
                        className="flex items-center gap-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1.5 text-xs font-bold hover:bg-sky-500/30 transition"
                      >
                        <span>Regarder ›</span>
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 7. VIEW: OFFLINE TAB ── */}
      {activeFilter === "offline" && (
        <section aria-label="Chaînes hors ligne" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Disponible Hors Ligne 💾
            </h2>
            <span className="rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-black">
              {offlinePlaylists.length} playlist{offlinePlaylists.length !== 1 ? "s" : ""}
            </span>
          </div>

          {offlinePlaylists.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center shadow-lg">
              <span className="text-5xl">✈️</span>
              <h3 className="mt-3 text-lg font-black text-white">
                Aucune playlist hors ligne enregistrée
              </h3>
              <p className="mt-1 text-sm text-gray-400 max-w-sm mx-auto">
                Tu peux enregistrer tes playlists préférées pour les regarder en avion, en voiture ou sans wifi !
              </p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 shadow-md hover:bg-amber-300 transition"
              >
                <span>Explorer les chaînes ⭐</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-1">
              {offlinePlaylists.map((pl) => (
                <Link
                  key={pl.id}
                  href={`/${locale}/child/playlists/${pl.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-3xl bg-slate-900 border border-white/10 shadow-lg transition hover:scale-105"
                >
                  <div
                    className="relative w-full bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center"
                    style={{ aspectRatio: "16/9" }}
                  >
                    <span className="text-5xl">💾</span>
                    <span className="absolute top-3 left-3 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-black text-emerald-300 border border-emerald-500/30">
                      ✈️ Hors-ligne
                    </span>
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">
                      🎬 {pl.videos.length} vidéos
                    </span>
                  </div>
                  <div className="p-4 bg-slate-900">
                    <h3 className="text-base font-bold text-white group-hover:text-emerald-300">
                      {pl.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 8. VIEW: FILTERED CATEGORIES ── */}
      {activeFilter !== "all" && activeFilter !== "favorites" && activeFilter !== "offline" && (
        <section aria-label="Chaînes filtrées" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {FILTER_PILLS.find((p) => p.id === activeFilter)?.label || "Chaînes"}
            </h2>
            <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-sky-300 border border-white/10">
              {filteredPlaylists.length} chaîne{filteredPlaylists.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filteredPlaylists.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center shadow-lg">
              <span className="text-5xl">🎨</span>
              <h3 className="mt-3 text-lg font-black text-white">
                Pas encore de chaîne dans cette catégorie !
              </h3>
              <p className="mt-1 text-sm text-gray-400 max-w-sm mx-auto">
                Demande à ton parent d&apos;ajouter de nouvelles playlists adaptées à ce thème.
              </p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 shadow-md hover:bg-amber-300 transition"
              >
                <span>Voir toutes les chaînes ⭐</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-1">
              {filteredPlaylists.map((pl) => {
                const theme = getPlaylistTheme(pl.name, pl.description);
                const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl;
                const videoCount = pl._count.playlistVideos;

                return (
                  <Link
                    key={pl.id}
                    href={`/${locale}/child/playlists/${pl.id}`}
                    className="group flex flex-col focus:outline-none"
                  >
                    <div
                      className="relative w-full overflow-hidden rounded-2xl border border-white/15 shadow-lg transition-all duration-300 group-hover:scale-105 group-focus:scale-105 group-focus:ring-4 group-focus:ring-sky-400"
                      style={{
                        aspectRatio: "16/9",
                        background: `linear-gradient(135deg, ${theme.gradient[0] || "#0284c7"}, ${theme.gradient[1] || "#0369a1"})`,
                      }}
                    >
                      {firstThumb && (
                        <RemoteImage
                          src={firstThumb}
                          alt={pl.name}
                          fill
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108 opacity-80"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border border-white/40 text-white shadow-lg transition-transform group-hover:scale-110">
                          <span className="ml-0.5 text-lg">▶</span>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white border border-white/10 backdrop-blur-md">
                        🎬 {videoCount}
                      </div>
                    </div>
                    <div className="pt-3 px-1">
                      <h3 className="text-base font-bold text-white line-clamp-1 group-hover:text-sky-300 transition-colors">
                        {pl.name}
                      </h3>
                      <p className="text-xs text-sky-400 font-medium mt-0.5">
                        🎬 {videoCount} épisode{videoCount !== 1 ? "s" : ""}
                      </p>
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
