"use client";

import { useBarn } from "@/components/BarnContext";
import { CURRENT_BARN_ID } from "@/lib/constants";
import { isAllowedHorseImage, uploadHorsePhoto } from "@/lib/horse-photo";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const BREEDS = [
  "Thoroughbred",
  "Quarter Horse",
  "Arabian",
  "Warmblood",
  "Paint",
  "Appaloosa",
  "Morgan",
  "Andalusian",
  "Friesian",
  "Draft",
  "Pony",
  "Other",
] as const;

const SEX_OPTIONS = [
  "Mare",
  "Stallion",
  "Gelding",
  "Colt",
  "Filly",
  "Unknown",
] as const;

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border-warm bg-white px-3 py-2.5 text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25";

function generateQrCode(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `ET-${ts}-${rand}`;
}

export default function NewHorsePage() {
  const router = useRouter();
  const { refreshHorses } = useBarn();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [barnName, setBarnName] = useState("");
  const [breed, setBreed] = useState<string>("Thoroughbred");
  const [sex, setSex] = useState<string>("");
  const [color, setColor] = useState("");
  const [foalDate, setFoalDate] = useState("");
  const [sire, setSire] = useState("");
  const [dam, setDam] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const pickFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!isAllowedHorseImage(file)) {
      setError("Photo must be JPEG, PNG, or WebP.");
      return;
    }
    setError(null);
    setPendingFile(file);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    pickFile(f ?? null);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    pickFile(f ?? null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    const qr_code = generateQrCode();

    const { data, error: insertError } = await supabase
      .from("horses")
      .insert({
        name: trimmed,
        barn_id: CURRENT_BARN_ID,
        barn_name: barnName.trim() || null,
        breed: breed || null,
        sex: sex || null,
        color: color.trim() || null,
        foal_date: foalDate || null,
        sire: sire.trim() || null,
        dam: dam.trim() || null,
        registration_number: registrationNumber.trim() || null,
        qr_code,
      })
      .select("id")
      .single();

    if (insertError || !data?.id) {
      setSubmitting(false);
      setError(insertError?.message ?? "Could not create horse.");
      return;
    }

    const horseId = data.id;

    if (pendingFile) {
      const up = await uploadHorsePhoto(horseId, pendingFile);
      if ("publicUrl" in up) {
        await supabase
          .from("horses")
          .update({ photo_url: up.publicUrl })
          .eq("id", horseId);
      } else {
        setError(`Horse saved; photo upload failed: ${up.error}`);
      }
    }

    await refreshHorses();
    setSubmitting(false);
    router.push(`/horses/${horseId}`);
  }

  const letter = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-full bg-parchment pb-10">
      <div className="border-b border-border-warm bg-cream px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-medium text-brass hover:text-brass-light"
        >
          ← Dashboard
        </Link>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight text-barn-dark">
          New horse profile
        </h1>
        <p className="mt-2 text-sm text-oak">
          A unique QR code will be generated when you save. Add a photo
          anytime.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error ? (
            <div
              className="rounded-lg border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mx-auto flex h-40 w-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition ${
              dragActive
                ? "border-brass bg-brass/10"
                : "border-border-warm bg-cream hover:border-brass/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onInputChange}
            />
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Preview"
                width={160}
                height={160}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-2 text-center">
                <svg
                  className="h-14 w-14 text-oak/50"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 4c-2 0-3.5 1.2-4.3 3-.4 1-.6 2-.7 3.1L5 14.5c-.3 1.1.5 2.1 1.6 2.1h1.1l.4 2.5c.2 1 1 1.7 2 1.7h4.8c1 0 1.8-.7 2-1.7l.4-2.5h1.1c1.1 0 1.9-1 1.6-2.1L17 10.1c-.1-1.1-.3-2.1-.7-3.1C15.5 5.2 14 4 12 4zm0 2c1.2 0 2.1.7 2.6 2.1.3.8.5 1.6.6 2.4l.1.6H8.7l.1-.6c.1-.8.3-1.6.6-2.4C9.9 6.7 10.8 6 12 6z" />
                </svg>
                <span className="text-2xl font-semibold text-brass">{letter}</span>
                <span className="text-xs text-oak">Tap or drop photo</span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-oak"
            >
              Name <span className="text-alert">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Registered or barn name"
              autoComplete="off"
            />
          </div>

          <div>
            <label
              htmlFor="barn_name"
              className="block text-sm font-medium text-oak"
            >
              Barn name
            </label>
            <input
              id="barn_name"
              name="barn_name"
              type="text"
              value={barnName}
              onChange={(e) => setBarnName(e.target.value)}
              className={inputClass}
              placeholder="Stable name or nickname"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="breed"
                className="block text-sm font-medium text-oak"
              >
                Breed
              </label>
              <select
                id="breed"
                name="breed"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                className={inputClass}
              >
                {BREEDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sex" className="block text-sm font-medium text-oak">
                Sex
              </label>
              <select
                id="sex"
                name="sex"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className={inputClass}
              >
                <option value="">Select…</option>
                {SEX_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="color"
                className="block text-sm font-medium text-oak"
              >
                Color
              </label>
              <input
                id="color"
                name="color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={inputClass}
                placeholder="e.g. Bay"
              />
            </div>

            <div>
              <label
                htmlFor="foal_date"
                className="block text-sm font-medium text-oak"
              >
                Foal date
              </label>
              <input
                id="foal_date"
                name="foal_date"
                type="date"
                value={foalDate}
                onChange={(e) => setFoalDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="sire" className="block text-sm font-medium text-oak">
                Sire
              </label>
              <input
                id="sire"
                name="sire"
                type="text"
                value={sire}
                onChange={(e) => setSire(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="dam" className="block text-sm font-medium text-oak">
                Dam
              </label>
              <input
                id="dam"
                name="dam"
                type="text"
                value={dam}
                onChange={(e) => setDam(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="registration_number"
              className="block text-sm font-medium text-oak"
            >
              Registration number
            </label>
            <input
              id="registration_number"
              name="registration_number"
              type="text"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-border-warm bg-cream px-5 py-2.5 text-sm font-semibold text-barn-dark hover:bg-parchment"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg bg-brass px-5 py-2.5 text-sm font-semibold text-barn-dark shadow-sm hover:bg-brass-light disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save horse"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
