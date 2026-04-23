import { redirect, notFound } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { canUserEditHorse } from "@/lib/horse-access";
import { OPUDetailClient } from "./OPUDetailClient";

/**
 * OPU Session Detail — shows the aspiration event, its oocytes,
 * and any ICSI batches that have been created from them.
 *
 * This is the "command center" for an OPU session: you see every
 * oocyte, can select oocytes to send to a lab (create ICSI batch),
 * can relabel oocytes, and can navigate to ICSI batch detail pages
 * to record results.
 */
export default async function OPUDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Fetch the OPU session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessionRaw, error } = await (supabase as any)
    .from("opu_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !sessionRaw) notFound();

  const session = sessionRaw as {
    id: string;
    barn_id: string;
    donor_horse_id: string;
    opu_date: string;
    veterinarian: string | null;
    facility: string | null;
    oocytes_recovered: number;
    oocytes_mature: number | null;
    oocytes_immature: number | null;
    cost: number | null;
    notes: string | null;
    created_at: string;
  };

  const canEdit = await canUserEditHorse(supabase, user.id, session.barn_id);

  // Fetch all oocytes for this session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: oocytesRaw } = await (supabase as any)
    .from("oocytes")
    .select("*")
    .eq("opu_session_id", id)
    .order("oocyte_number", { ascending: true });

  const oocytes = (oocytesRaw ?? []) as Array<{
    id: string;
    oocyte_code: string;
    label: string | null;
    oocyte_number: number;
    maturity: string;
    status: string;
    failure_reason: string | null;
    icsi_batch_id: string | null;
    embryo_id: string | null;
    notes: string | null;
  }>;

  // Fetch ICSI batches for this session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: batchesRaw } = await (supabase as any)
    .from("icsi_batches")
    .select("*")
    .eq("opu_session_id", id)
    .order("created_at", { ascending: true });

  const batches = (batchesRaw ?? []) as Array<{
    id: string;
    stallion_horse_id: string;
    lab_id: string | null;
    semen_type: string | null;
    shipped_date: string | null;
    received_date: string | null;
    icsi_date: string | null;
    results_date: string | null;
    status: string;
    cost: number | null;
    shipping_cost: number | null;
    notes: string | null;
  }>;

  // Fetch horse names (donor + stallions in batches)
  const horseIds = new Set<string>();
  horseIds.add(session.donor_horse_id);
  for (const b of batches) {
    if (b.stallion_horse_id) horseIds.add(b.stallion_horse_id);
  }

  const horseNames: Record<string, string> = {};
  if (horseIds.size > 0) {
    const { data: horses } = await supabase
      .from("horses")
      .select("id, name")
      .in("id", [...horseIds]);
    for (const h of horses ?? []) {
      horseNames[h.id] = h.name;
    }
  }

  // Fetch lab names
  const labIds = batches
    .map((b) => b.lab_id)
    .filter((id): id is string => !!id);
  const labNames: Record<string, string> = {};
  if (labIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: labs } = await (supabase as any)
      .from("icsi_labs")
      .select("id, name")
      .in("id", labIds);
    for (const l of (labs ?? []) as { id: string; name: string }[]) {
      labNames[l.id] = l.name;
    }
  }

  // Fetch stallions + labs for the ICSI batch creation form
  const { data: stallions } = await supabase
    .from("horses")
    .select("id, name, registration_number")
    .eq("barn_id", session.barn_id)
    .eq("archived", false)
    .in("breeding_role", ["stallion", "multiple"])
    .order("name", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: labs } = await (supabase as any)
    .from("icsi_labs")
    .select("id, name, city, state_province")
    .eq("barn_id", session.barn_id)
    .eq("archived", false)
    .order("name", { ascending: true });

  return (
    <OPUDetailClient
      session={session}
      oocytes={oocytes}
      batches={batches}
      horseNames={horseNames}
      labNames={labNames}
      canEdit={canEdit}
      stallions={
        (stallions ?? []) as {
          id: string;
          name: string;
          registration_number: string | null;
        }[]
      }
      labs={
        ((labs ?? []) as {
          id: string;
          name: string;
          city: string | null;
          state_province: string | null;
        }[])
      }
    />
  );
}
