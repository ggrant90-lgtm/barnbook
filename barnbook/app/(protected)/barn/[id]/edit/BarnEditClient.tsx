"use client";

import {
  addBarnPhotoAction,
  deleteBarnPhotoAction,
  updateBarnBannerAction,
  updateBarnLogoAction,
  updateBarnProfileAction,
} from "@/app/(protected)/actions/barn-profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  isAllowedImage,
  uploadBarnBanner,
  uploadBarnGalleryPhoto,
  uploadBarnLogo,
} from "@/lib/barn-media";
import { StallPurchaseFlow } from "@/components/stalls/StallPurchaseFlow";
import type { Barn, BarnPhoto } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface CapacitySummary {
  baseStalls: number;
  blockCount: number;
  blockCapacity: number;
  effectiveCapacity: number;
  horseCount: number;
}

export function BarnEditClient({
  barn,
  photos: initialPhotos,
  capacity,
}: {
  barn: Barn;
  photos: BarnPhoto[];
  capacity: CapacitySummary | null;
}) {
  const router = useRouter();
  const { show } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState<"logo" | "banner" | "gallery" | null>(null);
  const [showStallFlow, setShowStallFlow] = useState(false);

  const capacityBarnOption = capacity
    ? [{
        id: barn.id,
        name: barn.name,
        horseCount: capacity.horseCount,
        effectiveCapacity: capacity.effectiveCapacity,
      }]
    : [];

  async function handleSave() {
    if (!formRef.current) return;
    setSaving(true);
    const formData = new FormData(formRef.current);
    const result = await updateBarnProfileAction(barn.id, formData);
    setSaving(false);
    if (result.error) {
      show(result.error, "error");
    } else {
      show("Barn profile updated.", "success");
      router.refresh();
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading("logo");
    const result = await uploadBarnLogo(barn.id, file);
    if ("error" in result) {
      show(result.error, "error");
      setUploading(null);
      return;
    }
    const r = await updateBarnLogoAction(barn.id, result.publicUrl);
    setUploading(null);
    if (r.error) {
      show(r.error, "error");
    } else {
      show("Logo updated.", "success");
      router.refresh();
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading("banner");
    const result = await uploadBarnBanner(barn.id, file);
    if ("error" in result) {
      show(result.error, "error");
      setUploading(null);
      return;
    }
    const r = await updateBarnBannerAction(barn.id, result.publicUrl);
    setUploading(null);
    if (r.error) {
      show(r.error, "error");
    } else {
      show("Banner updated.", "success");
      router.refresh();
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;
    setUploading("gallery");
    for (const file of Array.from(files)) {
      if (!isAllowedImage(file)) continue;
      const result = await uploadBarnGalleryPhoto(barn.id, file);
      if ("error" in result) {
        show(result.error, "error");
        continue;
      }
      const r = await addBarnPhotoAction(barn.id, result.publicUrl);
      if (r.error) {
        show(r.error, "error");
      }
    }
    setUploading(null);
    show("Photos uploaded.", "success");
    router.refresh();
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    const r = await deleteBarnPhotoAction(photoId);
    if (r.error) {
      show(r.error, "error");
    } else {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      show("Photo removed.", "success");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/barn/${barn.id}`}
            className="text-sm text-barn-dark/70 hover:text-brass-gold"
          >
            ← View public profile
          </Link>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-barn-dark">
            Edit Barn Profile
          </h1>
          <p className="mt-1 text-sm text-barn-dark/55">
            Customize how {barn.name} appears publicly.
          </p>
        </div>
      </div>

      {/* ─── Stalls ─── */}
      {capacity && (
        <section className="mt-8">
          <h2 className="font-serif text-lg text-barn-dark">Stalls</h2>
          <div className="mt-3 rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-3xl font-serif font-semibold text-barn-dark">
                  {capacity.horseCount}
                  <span className="text-barn-dark/45"> / {capacity.effectiveCapacity}</span>
                </div>
                <div className="mt-1 text-sm text-barn-dark/60">
                  {capacity.baseStalls} base
                  {capacity.blockCount > 0 ? (
                    <>
                      {" "}+ {capacity.blockCount} block{capacity.blockCount === 1 ? "" : "s"} ({capacity.blockCapacity} stalls)
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStallFlow(true)}
                className="min-h-[44px] rounded-xl bg-brass-gold px-4 py-2.5 text-sm font-medium text-barn-dark shadow hover:brightness-110"
              >
                Add more stalls
              </button>
            </div>
            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full"
              style={{ background: "rgba(42,64,49,0.08)" }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    capacity.effectiveCapacity
                      ? Math.round((capacity.horseCount / capacity.effectiveCapacity) * 100)
                      : 0,
                  )}%`,
                  background: "#a3b88f",
                }}
              />
            </div>
          </div>
          <StallPurchaseFlow
            open={showStallFlow}
            onClose={() => setShowStallFlow(false)}
            userBarns={capacityBarnOption}
            defaultBarnId={barn.id}
            defaultMode="expand"
            onSuccess={() => router.refresh()}
          />
        </section>
      )}

      {/* ─── Banner & Logo uploads ─── */}
      <section className="mt-8 space-y-4">
        <h2 className="font-serif text-lg text-barn-dark">Branding</h2>

        {/* Banner */}
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-barn-dark/70">Banner image</p>
          <p className="mt-0.5 text-xs text-barn-dark/45">
            Recommended: 1200 x 400px or wider. Displayed at the top of your barn page.
          </p>
          <div className="mt-3">
            {barn.banner_url ? (
              <div className="relative h-32 overflow-hidden rounded-xl sm:h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={barn.banner_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-xl bg-barn-dark/5 text-sm text-barn-dark/40">
                No banner yet
              </div>
            )}
            <label className="mt-2 inline-block cursor-pointer text-sm font-medium text-brass-gold hover:underline">
              {uploading === "banner" ? "Uploading..." : "Upload banner"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleBannerUpload}
                disabled={uploading !== null}
              />
            </label>
          </div>
        </div>

        {/* Logo */}
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-barn-dark/70">Logo</p>
          <p className="mt-0.5 text-xs text-barn-dark/45">
            Square image works best. Displayed over the banner.
          </p>
          <div className="mt-3 flex items-center gap-4">
            {barn.logo_url ? (
              <div className="h-20 w-20 overflow-hidden rounded-xl border border-barn-dark/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={barn.logo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-barn-dark text-2xl font-serif font-semibold text-brass-gold">
                {barn.name.charAt(0)}
              </div>
            )}
            <label className="cursor-pointer text-sm font-medium text-brass-gold hover:underline">
              {uploading === "logo" ? "Uploading..." : "Upload logo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleLogoUpload}
                disabled={uploading !== null}
              />
            </label>
          </div>
        </div>
      </section>

      {/* ─── Profile form ─── */}
      <form ref={formRef} className="mt-8 space-y-6">
        <section>
          <h2 className="font-serif text-lg text-barn-dark">Basic info</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Barn name" name="name" defaultValue={barn.name} required />
            <Input label="Address" name="address" defaultValue={barn.address ?? ""} />
            <Input label="City" name="city" defaultValue={barn.city ?? ""} />
            <Input label="State" name="state" defaultValue={barn.state ?? ""} />
            <Input label="ZIP" name="zip" defaultValue={barn.zip ?? ""} />
          </div>
        </section>

        <section>
          <h2 className="font-serif text-lg text-barn-dark">About</h2>
          <p className="mt-1 text-xs text-barn-dark/45">
            Tell visitors about your barn. Multiple paragraphs are fine.
          </p>
          <textarea
            name="about"
            rows={5}
            defaultValue={barn.about ?? ""}
            placeholder="We're a family-owned facility focused on hunter/jumper training..."
            className="mt-3 w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-sm text-barn-dark placeholder:text-barn-dark/30 focus:border-brass-gold focus:ring-brass-gold/25 focus:outline-none"
          />
        </section>

        <section>
          <h2 className="font-serif text-lg text-barn-dark">Public contact</h2>
          <p className="mt-1 text-xs text-barn-dark/45">
            Only shown on your public barn page. Leave blank to hide.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              label="Public phone"
              name="public_phone"
              type="tel"
              defaultValue={barn.public_phone ?? ""}
              placeholder="(555) 123-4567"
            />
            <Input
              label="Public email"
              name="public_email"
              type="email"
              defaultValue={barn.public_email ?? ""}
              placeholder="info@yourbarn.com"
            />
          </div>
        </section>

        <section>
          <h2 className="font-serif text-lg text-barn-dark">Social & web</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              label="Website"
              name="website"
              defaultValue={barn.website ?? ""}
              placeholder="https://yourbarn.com"
            />
            <Input
              label="Instagram handle"
              name="instagram"
              defaultValue={barn.instagram ?? ""}
              placeholder="@yourbarn"
            />
            <Input
              label="Facebook"
              name="facebook"
              defaultValue={barn.facebook ?? ""}
              placeholder="yourbarn or full URL"
            />
          </div>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
          <Link
            href={`/barn/${barn.id}`}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-barn-dark/20 bg-white px-4 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* ─── Photo gallery management ─── */}
      <section className="mt-10 border-t border-barn-dark/10 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg text-barn-dark">Photo gallery</h2>
            <p className="mt-1 text-xs text-barn-dark/45">
              Upload photos of your facility, horses, and events.
            </p>
          </div>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-brass-gold px-4 py-2.5 text-sm font-medium text-barn-dark shadow hover:brightness-110">
            {uploading === "gallery" ? "Uploading..." : "Add photos"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={handleGalleryUpload}
              disabled={uploading !== null}
            />
          </label>
        </div>

        {photos.length === 0 ? (
          <p className="mt-6 text-center text-sm text-barn-dark/50">
            No gallery photos yet. Upload some to show off your barn!
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <div
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-barn-dark/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.photo_url}
                  alt={p.caption ?? ""}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(p.id)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-barn-red/80 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-barn-red"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {p.caption ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white">{p.caption}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
