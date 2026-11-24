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
import { unpackPlaylistDescription } from "../../../../lib/playlistCategory";

type InProgressItem = {
  positionSec: number;
  video: Pick<VideoSummary, "id" | "title" | "thumbnailUrl" | "durationSec">;
};

type SelectedVideo = Pick<VideoSummary, "id" | "title">;

// Maquette de référence : D:\DEV\nourplay\apps\mobile\assets\screenshot-tv-1.png
const MOCK_FALLBACK_CARDS = [
  { id: "alphabet", name: "Apprendre l'Alphabet", color: "#0ea5e9" },
  { id: "contes", name: "Contes & Sagesse", color: "#0284c7" },
  { id: "sciences", name: "Découverte des Sciences", color: "#0369a1" },
  { id: "chansons", name: "Chansons Douces", color: "#075985" },
];

export default function ChildPlaylistsPage() {
  const locale = useLocale();
  const { token } = useAuth();
  const { session } = useChildSession();
  const { saved: offlinePlaylists } = useOfflinePlaylists();

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [favorites, setFavorites] = useState<VideoFavorite[]>([]);
  const [inProgress, setInProgress] = useState<InProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Featured Content matching screenshot-tv-1.png
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

  const featuredTitle = featuredPlaylist
    ? `Sélection du Jour : ${featuredPlaylist.name}`
    : "Sélection du Jour : Les Histoires Éducatives";

  const featuredDesc = featuredPlaylist?.description
    ? unpackPlaylistDescription(featuredPlaylist.description, featuredPlaylist.name).cleanDescription
    : "Contenu vérifié et validé sans risque pour les enfants. Durée adaptée et sans publicité.";

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 bg-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1c90d8] border-t-transparent shadow-lg" />
        <p className="text-base font-bold text-black animate-pulse">
          Chargement de ton univers... 🎈
        </p>
      </div>
    );
  }

  // Display items for Playlists section: real playlists if present, or curated mockup fallback
  const displayPlaylists = playlists.length > 0 ? playlists : null;

  return (
    <div className="space-y-10 pb-16 text-black bg-white">
      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-50 p-4 text-sm font-semibold text-black shadow-sm"
        >
          {error}
        </div>
      )}

      {/* ── 1. Grand Hero Banner : Exact Match to screenshot-tv-1.png ── */}
      <section
        aria-label="Sélection du Jour"
        className="relative overflow-hidden rounded-2xl bg-[#162d4a] p-8 sm:p-12 lg:p-14 text-white shadow-xl transition-all"
      >
        <div className="relative z-10 max-w-3xl space-y-4">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            {featuredTitle}
          </h1>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
            {featuredDesc}
          </p>

          <div className="pt-2">
            <Link
              href={featuredWatchUrl}
              className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#fbbf24] hover:bg-[#f59e0b] text-black font-extrabold text-sm sm:text-base px-6 sm:px-8 py-3 shadow-md transition-all active:scale-95 hover:scale-105"
            >
              <span className="text-base sm:text-lg">▶</span>
              <span>Lire la vidéo</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. Playlists pour Enfants : Exact Match to screenshot-tv-1.png ── */}
      <section aria-label="Playlists pour Enfants" className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
            Playlists pour Enfants
          </h2>
        </div>

        {displayPlaylists ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {displayPlaylists.map((pl, idx) => {
              const firstThumb = pl.playlistVideos?.[0]?.video?.thumbnailUrl;
              const cardBg = MOCK_FALLBACK_CARDS[idx % MOCK_FALLBACK_CARDS.length].color;

              return (
                <Link
                  key={pl.id}
                  href={`/${locale}/child/playlists/${pl.id}`}
                  className="group flex flex-col focus:outline-none"
                  tabIndex={0}
                >
                  <div
                    className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md transition-all duration-200 group-hover:scale-105 group-focus:scale-105 group-focus:ring-4 group-focus:ring-[#1c90d8] flex items-center justify-center"
                    style={{ backgroundColor: cardBg }}
                  >
                    {firstThumb ? (
                      <RemoteImage
                        src={firstThumb}
                        alt={pl.name}
                        fill
                        className="object-cover"
                      />
                    ) : null}

                    {/* Centered White Play Triangle matching screenshot-tv-1.png */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 flex items-center justify-center text-white text-2xl font-black drop-shadow-md transition-transform group-hover:scale-110">
                        ▶
                      </div>
                    </div>
                  </div>

                  <p className="mt-2.5 font-bold text-sm sm:text-base text-black group-hover:text-[#1c90d8] transition-colors truncate">
                    {pl.name}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {MOCK_FALLBACK_CARDS.map((card) => (
              <div
                key={card.id}
                className="group flex flex-col focus:outline-none cursor-pointer"
                tabIndex={0}
              >
                <div
                  className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md transition-all duration-200 group-hover:scale-105 group-focus:scale-105 group-focus:ring-4 group-focus:ring-[#1c90d8] flex items-center justify-center"
                  style={{ backgroundColor: card.color }}
                >
                  <div className="w-10 h-10 flex items-center justify-center text-white text-2xl font-black drop-shadow-md transition-transform group-hover:scale-110">
                    ▶
                  </div>
                </div>

                <p className="mt-2.5 font-bold text-sm sm:text-base text-black group-hover:text-[#1c90d8] transition-colors truncate">
                  {card.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 3. Reprendre la lecture (si disponible) ── */}
      {inProgress.length > 0 && (
        <section aria-label="Reprendre la lecture" className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
            Reprendre la lecture
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {inProgress.map((item) => (
              <Link
                key={item.video.id}
                href={`/${locale}/child/watch/${item.video.id}`}
                className="group flex flex-col focus:outline-none"
              >
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0284c7] shadow-md transition-all duration-200 group-hover:scale-105">
                  {item.video.thumbnailUrl && (
                    <RemoteImage
                      src={item.video.thumbnailUrl}
                      alt={item.video.title}
                      fill
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-2xl font-bold">▶</span>
                  </div>
                </div>
                <p className="mt-2 font-bold text-sm sm:text-base text-black group-hover:text-[#1c90d8] transition-colors truncate">
                  {item.video.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Modal d'ajout à une playlist */}
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
