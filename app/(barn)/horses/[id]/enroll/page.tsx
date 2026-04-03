"use client";

import { HorsePhotoImg } from "@/components/HorsePhotoImg";
import { generateEmbedding } from "@/lib/embeddings";
import { uploadEnrollmentPhoto } from "@/lib/horse-photo";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const STEPS = [
  {
    key: "front_face",
    title: "Front Face",
    instruction: "Stand directly in front, capture nose to ears",
  },
  {
    key: "left_side",
    title: "Left Side",
    instruction: "Stand at the horse's left, capture the head in profile",
  },
  {
    key: "right_side",
    title: "Right Side",
    instruction: "Stand at the horse's right, capture the head in profile",
  },
  {
    key: "left_body",
    title: "Left Body",
    instruction: "Step back, capture the full left side of the horse",
  },
] as const;

export default function EnrollBiometricPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [horseName, setHorseName] = useState<string | null>(null);
  const [nameLoading, setNameLoading] = useState(true);

  const [stepIndex, setStepIndex] = useState(0);
  const [accepted, setAccepted] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [staging, setStaging] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [pickError, setPickError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Opens the device camera (mobile); avoid `capture` on the gallery input or iOS often skips the photo library. */
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) {
      setNameLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("horses")
        .select("name")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (!error && data?.name) setHorseName(data.name as string);
      else setHorseName(null);
      setNameLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
  }, []);

  const onFilePicked = useCallback(
    (file: File | null) => {
      setPickError(null);
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
    },
    [],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      e.target.value = "";
      onFilePicked(f);
    },
    [onFilePicked],
  );

  const acceptStaging = useCallback(() => {
    if (!staging || stepIndex > 3) return;
    setAccepted((prev) => {
      const next = [...prev];
      next[stepIndex] = staging;
      return next;
    });
    clearStaging();
    setStepIndex((s) => s + 1);
  }, [staging, stepIndex, clearStaging]);

  const retake = useCallback(() => {
    clearStaging();
    setPickError(null);
  }, [clearStaging]);

  const allAccepted = accepted.every((f) => f !== null);

  async function handleCompleteEnrollment() {
    if (!id || !allAccepted) return;
    setSubmitError(null);
    setSubmitting(true);

    for (let i = 0; i < STEPS.length; i++) {
      const file = accepted[i];
      if (!file) {
        setSubmitError("Missing photo for a step.");
        setSubmitting(false);
        return;
      }

      const embedding = await generateEmbedding(file);
      const up = await uploadEnrollmentPhoto(id, STEPS[i].key, file);
      if ("error" in up) {
        setSubmitError(up.error);
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("horse_biometric_embeddings").upsert(
        {
          horse_id: id,
          pose_key: STEPS[i].key,
          embedding,
          photo_url: up.publicUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "horse_id,pose_key" },
      );

      if (error) {
        setSubmitError(
          `${error.message} — If the table is missing, run supabase/horse_biometric_embeddings.sql in the SQL editor.`,
        );
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    router.push(`/horses/${id}?enroll=success`);
  }

  if (!id) {
    return (
      <div className="min-h-full bg-parchment px-4 py-16 text-center text-oak">
        Invalid link.
      </div>
    );
  }

  const displayStep = Math.min(stepIndex + 1, 4);
  const current = STEPS[stepIndex];

  return (
    <div className="min-h-full bg-parchment pb-12">
      <div className="border-b border-border-warm bg-cream px-4 py-3 sm:px-6">
        <Link
          href={`/horses/${id}`}
          className="text-sm font-semibold text-brass hover:text-brass-light"
        >
          ← Horse profile
        </Link>
      </div>

      <main className="mx-auto max-w-lg px-4 pt-6 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-brass">
          Biometric ID
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-barn-dark">
          {nameLoading
            ? "Loading…"
            : `Enroll ${horseName ?? "horse"} for ID`}
        </h1>
        <p className="mt-1 text-center text-sm text-oak">
          Capture four reference angles for identification.
        </p>

        <p className="mt-6 text-center text-sm font-medium text-barn-dark">
          Step {allAccepted ? 4 : displayStep} of 4
        </p>
        <div className="mt-2 flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={STEPS[i].key}
              className={`h-2 flex-1 rounded-full ${
                accepted[i]
                  ? "bg-pasture"
                  : i === stepIndex && !staging
                    ? "bg-brass"
                    : "bg-border-warm"
              }`}
            />
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border-warm bg-cream p-5 shadow-sm sm:p-6">
          {allAccepted ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pasture/15 text-pasture">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <p className="mt-4 font-semibold text-barn-dark">
                All reference photos accepted
              </p>
              <p className="mt-2 text-sm text-oak">
                We&apos;ll compute embeddings and save them to this horse&apos;s
                record.
              </p>
              {submitError ? (
                <p
                  className="mt-4 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert"
                  role="alert"
                >
                  {submitError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleCompleteEnrollment}
                disabled={submitting}
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brass px-6 text-base font-semibold text-barn-dark shadow-sm hover:bg-brass-light disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Saving…" : "Complete enrollment"}
              </button>
            </div>
          ) : staging && previewUrl ? (
            <div>
              <p className="text-center text-sm font-medium text-oak">
                Review photo
              </p>
              <div className="relative mx-auto mt-4 aspect-[4/3] max-h-64 w-full overflow-hidden rounded-xl border border-border-warm bg-parchment">
                <HorsePhotoImg
                  src={previewUrl}
                  alt="Preview"
                  className="h-full w-full object-contain"
                  loading="eager"
                />
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={retake}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border-warm bg-cream px-6 text-base font-semibold text-barn-dark hover:bg-parchment sm:flex-initial"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={acceptStaging}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brass px-6 text-base font-semibold text-barn-dark shadow-sm hover:bg-brass-light sm:flex-initial"
                >
                  Accept
                </button>
              </div>
            </div>
          ) : current ? (
            <div>
              <div className="flex items-start gap-3">
                {stepIndex > 0 && accepted[stepIndex - 1] ? (
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pasture/15 text-pasture"
                    aria-hidden
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </span>
                ) : null}
                <div>
                  <h2 className="text-lg font-semibold text-barn-dark">
                    {current.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-oak">
                    {current.instruction}
                  </p>
                </div>
              </div>

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
                  className="mt-4 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert"
                  role="alert"
                >
                  {pickError}
                </p>
              ) : null}

              <p className="mt-6 text-center text-xs text-oak">
                Use the camera on your phone, or upload an existing photo from
                your library or computer.
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
          ) : null}
        </div>
      </main>
    </div>
  );
}
