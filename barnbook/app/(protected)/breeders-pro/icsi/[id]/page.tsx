import { redirect, notFound } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { canUserEditHorse } from "@/lib/horse-access";
import { ICSIBatchDetailClient } from "./ICSIBatchDetailClient";

/**
 * ICSI Batch Detail — shows a single batch's oocytes and their
 * outcomes. The "Record Results" form lives here: for each oocyte,
 * mark it as developed (→ creates an embryo) or failed (with reason).
 */
export default async function ICSIBatchDetailPage({
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

  // Fetch the batch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: batchRaw, error } = await (supabase as any)
    .from("icsi_batches")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !batchRaw) notFound();
  const batch = batchRaw as {
    id: string;
    barn_id: string;
    opu_session_id: string;
    stallion_horse_id: string;
    lab_id: string | null;
    semen_type: string | null;
    shipped_date: string | null;
    received_date: string | null;
    icsi_date: string | null;
    results_date: string | null;
    ship_tracking_to_lab: string | null;
    ship_tracking_from_lab: string | null;
    lab_report_notes: string | null;
    cost: number | null;
    shipping_cost: number | null;
    status: string;
    notes: string | null;
    created_at: string;
  };

  const canEdit = await canUserEditHorse(supabase, user.id, batch.barn_id);

  // Fetch oocytes assigned to this batch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: oocytesRaw } = await (supabase as any)
    .from("oocytes")
    .select("*")
    .eq("icsi_batch_id", id)
    .order("oocyte_number", { ascending: true });

  const oocytes = (oocytesRaw ?? []) as Array<{
    id: string;
    oocyte_code: string;
    label: string | null;
    oocyte_number: number;
    maturity: string;
    status: string;
    failure_reason: string | null;
    embryo_id: string | null;
    notes: string | null;
  }>;

  // Fetch the OPU session for donor info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: opuRaw } = await (supabase as any)
    .from("opu_sessions")
    .select("donor_horse_id, opu_date")
    .eq("id", batch.opu_session_id)
    .single();
  const opu = opuRaw as { donor_horse_id: string; opu_date: string } | null;

  // Horse names
  const horseIds = new Set<string>();
  horseIds.add(batch.stallion_horse_id);
  if (opu?.donor_horse_id) horseIds.add(opu.donor_horse_id);

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

  // Lab name
  let labName: string | null = null;
  if (batch.lab_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lab } = await (supabase as any)
      .from("icsi_labs")
      .select("name")
      .eq("id", batch.lab_id)
      .single();
    if (lab) labName = (lab as { name: string }).name;
  }

  // Fetch embryo codes for oocytes that developed
  const embryoIds = oocytes
    .map((o) => o.embryo_id)
    .filter((id): id is string => !!id);
  const embryoCodes: Record<string, string> = {};
  if (embryoIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: embryos } = await (supabase as any)
      .from("embryos")
      .select("id, embryo_code")
      .in("id", embryoIds);
    for (const e of (embryos ?? []) as { id: string; embryo_code: string }[]) {
      embryoCodes[e.id] = e.embryo_code;
    }
  }

  return (
    <ICSIBatchDetailClient
      batch={batch}
      oocytes={oocytes}
      opuSessionId={batch.opu_session_id}
      donorHorseId={opu?.donor_horse_id ?? ""}
      horseNames={horseNames}
      labName={labName}
      embryoCodes={embryoCodes}
      canEdit={canEdit}
    />
  );
}
