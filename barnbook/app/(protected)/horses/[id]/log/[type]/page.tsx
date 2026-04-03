import { submitHorseLogAction } from "@/app/(protected)/actions/horse-log";
import { canUserAccessHorse, canUserEditHorse } from "@/lib/horse-access";
import {
  EXERCISE_SUBTYPES,
  isLogType,
  logTypeLabel,
  type LogType,
} from "@/lib/horse-form-constants";
import { createServerComponentClient } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const inputClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function HorseLogPage({
  params,
}: {
  params: Promise<{ id: string; type: string }>;
}) {
  const { id: horseId, type: typeRaw } = await params;
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
    .select("id, name, barn_id")
    .eq("id", horseId)
    .single();

  if (!horse) notFound();

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) {
    redirect(`/horses/${horseId}?error=no_permission`);
  }

  const bound = submitHorseLogAction.bind(null, horseId, logType);
  const tab =
    logType === "shoeing" || logType === "worming" || logType === "vet_visit"
      ? "health"
      : "activity";

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link
        href={`/horses/${horseId}?tab=${tab}`}
        className="text-sm text-barn-dark/70 hover:text-brass-gold"
      >
        ← {horse.name}
      </Link>
      <h1 className="mt-6 font-serif text-2xl font-semibold text-barn-dark">
        Log: {logTypeLabel(logType)}
      </h1>

      <form action={bound} className="mt-8 space-y-4">
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
              defaultValue={today()}
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
              defaultValue={today()}
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
              <select id="subtype" name="subtype" className={inputClass} required>
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
              <input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min={0}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="distance" className="mb-1.5 block text-sm text-barn-dark/75">
                Distance (optional)
              </label>
              <input id="distance" name="distance" type="text" className={inputClass} />
            </div>
            <div>
              <label htmlFor="track_condition" className="mb-1.5 block text-sm text-barn-dark/75">
                Track condition
              </label>
              <input id="track_condition" name="track_condition" type="text" className={inputClass} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} />
            </div>
          </>
        ) : null}

        {logType === "feed" ? (
          <>
            <div>
              <label htmlFor="feed_type" className="mb-1.5 block text-sm text-barn-dark/75">
                Feed type
              </label>
              <input id="feed_type" name="feed_type" type="text" className={inputClass} required />
            </div>
            <div>
              <label htmlFor="amount" className="mb-1.5 block text-sm text-barn-dark/75">
                Amount
              </label>
              <input id="amount" name="amount" type="text" className={inputClass} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} />
            </div>
          </>
        ) : null}

        {logType === "medication" ? (
          <>
            <div>
              <label htmlFor="medication_name" className="mb-1.5 block text-sm text-barn-dark/75">
                Medication
              </label>
              <input id="medication_name" name="medication_name" type="text" className={inputClass} required />
            </div>
            <div>
              <label htmlFor="dosage" className="mb-1.5 block text-sm text-barn-dark/75">
                Dosage
              </label>
              <input id="dosage" name="dosage" type="text" className={inputClass} />
            </div>
            <div>
              <label htmlFor="frequency" className="mb-1.5 block text-sm text-barn-dark/75">
                Frequency
              </label>
              <input id="frequency" name="frequency" type="text" className={inputClass} />
            </div>
            <div>
              <label htmlFor="start_date" className="mb-1.5 block text-sm text-barn-dark/75">
                Start date
              </label>
              <input id="start_date" name="start_date" type="date" className={inputClass} />
            </div>
            <div>
              <label htmlFor="end_date" className="mb-1.5 block text-sm text-barn-dark/75">
                End date
              </label>
              <input id="end_date" name="end_date" type="date" className={inputClass} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} />
            </div>
          </>
        ) : null}

        {logType === "note" ? (
          <>
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm text-barn-dark/75">
                Title
              </label>
              <input id="title" name="title" type="text" className={inputClass} required />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={4} className={inputClass} />
            </div>
          </>
        ) : null}

        {logType === "shoeing" ? (
          <>
            <div>
              <label htmlFor="farrier_name" className="mb-1.5 block text-sm text-barn-dark/75">
                Farrier name
              </label>
              <input id="farrier_name" name="farrier_name" type="text" className={inputClass} required />
            </div>
            <div>
              <label htmlFor="shoe_type" className="mb-1.5 block text-sm text-barn-dark/75">
                Shoe type
              </label>
              <input id="shoe_type" name="shoe_type" type="text" className={inputClass} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} />
            </div>
            <div>
              <label htmlFor="next_due_date" className="mb-1.5 block text-sm text-barn-dark/75">
                Next due
              </label>
              <input id="next_due_date" name="next_due_date" type="date" className={inputClass} />
            </div>
          </>
        ) : null}

        {logType === "worming" ? (
          <>
            <div>
              <label htmlFor="product_name" className="mb-1.5 block text-sm text-barn-dark/75">
                Product
              </label>
              <input id="product_name" name="product_name" type="text" className={inputClass} required />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} />
            </div>
            <div>
              <label htmlFor="next_due_date" className="mb-1.5 block text-sm text-barn-dark/75">
                Next due
              </label>
              <input id="next_due_date" name="next_due_date" type="date" className={inputClass} />
            </div>
          </>
        ) : null}

        {logType === "vet_visit" ? (
          <>
            <div>
              <label htmlFor="vet_name" className="mb-1.5 block text-sm text-barn-dark/75">
                Vet name
              </label>
              <input id="vet_name" name="vet_name" type="text" className={inputClass} required />
            </div>
            <div>
              <label htmlFor="reason" className="mb-1.5 block text-sm text-barn-dark/75">
                Reason
              </label>
              <input id="reason" name="reason" type="text" className={inputClass} />
            </div>
            <div>
              <label htmlFor="diagnosis" className="mb-1.5 block text-sm text-barn-dark/75">
                Diagnosis
              </label>
              <textarea id="diagnosis" name="diagnosis" rows={2} className={inputClass} />
            </div>
            <div>
              <label htmlFor="treatment" className="mb-1.5 block text-sm text-barn-dark/75">
                Treatment
              </label>
              <textarea id="treatment" name="treatment" rows={2} className={inputClass} />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">
                Notes
              </label>
              <textarea id="notes" name="notes" rows={3} className={inputClass} />
            </div>
            <div>
              <label htmlFor="follow_up_date" className="mb-1.5 block text-sm text-barn-dark/75">
                Follow-up date
              </label>
              <input id="follow_up_date" name="follow_up_date" type="date" className={inputClass} />
            </div>
          </>
        ) : null}

        <button
          type="submit"
          className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110"
        >
          Save entry
        </button>
      </form>
    </div>
  );
}
