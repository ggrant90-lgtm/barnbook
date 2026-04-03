"use client";

import { HorsePhotoImg } from "@/components/HorsePhotoImg";
import { generateEmbedding } from "@/lib/embeddings";
import { rankHorsesByProbe } from "@/lib/match-horse";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/** Minimum similarity (0–1) to show a match; same scale as `cosineSimilarity` in lib/embeddings.ts */
const MIN_MATCH_SCORE = 0.8;

type HorseMeta = {
  id: string;
  name: string;
  barn_name: string | null;
};

type ResultRow = {
  horseId: string;
  score: number;
  name: string;
  barnName: string | null;
};

export default function IdentifyHorsePage() {
  const [staging, setStaging] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearStaging = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setStaging(null);
    setResults(null);
    setSearchError(null);
  }, []);

  const onFilePicked = useCallback((file: File | null) => {
    setPickError(null);
    setSearchError(null);
    setResults(null);
    if (!file) return;
    const ok =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      file.type === "image/webp";
    if (!ok) {
      setPickError("Please use a JPEG, PNG, or WebP photo.");
      return;
    }
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setStaging(file);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      e.target.value = "";
      onFilePicked(f);
    },
    [onFilePicked],
  );

  async function runSearch() {
    if (!staging) return;
    setSearchError(null);
    setResults(null);
    setSearching(true);

    try {
      const probe = await generateEmbedding(staging);

      const { data: rows, error: embError } = await supabase
        .from("horse_biometric_embeddings")
        .select("horse_id, pose_key, embedding");

      if (embError) {
        setSearchError(embError.message);
        setSearching(false);
        return;
      }

      if (!rows?.length) {
        setSearchError(
          "No enrollment data yet. Enroll horses under each horse profile (Biometric ID) first.",
        );
        setSearching(false);
        return;
      }

      const ranked = rankHorsesByProbe(
        probe,
        rows as { horse_id: string; pose_key: string; embedding: unknown }[],
      );

      if (ranked.length === 0) {
        setSearchError("Could not compare embeddings.");
        setSearching(false);
        return;
      }

      const confident = ranked.filter((r) => r.score >= MIN_MATCH_SCORE);
      if (confident.length === 0) {
        setResults([]);
        setSearching(false);
        return;
      }

      const displayRanked = confident.slice(0, 25);
      const ids = displayRanked.map((r) => r.horseId);
      const { data: horses, error: horseError } = await supabase
        .from("horses")
        .select("id, name, barn_name")
        .in("id", ids);

      if (horseError) {
        setSearchError(horseError.message);
        setSearching(false);
        return;
      }

      const meta = new Map<string, HorseMeta>();
      for (const h of horses ?? []) {
        meta.set(h.id as string, {
          id: h.id as string,
          name: (h.name as string) ?? "Unknown",
          barn_name: (h.barn_name as string | null) ?? null,
        });
      }

      const merged: ResultRow[] = displayRanked.map((r) => {
        const m = meta.get(r.horseId);
        return {
          horseId: r.horseId,
          score: r.score,
          name: m?.name ?? "Unknown horse",
          barnName: m?.barn_name ?? null,
        };
      });

      setResults(merged);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed.");
    }

    setSearching(false);
  }

  return (
    <div className="min-h-full bg-parchment pb-12">
      <div className="border-b border-border-warm bg-cream px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold text-brass hover:text-brass-light"
        >
          ← Dashboard
        </Link>
      </div>

      <main className="mx-auto max-w-lg px-4 pt-6 sm:max-w-2xl sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-brass">
          Biometric ID
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-barn-dark">
          Identify a horse
        </h1>
        <p className="mt-2 text-center text-sm text-oak">
          Upload or capture one photo. We compare it to enrolled reference
          embeddings across <span className="font-medium">all barns</span> in
          the database. Only matches at{" "}
          <span className="font-medium">
            {(MIN_MATCH_SCORE * 100).toFixed(0)}% similarity
          </span>{" "}
          or higher are shown.
        </p>

        <div className="mt-8 rounded-2xl border border-border-warm bg-cream p-5 shadow-sm sm:p-6">
          {!staging || !previewUrl ? (
            <div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-hidden
                onChange={onInputChange}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                onChange={onInputChange}
              />

              {pickError ? (
                <p
                  className="rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert"
                  role="alert"
                >
                  {pickError}
                </p>
              ) : null}

              <p className="text-center text-xs text-oak">
                Use your camera or choose an existing photo from your library or
                files.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brass px-6 text-base font-semibold text-barn-dark shadow-sm transition hover:bg-brass-light"
                >
                  Take photo with camera
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border-warm bg-cream px-6 text-base font-semibold text-barn-dark shadow-sm transition hover:bg-parchment"
                >
                  Upload from library / files
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-center text-sm font-medium text-oak">
                Probe photo
              </p>
              <div className="relative mx-auto mt-4 aspect-[4/3] max-h-64 w-full overflow-hidden rounded-xl border border-border-warm bg-parchment">
                <HorsePhotoImg
                  src={previewUrl}
                  alt="Probe"
                  className="h-full w-full object-contain"
                  loading="eager"
                />
              </div>

              {searchError ? (
                <p
                  className="mt-4 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert"
                  role="alert"
                >
                  {searchError}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={clearStaging}
                  disabled={searching}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border-warm bg-cream px-6 text-base font-semibold text-barn-dark hover:bg-parchment disabled:opacity-50 sm:flex-initial"
                >
                  Clear photo
                </button>
                <button
                  type="button"
                  onClick={runSearch}
                  disabled={searching}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brass px-6 text-base font-semibold text-barn-dark shadow-sm hover:bg-brass-light disabled:opacity-60 sm:flex-initial"
                >
                  {searching ? "Searching…" : "Search database"}
                </button>
              </div>
            </div>
          )}
        </div>

        {results !== null && results.length === 0 ? (
          <div
            className="mt-8 rounded-2xl border border-border-warm bg-cream px-5 py-8 text-center shadow-sm sm:px-8"
            role="status"
          >
            <p className="font-semibold text-barn-dark">No results found</p>
            <p className="mt-2 text-sm leading-relaxed text-oak">
              Nothing reached {(MIN_MATCH_SCORE * 100).toFixed(0)}% similarity.
              Try another photo with clearer lighting or a different angle
              (similar to enrollment: front, side, or full body).
            </p>
          </div>
        ) : null}

        {results !== null && results.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-barn-dark">
              Best matches
            </h2>
            <p className="mt-1 text-sm text-oak">
              Scores use the placeholder embedding model (0–1, higher is more
              similar). Only {(MIN_MATCH_SCORE * 100).toFixed(0)}%+ matches are
              listed. Replace with a real vision model for production.
            </p>
            <ol className="mt-4 space-y-3">
              {results.slice(0, 15).map((r, i) => (
                <li key={r.horseId}>
                  <Link
                    href={`/horses/${r.horseId}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border-warm bg-cream px-4 py-3 shadow-sm transition hover:border-brass/40"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="text-sm font-semibold text-oak">
                        #{i + 1}
                      </span>
                      <span className="min-w-0 truncate font-semibold text-barn-dark">
                        {r.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-brass">
                      {(r.score * 100).toFixed(1)}%
                    </span>
                  </Link>
                  {r.barnName ? (
                    <p className="mt-1 pl-8 text-xs text-oak">{r.barnName}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </main>
    </div>
  );
}
