import { createLogAction } from "@/app/(protected)/actions/create-log";
import { updateLogAction } from "@/app/(protected)/actions/update-log";
import { canUserAccessHorse, canUserEditHorse } from "@/lib/horse-access";
import {
  EXERCISE_SUBTYPES,
  isLogType,
  logTypeLabel,
  type LogType,
} from "@/lib/horse-form-constants";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getHorseDisplayName } from "@/lib/horse-name";
import { BreedDataForm } from "@/components/BreedDataForm";
import { LogFormWrapper } from "@/components/LogFormWrapper";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const inputClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function HorseLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; type: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id: horseId, type: typeRaw } = await params;
  const { edit: editId } = await searchParams;
  const t = typeRaw.toLowerCase();
  if (!isLogType(t)) notFound();
  const logType = t as LogType;

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ok = await canUserAccessHorse(supabase, user.id, horseId);
  if (!ok) redirect("/horses");

  const { data: horse } = await supabase
    .from("horses")
    .select("id, name, barn_name, primary_name_pref, barn_id, owner_name")
    .eq("id", horseId)
    .single();

  if (!horse) notFound();

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) {
    redirect(`/horses/${horseId}?error=no_permission`);
  }

  // Permission-level check: does the user's key permit creating THIS log type?
  // Uses the SQL helper so client-side bypasses (direct URL navigation,
  // bookmarked forms) are rejected on the server even if the UI would have
  // hidden the option.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: canLog } = await (supabase as any).rpc("user_can_log_entry", {
    p_user_id: user.id,
    p_horse_id: horseId,
    p_log_type: logType,
  });
  if (canLog !== true) {
    redirect(`/horses/${horseId}?error=not_permitted`);
  }

  // Fetch barn members for "Performed by" dropdown
  const { data: barnMembers } = await supabase
    .from("barn_members")
    .select("user_id, role")
    .eq("barn_id", horse.barn_id)
    .or("status.eq.active,status.is.null");

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
  const roleByUser = new Map(
    (barnMembers ?? []).map((m) => [m.user_id, m.role]),
  );

  const barnMembersList = memberIds.map((id) => ({
    id,
    name: nameByUser.get(id) ?? "Member",
    role: roleByUser.get(id) ?? "member",
  }));

  // Check if current user has Business Pro for financial fields section
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("has_business_pro")
    .eq("id", user.id)
    .maybeSingle();
  const hasBusinessPro = currentProfile?.has_business_pro === true;

  // Business Pro: fetch the barn's clients so the log form can offer a
  // "Select client" picker mode. Empty list for non-BP users.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barnClientsRaw } = hasBusinessPro
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from("barn_clients")
        .select("id, display_name, user_id, name_key")
        .eq("barn_id", horse.barn_id)
        .eq("archived", false)
        .order("display_name", { ascending: true })
        .limit(2000)
    : { data: [] };
  const barnClients = (barnClientsRaw ?? []) as {
    id: string;
    display_name: string;
    user_id: string | null;
    name_key: string;
  }[];

  // Fetch saved performers (sorted by most used)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: savedPerformersRaw } = await (supabase as any)
    .from("saved_performers")
    .select("id, name, specialty, use_count")
    .eq("barn_id", horse.barn_id)
    .order("use_count", { ascending: false })
    .limit(20);

  const savedPerformers = (savedPerformersRaw ?? []) as {
    id: string;
    name: string;
    specialty: string | null;
    use_count: number;
  }[];

  // ── Edit mode: fetch existing entry ──
  type ExistingEntry = Record<string, unknown> | null;
  let existing: ExistingEntry = null;
  let existingLineItems: { description: string; amount: number }[] = [];

  const activityTypes = ["exercise", "feed", "medication", "note", "breed_data"];
  const isActivity = activityTypes.includes(logType);

  if (editId) {
    if (isActivity) {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .eq("id", editId)
        .eq("horse_id", horseId)
        .single();
      existing = data as ExistingEntry;
    } else {
      const { data } = await supabase
        .from("health_records")
        .select("*")
        .eq("id", editId)
        .eq("horse_id", horseId)
        .single();
      existing = data as ExistingEntry;
    }

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: liData } = await (supabase as any)
        .from("log_entry_line_items")
        .select("description, amount, sort_order")
        .eq("log_type", isActivity ? "activity" : "health")
        .eq("log_id", editId)
        .order("sort_order", { ascending: true });
      existingLineItems = (liData ?? []) as { description: string; amount: number }[];
    }
  }

  // Helper to extract details fields
  const details: Record<string, unknown> =
    existing?.details && typeof existing.details === "object"
      ? (existing.details as Record<string, unknown>)
      : existing?.details && typeof existing.details === "string"
        ? (() => { try { return JSON.parse(existing.details as string); } catch { return {}; } })()
        : {};

  const isEditing = !!editId && !!existing;
  const tab = "logs";

  // Default values for form fields
  const dv = (key: string, fallback = "") => {
    // Check details first, then top-level entry
    if (details[key] != null && details[key] !== "") return String(details[key]);
    if (existing && existing[key] != null && existing[key] !== "") return String(existing[key]);
    return fallback;
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link
        href={`/horses/${horseId}?tab=${tab}`}
        className="text-sm text-barn-dark/70 hover:text-brass-gold"
      >
        ← {getHorseDisplayName(horse)}
      </Link>
      <h1 className="mt-6 font-serif text-2xl font-semibold text-barn-dark">
        {isEditing ? "Edit" : "Log"}: {logTypeLabel(logType)}
      </h1>

      <LogFormWrapper
        horseId={horseId}
        logType={logType}
        redirectTab={tab}
        createLogAction={createLogAction}
        updateLogAction={isEditing ? updateLogAction : undefined}
        editId={isEditing ? editId! : undefined}
        barnMembers={barnMembersList}
        currentUserId={user.id}
        savedPerformers={savedPerformers}
        initialPerformedByUserId={existing?.performed_by_user_id as string | null ?? null}
        initialPerformedByName={existing?.performed_by_name as string | null ?? null}
        initialPerformedAt={existing?.performed_at ? (existing.performed_at as string).slice(0, 16) : undefined}
        initialTotalCost={existing?.total_cost as number | null ?? null}
        initialLineItems={existingLineItems}
        hasBusinessPro={hasBusinessPro}
        horseOwnerName={(horse as { owner_name?: string | null }).owner_name ?? null}
        initialCostType={(existing?.cost_type as "revenue" | "expense" | "pass_through" | null | undefined) ?? null}
        initialBillableToUserId={(existing?.billable_to_user_id as string | null | undefined) ?? null}
        initialBillableToName={(existing?.billable_to_name as string | null | undefined) ?? null}
        initialClientId={(existing?.client_id as string | null | undefined) ?? null}
        initialPaymentStatus={(existing?.payment_status as "unpaid" | "paid" | "partial" | "waived" | null | undefined) ?? null}
        initialPaidAmount={(existing?.paid_amount as number | null | undefined) ?? null}
        initialPaidAt={(existing?.paid_at as string | null | undefined) ?? null}
        barnClients={barnClients}
      >
        {(logType === "exercise" ||
          logType === "feed" ||
          logType === "medication" ||
          logType === "note") && (
          <div>
            <label htmlFor="logged_at" className="mb-1.5 block text-sm text-barn-dark/75">
              Date
            </label>
            <input
              id="logged_at"
              name="logged_at"
              type="date"
              defaultValue={isEditing && existing?.created_at
                ? (existing.created_at as string).slice(0, 10)
                : today()}
              className={inputClass}
            />
          </div>
        )}

        {(logType === "shoeing" ||
          logType === "worming" ||
          logType === "vet_visit") && (
          <div>
            <label htmlFor="record_date" className="mb-1.5 block text-sm text-barn-dark/75">
              Record date
            </label>
            <input
              id="record_date"
              name="record_date"
              type="date"
              defaultValue={isEditing ? dv("record_date", today()) : today()}
              required
              className={inputClass}
            />
          </div>
        )}

        {logType === "exercise" ? (
          <>
            <div>
              <label htmlFor="subtype" className="mb-1.5 block text-sm text-barn-dark/75">
                Type
              </label>
              <select id="subtype" name="subtype" className={inputClass} required defaultValue={dv("subtype", "walk")}>
                {EXERCISE_SUBTYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="duration_minutes" className="mb-1.5 block text-sm text-barn-dark/75">
                Duration (minutes)
              </label>
              <input id="duration_minutes" name="duration_minutes" type="number" min={0} className={inputClass} defaultValue={dv("duration_minutes")} />
            </div>
            <div>
              <label htmlFor="distance" className="mb-1.5 block text-sm text-barn-dark/75">
                Distance (optional)
              </label>
              <input id="distance" name="distance" type="text" className={inputClass} defaultValue={dv("distance")} />
            </div>
            <div>
              <label htmlFor="track_condition" className="mb-1.5 block text-sm text-barn-dark/75">
                Track condition
              </label>
              <input id="track_condition" name="track_condition" type="text" className={inputClass} defaultValue={dv("track_condition")} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} defaultValue={dv("notes")} />
            </div>
          </>
        ) : null}

        {logType === "feed" ? (
          <>
            <div>
              <label htmlFor="feed_type" className="mb-1.5 block text-sm text-barn-dark/75">
                Feed type
              </label>
              <input id="feed_type" name="feed_type" type="text" className={inputClass} required defaultValue={dv("feed_type")} />
            </div>
            <div>
              <label htmlFor="amount" className="mb-1.5 block text-sm text-barn-dark/75">
                Amount
              </label>
              <input id="amount" name="amount" type="text" className={inputClass} defaultValue={dv("amount")} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} defaultValue={dv("notes")} />
            </div>
          </>
        ) : null}

        {logType === "medication" ? (
          <>
            <div>
              <label htmlFor="medication_name" className="mb-1.5 block text-sm text-barn-dark/75">
                Medication
              </label>
              <input id="medication_name" name="medication_name" type="text" className={inputClass} required defaultValue={dv("medication_name")} />
            </div>
            <div>
              <label htmlFor="dosage" className="mb-1.5 block text-sm text-barn-dark/75">
                Dosage
              </label>
              <input id="dosage" name="dosage" type="text" className={inputClass} defaultValue={dv("dosage")} />
            </div>
            <div>
              <label htmlFor="frequency" className="mb-1.5 block text-sm text-barn-dark/75">
                Frequency
              </label>
              <input id="frequency" name="frequency" type="text" className={inputClass} defaultValue={dv("frequency")} />
            </div>
            <div>
              <label htmlFor="start_date" className="mb-1.5 block text-sm text-barn-dark/75">
                Start date
              </label>
              <input id="start_date" name="start_date" type="date" className={inputClass} defaultValue={dv("start_date")} />
            </div>
            <div>
              <label htmlFor="end_date" className="mb-1.5 block text-sm text-barn-dark/75">
                End date
              </label>
              <input id="end_date" name="end_date" type="date" className={inputClass} defaultValue={dv("end_date")} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} defaultValue={dv("notes")} />
            </div>
          </>
        ) : null}

        {logType === "note" ? (
          <>
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm text-barn-dark/75">
                Title
              </label>
              <input id="title" name="title" type="text" className={inputClass} required defaultValue={dv("title")} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={4} className={inputClass} defaultValue={dv("notes")} />
            </div>
          </>
        ) : null}

        {logType === "shoeing" ? (
          <>
            <div>
              <label htmlFor="farrier_name" className="mb-1.5 block text-sm text-barn-dark/75">
                Farrier name
              </label>
              <input id="farrier_name" name="farrier_name" type="text" className={inputClass} required defaultValue={dv("farrier_name")} />
            </div>
            <div>
              <label htmlFor="shoe_type" className="mb-1.5 block text-sm text-barn-dark/75">
                Shoe type
              </label>
              <input id="shoe_type" name="shoe_type" type="text" className={inputClass} defaultValue={dv("shoe_type")} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} defaultValue={dv("notes")} />
            </div>
            <div>
              <label htmlFor="next_due_date" className="mb-1.5 block text-sm text-barn-dark/75">
                Next due
              </label>
              <input id="next_due_date" name="next_due_date" type="date" className={inputClass} defaultValue={dv("next_due_date")} />
            </div>
          </>
        ) : null}

        {logType === "worming" ? (
          <>
            <div>
              <label htmlFor="product_name" className="mb-1.5 block text-sm text-barn-dark/75">
                Product
              </label>
              <input id="product_name" name="product_name" type="text" className={inputClass} required defaultValue={dv("product_name")} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} defaultValue={dv("notes")} />
            </div>
            <div>
              <label htmlFor="next_due_date" className="mb-1.5 block text-sm text-barn-dark/75">
                Next due
              </label>
              <input id="next_due_date" name="next_due_date" type="date" className={inputClass} defaultValue={dv("next_due_date")} />
            </div>
          </>
        ) : null}

        {logType === "vet_visit" ? (
          <>
            <div>
              <label htmlFor="vet_name" className="mb-1.5 block text-sm text-barn-dark/75">
                Vet name
              </label>
              <input id="vet_name" name="vet_name" type="text" className={inputClass} required defaultValue={dv("vet_name")} />
            </div>
            <div>
              <label htmlFor="reason" className="mb-1.5 block text-sm text-barn-dark/75">
                Reason
              </label>
              <input id="reason" name="reason" type="text" className={inputClass} defaultValue={dv("reason")} />
            </div>
            <div>
              <label htmlFor="diagnosis" className="mb-1.5 block text-sm text-barn-dark/75">
                Diagnosis
              </label>
              <textarea id="diagnosis" name="diagnosis" rows={2} className={inputClass} defaultValue={dv("diagnosis")} />
            </div>
            <div>
              <label htmlFor="treatment" className="mb-1.5 block text-sm text-barn-dark/75">
                Treatment
              </label>
              <textarea id="treatment" name="treatment" rows={2} className={inputClass} defaultValue={dv("treatment")} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} defaultValue={dv("notes")} />
            </div>
            <div>
              <label htmlFor="follow_up_date" className="mb-1.5 block text-sm text-barn-dark/75">
                Follow-up date
              </label>
              <input id="follow_up_date" name="follow_up_date" type="date" className={inputClass} defaultValue={dv("follow_up_date")} />
            </div>
          </>
        ) : null}

        {logType === "breed_data" ? <BreedDataForm /> : null}
      </LogFormWrapper>
    </div>
  );
}
