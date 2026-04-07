"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { uploadLogMedia } from "@/lib/log-media";
import { PerformedBySelect } from "./PerformedBySelect";
import { CostInput } from "./CostInput";

interface MediaFile {
  file: File;
  preview: string;
  type: "photo" | "video";
}

interface BarnMember {
  id: string;
  name: string;
  role: string;
}

interface SavedPerformer {
  id: string;
  name: string;
  specialty: string | null;
  use_count: number;
}

export function LogFormWrapper({
  horseId,
  logType,
  redirectTab,
  createLogAction,
  barnMembers,
  currentUserId,
  savedPerformers = [],
  children,
}: {
  horseId: string;
  logType: string;
  redirectTab: string;
  createLogAction: (
    horseId: string,
    logType: string,
    formData: FormData,
  ) => Promise<{ id: string; error?: string } | { id?: never; error: string }>;
  barnMembers: BarnMember[];
  currentUserId: string;
  savedPerformers?: SavedPerformer[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected) return;
      const newFiles: MediaFile[] = [];
      for (let i = 0; i < selected.length; i++) {
        const f = selected[i];
        const isVideo = f.type.startsWith("video/");
        const isImage = f.type.startsWith("image/");
        if (!isVideo && !isImage) continue;
        const maxMB = isVideo ? 100 : 10;
        if (f.size > maxMB * 1024 * 1024) continue;
        newFiles.push({
          file: f,
          preview: isImage ? URL.createObjectURL(f) : "",
          type: isImage ? "photo" : "video",
        });
      }
      setFiles((prev) => [...prev, ...newFiles]);
      if (inputRef.current) inputRef.current.value = "";
    },
    [],
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      // Step 1: Create the log entry via server action
      const result = await createLogAction(horseId, logType, formData);

      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      const logId = result.id;
      if (!logId) {
        setError("Failed to create log entry.");
        setSubmitting(false);
        return;
      }

      // Step 2: Upload media files if any
      if (files.length > 0) {
        const logCategory =
          logType === "shoeing" || logType === "worming" || logType === "vet_visit"
            ? "health"
            : "activity";

        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        for (const mediaFile of files) {
          const uploadResult = await uploadLogMedia(logCategory, logId, mediaFile.file);

          if ("error" in uploadResult) {
            console.error("Media upload error:", uploadResult.error);
            continue; // Don't block on media upload failure
          }

          // Insert log_media record
          await supabase.from("log_media").insert({
            log_type: logCategory,
            log_id: logId,
            media_type: mediaFile.type,
            url: uploadResult.url,
            sort_order: 0,
          });
        }
      }

      // Step 3: Redirect to horse profile
      router.push(`/horses/${horseId}?tab=${redirectTab}`);
      router.refresh();
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      {children}

      {/* ── Who / When / Cost ── */}
      <div className="space-y-4 rounded-xl border border-barn-dark/10 bg-parchment/30 p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-barn-dark/40">
          Details
        </div>

        {/* Who */}
        <PerformedBySelect
          barnMembers={barnMembers}
          currentUserId={currentUserId}
          savedPerformers={savedPerformers}
        />

        {/* When — performed_at datetime */}
        <div>
          <label htmlFor="performed_at" className="mb-1.5 block text-sm text-barn-dark/75">
            Performed at
          </label>
          <input
            id="performed_at"
            name="performed_at"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
            className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25"
          />
        </div>

        {/* Cost */}
        <CostInput />
      </div>

      {/* Media upload section */}
      <div className="space-y-3">
        <label className="mb-1.5 block text-sm text-barn-dark/75">
          Photos &amp; Videos (optional)
        </label>

        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-lg border border-barn-dark/10 bg-parchment"
              >
                {f.type === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.preview}
                    alt={`Upload ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-barn-dark/50">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <span className="text-xs truncate max-w-full px-1">{f.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-xs shadow hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-dashed border-barn-dark/20 bg-white px-4 py-3 text-sm text-barn-dark/60 hover:border-brass-gold hover:text-barn-dark transition w-full justify-center"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
          Add photos or videos
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-m4v"
                    multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-xs text-barn-dark/40">
          Photos: JPG, PNG, WebP (max 10MB) · Videos: MP4, MOV (max 100MB)
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save entry"}
      </button>
    </form>
  );
}
