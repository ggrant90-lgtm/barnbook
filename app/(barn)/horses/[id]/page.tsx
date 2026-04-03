"use client";

import { useBarn } from "@/components/BarnContext";
import { HorsePhotoImg } from "@/components/HorsePhotoImg";
import { ageFromFoalDate } from "@/lib/horse-age";
import {
  breedSelectOptions,
  HORSE_INPUT_CLASS,
  HORSE_SEX_OPTIONS,
} from "@/lib/horse-form";
import { isAllowedHorseImage, uploadHorsePhoto } from "@/lib/horse-photo";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Horse = {
  id: string;
  name: string;
  barn_name: string | null;
  breed: string | null;
  color: string | null;
  sex: string | null;
  foal_date: string | null;
  sire: string | null;
  dam: string | null;
  registration_number: string | null;
  microchip_number: string | null;
  photo_url: string | null;
  qr_code: string;
  created_at: string;
  updated_at: string;
};

type TabId = "overview" | "activity" | "health" | "qr";

function sortByCreatedDesc(rows: Record<string, unknown>[]) {
  return [...rows].sort((a, b) => {
    const ta = new Date(
      String(a.created_at ?? a.occurred_at ?? a.record_date ?? 0),
    ).getTime();
    const tb = new Date(
      String(b.created_at ?? b.occurred_at ?? b.record_date ?? 0),
    ).getTime();
    return tb - ta;
  });
}

function activitySummary(row: Record<string, unknown>): string {
  const t = row.activity_type;
  if (typeof t === "string" && t.trim()) return t;
  const v =
    row.description ??
    row.notes ??
    row.action ??
    row.event_type ??
    row.title ??
    row.summary;
  return typeof v === "string" && v.trim() ? v : "Activity entry";
}

function activityMetrics(row: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const dist = row.distance;
  if (dist != null && dist !== "") parts.push(`Distance: ${dist}`);
  const dur = row.duration_minutes;
  if (dur != null && dur !== "") parts.push(`${dur} min`);
  const sp = row.speed_avg;
  if (sp != null && sp !== "") parts.push(`${sp} s/furlong`);
  return parts.length ? parts.join(" · ") : null;
}

function activityWhen(row: Record<string, unknown>): string {
  const v = row.created_at ?? row.occurred_at ?? row.date;
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function healthSummary(row: Record<string, unknown>): string {
  const rt = row.record_type;
  const desc = row.description;
  const title = row.title;
  if (typeof rt === "string" && rt.trim()) {
    const extra =
      typeof desc === "string" && desc.trim()
        ? ` — ${desc}`
        : typeof title === "string" && title.trim()
          ? ` — ${title}`
          : "";
    return `${rt}${extra}`;
  }
  const v =
    row.title ??
    row.description ??
    row.type ??
    row.notes ??
    row.summary;
  return typeof v === "string" && v.trim() ? v : "Health record";
}

function healthSubline(row: Record<string, unknown>): string | null {
  const provider = row.provider_name;
  if (typeof provider === "string" && provider.trim()) return provider;
  return null;
}

function healthWhen(row: Record<string, unknown>): string {
  const v =
    row.record_date ?? row.date ?? row.created_at ?? row.occurred_at;
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "health", label: "Health" },
  { id: "qr", label: "QR Code" },
];

function HorseProfilePageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { refreshHorses } = useBarn();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const showLogSuccess = searchParams.get("log") === "success";
  const showEnrollSuccess = searchParams.get("enroll") === "success";

  const [horse, setHorse] = useState<Horse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [healthRows, setHealthRows] = useState<Record<string, unknown>[]>([]);
  const [sideError, setSideError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabId>("overview");
  const [profileUrl, setProfileUrl] = useState("");
  const [qrDownloading, setQrDownloading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBarnName, setEditBarnName] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editSex, setEditSex] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editFoalDate, setEditFoalDate] = useState("");
  const [editSire, setEditSire] = useState("");
  const [editDam, setEditDam] = useState("");
  const [editRegistration, setEditRegistration] = useState("");
  const [editMicrochip, setEditMicrochip] = useState("");

  const loadHorse = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("horses")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      setHorse(null);
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    setHorse(data as Horse);
    setLoading(false);
  }, [id]);

  const loadActivityAndHealth = useCallback(async () => {
    if (!id) return;
    setSideError(null);

    const [actRes, healthRes] = await Promise.all([
      supabase.from("activity_log").select("*").eq("horse_id", id),
      supabase.from("health_records").select("*").eq("horse_id", id),
    ]);

    const errs: string[] = [];

    if (actRes.error) {
      errs.push(actRes.error.message);
      setActivities([]);
    } else {
      setActivities(
        sortByCreatedDesc((actRes.data ?? []) as Record<string, unknown>[]),
      );
    }

    if (healthRes.error) {
      errs.push(healthRes.error.message);
      setHealthRows([]);
    } else {
      setHealthRows(
        sortByCreatedDesc((healthRes.data ?? []) as Record<string, unknown>[]),
      );
    }

    setSideError(errs.length ? errs.join(" ") : null);
  }, [id]);

  useEffect(() => {
    loadHorse();
  }, [loadHorse]);

  useEffect(() => {
    loadActivityAndHealth();
  }, [loadActivityAndHealth]);

  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    setProfileUrl(`${window.location.origin}/horses/${id}`);
  }, [id]);

  const qrImageSrc = useMemo(() => {
    if (!profileUrl) return "";
    const encoded = encodeURIComponent(profileUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
  }, [profileUrl]);

  async function downloadQr() {
    if (!qrImageSrc || !horse) return;
    setQrDownloading(true);
    try {
      const res = await fetch(qrImageSrc);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${horse.name.replace(/[^\w\s-]/g, "").trim() || "horse"}-qr.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setQrDownloading(false);
    }
  }

  const openEdit = useCallback(() => {
    if (!horse) return;
    setEditName(horse.name);
    setEditBarnName(horse.barn_name ?? "");
    setEditBreed(horse.breed ?? "Thoroughbred");
    setEditSex(horse.sex ?? "");
    setEditColor(horse.color ?? "");
    const fd = horse.foal_date;
    setEditFoalDate(fd && fd.length >= 10 ? fd.slice(0, 10) : "");
    setEditSire(horse.sire ?? "");
    setEditDam(horse.dam ?? "");
    setEditRegistration(horse.registration_number ?? "");
    setEditMicrochip(horse.microchip_number ?? "");
    setEditError(null);
    setEditing(true);
    setTab("overview");
  }, [horse]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditError(null);
  }, []);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!horse) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Name is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const { error } = await supabase
      .from("horses")
      .update({
        name: trimmed,
        barn_name: editBarnName.trim() || null,
        breed: editBreed || null,
        sex: editSex || null,
        color: editColor.trim() || null,
        foal_date: editFoalDate || null,
        sire: editSire.trim() || null,
        dam: editDam.trim() || null,
        registration_number: editRegistration.trim() || null,
        microchip_number: editMicrochip.trim() || null,
      })
      .eq("id", horse.id);
    setEditSaving(false);
    if (error) {
      setEditError(error.message);
      return;
    }
    setHorse((h) =>
      h
        ? {
            ...h,
            name: trimmed,
            barn_name: editBarnName.trim() || null,
            breed: editBreed || null,
            sex: editSex || null,
            color: editColor.trim() || null,
            foal_date: editFoalDate || null,
            sire: editSire.trim() || null,
            dam: editDam.trim() || null,
            registration_number: editRegistration.trim() || null,
            microchip_number: editMicrochip.trim() || null,
          }
        : h,
    );
    await refreshHorses();
    setEditing(false);
  }

  const handlePhotoFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !horse) return;
      setPhotoError(null);
      if (!isAllowedHorseImage(file)) {
        setPhotoError("Use JPEG, PNG, or WebP.");
        return;
      }
      setPhotoUploading(true);
      const up = await uploadHorsePhoto(horse.id, file);
      if ("error" in up) {
        setPhotoError(up.error);
      } else {
        const { error } = await supabase
          .from("horses")
          .update({ photo_url: up.publicUrl })
          .eq("id", horse.id);
        if (error) {
          setPhotoError(error.message);
        } else {
          setHorse((h) => (h ? { ...h, photo_url: up.publicUrl } : h));
          await refreshHorses();
        }
      }
      setPhotoUploading(false);
    },
    [horse, refreshHorses],
  );

  const detailRows = useMemo(() => {
    if (!horse) return [];
    return [
      { label: "Name", value: horse.name },
      { label: "Barn name", value: horse.barn_name ?? "—" },
      { label: "Breed", value: horse.breed ?? "—" },
      { label: "Sex", value: horse.sex ?? "—" },
      { label: "Color", value: horse.color ?? "—" },
      { label: "Foal date", value: horse.foal_date ?? "—" },
      { label: "Age", value: ageFromFoalDate(horse.foal_date) },
      { label: "Registration #", value: horse.registration_number ?? "—" },
      { label: "Microchip #", value: horse.microchip_number ?? "—" },
      { label: "QR code", value: horse.qr_code },
      { label: "Created", value: new Date(horse.created_at).toLocaleString() },
      { label: "Updated", value: new Date(horse.updated_at).toLocaleString() },
    ];
  }, [horse]);

  if (!id) {
    return (
      <div className="min-h-full bg-parchment px-4 py-16 text-center text-oak">
        Invalid horse link.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full bg-parchment px-4 py-16 text-center text-oak">
        Loading profile…
      </div>
    );
  }

  if (loadError || !horse) {
    return (
      <div className="min-h-full bg-parchment px-4 py-16">
        <div className="mx-auto max-w-lg rounded-xl border border-alert/30 bg-alert/10 px-4 py-6 text-center text-alert">
          <p className="font-medium">Could not load this horse.</p>
          <p className="mt-2 text-sm">{loadError ?? "Not found."}</p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-semibold text-brass hover:text-brass-light"
          >
            ← Back home
          </Link>
        </div>
      </div>
    );
  }

  function dismissSuccessBanner() {
    router.replace(`/horses/${id}`, { scroll: false });
  }

  const nameInitial =
    horse.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-full bg-parchment pb-28 sm:pb-12">
      {showLogSuccess ? (
        <div className="border-b border-pasture/30 bg-pasture/10 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-4xl items-start justify-between gap-3">
            <p className="text-sm font-medium text-pasture">
              Entry saved successfully.
            </p>
            <button
              type="button"
              onClick={dismissSuccessBanner}
              className="shrink-0 text-sm font-semibold text-pasture hover:text-pasture/80"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {showEnrollSuccess ? (
        <div className="border-b border-pasture/30 bg-pasture/10 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-4xl items-start justify-between gap-3">
            <p className="text-sm font-medium text-pasture">
              Biometric enrollment saved.
            </p>
            <button
              type="button"
              onClick={dismissSuccessBanner}
              className="shrink-0 text-sm font-semibold text-pasture hover:text-pasture/80"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-border-warm bg-cream shadow-sm">
          <div className="relative aspect-[2/1] max-h-80 w-full bg-parchment">
            {horse.photo_url ? (
              <HorsePhotoImg
                src={horse.photo_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="flex h-full min-h-[12rem] w-full items-center justify-center bg-parchment">
                <span className="text-7xl font-semibold text-oak/25">
                  {nameInitial}
                </span>
              </div>
            )}
            {photoUploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-barn-dark/40">
                <span className="text-sm font-medium text-cream">
                  Uploading…
                </span>
              </div>
            ) : null}
            {photoError ? (
              <div className="absolute left-3 right-3 top-3 rounded-lg border border-alert/40 bg-alert/90 px-3 py-2 text-xs text-cream shadow-sm">
                {photoError}
              </div>
            ) : null}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoFile}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-border-dark bg-barn-dark/90 text-brass shadow-lg transition hover:bg-barn disabled:opacity-50"
              aria-label="Change photo"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.855-.282 1.88.29 2.59L9 13.5v3a3 3 0 003 3h6a3 3 0 003-3v-1.5c0-.53-.21-1.04-.586-1.414L13.5 9.586A2 2 0 0012.172 9H9.828a2 2 0 00-1.414.586L6.827 6.175zM9 10.5a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0z"
                />
              </svg>
            </button>
          </div>

          <div className="border-b border-border-warm bg-cream px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-barn-dark sm:text-3xl">
                  {horse.name}
                </h1>
                {horse.barn_name ? (
                  <p className="mt-1 text-oak">{horse.barn_name}</p>
                ) : null}
                {horse.breed ? (
                  <span className="mt-3 inline-flex rounded-full bg-pasture/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pasture">
                    {horse.breed}
                  </span>
                ) : null}
              </div>
              {!editing ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link
                    href={`/horses/${id}/enroll`}
                    className="shrink-0 rounded-lg border border-border-warm bg-parchment px-4 py-2 text-sm font-semibold text-barn-dark transition hover:border-brass/50 hover:bg-cream"
                  >
                    Biometric ID
                  </Link>
                  <button
                    type="button"
                    onClick={openEdit}
                    className="shrink-0 rounded-lg border border-border-warm bg-parchment px-4 py-2 text-sm font-semibold text-barn-dark transition hover:border-brass/50 hover:bg-cream"
                  >
                    Edit profile
                  </button>
                </div>
              ) : null}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="rounded-xl border border-border-warm bg-parchment px-3 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-oak">
                  Sex
                </dt>
                <dd className="mt-1 text-sm font-semibold text-barn-dark">
                  {horse.sex ?? "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-border-warm bg-parchment px-3 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-oak">
                  Age
                </dt>
                <dd className="mt-1 text-sm font-semibold text-barn-dark">
                  {ageFromFoalDate(horse.foal_date)}
                </dd>
              </div>
              <div className="rounded-xl border border-border-warm bg-parchment px-3 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-oak">
                  Color
                </dt>
                <dd className="mt-1 text-sm font-semibold text-barn-dark">
                  {horse.color ?? "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-border-warm bg-parchment px-3 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-oak">
                  Registration
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-barn-dark">
                  {horse.registration_number ?? "—"}
                </dd>
              </div>
            </dl>
          </div>

          {editing ? (
            <form
              className="border-t border-border-warm bg-cream px-5 py-6 sm:px-8 sm:py-8"
              onSubmit={handleSaveEdit}
            >
              <h2 className="text-lg font-semibold text-barn-dark">
                Edit profile
              </h2>
              <p className="mt-1 text-sm text-oak">
                Update details saved to this horse&apos;s record.
              </p>
              {editError ? (
                <div
                  className="mt-4 rounded-lg border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert"
                  role="alert"
                >
                  {editError}
                </div>
              ) : null}
              <div className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="edit-name"
                    className="block text-sm font-medium text-oak"
                  >
                    Name <span className="text-alert">*</span>
                  </label>
                  <input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={HORSE_INPUT_CLASS}
                    required
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-barn-name"
                    className="block text-sm font-medium text-oak"
                  >
                    Barn name
                  </label>
                  <input
                    id="edit-barn-name"
                    value={editBarnName}
                    onChange={(e) => setEditBarnName(e.target.value)}
                    className={HORSE_INPUT_CLASS}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-breed"
                      className="block text-sm font-medium text-oak"
                    >
                      Breed
                    </label>
                    <select
                      id="edit-breed"
                      value={editBreed}
                      onChange={(e) => setEditBreed(e.target.value)}
                      className={HORSE_INPUT_CLASS}
                    >
                      {breedSelectOptions(horse.breed).map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="edit-sex"
                      className="block text-sm font-medium text-oak"
                    >
                      Sex
                    </label>
                    <select
                      id="edit-sex"
                      value={editSex}
                      onChange={(e) => setEditSex(e.target.value)}
                      className={HORSE_INPUT_CLASS}
                    >
                      <option value="">Select…</option>
                      {HORSE_SEX_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-color"
                      className="block text-sm font-medium text-oak"
                    >
                      Color
                    </label>
                    <input
                      id="edit-color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className={HORSE_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-foal"
                      className="block text-sm font-medium text-oak"
                    >
                      Foal date
                    </label>
                    <input
                      id="edit-foal"
                      type="date"
                      value={editFoalDate}
                      onChange={(e) => setEditFoalDate(e.target.value)}
                      className={HORSE_INPUT_CLASS}
                    />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-sire"
                      className="block text-sm font-medium text-oak"
                    >
                      Sire
                    </label>
                    <input
                      id="edit-sire"
                      value={editSire}
                      onChange={(e) => setEditSire(e.target.value)}
                      className={HORSE_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-dam"
                      className="block text-sm font-medium text-oak"
                    >
                      Dam
                    </label>
                    <input
                      id="edit-dam"
                      value={editDam}
                      onChange={(e) => setEditDam(e.target.value)}
                      className={HORSE_INPUT_CLASS}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="edit-reg"
                    className="block text-sm font-medium text-oak"
                  >
                    Registration number
                  </label>
                  <input
                    id="edit-reg"
                    value={editRegistration}
                    onChange={(e) => setEditRegistration(e.target.value)}
                    className={HORSE_INPUT_CLASS}
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-microchip"
                    className="block text-sm font-medium text-oak"
                  >
                    Microchip number
                  </label>
                  <input
                    id="edit-microchip"
                    value={editMicrochip}
                    onChange={(e) => setEditMicrochip(e.target.value)}
                    className={HORSE_INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={editSaving}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-warm bg-cream px-5 py-2.5 text-sm font-semibold text-barn-dark hover:bg-parchment disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brass px-5 py-2.5 text-sm font-semibold text-barn-dark shadow-sm hover:bg-brass-light disabled:opacity-60"
                >
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <>
          <div className="border-b border-border-warm px-5 py-5 sm:px-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-oak">
              Pedigree
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border-warm bg-parchment px-4 py-3">
                <p className="text-xs font-medium text-oak">Sire</p>
                <p className="mt-1 font-medium text-barn-dark">
                  {horse.sire ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border-warm bg-parchment px-4 py-3">
                <p className="text-xs font-medium text-oak">Dam</p>
                <p className="mt-1 font-medium text-barn-dark">
                  {horse.dam ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-cream px-2 pt-2 sm:px-4">
            <nav
              className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin sm:gap-2"
              aria-label="Profile sections"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-t-lg px-4 py-3 text-sm font-semibold transition ${
                    tab === t.id
                      ? "bg-barn-dark text-brass"
                      : "border border-border-warm text-oak hover:bg-parchment"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="border-t border-border-warm bg-cream px-5 py-6 sm:px-8 sm:py-8">
            {sideError ? (
              <p className="mb-4 rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                {sideError}
              </p>
            ) : null}

            {tab === "overview" && (
              <ul className="divide-y divide-border-warm rounded-xl border border-border-warm bg-cream">
                {detailRows.map((row) => (
                  <li
                    key={row.label}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="text-sm font-medium text-oak">
                      {row.label}
                    </span>
                    <span className="text-sm text-barn-dark sm:text-right">
                      {row.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {tab === "activity" && (
              <div>
                {activities.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-warm bg-parchment px-6 py-12 text-center">
                    <p className="font-medium text-barn-dark">No activity yet</p>
                    <p className="mt-2 text-sm text-oak">
                      Entries from the activity log will show up here.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {activities.map((row, i) => {
                      const key = String(
                        row.id ?? `activity-${i}-${activityWhen(row)}`,
                      );
                      return (
                        <li
                          key={key}
                          className="rounded-xl border border-border-warm bg-parchment/80 px-4 py-3"
                        >
                          <p className="font-medium text-barn-dark">
                            {activitySummary(row)}
                          </p>
                          {activityMetrics(row) ? (
                            <p className="mt-1 text-sm text-oak">
                              {activityMetrics(row)}
                            </p>
                          ) : null}
                          {typeof row.notes === "string" && row.notes.trim() ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-barn-dark/90">
                              {row.notes}
                            </p>
                          ) : null}
                          {activityWhen(row) ? (
                            <p className="mt-2 text-xs text-oak">
                              {activityWhen(row)}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {tab === "health" && (
              <div>
                {healthRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-warm bg-parchment px-6 py-12 text-center">
                    <p className="font-medium text-barn-dark">
                      No health records yet
                    </p>
                    <p className="mt-2 text-sm text-oak">
                      Vaccinations, vet visits, and notes will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {healthRows.map((row, i) => {
                      const key = String(
                        row.id ?? `health-${i}-${healthWhen(row)}`,
                      );
                      return (
                        <li
                          key={key}
                          className="rounded-xl border border-border-warm bg-parchment/80 px-4 py-3"
                        >
                          <p className="font-medium text-barn-dark">
                            {healthSummary(row)}
                          </p>
                          {healthSubline(row) ? (
                            <p className="mt-1 text-sm text-oak">
                              {healthSubline(row)}
                            </p>
                          ) : null}
                          {typeof row.notes === "string" && row.notes.trim() ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-barn-dark/90">
                              {row.notes}
                            </p>
                          ) : null}
                          {healthWhen(row) ? (
                            <p className="mt-2 text-xs text-oak">
                              {healthWhen(row)}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {tab === "qr" && (
              <div className="flex flex-col items-center text-center">
                <p className="max-w-md text-sm text-oak">
                  Scan this code to open this horse&apos;s profile in Equi-Track.
                </p>
                {qrImageSrc ? (
                  <Image
                    src={qrImageSrc}
                    alt=""
                    width={300}
                    height={300}
                    unoptimized
                    className="mt-6 rounded-xl border border-border-warm bg-cream p-2 shadow-sm"
                  />
                ) : (
                  <div className="mt-6 h-[300px] w-[300px] animate-pulse rounded-xl bg-parchment" />
                )}
                {profileUrl ? (
                  <p className="mt-4 max-w-full break-all text-xs text-oak">
                    {profileUrl}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={downloadQr}
                  disabled={!qrImageSrc || qrDownloading}
                  className="mt-6 inline-flex items-center justify-center rounded-lg bg-brass px-5 py-2.5 text-sm font-semibold text-barn-dark shadow-sm hover:bg-brass-light disabled:opacity-50"
                >
                  {qrDownloading ? "Downloading…" : "Download QR image"}
                </button>
              </div>
            )}
          </div>
            </>
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <div
          className="border-t border-border-warm bg-parchment/95 px-4 pt-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <Link
            href={`/horses/${id}/log`}
            className="pointer-events-auto flex min-h-14 w-full items-center justify-center rounded-xl bg-brass text-base font-semibold text-barn-dark shadow-lg shadow-brass/25 transition hover:bg-brass-light active:bg-brass"
          >
            + Log Entry
          </Link>
        </div>
      </div>

      <div className="mx-auto hidden max-w-4xl px-4 pb-10 pt-4 sm:block sm:px-6">
        <Link
          href={`/horses/${id}/log`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brass px-6 text-base font-semibold text-barn-dark shadow-sm hover:bg-brass-light"
        >
          + Log Entry
        </Link>
      </div>
    </div>
  );
}

export default function HorseProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-parchment px-4 py-16 text-center text-oak">
          Loading profile…
        </div>
      }
    >
      <HorseProfilePageInner />
    </Suspense>
  );
}
