"use client";

import { createHorseAction } from "@/app/(protected)/actions/horse";
import { updateHorsePhotoUrlAction } from "@/app/(protected)/actions/horse";
import { UpgradeModal } from "@/components/UpgradeModal";
import { HORSE_BREEDS, HORSE_SEX_OPTIONS } from "@/lib/horse-form-constants";
import { uploadHorseProfilePhoto } from "@/lib/horse-photo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

export default function NewHorsePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const fd = new FormData(e.currentTarget);
    const res = await createHorseAction(null, fd);
    if (res?.error) {
      if (res.error === "BARN_FULL") {
        setShowUpgrade(true);
        setPending(false);
        return;
      }
      setError(res.error);
      setPending(false);
      return;
    }
    const horseId = res?.horseId;
    if (!horseId) {
      setError("Could not create horse.");
      setPending(false);
      return;
    }

    if (file) {
      const up = await uploadHorseProfilePhoto(horseId, file);
      if ("error" in up) {
        setError(`Horse created; photo upload failed: ${up.error}`);
        setPending(false);
        router.push(`/horses/${horseId}`);
        return;
      }
      const photoRes = await updateHorsePhotoUrlAction(horseId, up.publicUrl);
      if (photoRes.error) {
        setError(`Horse created; could not save photo URL: ${photoRes.error}`);
      }
    }

    setPending(false);
    router.push(`/horses/${horseId}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      {showUpgrade && (
        <UpgradeModal
          barnName="Your barn"
          barnId=""
          currentCapacity={5}
          onClose={() => setShowUpgrade(false)}
        />
      )}
      <Link href="/horses" className="text-sm text-barn-dark/70 hover:text-brass-gold">
        ← Horses
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-semibold text-barn-dark">Add horse</h1>
      <p className="mt-2 text-barn-dark/65">Creates a profile in your current barn.</p>

      <form onSubmit={onSubmit} className="mt-10 space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Name <span className="text-barn-red">*</span>
          </label>
          <input id="name" name="name" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="barn_name" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Barn name (nickname)
          </label>
          <input id="barn_name" name="barn_name" className={inputClass} />
        </div>
        <div>
          <label htmlFor="breed" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Breed
          </label>
          <select id="breed" name="breed" className={inputClass} defaultValue="">
            <option value="">Select…</option>
            {HORSE_BREEDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sex" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Sex
          </label>
          <select id="sex" name="sex" className={inputClass} defaultValue="">
            <option value="">Select…</option>
            {HORSE_SEX_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="color" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Color
          </label>
          <input id="color" name="color" className={inputClass} />
        </div>
        <div>
          <label htmlFor="foal_date" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Foal date
          </label>
          <input id="foal_date" name="foal_date" type="date" className={inputClass} />
        </div>
        <div>
          <label htmlFor="sire" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Sire
          </label>
          <input id="sire" name="sire" className={inputClass} />
        </div>
        <div>
          <label htmlFor="dam" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Dam
          </label>
          <input id="dam" name="dam" className={inputClass} />
        </div>
        <div>
          <label htmlFor="registration_number" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Registration number
          </label>
          <input id="registration_number" name="registration_number" className={inputClass} />
        </div>
        <div>
          <label htmlFor="microchip_number" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Microchip number
          </label>
          <input id="microchip_number" name="microchip_number" className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-barn-dark/80">Photo</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-barn-dark"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-barn-dark/50">Stored at horse-photos/{`{horse_id}`}/profile.jpg after save.</p>
        </div>

        {error ? (
          <p className="rounded-lg border border-barn-red/40 bg-barn-red/10 px-3 py-2 text-sm text-barn-dark" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create horse"}
        </button>
      </form>
    </div>
  );
}
