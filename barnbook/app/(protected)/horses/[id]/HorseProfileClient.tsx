"use client";

import { updateHorseFormAction } from "@/app/(protected)/actions/horse";
import { ActivityEntry } from "@/components/ActivityEntry";
import { CareCard } from "@/components/CareCard";
import { HealthRecordItem } from "@/components/HealthRecord";
import { HorsePhoto } from "@/components/HorsePhoto";
import { Button, linkButtonClass } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { HORSE_BREEDS, HORSE_SEX_OPTIONS } from "@/lib/horse-form-constants";
import { uploadHorseProfilePhoto } from "@/lib/horse-photo";
import type { ActivityLog, HealthRecord, Horse } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const tabItems = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "health", label: "Health" },
  { id: "access", label: "Access" },
] as const;

type TabId = (typeof tabItems)[number]["id"];

export function HorseProfileClient({
  horse,
  canEdit,
  initialTab,
  activities,
  healthRows,
  accessRows,
  profileUrl,
  qrSrc,
  listError,
  lastShoeing,
  lastWorming,
}: {
  horse: Horse;
  canEdit: boolean;
  initialTab: string;
  activities: ActivityLog[];
  healthRows: HealthRecord[];
  accessRows: { label: string; sub: string; kind: string }[];
  profileUrl: string;
  qrSrc: string;
  listError?: string;
  lastShoeing?: HealthRecord | null;
  lastWorming?: HealthRecord | null;
}) {
  const router = useRouter();
  const { show } = useToast();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = ((): TabId => {
    const raw = tabParam ?? initialTab;
    if (
      raw === "overview" ||
      raw === "activity" ||
      raw === "health" ||
      raw === "access"
    ) {
      return raw;
    }
    return "overview";
  })();

  const setTab = useCallback(
    (next: string) => {
      const id = next as TabId;
      router.replace(`/horses/${horse.id}?tab=${id}`, { scroll: false });
    },
    [horse.id, router],
  );

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canEdit) return;
    const up = await uploadHorseProfilePhoto(horse.id, file);
    if ("error" in up) {
      show("We couldn’t upload that photo. Try a smaller JPG or PNG.", "error");
      return;
    }
    const { error } = await supabase
      .from("horses")
      .update({ photo_url: up.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", horse.id);
    if (error) {
      show("We couldn’t save the photo. Please try again.", "error");
      return;
    }
    show("Photo updated.", "success");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/horses" className="text-sm text-barn-dark/70 hover:text-brass-gold">
          ← Horses
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-barn-dark">{horse.name}</h1>
          <p className="text-sm text-barn-dark/55">{horse.breed ?? "Horse"}</p>
        </div>
        <Badge variant="pending">Biometric ID — coming soon</Badge>
      </div>

      {listError ? (
        <p className="mt-4 rounded-lg border border-barn-red/40 bg-barn-red/10 px-3 py-2 text-sm text-barn-dark">
          {listError === "no_permission"
            ? "You don’t have permission for that action."
            : (() => {
                try {
                  return decodeURIComponent(listError);
                } catch {
                  return "Something went wrong.";
                }
              })()}
        </p>
      ) : null}

      {/* Public Care Summary */}
      <div className="mt-5">
        <CareCard horse={horse} lastShoeing={lastShoeing} lastWorming={lastWorming} />
      </div>

      <div className="mt-6">
        <Tabs items={[...tabItems]} value={tab} onValueChange={setTab} />
      </div>

      <div className="rounded-b-2xl border border-t-0 border-barn-dark/10 bg-white p-5 shadow-sm sm:p-8">
        {tab === "overview" ? (
          <div className="space-y-8">
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="shrink-0">
                <div className="w-full max-w-sm overflow-hidden rounded-2xl">
                  <HorsePhoto
                    name={horse.name}
                    photoUrl={horse.photo_url}
                    className="rounded-2xl"
                    aspectClassName="aspect-[4/3] w-full"
                  />
                </div>
                {canEdit ? (
                  <label className="mt-3 inline-block cursor-pointer text-sm font-medium text-brass-gold hover:underline">
                    Change photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={onPhotoChange}
                    />
                  </label>
                ) : null}
              </div>

              <form action={updateHorseFormAction.bind(null, horse.id)} className="min-w-0 flex-1 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Name" name="name" defaultValue={horse.name} disabled={!canEdit} required />
                  <Input label="Barn name" name="barn_name" defaultValue={horse.barn_name ?? ""} disabled={!canEdit} />
                  <Select label="Breed" name="breed" defaultValue={horse.breed ?? ""} disabled={!canEdit}>
                    <option value="">—</option>
                    {HORSE_BREEDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                  <Select label="Sex" name="sex" defaultValue={horse.sex ?? ""} disabled={!canEdit}>
                    <option value="">—</option>
                    {HORSE_SEX_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <Input label="Color" name="color" defaultValue={horse.color ?? ""} disabled={!canEdit} />
                  <Input
                    label="Foal date"
                    name="foal_date"
                    type="date"
                    defaultValue={horse.foal_date?.slice(0, 10) ?? ""}
                    disabled={!canEdit}
                  />
                  <Input label="Sire" name="sire" defaultValue={horse.sire ?? ""} disabled={!canEdit} />
                  <Input label="Dam" name="dam" defaultValue={horse.dam ?? ""} disabled={!canEdit} />
                  <Input
                    label="Registration #"
                    name="registration_number"
                    defaultValue={horse.registration_number ?? ""}
                    disabled={!canEdit}
                  />
                  <Input
                    label="Microchip"
                    name="microchip_number"
                    defaultValue={horse.microchip_number ?? ""}
                    disabled={!canEdit}
                  />
                </div>

                {/* Care info — publicly visible via care card & QR code */}
                <div className="border-t border-barn-dark/10 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-barn-dark/70">
                    Care info
                    <span className="ml-2 text-xs font-normal text-barn-dark/40">
                      (visible on public care card)
                    </span>
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-barn-dark/70">
                        Feed regimen
                      </label>
                      <textarea
                        name="feed_regimen"
                        rows={2}
                        defaultValue={horse.feed_regimen ?? ""}
                        disabled={!canEdit}
                        placeholder="e.g. 2 flakes timothy AM/PM, 1 scoop Strategy"
                        className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-sm text-barn-dark placeholder:text-barn-dark/30 focus:border-brass-gold focus:ring-brass-gold/25 focus:outline-none disabled:opacity-60"
                      />
                    </div>
                    <Input
                      label="Supplements"
                      name="supplements"
                      defaultValue={horse.supplements ?? ""}
                      disabled={!canEdit}
                      placeholder="e.g. SmartPak joint support daily"
                    />
                    <Input
                      label="Turnout schedule"
                      name="turnout_schedule"
                      defaultValue={horse.turnout_schedule ?? ""}
                      disabled={!canEdit}
                      placeholder="e.g. AM turnout 7a-12p, PM stall"
                    />
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-barn-dark/70">
                        Special care notes
                      </label>
                      <textarea
                        name="special_care_notes"
                        rows={2}
                        defaultValue={horse.special_care_notes ?? ""}
                        disabled={!canEdit}
                        placeholder="e.g. Easy keeper — no grain. Muzzle on turnout."
                        className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-sm text-barn-dark placeholder:text-barn-dark/30 focus:border-brass-gold focus:ring-brass-gold/25 focus:outline-none disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {canEdit ? <Button type="submit">Save changes</Button> : null}
              </form>
            </div>

            <section className="border-t border-barn-dark/10 pt-8">
              <h2 className="font-serif text-lg text-barn-dark">QR code</h2>
              <p className="mt-1 text-sm text-barn-dark/65">
                Scan to open this horse&apos;s profile URL (sign-in required for full app).
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="rounded-xl border border-barn-dark/10 bg-parchment p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="" width={220} height={220} className="h-auto w-[200px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm text-barn-dark/80">{profileUrl}</p>
                  <p className="mt-2 font-mono text-xs text-barn-dark/50">QR: {horse.qr_code}</p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {tab === "activity" ? (
          <div className="space-y-6">
            {canEdit ? (
              <div>
                <h3 className="text-sm font-medium text-barn-dark">Add entry</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["exercise", "feed", "medication", "note"] as const).map((x) => (
                    <Link
                      key={x}
                      href={`/horses/${horse.id}/log/${x}`}
                      className={linkButtonClass("secondary", "min-h-0 px-3 py-1.5 capitalize")}
                    >
                      {x}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <ul className="divide-y divide-barn-dark/10">
              {activities.length === 0 ? (
                <li className="py-4 text-barn-dark/60">No activity yet.</li>
              ) : (
                activities.map((a) => <ActivityEntry key={a.id} activity={a} />)
              )}
            </ul>
          </div>
        ) : null}

        {tab === "health" ? (
          <div className="space-y-6">
            {canEdit ? (
              <div>
                <h3 className="text-sm font-medium text-barn-dark">Add record</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["shoeing", "worming", "vet_visit"] as const).map((x) => (
                    <Link
                      key={x}
                      href={`/horses/${horse.id}/log/${x}`}
                      className={linkButtonClass("secondary", "min-h-0 px-3 py-1.5")}
                    >
                      {x.replace("_", " ")}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <ul className="divide-y divide-barn-dark/10">
              {healthRows.length === 0 ? (
                <li className="py-4 text-barn-dark/60">No health records yet.</li>
              ) : (
                healthRows.map((h) => <HealthRecordItem key={h.id} record={h} />)
              )}
            </ul>
          </div>
        ) : null}

        {tab === "access" ? (
          <div className="space-y-6">
            <p className="text-sm text-barn-dark/70">
              People who can see this horse through your barn team or a stall key.
            </p>
            <ul className="divide-y divide-barn-dark/10">
              {accessRows.map((row, i) => (
                <li key={`${row.label}-${row.sub}-${i}`} className="flex justify-between py-3">
                  <div>
                    <p className="font-medium text-barn-dark">{row.label}</p>
                    <p className="text-xs text-barn-dark/50">{row.kind}</p>
                  </div>
                  <span className="text-sm capitalize text-barn-dark/65">{row.sub}</span>
                </li>
              ))}
            </ul>
            {canEdit ? (
              <Link href={`/keys/generate?type=stall&horse=${horse.id}`} className={linkButtonClass("primary")}>
                Generate Stall Key
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
