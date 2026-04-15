"use client";

import { useState } from "react";
import type { Video } from "./videos";

function PlayIcon() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white transition-transform group-hover:scale-110">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <polygon points="8 5 20 12 8 19 8 5" />
        </svg>
      </div>
    </div>
  );
}

function getThumbnail(video: Video): string | null {
  if (video.source === "youtube") {
    return `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
  }
  if (video.source === "loom") {
    return `https://cdn.loom.com/sessions/thumbnails/${video.loomId}-with-play.gif`;
  }
  // Local videos don't have a static thumbnail
  return null;
}

function getEmbedUrl(video: Video): string | null {
  if (video.source === "youtube") {
    return `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`;
  }
  if (video.source === "loom") {
    return `https://www.loom.com/embed/${video.loomId}?autoplay=1`;
  }
  return null;
}

function VideoCard({ video, onPlay }: { video: Video; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--cream-dark)]">
        {video.source === "local" ? (
          <video
            src={video.localSrc}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={getThumbnail(video) ?? ""}
            alt={video.title}
            className="h-full w-full object-cover"
          />
        )}
        <PlayIcon />
      </div>
      <div className="p-5">
        <h3 className="font-serif text-lg font-semibold text-[var(--ink)]" style={{ letterSpacing: "-0.02em" }}>
          {video.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
          {video.description}
        </p>
      </div>
    </button>
  );
}

function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-sm font-medium text-white/80 transition-colors hover:text-white"
          aria-label="Close video"
        >
          Close &times;
        </button>
        <div className="aspect-video w-full overflow-hidden rounded-xl">
          {video.source === "local" ? (
            <video
              src={video.localSrc}
              controls
              autoPlay
              playsInline
              className="h-full w-full bg-black"
            />
          ) : (
            <iframe
              src={getEmbedUrl(video) ?? ""}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function LearnClient({ videos }: { videos: Video[] }) {
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  if (videos.length === 0) {
    return (
      <div className="mx-auto max-w-[600px] py-20 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--cream-dark)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl font-semibold text-[var(--ink)]" style={{ letterSpacing: "-0.02em" }}>
          Videos coming soon
        </h2>
        <p className="mt-3 text-[var(--ink-soft)]">
          We&apos;re recording training videos and demos. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onPlay={() => setActiveVideo(video)}
          />
        ))}
      </div>

      {activeVideo && (
        <VideoModal
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </>
  );
}
