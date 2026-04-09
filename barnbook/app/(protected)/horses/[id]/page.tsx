import { canUserAccessHorse, canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { ActivityLog, Flush, HealthRecord, Horse, HorseStay, LogMedia, LogEntryLineItem, Pregnancy } from "@/lib/types";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { HorseProfileClient } from "./HorseProfileClient";

async function getOrigin(): Promise<string> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) return siteUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function HorseProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "overview";

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ok = await canUserAccessHorse(supabase, user.id, id);
  if (!ok) redirect("/horses");

  const { data: horseRaw, error: horseErr } = await supabase
    .from("horses")
    .select("*")
    .eq("id", id)
    .single();

  if (horseErr || !horseRaw) notFound();

  const horse = horseRaw as Horse;
  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);

  const [{ data: activities }, { data: healthRows }, { data: shoeingRows }, { data: wormingRows }] =
    await Promise.all([
      supabase
        .from("activity_log")
        .select("*")
        .eq("horse_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("health_records")
        .select("*")
        .eq("horse_id", id)
        .order("record_date", { ascending: false }),
      supabase
        .from("health_records")
        .select("*")
        .eq("horse_id", id)
        .eq("record_type", "shoeing")
        .order("record_date", { ascending: false })
        .limit(1),
      supabase
        .from("health_records")
        .select("*")
        .eq("horse_id", id)
        .eq("record_type", "worming")
        .order("record_date", { ascending: false })
        .limit(1),
    ]);

  const lastShoeing = (shoeingRows?.[0] as HealthRecord) ?? null;
  const lastWorming = (wormingRows?.[0] as HealthRecord) ?? null;

  const { data: barnMembers } = await supabase
    .from("barn_members")
    .select("user_id, role")
    .eq("barn_id", horse.barn_id);

  const memberIds = [...new Set((barnMembers ?? []).map((m) => m.user_id))];
  let memberProfiles: { id: string; full_name: string | null }[] = [];
  if (memberIds.length > 0) {
    const { data: mp } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);
    memberProfiles = mp ?? [];
  }

  const nameByUser = new Map(
    memberProfiles.map((p) => [p.id, p.full_name?.trim() || "Member"]),
  );

  const accessRows: { label: string; sub: string; kind: string }[] = [];

  for (const m of barnMembers ?? []) {
    accessRows.push({
      label: nameByUser.get(m.user_id) ?? "Member",
      sub: m.role,
      kind: "Barn membership",
    });
  }

  const { data: stallAccess } = await supabase
    .from("user_horse_access")
    .select("user_id")
    .eq("horse_id", id);

  const stallIds = [...new Set((stallAccess ?? []).map((s) => s.user_id))];
  if (stallIds.length) {
    const { data: stallProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", stallIds);

    const stallMap = new Map(
      (stallProfiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Member"]),
    );

    for (const uid of stallIds) {
      if ((barnMembers ?? []).some((m) => m.user_id === uid)) continue;
      accessRows.push({
        label: stallMap.get(uid) ?? "Member",
        sub: "Stall key",
        kind: "Individual access",
      });
    }
  }

  // Fetch active stay for this horse
  const { data: activeStayRaw } = await supabase
    .from("horse_stays")
    .select("*")
    .eq("horse_id", id)
    .eq("status", "active")
    .maybeSingle();
  const activeStay = (activeStayRaw as HorseStay) ?? null;

  // Fetch log media
  const actIds = (activities ?? []).map((a) => (a as ActivityLog).id);
  const healthIds = (healthRows ?? []).map((h) => (h as HealthRecord).id);
  const allLogIds = [...actIds, ...healthIds];
  let logMedia: LogMedia[] = [];
  if (allLogIds.length > 0) {
    const { data: mediaRaw } = await supabase
      .from("log_media")
      .select("*")
      .in("log_id", allLogIds);
    logMedia = (mediaRaw ?? []) as LogMedia[];
  }

  // Fetch line items for all logs
  let logLineItems: LogEntryLineItem[] = [];
  if (allLogIds.length > 0) {
    const { data: liRaw } = await supabase
      .from("log_entry_line_items")
      .select("*")
      .in("log_id", allLogIds)
      .order("sort_order", { ascending: true });
    logLineItems = (liRaw ?? []) as LogEntryLineItem[];
  }

  // Build user name and barn name lookup maps for provenance
  const allUserIds = new Set<string>();
  const allBarnIds = new Set<string>();
  for (const a of (activities ?? []) as ActivityLog[]) {
    if (a.logged_by) allUserIds.add(a.logged_by);
    if (a.logged_at_barn_id) allBarnIds.add(a.logged_at_barn_id);
  }
  for (const h of (healthRows ?? []) as HealthRecord[]) {
    if (h.logged_by) allUserIds.add(h.logged_by);
    if (h.logged_at_barn_id) allBarnIds.add(h.logged_at_barn_id);
  }
  if (activeStay) allBarnIds.add(activeStay.host_barn_id);

  const userNames: Record<string, string> = {};
  if (allUserIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...allUserIds]);
    for (const p of profiles ?? []) {
      userNames[p.id] = p.full_name?.trim() || "Member";
    }
  }

  const barnNames: Record<string, string> = {};
  if (allBarnIds.size > 0) {
    const { data: barns } = await supabase
      .from("barns")
      .select("id, name")
      .in("id", [...allBarnIds]);
    for (const b of barns ?? []) {
      barnNames[b.id] = b.name;
    }
  }

  // Fetch all barns user has access to (for "Move to Barn")
  const { data: userOwnedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);
  const { data: userMemberships } = await supabase
    .from("barn_members")
    .select("barn_id")
    .eq("user_id", user.id)
    .or("status.eq.active,status.is.null");
  const memberBarnIds = (userMemberships ?? [])
    .map((m) => m.barn_id)
    .filter((bid) => !(userOwnedBarns ?? []).some((b) => b.id === bid));
  let memberBarnsForMove: { id: string; name: string }[] = [];
  if (memberBarnIds.length > 0) {
    const { data: mBarns } = await supabase
      .from("barns")
      .select("id, name")
      .in("id", memberBarnIds);
    memberBarnsForMove = (mBarns ?? []) as { id: string; name: string }[];
  }
  const allBarnsForMove = [
    ...((userOwnedBarns ?? []) as { id: string; name: string }[]),
    ...memberBarnsForMove,
  ];

  // Fetch barn stallions for flush form
  const { data: stallionHorses } = await supabase
    .from("horses")
    .select("id, name")
    .eq("barn_id", horse.barn_id)
    .eq("archived", false)
    .in("breeding_role", ["stallion", "multiple"]);
  const barnStallions = (stallionHorses ?? []) as { id: string; name: string }[];

  // Fetch breeding data if horse has a breeding role
  let donorFlushes: Flush[] = [];
  let surrogatePregnancies: Pregnancy[] = [];
  const breedingHorseNames: Record<string, string> = {};

  if (horse.breeding_role === "donor" || horse.breeding_role === "multiple") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: flushRaw } = await (supabase as any)
      .from("flushes")
      .select("*")
      .eq("donor_horse_id", id)
      .order("flush_date", { ascending: false });
    donorFlushes = (flushRaw ?? []) as Flush[];
  }

  if (horse.breeding_role === "recipient" || horse.breeding_role === "multiple") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pregRaw } = await (supabase as any)
      .from("pregnancies")
      .select("*")
      .eq("surrogate_horse_id", id)
      .order("transfer_date", { ascending: false });
    surrogatePregnancies = (pregRaw ?? []) as Pregnancy[];

    // Fetch donor names for pregnancies
    const pregHorseIds = new Set<string>();
    for (const p of surrogatePregnancies) {
      if (p.donor_horse_id) pregHorseIds.add(p.donor_horse_id);
      if (p.stallion_horse_id) pregHorseIds.add(p.stallion_horse_id);
    }
    if (pregHorseIds.size > 0) {
      const { data: pregHorses } = await supabase
        .from("horses")
        .select("id, name")
        .in("id", [...pregHorseIds]);
      for (const h of pregHorses ?? []) {
        breedingHorseNames[h.id] = h.name;
      }
    }
  }

  // Fetch sibling horses for prev/next navigation
  const { data: siblingHorses } = await supabase
    .from("horses")
    .select("id, name")
    .eq("barn_id", horse.barn_id)
    .eq("archived", false)
    .order("name", { ascending: true });

  const siblings = (siblingHorses ?? []) as { id: string; name: string }[];
  const currentIndex = siblings.findIndex((h) => h.id === id);
  const prevHorse = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextHorse = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  const origin = await getOrigin();
  const profileUrl = `${origin}/horses/${horse.id}`;
  const careUrl = `${origin}/care/${horse.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(careUrl)}`;

  return (
    <Suspense fallback={<div className="px-4 py-16 text-center text-barn-dark/70">Loading…</div>}>
      <HorseProfileClient
        horse={horse}
        canEdit={canEdit}
        initialTab={tab}
        activities={(activities ?? []) as ActivityLog[]}
        healthRows={(healthRows ?? []) as HealthRecord[]}
        accessRows={accessRows}
        profileUrl={profileUrl}
        qrSrc={qrSrc}
        listError={sp.error}
        lastShoeing={lastShoeing}
        lastWorming={lastWorming}
        activeStay={activeStay}
        logMedia={logMedia}
        lineItems={logLineItems}
        userNames={userNames}
        barnNames={barnNames}
        allBarns={allBarnsForMove}
        prevHorse={prevHorse}
        nextHorse={nextHorse}
        barnStallions={barnStallions}
        donorFlushes={donorFlushes}
        surrogatePregnancies={surrogatePregnancies}
        breedingHorseNames={breedingHorseNames}
      />
    </Suspense>
  );
}
